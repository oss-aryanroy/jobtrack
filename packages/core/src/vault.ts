import { argon2id } from "hash-wasm";

export interface KdfParams {
  m: number;
  t: number;
  p: number;
}

export const DEFAULT_KDF: KdfParams = { m: 65536, t: 3, p: 1 };

export const isAcceptableKdf = (v: unknown): v is KdfParams => {
  if (typeof v !== "object" || v === null) return false;
  const { m, t, p } = v as Record<string, unknown>;
  return (
    Number.isInteger(m) && Number.isInteger(t) && Number.isInteger(p) &&
    (m as number) >= DEFAULT_KDF.m && (m as number) <= 1_048_576 &&
    (t as number) >= DEFAULT_KDF.t && (t as number) <= 20 &&
    (p as number) >= 1 && (p as number) <= 8
  );
};

export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export interface Sealed {
  iv: string;
  ct: string;
}

export interface DerivedKeys {
  authKey: string;
  kek: CryptoKey;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export async function deriveKeys(
  secret: string,
  username: string,
  purpose: "password" | "recovery",
  params: KdfParams = DEFAULT_KDF,
): Promise<DerivedKeys> {
  const material = purpose === "recovery" ? secret.toUpperCase().replace(/[^A-Z0-9]/g, "") : secret.normalize("NFKC");
  const master = (await argon2id({
    password: material,
    salt: encoder.encode(`jobtrack/v1/${purpose}/${normalizeUsername(username)}`),
    iterations: params.t,
    memorySize: params.m,
    parallelism: params.p,
    hashLength: 32,
    outputType: "binary",
  })) as Uint8Array<ArrayBuffer>;
  const hkdf = await subtle().importKey("raw", master, "HKDF", false, ["deriveBits", "deriveKey"]);
  const info = (label: string) => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode(label) });
  const authBits = await subtle().deriveBits(info("auth"), hkdf, 256);
  const kek = await subtle().deriveKey(info("wrap"), hkdf, { name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey"]);
  return { authKey: toBase64(authBits), kek };
}

export const generateDataKey = () =>
  subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]) as Promise<CryptoKey>;

export async function wrapDataKey(dataKey: CryptoKey, kek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await subtle().wrapKey("raw", dataKey, kek, { name: "AES-GCM", iv });
  return `${toBase64(iv)}.${toBase64(wrapped)}`;
}

export async function unwrapDataKey(wrapped: string, kek: CryptoKey, extractable = false): Promise<CryptoKey> {
  const [iv, ct] = wrapped.split(".");
  if (!iv || !ct) throw new Error("Malformed key");
  return subtle().unwrapKey("raw", fromBase64(ct), kek, { name: "AES-GCM", iv: fromBase64(iv) }, { name: "AES-GCM" }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

export async function seal(dataKey: CryptoKey, value: unknown, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(aad) }, dataKey, encoder.encode(JSON.stringify(value)));
  return { iv: toBase64(iv), ct: toBase64(ct) };
}

export async function unseal<T>(dataKey: CryptoKey, sealed: Sealed, aad: string): Promise<T> {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64(sealed.iv), additionalData: encoder.encode(aad) },
    dataKey,
    fromBase64(sealed.ct),
  );
  return JSON.parse(decoder.decode(plain)) as T;
}

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function newRecoveryCode(): string {
  const out: string[] = [];
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < 240 && out.length < 16) out.push(RECOVERY_ALPHABET[b % 30]!);
    }
  }
  return out.join("").replace(/(.{4})(?=.)/g, "$1-");
}
