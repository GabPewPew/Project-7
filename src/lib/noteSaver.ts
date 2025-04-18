import JSZip from 'jszip';
import { AudioData, NoteBlock, Flashcard } from '../types';
import { markdownToNoteBlocks } from './markdownToBlocks';
import { addFileContent, getFileContent, deleteNoteFiles, saveExtractedText, getExtractedText, deleteNoteExtractedTexts } from './fileStorage';

export interface NoteMetadata {
  noteId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'complete';
  tags: {
    primary: string;
    secondary?: string;
  };
  version: number;
}

export interface NoteAuditEntry {
  timestamp: number;
  action: 'create' | 'rename' | 'update' | 'delete';
  details: {
    previousTitle?: string;
    newTitle?: string;
    previousVersion?: number;
    newVersion?: number;
  };
}

// Helper function to read file as Base64 Data URL
async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URL'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Define a type for the processed file data metadata stored in localStorage
interface StoredFileMetadata {
  fileName: string;
  type?: string;
  size?: number;
  extractedTextKey?: string; // Add key for retrieving extracted text
}

// Define a type for the structure stored for current/history versions
interface NoteVersionData {
  version: number;
  content: string; // Markdown content
  blocks?: NoteBlock[]; // Optional block structure
  updatedAt: number;
}

export class NoteSaver {
  private readonly userId: string;
  private notes: Map<string, {
    content: string;
    files: StoredFileMetadata[];
    metadata: NoteMetadata;
    current: NoteVersionData;
    history: NoteVersionData[];
    audio?: {
      concise?: AudioData;
      detailed?: AudioData;
    };
    flashcards?: Flashcard[];
  }>;

  constructor(userId: string) {
    this.userId = userId;
    this.notes = new Map();
    this.loadNotesFromStorage();
  }

  private getStorageKey(): string {
    return `notes_${this.userId}`;
  }

  loadNotesFromStorage(): Record<string, any> {
    try {
      const storageData = localStorage.getItem(this.getStorageKey());
      if (!storageData) {
        return {};
      }

      const parsedData = JSON.parse(storageData);
      const notes: Record<string, any> = {};

      Object.entries(parsedData).forEach(([noteId, noteData]: [string, any]) => {
        if (noteData && noteData.metadata && noteData.current) {
          // Load the stored file metadata structure
          const loadedFileMetadata: StoredFileMetadata[] = (noteData.files || []).map((f: any) => ({
            fileName: f.fileName,
            type: f.type,
            size: f.size
          }));
          
          this.notes.set(noteId, {
            content: noteData.current.content,
            files: loadedFileMetadata,
            metadata: noteData.metadata,
            current: {
              version: noteData.current.version,
              content: noteData.current.content,
              blocks: noteData.current.blocks,
              updatedAt: noteData.current.updatedAt
            },
            history: (noteData.history || []).map((h: any) => ({
              version: h.version,
              content: h.content,
              blocks: h.blocks,
              updatedAt: h.updatedAt
            })),
            audio: noteData.audio,
            flashcards: noteData.flashcards
          });

          // Return data structure expected by App.tsx
          notes[noteId] = {
            id: noteId,
            noteId: noteId,
            title: noteData.metadata.title,
            createdAt: noteData.metadata.createdAt,
            updatedAt: noteData.metadata.updatedAt,
            status: noteData.metadata.status,
            tags: noteData.metadata.tags,
            current: {
              version: noteData.current.version,
              content: noteData.current.content,
              blocks: noteData.current.blocks,
              updatedAt: noteData.current.updatedAt
            },
            history: (noteData.history || []).map((h: any) => ({
              version: h.version,
              content: h.content,
              blocks: h.blocks,
              updatedAt: h.updatedAt
            })),
            files: loadedFileMetadata,
            audio: noteData.audio,
            flashcards: noteData.flashcards
          };
        }
      });

      return notes;
    } catch (error) {
      console.error('[NoteSaver] Failed to load notes from storage:', error);
      return {};
    }
  }

  private saveToStorage(): void {
    try {
      const notesData: Record<string, any> = {};
      this.notes.forEach((note, noteId) => {
        notesData[noteId] = {
          metadata: note.metadata,
          current: {
            version: note.current.version,
            content: note.current.content,
            blocks: note.current.blocks,
            updatedAt: note.current.updatedAt
          },
          history: note.history.map(h => ({
            version: h.version,
            content: h.content,
            blocks: h.blocks,
            updatedAt: h.updatedAt
          })),
          files: note.files,
          audio: note.audio,
          flashcards: note.flashcards
        };
      });
      localStorage.setItem(this.getStorageKey(), JSON.stringify(notesData));
      console.log(`[NoteSaver] Saved ${this.notes.size} notes to storage.`);
    } catch (error) {
      console.error('[NoteSaver] Failed to save notes to storage:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error("[NoteSaver] LocalStorage quota exceeded! Cannot save note changes.");
      }
    }
  }

