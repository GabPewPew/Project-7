import axios from 'axios';
import { FileMetadata } from './detectFileTypes';

const ASSEMBLYAI_API_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

interface TranscriptionResult {
  fileName: string;
  type: 'audio' | 'video';
  transcript: string;
}

interface AssemblyAIUploadResponse {
  upload_url: string;
}

interface AssemblyAITranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
}

class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

async function uploadToAssemblyAI(file: File): Promise<string> {
  console.log(`Uploading ${file.name} to AssemblyAI...`);

  try {
    // Get upload URL
    const response = await axios.post<AssemblyAIUploadResponse>(
      `${ASSEMBLYAI_BASE_URL}/upload`,
      null,
      {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
        },
      }
    );

    // Upload the file
    const formData = new FormData();
    formData.append('file', file);

    await axios.put(
      response.data.upload_url,
      file,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    );

    return response.data.upload_url;
  } catch (error) {
    throw new TranscriptionError(
      `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function createTranscriptionJob(audioUrl: string): Promise<string> {
  try {
    const response = await axios.post<AssemblyAITranscriptResponse>(
      `${ASSEMBLYAI_BASE_URL}/transcript`,
      {
        audio_url: audioUrl,
      },
      {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.id;
  } catch (error) {
    throw new TranscriptionError(
      `Failed to create transcription job: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function pollTranscriptionStatus(transcriptId: string, fileName: string): Promise<string> {
  const maxAttempts = 60; // 5 minutes maximum (with 5-second intervals)
  const pollingInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get<AssemblyAITranscriptResponse>(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: {
            'Authorization': ASSEMBLYAI_API_KEY,
          },
        }
      );

      const { status, text, error } = response.data;
      console.log(`Polling transcription for ${fileName}, current status: ${status}`);

      if (status === 'completed' && text) {
        console.log(`✅ Transcription completed for ${fileName}`);
        return text;
      }

      if (status === 'error') {
        throw new TranscriptionError(`Transcription failed: ${error || 'Unknown error'}`);
      }

      if (attempt === maxAttempts - 1) {
        throw new TranscriptionError('Transcription timed out');
      }

      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    } catch (error) {
      console.error(`❌ Transcription failed for ${fileName}`, error);
      throw new TranscriptionError(
        `Failed to check transcription status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  throw new TranscriptionError('Transcription timed out');
}

export async function transcribeMedia(file: File, metadata: FileMetadata): Promise<TranscriptionResult> {
  if (metadata.fileType !== 'audio' && metadata.fileType !== 'video') {
    throw new TranscriptionError('Invalid file type. Expected audio or video.');
  }

  try {
    const uploadUrl = await uploadToAssemblyAI(file);
    const transcriptId = await createTranscriptionJob(uploadUrl);
    const transcript = await pollTranscriptionStatus(transcriptId, metadata.fileName);

    return {
      fileName: metadata.fileName,
      type: metadata.fileType,
      transcript,
    };
  } catch (error) {
    console.error(`❌ Transcription failed for ${file.name}`, error);
    throw new TranscriptionError(
      error instanceof Error ? error.message : 'Failed to transcribe media'
    );
  }
}