import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'FileContentDB';
const STORE_NAME = 'fileContents';
const DB_VERSION = 1;

interface FileContentEntry {
  key: string; // Composite key: `${noteId}_${fileName}`
  noteId: string;
  fileName: string;
  fileUrl: string; // Store base64 data URL
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          // Add an index on noteId to easily delete all files for a note
          store.createIndex('by_noteId', 'noteId');
          console.log('[FileStorage] IndexedDB store created:', STORE_NAME);
        }
      },
    });
    dbPromise.then(() => console.log('[FileStorage] IndexedDB connection opened.'))
             .catch(err => console.error('[FileStorage] Failed to open IndexedDB:', err));
  }
  return dbPromise;
}

// Function to create the composite key
function createKey(noteId: string, fileName: string): string {
  // Basic normalization to avoid issues with keys, replace potential separators
  const safeNoteId = noteId.replace(/_/g, '-');
  const safeFileName = fileName.replace(/_/g, '-');
  return `${safeNoteId}_${safeFileName}`;
}

/**
 * Saves file content (base64 data URL) to IndexedDB.
 * Replaces existing entry if key is the same.
 */
export async function addFileContent(noteId: string, fileName: string, fileUrl: string): Promise<void> {
  try {
    const db = await getDb();
    const key = createKey(noteId, fileName);
    const entry: FileContentEntry = { key, noteId, fileName, fileUrl };
    
    console.log(`[FileStorage] Adding/Updating file content for key: ${key} (Note: ${noteId}, File: ${fileName})`);
    await db.put(STORE_NAME, entry);
    console.log(`[FileStorage] Successfully stored file content for key: ${key}`);
  } catch (error) {
    console.error(`[FileStorage] Error saving file content for key ${createKey(noteId, fileName)}:`, error);
    throw error; // Re-throw error to indicate failure
  }
}

/**
 * Retrieves file content (base64 data URL) from IndexedDB.
 * Returns null if not found.
 */
export async function getFileContent(noteId: string, fileName: string): Promise<string | null> {
  try {
    const db = await getDb();
    const key = createKey(noteId, fileName);
    
    console.log(`[FileStorage] Getting file content for key: ${key} (Note: ${noteId}, File: ${fileName})`);
    const entry = await db.get(STORE_NAME, key);
    
    if (entry) {
      console.log(`[FileStorage] Successfully retrieved file content for key: ${key}`);
      return entry.fileUrl;
    } else {
      console.warn(`[FileStorage] No file content found for key: ${key}`);
      return null;
    }
  } catch (error) {
    console.error(`[FileStorage] Error getting file content for key ${createKey(noteId, fileName)}:`, error);
    return null; // Return null on error
  }
}

/**
 * Deletes all file content associated with a specific noteId from IndexedDB.
 */
export async function deleteNoteFiles(noteId: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const index = tx.store.index('by_noteId');
    let cursor = await index.openCursor(IDBKeyRange.only(noteId));
    let deletedCount = 0;

    console.log(`[FileStorage] Deleting files for noteId: ${noteId}`);
    while (cursor) {
      console.log(`[FileStorage] Deleting file content with key: ${cursor.primaryKey}`);
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }
    await tx.done;
    console.log(`[FileStorage] Successfully deleted ${deletedCount} file(s) for noteId: ${noteId}`);
  } catch (error) {
    console.error(`[FileStorage] Error deleting files for noteId ${noteId}:`, error);
    // Decide if failure here should be critical or just logged
  }
}

// Optional: Function to delete a single file entry (might be useful later)
export async function deleteSingleFile(noteId: string, fileName: string): Promise<void> {
   try {
    const db = await getDb();
    const key = createKey(noteId, fileName);
    console.log(`[FileStorage] Deleting single file content for key: ${key}`);
    await db.delete(STORE_NAME, key);
    console.log(`[FileStorage] Successfully deleted single file content for key: ${key}`);
  } catch (error) {
    console.error(`[FileStorage] Error deleting single file content for key ${createKey(noteId, fileName)}:`, error);
  }
}

// Initialize DB connection on load
getDb();

