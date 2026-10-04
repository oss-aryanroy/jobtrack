import {
  DEFAULT_KDF,
  type KdfParams,
  deriveKeys,
  generateDataKey,
  isAcceptableKdf,
  newRecoveryCode,
  normalizeUsername,
  unwrapDataKey,
  wrapDataKey,
} from "@jobtrack/core/vault";
import { type NewKeys, beginRecovery, finishRecovery, kdfFor, logIn, signUp } from "@/app/actions";
import { saveKey } from "./keystore";

type Outcome = { ok: true; recoveryCode?: string } | { ok: false; error: string };

const WEAK_PARAMS = "The server asked for weaker encryption than JobTrack allows, so sign-in was stopped.";

async function newKeysFor(username: string, password: string, dataKey: CryptoKey): Promise<{ keys: NewKeys; recoveryCode: string; kek: CryptoKey }> {
  const recoveryCode = newRecoveryCode();
  const [pw, rc] = await Promise.all([
    deriveKeys(password, username, "password", DEFAULT_KDF),
    deriveKeys(recoveryCode, username, "recovery", DEFAULT_KDF),
  ]);
  return {
    recoveryCode,
    kek: pw.kek,
    keys: {
      authKey: pw.authKey,
      recoveryAuth: rc.authKey,
      wrappedKey: await wrapDataKey(dataKey, pw.kek),
      wrappedKeyRecovery: await wrapDataKey(dataKey, rc.kek),
      kdf: DEFAULT_KDF,
    },
  };
}

async function remember(username: string, wrappedKey: string, kek: CryptoKey) {
  await saveKey(normalizeUsername(username), await unwrapDataKey(wrappedKey, kek, false));
}

export async function createAccount(username: string, password: string): Promise<Outcome> {
  const dataKey = await generateDataKey();
  const { keys, recoveryCode, kek } = await newKeysFor(username, password, dataKey);
  const result = await signUp(username, keys);
  if (!result.ok) return result;
  await remember(username, keys.wrappedKey, kek);
  return { ok: true, recoveryCode };
}

async function paramsFor(username: string): Promise<KdfParams | null> {
  const kdf = await kdfFor(username);
  return isAcceptableKdf(kdf) ? kdf : null;
}

export async function signIn(username: string, password: string): Promise<Outcome> {
  const kdf = await paramsFor(username);
  if (!kdf) return { ok: false, error: WEAK_PARAMS };
  const { authKey, kek } = await deriveKeys(password, username, "password", kdf);
  const result = await logIn(username, authKey);
  if (!result.ok) return result;
  await remember(username, result.wrappedKey, kek);
  return { ok: true };
}

export async function unlock(username: string, password: string, wrappedKey: string, kdf: KdfParams): Promise<boolean> {
  if (!isAcceptableKdf(kdf)) return false;
  try {
    await remember(username, wrappedKey, (await deriveKeys(password, username, "password", kdf)).kek);
    return true;
  } catch {
    return false;
  }
}

export async function recoverAccount(username: string, code: string, newPassword: string): Promise<Outcome> {
  const kdf = await paramsFor(username);
  if (!kdf) return { ok: false, error: WEAK_PARAMS };
  const rc = await deriveKeys(code, username, "recovery", kdf);
  const begun = await beginRecovery(username, rc.authKey);
  if (!begun.ok) return begun;
  const dataKey = await unwrapDataKey(begun.wrappedKeyRecovery, rc.kek, true);
  const { keys, recoveryCode, kek } = await newKeysFor(username, newPassword, dataKey);
  const finished = await finishRecovery(username, rc.authKey, keys);
  if (!finished.ok) return finished;
  await remember(username, keys.wrappedKey, kek);
  return { ok: true, recoveryCode };
}
