// api/src/auth.test.ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, newSessionToken, hashToken } from "../api/src/auth";

describe("password hashing", () => {
  it("verifies the correct password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });

  it("never stores the plain password", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).not.toContain("correct horse");
  });

  it("uses a different salt each time, so equal passwords hash differently", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  it("generates distinct random tokens", () => {
    expect(newSessionToken()).not.toBe(newSessionToken());
  });

  it("hashes a token deterministically and never equals the token", () => {
    const token = newSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});