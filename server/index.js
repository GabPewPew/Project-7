// Define global constants first
const DEMO_USER_ID = 'demo_user';

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import noteRoutes from './routes/noteRoutes.js';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Force port 3000 always
const port = 3000;

console.log(`🔧 Starting server on port ${port}`);

const prisma = new PrismaClient();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'dist')));

const ttsClient = new TextToSpeechClient({
  keyFilename: path.join(__dirname, 'google-credentials.json'),
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- In-Memory Storage for Flashcard Progress (Replace with DB) ---
// Structure: { "userId": { "flashcardId": { ease, intervalDays, dueDate, ... } } }
const flashcardProgressStore = {}; 

// --- Helper Functions ---

// Get today's date in YYYY-MM-DD format
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Add days to a date string (YYYY-MM-DD)
function addDaysToDate(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: '✅ Flashcard API is running',
    timestamp: new Date().toISOString()
  });
});

async function ensureAudioFolder() {
  const audioPath = path.join(__dirname, '..', 'public', 'audio');
  await fs.mkdir(audioPath, { recursive: true });
}

app.post('/api/generate-flashcards', async (req, res) => {
  const { noteId, noteTitle, noteContent, rawText } = req.body;
  
  // Validate required parameters
  if (!noteTitle || !noteContent) {
    return res.status(400).json({ error: 'Missing required parameters: noteTitle and noteContent are required' });
  }

  // Use existing noteId or generate a placeholder
  const useNoteId = noteId || `temp-${Date.now()}`;
  
  try {
    console.log(`🧠 Generating flashcards for note: "${noteTitle}"`);
    console.log(`📝 Note content length: ${noteContent.length} characters`);
    
    if (rawText) {
      console.log(`📄 Raw text provided: ${rawText.length} characters`);
    }

    // Remove the initial note upsert since we'll handle note creation later

    const prompt = `You are an expert flashcard generator.

Generate flashcards from the provided content. For each flashcard, try to identify which page number of the document it comes from (if mentioned in the content).

Return ONLY a JSON array with NO OTHER TEXT:
[
  {
    "front": "Question text here?", 
    "back": "Answer text here",
    "pageNumber": 4, // Optional: Extract the page number if mentioned in the content
    "sourceText": "This is the original text from the source material that this flashcard is based on" // Optional: Extract a short relevant passage
  },
  {
    "front": "Another question?", 
    "back": "Another answer",
    "pageNumber": 7,
    "sourceText": "Original text from the source"
  }
]

CRITICAL RULES:
1. Return ONLY the JSON array - no explanations, no markdown, no code blocks
2. Generate 5-10 cards maximum
3. Each card must focus on a key concept
4. Questions must be clear and specific
5. Answers must be concise but complete
6. No markdown, HTML, or special formatting
7. Include pageNumber if it can be identified from the content (look for page references in the text)
8. Include a brief sourceText that represents the original text the card is based on
9. If pageNumber or sourceText can't be determined, omit those fields rather than using null/empty values

Content to process:
${noteContent}

${rawText ? `Additional context:\n${rawText}` : ''}`;

    console.log('🔍 Sending request to Gemini...');
    
    const geminiApiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    const generatedText = geminiApiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Log the complete raw response for debugging
    console.log('🧠 Raw Gemini response:', {
      fullText: generatedText,
      preview: generatedText?.substring(0, 500),
      length: generatedText?.length
    });

    if (!generatedText) {
      console.warn('❌ Empty response from Gemini');
      return res.status(500).json({ error: 'No content generated' });
    }

    let generatedCardsData = [];
    try {
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
      generatedCardsData = JSON.parse(jsonString);
      
      if (!Array.isArray(generatedCardsData)) throw new Error('Response is not an array');
      
      generatedCardsData = generatedCardsData.filter(card => card && card.front && card.back);
      
      if (generatedCardsData.length === 0) throw new Error('No valid flashcards found in JSON');
      
      console.log(`✅ Successfully parsed ${generatedCardsData.length} card data objects from Gemini`);
    } catch (error) {
      console.error('❌ Failed to parse flashcards JSON from Gemini:', error);
      return res.status(500).json({ error: 'Failed to parse flashcards from AI response', raw: generatedText });
    }

    // --- NEW: Prisma Deck Upsert, Card Creation, and Progress Creation --- 
    console.log(`💾 Saving cards to database for Note ID: ${useNoteId}`);
    const createdCards = [];
    try {
      // Find or create the Deck based on the note title
      const deck = await prisma.deck.upsert({
        where: { name: noteTitle },
        update: {}, // No update needed if found
        create: { name: noteTitle },
      });
      console.log(` - Upserted Deck ID: ${deck.id} (Name: ${deck.name})`);

      // Find or create the default note type
      let defaultNoteType = await prisma.noteType.findFirst({
        where: { name: 'PDF Extract' }
      });
      
      if (!defaultNoteType) {
        console.log(' - Creating default note type...');
        defaultNoteType = await prisma.noteType.create({
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
                name: 'DefaultTemplate',
                frontTemplate: '<div class="front">{{Front}}</div>',
                backTemplate: `
                  <div class="back">
                    <div class="question">{{Front}}</div>
                    <hr>
                    <div class="answer">{{Back}}</div>
                  </div>
                `
              }
            ])
          }
        });
        console.log(` - Created default note type ID: ${defaultNoteType.id}`);
      }
      
      // Create a note if no noteId was provided
      let note;
      if (!noteId) {
        console.log(' - Creating a new note...');
        note = await prisma.note.create({
          data: {
            noteTypeId: defaultNoteType.id,
            fieldValues: JSON.stringify({
              Front: 'Auto-generated note',
              Back: 'Generated from: ' + noteTitle,
              SourceText: noteContent.substring(0, 100) + '...'
            })
          }
        });
        console.log(` - Created note ID: ${note.id}`);
      } else {
        // Try to find the existing note
        note = await prisma.note.findUnique({
          where: { id: noteId }
        });
        
        // If not found, create one with the provided ID (not recommended in production)
        if (!note) {
          console.log(` - Note with ID ${noteId} not found, creating it...`);
          note = await prisma.note.create({
            data: {
              id: noteId,
              noteTypeId: defaultNoteType.id,
              fieldValues: JSON.stringify({
                Front: 'Auto-generated note',
                Back: 'Generated from: ' + noteTitle,
                SourceText: noteContent.substring(0, 100) + '...'
              })
            }
          });
        }
      }

      const today = new Date(); // For dueDate

      for (const cardData of generatedCardsData) {
        // --- Page Number Parsing Logic --- 
        let originalPageString = null;
        if (cardData.pageNumber !== undefined && cardData.pageNumber !== null) {
          originalPageString = String(cardData.pageNumber);
        }
        
        let parsedPageNumber = null;
        if (originalPageString) {
          const matchResult = originalPageString.match(/\d+/); // Find the first sequence of digits
          if (matchResult && matchResult[0]) {
            const parsedInt = parseInt(matchResult[0], 10);
            if (!isNaN(parsedInt)) {
              parsedPageNumber = parsedInt;
            }
          }
        }
        // --- End Page Number Parsing Logic ---

        const newCard = await prisma.card.create({
          data: {
            noteId: note.id, // Use the actual note ID
            deckId: deck.id,
            noteTypeCardTemplateName: 'DefaultTemplate', // Assuming default
            frontContent: cardData.front,
            backContent: cardData.back,
            sourcePageNumber: parsedPageNumber,    // Save the parsed integer (or null)
            sourcePageRaw: originalPageString,   // Save the original string (or null)
            sourceDocumentId: noteId, // Link to the source note ID
            progress: {
              create: {
                userId: DEMO_USER_ID, // Ensure this is correctly scoped
                state: 'new',
                easeFactor: 2500,
                interval: 0,
                dueDate: today,
                repetitions: 0,
                learningStep: 0,
                lastReviewDate: null,
              },
            },
          },
          include: { progress: true },
        });
        createdCards.push(newCard);
        console.log(`   - Created Card ID: ${newCard.id} with Progress ID: ${newCard.progress?.id}, PageRaw: ${originalPageString}, PageNum: ${parsedPageNumber}`);
      }

      console.log(`✅ Successfully created ${createdCards.length} cards in the database.`);
      
      // Return the created cards (with their DB IDs)
      return res.status(200).json({ cards: createdCards, count: createdCards.length });

    } catch (dbError) {
      console.error('❌ Database error during card/deck saving:', dbError);
      return res.status(500).json({ error: 'Failed to save flashcards to database', details: dbError instanceof Error ? dbError.message : String(dbError) });
    }
    // ---------------------------------------------------------------------

  } catch (error) {
    console.error('❌ Flashcard generation main error:', error);
    // Ensure response format matches potential expectations
    res.status(500).json({ error: 'Failed to generate flashcards', details: error instanceof Error ? error.message : String(error), cards: [], count: 0 });
  }
});

