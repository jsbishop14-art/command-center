// The session cookie name, kept in a tiny module with no "server-only" guard and no next/headers
// import so plain Node scripts (the updater's smoke check) can use it without pulling in the Next.js
// request context. auth.ts re-exports it for app code.
export const SESSION_COOKIE = "cc_session";
