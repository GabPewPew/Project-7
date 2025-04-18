import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Save, X, FileText } from 'lucide-react';
import { Flashcard } from '../types';

interface FlashcardPreviewProps {
  flashcards: Flashcard[];
  onSave: (flashcards: Flashcard[]) => void;
}

export function FlashcardPreview({ flashcards, onSave }: FlashcardPreviewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Flashcard>({ front: '', back: '' });
  const [localFlashcards, setLocalFlashcards] = useState<Flashcard[]>(flashcards);

  // Update local flashcards when the prop changes
  useEffect(() => {
    setLocalFlashcards(flashcards);
  }, [flashcards]);

  // Start editing a flashcard
  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValues({
      ...localFlashcards[index]
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  // Save edits to a flashcard
  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const updatedFlashcards = [...localFlashcards];
    updatedFlashcards[editingIndex] = { ...editValues };
    setLocalFlashcards(updatedFlashcards);
    onSave(updatedFlashcards);
    setEditingIndex(null);
  };

  // Delete a flashcard
  const handleDelete = (index: number) => {
    const updatedFlashcards = [...localFlashcards];
    updatedFlashcards.splice(index, 1);
    setLocalFlashcards(updatedFlashcards);
    onSave(updatedFlashcards);
  };

  return (
    <div className="space-y-4 mt-4 max-h-[550px] overflow-y-auto pr-1">
      {localFlashcards.map((card, index) => (
        <div 
          key={index} 
          className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          {editingIndex === index ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Question (Front)
                </label>
                <textarea
                  value={editValues.front}
                  onChange={(e) => setEditValues({ ...editValues, front: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-sm min-h-[60px] focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Answer (Back)
                </label>
                <textarea
                  value={editValues.back}
                  onChange={(e) => setEditValues({ ...editValues, back: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-sm min-h-[60px] focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Page number input - only show if pageNumber exists in the card */}
              {(card.pageNumber !== undefined || editValues.pageNumber !== undefined) && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Page Number (Optional)
                  </label>
                  <input
                    type="number"
                    value={editValues.pageNumber || ''}
                    onChange={(e) => setEditValues({ 
                      ...editValues, 
                      pageNumber: e.target.value ? Number(e.target.value) : undefined 
                    })}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Page number"
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-800 mb-2">
                    {card.front}
                  </div>
                  <div className="text-sm text-gray-600 border-t border-gray-100 pt-2">
                    {card.back}
                  </div>
                  
                  {card.pageNumber && (
                    <div className="mt-2 pt-1 flex items-center text-xs text-gray-500">
                      <FileText className="w-3 h-3 mr-1" />
                      Page {card.pageNumber}
                      
                      {card.pageImage && (
                        <div className="ml-2 inline-block">
                          <img 
                            src={card.pageImage} 
                            alt={`Page ${card.pageNumber} thumbnail`}
                            className="w-6 h-6 object-cover rounded border border-gray-200"
                            title={`Preview of page ${card.pageNumber}`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => handleEdit(index)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      {localFlashcards.length === 0 && (
        <div className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg border border-gray-200">
          No flashcards available
        </div>
      )}
    </div>
  );
} 