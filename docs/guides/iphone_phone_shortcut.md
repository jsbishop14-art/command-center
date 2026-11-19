# Build the Phone Lookup Shortcut on your iPhone

This makes a one-tap (or voice) way to check an unknown number from your phone. You give it a
number; it tells you whether it is likely a telemarketer, unclear, or a real person, with the top
reasons — the same answer the Phone lookup screen shows. It also lets you mark the number spam or
real, shared with the dashboard.

You do this once. It takes about five minutes. No App Store download — it uses Apple's built-in
Shortcuts app.

## Before you start

You need two things from the dashboard, both on the **Settings → Inbox & email** screen:

1. **The Shortcut token.** Press **Issue** (or **Re-issue**). The token is shown once — copy it
   then. It is the same token the Note Shortcut uses; one token covers both. If you lose it, press
   Re-issue and update both Shortcuts with the new one.
2. **Your Command Center address.** This is the tunnel address you open the dashboard with from
   outside the house (the one from the install guide). The lookup route is that address followed by
   `/api/phone/lookup` — for example `https://command.<your-tunnel>.com/api/phone/lookup`.

Keep both handy for the steps below.

## Make the Lookup Shortcut

1. Open the **Shortcuts** app. Tap **+** (top right) to create a new shortcut.
2. Tap the name at the top, choose **Rename**, and call it **Check number**.
3. Get the number to check:
   - Tap **Add Action**, search **Text**, and add the **Text** action.
   - Tap the value and pick **Shortcut Input** if it is offered; otherwise leave it empty and you
     will type or paste the number when you run it. (The lookup accepts a number in any format, or
     text containing one.)
4. Add the web request:
   - Tap **Add Action**, search **Get Contents of URL**, and add it.
   - In the **URL** field, paste your lookup route, e.g.
     `https://command.<your-tunnel>.com/api/phone/lookup`.
   - Tap the arrow (**Show More**) to expand the options.
   - **Method:** POST.
   - **Headers:** tap **Add new header**. Key: `Authorization`. Value: `Bearer ` followed by the
     token you copied (one space after `Bearer`, e.g. `Bearer abcd1234…`).
   - **Request Body:** JSON.
   - Add a field. Key: `phone`. Type: **Text**. Value: pick the **Text** variable from step 3.
   - Add a second field. Key: `source`. Type: **Text**. Value: `shortcut`.
5. Read the answer out of the reply:
   - Tap **Add Action**, search **Get Dictionary Value**, and add it. Set **Get** → **Value for**
     `summary`, from the **Contents of URL**. (The reply also has `verdictLabel`, `callerName` and
     a `reasons` list if you want to show more.)
6. Add the notification:
   - Tap **Add Action**, search **Show Notification**, and add it.
   - Set the body to the **Dictionary Value** from step 5. That shows the verdict and caller name.
7. (Optional) Add the follow-up menu:
   - Tap **Add Action**, search **Choose from Menu**, and add it with items **Call**, **Mark
     spam**, **Mark real**, **Done**.
   - Under **Call**, add **Call** (or **Open URL** `tel:` + the number).
   - Under **Mark spam** and **Mark real**, add **Get Contents of URL** to
     `https://command.<your-tunnel>.com/api/phone/mark`, **Method PUT**, the same `Authorization`
     header, **Request Body JSON** with `phone` (the Text variable) and `label` (`spam` or `real`).
   - **Done** needs no action.
8. Tap **Done** to save.

## How to run it

The iPhone Phone app can't share a number straight from **Recents**. To check a recent call: open
**Recents**, tap the **(i)** beside the number, **press and hold** the number, tap **Copy**, then
run **Check number** from the Home Screen, Siri ("Check number"), or a Back Tap. Paste when asked.

Numbers in **Messages** and **Mail** can be shared directly: select the number, **Share**, and pick
**Check number** from the Share Sheet.

## Notes

- A repeat check within 30 days is free (no new paid Twilio call); press **Refresh** on the
  dashboard, or run again later, to force a fresh paid lookup.
- Marks are shared with Christine and the dashboard, and set the verdict until removed.
- Spoofed numbers can look clean or show the innocent owner; new telemarketer numbers may have no
  complaints yet; many cell numbers have no registered name; complaint data is unverified.
