import React from 'react';
import { Home, FileText, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { SavedNote, FileStatus } from '../types';

interface SidebarProps {
  savedNotes: Record<string, SavedNote>;
  currentNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onHomeClick: () => void;
  isOpen: boolean;
  fileStatuses: FileStatus[];
}

export default function Sidebar({
  savedNotes,
  currentNoteId,
  onNoteSelect,
  onDeleteNote,
  onHomeClick,
  isOpen,
  fileStatuses
}: SidebarProps) {
  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Sidebar content - start below hamburger */}
      <div className="flex flex-col h-full pt-16">
        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto p-4">
          {/* Home button */}
          <button
            onClick={onHomeClick}
            className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg
              transition-colors duration-150 ${
                !currentNoteId
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Home className="w-5 h-5 mr-2.5" />
            Home
          </button>

          {/* Processing Files */}
          {fileStatuses.length > 0 && (
            <div className="mt-6 space-y-1">
              <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Processing
              </h3>
              {fileStatuses.map(status => (
                <div
                  key={status.id}
                  className={`flex items-center px-4 py-2.5 text-sm rounded-lg 
                    ${status.status === 'error' ? 'bg-red-50 text-red-700' : 'text-gray-600'}`}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    {status.status === 'generating' ? (
                      <Loader2 className="w-4 h-4 mr-2.5 animate-spin flex-shrink-0 text-blue-600" />
                    ) : status.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 mr-2.5 flex-shrink-0 text-red-600" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2.5 flex-shrink-0" />
                    )}
                    <span className="truncate">{status.fileName}</span>
                  </div>
                  <span className="ml-2 text-xs">
                    {status.status === 'generating' && 'Processing...'}
                    {status.status === 'error' && 'Failed'}
                    {status.status === 'idle' && 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Notes list */}
          <div className="mt-6 space-y-1">
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Saved Notes
            </h3>
            {Object.values(savedNotes)
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(note => (
                <div
                  key={note.id}
                  className={`group flex items-center justify-between px-4 py-2.5 text-sm rounded-lg 
                    transition-colors duration-150 ${
                      note.content
                        ? 'cursor-pointer hover:bg-gray-100'
                        : 'opacity-60 cursor-not-allowed'
                    } ${
                      currentNoteId === note.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700'
                    }`}
                  onClick={() => {
                    if (note.content) {
                      onNoteSelect(note.id);
                    }
                  }}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <FileText className="w-4 h-4 mr-2.5 flex-shrink-0" />
                    <span className="truncate">{note.fileName}</span>
                  </div>
                  {note.content && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 
                        transition-opacity duration-200 ${
                          currentNoteId === note.id
                            ? 'text-blue-700 hover:bg-blue-100'
                            : 'text-gray-500 hover:bg-gray-200'
                        }`}
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}