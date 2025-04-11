import fs from 'fs';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const ttsClient = new TextToSpeechClient({
  keyFilename: './google-credentials.json', // same as in your .env
});

const request = {
  input: { text: 'Hello! This is a test from your Google Cloud TTS credentials.' },
  voice: {
    languageCode: 'en-US',
    name: 'en-US-Studio-O', // or "en-US-Wavenet-D" if Studio-O fails
  },
  audioConfig: {
    audioEncoding: 'MP3',
  },
};

async function runTTS() {
  try {
    console.log('🔊 Testing Google Cloud TTS...');
    const [response] = await ttsClient.synthesizeSpeech(request);
    fs.writeFileSync('test.mp3', response.audioContent, 'binary');
    console.log('✅ Success! Audio written to test.mp3');
  } catch (error) {
    console.error('❌ TTS test failed:', error.message || error);
  }
}

runTTS();
