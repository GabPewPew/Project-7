import React from 'react';
import { Home, FileText, BookOpen, Settings, Menu, X, Layers, Star, File, Trash2 } from 'lucide-react';
import { SavedNote, FileStatus } from '../types';

interface SidebarProps {
  savedNotes: Record<string, SavedNote>;
  currentNoteId: string | null;
  currentView: 'home' | 'note' | 'all-notes' | 'all-my-cards' | 'flashcard-review';
  onNoteSelect: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onHomeClick: () => void;
  onAllNotesClick: () => void;
  onAllMyCardsClick: () => void;
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
  onAllMyCardsClick,
  isOpen,
  fileStatuses
}: SidebarProps) {
  const sortedNotes = Object.values(savedNotes).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleDeleteClick = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDeleteNote(noteId);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 overflow-hidden">
      {/* Main navigation */}
      <nav className="flex-grow overflow-y-auto bg-gray-100">
        <ul className="space-y-1 p-2">
          <li>
            <a href="#" onClick={(e) => { e.preventDefault(); onHomeClick(); }} 
               className={`flex items-center p-3 rounded-lg transition-colors ${currentView === 'home' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'}`}>
              <Home size={20} className="flex-shrink-0" />
              {isOpen && <span className="ml-3">Home</span>}
            </a>
          </li>
          <li>
            <a href="#" onClick={(e) => { e.preventDefault(); onAllNotesClick(); }} 
               className={`flex items-center p-3 rounded-lg transition-colors ${currentView === 'all-notes' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'}`}>
              <FileText size={20} className="flex-shrink-0" />
              {isOpen && <span className="ml-3">All Notes</span>}
            </a>
          </li>
          <li>
            <a href="#" onClick={(e) => { e.preventDefault(); onAllMyCardsClick(); }} 
               className={`flex items-center p-3 rounded-lg transition-colors ${currentView === 'all-my-cards' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'}`}>
              <Layers size={20} className="flex-shrink-0" />
              {isOpen && <span className="ml-3">All My Cards</span>}
            </a>
          </li>
        </ul>

        {isOpen && (
          <>
            <h3 className="px-4 pt-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Notes</h3>
            <ul className="space-y-1 p-2">
              {sortedNotes.slice(0, 10).map(note => (
                <li key={note.noteId} className="relative group">
                  <a href="#" onClick={(e) => { e.preventDefault(); onNoteSelect(note.noteId); }}
                     className={`block w-full text-left p-3 rounded-lg transition-colors text-sm truncate ${currentNoteId === note.noteId && currentView === 'note' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-700'}`}>
                    {note.title || 'Untitled Note'}
                  </a>
                  <button 
                    onClick={(e) => handleDeleteClick(e, note.noteId)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 rounded-full hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                    title="Delete Note"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </div>
  );
}