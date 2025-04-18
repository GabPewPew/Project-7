import JSZip from 'jszip';
import { AudioData, NoteBlock, Flashcard } from '../types';
import { markdownToNoteBlocks } from './markdownToBlocks';

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

export class NoteSaver {
  private readonly userId: string;
  private notes: Map<string, {
    content: string;
    files: File[];
    metadata: NoteMetadata;
    current: {
      version: number;
      content: string;
      rawData: string;
      updatedAt: number;
    };
    history: Array<{
      version: number;
      content: string;
      rawData: string;
      updatedAt: number;
    }>;
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
          this.notes.set(noteId, {
            content: noteData.current.content,
            files: [], // Files can't be stored in localStorage
            metadata: noteData.metadata,
            current: noteData.current,
            history: noteData.history || [],
            audio: noteData.audio,
            flashcards: noteData.flashcards
          });

          notes[noteId] = {
            id: noteId,
            noteId: noteId,
            title: noteData.metadata.title,
            createdAt: noteData.metadata.createdAt,
            updatedAt: noteData.metadata.updatedAt,
            status: noteData.metadata.status,
            tags: noteData.metadata.tags,
            current: noteData.current,
            history: noteData.history || [],
            files: noteData.files || [],
            audio: noteData.audio,
            flashcards: noteData.flashcards
          };
        }
      });

      return notes;
    } catch (error) {
      console.error('Failed to load notes from storage:', error);
      return {};
    }
  }

  private saveToStorage(): void {
    try {
      const notesData: Record<string, any> = {};
      this.notes.forEach((note, noteId) => {
        notesData[noteId] = {
          metadata: note.metadata,
          current: note.current,
          history: note.history,
          files: note.files.map(f => ({ fileName: f.name })),
          audio: note.audio,
          flashcards: note.flashcards
        };
      });
      localStorage.setItem(this.getStorageKey(), JSON.stringify(notesData));
    } catch (error) {
      console.error('Failed to save notes to storage:', error);
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
    content: string,
    files: File[],
    tags: { primary: string; secondary?: string }
  ): Promise<{ noteId: string }> {
    const noteId = this.generateNoteId();
    const timestamp = Date.now();
    
    const metadata: NoteMetadata = {
      noteId,
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'complete',
      tags,
      version: 1
    };

    // Convert content to blocks
    const blocks = markdownToNoteBlocks(content);

    const currentVersion = {
      version: 1,
      content,
      blocks,
      rawData: JSON.stringify(files.map(f => f.name)),
      updatedAt: timestamp
    };

    this.notes.set(noteId, {
      content,
      files,
      metadata,
      current: currentVersion,
      history: []
    });

    this.saveToStorage();
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
      rawData: JSON.stringify((files || note.files).map(f => f.name)),
      updatedAt: timestamp
    };

    // Update metadata
    note.metadata.updatedAt = timestamp;
    note.metadata.version = newVersion;

    if (files) {
      note.files = files;
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
      for (const file of note.files) {
        const buffer = await file.arrayBuffer();
        filesFolder.file(file.name, buffer);
      }
    }

    // Add audio files and scripts if available
    if (note.audio) {
      const audioFolder = zip.folder('audio');
      if (audioFolder) {
        if (note.audio.concise) {
          audioFolder.file('concise/script.txt', note.audio.concise.script);
          // Audio URL would be downloaded separately
        }
        if (note.audio.detailed) {
          audioFolder.file('detailed/script.txt', note.audio.detailed.script);
          // Audio URL would be downloaded separately
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
    this.notes.delete(noteId);
    this.saveToStorage();
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