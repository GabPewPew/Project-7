import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import FileUpload from './components/FileUpload';
import IntentSelector from './components/IntentSelector';
import NotesEditor from './components/NotesEditor';
import { FileMetadata } from './lib/detectFileTypes';
import { processPDF } from './lib/pdfProcessor';
import { transcribeMedia } from './lib/transcribeMedia';
import { mergeExtractedContent } from './lib/mergeExtractedContent';
import { ProcessingResult, ContentGroup, LearningIntent, ExamPrepStyle, ResearchStyle } from './types';
import { generateNotes } from './lib/geminiProcessor';
import { groupContentBySimilarity } from './lib/contentGrouping';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [contentGroups, setContentGroups] = useState<ContentGroup[]>([]);
  const [mergedContent, setMergedContent] = useState<string>('');
  const [aiNotes, setAiNotes] = useState<string>('');
  
  // Learning intent states
  const [selectedIntent, setSelectedIntent] = useState<LearningIntent>('exam_prep');
  const [examStyle, setExamStyle] = useState<ExamPrepStyle>('simple');
  const [researchStyle, setResearchStyle] = useState<ResearchStyle>('simple');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [detailLevel, setDetailLevel] = useState<1 | 2 | 3>(2);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ VITE_GEMINI_API_KEY is not set');
      setError('API key not configured');
    } else {
      console.log('✅ VITE_GEMINI_API_KEY is configured');
    }
  }, []);

  const handleFilesChange = (newFiles: File[], metadata: FileMetadata[]) => {
    setFiles(newFiles);
    setFileMetadata(metadata);
    setError(null);
    setResults([]);
    setContentGroups([]);
    setMergedContent('');
    setAiNotes('');
  };

  const handleGenerateNotes = async () => {
    if (files.length === 0) return;
    
    setProcessing(true);
    setError(null);
    setResults([]);
    setContentGroups([]);
    setMergedContent('');
    setAiNotes('');

    try {
      const processedResults = await Promise.all(
        files.map(async (file, index) => {
          const metadata = fileMetadata[index];
          
          if (metadata.fileType === 'pdf') {
            return await processPDF(file, metadata);
          }
          
          if (metadata.fileType === 'audio' || metadata.fileType === 'video') {
            const mediaResult = await transcribeMedia(file, metadata);
            return {
              fileName: mediaResult.fileName,
              type: mediaResult.type,
              content: mediaResult.transcript,
            };
          }
          
          return null;
        })
      );

      const validResults = processedResults.filter((result): result is ProcessingResult => 
        result !== null && 
        typeof result.content === 'string' && 
        result.content.trim().length > 0
      );

      if (validResults.length === 0) {
        throw new Error('No valid content was extracted from the files');
      }

      setResults(validResults);
      
      // Group content by similarity
      const groups = await groupContentBySimilarity(validResults);
      setContentGroups(groups);
      
      // Merge and format the content
      const merged = mergeExtractedContent(validResults);
      setMergedContent(merged);

      // Generate initial notes for the first group if available
      if (groups.length > 0 && groups[0].mergedContent) {
        await handleGenerateGroupNotes(groups[0]);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateGroupNotes = async (group: ContentGroup) => {
    if (!group || typeof group.mergedContent !== 'string' || !group.mergedContent.trim()) {
      console.error('Invalid group content:', group);
      setError('Invalid group content');
      return;
    }

    try {
      console.log('🔄 Generating notes for group:', group.groupTitle);
      const geminiResponse = await generateNotes({
        content: group.mergedContent,
        intent: selectedIntent,
        style: selectedIntent === 'exam_prep' ? examStyle : researchStyle,
        customPrompt: selectedIntent === 'custom' ? customPrompt : undefined,
        detailLevel,
        primary: group.primary,
        secondary: group.secondary
      });

      if (typeof geminiResponse.notes === 'string' && geminiResponse.notes.trim()) {
        setAiNotes(geminiResponse.notes);
        setError(null);
      } else {
        throw new Error('Generated notes are empty or invalid');
      }
    } catch (error) {
      console.error('❌ Failed to generate group notes:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate notes');
    }
  };

  const handleNotesChange = (newNotes: string) => {
    setAiNotes(newNotes);
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    // TODO: Implement export functionality
    console.log(`Exporting as ${format}...`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Learning Notes Generator
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload your PDFs, audio, or video files and let AI transform them into
            structured learning notes. Perfect for studying, research, or quick content digestion.
          </p>
        </div>

        <FileUpload onFilesChange={handleFilesChange} />

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-8 space-y-6">
            <IntentSelector
              selectedIntent={selectedIntent}
              examStyle={examStyle}
              researchStyle={researchStyle}
              customPrompt={customPrompt}
              onIntentChange={setSelectedIntent}
              onExamStyleChange={setExamStyle}
              onResearchStyleChange={setResearchStyle}
              onCustomPromptChange={setCustomPrompt}
            />

            <div className="text-center">
              <button
                onClick={handleGenerateNotes}
                disabled={processing}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 
                  transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Generate Notes'}
              </button>
            </div>
          </div>
        )}

        {contentGroups.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Content Groups</h2>
            <div className="space-y-6">
              {contentGroups.map((group, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {group.groupTitle}
                      </h3>
                      {group.secondary && (
                        <p className="text-sm text-gray-500">
                          Related to: {group.secondary}
                        </p>
                      )}
                    </div>
                    {group.files.length > 1 && (
                      <button
                        onClick={() => handleGenerateGroupNotes(group)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Generate Notes for Group
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.files.map((file, fileIndex) => (
                      <div
                        key={fileIndex}
                        className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded"
                      >
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiNotes && (
          <div className="mt-8">
            <NotesEditor
              notes={aiNotes}
              onNotesChange={handleNotesChange}
              onExport={handleExport}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;