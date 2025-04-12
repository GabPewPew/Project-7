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
  files: {
    fileName: string;
    fileUrl?: string;
  }[];
  audio?: {
    concise?: AudioData;
    detailed?: AudioData;
  };
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