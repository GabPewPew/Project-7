import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import FileUpload from './components/FileUpload';
import IntentSelector from './components/IntentSelector';
import NotesEditor from './components/NotesEditor';
import { FileMetadata } from './lib/detectFileTypes';
import { processPDF } from './lib/pdfProcessor';
import { transcribeMedia } from './lib/transcribeMedia';
import { ProcessingResult, LearningIntent, ExamPrepStyle, ResearchStyle, SavedNote, FileStatus } from './types';
import { generateNotes } from './lib/geminiProcessor';
import { checkForDuplicateNotes, validateContent } from './lib/contentValidation';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [savedNotes, setSavedNotes] = useState<Record<string, SavedNote>>({});
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  
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
    setCurrentNoteId(null);
    setSavedNotes({});
    
    // Initialize file statuses with unique IDs
    const newFileStatuses = metadata.map(meta => ({
      id: `file_${Date.now()}_${meta.fileName.replace(/\s+/g, '_')}`,
      fileName: meta.fileName,
      status: 'idle' as const
    }));
    setFileStatuses(newFileStatuses);
  };

  const generateNoteForFile = async (result: ProcessingResult, fileStatus: FileStatus) => {
    try {
      console.log(`🔄 Processing file: ${result.fileName}`);
      
      // Validate content length
      if (!validateContent(result.content, result.fileName)) {
        throw new Error('Content too short or invalid');
      }

      // Update status to generating
      setFileStatuses(prev => 
        prev.map(fs => 
          fs.id === fileStatus.id 
            ? { ...fs, status: 'generating', error: undefined }
            : fs
        )
      );

      // Generate notes using Gemini
      const geminiResponse = await generateNotes({
        content: result.content,
        intent: selectedIntent,
        style: selectedIntent === 'exam_prep' ? examStyle : researchStyle,
        customPrompt: selectedIntent === 'custom' ? customPrompt : undefined,
        detailLevel,
        primary: result.type,
        secondary: undefined,
        fileId: fileStatus.id,
        fileName: result.fileName
      });

      if (!geminiResponse.notes) {
        throw new Error('No notes generated');
      }

      // Check for duplicate content
      if (checkForDuplicateNotes(geminiResponse.notes, savedNotes, result.fileName)) {
        throw new Error('Duplicate content detected');
      }

      // Create a unique note ID using timestamp and filename
      const noteId = `note_${Date.now()}_${result.fileName.replace(/\s+/g, '_')}`;
      console.log(`📝 Creating note with ID: ${noteId}`);

      // Save the new note
      setSavedNotes(prev => {
        const newNotes = {
          ...prev,
          [noteId]: {
            id: noteId,
            content: geminiResponse.notes,
            fileName: result.fileName,
            timestamp: Date.now(),
            primary: result.type,
            secondary: undefined
          }
        };
        console.log(`💾 Saved notes count: ${Object.keys(newNotes).length}`);
        return newNotes;
      });

      // Update file status to done
      setFileStatuses(prev => 
        prev.map(fs => 
          fs.id === fileStatus.id 
            ? { ...fs, status: 'done' }
            : fs
        )
      );

      // Set as current note if it's the first one
      if (!currentNoteId) {
        setCurrentNoteId(noteId);
      }

      return noteId;
    } catch (error) {
      console.error(`❌ Failed to generate notes for ${result.fileName}:`, error);
      
      // Update file status to error
      setFileStatuses(prev => 
        prev.map(fs => 
          fs.id === fileStatus.id 
            ? { 
                ...fs, 
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to generate notes'
              }
            : fs
        )
      );

      return null;
    }
  };

  const handleGenerateNotes = async () => {
    if (files.length === 0) return;
    
    setProcessing(true);
    setError(null);

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

      // Generate notes for each file sequentially
      for (const result of validResults) {
        const fileStatus = fileStatuses.find(fs => fs.fileName === result.fileName);
        if (fileStatus) {
          await generateNoteForFile(result, fileStatus);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleNotesChange = (newNotes: string) => {
    if (currentNoteId && savedNotes[currentNoteId]) {
      setSavedNotes(prev => ({
        ...prev,
        [currentNoteId]: {
          ...prev[currentNoteId],
          content: newNotes
        }
      }));
    }
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
              showControls={!processing}
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

        {/* File Status List */}
        {fileStatuses.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Processing Status</h2>
            <div className="space-y-2">
              {fileStatuses.map(status => (
                <div
                  key={status.id}
                  className={`p-4 rounded-lg border ${
                    status.status === 'done'
                      ? 'bg-green-50 border-green-200'
                      : status.status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : status.status === 'generating'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{status.fileName}</span>
                    <span className="text-sm">
                      {status.status === 'done' && '✅ Complete'}
                      {status.status === 'generating' && '🔄 Generating...'}
                      {status.status === 'error' && '❌ Error'}
                      {status.status === 'idle' && '⏳ Waiting'}
                    </span>
                  </div>
                  {status.error && (
                    <p className="text-sm text-red-600 mt-2">{status.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes List */}
        {Object.keys(savedNotes).length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Generated Notes</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.values(savedNotes).map(note => (
                <button
                  key={note.id}
                  onClick={() => setCurrentNoteId(note.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    currentNoteId === note.id
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{note.fileName}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(note.timestamp).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Note Editor */}
        {currentNoteId && savedNotes[currentNoteId] && (
          <div className="mt-8">
            <NotesEditor
              key={currentNoteId}
              noteId={currentNoteId}
              notes={savedNotes[currentNoteId].content}
              onNotesChange={handleNotesChange}
              onExport={handleExport}
              isLoading={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;