# Installing Command Center on the Mac mini

This is a one-time setup. After it, Command Center starts on its own when the Mac mini turns on,
stays running, and updates itself after each later build lands. You run one command and do the
Cloudflare steps below for remote access.

## Before you start

- The Mac mini is signed in and on.
- You have the repo on the Mac mini (a folder called `command-center`).
- Node 20 and Git are installed. (If you are not sure, the install command checks and tells you.)

## Step 1 — Run the installer

Open Terminal, go to the repo folder, and run:

```
cd command-center
sh scripts/install-mac.sh
```

It will:

- install what the app needs and build it,
- the first time only, ask you to set a password for Josh and a password for Christine (type them;
  they are not shown), then seed the database,
- start the app so it runs at `http://localhost:3000` on the Mac mini and comes back on its own
  after a restart,
- start the updater, which quietly puts each later build live,
- if a Cloudflare tunnel is already configured (see Step 2), start the tunnel too.

Your passwords and the app's secret key are saved on the Mac mini, outside the repo, in
`~/Library/Application Support/CommandCenter`. They are never put in the code.

The app and updater write logs there too — `app.log` and `updater.log` (and `tunnel.log` once the
tunnel job is installed). Open those if something is not running.

**Re-running is safe.** If you run the installer again (for example after moving the repo or to add
the tunnel job), it keeps the existing database, secret key and passwords; it only applies any new
migrations and re-writes the launchd jobs.

Want to see what it will do first, without changing anything?

```
sh scripts/install-mac.sh --dry-run
```

## Step 2 — The secure tunnel (Cloudflare)

This lets you and Christine reach Command Center from away, over a secure tunnel. We use Cloudflare,
which is free. Do these once on the Mac mini:

1. Make a free account at https://dash.cloudflare.com/sign-up (skip if you have one).
2. In Terminal on the Mac mini:

   ```
   cloudflared tunnel login
   cloudflared tunnel create command-center
   cloudflared tunnel route dns command-center command.yourhome.example
   ```

   Replace `command.yourhome.example` with the web address you want to use. Cloudflare walks you
   through picking one if you don't have a domain yet.

3. Write the tunnel config at `~/.cloudflared/config.yml` so it points at the app. Use the tunnel
   id that `tunnel create` printed:

   ```yaml
   tunnel: command-center
   credentials-file: /Users/<you>/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: command.yourhome.example
       service: http://localhost:3000
     - service: http_status:404
   ```

4. Re-run the installer (`sh scripts/install-mac.sh`). Because `~/.cloudflared/config.yml` now
   exists, it installs a launchd job that runs `cloudflared tunnel run command-center` and starts
   it. (Cloudflare's own `sudo cloudflared service install` does **not** run a named tunnel from
   your config, which is why we install our own job instead.)

## Step 3 — Cloudflare Access (the login at the front door)

Turn on Cloudflare Access so only you and Christine can reach the address, with a one-time PIN sent
to your email. In the Cloudflare Zero Trust dashboard:

1. Add an **Access → Application** (self-hosted) for `command.yourhome.example`.
2. Add a policy that **allows** your and Christine's email addresses.
3. For the login method, use the **One-time PIN** provider. Cloudflare now turns on its own
   "Cloudflare" identity provider by default — **turn that off for this application** so the only
   way in is the PIN to an allowed email.
4. Add a second **Bypass** application (or bypass policy) for the machine-to-machine routes, so the
   iPhone Shortcut and the EZ Binder webhook are not blocked by the PIN screen:
   - `command.yourhome.example/api/notes`
   - `command.yourhome.example/api/phone/*`
   - `command.yourhome.example/api/ezbinder/webhook`

   These routes have their own token or signature checks inside the app, so bypassing the PIN for
   them is safe.

After this, open your address from any browser; Cloudflare asks for the PIN, then you get the
Command Center sign-in.

## Step 4 — Connect Google (calendars, Gmail, intake)

Follow **docs/guides/google_connect.md** to create a Google Cloud project and OAuth client, enter
the client ID and secret in Settings → Keys, set `CC_LIVE_FEEDS=1` in
`~/Library/Application Support/CommandCenter/env`, restart the app, then connect the three
calendars, Gmail and the intake mailbox (evanmbishop23@gmail.com) in Settings. Until then the app
shows its built-in sample data on an unconnected machine.

## Everyday

- You don't restart anything. The app, updater and tunnel run themselves.
- When a build lands, the Mac mini backs up, builds the new version **without** interrupting the one
  that is serving, switches to it, checks itself, and goes live. If an update fails, it rolls back
  to the last good version and shows a red "Update failed, rolled back" alert (on the Builds screen
  and the touch screen).

## If you ever need to stop or start things by hand

```
launchctl kickstart -k gui/$(id -u)/com.bishop.commandcenter.app      # restart the app
launchctl bootout   gui/$(id -u)/com.bishop.commandcenter.app         # stop the app
launchctl kickstart -k gui/$(id -u)/com.bishop.commandcenter.tunnel   # restart the tunnel
```
