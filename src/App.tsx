import React, { useState, useEffect } from 'react';
import { Save, Download, BookOpen } from 'lucide-react';
import { Layout } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { IntentSelector } from './components/IntentSelector';
import { AllNotesPage } from './components/AllNotesPage';
import { TitlePrompt } from './lib/titlePrompt';
import { NoteSaver } from './lib/noteSaver';
import { FileMetadata, processFiles } from './lib/detectFileTypes';
import { processPDF } from './lib/pdfProcessor';
import { transcribeMedia } from './lib/transcribeMedia';
import { generateNotes } from './lib/geminiProcessor';
import { checkForDuplicateNotes, validateContent } from './lib/contentValidation';
import { LearningIntent, ExamPrepStyle, ResearchStyle, ProcessingResult } from './types';

// Temporary user ID for demo - replace with actual auth
const DEMO_USER_ID = 'demo_user';

function App() {
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'note' | 'all-notes'>('home');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<LearningIntent>('exam_prep');
  const [examStyle, setExamStyle] = useState<ExamPrepStyle>('simple');
  const [researchStyle, setResearchStyle] = useState<ResearchStyle>('simple');
  const [customPrompt, setCustomPrompt] = useState('');
  const [detailLevel, setDetailLevel] = useState<1 | 2 | 3>(2);
  const [fileStatuses, setFileStatuses] = useState<Array<{
    id: string;
    fileName: string;
    status: 'idle' | 'generating' | 'done' | 'error';
    error?: string;
  }>>([]);
  const [showTitlePrompt, setShowTitlePrompt] = useState(false);
  const [pendingNote, setPendingNote] = useState<{
    content: string;
    files: File[];
    tags: { primary: string; secondary?: string };
  } | null>(null);
  const [savedNotes, setSavedNotes] = useState<Record<string, any>>({});

  const noteSaver = new NoteSaver(DEMO_USER_ID);

  useEffect(() => {
    const notes = noteSaver.loadNotesFromStorage();
    setSavedNotes(notes);
  }, []);

  const handleNoteSelect = (noteId: string) => {
    setCurrentNoteId(noteId);
    setCurrentView('note');
    const note = savedNotes[noteId];
    if (note) {
      setEditorValue(note.current.content);
      setHasUnsavedChanges(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await noteSaver.deleteNote(noteId);
      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);
      if (currentNoteId === noteId) {
        setCurrentNoteId(null);
        setCurrentView('home');
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      setError('Failed to delete note');
    }
  };

  const handleHomeClick = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        setCurrentNoteId(null);
        setCurrentView('home');
        setHasUnsavedChanges(false);
      }
    } else {
      setCurrentNoteId(null);
      setCurrentView('home');
    }
  };

  const handleAllNotesClick = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        setCurrentNoteId(null);
        setCurrentView('all-notes');
        setHasUnsavedChanges(false);
      }
    } else {
      setCurrentNoteId(null);
      setCurrentView('all-notes');
    }
  };

  const handleFilesChange = (newFiles: File[]) => {
    try {
      const metadata = processFiles(newFiles);
      setFiles(newFiles);
      setFileMetadata(metadata);
      setError(null);
      
      const newFileStatuses = metadata.map(meta => ({
        id: `file_${Date.now()}_${meta.fileName.replace(/\s+/g, '_')}`,
        fileName: meta.fileName,
        status: 'idle' as const
      }));
      setFileStatuses(newFileStatuses);
    } catch (error) {
      console.error('File processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process files');
    }
  };

  const generateNoteForFile = async (result: ProcessingResult, fileStatus: { id: string; fileName: string }) => {
    try {
      console.log(`🔄 Processing file: ${result.fileName}`);
      
      if (!validateContent(result.content, result.fileName)) {
        throw new Error('Content too short or invalid');
      }

      setFileStatuses(prev => 
        prev.map(fs => 
          fs.id === fileStatus.id 
            ? { ...fs, status: 'generating', error: undefined }
            : fs
        )
      );

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

      if (checkForDuplicateNotes(geminiResponse.notes, savedNotes, result.fileName)) {
        throw new Error('Duplicate content detected');
      }

      setPendingNote({
        content: geminiResponse.notes,
        files: [new File([result.content], result.fileName)],
        tags: { primary: result.type }
      });
      setShowTitlePrompt(true);

      setFileStatuses(prev => 
        prev.map(fs => 
          fs.id === fileStatus.id 
            ? { ...fs, status: 'done' }
            : fs
        )
      );

    } catch (error) {
      console.error(`❌ Failed to generate notes for ${result.fileName}:`, error);
      
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
    }
  };

  const handleGenerateNotes = async () => {
    if (files.length === 0) {
      setError('Please upload at least one file');
      return;
    }
    
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

  const handleManualSave = async () => {
    if (!currentNoteId || !hasUnsavedChanges) return;

    try {
      await noteSaver.updateNote(currentNoteId, editorValue);
      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save note:', error);
      setError('Failed to save note');
    }
  };

  const handleDownloadAll = async (noteId: string, title: string) => {
    try {
      const blob = await noteSaver.downloadNote(noteId);
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download files:', error);
      setError('Failed to download files');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleManualSave();
    }
  };

  const handleTitleConfirm = async (title: string) => {
    if (!pendingNote) return;

    try {
      const { noteId } = await noteSaver.saveNote(
        title,
        pendingNote.content,
        pendingNote.files,
        pendingNote.tags
      );

      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);
      setCurrentNoteId(noteId);
      setCurrentView('note');
      setEditorValue(pendingNote.content);
      setShowTitlePrompt(false);
      setPendingNote(null);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save note:', error);
      setError('Failed to save note');
    }
  };

  return (
    <Layout
      savedNotes={savedNotes}
      currentNoteId={currentNoteId}
      currentView={currentView}
      onNoteSelect={handleNoteSelect}
      onDeleteNote={handleDeleteNote}
      onHomeClick={handleHomeClick}
      onAllNotesClick={handleAllNotesClick}
      fileStatuses={fileStatuses}
    >
      <div className="h-full p-4">
        {showTitlePrompt && pendingNote && (
          <TitlePrompt
            defaultTitle={pendingNote.files[0]?.name || 'New Note'}
            onConfirm={handleTitleConfirm}
            onCancel={() => {
              setShowTitlePrompt(false);
              setPendingNote(null);
            }}
          />
        )}

        {currentView === 'home' ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <BookOpen className="w-12 h-12 text-blue-600" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  AI Learning Notes Generator
                </h1>
                <p className="text-lg text-gray-600">
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
            </div>
          </div>
        ) : currentView === 'all-notes' ? (
          <AllNotesPage
            savedNotes={savedNotes}
            onNoteSelect={handleNoteSelect}
          />
        ) : currentNoteId && savedNotes[currentNoteId] ? (
          <div className="h-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">{savedNotes[currentNoteId].title}</h2>
                <p className="text-sm text-gray-500">
                  Version {savedNotes[currentNoteId].current.version} • 
                  Last edited: {new Date(savedNotes[currentNoteId].updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleManualSave}
                  disabled={!hasUnsavedChanges}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => handleDownloadAll(currentNoteId, savedNotes[currentNoteId].title)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                  Download All
                </button>
              </div>
            </div>
            <textarea
              key={currentNoteId}
              value={editorValue}
              onChange={(e) => {
                setEditorValue(e.target.value);
                setHasUnsavedChanges(true);
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-[calc(100vh-8rem)] p-4 font-mono text-sm bg-white rounded shadow border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              spellCheck={false}
            />
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

export default App;