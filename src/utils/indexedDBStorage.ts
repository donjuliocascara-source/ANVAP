/**
 * Almacenamiento persistente en IndexedDB para LocalDB.
 * Supera la restricción de cuota de 5MB de localStorage, permitiendo almacenar
 * miles de lotes, análisis y registros de humedad sin errores de cuota.
 */

const DB_NAME = "ArrozApitStorage_v4";
const STORE_NAME = "app_state";
const KEY = "database_state";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB no disponible en este entorno"));
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda el estado completo en IndexedDB (asíncrono, soporta cientos de MBs)
 */
export async function saveToIndexedDB(data: any): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn("[IndexedDB] Error al guardar estado:", req.error);
        resolve(false);
      };
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] No se pudo abrir la base de datos para guardar:", err);
    return false;
  }
}

/**
 * Carga el estado completo desde IndexedDB
 */
export async function loadFromIndexedDB<T = any>(): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => {
        resolve((req.result as T) || null);
      };
      req.onerror = () => {
        resolve(null);
      };
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Elimina completamente los datos guardados en IndexedDB
 */
export async function clearIndexedDB(): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && window.indexedDB && window.indexedDB.deleteDatabase) {
      try {
        window.indexedDB.deleteDatabase("ArrozApitStorage_v1");
        window.indexedDB.deleteDatabase("ArrozApitStorage_v2");
        window.indexedDB.deleteDatabase("ArrozApitStorage_v3");
        window.indexedDB.deleteDatabase(DB_NAME);
      } catch {}
    }
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

