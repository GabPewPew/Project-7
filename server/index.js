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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cors({
  methods: ['GET', 'POST', 'OPTIONS'],
  maxAge: 600,
}));

const ttsClient = new TextToSpeechClient({
  keyFilename: path.join(__dirname, 'google-credentials.json'),
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CONCISE_PROMPT = `Act as a highly experienced and approachable university professor who is teaching this topic to students for the first time. Based on the provided original source materials and structured AI-generated notes, write a concise and engaging lecture script with the goal of introducing key concepts quickly and clearly.

Your job is to guide the student through the topic as if speaking to a live class.

---

### 🧠 Your Role:

- DO NOT introduce yourself or mention you're an AI or a professor.
- DO NOT read bullet points, formatting characters like , \`#\`, dashes, or markdown headers.
- DO NOT quote text verbatim.

Instead:

- Understand the content first — extract meaning and teaching intent.
- Rephrase and restructure everything into natural spoken English, not written text.
- Focus on the 3–5 most important ideas, explained clearly and casually.
- Speak like a real human — fluid, warm, confident, slightly spontaneous.

---

### 🗣️ Tone & Delivery:

Use a conversational, relaxed tone that mimics how real professors speak in a live classroom. Include elements like:

- Use spoken English — with casual rhythm, varied sentence lengths, and a warm, natural flow.
- Include realistic pauses, filler phrases (e.g. "uh", "let me think", "so yeah") and casual connectors (e.g. "okay now", "by the way", "you see").
- Your voice should feel like someone thinking aloud — smart, relatable, slightly informal.
- Occasionally use emotionally colored phrases like "this is actually kinda surprising" or "this is a really big idea".
- Speak like a real human with small rephrasings, mild tangents ("this reminds me of…"), and micro-engagements ("right?", "you know what I mean?").

---

### 📚 Structure of the Script:

1. Quick overview: 1–2 sentences on what the student is about to learn  
2. Main body: Breakdown of 3–5 key ideas or definitions  
3. Mini-examples or analogies if helpful (but no long stories)  
4. Brief recap: Reinforce why the ideas matter  

---

### 🎯 Requirements:

- Emphasize important concepts by repeating or rephrasing them casually
- Avoid overly academic language or technical jargon
- Sentences should be short, natural, and easy to follow aloud
- Do not read markdown, bullet points, or formatting symbols
- Limit to ~1000–1300 words (around 10 minutes of spoken lecture)

---

### 🎤 Closing Style:

End with a warm, friendly encouragement like:

- "That's a quick intro to this topic – feel free to come back and review anytime."
- "Next time, we'll dive a little deeper into…"`;

const DETAILED_PROMPT = `Act as a senior university professor or experienced lecturer who is highly skilled in teaching this subject to students with an intermediate level of understanding. Using the provided original source materials and structured AI-generated notes, write a detailed, immersive, and human-sounding lecture script that could be delivered in a 30–40 minute university classroom setting.

---

### 🧠 Your Role:

- DO NOT introduce yourself or mention you are an AI or a professor.
- DO NOT read bullet points, formatting symbols like , \`#\`, or markdown.
- DO NOT quote content verbatim.
- Instead, analyze the material deeply, understand the intent and concepts first, and retell them as if you're teaching in real-time.

---

### 🎙️ Tone & Voice:

- Use spoken English — with casual rhythm, varied sentence lengths, and a warm, natural flow.
- Include realistic pauses, filler phrases (e.g. "uh", "let me think", "so yeah") and casual connectors (e.g. "okay now", "by the way", "you see").
- Your voice should feel like someone thinking aloud — smart, relatable, slightly informal.
- Occasionally use emotionally colored phrases like "this is actually kinda surprising" or "this is a really big idea".
- Speak like a real human with small rephrasings, mild tangents ("this reminds me of…"), and micro-engagements ("right?", "you know what I mean?").

---

### 🧭 Structure:

1. Opening Greeting & Overview
    - Greet the student casually
    - Briefly explain what they'll learn and why it matters
    - Mention if this fits into a broader series or pattern
2. Learning Objectives
    - Use friendly language like:
        > "By the end of this lecture, you should be able to…"
3. Main Body — Section-by-Section Teaching
    - Organize info logically
    - Start from foundations, and build up to complex ideas
    - Use signposting phrases:
        > "Alright, let's begin with…"
        > "Next up, something crucial…"
        > "So now that we've seen that…"
4. Explain, Not Recite
    - Summarize, simplify, and connect ideas
    - Use examples, analogies, or mini case studies
    - Occasionally reflect:
        > "You might be wondering why that's important — here's why…"
        > "Let's zoom out for a second…"
5. Engagement & Emphasis
    - Ask rhetorical questions to simulate real teaching:
        > "So why does this happen?"
        > "What's going on here?"
    - Highlight key points with small pauses:
        > "And this… is a big one."
        > "Make sure to remember this part."
6. Connections & Transitions
    - Connect ideas using:
        > "This ties directly into…"
        > "We'll come back to that in a bit…"
        > "Let's switch gears now…"
7. Recap & Summary
    - End each section with a mini summary
    - Close the lecture by reviewing the main ideas
    - Optionally preview what's next:
        > "Next time, we'll explore…"

---

### ✅ Output Guidelines:

- Length: ~3500–4500 words (30–40 mins of speech)
- Pacing: Flow like a live lecture, not like an article
- Formatting: Use paragraph breaks naturally for readability
- Clarity: Don't overload — focus on 3–5 core concepts deeply explained

---

### Do NOT Do These:

- ❌ Do not introduce who you are
- ❌ Do not reference bullets, formatting, or note structure
- ❌ Do not speak robotically or copy any notes directly
- ❌ Do not say things like "the following are…" or "in conclusion" unless naturally delivered

---

### 🌱 Final Goal:

- Help the student make sense of the topic with real understanding
- Make it feel like a recorded university class from a passionate, insightful lecturer
- Sound alive, dynamic, and human — not like reading from a paper`;

app.use(express.static(path.join(__dirname, '..', 'public')));

async function ensureAudioFolder() {
  const audioPath = path.join(__dirname, '..', 'public', 'audio');
  await fs.mkdir(audioPath, { recursive: true });
}

async function generateLectureScript(content, style) {
  const finalPrompt = `
${style === 'concise' ? CONCISE_PROMPT : DETAILED_PROMPT}

Content to convert into a lecture:
${content}
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [{ text: finalPrompt }]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GEMINI_API_KEY
        },
        timeout: 60000
      }
    );

    const candidate = response.data?.candidates?.[0]?.content;
    const text = candidate?.parts?.[0]?.text;

    if (!text || typeof text !== 'string') {
      throw new Error('Gemini returned an empty or invalid response');
    }

    return text;
  } catch (err) {
    console.error('[Gemini Error]', err.response?.data || err.message);
    throw new Error(`Gemini API error: ${err.message}`);
  }
}

async function textToSpeechLong(script, voice, userId, noteId, normalizedTitle, style) {
  try {
    function chunkText(text, maxBytes = 4500) {
      const chunks = [];
      let current = '';
      for (const paragraph of text.split('\n')) {
        if (Buffer.byteLength(current + '\n' + paragraph, 'utf8') > maxBytes) {
          chunks.push(current);
          current = paragraph;
        } else {
          current += '\n' + paragraph;
        }
      }
      if (current) chunks.push(current);
      return chunks;
    }

    const chunks = chunkText(script);
    const audioBuffers = [];

    for (const chunk of chunks) {
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text: chunk },
        voice: { languageCode: 'en-US', name: voice },
        audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1 },
      });

      if (!response.audioContent) {
        throw new Error('No audio content generated by TTS for a chunk');
      }

      audioBuffers.push(Buffer.from(response.audioContent));
    }

    const finalAudio = Buffer.concat(audioBuffers);

    const baseDir = path.join(__dirname, '..', 'public', 'audio', userId, noteId);
    await fs.mkdir(baseDir, { recursive: true });

    const audioFile = path.join(baseDir, `audio-${style}.mp3`);
    await fs.writeFile(audioFile, finalAudio);

    const userDir = path.join(__dirname, '..', 'public', 'audio', userId);
    const dirs = await fs.readdir(userDir);
    if (dirs.length > 5) {
      const stats = await Promise.all(
        dirs.map(async (dir) => {
          const stat = await fs.stat(path.join(userDir, dir));
          return { dir, mtime: stat.mtime.getTime() };
        })
      );
      const toDelete = stats.sort((a, b) => a.mtime - b.mtime).slice(0, dirs.length - 5);
      for (const { dir } of toDelete) {
        await fs.rm(path.join(userDir, dir), { recursive: true, force: true });
        console.log(`🧹 Deleted old audio folder: ${dir}`);
      }
    }

    return `/audio/${userId}/${noteId}/audio-${style}.mp3`;
  } catch (err) {
    console.error('[TTS Error]', err);
    throw new Error(`TTS error: ${err.message}`);
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
  await ensureAudioFolder();
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}

startServer();