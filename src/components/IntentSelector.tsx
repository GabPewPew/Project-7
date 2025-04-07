import React from 'react';
import { BookOpen, GraduationCap, Brain, Settings } from 'lucide-react';
import { LearningIntent, ExamPrepStyle, ResearchStyle } from '../types';

interface IntentSelectorProps {
  selectedIntent: LearningIntent;
  examStyle: ExamPrepStyle;
  researchStyle: ResearchStyle;
  customPrompt: string;
  onIntentChange: (intent: LearningIntent) => void;
  onExamStyleChange: (style: ExamPrepStyle) => void;
  onResearchStyleChange: (style: ResearchStyle) => void;
  onCustomPromptChange: (prompt: string) => void;
}

export default function IntentSelector({
  selectedIntent,
  examStyle,
  researchStyle,
  customPrompt,
  onIntentChange,
  onExamStyleChange,
  onResearchStyleChange,
  onCustomPromptChange,
}: IntentSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Learning Intent</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            onClick={() => onIntentChange('exam_prep')}
            className={`flex items-center justify-center px-4 py-3 border rounded-lg ${
              selectedIntent === 'exam_prep'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <GraduationCap className="w-5 h-5 mr-2" />
            Exam Prep
          </button>
          <button
            onClick={() => onIntentChange('research')}
            className={`flex items-center justify-center px-4 py-3 border rounded-lg ${
              selectedIntent === 'research'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Brain className="w-5 h-5 mr-2" />
            Research
          </button>
          <button
            onClick={() => onIntentChange('custom')}
            className={`flex items-center justify-center px-4 py-3 border rounded-lg ${
              selectedIntent === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-5 h-5 mr-2" />
            Custom
          </button>
        </div>
      </div>

      {selectedIntent === 'exam_prep' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Exam Prep Style</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => onExamStyleChange('simple')}
              className={`px-4 py-2 border rounded-lg ${
                examStyle === 'simple'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Simple & Concise
            </button>
            <button
              onClick={() => onExamStyleChange('detailed')}
              className={`px-4 py-2 border rounded-lg ${
                examStyle === 'detailed'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => onExamStyleChange('deep_dive')}
              className={`px-4 py-2 border rounded-lg ${
                examStyle === 'deep_dive'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Deep Dive
            </button>
          </div>
        </div>
      )}

      {selectedIntent === 'research' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Research Style</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => onResearchStyleChange('simple')}
              className={`px-4 py-2 border rounded-lg ${
                researchStyle === 'simple'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Simple & Easy
            </button>
            <button
              onClick={() => onResearchStyleChange('comprehensive')}
              className={`px-4 py-2 border rounded-lg ${
                researchStyle === 'comprehensive'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              Deep Dive & Comprehensive
            </button>
          </div>
        </div>
      )}

      {selectedIntent === 'custom' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Custom Instructions</h3>
          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Enter your custom instructions for the AI..."
            className="w-full h-32 px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}
    </div>
  );
}