// --- Extracted Text Storage ---

const TEXT_STORE_NAME = 'extractedText';
const TEXT_DB_VERSION = 1; // Can be same or different from file store version

interface ExtractedTextEntry {
  key: string; // Composite key: `text_${noteId}_${fileName}`
  noteId: string;
  fileName: string;
  extractedText: string;
}

let textDbPromise: Promise<IDBPDatabase> | null = null;

// Separate DB or Store? Let's use the same DB but a different Store for simplicity now
function getTextDb(): Promise<IDBPDatabase> {
  if (!textDbPromise) {
    // Re-use the main DB promise logic but potentially upgrade for the new store
    textDbPromise = openDB(DB_NAME, Math.max(DB_VERSION, TEXT_DB_VERSION), { // Use highest version
      upgrade(db, oldVersion, newVersion, transaction) {
        // Upgrade for fileContents if needed (from original logic)
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const fileStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          fileStore.createIndex('by_noteId', 'noteId');
          console.log('[FileStorage] IndexedDB store created:', STORE_NAME);
        }
        // Upgrade for extractedText store
        if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) {
          const textStore = db.createObjectStore(TEXT_STORE_NAME, { keyPath: 'key' });
          // Add index on noteId to easily delete text for a note
          textStore.createIndex('by_noteId', 'noteId'); 
          console.log('[FileStorage] IndexedDB store created:', TEXT_STORE_NAME);
        }
      },
    });
    textDbPromise.then(() => console.log('[FileStorage] IndexedDB connection opened for text store.'))
                 .catch(err => console.error('[FileStorage] Failed to open IndexedDB for text store:', err));
  }
  return textDbPromise;
}

// Function to create the key for the text store
function createTextKey(noteId: string, fileName: string): string {
  const safeNoteId = noteId.replace(/_/g, '-');
  const safeFileName = fileName.replace(/_/g, '-');
  return `text_${safeNoteId}_${safeFileName}`;
}

/**
 * Saves extracted plain text content to IndexedDB.
 */
export async function saveExtractedText(noteId: string, fileName: string, extractedText: string): Promise<string> {
  const key = createTextKey(noteId, fileName);
  try {
    const db = await getTextDb(); // Use the potentially upgraded DB
    const entry: ExtractedTextEntry = { key, noteId, fileName, extractedText };
    
    console.log(`[FileStorage] Saving extracted text for key: ${key} (Note: ${noteId}, File: ${fileName})`);
    await db.put(TEXT_STORE_NAME, entry);
    console.log(`[FileStorage] Successfully stored extracted text for key: ${key}`);
    return key; // Return the key used
  } catch (error) {
    console.error(`[FileStorage] Error saving extracted text for key ${key}:`, error);
    throw error;
  }
}

/**
 * Retrieves extracted plain text content from IndexedDB.
 * Returns null if not found or on error.
 */
export async function getExtractedText(key: string): Promise<string | null> {
  if (!key || !key.startsWith('text_')) {
    console.warn('[FileStorage] Invalid key provided to getExtractedText:', key);
    return null;
  }
  try {
    const db = await getTextDb();
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

/**
 * Deletes all extracted text associated with a specific noteId from IndexedDB.
 */
export async function deleteNoteExtractedTexts(noteId: string): Promise<void> {
  try {
    const db = await getTextDb();
    const tx = db.transaction(TEXT_STORE_NAME, 'readwrite');
    const index = tx.store.index('by_noteId');
    let cursor = await index.openCursor(IDBKeyRange.only(noteId));
    let deletedCount = 0;

    console.log(`[FileStorage] Deleting extracted texts for noteId: ${noteId}`);
    while (cursor) {
      console.log(`[FileStorage] Deleting extracted text with key: ${cursor.primaryKey}`);
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }
    await tx.done;
    console.log(`[FileStorage] Successfully deleted ${deletedCount} extracted text(s) for noteId: ${noteId}`);
  } catch (error) {
    console.error(`[FileStorage] Error deleting extracted texts for noteId ${noteId}:`, error);
  }
}

// Make sure text DB connection is also initialized
getTextDb(); 