  getNote(noteId: string) {
    return this.notes.get(noteId);
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async saveNote(
    title: string,
    generatedContent: string,
    sourceFiles: { file: File; extractedText: string }[],
    tags: { primary: string; secondary?: string }
  ): Promise<{ noteId: string }> {
    const noteId = this.generateNoteId();
    const timestamp = Date.now();
    
    console.log(`[NoteSaver] Saving new note: "${title}" with ${sourceFiles.length} source file(s).`);
    
    // Process source files: Read content, save to IndexedDB, save extracted text, prepare metadata
    const storedFileMetadataList: StoredFileMetadata[] = [];
    for (const sourceFile of sourceFiles) { 
      const file = sourceFile.file; // Get the File object
      const extractedText = sourceFile.extractedText;
      try {
        console.log(`[NoteSaver] Processing source file: ${file.name} (${file.size} bytes)`);
        const fileUrl = await readFileAsDataURL(file);
        console.log(`[NoteSaver] Read ${file.name} as data URL (length: ${fileUrl.length}). Saving to IndexedDB...`);
        
        // Save the actual content (Data URL) to IndexedDB
        await addFileContent(noteId, file.name, fileUrl);
        console.log(`[NoteSaver] Successfully saved ${file.name} content to IndexedDB.`);

        // Save the extracted plain text to IndexedDB
        let extractedTextKey: string | undefined = undefined;
        if (extractedText && extractedText.length > 0) {
          try {
            extractedTextKey = await saveExtractedText(noteId, file.name, extractedText);
            console.log(`[NoteSaver] Successfully saved extracted text for ${file.name} to IndexedDB with key: ${extractedTextKey}`);
          } catch (textError) {
            console.error(`[NoteSaver] Failed to save extracted text for ${file.name}:`, textError);
            // Continue without the text key if saving failed
          }
        } else {
          console.warn(`[NoteSaver] No extracted text provided for ${file.name}, skipping text save.`);
        }

        // Add metadata (including the text key) to the list for localStorage
        storedFileMetadataList.push({ 
          fileName: file.name,
          type: file.type,
          size: file.size,
          extractedTextKey: extractedTextKey // Store the key
        });

      } catch (error) {
        console.error(`[NoteSaver] Failed to read or save file ${file.name} to IndexedDB:`, error);
        // Skip adding metadata if processing failed
      }
    }
    
    console.log(`[NoteSaver] Stored content for ${storedFileMetadataList.length} out of ${sourceFiles.length} source files in IndexedDB.`);
    
    const metadata: NoteMetadata = {
      noteId,
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'complete',
      tags,
      version: 1
    };

    // Convert generated content to blocks
    const blocks = markdownToNoteBlocks(generatedContent);

    const currentVersion: NoteVersionData = {
      version: 1,
      content: generatedContent,
      blocks,
      updatedAt: timestamp
    };

    this.notes.set(noteId, {
      content: generatedContent,
      files: storedFileMetadataList,
      metadata,
      current: currentVersion,
      history: []
    });

    this.saveToStorage();
    console.log(`[NoteSaver] Note ${noteId} ('${title}') saved.`);
    return { noteId };
  }

  async updateNote(
    noteId: string,
    content: string,
    files?: File[],
    blocks?: NoteBlock[],
    flashcards?: Flashcard[]
  ): Promise<void> {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const timestamp = Date.now();
    const newVersion = note.current.version + 1;

    // Move current version to history, keeping only last 2 versions
    note.history = [note.current, ...note.history].slice(0, 2);

    // Update current version
    note.current = {
      version: newVersion,
      content,
      blocks: blocks || markdownToNoteBlocks(content),
      updatedAt: timestamp
    };

    // Update metadata
    note.metadata.updatedAt = timestamp;
    note.metadata.version = newVersion;

    if (files) {
      // If new files are provided, process them: Save to IndexedDB, update metadata
      console.log(`[NoteSaver] Updating note ${noteId} with ${files.length} new files.`);
      const newFileMetadataList: StoredFileMetadata[] = [];
      for (const file of files) {
         try {
           const fileUrl = await readFileAsDataURL(file);
           // Save new/updated content to IndexedDB
           await addFileContent(noteId, file.name, fileUrl);
           // Add metadata to the list
           newFileMetadataList.push({
             fileName: file.name,
             type: file.type,
             size: file.size
           });
         } catch (error) {
           console.error(`[NoteSaver] Failed to read/save updated file ${file.name}:`, error);
         }
       }
      note.files = newFileMetadataList; // Replace metadata list 
      console.log(`[NoteSaver] Note ${noteId} file metadata list updated.`);
    }

    if (flashcards) {
      note.flashcards = flashcards;
    }

    this.saveToStorage();
  }

  async saveAudio(
    noteId: string,
    style: 'concise' | 'detailed',
    audioData: AudioData
  ): Promise<void> {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    if (!note.audio) {
      note.audio = {};
    }

    note.audio[style] = audioData;
    this.saveToStorage();
  }

  async downloadNote(noteId: string): Promise<Blob> {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const zip = new JSZip();
    
    // Add current version
    zip.file('current/notes.md', note.current.content);
    
    // Add history versions
    const historyFolder = zip.folder('history');
    if (historyFolder && note.history.length > 0) {
      note.history.forEach(version => {
        historyFolder.file(
          `v${version.version}/notes.md`,
          version.content
        );
      });
    }
    
    // Add original files
    const filesFolder = zip.folder('raw');
    if (filesFolder) {
      // Iterate over the file METADATA stored in note.files
      for (const fileData of note.files) { 
        try {
          // Retrieve the actual file content from IndexedDB using metadata
          console.log(`[NoteSaver] Retrieving file content for ${fileData.fileName} from IndexedDB for download...`);
          const fileUrl = await getFileContent(noteId, fileData.fileName);

          if (fileUrl && fileUrl.startsWith('data:')) {
              // Extract base64 data from data URL
              const base64String = fileUrl.split(',')[1];
              if (!base64String) {
                console.warn(`[NoteSaver] Invalid data URL format for file ${fileData.fileName} retrieved from IndexedDB.`);
                continue; 
              }
              
              // Convert base64 to binary (Uint8Array)
              const binaryString = atob(base64String);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Add the binary data to the zip
              filesFolder.file(fileData.fileName, bytes, { binary: true });
              console.log(`[NoteSaver] Added ${fileData.fileName} (${bytes.length} bytes) to zip from IndexedDB.`);
          } else {
            console.warn(`[NoteSaver] Skipping file ${fileData.fileName} in downloadNote: Content not found in IndexedDB or invalid.`);
            filesFolder.file(`${fileData.fileName}.missing_or_invalid.txt`, `Content for ${fileData.fileName} was not found in IndexedDB or was invalid.`);
          }
        } catch (error) {
            console.error(`[NoteSaver] Failed to process file ${fileData.fileName} for download from IndexedDB:`, error);
            filesFolder.file(`${fileData.fileName}.error.txt`, `Failed to retrieve/process content for ${fileData.fileName} from IndexedDB. Error: ${error instanceof Error ? error.message : String(error)}`);
        } 
      }
    }

    // Add audio files and scripts if available
    if (note.audio) {
      const audioFolder = zip.folder('audio');
      if (audioFolder) {
        if (note.audio.concise) {
          audioFolder.file('concise/script.txt', note.audio.concise.script);
        }
        if (note.audio.detailed) {
          audioFolder.file('detailed/script.txt', note.audio.detailed.script);
        }
      }
    }

    // Add metadata
    zip.file('meta.json', JSON.stringify({
      ...note.metadata,
      current: {
        version: note.current.version,
        updatedAt: note.current.updatedAt
      },
      history: note.history.map(v => ({
        version: v.version,
        updatedAt: v.updatedAt
      })),
      audio: note.audio,
      flashcards: note.flashcards
    }, null, 2));

    return await zip.generateAsync({ type: 'blob' });
  }

  async deleteNote(noteId: string): Promise<void> {
    if (!this.notes.has(noteId)) {
      throw new Error('Note not found');
    }
    console.log(`[NoteSaver] Deleting note with ID: ${noteId}`);
    this.notes.delete(noteId);
    this.saveToStorage();
    // Also delete associated file content and extracted text from IndexedDB
    await deleteNoteFiles(noteId);
    await deleteNoteExtractedTexts(noteId);
    console.log(`[NoteSaver] Successfully deleted note ${noteId} and associated data.`);
  }

  getNoteMetadata(noteId: string): NoteMetadata | undefined {
    return this.notes.get(noteId)?.metadata;
  }

  getVersionHistory(noteId: string): Array<{
    version: number;
    updatedAt: number;
  }> | undefined {
    const note = this.notes.get(noteId);
    if (!note) return undefined;

    return [
      {
        version: note.current.version,
        updatedAt: note.current.updatedAt
      },
      ...note.history.map(v => ({
        version: v.version,
        updatedAt: v.updatedAt
      }))
    ];
  }
}