import React from 'react';
import { FileText, Calendar, Tag, File } from 'lucide-react';
import { SavedNote } from '../types';

interface AllNotesPageProps {
  savedNotes: Record<string, SavedNote>;
  onNoteSelect: (noteId: string) => void;
}

export function AllNotesPage({ savedNotes, onNoteSelect }: AllNotesPageProps) {
  const sortedNotes = Object.values(savedNotes).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">All Notes</h1>
        <p className="text-gray-600 mt-2">
          {sortedNotes.length} note{sortedNotes.length !== 1 ? 's' : ''} total
        </p>
      </div>

      <div className="grid gap-4">
        {sortedNotes.map(note => (
          <div
            key={note.noteId}
            onClick={() => onNoteSelect(note.noteId)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {note.title || note.files[0]?.fileName || "Untitled Note"}
                </h3>
                
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(note.updatedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Version {note.current.version}</span>
                  </div>
                </div>

                {note.tags.primary && (
                  <div className="mt-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {note.tags.primary}
                    </span>
                    {note.tags.secondary && (
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {note.tags.secondary}
                      </span>
                    )}
                  </div>
                )}

                {note.files.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <File className="w-4 h-4" />
                    <span className="truncate">
                      {note.files.map(f => f.fileName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}