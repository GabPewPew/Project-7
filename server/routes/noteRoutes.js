import express from 'express';
import { createOrUpdateNote, fetchDueCards } from '../services/noteService.js';
import { calculateNextReview } from '../lib/srs.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Create or update a note
router.post('/notes', async (req, res) => {
  try {
    const { noteTypeId, fieldValues, tags, id } = req.body;
    
    if (!noteTypeId || !fieldValues) {
      return res.status(400).json({ error: 'noteTypeId and fieldValues are required' });
    }
    
    const result = await createOrUpdateNote({
      id,
      noteTypeId,
      fieldValues,
      tags
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in POST /notes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cards due for review
router.get('/session/cards', async (req, res) => {
  try {
    const { newLimit = 20, reviewLimit = 100, userId = 'default_user' } = req.query;
    
    const cards = await fetchDueCards({
      newLimit: parseInt(newLimit, 10),
      reviewLimit: parseInt(reviewLimit, 10),
      userId
    });
    
    res.status(200).json({
      cards,
      counts: {
        new: cards.filter(card => card.progress.state === 'new').length,
        learning: cards.filter(card => card.progress.state === 'learning').length,
        relearning: cards.filter(card => card.progress.state === 'relearning').length,
        review: cards.filter(card => card.progress.state === 'review').length,
        total: cards.length
      }
    });
  } catch (error) {
    console.error('Error in GET /session/cards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit a response for a card
router.post('/session/response', async (req, res) => {
  try {
    const { cardId, response, userId = 'default_user' } = req.body;
    
    if (!cardId || !response) {
      return res.status(400).json({ error: 'cardId and response are required' });
    }
    
    // Valid responses are 'again', 'hard', 'good', 'easy'
    if (!['again', 'hard', 'good', 'easy'].includes(response)) {
      return res.status(400).json({ error: 'Invalid response value' });
    }
    
    // Fetch the card progress
    const progress = await prisma.cardProgress.findUnique({
      where: {
        cardId
      }
    });
    
    if (!progress) {
      return res.status(404).json({ error: 'Card progress not found' });
    }
    
    // Calculate the next review
    const updatedProgress = calculateNextReview(progress, response);
    
    // Update the progress in the database
    const result = await prisma.cardProgress.update({
      where: {
        id: progress.id
      },
      data: {
        repetitions: updatedProgress.repetitions,
        easeFactor: updatedProgress.easeFactor,
        interval: updatedProgress.interval,
        dueDate: updatedProgress.dueDate,
        state: updatedProgress.state,
        learningStep: updatedProgress.learningStep,
        lastReviewDate: updatedProgress.lastReviewDate
      }
    });
    
    res.status(200).json({
      success: true,
      updatedProgress: result
    });
  } catch (error) {
    console.error('Error in POST /session/response:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all cards for browsing
router.get('/cards/all', async (req, res) => {
  try {
    const { page = 1, limit = 50, userId = 'default_user' } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const cards = await prisma.card.findMany({
      include: {
        progress: true,
        note: {
          select: {
            fieldValues: true,
            noteType: {
              select: {
                name: true
              }
            }
          }
        }
      },
      skip,
      take: parseInt(limit, 10),
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const totalCards = await prisma.card.count();
    
    res.status(200).json({
      cards,
      pagination: {
        total: totalCards,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(totalCards / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error in GET /cards/all:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create default note type if it doesn't exist
router.post('/note-types/default', async (req, res) => {
  try {
    // Check if default note type already exists
    const existingNoteType = await prisma.noteType.findFirst({
      where: {
        name: 'PDF Extract'
      }
    });
    
    if (existingNoteType) {
      return res.status(200).json({
        message: 'Default note type already exists',
        noteType: existingNoteType
      });
    }
    
    // Create default PDF Extract note type
    const defaultNoteType = await prisma.noteType.create({
      data: {
        name: 'PDF Extract',
        fields: JSON.stringify([
          'Front',
          'Back',
          'SourceText',
          'PageNumber',
          'SourceDocumentId'
        ]),
        cardTemplates: JSON.stringify([
          {
            name: 'Card 1',
            frontTemplate: '<div class="front">{{Front}}</div>',
            backTemplate: `
              <div class="back">
                <div class="question">{{Front}}</div>
                <hr>
                <div class="answer">{{Back}}</div>
                {{#if PageNumber}}
                <div class="source">
                  <small>Source: Page {{PageNumber}}</small>
                </div>
                {{/if}}
                {{#if SourceText}}
                <div class="source-text">
                  <small>{{SourceText}}</small>
                </div>
                {{/if}}
              </div>
            `
          }
        ]),
        styling: `
          .card {
            font-family: Arial, sans-serif;
            font-size: 16px;
            text-align: center;
            color: black;
            background-color: white;
            padding: 20px;
          }
          .front {
            font-size: 1.2em;
          }
          .back {
            text-align: left;
          }
          .question {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .answer {
            margin: 10px 0;
          }
          .source, .source-text {
            color: #666;
            font-size: 0.8em;
            margin-top: 15px;
            border-top: 1px solid #eee;
            padding-top: 5px;
          }
        `
      }
    });
    
    res.status(201).json({
      message: 'Default note type created',
      noteType: defaultNoteType
    });
  } catch (error) {
    console.error('Error in POST /note-types/default:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 