app.post('/api/generate-audio', async (req, res) => {
  try {
    const { userId, noteId, normalizedTitle, style, noteContent, rawText } = req.body;
    const voice = 'en-US-Studio-O';

    if (!userId || !noteId || !normalizedTitle || !style || !noteContent) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const fullContent = rawText
      ? `${noteContent}\n\nOriginal Source Material:\n${rawText}`
      : noteContent;

    const script = await generateLectureScript(fullContent, style);
    const audioUrl = await textToSpeechLong(script, voice, userId, noteId, normalizedTitle, style);

    res.json({
      audioUrl,
      script,
      style,
      voice,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Audio generation failed:', error);
    res.status(500).json({ error: error.message || 'Failed to generate audio' });
  }
});

app.get('/audio/:userId/:noteId/:filename', (req, res) => {
  const { userId, noteId, filename } = req.params;
  const filePath = path.join(__dirname, '..', 'public', 'audio', userId, noteId, filename);
  res.sendFile(filePath);
});

// Generate a lecture script from note content using Gemini
async function generateLectureScript(content, style) {
  try {
    console.log(`🔊 Generating ${style} lecture script...`);
    
    const prompt = style === 'concise' 
      ? `Create a concise 10-minute lecture script based on the following content. 
         Focus on key concepts, make it clear and engaging, and structure it with 
         an introduction, main points, and conclusion. Do not include markdown formatting.
         
         Content:
         ${content}`
      : `Create a detailed 30-40 minute comprehensive lecture script based on the following content.
         Cover all important concepts in depth, provide examples and context, use clear transitions 
         between topics, and include an introduction and conclusion. The script should be educational,
         engaging, and well-structured. Do not include markdown formatting.
         
         Content:
         ${content}`;
    
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    const script = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!script) {
      throw new Error('Failed to generate lecture script');
    }
    
    console.log(`✅ Generated ${style} lecture script (${script.length} characters)`);
    return script;
  } catch (error) {
    console.error('❌ Lecture script generation error:', error);
    throw new Error(`Failed to generate lecture script: ${error.message}`);
  }
}

// Convert text to speech and save the audio file
async function textToSpeechLong(text, voice, userId, noteId, title, style) {
  try {
    console.log(`🔊 Converting ${style} lecture to speech...`);
    
    // Create directory for user and note if it doesn't exist
    const userDir = path.join(__dirname, '..', 'public', 'audio', userId);
    const noteDir = path.join(userDir, noteId);
    await fs.mkdir(userDir, { recursive: true });
    await fs.mkdir(noteDir, { recursive: true });
    
    // Generate filename
    const filename = `${title}-${style}-${Date.now()}.mp3`;
    const outputPath = path.join(noteDir, filename);
    
    // Break text into chunks (Google TTS has a limit of ~5000 characters per request)
    const CHUNK_SIZE = 4000;
    const chunks = [];
    
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.substring(i, i + CHUNK_SIZE));
    }
    
    console.log(`🔊 Processing ${chunks.length} text chunks...`);
    
    // Process each chunk and collect audio content
    const audioContents = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔊 Processing chunk ${i+1}/${chunks.length} (${chunk.length} chars)`);
      
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text: chunk },
        voice: {
          languageCode: 'en-US',
          name: voice
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      });
      
      audioContents.push(response.audioContent);
    }
    
    // Combine audio chunks and write to file
    const combinedAudio = Buffer.concat(audioContents);
    await fs.writeFile(outputPath, combinedAudio);
    
    console.log(`✅ Saved audio file to ${outputPath}`);
    
    // Return public URL
    return `/audio/${userId}/${noteId}/${filename}`;
  } catch (error) {
    console.error('❌ Text-to-speech error:', error);
    throw new Error(`Failed to convert text to speech: ${error.message}`);
  }
}

app.post('/api/check-flashcard-answer', async (req, res) => {
  try {
    const { userAnswer, correctAnswer, flashcardContent } = req.body;

    if (!userAnswer || !correctAnswer) {
      return res.status(400).json({ error: 'User answer and correct answer are required' });
    }

    console.log('📝 Evaluating flashcard answer:', {
      userAnswerLength: userAnswer.length,
      correctAnswerLength: correctAnswer.length
    });

    const prompt = `You are an expert tutor evaluating a student\'s answer to a flashcard question.\n
CRITICAL RULES:
1. Provide constructive feedback focusing on what was right and what needs improvement.
2. Calculate a similarity score (0.0 to 1.0) between the user\'s answer and the correct answer.
3. Identify specific key points the user got correct.
4. Identify specific key points the user missed or got wrong.
5. Keep feedback concise and encouraging.
6. Return ONLY a JSON object with the format: 
   {
     "score": 0.85, // Numeric score 0.0-1.0
     "feedback": "Good effort! You correctly identified X but missed Y.", 
     "correctPoints": ["Point A mentioned", "Point B explained"], // Array of strings
     "missedPoints": ["Detail about C was missing", "Explanation of D was incorrect"] // Array of strings
   }

USER ANSWER:
${userAnswer}

CORRECT ANSWER:
${correctAnswer}

ADDITIONAL CONTEXT (Original Flashcard):
Front: ${flashcardContent?.front || 'N/A'}
Back: ${flashcardContent?.back || 'N/A'}
`;

    console.log('🔍 Sending evaluation request to Gemini...');
    
    const geminiApiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        // Optional: Add safety settings if needed
        // safetySettings: [...],
        generationConfig: {
           responseMimeType: "application/json",
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    const generatedText = geminiApiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      console.warn('❌ Empty evaluation response from Gemini');
      return res.status(500).json({ error: 'No evaluation content generated' });
    }

    try {
      const evaluationResult = JSON.parse(generatedText);
      console.log('✅ Successfully parsed evaluation result:', evaluationResult);
      res.status(200).json(evaluationResult);
    } catch (parseError) {
      console.error('❌ Failed to parse evaluation JSON from Gemini:', parseError);
      console.error('Raw Gemini Text:', generatedText); // Log raw text on parse error
      // Attempt to provide a fallback if parsing fails but text exists
      res.status(200).json({ 
          score: 0.0, 
          feedback: "Could not automatically evaluate. Please compare with the correct answer.",
          correctPoints: [],
          missedPoints: []
      });
    }

  } catch (error) {
    console.error('❌ Answer checking main error:', error);
    res.status(500).json({ error: 'Failed to check answer', details: error instanceof Error ? error.message : String(error) });
  }
});

// --- NEW DELETE DECK ENDPOINT ---
app.delete('/api/decks/:deckId', async (req, res) => {
  const { deckId } = req.params;
  const userId = DEMO_USER_ID; // Assuming demo user for now

  console.log(`[API] DELETE request received for Deck ID: ${deckId}`);

  if (!deckId) {
    return res.status(400).json({ error: 'Deck ID is required' });
  }

  try {
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find all cards associated with the deck
      const cardsToDelete = await tx.card.findMany({
        where: { deckId: deckId },
        select: { id: true } // Only need card IDs
      });
      const cardIds = cardsToDelete.map(card => card.id);
      console.log(` - Found ${cardIds.length} cards associated with deck ${deckId}`);

      if (cardIds.length > 0) {
        // 2. Delete associated CardProgress records (Corrected Model Name)
        const deletedProgress = await tx.cardProgress.deleteMany({
          where: {
            cardId: { in: cardIds },
            userId: userId // Ensure we only delete progress for the correct user
          }
        });
        console.log(` - Deleted ${deletedProgress.count} CardProgress records`);

        // 3. Delete the Cards themselves
        const deletedCards = await tx.card.deleteMany({
          where: { id: { in: cardIds } }
        });
        console.log(` - Deleted ${deletedCards.count} Card records`);
      } else {
        console.log(` - No cards found for deck ${deckId}, skipping card/progress deletion.`);
      }

      // 4. Delete the Deck itself
      const deletedDeck = await tx.deck.delete({
        where: { id: deckId }
      });
      console.log(` - Deleted Deck record with ID: ${deckId}`);

      return deletedDeck; // Return the deleted deck info
    });

    res.status(200).json({ message: `Deck '${result.name}' and associated data deleted successfully.`, deletedDeckId: result.id });

  } catch (error) {
    console.error(`❌ Error deleting deck ${deckId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors, e.g., record not found
      if (error.code === 'P2025') {
        return res.status(404).json({ error: `Deck with ID ${deckId} not found.` });
      }
    }
    res.status(500).json({ error: 'Failed to delete deck', details: error instanceof Error ? error.message : String(error) });
  }
});

