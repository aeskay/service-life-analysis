/**
 * fileRegistry.js
 * Browser-native file store using IndexedDB & in-memory caching.
 * Keeps uploaded File objects (repaired.xlsx, in-service.xlsx, PMIS.csv)
 * persistent across browser reloads.
 */

const DB_NAME = 'ServiceLifeFileDB';
const STORE_NAME = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeFileInRegistry(key, file) {
  window.__uploadedFiles = window.__uploadedFiles || {};
  window.__uploadedFiles[key] = file;
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, key);
  } catch (e) {
    console.warn('Could not save file to IndexedDB:', e);
  }
}

export async function getFileFromRegistry(key) {
  if (window.__uploadedFiles && window.__uploadedFiles[key]) {
    return window.__uploadedFiles[key];
  }
  try {
    const db = await openDB();
    if (!db) return null;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const file = await new Promise((resolve) => {
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (file) {
      window.__uploadedFiles = window.__uploadedFiles || {};
      window.__uploadedFiles[key] = file;
      return file;
    }
  } catch (e) {
    console.warn('Could not read file from IndexedDB:', e);
  }
  return null;
}
