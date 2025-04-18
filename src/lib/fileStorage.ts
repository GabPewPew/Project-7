import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'FileContentDB';
const FILE_STORE_NAME = 'fileContents';
const TEXT_STORE_NAME = 'extractedText';
const DB_VERSION = 2; // Incremented version to ensure upgrade runs

interface FileContentEntry {
  key: string; // Composite key: `${noteId}_${fileName}`
  noteId: string;
  fileName: string;
  fileUrl: string; // Store base64 data URL
}

interface ExtractedTextEntry {
  key: string; // Composite key: `text_${noteId}_${fileName}`
  noteId: string;
  fileName: string;
  extractedText: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    console.log('[FileStorage] Initializing IndexedDB connection...');
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[FileStorage] Upgrading DB from version ${oldVersion} to ${newVersion}`);
        // Create fileContents store if it doesn't exist
        if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
          const fileStore = db.createObjectStore(FILE_STORE_NAME, { keyPath: 'key' });
          fileStore.createIndex('by_noteId', 'noteId');
          console.log('[FileStorage] IndexedDB store created:', FILE_STORE_NAME);
        }
        // Create extractedText store if it doesn't exist
        if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) {
          const textStore = db.createObjectStore(TEXT_STORE_NAME, { keyPath: 'key' });
          textStore.createIndex('by_noteId', 'noteId');
          console.log('[FileStorage] IndexedDB store created:', TEXT_STORE_NAME);
        }
      },
      blocked() {
        console.error('[FileStorage] IndexedDB upgrade blocked. Please close other tabs accessing this database.');
        alert('Database upgrade needed. Please close other tabs/windows running this application and reload.');
      },
      blocking() {
        console.warn('[FileStorage] IndexedDB connection is blocking an upgrade. Closing connection.');
        dbPromise?.then(db => db.close()); // Attempt to close the blocking connection
        dbPromise = null; // Reset promise to allow re-initialization
      },
      terminated() {
         console.warn('[FileStorage] IndexedDB connection terminated unexpectedly.');
         dbPromise = null; // Reset promise if terminated
      }
    });
    dbPromise.then(() => console.log('[FileStorage] IndexedDB connection opened successfully.'))
             .catch(err => {
                 console.error('[FileStorage] Failed to open IndexedDB:', err);
                 dbPromise = null; // Reset promise on failure
             });
  }
  return dbPromise;
}

// --- File Content Functions ---

function createFileKey(noteId: string, fileName: string): string {
  const safeNoteId = noteId.replace(/_/g, '-');
  const safeFileName = fileName.replace(/_/g, '-');
  return `${safeNoteId}_${safeFileName}`;
}

export async function addFileContent(noteId: string, fileName: string, fileUrl: string): Promise<void> {
  try {
    const db = await getDb();
    const key = createFileKey(noteId, fileName);
    const entry: FileContentEntry = { key, noteId, fileName, fileUrl };
    console.log(`[FileStorage] Adding/Updating file content for key: ${key}`);
    await db.put(FILE_STORE_NAME, entry);
    console.log(`[FileStorage] Successfully stored file content for key: ${key}`);
  } catch (error) {
    console.error(`[FileStorage] Error saving file content for key ${createFileKey(noteId, fileName)}:`, error);
    throw error;
  }
}

export async function getFileContent(noteId: string, fileName: string): Promise<string | null> {
  try {
    const db = await getDb();
    const key = createFileKey(noteId, fileName);
    console.log(`[FileStorage] Getting file content for key: ${key}`);
    const entry = await db.get(FILE_STORE_NAME, key);
    if (entry) {
      console.log(`[FileStorage] Successfully retrieved file content for key: ${key}`);
      return entry.fileUrl;
    } else {
      console.warn(`[FileStorage] No file content found for key: ${key}`);
      return null;
    }
  } catch (error) {
    console.error(`[FileStorage] Error getting file content for key ${createFileKey(noteId, fileName)}:`, error);
    return null;
  }
}

export async function deleteNoteFiles(noteId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(FILE_STORE_NAME, 'readwrite');
    const index = tx.store.index('by_noteId');
    let cursor = await index.openCursor(IDBKeyRange.only(noteId));
    let deletedCount = 0;
    console.log(`[FileStorage] Deleting file contents for noteId: ${noteId}`);
    while (cursor) {
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }
    await tx.done;
    console.log(`[FileStorage] Successfully deleted ${deletedCount} file content entry(s) for noteId: ${noteId}`);
  } catch (error) {
    console.error(`[FileStorage] Error deleting file contents for noteId ${noteId}:`, error);
  }
}

// --- Extracted Text Functions ---

function createTextKey(noteId: string, fileName: string): string {
  const safeNoteId = noteId.replace(/_/g, '-');
  const safeFileName = fileName.replace(/_/g, '-');
  return `text_${safeNoteId}_${safeFileName}`;
}

export async function saveExtractedText(noteId: string, fileName: string, extractedText: string): Promise<string> {
  const key = createTextKey(noteId, fileName);
  try {
    const db = await getDb(); // Use the single getDb function
    const entry: ExtractedTextEntry = { key, noteId, fileName, extractedText };
    console.log(`[FileStorage] Saving extracted text for key: ${key}`);
    await db.put(TEXT_STORE_NAME, entry);
    console.log(`[FileStorage] Successfully stored extracted text for key: ${key}`);
    return key;
  } catch (error) {
    console.error(`[FileStorage] Error saving extracted text for key ${key}:`, error);
    throw error;
  }
}

export async function getExtractedText(key: string): Promise<string | null> {
  if (!key || !key.startsWith('text_')) {
    console.warn('[FileStorage] Invalid key provided to getExtractedText:', key);
    return null;
  }
  try {
    const db = await getDb();
    console.log(`[FileStorage] Getting extracted text for key: ${key}`);
    const entry = await db.get(TEXT_STORE_NAME, key);
    if (entry) {
      console.log(`[FileStorage] Successfully retrieved extracted text for key: ${key}`);
      return entry.extractedText;
    } else {
      console.warn(`[FileStorage] No extracted text found for key: ${key}`);
      return null;
    }
  } catch (error) {
    console.error(`[FileStorage] Error getting extracted text for key ${key}:`, error);
    return null;
  }
}

export async function deleteNoteExtractedTexts(noteId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
    const index = tx.store.index('by_noteId');
    let cursor = await index.openCursor(IDBKeyRange.only(noteId));
    let deletedCount = 0;
    console.log(`[FileStorage] Deleting extracted texts for noteId: ${noteId}`);
    while (cursor) {
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }
    await tx.done;
    console.log(`[FileStorage] Successfully deleted ${deletedCount} extracted text entry(s) for noteId: ${noteId}`);
  } catch (error) {
    console.error(`[FileStorage] Error deleting extracted texts for noteId ${noteId}:`, error);
  }
}

// --- Combined Deletion Function ---

// Optional: Function to delete both file content and extracted text for a note
export async function deleteAllNoteData(noteId: string): Promise<void> {
  console.log(`[FileStorage] Deleting all data for noteId: ${noteId}`);
  try {
    // It's generally safer to run separate transactions unless atomicity is critical
    // and the operations are simple. Here, separate is fine.
    await deleteNoteFiles(noteId);
    await deleteNoteExtractedTexts(noteId);
    console.log(`[FileStorage] Finished deleting all data for noteId: ${noteId}`);
  } catch (error) {
    console.error(`[FileStorage] Error during combined deletion for noteId ${noteId}:`, error);
    // Consider how to handle partial failures if necessary
  }
}

// Initialize DB connection on load
getDb(); 