// --- NEW SRS Endpoints ---

// Endpoint for submitting flashcard response
app.post('/api/flashcard/response', async (req, res) => {
  // --- MODIFIED: Use Prisma for progress update ---
  const { userId = DEMO_USER_ID, flashcardId, response } = req.body;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const todayISO = today.toISOString(); // Use ISO string for DateTime fields

  if (!flashcardId || !['again', 'hard', 'good', 'easy'].includes(response)) {
    console.warn('❌ Invalid payload for /api/flashcard/response:', req.body);
    return res.status(400).json({ error: 'Missing or invalid flashcardId or response' });
  }

  console.log(`📝 Received response: User=${userId}, Card=${flashcardId}, Response=${response}`);

  try {
    // Find the existing progress record for the card
    let progress = await prisma.cardProgress.findUnique({
      where: { cardId: flashcardId },
    });

    if (!progress) {
      console.error(`❌ CardProgress not found for Card ID: ${flashcardId}. Cannot update.`);
      // This shouldn't happen if generate-flashcards creates progress correctly
      return res.status(404).json({ error: 'Card progress not found. Cannot process response.' });
    }
    
    // --- Apply SM-2 Logic (simplified, adapt from Anki's full logic if needed) --- 
    let { repetitions, easeFactor, interval, state, learningStep } = progress;
    let nextDueDate = new Date(today); // Default to today

    // Convert interval from days (float) to milliseconds for date calculation
    // Prisma uses DateTime, so intervals need careful handling
    const intervalMillis = interval * 24 * 60 * 60 * 1000;

    switch (response) {
      case 'again':
        repetitions = 0; // Reset repetition count
        easeFactor = Math.max(1300, easeFactor - 200); // Decrease ease (permille)
        state = 'learning'; // Revert to learning
        learningStep = 0; // Reset learning step
        interval = 0.0007; // ~1 minute in days, review soon
        nextDueDate.setTime(today.getTime() + 60 * 1000); // Set due in 1 minute
        break;
      
      case 'hard':
        easeFactor = Math.max(1300, easeFactor - 150); // Decrease ease slightly
        interval = interval * 1.2; // Increase interval slower
        state = 'review'; // Stay/Enter review state
        nextDueDate.setTime(today.getTime() + interval * 24 * 60 * 60 * 1000);
        repetitions += 1;
        break;

      case 'good':
        if (state === 'learning' || state === 'relearning') {
          // Graduate from learning/relearning
          interval = 1; // Start with 1 day interval
          state = 'review'; 
        } else { // state === 'review'
          interval = interval * (easeFactor / 1000); // Apply ease factor
        }
        nextDueDate.setTime(today.getTime() + interval * 24 * 60 * 60 * 1000);
        repetitions += 1;
        break;

      case 'easy':
        easeFactor += 150; // Increase ease
        if (state === 'learning' || state === 'relearning') {
          interval = 4; // Graduate to 4 days
          state = 'review';
        } else { // state === 'review'
          interval = interval * (easeFactor / 1000) * 1.3; // Apply ease and easy bonus
        }
        nextDueDate.setTime(today.getTime() + interval * 24 * 60 * 60 * 1000);
        repetitions += 1;
        break;
    }

    // Ensure interval is at least 1 day if not 'again'
    if (response !== 'again' && interval < 1) {
      interval = 1;
      nextDueDate.setTime(today.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Clamp ease factor (permille)
    easeFactor = Math.max(1300, Math.min(3500, easeFactor)); // Example range 1.3 to 3.5

    // Update the progress record in the database
    const updatedProgress = await prisma.cardProgress.update({
      where: { cardId: flashcardId },
      data: {
        repetitions,
        easeFactor,
        interval, // Store interval in days
        dueDate: nextDueDate, // Store calculated date
        state,
        learningStep, // Update learning step if applicable
        lastReviewDate: todayISO, // Record review date
      },
    });

    console.log(`✅ Updated progress: User=${userId}, Card=${flashcardId}`, updatedProgress);
    res.status(200).json({ status: 'ok', updatedProgress });

  } catch (error) {
    console.error(`❌ Error processing flashcard response for Card ID ${flashcardId}:`, error);
    res.status(500).json({ error: 'Failed to process flashcard response', details: error instanceof Error ? error.message : String(error) });
  }
  // --- End Modification ---
});

// Rename endpoint and update logic
// GET /api/flashcards/progress can likely be REMOVED now, as GET /api/session/cards includes progress
// app.get('/api/flashcards/progress', async (req, res) => { ... });

// --- NEW: Get All Decks with Counts ---
app.get('/api/decks', async (req, res) => {
  console.log("GET /api/decks - Fetching decks and counts...");
  try {
    const decks = await prisma.deck.findMany();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today for dueDate comparison

    const decksWithCounts = await Promise.all(
      decks.map(async (deck) => {
        const newCount = await prisma.card.count({
          where: {
            deckId: deck.id,
            progress: { state: 'new' },
          },
        });

        const learnCount = await prisma.card.count({
          where: {
            deckId: deck.id,
            progress: { state: 'learning' },
          },
        });

        const dueCount = await prisma.card.count({
          where: {
            deckId: deck.id,
            progress: {
              dueDate: { lte: today }, // Less than or equal to the start of today
              OR: [
                { state: 'review' },
                { state: 'relearning' },
              ],
            },
          },
        });

        console.log(` - Deck: ${deck.name} (ID: ${deck.id}) - New: ${newCount}, Learn: ${learnCount}, Due: ${dueCount}`);
        return {
          id: deck.id,
          name: deck.name,
          newCount,
          learnCount,
          dueCount,
        };
      })
    );

    console.log(`✅ Successfully fetched ${decksWithCounts.length} decks with counts.`);
    res.status(200).json(decksWithCounts);

  } catch (error) {
    console.error("❌ Error fetching decks:", error);
    res.status(500).json({ error: "Failed to fetch decks", details: error instanceof Error ? error.message : String(error) });
  }
});
// -------------------------------------

// --- NEW: Get Cards for Review Session ---
app.get('/api/session/cards', async (req, res) => {
  const { userId = DEMO_USER_ID, deckId, newLimit = 20, dueLimit = 100 } = req.query;
  const limitNew = parseInt(String(newLimit), 10);
  const limitDue = parseInt(String(dueLimit), 10);

  console.log(`GET /api/session/cards - Fetching cards for User: ${userId}, Deck: ${deckId || 'All'}, NewLimit: ${limitNew}, DueLimit: ${limitDue}`);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Base filter for deckId if provided
    const deckFilter = deckId ? { deckId: String(deckId) } : {};

    // Fetch Due Cards
    const dueCards = await prisma.card.findMany({
      where: {
        ...deckFilter,
        progress: {
          userId: String(userId),
          dueDate: { lte: today },
          OR: [
            { state: 'review' },
            { state: 'relearning' },
          ],
        },
      },
      include: { progress: true }, // Include progress data
      orderBy: { progress: { dueDate: 'asc' } }, // Optional: Order by due date
      take: limitDue,
    });
    console.log(` - Found ${dueCards.length} due cards.`);

    // Fetch New Cards (only if we haven't hit the total limit with due cards)
    const remainingLimit = Math.max(0, limitNew); // Simplification: take up to newLimit new cards
    let newCards = [];
    if (remainingLimit > 0) {
      newCards = await prisma.card.findMany({
        where: {
          ...deckFilter,
          progress: {
            userId: String(userId),
            state: 'new',
          },
        },
        include: { progress: true },
        // orderBy: { createdAt: 'asc' }, // Optional: Order by creation date
        take: remainingLimit,
      });
      console.log(` - Found ${newCards.length} new cards (limit: ${remainingLimit}).`);
    }

    // Combine and Shuffle
    let sessionQueue = [...dueCards, ...newCards];
    // Fisher-Yates shuffle
    for (let i = sessionQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sessionQueue[i], sessionQueue[j]] = [sessionQueue[j], sessionQueue[i]];
    }

    console.log(`✅ Sending session queue with ${sessionQueue.length} cards.`);
    res.status(200).json(sessionQueue);

  } catch (error) {
    console.error("❌ Error fetching session cards:", error);
    res.status(500).json({ error: "Failed to fetch session cards", details: error instanceof Error ? error.message : String(error) });
  }
});
// ------------------------------------------

