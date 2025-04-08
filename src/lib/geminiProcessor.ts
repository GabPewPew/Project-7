import axios from 'axios';
import { GeminiRequest, GeminiResponse } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

function buildPrompt(request: GeminiRequest): string {
  if (!request || typeof request.content !== 'string') {
    throw new Error('Invalid request: content must be a string');
  }

  // Add unique identifier and metadata to force unique responses
  const uniqueId = `${request.fileId}_${Date.now()}`;
  const metadata = `Request ID: ${uniqueId}
File: ${request.fileName}
Content length: ${request.content.length} characters
Type: ${request.primary}${request.secondary ? ` - ${request.secondary}` : ''}

`;

  let basePrompt = '';
  
  if (request.intent === 'custom' && request.customPrompt) {
    basePrompt = request.customPrompt;
  } else if (request.intent === 'exam_prep' && request.style) {
    basePrompt = `Generate UNIQUE study notes for this specific content. Each response must be different from previous ones.
Focus on extracting and organizing the key concepts from this exact material.

Detail level: ${request.detailLevel} (1 = concise, 3 = comprehensive)

Format requirements:
1. Start with a unique title that reflects this specific content
2. Include clear headings and subheadings
3. Use bullet points for key concepts
4. Add relevant examples from the content
5. Highlight important terms in bold
6. Create custom memory aids based on this material`;
  } else if (request.intent === 'research' && request.style) {
    basePrompt = `Create a UNIQUE research summary for this specific content. Each response must be different from previous ones.
Focus on the distinct findings and insights from this exact material.

Detail level: ${request.detailLevel} (1 = concise, 3 = comprehensive)

Format requirements:
1. Start with a unique title that reflects this specific research
2. Include methodology and key findings
3. Highlight critical analysis points
4. Discuss specific implications
5. Suggest future research based on these exact findings`;
  }

  return `${metadata}${basePrompt}

Content to analyze:
${request.content}

Remember: This must be a UNIQUE analysis specific to this content. Do not generate generic or reused content.`;
}

export async function generateNotes(request: GeminiRequest): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    console.error('❌ Gemini API key is missing');
    throw new Error('API key is not configured');
  }

  try {
    console.log('📝 Generating notes for:', {
      fileId: request.fileId,
      fileName: request.fileName,
      contentLength: request.content.length,
      timestamp: Date.now()
    });

    const prompt = buildPrompt(request);
    
    const response = await axios({
      method: 'post',
      url: GEMINI_API_URL,
      params: { key: GEMINI_API_KEY },
      data: {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.8, // Increased for more variation
          topK: 40,
          topP: 0.95,
          candidateCount: 1
        }
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Gemini API response status:', response.status);
    
    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText || typeof generatedText !== 'string' || !generatedText.trim()) {
      console.error('❌ No valid text generated from response:', response.data);
      throw new Error('Failed to generate notes: No content received');
    }

    // Log content preview for debugging
    console.log('📄 Generated content preview:', {
      fileId: request.fileId,
      fileName: request.fileName,
      contentLength: generatedText.length,
      preview: generatedText.slice(0, 100)
    });

    // Extract mnemonics if present
    const mnemonics = generatedText.match(/(?<=\*\*Mnemonic:\*\*)(.*?)(?=\n|$)/g) || [];

    return {
      notes: generatedText,
      mnemonics: mnemonics.map(m => m.trim())
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      if (error.response?.status === 401) {
        throw new Error('Invalid API key');
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid request format');
      }
    }
    
    throw new Error(
      error instanceof Error 
        ? `Failed to generate notes: ${error.message}`
        : 'An unexpected error occurred'
    );
  }
}