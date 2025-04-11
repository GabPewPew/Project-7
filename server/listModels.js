import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

(async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

    console.log("🔍 Listing available models for your key...");
    const response = await axios.get(url);
    console.log("✅ Models:", response.data);
  } catch (error) {
    console.error("❌ Failed to list models:", error.response?.data || error.message);
  }
})();
