#!/bin/sh
# Install Command Center on the Mac mini (handoff 1.1, 7.4; CC11 spec §1). One command, then a short
# guide (docs/install-mac.md). Starts the app on boot, keeps it running, installs the updater so
# later builds go live on their own, and — if a Cloudflare tunnel config is present — runs the
# tunnel. Run from the repo root.
#
#   sh scripts/install-mac.sh            # do it
#   sh scripts/install-mac.sh --dry-run  # print the plan, change nothing (tested in CI)
#
# This script never prints or stores a real secret in the repo. The secret key and the two passwords
# are written outside the repo (CONFIG_DIR). Re-running on a Mac that is already set up leaves a
# clean, working setup and KEEPS the database, secret key and passwords (CC11 spec §1 item 5).
set -eu

DRY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="${CC_CONFIG_DIR:-$HOME/Library/Application Support/CommandCenter}"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
APP_PLIST="$LAUNCH_DIR/com.bishop.commandcenter.app.plist"
UPDATER_PLIST="$LAUNCH_DIR/com.bishop.commandcenter.updater.plist"
TUNNEL_PLIST="$LAUNCH_DIR/com.bishop.commandcenter.tunnel.plist"
PORT="${CC_PORT:-3000}"
ENV_FILE="$CONFIG_DIR/env"
DB_FILE="$CONFIG_DIR/cc.db"
APP_LOG="$CONFIG_DIR/app.log"
UPDATER_LOG="$CONFIG_DIR/updater.log"

# PATH for the launchd jobs. launchd starts jobs with a bare PATH, so `npm`/`node` are not found
# unless we set it (CC11 spec §1 item 2). Include the folder of the node that ran this installer,
# plus the usual Homebrew / system locations.
NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -n "$NODE_BIN" ]; then
  NODE_DIR="$(dirname "$NODE_BIN")"
else
  NODE_DIR="/usr/local/bin"
fi
JOB_PATH="$NODE_DIR:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

# Cloudflare tunnel: cloudflared's own `service install` on macOS starts the program WITHOUT
# `tunnel run`, so it never serves a named tunnel from ~/.cloudflared/config.yml. If that config
# exists we install our own launchd job that runs `cloudflared tunnel run <name>` (spec §1 item 4).
TUNNEL_CONFIG="$HOME/.cloudflared/config.yml"
CLOUDFLARED_BIN="$(command -v cloudflared 2>/dev/null || echo /usr/local/bin/cloudflared)"

say() { echo "$@"; }

# run CMD... : do it, or in dry-run print it and change nothing.
run() {
  if [ "$DRY" = "1" ]; then
    echo "+ $*"
  else
    "$@"
  fi
}

# emit_file TARGET CONTENT : write the file, or in dry-run announce it and print the content between
# markers so the plan is inspectable (and the CI dry-run test can check it) without touching disk.
emit_file() {
  target="$1"
  content="$2"
  if [ "$DRY" = "1" ]; then
    echo "--- begin $target ---"
    printf '%s\n' "$content"
    echo "--- end $target ---"
  else
    printf '%s\n' "$content" >"$target"
  fi
}

say "Command Center install ($([ "$DRY" = "1" ] && echo "dry run" || echo "live"))"
say "Repo:    $REPO_DIR"
say "Config:  $CONFIG_DIR"
say "Port:    $PORT"
say "Node:    ${NODE_BIN:-not found} (PATH for jobs: $JOB_PATH)"
say "Logs:    $APP_LOG, $UPDATER_LOG"
say ""

# 1. Prerequisites.
say "1. Checking prerequisites (node 20, git, cloudflared)"
run node --version
run git --version

# 2. Dependencies and production build. Keep dev dependencies so the tools migrate, smoke and the
#    updater need (tsx) stay installed — a bare `npm ci` that drops them is what made `npm run
#    migrate` fail with "tsx: command not found" (CC12 spec §1 "Dev tools needed on the Mac stay
#    installed"). Fail loudly, before building or changing anything else, if tsx is still missing.
say "2. Installing dependencies and building"
run npm ci --include=dev
if [ "$DRY" = "1" ]; then
  echo "+ verify dev tool tsx is installed (node_modules/.bin/tsx), else stop before changing anything"
else
  if [ ! -x "$REPO_DIR/node_modules/.bin/tsx" ]; then
    echo "ERROR: tsx is not installed after 'npm ci --include=dev'. migrate, smoke and the updater" >&2
    echo "       need it. Install dev dependencies and re-run; nothing was changed." >&2
    exit 1
  fi
fi
run npm run build

# 3. Config dir, secret key and logins (kept outside the repo). Values in the env file are QUOTED so
#    a config path with a space (the default ~/Library/Application Support/CommandCenter) sources
#    cleanly (CC11 spec §1 item 1).
say "3. Secret key and logins (written to $CONFIG_DIR, never to the repo)"
run mkdir -p "$CONFIG_DIR"
if [ "$DRY" = "1" ]; then
  KEY="dry-run-placeholder-key"
  ENV_CONTENT="$(printf 'CC_SECRET_KEY="%s"\nCC_DB_PATH="%s"\n' "$KEY" "$DB_FILE")"
  emit_file "$ENV_FILE" "$ENV_CONTENT"
  echo "+ if the database is absent: prompt for Josh and Christine passwords, then seed"
  echo "+ if it already exists: keep the database, secret key and passwords; run migrate only"
