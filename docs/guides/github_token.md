# GitHub token for the Builds screen

Command Center's Builds screen reads your project repos on GitHub and writes two things back: your
answers to build questions (into each build's status file and chain.md) and the build budget
(build-control/budget.json). It uses one GitHub token, kept in the secret store. This guide is the
one-time setup; you do it once on the Mac mini.

The token is never shown in full after you save it, never written to logs, and never committed. It is
used only on the Mac mini (the build sessions and CI never use a real token — they read a stub).

## What the token must reach

- Read the tracked project repos (the chain, status files, merge commits).
- Write to build branches of those repos: `docs/sessions/<NAME>-status.md` and `docs/claude/chain.md`.
- Read and write `budget.json` in the private `build-control` repo.

It never needs anything else: no delete, no admin, no access to other accounts.

## Create a fine-grained personal access token (recommended)

1. On GitHub, go to **Settings → Developer settings → Fine-grained tokens → Generate new token**
   (or open https://github.com/settings/tokens?type=beta).
2. **Token name:** `command-center-builds`. **Expiration:** your choice (a year is fine; you can
   rotate it later in the same place).
3. **Resource owner:** the account that owns the repos (`jsbishop14-art`).
4. **Repository access:** *Only select repositories*, and pick the tracked project repos plus
   `build-control`.
5. **Permissions → Repository permissions:** set **Contents** to **Read and write**. Leave everything
   else at *No access*. (Contents read-and-write covers reading files and commits and writing the
   status files, chain.md and budget.json.)
6. Click **Generate token** and copy the value (it starts with `github_pat_`). You will not see it
   again.

A classic token with the `repo` scope also works, but the fine-grained token above grants far less.

## Save it in Command Center

1. Open **Settings → Keys** on the Mac mini.
2. Paste the value into **GitHub token (Builds screen)** and save. The field then shows only that it
   is set and its last four characters.
3. Turn the live GitHub reads on by setting the environment variable `CC_LIVE_GITHUB=1` for the app
   on the Mac mini (the same place `CC_LIVE_FEEDS` and `CC_LIVE_AI` are set). Until then the Builds
   screen shows the built-in stub data.

## Rotating or revoking

Replace the value in Settings → Keys any time; the old one stops being used at once. To cut off
access entirely, delete the token on GitHub and clear the field in Settings.
