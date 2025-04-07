import React from 'react';
import { FileText, Download } from 'lucide-react';

interface NotesEditorProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  onExport: (format: 'pdf' | 'docx') => void;
  renderMarkdown: (markdown: string) => React.ReactNode[];
}

export default function NotesEditor({ notes, onNotesChange, onExport, renderMarkdown }: NotesEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Generated Notes</h3>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            {isEditing ? 'Preview' : 'Edit'}
          </button>
          <div className="flex space-x-2">
            <button
              onClick={() => onExport('pdf')}
              className="flex items-center px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </button>
            <button
              onClick={() => onExport('docx')}
              className="flex items-center px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              <Download className="w-4 h-4 mr-1" />
              DOCX
            </button>
          </div>
        </div>
      </div>
      <div className="p-6">
        {isEditing ? (
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full h-[500px] px-4 py-3 text-gray-700 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your generated notes will appear here..."
          />
        ) : (
          <div className="prose max-w-none">
            {renderMarkdown(notes)}
          </div>
        )}
      </div>
    </div>
  );
}