import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

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
  try {
    const { noteContent, rawText } = req.body;

    if (!noteContent) {
      console.warn('❌ Missing noteContent in request');
      return res.status(400).json({ error: 'noteContent is required' });
    }

    console.log('📝 Processing request:', {
      noteContentLength: noteContent.length,
      hasRawText: !!rawText,
      rawTextLength: rawText?.length
    });

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

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Log the complete raw response for debugging
    console.log('🧠 Raw Gemini response:', {
      fullText: generatedText,
      preview: generatedText?.substring(0, 500),
      length: generatedText?.length
    });

    if (!generatedText) {
      console.warn('❌ Empty response from Gemini');
      return res.status(500).json({ 
        error: 'No content generated',
        flashcards: []
      });
    }

    // Parse the JSON array from the generated text
    let flashcards = [];
    try {
      // Extract JSON array if it's wrapped in code blocks or has additional text
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
      flashcards = JSON.parse(jsonString);
      
      // Validate the flashcards format
      if (!Array.isArray(flashcards)) {
        throw new Error('Response is not an array');
      }
      
      flashcards = flashcards.filter(card => 
        card && typeof card === 'object' && 
        typeof card.front === 'string' && 
        typeof card.back === 'string'
      );
      
      if (flashcards.length === 0) {
        throw new Error('No valid flashcards found');
      }
      
      console.log(`✅ Successfully parsed ${flashcards.length} flashcards`);
    } catch (error) {
      console.error('❌ Failed to parse flashcards JSON:', error);
      return res.status(500).json({ 
        error: 'Failed to parse flashcards from AI response',
        raw: generatedText,
        flashcards: []
      });
    }

    // Return the parsed flashcards
    return res.status(200).json({ 
      flashcards,
      count: flashcards.length
    });

  } catch (error) {
    console.error('❌ Flashcard generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate flashcards',
      details: error.message,
      flashcards: []
    });
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
    console.log(`🧠 Generating ${style} lecture script...`);
    
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

    const prompt = `You are an expert tutor evaluating a student's answer to a flashcard question.

Question (not shown to the student): "${flashcardContent?.front || 'Unknown question'}"
Correct answer: "${correctAnswer}"
Student's answer: "${userAnswer}"

Evaluate how well the student's answer matches the correct answer. Consider:
- Key concepts and terminology
- Accuracy of facts and explanations
- Completeness of the answer

Then, respond with a JSON object with these fields:
{
  "score": A number from 0.0 to 1.0 indicating how correct the answer is (0 = completely wrong, 1 = perfect),
  "feedback": A helpful, encouraging response explaining what was correct and what was missed,
  "correctPoints": An array of strings listing what the student got right,
  "missedPoints": An array of strings listing what the student missed or got wrong
}

IMPORTANT: Be encouraging, even if the answer is completely wrong. Focus on improvement.
Return ONLY valid JSON without markdown formatting, code blocks, or explanations.`;

    console.log('🔍 Sending request to Gemini...');
    
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

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Log the complete raw response for debugging
    console.log('🧠 Raw Gemini response preview:', {
      preview: generatedText?.substring(0, 300),
      length: generatedText?.length
    });

    if (!generatedText) {
      console.warn('❌ Empty response from Gemini');
      return res.status(500).json({ 
        error: 'No content generated',
        feedback: "Sorry, I couldn't evaluate your answer. Please try again."
      });
    }

    // Parse the JSON response
    try {
      // Extract JSON if it's wrapped in code blocks or has additional text
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
      
      const evaluation = JSON.parse(jsonString);
      
      if (!evaluation || typeof evaluation !== 'object') {
        throw new Error('Invalid evaluation format');
      }
      
      return res.status(200).json(evaluation);
    } catch (error) {
      console.error('❌ Failed to parse evaluation JSON:', error);
      return res.status(500).json({ 
        error: 'Failed to parse evaluation',
        feedback: "Sorry, I couldn't properly evaluate your answer. Please try again."
      });
    }

  } catch (error) {
    console.error('❌ Answer evaluation error:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate answer',
      details: error.message,
      feedback: "Sorry, there was a problem evaluating your answer."
    });
  }
});

// --- NEW SRS Endpoints ---

