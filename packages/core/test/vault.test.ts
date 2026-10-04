import { describe, expect, it } from "vitest";
import { deriveKeys, generateDataKey, newRecoveryCode, seal, unseal, unwrapDataKey, wrapDataKey } from "../src/vault";

const FAST = { m: 1024, t: 1, p: 1 };

describe("vault", () => {
  it("defaults to RFC 9106 parameters and refuses weaker ones", async () => {
    const { DEFAULT_KDF, isAcceptableKdf } = await import("../src/vault");
    expect(DEFAULT_KDF).toEqual({ m: 65536, t: 3, p: 1 });
    expect(isAcceptableKdf(DEFAULT_KDF)).toBe(true);
    expect(isAcceptableKdf({ m: 131072, t: 4, p: 1 })).toBe(true);
    expect(isAcceptableKdf({ m: 1024, t: 1, p: 1 })).toBe(false);
    expect(isAcceptableKdf({ m: 1 << 30, t: 3, p: 1 })).toBe(false);
    expect(isAcceptableKdf("nope")).toBe(false);
  });

  it("produces the same auth key with the real parameters", async () => {
    const a = await deriveKeys("correct horse", "ayaan", "password");
    const b = await deriveKeys("correct horse", "AYAAN", "password");
    expect(a.authKey).toBe(b.authKey);
    expect(a.authKey).toHaveLength(44);
  }, 20000);

  it("derives the same keys for the same password and username, regardless of case", async () => {
    const a = await deriveKeys("correct horse", "Ayaan", "password", FAST);
    const b = await deriveKeys("correct horse", " ayaan ", "password", FAST);
    expect(a.authKey).toBe(b.authKey);
  });

  it("keeps the auth key independent from the wrapping key and the username", async () => {
    const a = await deriveKeys("correct horse", "ayaan", "password", FAST);
    const other = await deriveKeys("correct horse", "someone", "password", FAST);
    const recovery = await deriveKeys("correct horse", "ayaan", "recovery", FAST);
    expect(a.authKey).not.toBe(other.authKey);
    expect(a.authKey).not.toBe(recovery.authKey);
  });

  it("round-trips data through the wrapped key", async () => {
    const { kek } = await deriveKeys("correct horse", "ayaan", "password", FAST);
    const dataKey = await generateDataKey();
    const wrapped = await wrapDataKey(dataKey, kek);
    const unlocked = await unwrapDataKey(wrapped, (await deriveKeys("correct horse", "ayaan", "password", FAST)).kek);
    const sealed = await seal(dataKey, { role: "SDE II", salary: 2_200_000 }, "applications:abc");
    expect(sealed.ct).not.toContain("SDE");
    expect(await unseal(unlocked, sealed, "applications:abc")).toEqual({ role: "SDE II", salary: 2_200_000 });
  });

  it("refuses the wrong password", async () => {
    const { kek } = await deriveKeys("correct horse", "ayaan", "password", FAST);
    const wrapped = await wrapDataKey(await generateDataKey(), kek);
    const wrong = await deriveKeys("wrong horse", "ayaan", "password", FAST);
    await expect(unwrapDataKey(wrapped, wrong.kek)).rejects.toThrow();
  });

  it("refuses a record moved to another id", async () => {
    const dataKey = await generateDataKey();
    const sealed = await seal(dataKey, { role: "x" }, "applications:abc");
    await expect(unseal(dataKey, sealed, "applications:def")).rejects.toThrow();
  });

  it("recovery code unlocks the same data key, typed loosely", async () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^[A-HJKMNP-TV-Z2-9]{4}(-[A-HJKMNP-TV-Z2-9]{4}){3}$/);
    const dataKey = await generateDataKey();
    const wrapped = await wrapDataKey(dataKey, (await deriveKeys(code, "ayaan", "recovery", FAST)).kek);
    const typed = code.toLowerCase().replace(/-/g, " ");
    const unlocked = await unwrapDataKey(wrapped, (await deriveKeys(typed, "ayaan", "recovery", FAST)).kek, true);
    const sealed = await seal(dataKey, "hello", "settings");
    expect(await unseal(unlocked, sealed, "settings")).toBe("hello");
  });
});
