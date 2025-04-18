import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Download, Sparkles, Volume2, BookOpen } from 'lucide-react';
import { Toaster, toast } from 'sonner';
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
import { generateAudio } from './lib/audioGenerator';
import { generateFlashcards } from './lib/flashcardGenerator';
import { checkForDuplicateNotes, validateContent } from './lib/contentValidation';
import { AudioPlayer } from './components/AudioPlayer';
import { AudioGenerateModal } from './components/AudioGenerateModal';
import { FlashcardModal } from './components/FlashcardModal';
import { NoteRenderer } from './components/NoteRenderer';
import { LearningIntent, ExamPrepStyle, ResearchStyle, ProcessingResult, SavedNote, NoteBlock, Flashcard, FlashcardProgress } from './types';
import { FlashcardPreview } from './components/FlashcardPreview';
import { extractMultiplePageImages, extractPageImage, createBasicPdf } from './lib/pdfUtils';
import { getFileContent, getExtractedText } from './lib/fileStorage';
import axios from 'axios';
import generateAnkiPackage from './lib/ankiExport';
// import { throttle } from './lib/utils'; // Assuming this exists

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
    generatedContent: string;
    sourceFiles: { file: File; extractedText: string }[];
    tags: { primary: string; secondary?: string };
  } | null>(null);
  const [savedNotes, setSavedNotes] = useState<Record<string, SavedNote>>({});
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentAudioStyle, setCurrentAudioStyle] = useState<'concise' | 'detailed' | null>(null);
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [newCardIdsInQueue, setNewCardIdsInQueue] = useState<Set<string>>(new Set());
  const [reviewSessionOriginalCount, setReviewSessionOriginalCount] = useState(0);
  const [cardGoodCounts, setCardGoodCounts] = useState<Record<string, number>>({});
  const [sessionNewCount, setSessionNewCount] = useState(0);
  const [sessionDueCount, setSessionDueCount] = useState(0);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const noteSaver = new NoteSaver(DEMO_USER_ID);

  useEffect(() => {
    const notes = noteSaver.loadNotesFromStorage();
    setSavedNotes(notes);
  }, []);

  const handleBlocksChange = useCallback(async (noteId: string, blocks: NoteBlock[]) => {
    try {
      const note = savedNotes[noteId];
      if (!note) return;

      await noteSaver.updateNote(noteId, note.current.content, undefined, blocks);
      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);
      setHasUnsavedChanges(false);
      toast.success('Changes saved');
    } catch (error) {
      console.error('Failed to save blocks:', error);
      toast.error('Failed to save changes');
    }
  }, [savedNotes]);

  const resetHomeState = () => {
    setFiles([]);
    setFileMetadata([]);
    setFileStatuses([]);
    setError(null);
    setProcessing(false);
    setSelectedIntent('exam_prep');
    setExamStyle('simple');
    setResearchStyle('simple');
    setCustomPrompt('');
    setDetailLevel(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        resetHomeState();
      }
    } else {
      setCurrentNoteId(null);
      setCurrentView('home');
      resetHomeState();
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
      const combinedFiles = [...files, ...newFiles].slice(0, 3);
      const metadata = processFiles(combinedFiles);
      setFiles(combinedFiles);
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

      // Find the original File object from the main files state
      const originalFile = files.find(f => f.name === result.fileName);
      if (!originalFile) {
        console.error(`Could not find original file for ${result.fileName} in state`);
        throw new Error('Original file not found'); 
      }

      // Ensure we have the extracted text from the result
      const extractedText = typeof result.content === 'string' ? result.content : '';
      if (!extractedText) {
        console.warn(`[generateNoteForFile] Extracted text for ${result.fileName} is empty. Cannot save for rawText context.`);
        // Potentially throw error or handle differently? For now, proceed without it.
      }

      console.log(`[generateNoteForFile] Found original file: ${originalFile.name}, Type: ${originalFile.type}`);
      console.log(`[generateNoteForFile] Extracted text length: ${extractedText.length}`);

      setPendingNote({
        generatedContent: geminiResponse.notes,
        sourceFiles: [{ file: originalFile, extractedText }],
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

      // Filter out null results and ensure content is valid
      const validResults = processedResults.filter(
        (result): result is NonNullable<typeof result> => 
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
      toast.success('Note saved successfully');
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Failed to save note');
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
      toast.error('Failed to download files');
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
      // Pass sourceFiles instead of originalFiles
      const { noteId } = await noteSaver.saveNote(
        title,
        pendingNote.generatedContent,
        pendingNote.sourceFiles,
        pendingNote.tags
      );

      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);
      setCurrentNoteId(noteId);
      setCurrentView('note');
      setEditorValue(pendingNote.generatedContent);
      setShowTitlePrompt(false);
      setPendingNote(null);
      setHasUnsavedChanges(false);
      resetHomeState();
      toast.success('Note saved successfully');
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleGenerateAudio = async (style: 'concise' | 'detailed') => {
    if (!currentNoteId) return;

    try {
      setIsGeneratingAudio(true);
      setCurrentAudioStyle(style);
      setShowAudioModal(false);

      const note = savedNotes[currentNoteId];
      if (!note) throw new Error('Note not found');

      const rawContent = note.files[0]?.fileUrl || '';

      const result = await generateAudio({
        style,
        voice: 'en-US-Studio-O',
        noteContent: note.current.content,
        rawText: rawContent,
        userId: DEMO_USER_ID,
        noteId: currentNoteId,
        normalizedTitle: note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      });

      await noteSaver.saveAudio(currentNoteId, style, {
        url: result.audioUrl,
        script: result.script,
        style: result.style,
        voice: 'en-US-Studio-O',
        generatedAt: result.generatedAt
      });

      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);

      toast.success('Audio lecture generated successfully');
    } catch (error) {
      console.error('Failed to generate audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to generate audio lecture: ${errorMessage}`);
    } finally {
      setIsGeneratingAudio(false);
      setCurrentAudioStyle(null);
    }
  };

  const handleNoteContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorValue(e.target.value);
    setHasUnsavedChanges(true);
  };

  // Helper function to check if PDF page images are correctly saved with flashcards
  // But don't automatically try to fix them to avoid infinite loops
  const checkFlashcardImages = (noteId: string, flashcards: Flashcard[]) => {
    const cardsWithPageNumbers = flashcards.filter(card => card.pageNumber);
    if (cardsWithPageNumbers.length === 0) return;
    
    const imagesPresent = cardsWithPageNumbers.filter(card => card.pageImage).length;
    const imagesMissing = cardsWithPageNumbers.length - imagesPresent;
    
    console.log(`Flashcard image check - Total: ${flashcards.length}, With page numbers: ${cardsWithPageNumbers.length}, With images: ${imagesPresent}, Missing images: ${imagesMissing}`);
    
    // Don't automatically try to fix to avoid infinite loops
    if (imagesMissing > 0) {
      console.log('Some flashcards are missing page images. Consider regenerating flashcards.');
      // Print details about the missing images
      cardsWithPageNumbers.forEach((card, idx) => {
        console.log(`Card ${idx + 1}: Page ${card.pageNumber}, Has image: ${!!card.pageImage}`);
      });
    }
  };

  // Create an enhanced placeholder image that looks more like a real PDF page
  const createEnhancedPlaceholderImage = async (pageNumber: number, title: string = 'PDF Content'): Promise<string> => {
    try {
      console.log(`Creating enhanced placeholder image for page ${pageNumber}`);
      
      // Create a canvas with a reasonable size - similar to a PDF page
      const canvas = document.createElement('canvas');
      const width = 600;
      const height = 800;
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return '';
      }
      
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      
      // Draw a light blue header
      const gradient = ctx.createLinearGradient(0, 0, 0, 100);
      gradient.addColorStop(0, '#e1f5fe');
      gradient.addColorStop(1, '#f5f5f5');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 80);
      
      // Draw a border
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, width - 40, height - 40);
      
      // Draw a line under the header
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.lineTo(width, 80);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add page number at top right
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#555';
      ctx.textAlign = 'right';
      ctx.fillText(`Page ${pageNumber}`, width - 40, 50);
      
      // Add title at top left
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.fillText(title, 40, 50);
      
      // Add document placeholder text (lines that look like text)
      ctx.fillStyle = '#666';
      
      // Create 20 lines that look like text (vary the length)
      for (let i = 0; i < 20; i++) {
        const lineWidth = 100 + Math.random() * 400; // Varies from 100-500px
        const y = 150 + (i * 30);
        
        // Skip drawing lines beyond canvas
        if (y > height - 80) break;
        
        ctx.fillStyle = '#eee';
        ctx.fillRect(40, y - 12, lineWidth, 20);
        ctx.fillStyle = '#888';
        ctx.fillRect(40, y - 12, lineWidth, 2);
      }
      
      // Add a note at the bottom that this is a placeholder
      ctx.font = '12px Arial';
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('Image placeholder for reference only', width / 2, height - 30);
      
      // Add a footer
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, height - 60, width, 60);
      
      // Draw header line at bottom of footer
      ctx.beginPath();
      ctx.moveTo(0, height - 60);
      ctx.lineTo(width, height - 60);
      ctx.strokeStyle = '#ddd';
      ctx.stroke();
      
      // Convert to JPEG with good quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log(`Successfully created enhanced placeholder image, size: ${Math.round(dataUrl.length/1024)}KB`);
      return dataUrl;
    } catch (error) {
      console.error('Error creating enhanced placeholder image:', error);
      return '';
    }
  };

  const handleSaveFlashcards = async (noteId: string, flashcards: Flashcard[], silent = false) => {
    try {
      const note = savedNotes[noteId];
      if (!note) {
        console.error(`[Flashcards] Note not found with ID: ${noteId}`);
        return;
      }

      console.log(`[Flashcards] Processing ${flashcards.length} flashcards for note: \"${note.title}\". Silent: ${silent}`);

      const flashcardsWithPageNumbers = flashcards.filter(card => card.pageNumber && card.pageNumber > 0);
      console.log(`[Flashcards] Found ${flashcardsWithPageNumbers.length} flashcards with valid page numbers.`);

      if (flashcardsWithPageNumbers.length > 0) {
        let pdfFile: File | null = null;
        let pdfSourceStatus: 'retrieved' | 'invalid_retrieval' | 'error_retrieval' | 'none' | 'error_extraction' = 'none';

        // --- Step 1: Try to retrieve the actual PDF File --- 
        try {
          console.log(`[Flashcards] Attempting to get PDF file for note: \"${note.title}\".`);
          pdfFile = await getPdfFileFromNote(note); 

          if (pdfFile && pdfFile.size > 0 && pdfFile.type === 'application/pdf') {
             console.log(`[Flashcards] Successfully retrieved PDF file: ${pdfFile.name}, Size: ${pdfFile.size} bytes, Type: ${pdfFile.type}`);
             pdfSourceStatus = 'retrieved';

             // Basic header check (optional but recommended)
             try {
                const reader = new FileReader();
                const headerPromise = new Promise<boolean>((resolve) => {
                  reader.onload = (e) => {
                    const result = e.target?.result;
                    if (result && typeof result === 'string' && result.startsWith('%PDF-')) resolve(true);
                    else if (result instanceof ArrayBuffer) {
                      const bytes = new Uint8Array(result);
                      const header = String.fromCharCode(...bytes.slice(0, 5));
                      resolve(header === '%PDF-');
                    } else resolve(false);
                  };
                  reader.onerror = () => resolve(false);
                });
                reader.readAsArrayBuffer(pdfFile.slice(0, 8)); // Read only first 8 bytes
                const isValid = await headerPromise;
                if (!isValid) {
                  console.warn(`[Flashcards] Retrieved PDF file (${pdfFile.name}) header check failed.`);
                  pdfSourceStatus = 'invalid_retrieval'; // Treat as invalid if header fails
                  pdfFile = null; 
                } else {
                  console.log(`[Flashcards] PDF header verification successful for ${pdfFile.name}.`);
                }
             } catch (headerError) {
                console.warn(`[Flashcards] Error during PDF header check:`, headerError);
                pdfSourceStatus = 'invalid_retrieval'; // Treat as invalid on error
                pdfFile = null; 
             }

          } else {
             console.warn(`[Flashcards] getPdfFileFromNote did not return a valid PDF File object. Name: ${pdfFile?.name}, Size: ${pdfFile?.size}, Type: ${pdfFile?.type}`);
             pdfSourceStatus = 'invalid_retrieval';
             pdfFile = null; // Ensure pdfFile is null if invalid
          }
        } catch (getPdfError) {
           console.error(`[Flashcards] Error calling getPdfFileFromNote:`, getPdfError);
           pdfSourceStatus = 'error_retrieval';
           pdfFile = null; // Ensure pdfFile is null on error
        }

        // --- Step 2: Image Extraction or Placeholder Generation --- 
        if (pdfFile && pdfSourceStatus === 'retrieved') {
          // --- Attempt to extract images from the successfully retrieved PDF --- 
          console.log(`[Flashcards] Attempting image extraction from retrieved PDF: ${pdfFile.name}`);
          try {
            const pageNumbers = flashcardsWithPageNumbers
              .map(card => card.pageNumber!)
              .filter((page, index, self) => self.indexOf(page) === index); // Unique page numbers
              
            console.log(`[Flashcards] Need images for unique pages: ${pageNumbers.join(', ')}`);

            const pageToCardMap = new Map<number, Flashcard[]>();
            flashcardsWithPageNumbers.forEach(card => {
              if (card.pageNumber) {
                 if (!pageToCardMap.has(card.pageNumber)) pageToCardMap.set(card.pageNumber, []);
                 pageToCardMap.get(card.pageNumber)?.push(card);
              }
            });

            // Use batch extraction for efficiency
            const pageImages = await extractMultiplePageImages(pdfFile, pageNumbers, 1.0); 

            let appliedSuccessCount = 0;
            let extractionFailures = 0;
            pageToCardMap.forEach((cards, pageNum) => {
              const image = pageImages.get(pageNum);
              // Check if image is valid (not the fallback and reasonable length)
              if (image && image !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' && image.length > 100 && (image.startsWith('data:image/jpeg') || image.startsWith('data:image/png'))) {
                cards.forEach(card => card.pageImage = image);
                appliedSuccessCount += cards.length;
              } else {
                 console.warn(`[Flashcards] Failed to get valid image for page ${pageNum}. Will use placeholder.`);
                 cards.forEach(card => card.pageImage = undefined); // Set to undefined so placeholder logic runs
                 extractionFailures++;
              }
            });
            console.log(`[Flashcards] Image extraction applied. Success count (cards): ${appliedSuccessCount}. Failed pages: ${extractionFailures}`);

            // Generate placeholders ONLY for cards where extraction failed
             if (extractionFailures > 0) {
               console.log(`[Flashcards] Generating placeholders for ${extractionFailures} pages where extraction failed.`);
               for (const card of flashcardsWithPageNumbers) {
                 if (card.pageNumber && card.pageImage === undefined) { // Only target cards needing an image
                   try {
                     const placeholderImage = await createEnhancedPlaceholderImage(card.pageNumber, note.title);
                     if (placeholderImage && placeholderImage.length > 100) {
                       card.pageImage = placeholderImage;
                       console.log(`[Flashcards] Added enhanced placeholder for page ${card.pageNumber}`);
                     }
                   } catch (placeholderError) {
                     console.error(`[Flashcards] Failed to create placeholder image for page ${card.pageNumber}:`, placeholderError);
                     // Leave pageImage as undefined
                   }
                 }
               }
             }

          } catch (extractionError) {
            console.error(`[Flashcards] Error during batch image extraction from retrieved PDF:`, extractionError);
            console.log('[Flashcards] Falling back to generating placeholder images for ALL cards due to extraction error.');
            pdfSourceStatus = 'error_extraction'; // Mark extraction as failed
            // Fall through to the placeholder generation block below
          }
        }
        
        // --- Fallback: Generate Placeholders if PDF retrieval or extraction failed --- 
        if (pdfSourceStatus !== 'retrieved') {
          console.warn(`[Flashcards] PDF source status: ${pdfSourceStatus}. Generating placeholders for all ${flashcardsWithPageNumbers.length} cards.`);
          for (const card of flashcardsWithPageNumbers) {
            if (card.pageNumber) {
              try {
                 const placeholderImage = await createEnhancedPlaceholderImage(card.pageNumber, note.title);
                 if (placeholderImage && placeholderImage.length > 100) {
                   card.pageImage = placeholderImage;
                 } else {
                   console.warn(`[Flashcards] Failed to generate valid placeholder for page ${card.pageNumber}`);
                   card.pageImage = undefined;
                 }
              } catch (placeholderError) {
                 console.error(`[Flashcards] Failed to create placeholder image for page ${card.pageNumber}:`, placeholderError);
                 card.pageImage = undefined;
              }
              // Add a small delay between placeholder generations if needed
              await new Promise(resolve => setTimeout(resolve, 10)); 
            }
          }
        }
      } else {
        console.log('[Flashcards] No flashcards with page numbers found. Skipping image processing.');
      }

      // --- Step 3: Final Cleanup and Save --- 
      flashcards.forEach(card => {
        // Remove invalid image data (too short, not base64, or our known fallback)
        if (card.pageImage && (card.pageImage.length < 100 || 
            card.pageImage === 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' ||
            (!card.pageImage.startsWith('data:image/jpeg') && !card.pageImage.startsWith('data:image/png')))) {
          console.log(`[Flashcards] Removing invalid/fallback image data before saving for card page ${card.pageNumber}`);
          card.pageImage = undefined;
        }
      });

      console.log(`[Flashcards] Saving ${flashcards.length} flashcards to note: \"${note.title}\".`);
      await noteSaver.updateNote(noteId, note.current.content, undefined, undefined, flashcards);
      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);

      if (!silent) {
        toast.success('Flashcards updated with images');
      }
    } catch (error) {
      console.error('[Flashcards] Unhandled error in handleSaveFlashcards:', error);
      if (!silent) {
        toast.error('Failed to update flashcards with images');
      }
    }
  };

  // Helper function to get PDF file from note with improved error handling
  const getPdfFileFromNote = async (note: SavedNote): Promise<File | null> => {
    try {
      console.log(`[getPdfFileFromNote] Attempting to extract PDF file from note "${note.title}" (ID: ${note.id})`);
      
      // Find the PDF file *metadata* in the note object
      const pdfFileMetadata = note.files.find((f: { fileName: string }) => 
        f.fileName.toLowerCase().endsWith('.pdf')
      );
      
      if (!pdfFileMetadata) {
        console.error(`[getPdfFileFromNote] No PDF file metadata found in note files for note ID ${note.id}`);
        return null;
      }
      
      console.log(`[getPdfFileFromNote] Found PDF metadata:`, pdfFileMetadata);

      // Retrieve the actual file content (base64 data URL) from IndexedDB
      console.log(`[getPdfFileFromNote] Retrieving content for ${pdfFileMetadata.fileName} from IndexedDB...`);
      const fileUrl = await getFileContent(note.id, pdfFileMetadata.fileName);

      if (!fileUrl) {
         console.error(`[getPdfFileFromNote] Failed to retrieve file content from IndexedDB for ${pdfFileMetadata.fileName}`);
         return null;
      }

      // Check if the retrieved content is a valid data URL for a PDF
      if (fileUrl.startsWith('data:application/pdf;base64,')) {
          console.log(`[getPdfFileFromNote] PDF content retrieved from IndexedDB as data URL. Length: ${fileUrl.length}`);
          
          try {
            // Decode the base64 data URL back into a File object
            const base64Data = fileUrl.split(',')[1];
            if (!base64Data) {
              throw new Error('Invalid data URL format retrieved from IndexedDB');
            }
            
            const binaryData = atob(base64Data);
            const bytes = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
              bytes[i] = binaryData.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: 'application/pdf' });
            // Use metadata for name, but Blob for content
            const file = new File([blob], pdfFileMetadata.fileName, { type: 'application/pdf' }); 
            
            if (file.size === 0) {
              throw new Error('Generated PDF file from IndexedDB data has zero size');
            }
            
            console.log(`[getPdfFileFromNote] Successfully created File object from IndexedDB data (${file.size} bytes)`);
            return file;
          } catch (decodingError) {
            console.error(`[getPdfFileFromNote] Failed to decode base64 data URL from IndexedDB:`, decodingError);
            return null;
          }
        } else {
           console.error(`[getPdfFileFromNote] Content retrieved from IndexedDB for ${pdfFileMetadata.fileName} is not a valid PDF data URL.`);
           return null;
        }

    } catch (error) {
      console.error(`[getPdfFileFromNote] Error getting PDF file for note ID ${note?.id}:`, error);
      return null;
    }
  };

  // Update Audio button based on generation status
  const renderAudioButton = () => {
    if (isGeneratingAudio) {
      return (
        <button
          disabled={true}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Volume2 className="w-4 h-4" />
          Generating Audio...
        </button>
      );
    }
    
    if (currentNoteId && (savedNotes[currentNoteId]?.audio?.concise || savedNotes[currentNoteId]?.audio?.detailed)) {
      return (
        <button
          onClick={() => setShowAudioModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
        >
          <Volume2 className="w-4 h-4" />
          Audio Lecture Generated
        </button>
      );
    }
    
    return (
      <button
        onClick={() => setShowAudioModal(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
      >
        <Volume2 className="w-4 h-4" />
        Generate Audio Lecture
      </button>
    );
  };

  // Update Flashcard button based on generation status
  const renderFlashcardButton = () => {
    if (isGeneratingFlashcards) {
      return (
        <button
          disabled={true}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookOpen className="w-4 h-4" />
          Generating Flashcards...
        </button>
      );
    }
    
    if (currentNoteId && savedNotes[currentNoteId]?.flashcards && savedNotes[currentNoteId].flashcards.length > 0) {
      return (
        <button
          onClick={async () => {
            if (!currentNoteId) return;
            try {
              setIsGeneratingFlashcards(true);
              const note = savedNotes[currentNoteId];
              if (!note) return;

              // Retrieve the extracted text using the key from the note file metadata
              const extractedTextKey = note.files[0]?.extractedTextKey;
              let rawTextContent = '';
              if (extractedTextKey) {
                console.log(`[Flashcards] Retrieving extracted text with key: ${extractedTextKey}`);
                rawTextContent = await getExtractedText(extractedTextKey) || '';
                console.log(`[Flashcards] Retrieved extracted text length: ${rawTextContent.length}`);
              } else {
                console.warn('[Flashcards] No extractedTextKey found for the primary file. Raw text context will be missing.');
              }

              const flashcards = await generateFlashcards({
                noteContent: note.current.content,
                rawText: rawTextContent
              });
              
              // Save the flashcards first to ensure they're stored, then try to add images
              await handleSaveFlashcards(currentNoteId, flashcards, true);
              toast.success('Flashcards regenerated successfully');
            } catch (error) {
              console.error('Failed to regenerate flashcards:', error);
              toast.error('Failed to regenerate flashcards');
            } finally {
              setIsGeneratingFlashcards(false);
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600"
        >
          <BookOpen className="w-4 h-4" />
          Regenerate Flashcards
        </button>
      );
    }
    
    return (
      <button
        onClick={async () => {
          if (!currentNoteId) return;
          try {
            setIsGeneratingFlashcards(true);
            const note = savedNotes[currentNoteId];
            if (!note) return;

            // Retrieve the extracted text using the key from the note file metadata
            const extractedTextKey = note.files[0]?.extractedTextKey;
            let rawTextContent = '';
            if (extractedTextKey) {
              console.log(`[Flashcards] Retrieving extracted text with key: ${extractedTextKey}`);
              rawTextContent = await getExtractedText(extractedTextKey) || '';
              console.log(`[Flashcards] Retrieved extracted text length: ${rawTextContent.length}`);
            } else {
              console.warn('[Flashcards] No extractedTextKey found for the primary file. Raw text context will be missing.');
            }

            const flashcards = await generateFlashcards({
              noteContent: note.current.content,
              rawText: rawTextContent
            });
            
            // Save the flashcards first to ensure they're stored, then try to add images
            await handleSaveFlashcards(currentNoteId, flashcards, true);
            toast.success('Flashcards generated successfully');
          } catch (error) {
            console.error('Failed to generate flashcards:', error);
            toast.error('Failed to generate flashcards');
          } finally {
            setIsGeneratingFlashcards(false);
          }
        }}
        disabled={isGeneratingFlashcards}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <BookOpen className="w-4 h-4" />
        Generate Flashcards
      </button>
    );
  };

  // Add effect to check flashcards for missing images when a note is selected
  // But only once when the note is loaded
  useEffect(() => {
    if (currentNoteId && 
        savedNotes[currentNoteId]?.flashcards && 
        savedNotes[currentNoteId].flashcards.length > 0) {
      console.log(`Checking flashcards for noteId: ${currentNoteId}`);
      checkFlashcardImages(currentNoteId, savedNotes[currentNoteId].flashcards);
    }
  }, [currentNoteId]); // Only depend on currentNoteId, not savedNotes

  // Add this new function at the file scope level, near the other utility functions
  const createTestImage = async (width = 300, height = 400, pageNumber?: number): Promise<string> => {
    try {
      console.log(`Creating test image of ${width}x${height} pixels${pageNumber ? ` for page ${pageNumber}` : ''}`);
      
      // Create an off-screen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return '';
      }
      
      // Fill with a gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#f0f0f0');
      gradient.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Add some text to identify the page
      ctx.fillStyle = 'black';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Test Image', width / 2, height / 2 - 40);
      
      // Add page number if provided
      if (pageNumber) {
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Page ${pageNumber}`, width / 2, height / 2);
      }
      
      ctx.font = '16px Arial';
      ctx.fillText(`PDF not available`, width / 2, height / 2 + 40);
      ctx.fillText(`(placeholder)`, width / 2, height / 2 + 70);
      
      // Add a border to make it clearer this is a test image
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, width, height);
      
      // Convert to JPEG with good quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log(`Test image created successfully, size: ${Math.round(dataUrl.length/1024)}KB`);
      return dataUrl;
    } catch (error) {
      console.error('Error creating test image:', error);
      return ''; // Ensure empty string is returned on error
    }
    // Add a default return path if try-catch is somehow bypassed (though unlikely)
    return '';
  };

  // Function to handle moving to the previous card in review
  const handlePreviousCard = () => {
    setReviewIndex(prev => Math.max(0, prev - 1));
  };

  // --- REVISED: Flashcard Response Handling (Focus on State Update Order & Again Bug Fix) --- 
  const handleFlashcardResponse = async (response: 'again' | 'good') => {
    if (reviewIndex >= reviewQueue.length || !currentNoteId) return; // Safety checks

    const currentCard = reviewQueue[reviewIndex];
    // --- Get Stable ID --- 
    const allCardsInNote = savedNotes[currentNoteId]?.flashcards || [];
    const cardIndexInNote = allCardsInNote.findIndex(c => 
        c.front === currentCard.front && 
        c.back === currentCard.back
    );
    // Use a fallback ID if the original index isn't found, though this shouldn't happen
    const flashcardId = cardIndexInNote >= 0 
        ? `note_${currentNoteId}_card_${cardIndexInNote}` 
        : `error_card_${Date.now()}`;
    if (cardIndexInNote < 0) {
       console.error(`[Review] Could not find original index for card:`, currentCard, `Using fallback ID: ${flashcardId}`);
       // Don't necessarily return, try to proceed with fallback ID for local counts
    }
    // ---------------------

    let nextQueue = [...reviewQueue];
    let nextGoodCounts = { ...cardGoodCounts };
    let nextReviewIndex = reviewIndex; // Initialize with current index

    console.log(`[Review Start] Action: ${response} | Current Index: ${reviewIndex} | Queue Length: ${reviewQueue.length} | Card ID: ${flashcardId}`);

    if (response === 'again') {
        nextGoodCounts[flashcardId] = 0; // Reset good count

        // Remove card from current position
        const cardToReinsert = nextQueue.splice(reviewIndex, 1)[0];

        if (cardToReinsert) {
            // Insert 2 positions ahead, capped at the end of the *new* length
            const insertIndex = Math.min(reviewIndex + 2, nextQueue.length);
            nextQueue.splice(insertIndex, 0, cardToReinsert);
            console.log(`[Review Again] Reinserted '${flashcardId}' at index ${insertIndex}. New queue size: ${nextQueue.length}`);

            // Index *stays the same* logically because the item at reviewIndex was removed.
            // The next item to show is now at the original reviewIndex in the modified queue.
            // No change needed to nextReviewIndex initially set to reviewIndex.
            nextReviewIndex = reviewIndex; 
        } else {
            console.error(`[Review Again] Failed to remove card at index ${reviewIndex}. Advancing index to prevent stall.`);
            nextReviewIndex = reviewIndex + 1; // Advance if removal failed
        }

    } else if (response === 'good') {
        const currentGoodCount = cardGoodCounts[flashcardId] || 0;
        const newGoodCount = currentGoodCount + 1;
        nextGoodCounts[flashcardId] = newGoodCount;

        if (newGoodCount >= 3) {
            // Learned: remove card
            console.log(`[Review Good] Card '${flashcardId}' learned (Count: ${newGoodCount}). Removing.`);
            nextQueue.splice(reviewIndex, 1); // Remove from queue
            // Index *stays the same* logically because the item was removed.
            nextReviewIndex = reviewIndex;

            // --- Send update to backend --- 
            const isOriginallyNew = newCardIdsInQueue.has(flashcardId);
            const updateType = isOriginallyNew ? "LEARNED (New)" : "REVIEWED (Due)";
            console.log(` - Sending ${updateType} update to backend for ${flashcardId}`);
            const payload = { flashcardId, userId: DEMO_USER_ID, noteId: currentNoteId, response: 'good' };
            axios.post('http://localhost:3000/api/flashcard/response', payload)
              .then(() => console.log(`   Backend update SUCCESS for ${flashcardId}`))
              .catch(err => console.error(`   Backend update FAILED for ${flashcardId}:`, err));
            
            if (isOriginallyNew) {
                setNewCardIdsInQueue(prev => { const next = new Set(prev); next.delete(flashcardId); return next; });
            }
            // Clean up local count AFTER potential backend call finishes (or immediately is fine too)
            delete nextGoodCounts[flashcardId]; 
            // ----------------------------- 

        } else {
            // Good, but not learned yet: Advance index
            console.log(`[Review Good] Card '${flashcardId}' count updated (${newGoodCount}). Advancing.`);
            nextReviewIndex = reviewIndex + 1;
        }
    }

    // --- Determine Final State --- 
    // Check if the queue is now empty
    if (nextQueue.length === 0) {
        console.log("[Review End] Session finished! Queue is empty.");
        toast.success("Flashcard review complete!");
        setShowFlashcardModal(false);
        // Clear all session state
        setReviewQueue([]);
        setReviewIndex(0);
        setCardGoodCounts({});
        setNewCardIdsInQueue(new Set());
        setSessionNewCount(0);
        setSessionDueCount(0);
        setReviewSessionOriginalCount(0);
    } else {
        // Clamp the calculated next index to valid bounds of the *final* queue
        // IMPORTANT: The valid index range is 0 to nextQueue.length - 1
        const finalNextIndex = Math.min(nextReviewIndex, nextQueue.length - 1); 

        console.log(`[Review Update] Setting State - Next Index: ${finalNextIndex} | New Queue Length: ${nextQueue.length}`);

        // Set state together to hopefully trigger a single re-render cycle for the update
        setCardGoodCounts(nextGoodCounts);
        setReviewQueue(nextQueue);
        setReviewIndex(finalNextIndex); 
    }
  };

  // --- startReviewSession remains largely the same (fetches progress, categorizes, shuffles) --- 
  const startReviewSession = async () => {
    if (!currentNoteId || !savedNotes[currentNoteId]?.flashcards?.length) {
      toast.warning("No flashcards available for review in this note.");
      return;
    }
    
    setIsGeneratingFlashcards(true); 
    console.log('[Review Setup] Starting...');
    try {
      console.log(`Loading flashcard progress for note ${currentNoteId} from API...`);
      const progressResponse = await axios.get<{ progress: Record<string, FlashcardProgress> }>(`http://localhost:3000/api/flashcards/progress?userId=${DEMO_USER_ID}&noteId=${currentNoteId}`);
      const currentProgress = progressResponse.data.progress || {}; 
      console.log(" - Fetched progress:", currentProgress);

      const allCardsInNote = savedNotes[currentNoteId].flashcards;
      if (!allCardsInNote || allCardsInNote.length === 0) {
        toast.info("No flashcards found in this note.");
        setIsGeneratingFlashcards(false);
        return;
      }
      
      const initialNewCards: Flashcard[] = [];
      const initialDueCards: Flashcard[] = [];
      const now = new Date().toISOString().split('T')[0]; 
      const currentNewCardIds = new Set<string>();
      setCardGoodCounts({}); 

      allCardsInNote.forEach((card, index) => {
        const placeholderId = `note_${currentNoteId}_card_${index}`;
        const progress = currentProgress[placeholderId]; 
        if (!progress) {
          initialNewCards.push(card);
          currentNewCardIds.add(placeholderId);
        } else {
          const dueDate = progress.dueDate; 
          if (dueDate && dueDate <= now) {
            initialDueCards.push(card);
          } 
        }
      });

      console.log(` - Categorized cards - New: ${initialNewCards.length}, Due: ${initialDueCards.length}`);
      setSessionNewCount(initialNewCards.length); 
      setSessionDueCount(initialDueCards.length);
      setNewCardIdsInQueue(currentNewCardIds);

      const newCardLimit = 20; 
      const queue = [
        ...initialNewCards.slice(0, newCardLimit), 
        ...initialDueCards                    
      ];
      
      if (queue.length === 0) {
         toast.info("No flashcards are due for review right now.");
         setIsGeneratingFlashcards(false);
         setSessionNewCount(0);
         setSessionDueCount(0);
         setNewCardIdsInQueue(new Set());
         return;
      }

      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      console.log(` - Created initial queue of ${queue.length} cards (max ${newCardLimit} new). Shuffled.`);
      
      setReviewQueue(queue);
      setReviewIndex(0);
      setReviewSessionOriginalCount(queue.length); 
      setShowFlashcardModal(true);

    } catch (error: any) { 
      console.error("Error starting review session:", error);
      toast.error(`Could not start review session: ${error.message || 'Failed to load progress.'}`);
      setReviewQueue([]);
      setReviewIndex(0);
      setCardGoodCounts({});
      setNewCardIdsInQueue(new Set());
      setSessionNewCount(0);
      setSessionDueCount(0);
      setReviewSessionOriginalCount(0);
    } finally {
      setIsGeneratingFlashcards(false); 
    }
  };

  // --- NEW: Generic Export Handler --- 
  const handleExport = async (format: 'apkg' | 'txt' | 'pdf') => {
    if (!currentNoteId || !savedNotes[currentNoteId]?.flashcards?.length) {
      toast.warning("No flashcards to export in this note.");
      return;
    }
    setShowExportOptions(false); // Close dropdown after selection

    try {
      console.log(`[Export] Starting export in format: ${format}`);
      // Fetch progress 
      const progressResponse = await axios.get<{ progress: Record<string, FlashcardProgress> }>(`http://localhost:3000/api/flashcards/progress?userId=${DEMO_USER_ID}&noteId=${currentNoteId}`);
      const currentProgress = progressResponse.data.progress || {};
      const now = new Date().toISOString().split('T')[0];
      const allCardsInNote = savedNotes[currentNoteId].flashcards;
      const noteTitle = savedNotes[currentNoteId].title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      // Ensure version exists before using it
      const noteVersion = savedNotes[currentNoteId].current?.version || 1; 

      // --- Generate content based on format --- 
      let blob: Blob | null = null;
      let filename = `flashcards_${noteTitle}_v${noteVersion}.${format}`;

      if (format === 'txt') {
        const cardsToExport = allCardsInNote.map((card, index) => {
          const placeholderId = `note_${currentNoteId}_card_${index}`;
          const progress = currentProgress[placeholderId];
          let status = "New";
          if (progress) {
            const dueDate = progress.dueDate;
            status = dueDate && dueDate <= now ? "Due" : "Learning";
          }
          // Replace newlines in front/back for cleaner TXT output
          const front = card.front.replace(/\n/g, ' ');
          const back = card.back.replace(/\n/g, ' ');
          return { front, back, status };
        });

        const txtContent = cardsToExport.map(c => `Q: ${c.front}\nA: ${c.back}\nStatus: ${c.status}`).join('\n---\n');
        blob = new Blob(['\uFEFF' + txtContent], { type: 'text/plain;charset=utf-8;' });

      } else if (format === 'apkg') {
        // UPDATED: Use the generateAnkiPackage utility
        toast.info('Generating Anki package, please wait...');
        try {
          const deckName = `${savedNotes[currentNoteId].title} Flashcards`;
          const deckDescription = `Generated from Study Assistant - ${allCardsInNote.length} cards`;
          
          // Call the Anki export utility
          blob = await generateAnkiPackage(
            allCardsInNote, 
            deckName,
            deckDescription
          );
        } catch (ankiError) {
          console.error('[Export] Error generating Anki package:', ankiError);
          toast.error('Failed to generate Anki package. Check console for details.');
          return;
        }

      } else if (format === 'pdf') {
        // UPDATED: Simple PDF export implementation
        toast.info('Generating PDF, please wait...');
        try {
          // Import the pdf-lib library dynamically to avoid loading it unless needed
          const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
          
          // Create a new PDF document
          const pdfDoc = await PDFDocument.create();
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          
          // Create cards (1 per page with front/back split)
          for (const card of allCardsInNote) {
            const page = pdfDoc.addPage([500, 700]);
            
            // Draw front side (top half)
            page.drawText('FRONT:', { 
              x: 50, 
              y: 650, 
              size: 14,
              font: helveticaBold,
              color: rgb(0.3, 0.3, 0.8)
            });
            
            page.drawText(card.front, {
              x: 50,
              y: 620,
              size: 12,
              font: helveticaFont,
              width: 400,
              lineHeight: 18,
              color: rgb(0, 0, 0)
            });
            
            // Draw divider
            page.drawLine({
              start: { x: 50, y: 350 },
              end: { x: 450, y: 350 },
              thickness: 1,
              color: rgb(0.8, 0.8, 0.8),
            });
            
            // Draw back side (bottom half)
            page.drawText('BACK:', { 
              x: 50, 
              y: 320, 
              size: 14,
              font: helveticaBold,
              color: rgb(0.8, 0.3, 0.3)
            });
            
            page.drawText(card.back, {
              x: 50,
              y: 290,
              size: 12,
              font: helveticaFont,
              width: 400,
              lineHeight: 18,
              color: rgb(0, 0, 0)
            });
            
            // Page number at the bottom
            page.drawText(`Card ${allCardsInNote.indexOf(card) + 1} of ${allCardsInNote.length}`, {
              x: 380,
              y: 50,
              size: 10,
              font: helveticaFont,
              color: rgb(0.5, 0.5, 0.5)
            });
          }
          
          // Serialize the PDF to bytes and create blob
          const pdfBytes = await pdfDoc.save();
          blob = new Blob([pdfBytes], { type: 'application/pdf' });
          
        } catch (pdfError) {
          console.error('[Export] Error generating PDF:', pdfError);
          toast.error('Failed to generate PDF. Check console for details.');
          return;
        }
      }

      // --- Trigger download if blob was created --- 
      if (blob) {
        const link = document.createElement('a');
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(`Flashcards exported as ${format.toUpperCase()}.`);
        } else {
          toast.error("Browser does not support file download.");
        }
      }

    } catch (error: any) {
      console.error(`Error exporting flashcards as ${format}:`, error);
      toast.error(`Failed to export flashcards: ${error.message || 'Unknown error'}`);
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
      toolsContent={currentNoteId && savedNotes[currentNoteId] ? (
        <div className="space-y-4">
          {renderAudioButton()}
          {renderFlashcardButton()}

          {currentNoteId && savedNotes[currentNoteId]?.audio?.concise && (
            <AudioPlayer
              audio={savedNotes[currentNoteId].audio.concise}
              onRegenerate={() => handleGenerateAudio('concise')}
              isRegenerating={isGeneratingAudio && currentAudioStyle === 'concise'}
            />
          )}

          {currentNoteId && savedNotes[currentNoteId]?.audio?.detailed && (
            <AudioPlayer
              audio={savedNotes[currentNoteId].audio.detailed}
              onRegenerate={() => handleGenerateAudio('detailed')}
              isRegenerating={isGeneratingAudio && currentAudioStyle === 'detailed'}
            />
          )}

          {currentNoteId && savedNotes[currentNoteId]?.flashcards && savedNotes[currentNoteId].flashcards.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Flashcards</h4>
                <span className="text-sm text-gray-500">
                  {savedNotes[currentNoteId].flashcards.length} cards
                </span>
              </div>
              <button
                onClick={startReviewSession} 
                className="w-full mt-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                disabled={showFlashcardModal || isGeneratingFlashcards} 
              >
                Review Flashcards
              </button>

              {/* --- Export Dropdown --- */}
              <div className="relative inline-block w-full mt-2"> {/* Added mt-2 */} 
                <button
                  onClick={() => setShowExportOptions(prev => !prev)}
                  className="w-full px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 flex items-center justify-between"
                  disabled={!savedNotes[currentNoteId]?.flashcards?.length}
                >
                  Export Flashcards
                  <svg className={`w-4 h-4 transition-transform duration-200 ${showExportOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showExportOptions && (
                  <div className="absolute right-0 mt-1 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      <button
                        onClick={() => handleExport('apkg')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        role="menuitem"
                      >
                        Export as .apkg (Anki)
                      </button>
                      <button
                        onClick={() => handleExport('txt')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        role="menuitem"
                      >
                        Export as .txt
                      </button>
                      <button
                        onClick={() => handleExport('pdf')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        role="menuitem"
                      >
                        Export as .pdf (Printable)
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* ----------------------- */}
              
              <FlashcardPreview 
                flashcards={savedNotes[currentNoteId].flashcards}
                onSave={(flashcards) => {
                  if (currentNoteId) {
                    handleSaveFlashcards(currentNoteId, flashcards)
                  }
                }}
              />
            </div>
          )}
        </div>
      ) : null}
    >
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 2000,
          className: 'bg-white'
        }}
      />
      <div className="h-full">
        {/* Restore Modals */}
        {showTitlePrompt && pendingNote && (
          <TitlePrompt
            defaultTitle={pendingNote.sourceFiles[0]?.file.name || 'New Note'}
            onConfirm={handleTitleConfirm}
            onCancel={() => {
              setShowTitlePrompt(false);
              setPendingNote(null);
            }}
          />
        )}

        {showAudioModal && (
          <AudioGenerateModal
            onClose={() => setShowAudioModal(false)}
            onGenerate={handleGenerateAudio}
            isGenerating={isGeneratingAudio}
          />
        )}

        {/* --- Updated FlashcardModal Call --- */}
        {showFlashcardModal && reviewQueue.length > 0 && currentNoteId && (
          <FlashcardModal
            key={`flashcard-modal-${reviewIndex}`}
            flashcards={reviewQueue} 
            currentIndex={reviewIndex}
            totalCardsInSession={reviewSessionOriginalCount} 
            onClose={() => { 
              console.log("[Modal Close] Closing and clearing session state.");
              setShowFlashcardModal(false);
              setReviewQueue([]); 
              setReviewIndex(0);
              setNewCardIdsInQueue(new Set());
              setCardGoodCounts({});
              setReviewSessionOriginalCount(0);
              setSessionNewCount(0);
              setSessionDueCount(0);
            }}
            onUpdate={(updatedFlashcards) => { 
              console.warn('[App] FlashcardModal onUpdate called - check if still needed');
            }}
            onResponse={handleFlashcardResponse} 
            onPrevious={handlePreviousCard}      
            sessionNewCount={sessionNewCount}
            sessionDueCount={sessionDueCount}
          />
        )}
        {/* -------------------------------- */}

        {/* Restore View Content */}
        {currentView === 'home' ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <Sparkles className="w-12 h-12 text-blue-600" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  7P
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
          <div className="h-full" onKeyDown={handleKeyDown}>
            <div className="flex justify-between items-center mb-6">
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
            
            <div className="bg-white mt-8">
              <textarea
                value={editorValue}
                onChange={handleNoteContentChange}
                className="w-full h-[calc(100vh-200px)] font-mono text-sm leading-relaxed p-4 focus:outline-none"
                spellCheck={false}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

export default App;