import axios from 'axios';
import { GeminiRequest, GeminiResponse } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

const PROMPT_TEMPLATES = {
  exam_prep: {
    simple: (primary: string, secondary?: string) => 
      `As a professor of ${primary}${secondary ? ` specializing in ${secondary}` : ''}, create concise, exam-focused notes that are easy to memorize. Focus on:
- Key concepts and definitions
- High-yield facts
- Common exam questions
- Quick memory aids`,
    detailed: (primary: string, secondary?: string) =>
      `As an experienced ${primary} educator${secondary ? ` with expertise in ${secondary}` : ''}, create detailed study notes with:
- Comprehensive concept explanations
- Clinical correlations
- Practice questions
- Evidence-based facts`,
    deep_dive: (primary: string, secondary?: string) =>
      `As a leading expert in ${primary}${secondary ? ` and ${secondary}` : ''}, create in-depth academic notes with:
- Detailed mechanisms and processes
- Current research findings
- Expert insights
- External resources and citations`
  },
  research: {
    simple: (primary: string, secondary?: string) =>
      `As a ${primary} researcher${secondary ? ` focusing on ${secondary}` : ''}, create clear research summary notes with:
- Main findings and conclusions
- Key methodology points
- Important statistics
- Practical applications`,
    comprehensive: (primary: string, secondary?: string) =>
      `As a senior ${primary} researcher${secondary ? ` specializing in ${secondary}` : ''}, create detailed research analysis with:
- Critical evaluation of methods
- Data interpretation
- Literature connections
- Future research directions`
  }
};

function buildPrompt(request: GeminiRequest): string {
  if (!request || typeof request.content !== 'string') {
    throw new Error('Invalid request: content must be a string');
  }

  let basePrompt = '';
  
  if (request.intent === 'custom' && request.customPrompt) {
    basePrompt = request.customPrompt;
  } else if (request.intent === 'exam_prep' && request.style) {
    basePrompt = PROMPT_TEMPLATES.exam_prep[request.style](
      request.primary || 'Medicine',
      request.secondary
    );
  } else if (request.intent === 'research' && request.style) {
    basePrompt = PROMPT_TEMPLATES.research[request.style](
      request.primary || 'Medicine',
      request.secondary
    );
  }

  if (!basePrompt) {
    throw new Error('Invalid request: unable to build prompt');
  }

  return `${basePrompt}

Content to process:
${request.content}

Detail level: ${request.detailLevel} (1 = concise, 3 = comprehensive)

Format the response in Markdown with:
1. Clear headings and subheadings
2. Bullet points for key concepts
3. Examples where relevant
4. Important terms in bold
5. Memory aids or mnemonics where applicable`;
}

export async function generateNotes(request: GeminiRequest): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    console.error('❌ Gemini API key is missing');
    throw new Error('API key is not configured');
  }

  try {
    console.log('📬 Sending request to Gemini API...');
    const prompt = buildPrompt(request);
    
    const response = await axios({
      method: 'post',
      url: GEMINI_API_URL,
      params: { key: GEMINI_API_KEY },
      data: {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Gemini API response status:', response.status);
    
    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText || typeof generatedText !== 'string') {
      console.error('❌ No valid text generated from response:', response.data);
      throw new Error('Failed to generate notes: No content received');
    }

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