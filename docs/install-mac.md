# Installing Command Center on the Mac mini

This is a one-time setup. After it, Command Center starts on its own when the Mac mini turns on,
stays running, and updates itself after each later build lands. You run one command and do one
account step for remote access.

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
- ask you to set a password for Josh and a password for Christine (type them; they are not shown),
- start the app so it runs at `http://localhost:3000` on the Mac mini and comes back on its own
  after a restart,
- start the updater, which quietly puts each later build live.

Your passwords and the app's secret key are saved on the Mac mini, outside the repo, in
`~/Library/Application Support/CommandCenter`. They are never put in the code.

Want to see what it will do first, without changing anything?

```
sh scripts/install-mac.sh --dry-run
```

## Step 2 — Turn on remote access (the one account step)

This lets you and Christine reach Command Center from away, with a login, over a secure tunnel.
We use Cloudflare, which is free.

1. Make a free account at https://dash.cloudflare.com/sign-up (skip if you have one).
2. In Terminal on the Mac mini:

   ```
   cloudflared tunnel login
   cloudflared tunnel create command-center
   cloudflared tunnel route dns command-center command.yourhome.example
   sudo cloudflared service install
   ```

   Replace `command.yourhome.example` with the web address you want to use. Cloudflare walks you
   through picking one if you don't have a domain yet.

That is the only account step. After it, open your address from any browser; you'll get the
Command Center sign-in.

## Everyday

- You don't restart anything. The app and updater run themselves.
- When a build lands, the Mac mini backs up, updates, checks itself, and goes live. If an update
  fails, it rolls back to the last good version and shows a red "Update failed, rolled back" alert
  (on the Builds screen and the touch screen, once those are built).

## If you ever need to stop or start the app by hand

```
launchctl kickstart -k gui/$(id -u)/com.bishop.commandcenter.app   # restart the app
launchctl bootout gui/$(id -u)/com.bishop.commandcenter.app        # stop the app
```
