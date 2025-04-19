import axios from 'axios';

interface AudioGenerationOptions {
  style: 'concise' | 'detailed';
  voice: string;
  noteContent: string;
  rawText?: string;
  userId: string;
  noteId: string;
  normalizedTitle: string;
}

interface AudioGenerationResult {
  audioUrl: string;
  script: string;
  style: 'concise' | 'detailed';
  voice: string;
  generatedAt: number;
}

export async function generateAudio(
  options: AudioGenerationOptions
): Promise<AudioGenerationResult> {
  try {
    const { style, voice, noteContent, rawText, userId, noteId, normalizedTitle } = options;

    console.log(`🔊 Generating ${style} audio lecture...`);
    const response = await axios.post('/api/generate-audio', {
      userId,
      noteId,
      normalizedTitle,
      style,
      noteContent,
      rawText,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to generate audio:', error);
    throw error instanceof Error ? error : new Error('Failed to generate audio');
  }
}