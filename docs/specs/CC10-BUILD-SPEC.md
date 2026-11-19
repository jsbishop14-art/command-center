# CC10 build spec: phone lookup

## 0. Josh's words (verbatim)

- 2026-11-09 15:33: "compile and update files as needed with the plan to start a new session. that session will
  create the repo and/or anything else needed and start the build"
- Requirements: handoff section 8 (all). Layout: docs/mockup/PhoneLookup.dc.html.

## 1. What Josh gets

- A Phone lookup screen for Josh and Christine: enter or paste any US number, get Likely telemarketer, Unclear or
  Likely real person, with the reasons, caller name, line type and FTC and FCC complaint counts.
- Mark spam or Mark real, shared between them and showing who marked it; a mark sets the verdict until removed.
- 90 days of searchable history, then deleted.
- Quick add (Ctrl K) recognizes a pasted number and offers Look up number.
- The iPhone lookup Shortcut, with a step-by-step guide.
- FTC data loaded for the last 12 months in the background, with progress shown, then updated daily.

## 2. Scope

Handoff 8.1 to 8.9. Twilio, FTC and FCC against stubs. Josh supplies the three keys and 15 to 20 known numbers before
it goes live; then he runs his test list.

## 3. Must stay true

- No AI. A repeat lookup within 30 days makes no Twilio call.
- The Shortcut token works only on the phone and note routes.
- Scoring points and thresholds live in one config file, editable in Settings.

## 4. Checks

All checks under "Phone lookup" in handoff section 11 that don't need real keys, against stubs. The 80% test-list
check is Josh's, after the keys are in.

## 5. Not in this build

Call blocking, incoming call screening, non-US numbers.

## 6. Grant

None. No real Twilio, FTC or FCC calls from CI.
