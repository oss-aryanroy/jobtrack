const DB = "jobtrack-keys";
const STORE = "keys";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveKey = (username: string, key: CryptoKey) => run("readwrite", (s) => s.put(key, username));
export const loadKey = (username: string) => run<CryptoKey | undefined>("readonly", (s) => s.get(username)).catch(() => undefined);
export const forgetKeys = () => run("readwrite", (s) => s.clear()).catch(() => undefined);
