import { FileWithPath } from '@uploadthing/react';

export interface FileMetadata {
  fileName: string;
  fileType: 'pdf' | 'audio' | 'video' | 'text' | 'unknown';
  size: number;
  previewUrl?: string;
  mimeType: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export function detectFileType(file: File): FileMetadata['fileType'] {
  const extension = file.name.toLowerCase().split('.').pop();

  if (!extension) return 'unknown';

  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'mp3':
    case 'wav':
    case 'm4a':
      return 'audio';
    case 'mp4':
    case 'mov':
    case 'avi':
      return 'video';
    case 'txt':
    case 'md':
      return 'text';
    default:
      return 'unknown';
  }
}

export function validateFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `File "${file.name}" exceeds maximum size of 50MB`
    );
  }
}

export function validateFileType(file: File): void {
  const type = detectFileType(file);
  if (type === 'unknown') {
    throw new FileValidationError(
      `File "${file.name}" has an unsupported file type`
    );
  }
}

export function processFiles(files: File[]): FileMetadata[] {
  if (files.length > 3) {
    throw new FileValidationError('Maximum of 3 files allowed');
  }

  return files.map(file => {
    validateFileSize(file);
    validateFileType(file);

    return {
      fileName: file.name,
      fileType: detectFileType(file),
      size: Number((file.size / (1024 * 1024)).toFixed(2)), // Size in MB
      mimeType: file.type,
      previewUrl: URL.createObjectURL(file)
    };
  });
}