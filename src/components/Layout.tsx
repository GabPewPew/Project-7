import React, { useState } from 'react';
import { Menu, Sparkles, ChevronLeft } from 'lucide-react';
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
  toolsContent?: React.ReactNode;
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
  fileStatuses,
  toolsContent
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar toggle button - always visible when sidebar is closed */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white hover:bg-gray-100 transition-colors shadow-sm"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5 text-gray-700" />
        </button>
      )}

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity lg:hidden z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed lg:relative inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full w-0 lg:w-20'}`}
      >
        {/* Sidebar inner container - handles background and overflow */}
        <div className={`h-full bg-gray-100 flex flex-col transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-72' : 'w-0 lg:w-20 overflow-hidden'}`}
        >
          {/* Header */}
          <div className="flex items-center h-16 px-4 bg-gray-200 shrink-0">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-gray-300 transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarOpen ? (
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              ) : (
                <Menu className="h-5 w-5 text-gray-700" />
              )}
            </button>
            {isSidebarOpen && (
              <div className="flex items-center ml-3 transition-opacity duration-200">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="ml-2 font-medium text-gray-900">7P</span>
              </div>
            )}
          </div>

          {/* Sidebar content */}
          {isSidebarOpen && (
            <Sidebar
              savedNotes={savedNotes}
              currentNoteId={currentNoteId}
              currentView={currentView}
              onNoteSelect={onNoteSelect}
              onDeleteNote={onDeleteNote}
              onHomeClick={onHomeClick}
              onAllNotesClick={onAllNotesClick}
              isOpen={true}
              fileStatuses={fileStatuses}
            />
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center panel */}
          <div className="flex-1 flex flex-col items-center overflow-y-auto bg-white">
            <div className="w-full max-w-5xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6">
              {children}
            </div>
          </div>

          {/* Right panel - only show when viewing a note */}
          {currentView === 'note' && currentNoteId && (
            <div className="hidden lg:block w-80 border-l border-gray-100 bg-white overflow-y-auto">
              <div className="p-4 sticky top-0">
                <h3 className="font-medium text-gray-900 mb-4">Tools</h3>
                {toolsContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}