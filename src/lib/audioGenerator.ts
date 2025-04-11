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
    const response = await axios.post('http://localhost:3000/api/generate-audio', options);
    return response.data;
  } catch (error) {
    console.error('Failed to generate audio:', error);
    throw error instanceof Error ? error : new Error('Failed to generate audio');
  }
}