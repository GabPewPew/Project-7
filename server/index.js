import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3000;

// Ensure audio directory exists
await fs.mkdir(path.join(__dirname, '..', 'public', 'audio'), { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize Gemini and TTS clients
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const ttsClient = new TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const CONCISE_PROMPT = `Act as a highly experienced and approachable university professor who is teaching this topic to students for the first time. Based on the provided original source materials and structured AI-generated notes, write a concise and engaging lecture script with the goal of introducing key concepts quickly and clearly.

Your job is to guide the student through the topic as if speaking to a live class.

Use a warm, conversational tone that mimics natural spoken English. Include natural elements like:
- Light filler phrases ("uh", "so", "you know", "let me think")
- Spoken hesitations or rephrasing ("what I mean is…", "or you could say…")
- Soft transitions like:
  - "Okay, next we're going to look at…"
  - "Let's move on to something really important…"
  - "A quick recap before we continue…"

Structure the script as follows:
1. A quick 1–2 sentence overview of what the student is about to learn
2. A simplified breakdown of 3–5 core ideas or definitions
3. Brief examples or analogies where helpful (but no long stories)
4. A short recap of what was covered and why it matters

Make sure to:
- Emphasize important terms
- Keep sentences short and natural
- Avoid academic jargon or verbatim quoting
- Stay under ~10 minutes (~1000–1300 words)

End with a friendly sign-off:
- "That's a quick intro to this topic – feel free to come back and review anytime."
- "Next time, we'll dive a little deeper into…"`;

const DETAILED_PROMPT = `Act as a senior university professor or experienced lecturer who is highly skilled in teaching this subject to students with an intermediate level of understanding. Using the provided original source materials and structured AI-generated notes, write a detailed and immersive lecture script that could be delivered in a 30–40 minute university classroom setting.

Your lecture should:
1. Begin with a comprehensive overview of the topic
2. Break down complex concepts into digestible segments
3. Provide detailed explanations with real-world examples
4. Include relevant case studies or research findings
5. Connect concepts to broader themes in the field
6. End with a thorough summary and preview of related topics

Use a professional but engaging tone that:
- Maintains academic rigor while being accessible
- Includes natural speech patterns and transitions
- Encourages critical thinking and deeper understanding
- Addresses potential questions or misconceptions

Aim for approximately 4000-5000 words, structured with clear sections and natural breaks.`;

async function generateLectureScript(content, style) {
  try {
    // Try with the latest model first
    let model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    
    const prompt = `${style === 'concise' ? CONCISE_PROMPT : DETAILED_PROMPT}

Content to convert into a lecture:
${content}`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const script = response.text();

      if (!script || typeof script !== 'string') {
        throw new Error('Empty response from Gemini');
      }

      return script;
    } catch (error) {
      console.warn('Failed to use gemini-1.5-pro-latest, falling back to gemini-pro:', error);
      
      model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const fallbackResult = await model.generateContent(prompt);
      const fallbackResponse = await fallbackResult.response;
      const fallbackScript = fallbackResponse.text();

      if (!fallbackScript || typeof fallbackScript !== 'string') {
        throw new Error('Empty response from Gemini fallback model');
      }

      return fallbackScript;
    }
  } catch (error) {
    console.error('Failed to generate lecture script:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to generate lecture script: ${error.message}`
        : 'Failed to generate lecture script: Unknown error'
    );
  }
}

async function textToSpeech(text, voice, userId, noteId, normalizedTitle, style) {
  try {
    const request = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: voice,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: 0,
        speakingRate: 1,
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    if (!response.audioContent) {
      throw new Error('No audio content generated');
    }

    const baseDir = path.join(__dirname, '..', 'public', 'audio', userId, noteId);
    await fs.mkdir(baseDir, { recursive: true });

    const audioPath = path.join(baseDir, `audio-${style}.mp3`);
    await fs.writeFile(audioPath, response.audioContent);

    // Clean up old files (keep max 5 per user)
    const userDir = path.join(__dirname, '..', 'public', 'audio', userId);
    const noteDirs = await fs.readdir(userDir);
    
    if (noteDirs.length > 5) {
      const dirStats = await Promise.all(
        noteDirs.map(async (dir) => {
          const fullPath = path.join(userDir, dir);
          const stat = await fs.stat(fullPath);
          return { dir, stat };
        })
      );
      
      const oldestDirs = dirStats
        .sort((a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime())
        .slice(0, dirStats.length - 5);

      for (const { dir } of oldestDirs) {
        const fullPath = path.join(userDir, dir);
        await fs.rm(fullPath, { recursive: true, force: true });
        console.log(`Cleaned up old audio directory: ${fullPath}`);
      }
    }

    return `/audio/${userId}/${noteId}/audio-${style}.mp3`;
  } catch (error) {
    console.error('Failed to generate audio:', error);
    throw new Error('Failed to generate audio');
  }
}

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
    const audioUrl = await textToSpeech(script, voice, userId, noteId, normalizedTitle, style);

    res.json({
      audioUrl,
      script,
      style,
      voice,
      generatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error generating audio:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate audio'
    });
  }
});

// Serve audio files
app.get('/audio/:userId/:noteId/:filename', (req, res) => {
  const { userId, noteId, filename } = req.params;
  const audioPath = path.join(
    __dirname,
    '..',
    'public',
    'audio',
    userId,
    noteId,
    filename
  );
  res.sendFile(audioPath);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});