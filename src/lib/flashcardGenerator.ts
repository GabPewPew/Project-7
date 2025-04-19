import axios from 'axios';
import { Flashcard } from '../types';

interface FlashcardGenerationOptions {
  noteId: string;
  noteTitle: string;
  noteContent: string;
  rawText?: string;
}

export async function generateFlashcards(
  options: FlashcardGenerationOptions
): Promise<Flashcard[]> {
  try {
    if (!options.noteId || !options.noteTitle || !options.noteContent) {
      throw new Error('Note ID, Note Title, and Note Content are required for flashcard generation');
    }

    console.log('📝 Generating flashcards for Note:', options.noteTitle, `(ID: ${options.noteId})`);
    console.log('Content length:', options.noteContent.length);
    if (options.rawText) {
      console.log('Raw text length:', options.rawText.length);
    }

    // Make request to the backend API
    console.log('Making request to /api/generate-flashcards');
    const response = await axios.post('/api/generate-flashcards', {
      noteId: options.noteId,
      noteTitle: options.noteTitle,
      noteContent: options.noteContent,
      rawText: options.rawText
    });

    // Log detailed information about the received response
    console.log(`🧠 Received response with status ${response.status}`);
    console.log(`🧠 Response data:`, JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    console.log(`🧠 Card count from response:`, response.data.count);
    
    if (!response.data.cards || !Array.isArray(response.data.cards)) {
      console.error('❌ Invalid flashcards response:', response.data);
      return [];
    }
    
    // Log information about the first card to help with debugging
    if (response.data.cards.length > 0) {
      console.log('🧠 First card sample:', {
        id: response.data.cards[0].id, 
        front: response.data.cards[0].frontContent?.substring(0, 50),
        back: response.data.cards[0].backContent?.substring(0, 50),
      });
    }
    
    // Map server response to client Flashcard format
    const flashcards: Flashcard[] = response.data.cards.map((card: any) => ({
      id: card.id,
      front: card.frontContent,
      back: card.backContent,
      noteId: card.noteId,
      pageNumber: card.sourcePageNumber,
      sourceText: card.sourceText || '',
      images: []
    }));
    
    console.log(`✅ Successfully processed ${flashcards.length} flashcards`);
    return flashcards;

  } catch (error: any) {
    console.error('❌ Failed to generate flashcards:', error);
    if (error.response) {
      console.error('❌ Server response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}