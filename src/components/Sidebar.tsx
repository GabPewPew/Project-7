import React from 'react';
import { Home, FileText, Loader2, Trash2, AlertCircle, Library } from 'lucide-react';
import { SavedNote, FileStatus } from '../types';

interface SidebarProps {
  savedNotes: Record<string, SavedNote>;
  currentNoteId: string | null;
  currentView: 'home' | 'note' | 'all-notes';
  onNoteSelect: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onHomeClick: () => void;
  onAllNotesClick: () => void;
  isOpen: boolean;
  fileStatuses: FileStatus[];
}

export function Sidebar({
  savedNotes,
  currentNoteId,
  currentView,
  onNoteSelect,
  onDeleteNote,
  onHomeClick,
  onAllNotesClick,
  fileStatuses
}: SidebarProps) {
  const handleDeleteClick = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDeleteNote(noteId);
    }
  };

  return (
    <nav className="flex-1 overflow-y-auto p-4">
      <button
        onClick={onHomeClick}
        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg
          transition-colors duration-150 ${
            currentView === 'home'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
      >
        <Home className="w-5 h-5 mr-2" />
        Home
      </button>

      <button
        onClick={onAllNotesClick}
        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg mt-2
          transition-colors duration-150 ${
            currentView === 'all-notes'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
      >
        <Library className="w-5 h-5 mr-2" />
        All Notes
      </button>

      {fileStatuses.length > 0 && (
        <div className="mt-6">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Processing
          </h3>
          <div className="space-y-1">
            {fileStatuses.map(status => (
              <div
                key={status.id}
                className={`flex items-center px-3 py-2 text-sm rounded-lg 
                  ${status.status === 'error' ? 'text-red-700 bg-red-50' : 'text-gray-700'}`}
              >
                <div className="flex items-center min-w-0 flex-1">
                  {status.status === 'generating' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                  ) : status.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 mr-2 text-red-600" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  <span className="truncate">{status.fileName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Recent Notes
        </h3>
        <div className="space-y-1">
          {Object.values(savedNotes)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5)
            .map(note => (
              <div
                key={note.noteId}
                onClick={() => onNoteSelect(note.noteId)}
                className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg 
                  cursor-pointer hover:bg-gray-200 transition-colors duration-150
                  ${currentNoteId === note.noteId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {note.title || note.files[0]?.fileName || "Untitled Note"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      Version {note.current.version} • {new Date(note.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteClick(e, note.noteId)}
                  className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 
                    transition-opacity duration-200 ${
                      currentNoteId === note.noteId
                        ? 'text-blue-700 hover:bg-blue-100'
                        : 'text-gray-500 hover:bg-gray-300'
                    }`}
                  aria-label="Delete note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </nav>
  );
}