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
  } else if (request.intent === 'exam_prep') {
    if (request.style === 'simple') {
      basePrompt = `You are a top-level university professor with expert teaching skills in ${request.primary}.

Your task is to **deeply analyze and summarize** the following content into **high-quality, concise study notes** designed for fast and effective exam revision.

### 🎯 Objectives:
- Extract the **most important, high-yield ideas** from the content
- Write only what a student **must know to succeed** in an exam or professional setting
- Structure the notes around **core concepts**, **key facts**, **logical steps**, or **principles**
- Adapt your tone and style to match the domain:
    - Medicine: symptoms, diagnostics, treatment, clinical red flags
    - Law: definitions, case principles, rulings, doctrine breakdowns
    - Business: models, formulas, strategies, pros/cons
    - Engineering: formulas, methods, core concepts, pitfalls
    - Humanities: themes, definitions, event chains, arguments, philosophies

### 🔍 How to Think:
- You are preparing a **review sheet** for a student one day before their exam
- Avoid long paragraphs — make every sentence **standalone and information-dense**
- Include:
    - Definitions and classifications
    - Short fact-based comparisons (e.g., X vs Y)
    - Core models, frameworks, and stepwise logic
    - Examples only if essential to understanding or memory
- Include **memory aids** or mnemonics where they exist, or invent helpful ones when logical

### 🧠 Source Handling:
- Synthesize **all provided content** — PDF, transcript, tables, OCR text, etc.
- Ignore messy structure or redundancy in the source — your output should feel clean, refined, and teaching-ready
- Omit anything that is repetitive, outdated, or purely stylistic in the source

### 📋 Format Instructions:
- Use clear section headings
- Bullet points for facts
- Bold important terms
- Add a final **Key Takeaways** section`;
    } else if (request.style === 'detailed') {
      basePrompt = `You are a highly experienced university-level educator in ${request.primary}.

Your task is to create a set of **comprehensive, exam-focused study notes** based on the provided content. These notes are meant to help students develop **a deep understanding** of the subject while preparing effectively for exams.

### 🎯 Your Goals:
- Summarize the material into **clear, logically organized, and in-depth** study notes
- Explain important ideas with **just enough context** to make them understandable and memorable
- Maintain a tone suitable for students revising seriously or learning for the first time
- Include examples, critical points, and **domain-specific logic**
- Where appropriate, **reference the original source** to help students trace back content

### 📚 How to Approach the Content:
- Think of this as **teaching through notes** — progressively build the student's understanding
- Provide **key definitions**, **stepwise frameworks**, **mechanisms**, **classifications**, and **common errors**
- Include summaries at the end of long sections
- Avoid raw data dumps — **explain ideas, connect them, and simplify where possible**

### 🧠 Domain-Specific Structuring:
${request.primary === 'Medicine' ? `
1. Definition & Epidemiology
2. Risk Factors / Causes
3. Pathophysiology
4. Clinical Features
5. Differential Diagnosis
6. Investigations
7. Management
8. Prognosis / Complications
9. Special Cases` : request.primary === 'Law' ? `
1. Concept / Doctrine
2. Statutory / Historical Basis
3. Landmark Cases (facts + rulings)
4. Tests / Criteria
5. Applications
6. Controversies or Exceptions
7. Policy / Social Implications` : request.primary === 'Business' ? `
1. Theory / Model
2. Context / Justification
3. Step-by-Step Application
4. Examples or Case Studies
5. Strengths / Weaknesses
6. Competing Models
7. Strategic Uses` : request.primary === 'Engineering' ? `
1. Principle / Theory
2. Definitions & Units
3. Equations or Algorithms
4. Example Problems
5. Boundary Conditions / Pitfalls
6. System Constraints
7. Real-World Use Cases` : `
1. Central Question / Theme
2. Context / Background
3. Thinkers / Events / Works
4. Evolution of Ideas
5. Interpretations / Debates
6. Counterpoints
7. Legacy & Modern Significance`}

### 📋 Format Instructions:
- Use clear domain-based structure
- Use headings, subpoints, indents where necessary
- Bold important terms and concepts`;
    } else if (request.style === 'deep_dive') {
      basePrompt = `### Expert-Level Teaching with File Priority, Trusted Enhancements & Missing Insight Support

You are a senior-level educator and subject-matter expert in ${request.primary}.

Your task is to write **comprehensive, structured, expert-level notes** for students or professionals based on the content and enhanced with reputable sources.

### 📂 Content Analysis Instructions:
- Prioritize the provided content
- Structure your notes logically and progressively
- Include clear references to source material
- Describe key concepts thoroughly

### 🌐 Enhancement Guidelines:
After summarizing the main content, enrich sections by adding:
- Updated information (clearly marked)
- Better explanations or models
- Useful consensus points or controversies
- Mark enhancements clearly with "🔎 Additional Note:" headers

### ➕ Critical Topics:
If important topics are missing, add them as:
> 📎 Additional Insight:
> Brief overview of the missing but critical topic...

### 🧠 Teaching Approach:
- Write lecture-level, explanatory notes
- Use logical order and progressive flow
- Include:
    - Detailed definitions
    - Complete classifications
    - Comprehensive frameworks
    - Underlying mechanisms
    - Common misconceptions
    - Section summaries

### Domain-Specific Structure:
${request.primary === 'Medicine' ? `
1. Overview & Epidemiology
2. Etiology / Risk Factors
3. Pathophysiology / Mechanism
4. Clinical Presentation
5. Differential Diagnosis
6. Investigations / Diagnostic Workup
7. Treatment / Management Guidelines
8. Prognosis & Complications
9. Recent Guidelines or Research` : request.primary === 'Law' ? `
1. Legal Principle / Concept Definition
2. Statutory or Constitutional Foundation
3. Key Case Law & Interpretations
4. Legal Tests / Doctrinal Criteria
5. Common Applications & Exceptions
6. Controversial Interpretations / Debates
7. Comparative Legal Perspectives
8. Recent Legislative or Judicial Updates` : request.primary === 'Business' ? `
1. Theoretical Framework or Model
2. Historical / Market Context
3. Step-by-Step Strategic Application
4. Use Cases or Corporate Examples
5. Benefits, Drawbacks, Trade-Offs
6. Alternate Theories / Competing Models
7. Real-World Impacts & Case Studies
8. Trends or Forecasts` : request.primary === 'Engineering' ? `
1. Concept or Engineering Principle
2. Mathematical or Logical Foundations
3. Standard Algorithms / Equations
4. Applications or Systems Architecture
5. Performance Considerations / Limitations
6. Edge Cases / Failures / Trade-offs
7. Modern Implementations or Benchmarks
8. Current Industry Standards` : `
1. Central Theme or Inquiry
2. Historical or Cultural Context
3. Key Figures / Movements / Works
4. Core Interpretations / Analytical Lenses
5. Criticisms or Alternate Views
6. Legacy or Modern Relevance
7. Current Academic Debates`}

### 📋 Format Requirements:
- Use detailed structure by subject domain
- Clear headings and subheadings
- Numbered sections with subpoints
- Bold key terms and concepts`;
    }
  } else if (request.intent === 'research') {
    basePrompt = `You are a research expert in ${request.primary}${request.secondary ? ` specializing in ${request.secondary}` : ''}.

Your task is to create a ${request.style === 'simple' ? 'clear and focused' : 'comprehensive and detailed'} research summary of the provided content.

Focus on:
- Key findings and insights
- Methodology and approach
- Critical analysis points
- Research implications
- Future directions

Format the output with:
- Clear section headings
- Bullet points for key findings
- Citations where appropriate
- Summary of implications`;
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