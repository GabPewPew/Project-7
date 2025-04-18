import React, { useState, useEffect, useCallback } from 'react';
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
import { LearningIntent, ExamPrepStyle, ResearchStyle, ProcessingResult, SavedNote, NoteBlock, Flashcard } from './types';
import { FlashcardPreview } from './components/FlashcardPreview';
import { extractMultiplePageImages, extractPageImage, createBasicPdf } from './lib/pdfUtils';

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
  const [savedNotes, setSavedNotes] = useState<Record<string, SavedNote>>({});
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentAudioStyle, setCurrentAudioStyle] = useState<'concise' | 'detailed' | null>(null);
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);

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
        console.error(`Note not found with ID: ${noteId}`);
        return;
      }

      console.log(`Processing flashcards for note: "${note.title}"`);
      console.log(`Total flashcards: ${flashcards.length}`);

      // If we have flashcards with page numbers, try to add page images
      const flashcardsWithPageNumbers = flashcards.filter(card => card.pageNumber);
      
      console.log(`Found ${flashcardsWithPageNumbers.length} flashcards with page numbers`);
      
      if (flashcardsWithPageNumbers.length > 0) {
        try {
          // Get PDF file info from note
          console.log(`Attempting to get PDF file for note: "${note.title}"`);
          const pdfFile = await getPdfFileFromNote(note);
          
          if (pdfFile && pdfFile.size > 0 && pdfFile.type === 'application/pdf') {
            console.log(`Successfully retrieved PDF file: ${pdfFile.name}, Size: ${pdfFile.size} bytes, Type: ${pdfFile.type}`);
            
            // Test if the PDF is valid by trying to read the first few bytes
            try {
              const reader = new FileReader();
              const headerPromise = new Promise<boolean>((resolve) => {
                reader.onload = () => {
                  const result = reader.result;
                  if (result && typeof result === 'string' && result.startsWith('%PDF-')) {
                    console.log('PDF header verification successful');
                    resolve(true);
                  } else if (result && result instanceof ArrayBuffer) {
                    const bytes = new Uint8Array(result);
                    const header = String.fromCharCode(...bytes.slice(0, 5));
                    const isValid = header === '%PDF-';
                    console.log(`PDF header verification: ${isValid ? 'valid' : 'invalid'} (${header})`);
                    resolve(isValid);
                  } else {
                    console.error('PDF header verification failed - invalid result type');
                    resolve(false);
                  }
                };
                reader.onerror = () => {
                  console.error('PDF header verification failed - read error');
                  resolve(false);
                };
              });
              
              // Read just the first few bytes to check header
              reader.readAsText(pdfFile.slice(0, 8));
              
              const isValidPdf = await headerPromise;
              if (!isValidPdf) {
                throw new Error('Invalid PDF file - missing PDF header');
              }
            } catch (headerError) {
              console.error('PDF validation failed:', headerError);
              throw new Error('PDF validation failed');
            }
            
            // Use batch processing for better performance
            console.log(`Using batch processing to extract ${flashcardsWithPageNumbers.length} page images`);
            
            // Get all the page numbers we need to extract
            const pageNumbers = flashcardsWithPageNumbers
              .map(card => card.pageNumber)
              .filter((page): page is number => page !== undefined);
              
            // Create a map of page numbers to cards for easier updating later
            const pageToCardMap = new Map<number, Flashcard[]>();
            flashcardsWithPageNumbers.forEach(card => {
              if (card.pageNumber) {
                if (!pageToCardMap.has(card.pageNumber)) {
                  pageToCardMap.set(card.pageNumber, []);
                }
                pageToCardMap.get(card.pageNumber)?.push(card);
              }
            });
            
            try {
              // Extract all page images at once using our improved batch function
              console.log(`Extracting ${pageNumbers.length} page images from PDF...`);
              const pageImages = await extractMultiplePageImages(pdfFile, pageNumbers, 1.0);
              
              // Apply images to all cards based on their page number
              let successCount = 0;
              pageToCardMap.forEach((cards, pageNum) => {
                const image = pageImages.get(pageNum);
                if (image && image.length > 100 && 
                    (image.startsWith('data:image/jpeg') || image.startsWith('data:image/png'))) {
                  cards.forEach(card => {
                    card.pageImage = image;
                  });
                  successCount += cards.length;
                  console.log(`Applied image for page ${pageNum} to ${cards.length} flashcard(s)`);
                } else {
                  console.error(`No valid image found for page ${pageNum}`);
                }
              });
              
              console.log(`Successfully applied images to ${successCount} of ${flashcardsWithPageNumbers.length} flashcards`);
              
              // If we didn't get many successful images, try individual extraction as a fallback
              if (successCount < flashcardsWithPageNumbers.length / 2) {
                console.log(`Low success rate with batch extraction, trying individual processing for missing images...`);
                
                // Process remaining cards without images
                for (const card of flashcardsWithPageNumbers) {
                  if (card.pageNumber && !card.pageImage) {
                    try {
                      console.log(`Attempting individual extraction for page ${card.pageNumber}...`);
                      const pageImage = await extractPageImage(pdfFile, card.pageNumber, 1.0);
                      
                      if (pageImage && pageImage.length > 100 && 
                          (pageImage.startsWith('data:image/jpeg') || pageImage.startsWith('data:image/png'))) {
                        card.pageImage = pageImage;
                        console.log(`Successfully added image for page ${card.pageNumber}`);
                        successCount++;
                      }
                    } catch (err) {
                      console.error(`Failed individual image extraction for page ${card.pageNumber}:`, err);
                    }
                    
                    // Add a small delay to avoid browser throttling
                    await new Promise(resolve => setTimeout(resolve, 30));
                  }
                }
              }
            } catch (batchError) {
              console.error('Batch image extraction failed:', batchError);
              console.log('Falling back to individual page extraction...');
              
              // Process each card sequentially as a fallback
              let successCount = 0;
              
              for (let i = 0; i < flashcardsWithPageNumbers.length; i++) {
                const card = flashcardsWithPageNumbers[i];
                if (!card.pageNumber) continue;
                
                console.log(`Processing image for flashcard ${i+1}/${flashcardsWithPageNumbers.length} (page ${card.pageNumber})...`);
                
                try {
                  // Extract single page image
                  const pageImage = await extractPageImage(pdfFile, card.pageNumber, 1.0);
                  
                  // Verify image was generated successfully
                  if (pageImage && pageImage.length > 100 && 
                      (pageImage.startsWith('data:image/jpeg') || pageImage.startsWith('data:image/png'))) {
                    card.pageImage = pageImage;
                    console.log(`Successfully added image for page ${card.pageNumber}, image size: ${Math.round(pageImage.length/1024)}KB`);
                    successCount++;
                  } else {
                    console.error(`Image extraction returned invalid data for page ${card.pageNumber}, length: ${pageImage?.length || 0}`);
                    card.pageImage = undefined; // Clear invalid image data
                  }
                } catch (err) {
                  console.error(`Failed to extract image for page ${card.pageNumber}:`, err);
                  card.pageImage = undefined; // Make sure to clear any invalid partial data
                }
                
                // Add a small delay between processing to avoid browser throttling
                if (i < flashcardsWithPageNumbers.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
              
              console.log(`Individual processing complete - ${successCount} of ${flashcardsWithPageNumbers.length} images successfully extracted`);
            }
          } else {
            console.warn(`Could not load valid PDF file from note: "${note.title}"`);
            
            // Try to create a real PDF with page numbers
            console.log('Creating a basic PDF with page numbers for image extraction');
            
            try {
              // Create a basic PDF with enough pages
              const maxPageNumber = Math.max(...flashcardsWithPageNumbers
                .filter(card => card.pageNumber)
                .map(card => card.pageNumber || 0));
                
              const basicPdf = createBasicPdf(
                Math.max(maxPageNumber, 30), // Create more pages than needed
                note.title
              );
              
              console.log(`Created basic PDF with ${Math.max(maxPageNumber, 30)} pages`);
              
              // Extract all page images in a batch from the generated PDF
              const pageNumbers = flashcardsWithPageNumbers
                .map(card => card.pageNumber)
                .filter((page): page is number => page !== undefined);
                
              console.log(`Batch extracting ${pageNumbers.length} images from generated PDF...`);
              const pageImages = await extractMultiplePageImages(basicPdf, pageNumbers, 1.0);
              
              // Apply images to cards
              let successCount = 0;
              for (const card of flashcardsWithPageNumbers) {
                if (card.pageNumber) {
                  const image = pageImages.get(card.pageNumber);
                  if (image && image.length > 100 && 
                      (image.startsWith('data:image/jpeg') || image.startsWith('data:image/png'))) {
                    card.pageImage = image;
                    console.log(`Successfully added generated PDF image for page ${card.pageNumber}`);
                    successCount++;
                  } else {
                    console.warn(`No valid image for page ${card.pageNumber} from generated PDF`);
                    // Fall back to test image
                    const testImage = await createEnhancedPlaceholderImage(card.pageNumber, note.title);
                    if (testImage && testImage.length > 100) {
                      card.pageImage = testImage;
                      console.log(`Falling back to test image for page ${card.pageNumber}`);
                    }
                  }
                }
              }
              
              console.log(`Generated PDF processing complete - ${successCount} images extracted`);
              
              // If we didn't get any successful images from the generated PDF, fall back to test images
              if (successCount === 0) {
                throw new Error('No images successfully extracted from generated PDF');
              }
            } catch (pdfError) {
              console.error('Error using generated PDF:', pdfError);
              
              // Since we couldn't load an actual PDF, create a test/placeholder image
              console.log(`Creating test images for flashcards instead`);
              
              for (let i = 0; i < flashcardsWithPageNumbers.length; i++) {
                const card = flashcardsWithPageNumbers[i];
                if (!card.pageNumber) continue;
                
                try {
                  // Create a test image with the page number embedded in it
                  const testImage = await createEnhancedPlaceholderImage(card.pageNumber, note.title);
                  if (testImage && testImage.length > 100) {
                    card.pageImage = testImage;
                    console.log(`Added test image for flashcard with page ${card.pageNumber}`);
                  }
                } catch (err) {
                  console.error(`Failed to create test image for page ${card.pageNumber}:`, err);
                }
                
                // Add a small delay between operations
                if (i < flashcardsWithPageNumbers.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 20));
                }
              }
            }
          }
        } catch (imageError) {
          console.error(`Error adding page images to flashcards for note "${note.title}":`, imageError);
          
          // If there was an error, still try to add test images
          console.log(`Creating test images as fallback after error`);
          
          for (const card of flashcardsWithPageNumbers) {
            if (!card.pageNumber) continue;
            
            try {
              const testImage = await createEnhancedPlaceholderImage(card.pageNumber, note.title);
              if (testImage && testImage.length > 100) {
                card.pageImage = testImage;
                console.log(`Added fallback test image for page ${card.pageNumber}`);
              }
            } catch (err) {
              console.error(`Failed to create fallback test image:`, err);
            }
          }
        }
      }

      // Remove any invalid pageImage values before saving
      flashcards.forEach(card => {
        if (card.pageImage && (card.pageImage.length < 100 || 
            (!card.pageImage.startsWith('data:image/jpeg') && 
             !card.pageImage.startsWith('data:image/png')))) {
          console.log(`Removing invalid image data for card with page ${card.pageNumber}`);
          card.pageImage = undefined;
        }
      });

      // Save the flashcards to the note
      console.log(`Saving ${flashcards.length} flashcards to note: "${note.title}"`);
      await noteSaver.updateNote(noteId, note.current.content, undefined, undefined, flashcards);
      const notes = noteSaver.loadNotesFromStorage();
      setSavedNotes(notes);
      
      // Only show toast if not silent
      if (!silent) {
        toast.success('Flashcards updated');
      }
    } catch (error) {
      console.error('Failed to update flashcards:', error);
      if (!silent) {
        toast.error('Failed to update flashcards');
      }
    }
  };

  // Helper function to get PDF file from note with improved error handling
  const getPdfFileFromNote = async (note: SavedNote): Promise<File | null> => {
    try {
      console.log(`Attempting to extract PDF file from note "${note.title}"`);
      
      // Deeper analysis of note structure
      console.log('Full note structure for debugging:', {
        id: note.id,
        title: note.title,
        filesCount: note.files.length,
        fileInfo: note.files.map(f => ({
          name: f.fileName,
          keys: Object.keys(f),
          hasFileUrl: !!f.fileUrl,
          fileUrlType: f.fileUrl ? typeof f.fileUrl : 'none',
          fileUrlLength: f.fileUrl ? f.fileUrl.length : 0,
          fileUrlStart: f.fileUrl ? f.fileUrl.substring(0, 50) + '...' : 'none'
        })),
        // Include other note properties that might contain PDF data
        hasCurrentVersion: !!note.current,
        currentVersionKeys: note.current ? Object.keys(note.current) : [],
        hasContent: !!note.current?.content,
        contentLength: note.current?.content?.length || 0,
        contentStart: note.current?.content ? note.current.content.substring(0, 50) + '...' : 'none',
        rootKeys: Object.keys(note)
      });

      // Check if note.files might be storing content directly (not as objects)
      if (note.files.length > 0 && typeof note.files[0] === 'string') {
        console.log(`Note files appear to be stored as strings, not objects`);
        try {
          const fileContent = note.files[0] as unknown as string;
          const file = new File([fileContent], note.title, { type: 'application/pdf' });
          console.log(`Created file from direct string content: ${file.name}, size: ${file.size} bytes`);
          return file;
        } catch (err) {
          console.error(`Failed to create file from string content:`, err);
        }
      }

      // Check if PDF data is embedded in the note content
      if (note.current?.content && note.title.toLowerCase().endsWith('.pdf')) {
        console.log(`Checking if PDF data is embedded in note content`);
        const content = note.current.content;
        
        // Look for base64 PDF data in the content
        const pdfBase64Match = content.match(/data:application\/pdf;base64,([A-Za-z0-9+/=]+)/);
        if (pdfBase64Match && pdfBase64Match[1]) {
          console.log(`Found base64 PDF data embedded in note content`);
          try {
            const base64Data = pdfBase64Match[1];
            const binaryData = atob(base64Data);
            const bytes = new Uint8Array(binaryData.length);
            
            for (let i = 0; i < binaryData.length; i++) {
              bytes[i] = binaryData.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const file = new File([blob], note.title, { type: 'application/pdf' });
            
            console.log(`Created PDF file from embedded base64: ${file.name}, size: ${file.size} bytes`);
            return file;
          } catch (err) {
            console.error(`Failed to extract embedded PDF:`, err);
          }
        }
      }

      // Check if the actual PDF content might be stored in note content
      if (note.current?.content && note.current.content.startsWith('%PDF-')) {
        console.log(`Note content appears to be raw PDF data`);
        try {
          const blob = new Blob([note.current.content], { type: 'application/pdf' });
          const file = new File([blob], note.title, { type: 'application/pdf' });
          console.log(`Created PDF from raw content: ${file.name}, size: ${file.size} bytes`);
          return file;
        } catch (err) {
          console.error(`Failed to create PDF from raw content:`, err);
        }
      }

      // Rest of existing code - Check for PDF files
      const pdfFileData = note.files.find((f: { fileName: string }) => 
        f.fileName.toLowerCase().endsWith('.pdf')
      );
      
      if (!pdfFileData) {
        console.error(`No PDF file found in note files`);
        return null;
      }
      
      // Log the exact structure of the PDF file data
      console.log(`PDF file data structure:`, JSON.stringify(pdfFileData, null, 2));
      
      // Even if fileUrl is missing, check if the file data itself might have PDF content
      if (!pdfFileData.fileUrl) {
        console.error(`PDF file found but missing fileUrl property`);
        console.log(`PDF file properties:`, Object.keys(pdfFileData));
        
        // Try to extract the PDF data from various possible properties
        if ((pdfFileData as any).content) {
          console.log(`Found content property instead of fileUrl`);
          // Create a blob from the content
          const blob = new Blob([(pdfFileData as any).content], { type: 'application/pdf' });
          return new File([blob], pdfFileData.fileName, { type: 'application/pdf' });
        } else if ((pdfFileData as any).raw) {
          console.log(`Found raw property instead of fileUrl`);
          // Create a blob from the raw content
          const blob = new Blob([(pdfFileData as any).raw], { type: 'application/pdf' });
          return new File([blob], pdfFileData.fileName, { type: 'application/pdf' });
        } else if ((pdfFileData as any).data) {
          console.log(`Found data property instead of fileUrl`);
          // Create a blob from the data
          const blob = new Blob([(pdfFileData as any).data], { type: 'application/pdf' });
          return new File([blob], pdfFileData.fileName, { type: 'application/pdf' });
        } else {
          // If we can't find any content property, try to stringify the entire object
          console.log(`No content property found, trying to use the entire object`);
          try {
            const pdfString = JSON.stringify(pdfFileData);
            // Check if the stringified object contains PDF header
            if (pdfString.includes('%PDF-')) {
              console.log(`PDF header found in stringified object`);
              const blob = new Blob([pdfString], { type: 'application/pdf' });
              return new File([blob], pdfFileData.fileName, { type: 'application/pdf' });
            }
          } catch (err) {
            console.error(`Failed to stringify PDF file data:`, err);
          }
        }
        
        // Try to see if the file data itself might be the PDF content (if it's actually a string)
        if (typeof pdfFileData === 'string') {
          console.log(`PDF file data is a string, using directly`);
          const blob = new Blob([pdfFileData], { type: 'application/pdf' });
          return new File([blob], note.title, { type: 'application/pdf' });
        }
        
        return null;
      }
      
      // Continue with existing code...
      console.log(`Found PDF file in note "${note.title}": ${pdfFileData.fileName}`);
      console.log(`FileUrl type: ${typeof pdfFileData.fileUrl}, length: ${pdfFileData.fileUrl.length}`);
      
      // Try multiple methods to get the PDF data
      try {
        // Method 1: If the fileUrl is a data URL (base64-encoded PDF)
        if (pdfFileData.fileUrl.startsWith('data:application/pdf;base64,')) {
          console.log(`PDF is stored as a data URL, extracting...`);
          
          try {
            // Extract the base64 data
            const base64Data = pdfFileData.fileUrl.split(',')[1];
            if (!base64Data) {
              throw new Error('Invalid data URL format');
            }
            
            // Convert base64 to binary
            const binaryData = atob(base64Data);
            const bytes = new Uint8Array(binaryData.length);
            
            for (let i = 0; i < binaryData.length; i++) {
              bytes[i] = binaryData.charCodeAt(i);
            }
            
            // Create File object from binary data
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const file = new File([blob], pdfFileData.fileName, { type: 'application/pdf' });
            
            if (file.size === 0) {
              throw new Error('Generated PDF file has zero size');
            }
            
            console.log(`Successfully extracted PDF from data URL (${file.size} bytes)`);
            return file;
          } catch (dataUrlError) {
            console.error('Failed to extract PDF from data URL:', dataUrlError);
            // Continue to next method
          }
        }
        
        // Method 2: If the fileUrl is a URL or relative path
        console.log(`Attempting to fetch PDF file from URL...`);
        
        try {
          return await fetchPdfFromUrl(pdfFileData.fileUrl, pdfFileData.fileName);
        } catch (fetchError) {
          console.error('Failed to fetch PDF:', fetchError);
          // Continue to next method
        }
        
        // If fileUrl isn't a data URL or fetchable URL, it might be raw content
        console.log(`Treating fileUrl as raw content...`);
        try {
          const blob = new Blob([pdfFileData.fileUrl], { type: 'application/pdf' });
          const file = new File([blob], pdfFileData.fileName, { type: 'application/pdf' });
          console.log(`Created PDF from fileUrl as content: ${file.name}, size: ${file.size} bytes`);
          return file;
        } catch (rawError) {
          console.error('Failed to create PDF from raw content:', rawError);
        }
        
        // If all methods failed, create a minimal placeholder PDF
        console.warn(`All PDF extraction methods failed, creating placeholder`);
        const minimalPdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;
        
        const dummyBlob = new Blob([minimalPdfContent], { type: 'application/pdf' });
        return new File([dummyBlob], pdfFileData.fileName, { type: 'application/pdf' });
      } catch (error) {
        console.error(`All methods to extract PDF failed:`, error);
        return null;
      }
    } catch (error) {
      console.error(`Error in getPdfFileFromNote:`, error);
      return null;
    }
  };

  // Helper function to fetch a PDF from a URL
  const fetchPdfFromUrl = async (url: string, fileName: string): Promise<File> => {
    console.log(`Fetching PDF from URL: ${url.substring(0, 50)}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    if (blob.size === 0) {
      throw new Error('Fetched PDF has zero size');
    }
    
    const file = new File([blob], fileName, { type: 'application/pdf' });
    console.log(`Successfully fetched PDF (${file.size} bytes)`);
    return file;
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

              const rawContent = note.files[0]?.fileUrl || '';

              const flashcards = await generateFlashcards({
                noteContent: note.current.content,
                rawText: rawContent
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

            const rawContent = note.files[0]?.fileUrl || '';

            const flashcards = await generateFlashcards({
              noteContent: note.current.content,
              rawText: rawContent
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
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, width - 20, height - 20);
      
      // Draw diagonal lines in corners to indicate test image
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(50, 50);
      ctx.moveTo(width - 10, 10);
      ctx.lineTo(width - 50, 50);
      ctx.moveTo(10, height - 10);
      ctx.lineTo(50, height - 50);
      ctx.moveTo(width - 10, height - 10);
      ctx.lineTo(width - 50, height - 50);
      ctx.stroke();
      
      // Convert to JPEG with medium quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log(`Test image created successfully, size: ${Math.round(dataUrl.length/1024)}KB`);
      return dataUrl;
    } catch (error) {
      console.error('Error creating test image:', error);
      return '';
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
                onClick={() => setShowFlashcardModal(true)}
                className="w-full mt-2 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                Review Flashcards
              </button>
              
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

        {showAudioModal && (
          <AudioGenerateModal
            onClose={() => setShowAudioModal(false)}
            onGenerate={handleGenerateAudio}
            isGenerating={isGeneratingAudio}
          />
        )}

        {showFlashcardModal && currentNoteId && savedNotes[currentNoteId]?.flashcards && (
          <FlashcardModal
            flashcards={savedNotes[currentNoteId].flashcards.map(flashcard => {
              // Extra debug logging for each flashcard
              if (flashcard.pageNumber) {
                console.log(`Flashcard with page ${flashcard.pageNumber}: Image ${!!flashcard.pageImage ? 'exists' : 'missing'}, Length: ${flashcard.pageImage?.length || 0}`);
                if (flashcard.pageImage) {
                  console.log(`Image data starts with: ${flashcard.pageImage.substring(0, 30)}...`);
                }
              }
              
              return {
                ...flashcard,
                // Ensure pageImage is a string if it exists
                pageImage: flashcard.pageImage || undefined
              };
            })}
            onClose={() => setShowFlashcardModal(false)}
            onUpdate={(flashcards) => {
              if (currentNoteId) {
                handleSaveFlashcards(currentNoteId, flashcards);
              }
            }}
          />
        )}

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