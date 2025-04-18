/**
 * Utility for exporting flashcards to Anki .apkg format
 * Uses anki-apkg-export library
 */
import AnkiExport from 'anki-apkg-export';
import { Flashcard } from '../types';
import { initializeSqlJs } from './ankiAdapter';

// Initialize SQL.js before using the library
let isInitialized = false;

/**
 * Generate an Anki .apkg file from flashcards
 * 
 * @param flashcards Array of flashcards to export
 * @param deckName Name of the deck
 * @param deckDescription Optional description for the deck
 * @returns Promise with blob containing .apkg file
 */
export const generateAnkiPackage = async (
  flashcards: Flashcard[],
  deckName: string,
  deckDescription?: string
): Promise<Blob> => {
  try {
    console.log(`[Anki Export] Generating package for ${flashcards.length} cards in deck "${deckName}"`);
    
    // Initialize SQL.js if needed
    if (!isInitialized) {
      await initializeSqlJs();
      isInitialized = true;
    }
    
    // Create a new Anki Export instance with deck info
    const apkg = new AnkiExport(deckName, {
      // Optional deck configuration
      description: deckDescription || `Exported from Study Assistant - ${flashcards.length} cards`,
      // Use a default model for Basic cards (front/back)
      // Default options create cards with Front and Back fields
    });

    // Sanitize card content and add to the deck
    for (let i = 0; i < flashcards.length; i++) {
      const card = flashcards[i];
      // Clean HTML in the content
      const front = sanitizeContent(card.front);
      const back = sanitizeContent(card.back);
      
      // Add media if present
      if (card.pageImage) {
        try {
          // Convert base64 to binary for image
          const imageName = `img_${i}.png`;
          const imageData = base64ToArrayBuffer(card.pageImage);
          apkg.addMedia(imageName, imageData);
          
          // Append image reference to the back
          const backWithImage = `${back}<br><br><img src="${imageName}">`;
          apkg.addCard(front, backWithImage);
        } catch (imageError) {
          console.error(`[Anki Export] Error adding image for card ${i}:`, imageError);
          // Fall back to text-only card
          apkg.addCard(front, back);
        }
      } else {
        // Add text-only card
        apkg.addCard(front, back);
      }
    }

    // Generate the package
    console.log(`[Anki Export] Finalizing package...`);
    const zip = await apkg.save();
    console.log(`[Anki Export] Package generated successfully!`);
    
    return zip;
  } catch (error) {
    console.error('[Anki Export] Error generating package:', error);
    throw new Error('Failed to generate Anki package');
  }
};

/**
 * Clean HTML content for Anki cards
 */
function sanitizeContent(content: string): string {
  // Strip potentially dangerous tags/scripts but preserve formatting
  // Basic sanitization - for a production app, use a proper sanitizer library
  let cleaned = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Replace newlines with <br> tags for Anki
  cleaned = cleaned.replace(/\n/g, '<br>');
  
  return cleaned;
}

/**
 * Convert base64 image data to ArrayBuffer for Anki media
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Extract actual base64 data if it includes the data URL prefix
  const base64Data = base64.includes('base64,') 
    ? base64.split('base64,')[1]
    : base64;
  
  // Decode base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

export default generateAnkiPackage; 