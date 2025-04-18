import axios from 'axios';
import { Flashcard, SavedNote } from '../types';
import { getFileContent } from './fileStorage';

/**
 * Migrates existing flashcards to the new spaced repetition system
 * @param savedNotes Record of all saved notes with their flashcards
 * @returns Promise containing the number of successfully migrated cards
 */
export async function migrateFlashcards(savedNotes: Record<string, SavedNote>): Promise<number> {
  let migratedCount = 0;
  
  try {
    // First, ensure the default note type exists
    await axios.post('http://localhost:3001/api/note-types/default');
    
    // Process each note with flashcards
    for (const noteId in savedNotes) {
      const note = savedNotes[noteId];
      
      if (!note.flashcards || note.flashcards.length === 0) {
        continue;
      }
      
      // Get the first source file if it exists
      const sourceFile = note.files[0];
      const sourceDocumentId = noteId;
      
      // Process each flashcard
      for (const card of note.flashcards) {
        try {
          // Create field values for the new system
          const fieldValues = {
            Front: card.front,
            Back: card.back,
            SourceText: card.sourceText || '',
            PageNumber: card.pageNumber?.toString() || '',
            SourceDocumentId: sourceDocumentId
          };
          
          // Create a note in the new system
          const response = await axios.post('http://localhost:3001/api/notes', {
            noteTypeId: 'default', // Will use the default note type
            fieldValues
          });
          
          migratedCount++;
          
          // If the card has an image reference, try to migrate that too
          if (card.pageNumber !== undefined) {
            try {
              // Try to get the image for this page
              const imageKey = `image_${sourceDocumentId}_${card.pageNumber}`;
              const imageData = await getFileContent(sourceDocumentId, imageKey);
              if (imageData) {
                // TODO: Store the image in the new system if needed
              }
            } catch (imageError) {
              console.warn(`Failed to migrate image for card at page ${card.pageNumber}`, imageError);
            }
          }
        } catch (cardError) {
          console.error(`Failed to migrate card: ${card.id}`, cardError);
        }
      }
    }
    
    return migratedCount;
  } catch (error) {
    console.error('Flashcard migration failed:', error);
    throw error;
  }
} 