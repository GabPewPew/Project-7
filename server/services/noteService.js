import { PrismaClient } from '@prisma/client';
import { generateCardContent } from '../lib/templateRenderer.js';
import { config as srsConfig } from '../lib/srs.js';

const prisma = new PrismaClient();

/**
 * Creates or updates a note and generates its cards
 * @param {Object} noteData - Note data including noteTypeId and fieldValues
 * @returns {Promise<Object>} - The created/updated note with its cards
 */
export async function createOrUpdateNote(noteData) {
  try {
    // Parse fieldValues if it's a string
    const fieldValues = typeof noteData.fieldValues === 'string' 
      ? noteData.fieldValues 
      : JSON.stringify(noteData.fieldValues);
    
    // Fetch the note type to get its templates
    const noteType = await prisma.noteType.findUnique({
      where: { id: noteData.noteTypeId }
    });
    
    if (!noteType) {
      throw new Error(`Note type with ID ${noteData.noteTypeId} not found`);
    }
    
    // Parse note type card templates
    const cardTemplates = JSON.parse(noteType.cardTemplates);
    
    // If updating an existing note, delete its cards first
    if (noteData.id) {
      // Get the existing note to check if it exists
      const existingNote = await prisma.note.findUnique({
        where: { id: noteData.id }
      });
      
      if (!existingNote) {
        throw new Error(`Note with ID ${noteData.id} not found`);
      }
      
      // Delete existing cards (cascades to card progress)
      await prisma.card.deleteMany({
        where: { noteId: noteData.id }
      });
    }
    
    // Create or update the note
    const note = noteData.id
      ? await prisma.note.update({
          where: { id: noteData.id },
          data: {
            noteTypeId: noteData.noteTypeId,
            fieldValues: fieldValues,
            tags: noteData.tags ? JSON.stringify(noteData.tags) : null
          }
        })
      : await prisma.note.create({
          data: {
            noteTypeId: noteData.noteTypeId,
            fieldValues: fieldValues,
            tags: noteData.tags ? JSON.stringify(noteData.tags) : null
          }
        });
    
    // Generate cards for the note
    const cards = [];
    for (const template of cardTemplates) {
      const { frontContent, backContent } = generateCardContent(
        { fieldValues }, 
        template
      );
      
      // Extract source document and page number from field values if available
      const fieldValuesObj = JSON.parse(fieldValues);
      const sourceDocumentId = fieldValuesObj.sourceDocumentId || null;
      const sourcePageNumber = fieldValuesObj.pageNumber 
        ? parseInt(fieldValuesObj.pageNumber, 10) 
        : null;
      
      // Create the card
      const card = await prisma.card.create({
        data: {
          noteId: note.id,
          noteTypeCardTemplateName: template.name,
          frontContent,
          backContent,
          sourceDocumentId,
          sourcePageNumber,
          // Create progress record automatically
          progress: {
            create: {
              repetitions: 0,
              easeFactor: srsConfig.initialEaseFactor,
              interval: 0,
              dueDate: new Date(),
              state: 'new',
              learningStep: 0
            }
          }
        },
        include: {
          progress: true
        }
      });
      
      cards.push(card);
    }
    
    return {
      note,
      cards
    };
  } catch (error) {
    console.error('Error creating/updating note:', error);
    throw error;
  }
}

/**
 * Fetches a set of cards due for review
 * @param {Object} options - Options for fetching cards
 * @param {number} options.newLimit - Maximum number of new cards
 * @param {number} options.reviewLimit - Maximum number of review cards
 * @param {string} options.userId - User ID for progress tracking
 * @returns {Promise<Array>} - Array of cards ready for review
 */
export async function fetchDueCards({ newLimit = 20, reviewLimit = 100, userId = 'default_user' } = {}) {
  try {
    const now = new Date();
    
    // Fetch cards that are due for review (learning, relearning, or review)
    const dueCards = await prisma.card.findMany({
      where: {
        progress: {
          userId,
          dueDate: { lte: now },
          state: { in: ['learning', 'relearning', 'review'] }
        }
      },
      include: {
        progress: true
      },
      orderBy: {
        progress: {
          dueDate: 'asc'
        }
      },
      take: reviewLimit
    });
    
    // Fetch new cards if we have room in the queue
    const newCards = await prisma.card.findMany({
      where: {
        progress: {
          userId,
          state: 'new'
        }
      },
      include: {
        progress: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: newLimit
    });
    
    // Combine and shuffle the cards
    // For a proper implementation, you might want to interleave new cards with reviews
    // based on a configurable ratio, similar to how Anki does it
    const allCards = [...dueCards, ...newCards];
    
    // Basic shuffle
    for (let i = allCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }
    
    return allCards;
  } catch (error) {
    console.error('Error fetching due cards:', error);
    throw error;
  }
} 