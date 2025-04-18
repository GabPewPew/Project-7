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

    const response = await axios.post('/api/generate-flashcards', {
      noteContent: options.noteContent,
      rawText: options.rawText
    });

    // Log the raw response for debugging
    console.log('🧠 Gemini RAW response preview:', {
      preview: response.data.raw?.substring(0, 500),
      length: response.data.raw?.length
    });

    // Temporary: Return empty array while debugging
    console.log('⚠️ Debug mode: Returning empty flashcard array');
    return [];

  } catch (error) {
    console.error('❌ Failed to generate flashcards:', error);
    throw error;
  }
}