import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { SavedNote, FileStatus } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  savedNotes: Record<string, SavedNote>;
  currentNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onHomeClick: () => void;
  fileStatuses: FileStatus[];
}

export default function Layout({
  children,
  savedNotes,
  currentNoteId,
  onNoteSelect,
  onDeleteNote,
  onHomeClick,
  fileStatuses
}: LayoutProps) {
  // Start with sidebar open by default
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hamburger menu - always visible in top-left */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:bg-gray-50 
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="h-6 w-6 text-gray-700" />
        <span className="sr-only">Toggle navigation</span>
      </button>

      {/* Backdrop overlay - only on small screens */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity sm:hidden z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        savedNotes={savedNotes}
        currentNoteId={currentNoteId}
        onNoteSelect={(noteId) => {
          onNoteSelect(noteId);
          // Don't auto-close sidebar on selection
        }}
        onDeleteNote={onDeleteNote}
        onHomeClick={() => {
          onHomeClick();
          // Don't auto-close sidebar on home click
        }}
        isOpen={isSidebarOpen}
        fileStatuses={fileStatuses}
      />

      {/* Main content area */}
      <main
        className={`min-h-screen transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'pl-64' : 'pl-0'} pt-16`}
      >
        <div className="container mx-auto max-w-4xl px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}