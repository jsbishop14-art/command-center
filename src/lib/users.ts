import { getDb } from "./db";
import { hashPassword, verifyPassword } from "./crypto";

export type Role = "josh" | "christine";

export type User = {
  id: number;
  username: string;
  display_name: string;
  role: Role;
};

type UserRow = User & { password_hash: string; password_salt: string; deleted_at: string | null };

export function getUserByUsername(username: string): UserRow | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE username = ? AND deleted_at IS NULL")
    .get(username) as UserRow | undefined;
  return row ?? null;
}

export function getUserById(id: number): User | null {
  const row = getDb()
    .prepare("SELECT id, username, display_name, role FROM users WHERE id = ? AND deleted_at IS NULL")
    .get(id) as User | undefined;
  return row ?? null;
}

export function listUsers(): User[] {
  return getDb()
    .prepare("SELECT id, username, display_name, role FROM users WHERE deleted_at IS NULL ORDER BY id")
    .all() as User[];
}

export function createUser(args: {
  username: string;
  display_name: string;
  role: Role;
  password: string;
}): number {
  const { hash, salt } = hashPassword(args.password);
  const info = getDb()
    .prepare(
      `INSERT INTO users (username, display_name, role, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(args.username, args.display_name, args.role, hash, salt, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function setUserPassword(username: string, password: string): void {
  const { hash, salt } = hashPassword(password);
  getDb()
    .prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE username = ?")
    .run(hash, salt, username);
}

// Returns the user when the password matches, else null. Used by sign-in.
export function authenticate(username: string, password: string): User | null {
  const row = getUserByUsername(username);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash, row.password_salt)) return null;
  return { id: row.id, username: row.username, display_name: row.display_name, role: row.role };
}
