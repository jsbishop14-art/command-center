// Deterministic sample data that stands in for Google in CI, build sessions and local dev (spec
// §3: "a stub Google that issues tokens, refreshes them and returns events, threads and messages").
// One source of truth so the legacy stub path (CC_LIVE_FEEDS off) and the live code path through
// the stub Google transport (CC_LIVE_FEEDS on, no real client) show the same calendars, threads
// and intake messages. Ordinary data, no AI, no outside call.

// Calendar events, one list per feed slug. Times are Eastern; the fetcher stamps them onto the
// requested date. Titles are asserted by the CC3 Today tests, so they must stay stable.
export const SAMPLE_CALENDAR: Record<
  string,
  { title: string; start: string; end: string; location?: string }[]
> = {
  josh_work: [
    { title: "Site visit — Riverwood", start: "08:30", end: "09:30", location: "Riverwood" },
    { title: "Client call — Best Western Naples", start: "13:00", end: "13:30" },
  ],
  josh_personal: [{ title: "Dentist", start: "16:30", end: "17:15" }],
  christine: [
    { title: "School pickup", start: "15:00", end: "15:30" },
    { title: "Yoga", start: "18:00", end: "19:00" },
  ],
};

// Threads where Josh sent the last message (the source for Awaiting reply). Each is defined by how
// long ago his last message was, so the 2-day / 1-day-for-active-client logic is exercised
// deterministically. Asserted by the CC4 Awaiting tests.
export const SAMPLE_SENT: {
  id: string;
  to: string;
  toName: string;
  subject: string;
  ageHours: number;
  snippet: string;
}[] = [
  { id: "t-riverwood", to: "dana@riverwoodbuild.com", toName: "Dana Whitfield", subject: "Riverwood draw schedule", ageHours: 34, snippet: "Sending over the revised draw schedule for your sign-off." },
  { id: "t-spark", to: "joe@sparkelectric.com", toName: "Joe Abrams", subject: "Panel upgrade quote", ageHours: 77, snippet: "Following up on the panel upgrade quote from last week." },
  { id: "t-bnt", to: "mgarcia@bntconstruction.com", toName: "Maria Garcia", subject: "Pool deck change order", ageHours: 12, snippet: "Attached the change order for the pool deck tile." },
  { id: "t-tile", to: "sales@tilewarehouse.com", toName: "Tile Warehouse", subject: "Lead time on the porcelain", ageHours: 31, snippet: "Any update on the lead time for the porcelain order?" },
];

// Messages sitting in the intake mailbox waiting to become notes: one email and one carrier
// text-to-email, so both arrival paths are exercised (handoff §11 "Notes arrive…").
export const SAMPLE_INTAKE: {
  id: string;
  via: "email" | "sms";
  from: string;
  text: string;
  receivedAt: string;
}[] = [
  {
    id: "gmail-intake-1",
    via: "email",
    from: "josh@worthprop.com",
    text: "Follow up with ES rep on the pooled window order",
    receivedAt: "2026-11-18T09:12:00-05:00",
  },
  {
    id: "gmail-intake-2",
    via: "sms",
    from: "15615551212@vtext.com",
    text: "Pick up permit packet at county office Thursday",
    receivedAt: "2026-11-18T14:03:00-05:00",
  },
];
