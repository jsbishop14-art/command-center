# Connecting Google (calendars, Gmail, intake)

This connects Command Center to Google so the Today panel shows your real calendars, Awaiting reply
and nudge drafts use your real Gmail, and notes emailed or texted to the intake address become
pending notes. You do this once on the Mac mini. It takes about fifteen minutes, mostly waiting on
Google's screens.

Command Center only ever **reads** your mail and calendars and **creates drafts**. It never sends
email and never deletes anything (CLAUDE §8).

## What you are setting up

Google requires an "OAuth client" — an app identity it recognises — before it will let Command
Center sign you in. You create one free Google Cloud project, turn on the Calendar and Gmail APIs,
add the Google accounts that will connect, and copy a client ID and secret into Command Center.

You will connect, each to whichever Google account owns it:

- the three calendars (Josh work, Josh personal, Christine),
- Gmail (Josh's mailbox) — for Awaiting reply and nudge drafts,
- the intake mailbox **evanmbishop23@gmail.com** — notes emailed or texted here become pending
  notes. Connect this one while signed in to that account.

## Step 1 — Create the Google Cloud project

1. Go to https://console.cloud.google.com/ and sign in with your Google account.
2. Top bar → the project dropdown → **New project**. Name it `Command Center`. Create it, then make
   sure it is the selected project.

## Step 2 — Turn on the Calendar and Gmail APIs

1. **APIs & Services → Library**.
2. Search **Google Calendar API** → open it → **Enable**.
3. Search **Gmail API** → open it → **Enable**.

## Step 3 — Set up the consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create. (Internal is only for Google Workspace organisations; your
   accounts are personal Gmail, so choose External.)
3. Fill the required fields: app name `Command Center`, your email for the support and developer
   contact. You do not need a logo or a homepage. Save and continue.
4. **Scopes**: you can leave this empty here — Command Center asks for exactly the scopes it needs
   when you connect (read-only Calendar, read Gmail, and create Gmail drafts). Save and continue.
5. **Test users**: add every Google account that will connect — your main account, Christine's
   account, and **evanmbishop23@gmail.com**. Save and continue.

### Leaving the consent screen in "Testing" (read this)

If you leave the consent screen in **Testing** (not Published), Google treats the connection as a
test: **refresh tokens expire after 7 days**. In plain terms, about once a week each connection
stops working and Command Center shows it on the **Problems** screen with a **Reconnect** button —
you click Reconnect and sign in again, which takes a few seconds per account.

To avoid the weekly reconnect, you can **Publish** the app (consent screen → Publish app). Because
you are the only users and the app only reads mail/calendars and creates drafts, publishing to
"In production" for your own accounts is fine and stops the 7-day expiry. Google may show an
"unverified app" warning on the sign-in screen; click **Advanced → go to Command Center** to
continue — verification is only needed for apps shared with the public, which this is not (spec §5
keeps the consent screen unpublished for outside users; publishing for your own accounts is your
choice).

## Step 4 — Create the OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `Command Center`.
3. **Authorised redirect URIs** → Add URI. Enter the redirect URI exactly as Command Center shows
   it in **Settings → Home feeds** (the line that reads
   `http://localhost:3000/api/auth/google/callback`). If you also reach the app through the tunnel
   hostname, add that one too, e.g.
   `https://command.yourhome.example/api/auth/google/callback`. Set `CC_PUBLIC_URL` (or the
   `public_base_url` app setting) to the tunnel address so the URI Command Center shows matches what
   you register here.
4. Create. Google shows a **client ID** and a **client secret** — keep this dialog open for the next
   step.

## Step 5 — Enter the client ID and secret, turn the live switch on

1. In Command Center: **Settings → Keys**. Enter the **Google OAuth client ID** and **Google OAuth
   client secret**. They are stored encrypted in the secret store and never shown back in full.
2. On the Mac mini, add `CC_LIVE_FEEDS=1` to
   `~/Library/Application Support/CommandCenter/env`, then restart the app:

   ```
   launchctl kickstart -k gui/$(id -u)/com.bishop.commandcenter.app
   ```

   Until `CC_LIVE_FEEDS=1` is set, Command Center uses its built-in sample calendars and mail so the
   screens are never empty; it does not call Google.

## Step 6 — Connect each account

1. **Settings → Home feeds**: click **Connect** on each calendar. Google's own sign-in opens; sign
   in to the account that owns that calendar and allow the read-only calendar access. Christine
   connects her calendar from her own login.
2. **Settings → Inbox & email**: click **Connect** on **Gmail** (sign in as Josh) and on **Intake
   mailbox** (sign in to evanmbishop23@gmail.com). Gmail asks to read mail and manage drafts — it
   never asks to send.
3. Click **Refresh** (top bar). The Today panel fills with real events; Awaiting reply and the Inbox
   fill from real mail.

## If a connection stops working

An expired or revoked sign-in shows on the **Problems** screen (reached from the kanban) with the
feed name and a **Reconnect** button. Click it and sign in again; the feed resumes. This is the
weekly event described in Step 3 if you left the consent screen in Testing.

## Disconnecting

**Disconnect** on any calendar, Gmail or the intake mailbox removes its stored token from the Mac
mini. The feed stops updating until you connect it again.