// Endpoint for submitting flashcard response
app.post('/api/flashcard/response', async (req, res) => {
  const { userId, flashcardId, noteId, response } = req.body;
  const today = getTodayDateString();

  if (!userId || !flashcardId || !noteId || !['again', 'hard', 'good', 'easy'].includes(response)) {
    console.warn('❌ Invalid payload for /api/flashcard/response:', req.body);
    return res.status(400).json({ error: 'Missing or invalid userId, flashcardId, noteId, or response' });
  }

  console.log(`📝 Received response: User=${userId}, Note=${noteId}, Card=${flashcardId}, Response=${response}`);

  // Ensure user exists in the store
  if (!flashcardProgressStore[userId]) {
    flashcardProgressStore[userId] = {};
  }

  // Get current progress or set defaults if it's the first time
  let progress = flashcardProgressStore[userId][flashcardId];
  const isNewCard = !progress;

  if (isNewCard) {
    progress = {
      noteId: noteId, // Store noteId
      ease: 250,
      intervalDays: 0,
      dueDate: today,
      lastReviewed: null,
      repetitions: 0,
      state: 'learning' 
    };
    console.log(`✨ New card progress created for User=${userId}, Note=${noteId}, Card=${flashcardId}`);
  } else {
     // Ensure noteId is present (for older records if schema changes)
     progress.noteId = progress.noteId || noteId; 
     progress.intervalDays = Number(progress.intervalDays) || 0;
     progress.ease = Number(progress.ease) || 250;
     progress.repetitions = Number(progress.repetitions) || 0;
  }

  // Apply SM-2 logic based on response
  switch (response) {
    case 'again':
      progress.intervalDays = 0.0007; // ~1 minute
      progress.ease -= 20;
      progress.repetitions = 0;
      progress.state = 'learning';
      break;
    case 'hard':
      progress.intervalDays = progress.intervalDays * 1.2;
      progress.ease -= 15;
      progress.state = 'reviewing';
      break;
    case 'good':
      if (isNewCard || progress.state === 'learning') {
        progress.intervalDays = 1;
        progress.state = 'reviewing';
      } else {
        progress.intervalDays = progress.intervalDays * (progress.ease / 100);
      }
      progress.repetitions += 1;
      break;
    case 'easy':
       if (isNewCard || progress.state === 'learning') {
         progress.intervalDays = 4;
         progress.state = 'reviewing';
       } else {
         progress.intervalDays = progress.intervalDays * (progress.ease / 100) * 1.3;
       }
       progress.ease += 15;
       progress.repetitions += 1;
       break;
  }

  progress.ease = Math.max(130, Math.min(300, progress.ease));

  if (response !== 'again' && progress.intervalDays < 1) {
    progress.intervalDays = 1;
  }

  progress.dueDate = addDaysToDate(today, Math.ceil(progress.intervalDays));
  progress.lastReviewed = today;

  // Save updated progress back
  flashcardProgressStore[userId][flashcardId] = progress;

  console.log(`✅ Updated progress: User=${userId}, Note=${noteId}, Card=${flashcardId}`, progress);

  res.status(200).json({
    status: 'ok',
    updatedProgress: progress
  });
});

// Rename endpoint and update logic
app.get('/api/flashcards/progress', async (req, res) => {
  const { userId, noteId } = req.query;
  const today = getTodayDateString();

  if (!userId || !noteId) {
    return res.status(400).json({ error: 'userId and noteId query parameters are required' });
  }

  console.log(`🔎 Fetching ALL card progress for User=${userId}, Note=${noteId}`);

  const userProgressStore = flashcardProgressStore[userId];
  if (!userProgressStore) {
    console.log(`🤷 No progress found for User=${userId}. Returning empty list.`);
    return res.status(200).json([]); 
  }

  const noteProgressList = [];
  for (const flashcardId in userProgressStore) {
    const progress = userProgressStore[flashcardId];
    if (progress.noteId === noteId) {
        noteProgressList.push({ 
            flashcardId: flashcardId, 
            ...progress 
        });
    }
  }
  
  console.log(`✅ Found ${noteProgressList.length} progress record(s) for User=${userId}, Note=${noteId}`);
  res.status(200).json(noteProgressList);
});

async function startServer() {
  try {
    await ensureAudioFolder();
    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();