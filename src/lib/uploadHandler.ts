import { FileWithPath } from "@uploadthing/react";

export interface UploadResponse {
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface UploadError {
  message: string;
  code: string;
}

export const validateFileType = (file: FileWithPath): boolean => {
  const allowedTypes = {
    'application/pdf': true,
    'audio/mpeg': true,
    'audio/wav': true,
    'audio/mp4': true,
    'video/mp4': true,
    'video/mpeg': true,
    'video/quicktime': true,
    'text/plain': true,
    'text/markdown': true
  };

  return !!allowedTypes[file.type];
};

export const validateFileSize = (file: FileWithPath): boolean => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  return file.size <= MAX_FILE_SIZE;
};