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
  showControls: boolean;
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
  showControls
}: IntentSelectorProps) {
  if (!showControls) return null;

  return (
    <div className="space-y-8 max-w-3xl mx-auto mt-12">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">Select Learning Intent</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            onClick={() => onIntentChange('exam_prep')}
            className={`flex items-center justify-center px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
              selectedIntent === 'exam_prep'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <GraduationCap className="w-6 h-6 mr-3" />
            <span className="font-medium">Exam Prep</span>
          </button>
          <button
            onClick={() => onIntentChange('research')}
            className={`flex items-center justify-center px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
              selectedIntent === 'research'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Brain className="w-6 h-6 mr-3" />
            <span className="font-medium">Research</span>
          </button>
          <button
            onClick={() => onIntentChange('custom')}
            className={`flex items-center justify-center px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
              selectedIntent === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-6 h-6 mr-3" />
            <span className="font-medium">Custom</span>
          </button>
        </div>
      </div>

      {selectedIntent === 'exam_prep' && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">Exam Prep Style</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={() => onExamStyleChange('simple')}
              className={`px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
                examStyle === 'simple'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <p className="font-medium">Simple & Concise</p>
              <p className="text-sm text-gray-500 mt-2">Quick, memorable points</p>
            </button>
            <button
              onClick={() => onExamStyleChange('detailed')}
              className={`px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
                examStyle === 'detailed'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <p className="font-medium">Detailed</p>
              <p className="text-sm text-gray-500 mt-2">Comprehensive coverage</p>
            </button>
            <button
              onClick={() => onExamStyleChange('deep_dive')}
              className={`px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
                examStyle === 'deep_dive'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <p className="font-medium">Deep Dive</p>
              <p className="text-sm text-gray-500 mt-2">Expert-level analysis</p>
            </button>
          </div>
        </div>
      )}

      {selectedIntent === 'research' && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">Research Style</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => onResearchStyleChange('simple')}
              className={`px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
                researchStyle === 'simple'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <p className="font-medium">Simple & Easy</p>
              <p className="text-sm text-gray-500 mt-2">Clear research summary</p>
            </button>
            <button
              onClick={() => onResearchStyleChange('comprehensive')}
              className={`px-6 py-4 border-2 rounded-xl transition-all duration-200 ${
                researchStyle === 'comprehensive'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <p className="font-medium">Deep Dive & Comprehensive</p>
              <p className="text-sm text-gray-500 mt-2">Detailed analysis</p>
            </button>
          </div>
        </div>
      )}

      {selectedIntent === 'custom' && (
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">Custom Instructions</h3>
          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Enter your custom instructions for the AI..."
            className="w-full h-32 px-4 py-3 border-2 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      )}
    </div>
  );
}