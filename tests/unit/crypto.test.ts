import { describe, it, expect, beforeEach } from "vitest";
import { TEST_SECRET_KEY } from "./helpers";
import {
  hashPassword,
  verifyPassword,
  sealSecret,
  openSecret,
  hashToken,
  newSessionToken,
} from "../../src/lib/crypto";

describe("passwords", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const { hash, salt } = hashPassword("correct horse");
    expect(verifyPassword("correct horse", hash, salt)).toBe(true);
    expect(verifyPassword("wrong horse", hash, salt)).toBe(false);
  });

  it("uses a fresh salt each time", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("session tokens", () => {
  it("hashes a token deterministically and the token is random", () => {
    const t1 = newSessionToken();
    const t2 = newSessionToken();
    expect(t1).not.toBe(t2);
    expect(hashToken(t1)).toBe(hashToken(t1));
    expect(hashToken(t1)).not.toBe(hashToken(t2));
  });
});

describe("secret store crypto", () => {
  beforeEach(() => {
    process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  });

  it("round-trips a value", () => {
    const sealed = sealSecret("twilio-abc-123");
    expect(sealed.ciphertext).not.toContain("twilio");
    expect(openSecret(sealed)).toBe("twilio-abc-123");
  });

  it("fails to open with the wrong key", () => {
    const sealed = sealSecret("secret value");
    process.env.CC_SECRET_KEY =
      "22222222222222222222222222222222222222222222222222222222222222cd";
    expect(() => openSecret(sealed)).toThrow();
  });
});
