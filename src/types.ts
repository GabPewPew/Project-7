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
  groupId: string;
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
}

export interface GeminiResponse {
  notes: string;
  mnemonics?: string[];
  error?: string;
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