export interface ReportDraftData {
  assetCode: string;
  description: string;
  photoDataUrl: string;
  photoName: string;
  photoType: string;
  savedAt: number;
}

const DB_NAME = "greenpark_draft_db";
const STORE_NAME = "report_drafts";
const DB_VERSION = 1;

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB tidak tersedia di lingkungan ini."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "assetCode" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Menyimpan draft laporan (teks + foto Base64/DataURL) ke IndexedDB browser
 * agar tidak hilang saat pengguna berpindah halaman/login Google (PRD 14.5).
 */
export async function saveReportDraftToIdb(
  draft: ReportDraftData
): Promise<void> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadReportDraftFromIdb(
  assetCode: string
): Promise<ReportDraftData | null> {
  try {
    const db = await openDraftDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(assetCode.toUpperCase());
      req.onsuccess = () => resolve((req.result as ReportDraftData) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearReportDraftFromIdb(
  assetCode: string
): Promise<void> {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(assetCode.toUpperCase());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Abaikan jika IndexedDB tidak tersedia
  }
}

