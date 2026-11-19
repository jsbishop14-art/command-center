# Build the Note Shortcut on your iPhone

This makes a one-tap (or voice) way to drop a note into Command Center's Inbox from your phone. The
note lands in the Inbox; nothing becomes a card until you press Confirm on the dashboard.

You do this once. It takes about five minutes. No App Store download — it uses Apple's built-in
Shortcuts app.

## Before you start

You need two things from the dashboard, both on the **Settings → Inbox & email** screen:

1. **The Shortcut token.** Press **Issue** (or **Re-issue**). The token is shown once — copy it then.
   If you lose it, press Re-issue and update the Shortcut with the new one.
2. **Your Command Center address.** This is the tunnel address you open the dashboard with from
   outside the house (the one from the install guide). The note route is that address followed by
   `/api/notes` — for example `https://command.<your-tunnel>.com/api/notes`.

Keep both handy for the steps below.

## Make the Shortcut

1. Open the **Shortcuts** app. Tap **+** (top right) to create a new shortcut.
2. Tap the name at the top, choose **Rename**, and call it **Add note**.
3. Add the note text as input:
   - Tap **Add Action**, search **Text**, and add the **Text** action.
   - Leave it empty for now — you will type or dictate into it when you run the Shortcut. (If you
     prefer to always dictate, instead add **Dictate Text** and use its result in the next step.)
4. Add the web request:
   - Tap **Add Action**, search **Get Contents of URL**, and add it.
   - In the **URL** field, paste your note route, e.g. `https://command.<your-tunnel>.com/api/notes`.
   - Tap the arrow (**Show More**) to expand the options.
   - **Method:** POST.
   - **Headers:** tap **Add new header**. Key: `Authorization`. Value: `Bearer ` followed by the
     token you copied (one space after `Bearer`, e.g. `Bearer abcd1234…`).
   - **Request Body:** JSON.
   - Add a field. Key: `text`. Type: **Text**. Value: tap the field, then pick the **Text** (or
     **Dictated Text**) variable from the step above so the body sends what you wrote.
5. Add the confirmation:
   - Tap **Add Action**, search **Show Notification**, and add it.
   - Set the text to **Note added to Inbox.**
6. Tap **Done**.

## Use it

- **From the Home screen:** tap the **Add note** shortcut, type or dictate your note, done.
- **By voice:** "Hey Siri, Add note," then speak the note.
- **Back Tap (optional):** Settings → Accessibility → Touch → Back Tap → Double Tap → choose **Add
  note**. Now a double-tap on the back of the phone starts it.

## Check it worked

Open the dashboard, go to the **Inbox** (left menu, or the Inbox panel on Home). Your note is there
with a **Shortcut** tag. Press **Confirm** to file it as a card, **Change** to pick a project and
boards first, or **Dismiss** to remove it. It never becomes a card on its own.

## If it does not work

- **"Unauthorized" or nothing arrives:** the token is wrong or was revoked. On Settings → Inbox &
  email, press **Re-issue**, copy the new token, and update the `Authorization` header in the
  Shortcut (keep the `Bearer ` prefix).
- **A network error:** check the URL is your tunnel address with `/api/notes` on the end, and that
  you can open the dashboard from the phone on that address.
- The note route only accepts this token — it will not work with any other login, and the token
  works on no other part of the app.
