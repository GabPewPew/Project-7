import React from 'react';
import { FileText, Download } from 'lucide-react';

interface NotesEditorProps {
  noteId: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onExport: (format: 'pdf' | 'docx') => void;
  isLoading?: boolean;
}

export default function NotesEditor({ noteId, notes, onExport, isLoading }: NotesEditorProps) {
  // Early return for loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <p className="text-gray-500">Loading notes...</p>
      </div>
    );
  }

  // Early return for empty content
  if (!notes?.trim()) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <p className="text-gray-500">No notes generated yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Raw Note Content</h3>
          <span className="ml-2 text-sm text-gray-500">
            {notes.length} characters
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onExport('pdf')}
            className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg 
                     hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4 mr-1.5" />
            PDF
          </button>
          <button
            onClick={() => onExport('docx')}
            className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg 
                     hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4 mr-1.5" />
            DOCX
          </button>
        </div>
      </div>

      <div className="p-6">
        <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded-lg">
          {notes}
        </pre>
      </div>
    </div>
  );
}