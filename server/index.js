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
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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

Generate flashcards from the provided content. Return ONLY a JSON array with NO OTHER TEXT:
[
  {"front": "Question text here?", "back": "Answer text here"},
  {"front": "Another question?", "back": "Another answer"}
]

CRITICAL RULES:
1. Return ONLY the JSON array - no explanations, no markdown, no code blocks
2. Generate 5-10 cards maximum
3. Each card must focus on a key concept
4. Questions must be clear and specific
5. Answers must be concise but complete
6. No markdown, HTML, or special formatting
7. No nested objects or arrays
8. Both "front" and "back" must be plain strings

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
        raw: null
      });
    }

    // Return the raw response for debugging
    return res.status(200).json({ 
      raw: generatedText,
      preview: generatedText.substring(0, 500),
      length: generatedText.length
    });

  } catch (error) {
    console.error('❌ Flashcard generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate flashcards',
      details: error.message,
      raw: null
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