import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function testGemini() {
  try {
    console.log("🤖 Testing Gemini generateContent...");

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // ✅ No "models/" prefix

    const prompt = "Give me a friendly one-line explanation of what the mitochondria does.";

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("✅ Gemini responded:");
    console.log(text);
  } catch (error) {
    console.error("❌ Gemini test failed:", error);
  }
}

testGemini();
