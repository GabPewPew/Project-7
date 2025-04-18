import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface FlashcardModalProps {
  flashcards: Array<{ front: string; back: string }>;
  onClose: () => void;
}

export function FlashcardModal({ flashcards, onClose }: FlashcardModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            Flashcard {currentIndex + 1} of {flashcards.length}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div 
          className="relative min-h-[300px] bg-gray-50 rounded-lg p-6 mb-6 cursor-pointer select-none"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className="flex items-center justify-center h-full">
            <p className="text-lg text-center">
              {isFlipped ? flashcards[currentIndex].back : flashcards[currentIndex].front}
            </p>
          </div>
          <div className="absolute bottom-2 right-2 text-sm text-gray-400">
            Click to flip
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <div className="text-sm text-gray-500">
            {currentIndex + 1} / {flashcards.length}
          </div>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}