import React from 'react';
import { Volume2, X } from 'lucide-react';

interface AudioGenerateModalProps {
  onClose: () => void;
  onGenerate: (style: 'concise' | 'detailed') => void;
  isGenerating: boolean;
}

export function AudioGenerateModal({ onClose, onGenerate, isGenerating }: AudioGenerateModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Generate Audio Lecture</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          Choose a lecture style for your audio generation. The voice will be set to "en-US-Studio-O" for optimal clarity.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => onGenerate('concise')}
            disabled={isGenerating}
            className="w-full p-4 text-left border rounded-lg hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <h3 className="font-medium text-gray-900 mb-1">Concise Lecture</h3>
            <p className="text-sm text-gray-600">
              A quick 10-minute overview of key concepts, perfect for quick review or introduction to the topic.
            </p>
          </button>

          <button
            onClick={() => onGenerate('detailed')}
            disabled={isGenerating}
            className="w-full p-4 text-left border rounded-lg hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <h3 className="font-medium text-gray-900 mb-1">Detailed Lecture</h3>
            <p className="text-sm text-gray-600">
              A comprehensive 30-40 minute lecture covering all aspects in depth, ideal for thorough learning.
            </p>
          </button>
        </div>

        {isGenerating && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Generating audio lecture... This may take a few minutes.
          </div>
        )}
      </div>
    </div>
  );
}