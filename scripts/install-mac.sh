#!/bin/sh
# Install Command Center on the Mac mini (handoff 1.1, 7.4; spec §1). One command, then a short
# guide (docs/install-mac.md). Starts the app on boot, keeps it running, and installs the updater
# so later builds go live on their own. Run from the repo root.
#
#   sh scripts/install-mac.sh            # do it
#   sh scripts/install-mac.sh --dry-run  # print the plan, change nothing (tested in CI)
#
# This script never prints or stores a secret in the repo. The secret key and the two passwords are
# written outside the repo (CONFIG_DIR) and into the macOS login keychain is left to the person.
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
PORT="${CC_PORT:-3000}"

say() { echo "$@"; }

# run CMD... : do it, or in dry-run print it and change nothing.
run() {
  if [ "$DRY" = "1" ]; then
    echo "+ $*"
  else
    "$@"
  fi
}

# write FILE <<heredoc-on-stdin : write a file, or in dry-run just announce it.
write_file() {
  target="$1"
  if [ "$DRY" = "1" ]; then
    echo "+ write $target"
    cat >/dev/null
  else
    cat >"$target"
  fi
}

say "Command Center install ($([ "$DRY" = "1" ] && echo "dry run" || echo "live"))"
say "Repo:    $REPO_DIR"
say "Config:  $CONFIG_DIR"
say "Port:    $PORT"
say ""

# 1. Prerequisites.
say "1. Checking prerequisites (node 20, git, cloudflared)"
run node --version
run git --version

# 2. Dependencies and production build.
say "2. Installing dependencies and building"
run npm ci
run npm run build

# 3. Config dir, secret key and logins (kept outside the repo).
say "3. Secret key and logins (written to $CONFIG_DIR, never to the repo)"
run mkdir -p "$CONFIG_DIR"
if [ "$DRY" = "1" ]; then
  echo "+ generate CC_SECRET_KEY (32 bytes) into $CONFIG_DIR/env if absent"
  echo "+ prompt for Josh and Christine passwords, seed the database"
else
  if [ ! -f "$CONFIG_DIR/env" ]; then
    KEY="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
    printf 'CC_SECRET_KEY=%s\n' "$KEY" >"$CONFIG_DIR/env"
    printf 'CC_DB_PATH=%s\n' "$CONFIG_DIR/cc.db" >>"$CONFIG_DIR/env"
    chmod 600 "$CONFIG_DIR/env"
  fi
  # shellcheck disable=SC1091
  . "$CONFIG_DIR/env"
  export CC_SECRET_KEY CC_DB_PATH
  printf "Set Josh's password: "; stty -echo; read -r CC_JOSH_PASSWORD; stty echo; echo
  printf "Set Christine's password: "; stty -echo; read -r CC_CHRISTINE_PASSWORD; stty echo; echo
  export CC_JOSH_PASSWORD CC_CHRISTINE_PASSWORD
  npm run migrate
  npm run seed
fi

# 4. launchd jobs: the app and the updater (start on boot, keep running).
say "4. Installing launchd jobs (app + updater)"
run mkdir -p "$LAUNCH_DIR"
write_file "$APP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.bishop.commandcenter.app</string>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>$PORT</string>
  </dict>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>-c</string>
    <string>set -a; . "$CONFIG_DIR/env"; exec npm run start -- -p $PORT</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST

write_file "$UPDATER_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.bishop.commandcenter.updater</string>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>CC_RESTART_CMD</key><string>launchctl kickstart -k gui/\$(id -u)/com.bishop.commandcenter.app</string>
  </dict>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>-c</string>
    <string>set -a; . "$CONFIG_DIR/env"; exec npm run updater -- --loop</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST

run launchctl unload "$APP_PLIST" 2>/dev/null || true
run launchctl load "$APP_PLIST"
run launchctl unload "$UPDATER_PLIST" 2>/dev/null || true
run launchctl load "$UPDATER_PLIST"

# 5. Secure tunnel (the one account step).
say "5. Secure tunnel (Cloudflare)"
say "   One-time account step (do this yourself, see docs/install-mac.md):"
say "     cloudflared tunnel login"
say "     cloudflared tunnel create command-center"
say "     cloudflared tunnel route dns command-center <your-hostname>"
say "   Then run the tunnel as a service:"
say "     sudo cloudflared service install"

say ""
say "Done ($([ "$DRY" = "1" ] && echo "dry run — nothing changed" || echo "installed"))."
say "Open http://localhost:$PORT on the Mac mini; reach it from away at your tunnel hostname."