// --- NEW: Delete Note Endpoint ---
app.delete('/api/notes/:noteId', async (req, res) => {
  const { noteId } = req.params;
  const { userId = DEMO_USER_ID } = req.body; // Or get userId differently if auth is implemented

  console.log(`DELETE /api/notes/${noteId} - Request received for User: ${userId}`);

  if (!noteId) {
    return res.status(400).json({ error: "Missing noteId parameter" });
  }

  try {
    // Optional: Add check to ensure user owns the note before deleting if implementing multi-user
    
    // Prisma will cascade delete related Cards and CardProgress due to schema definition
    await prisma.note.delete({
      where: { id: noteId },
    });

    console.log(`✅ Successfully deleted Note ID: ${noteId} and its related data.`);
    res.status(200).json({ message: "Note deleted successfully" });

  } catch (error) {
    // Handle case where note might not be found
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.warn(` - Note ID: ${noteId} not found for deletion.`);
      return res.status(404).json({ error: "Note not found" });
    }
    // Handle other potential errors
    console.error(`❌ Error deleting note ID: ${noteId}:`, error);
    res.status(500).json({ error: "Failed to delete note", details: error instanceof Error ? error.message : String(error) });
  }
});
// --------------------------------

// Add the new routes
app.use('/api', noteRoutes);

// Update startServer function to initialize Prisma
async function startServer() {
  try {
    await ensureAudioFolder();
    
    // Connect to the database
    await prisma.$connect();
    console.log('✅ Connected to the database');
    
    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();