import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { authenticate, getUserById, type User } from "./users";
import { createSession, resolveSession, deleteSession, SESSION_WINDOW_DAYS } from "./sessions";
import { SESSION_COOKIE } from "./auth-cookie";

export { SESSION_COOKIE, SESSION_WINDOW_DAYS };

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

// Create a session for a user and set the cookie. The cookie holds an opaque token; the database
// stores only its sha256, so a database read cannot recover a live cookie. The expiry is a long
// sliding window (see sessions.ts).
export function startSession(userId: number): void {
  const { token, expires } = createSession(getDb(), userId);
  cookies().set(SESSION_COOKIE, token, cookieOptions(expires));
}

export function signIn(username: string, password: string): User | null {
  const user = authenticate(username, password);
  if (!user) return null;
  startSession(user.id);
  return user;
}

export function signOut(): void {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) deleteSession(getDb(), token);
  cookies().delete(SESSION_COOKIE);
}

// The signed-in user for this request, or null. Using a live session slides its expiry forward, so
// anyone who uses the app within the window stays signed in (CC12 spec §1). Expired sessions are
// treated as signed out and pruned.
export function currentUser(): User | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const resolved = resolveSession(getDb(), token);
  if (!resolved) return null;
  // Refresh the cookie's own expiry to match the slid session. Reading cookies in a Server
  // Component where the response is already committed throws; ignore that — the session row is the
  // source of truth and is already extended.
  try {
    cookies().set(SESSION_COOKIE, token, cookieOptions(resolved.expires));
  } catch {
    // cookies are read-only in this context (e.g. a Server Component render); the slid session row
    // still keeps the user signed in.
  }
  return getUserById(resolved.userId);
}
