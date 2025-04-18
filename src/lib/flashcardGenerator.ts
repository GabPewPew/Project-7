import axios from 'axios';
import { Flashcard } from '../types';

interface FlashcardGenerationOptions {
  noteContent: string;
  rawText?: string;
}

export async function generateFlashcards(
  options: FlashcardGenerationOptions
): Promise<Flashcard[]> {
  try {
    if (!options.noteContent) {
      throw new Error('Note content is required');
    }

    console.log('📝 Generating flashcards...');
    console.log('Content length:', options.noteContent.length);
    if (options.rawText) {
      console.log('Raw text length:', options.rawText.length);
    }

    const response = await axios.post('http://localhost:3000/api/generate-flashcards', {
      noteContent: options.noteContent,
      rawText: options.rawText
    });

    // Log information about the received flashcards
    console.log(`🧠 Received ${response.data.count} flashcards from server`);
    
    if (!response.data.flashcards || !Array.isArray(response.data.flashcards)) {
      console.error('❌ Invalid flashcards response:', response.data);
      return [];
    }
    
    // Return the parsed flashcards from the server
    return response.data.flashcards;

  } catch (error) {
    console.error('❌ Failed to generate flashcards:', error);
    throw error;
  }
}