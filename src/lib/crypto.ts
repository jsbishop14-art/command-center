import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// Node's built-in crypto only (CLAUDE.md stack): scrypt for passwords, AES-256-GCM for the secret
// store. No third-party crypto.

// ---- Passwords ----

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ---- Session tokens ----

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---- Secret store (AES-256-GCM) ----

export type SealedSecret = { iv: string; ciphertext: string; tag: string };

function secretKey(): Buffer {
  const raw = process.env.CC_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "CC_SECRET_KEY is not set. The install step writes a 32-byte key outside the repo; " +
        "set it before using the secret store.",
    );
  }
  // Accept 64 hex chars (32 bytes) or base64 of 32 bytes.
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CC_SECRET_KEY must decode to 32 bytes (64 hex chars or base64 of 32 bytes).");
  }
  return key;
}

export function sealSecret(plaintext: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("hex"), ciphertext: ct.toString("hex"), tag: tag.toString("hex") };
}

export function openSecret(sealed: SealedSecret): string {
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(sealed.iv, "hex"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "hex"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "hex")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
