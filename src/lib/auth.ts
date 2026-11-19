import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { authenticate, getUserById, type User } from "./users";
import { hashToken, newSessionToken } from "./crypto";

export const SESSION_COOKIE = "cc_session";
const SESSION_DAYS = 30;

// Create a session for a user and set the cookie. The cookie holds an opaque token; the database
// stores only its sha256, so a database read cannot recover a live cookie.
export function startSession(userId: number): void {
  const token = newSessionToken();
  const id = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, now.toISOString(), expires.toISOString());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export function signIn(username: string, password: string): User | null {
  const user = authenticate(username, password);
  if (!user) return null;
  startSession(user.id);
  return user;
}

export function signOut(): void {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
  }
  cookies().delete(SESSION_COOKIE);
}

// The signed-in user for this request, or null. Expired sessions are treated as signed out and
// pruned.
export function currentUser(): User | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const row = getDb()
    .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .get(id) as { user_id: number; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  return getUserById(row.user_id);
}
