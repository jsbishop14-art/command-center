# Set the touch screen to start in kiosk mode

This makes the touch screen beside the Mac mini show Command Center full screen, with nothing else —
no address bar, no menus, no way to wander off. It shows the two ambient screens (Today and Software
builds); you swipe between them, and it goes back to Today on its own when no one has touched it for a
while.

You do this once on the Mac mini. It takes about ten minutes. Command Center must already be
installed and running (see `docs/install-mac.md`).

## What the touch screen shows

- **Screen 1 — Today:** the clock, date and weather, the Josh / Christine / Bishops toggle, three
  numbers, today's calendar, the board's cards in progress, what you are waiting on and what is due
  this week, and when things were last refreshed and synced.
- **Screen 2 — Software builds:** the clock, the usage bars, one row per software project with its
  stage, and recent build activity.
- **Swipe** left or right to move between them, or tap the dots at the bottom. It returns to Today on
  its own after the idle time.
- It is **display only**. The only things you can touch are the person toggle and the swipe. There is
  no phone lookup here.
- When a build needs you, the build budget hold starts, or an update fails, the touch screen **jumps
  to Software builds on its own** and shows a red banner saying what happened.

## Step 1 — Sign in once on the touch screen

The touch screen uses the same login as the dashboard, so it needs to be signed in once in the
browser you will use for the kiosk.

1. On the touch screen (or on the Mac mini, on that display), open **Chrome** (or Chromium).
2. Go to `http://localhost:3000` and sign in as Josh. Leave this signed in — do not sign out.
3. Go to `http://localhost:3000/touch`. You should see the Today screen. Try a swipe to Software
   builds and back.

## Step 2 — Set the idle time (optional)

On the dashboard, open **Settings → Touch screen**. Set **"Return to screen 1 after (minutes)"** to
how long you want the screen to wait, with no touch, before going back to Today. The default is 3
minutes. Save.

## Step 3 — Start it full screen (kiosk)

Chrome has a built-in kiosk mode. From Terminal on the Mac mini, start Chrome pointed at the touch
address in kiosk mode:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --kiosk --app="http://localhost:3000/touch" \
  --user-data-dir="$HOME/.cc-kiosk"
```

- `--kiosk` fills the whole screen and hides every browser control.
- `--app=` opens just the touch page, with no tabs or address bar.
- `--user-data-dir=` keeps the kiosk's own sign-in separate, so it stays signed in. Sign in once in
  this window (Step 1) if it asks.

To stop kiosk mode, press **Cmd-Q**.

If the touch screen is a second display, drag the window to it before going full screen, or set that
display as the main one in **System Settings → Displays** while you set this up.

## Step 4 — Make it start by itself (optional)

So the touch screen comes up on its own after the Mac mini restarts:

1. Save the command from Step 3 as a small file, for example `~/start-touch.command`:

   ```
   #!/bin/sh
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --kiosk --app="http://localhost:3000/touch" \
     --user-data-dir="$HOME/.cc-kiosk"
   ```

2. Make it runnable: in Terminal, `chmod +x ~/start-touch.command`.
3. Add it as a login item: **System Settings → General → Login Items → Open at Login → +**, and pick
   `start-touch.command`.

The Mac mini must already be set to turn on and start Command Center on its own (the install guide
covers that). After that, the touch screen will come up full screen on every restart.

## If something looks wrong

- **Blank or sign-in page:** the kiosk window was signed out. Press Cmd-Q, open the window again,
  sign in once at `http://localhost:3000`, then reopen the touch page.
- **It never goes back to Today:** check the idle time in Settings → Touch screen.
- **No build data on Software builds:** that comes from GitHub and is set up separately (Settings →
  Software builds, and the GitHub token). Until then the builds screen shows the stubbed sample.
