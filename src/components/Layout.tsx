import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SavedNote, FileStatus } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  savedNotes: Record<string, SavedNote>;
  currentNoteId: string | null;
  currentView: 'home' | 'note' | 'all-notes';
  onNoteSelect: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onHomeClick: () => void;
  onAllNotesClick: () => void;
  fileStatuses: FileStatus[];
}

export function Layout({
  children,
  savedNotes,
  currentNoteId,
  currentView,
  onNoteSelect,
  onDeleteNote,
  onHomeClick,
  onAllNotesClick,
  fileStatuses
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50">
      <button
        type="button"
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:bg-gray-50 
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="h-6 w-6 text-gray-700" />
        <span className="sr-only">Toggle navigation</span>
      </button>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity sm:hidden z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        savedNotes={savedNotes}
        currentNoteId={currentNoteId}
        currentView={currentView}
        onNoteSelect={onNoteSelect}
        onDeleteNote={onDeleteNote}
        onHomeClick={onHomeClick}
        onAllNotesClick={onAllNotesClick}
        isOpen={isSidebarOpen}
        fileStatuses={fileStatuses}
      />

      <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {children}
      </main>
    </div>
  );
}

export default Layout