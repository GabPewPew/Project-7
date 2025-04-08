import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File as FileIcon, X } from 'lucide-react';
import { processFiles, FileMetadata, FileValidationError } from '../lib/detectFileTypes';

interface FileUploadProps {
  onFilesChange: (files: File[], metadata: FileMetadata[]) => void;
}

export default function FileUpload({ onFilesChange }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<FileMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    try {
      if (files.length + acceptedFiles.length > 3) {
        throw new FileValidationError('You can only upload up to 3 files');
      }

      const newFiles = [...files, ...acceptedFiles];
      const newMetadata = processFiles(newFiles);

      setFiles(newFiles);
      setMetadata(newMetadata);
      setError(null);
      onFilesChange(newFiles, newMetadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing files');
    }
  }, [files, onFilesChange]);

  const removeFile = (index: number) => {
    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      newFiles.splice(index, 1);
      
      try {
        const newMetadata = processFiles(newFiles);
        setMetadata(newMetadata);
        setError(null);
        onFilesChange(newFiles, newMetadata);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while processing files');
      }
      
      return newFiles;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'text/*': ['.txt', '.md']
    },
    maxFiles: 3
  });

  return (
    <div className="w-full max-w-3xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {files.length === 0 ? (
        <div
          {...getRootProps()}
          className={`border-3 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 scale-102' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-16 h-16 mx-auto mb-6 text-gray-400" />
          <p className="text-xl font-medium mb-2">Drag & drop up to 3 files here</p>
          <p className="text-sm text-gray-500">
            Supported formats: PDF, Audio (MP3, WAV), Video (MP4, MOV), Text files
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {metadata.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{file.fileName}</p>
                  <p className="text-sm text-gray-500">
                    {file.size} MB • {file.fileType.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Remove file"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}