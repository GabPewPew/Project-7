import { ReactNode } from 'react';

export interface ProcessingResult {
  fileName: string;
  type: string;
  content: string;
  tables?: Array<{
    rows: Array<Array<string>>;
    pageNumber: number;
  }>;
}

export interface SimilarityScore {
  fileA: string;
  fileB: string;
  similarity: number;
}

export interface ContentGroup {
  groupId?: string;
  groupTitle: string;
  primary: string;
  secondary?: string;
  files: string[];
  mergedContent: string;
}

export type LearningIntent = 'exam_prep' | 'research' | 'custom';
export type ExamPrepStyle = 'simple' | 'detailed' | 'deep_dive';
export type ResearchStyle = 'simple' | 'comprehensive';

export interface GeminiRequest {
  content: string;
  intent: LearningIntent;
  style?: ExamPrepStyle | ResearchStyle;
  customPrompt?: string;
  detailLevel: 1 | 2 | 3;
  primary: string;
  secondary?: string;
  fileId: string;
  fileName: string;
}

export interface GeminiResponse {
  notes: string;
  mnemonics?: string[];
  error?: string;
  blocks?: NoteBlock[];
}

export interface ProcessedContent {
  content: string;
  mnemonics: string[];
  references?: string[];
}

export interface MarkdownRendererProps {
  markdown: string;
  className?: string;
}

export interface NoteVersion {
  version: number;
  content: string;
  rawData: string;
  updatedAt: number;
  blocks?: NoteBlock[];
}

export interface AudioData {
  url: string;
  script: string;
  style: 'concise' | 'detailed';
  voice: string;
  generatedAt: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  pageNumber?: number;
  pageImage?: string;
  noteId?: string;
  deckId?: string;
  progress?: CardProgress;
}

export interface FlashcardProgress {
  flashcardId: string;
  userId: string;
  noteId: string;
  reps: number;
  interval: number;
  easeFactor: number;
  dueDate: string;
  lastReviewed: string;
}

export interface NoteAudio {
  url: string;
  script: string;
  style: 'concise' | 'detailed';
  voice: string;
  generatedAt: string;
}

export interface SavedNote {
  id: string;
  noteId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'complete';
  tags: {
    primary: string;
    secondary?: string;
  };
  current: NoteVersion;
  history: NoteVersion[];
  files: FileMetadata[];
  audio?: {
    concise?: AudioData;
    detailed?: AudioData;
  };
  flashcards?: Flashcard[];
  sourceText?: string;
}

export interface FileStatus {
  id: string;
  fileName: string;
  status: 'idle' | 'generating' | 'done' | 'error';
  error?: string;
}

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
  writeInProgress: boolean;
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

export interface NoteBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet';
  content: string;
  level?: 1 | 2 | 3;
  items?: string[];
}

export interface FileMetadata {
  fileName: string;
  fileType: 'pdf' | 'audio' | 'video' | 'unknown';
  mimeType?: string;
  size?: number;
  totalPages?: number;
  duration?: number;
  fileUrl?: string;
  extractedTextKey?: string;
}

// --- NEW: Interface for card progress (matching Prisma model) ---
export interface CardProgress {
  id: string;
  cardId: string;
  userId: string;
  repetitions: number;
  easeFactor: number; // Stored as permille (e.g., 2500 for 2.5)
  interval: number;   // Stored in days (can be float)
  dueDate: string;    // ISO Date string (e.g., "2023-10-27T00:00:00.000Z")
  state: 'new' | 'learning' | 'review' | 'relearning';
  learningStep?: number;
  lastReviewDate?: string | null; // ISO Date string or null
}
// ----------------------------------------------------------------