else
  if [ ! -f "$ENV_FILE" ]; then
    KEY="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
    ENV_CONTENT="$(printf 'CC_SECRET_KEY="%s"\nCC_DB_PATH="%s"\n' "$KEY" "$DB_FILE")"
    emit_file "$ENV_FILE" "$ENV_CONTENT"
    chmod 600 "$ENV_FILE"
  fi
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  export CC_SECRET_KEY CC_DB_PATH
  if [ -f "$DB_FILE" ]; then
    # Already set up: keep the database, secret key and passwords. Only apply any new migrations.
    say "   Existing database found — keeping it, the secret key and passwords. Applying migrations."
    npm run migrate
  else
    printf "Set Josh's password: "; stty -echo; read -r CC_JOSH_PASSWORD; stty echo; echo
    printf "Set Christine's password: "; stty -echo; read -r CC_CHRISTINE_PASSWORD; stty echo; echo
    export CC_JOSH_PASSWORD CC_CHRISTINE_PASSWORD
    npm run migrate
    npm run seed
  fi
fi

# 3b. Record the live version so the first updater pass does nothing when the code is already
#     current (CC12 check 1). Without this the updater saw "a new merge" every run and updated in a
#     loop. Writes data/updater-state.json in the repo (or CC_UPDATER_STATE).
say "3b. Recording the live version (so the first update check is a no-op when already current)"
run npm run updater -- --record-live

# 4. launchd jobs: the app (starts on boot, kept running) and the updater (once a day at 3 AM). The
#    app job sets PATH (so npm is found) and writes logs into the config dir (CC11 spec §1 items 2,
#    3); the updater job runs on a daily schedule, not a loop (CC12 spec §1).
say "4. Installing launchd jobs (app + updater)"
run mkdir -p "$LAUNCH_DIR"

APP_PLIST_CONTENT="$(cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.bishop.commandcenter.app</string>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>$PORT</string>
    <key>PATH</key><string>$JOB_PATH</string>
  </dict>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>-c</string>
    <string>set -a; . "$ENV_FILE"; exec npm run start -- -p $PORT</string>
  </array>
  <key>StandardOutPath</key><string>$APP_LOG</string>
  <key>StandardErrorPath</key><string>$APP_LOG</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST
)"
emit_file "$APP_PLIST" "$APP_PLIST_CONTENT"

# The updater runs ONCE A DAY at 3:00 AM (StartCalendarInterval), not in a 5-minute loop (Josh,
# 2026-11-19 16:11). launchd uses local time, and the Mac mini is on Eastern, so Hour 3 is 3:00 AM
# Eastern (CC12 spec §4 check 2, 8). It is a one-shot each day — no KeepAlive (that would respawn it
# in a tight loop) and no RunAtLoad (a boot run is not wanted; "Check for updates now" covers on
# demand). CC_SMOKE_URL points the smoke check at the running app's port.
UPDATER_PLIST_CONTENT="$(cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.bishop.commandcenter.updater</string>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$JOB_PATH</string>
    <key>CC_RESTART_CMD</key><string>launchctl kickstart -k gui/\$(id -u)/com.bishop.commandcenter.app</string>
    <key>CC_SMOKE_URL</key><string>http://127.0.0.1:$PORT</string>
  </dict>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>-c</string>
    <string>set -a; . "$ENV_FILE"; exec npm run updater</string>
  </array>
  <key>StandardOutPath</key><string>$UPDATER_LOG</string>
  <key>StandardErrorPath</key><string>$UPDATER_LOG</string>
  <key>StartCalendarInterval</key><dict>
    <key>Hour</key><integer>3</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
</dict></plist>
PLIST
)"
emit_file "$UPDATER_PLIST" "$UPDATER_PLIST_CONTENT"

run launchctl unload "$APP_PLIST" 2>/dev/null || true
run launchctl load "$APP_PLIST"
run launchctl unload "$UPDATER_PLIST" 2>/dev/null || true
run launchctl load "$UPDATER_PLIST"

# 5. Secure tunnel (Cloudflare). The one-time account steps are done by hand (see
#    docs/install-mac.md). If ~/.cloudflared/config.yml names a tunnel, install a launchd job that
#    runs it (cloudflared's `service install` does NOT run a named tunnel). CC11 spec §1 item 4.
say "5. Secure tunnel (Cloudflare)"
if [ -f "$TUNNEL_CONFIG" ]; then
  TUNNEL_NAME="$(awk -F'[:#]' '/^[[:space:]]*tunnel:/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$TUNNEL_CONFIG" 2>/dev/null || true)"
  say "   Tunnel config found ($TUNNEL_CONFIG); tunnel: ${TUNNEL_NAME:-unknown}"
  TUNNEL_PLIST_CONTENT="$(cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.bishop.commandcenter.tunnel</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$JOB_PATH</string>
  </dict>
  <key>ProgramArguments</key><array>
    <string>$CLOUDFLARED_BIN</string><string>tunnel</string><string>run</string><string>$TUNNEL_NAME</string>
  </array>
  <key>StandardOutPath</key><string>$CONFIG_DIR/tunnel.log</string>
  <key>StandardErrorPath</key><string>$CONFIG_DIR/tunnel.log</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST
)"
  emit_file "$TUNNEL_PLIST" "$TUNNEL_PLIST_CONTENT"
  run launchctl unload "$TUNNEL_PLIST" 2>/dev/null || true
  run launchctl load "$TUNNEL_PLIST"
else
  say "   No $TUNNEL_CONFIG — skipping the tunnel job. One-time account steps (do these yourself,"
  say "   see docs/install-mac.md):"
  say "     cloudflared tunnel login"
  say "     cloudflared tunnel create command-center"
  say "     cloudflared tunnel route dns command-center <your-hostname>"
  say "   Write ~/.cloudflared/config.yml (tunnel + ingress), then re-run this installer to add the"
  say "   tunnel launchd job."
fi

say ""
say "Done ($([ "$DRY" = "1" ] && echo "dry run — nothing changed" || echo "installed"))."
say "Open http://localhost:$PORT on the Mac mini; reach it from away at your tunnel hostname."
