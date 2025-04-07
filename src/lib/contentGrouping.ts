import axios from 'axios';
import { ProcessingResult, SimilarityScore, ContentGroup } from '../types';
import { getTopicExcerpt } from './mergeExtractedContent';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

// Cache for similarity scores and subject tags
const similarityCache = new Map<string, number>();
const subjectCache = new Map<string, { primary: string; secondary?: string }>();

const getCacheKey = (fileA: string, fileB: string): string => {
  const names = [fileA, fileB].sort();
  return `${names[0]}|${names[1]}`;
};

// Medical specialties for precise subject classification
const MEDICAL_SPECIALTIES = {
  primary: [
    'Medicine',
    'Surgery',
    'Pediatrics',
    'Psychiatry',
    'Emergency Medicine',
    'Family Medicine'
  ],
  secondary: {
    Medicine: [
      'Cardiology',
      'Dermatology',
      'Endocrinology',
      'Gastroenterology',
      'Hematology',
      'Infectious Disease',
      'Nephrology',
      'Neurology',
      'Oncology',
      'Pulmonology',
      'Rheumatology'
    ],
    Surgery: [
      'Cardiac Surgery',
      'General Surgery',
      'Neurosurgery',
      'Ophthalmology',
      'Orthopedics',
      'Otolaryngology',
      'Plastic Surgery',
      'Thoracic Surgery',
      'Urology',
      'Vascular Surgery'
    ],
    Pediatrics: [
      'Pediatric Cardiology',
      'Pediatric Endocrinology',
      'Pediatric Gastroenterology',
      'Pediatric Hematology',
      'Pediatric Neurology',
      'Pediatric Oncology',
      'Pediatric Surgery'
    ],
    Psychiatry: [
      'Child Psychiatry',
      'Geriatric Psychiatry',
      'Addiction Psychiatry',
      'Forensic Psychiatry'
    ],
    'Emergency Medicine': [
      'Critical Care',
      'Trauma Surgery',
      'Toxicology'
    ],
    'Family Medicine': [
      'Geriatrics',
      'Palliative Care',
      'Sports Medicine',
      'Preventive Medicine'
    ]
  }
};

// Clean JSON response from Markdown code blocks and ensure valid JSON
const cleanJsonResponse = (response: string): string | null => {
  try {
    if (!response || typeof response !== 'string') {
      return null;
    }

    // Remove markdown code blocks if present
    let cleaned = response
      .replace(/```(?:json)?\s*/g, '')
      .replace(/\s*```$/g, '')
      .trim();

    // Remove any additional text before or after the JSON object
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }

    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

    // Attempt to parse and stringify to ensure valid JSON
    const parsed = JSON.parse(cleaned);
    return JSON.stringify(parsed);
  } catch (error) {
    console.warn('Failed to clean JSON response:', error);
    return null;
  }
};

async function getSimilarityScore(contentA: string, contentB: string, fileNameA: string, fileNameB: string): Promise<number> {
  const cacheKey = getCacheKey(fileNameA, fileNameB);
  if (similarityCache.has(cacheKey)) {
    return similarityCache.get(cacheKey)!;
  }

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{
          parts: [{
            text: `Compare these medical/educational documents and return a similarity score as a single number between 0 and 1.

Document A:
${contentA.substring(0, 2000)}

Document B:
${contentB.substring(0, 2000)}

Return ONLY a number between 0 and 1, no other text or formatting.`
          }]
        }]
      },
      {
        params: { key: GEMINI_API_KEY },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const score = parseFloat(response.data.candidates[0].content.parts[0].text.trim());
    if (isNaN(score) || score < 0 || score > 1) {
      console.warn('Invalid similarity score:', score);
      return 0;
    }

    similarityCache.set(cacheKey, score);
    return score;
  } catch (error) {
    console.error('Error getting similarity score:', error);
    return 0;
  }
}

async function getSubjectTags(content: string): Promise<{ primary: string; secondary?: string }> {
  if (!content || typeof content !== 'string') {
    console.warn('Invalid content for subject tags');
    return { primary: 'Medicine' };
  }

  const cacheKey = content.substring(0, 100);
  if (subjectCache.has(cacheKey)) {
    return subjectCache.get(cacheKey)!;
  }

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{
          parts: [{
            text: `Classify this medical content into primary and secondary specialties.

Primary Categories (Choose ONE):
${MEDICAL_SPECIALTIES.primary.join(', ')}

Content to classify:
${content.substring(0, 3000)}

Return ONLY a JSON object with "primary" and optionally "secondary" fields. Example:
{"primary": "Medicine", "secondary": "Cardiology"}`
          }]
        }]
      },
      {
        params: { key: GEMINI_API_KEY },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const rawResponse = response.data.candidates[0].content.parts[0].text;
    const cleanedJson = cleanJsonResponse(rawResponse);
    
    if (!cleanedJson) {
      console.warn('Failed to get valid JSON response from API');
      return { primary: 'Medicine' };
    }

    let result;
    try {
      result = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.warn('Error parsing subject tags JSON:', parseError);
      return { primary: 'Medicine' };
    }
      
    // Validate primary category
    if (!result.primary || !MEDICAL_SPECIALTIES.primary.includes(result.primary)) {
      console.warn('Invalid primary category:', result.primary);
      result.primary = 'Medicine';
    }

    // Validate secondary category against primary's allowed specialties
    if (result.secondary) {
      const allowedSecondary = MEDICAL_SPECIALTIES.secondary[result.primary as keyof typeof MEDICAL_SPECIALTIES.secondary];
      if (!allowedSecondary?.includes(result.secondary)) {
        console.warn('Invalid secondary category for', result.primary, ':', result.secondary);
        delete result.secondary;
      }
    }

    subjectCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error getting subject tags:', error);
    return { primary: 'Medicine' };
  }
}

export async function groupContentBySimilarity(results: ProcessingResult[]): Promise<ContentGroup[]> {
  if (!Array.isArray(results) || results.length === 0) {
    console.warn('No valid results to group');
    return [];
  }

  // Validate results array
  const validResults = results.filter(result => 
    result && 
    typeof result.content === 'string' && 
    typeof result.fileName === 'string' &&
    result.content.trim() !== ''
  );

  if (validResults.length === 0) {
    console.warn('No valid results after filtering');
    return [];
  }

  // Get topic excerpt for more accurate classification
  const topicExcerpt = getTopicExcerpt(validResults);
  
  // Get initial subject tags from the excerpt
  const initialTags = await getSubjectTags(topicExcerpt);

  // For single files, return a single group
  if (validResults.length === 1) {
    return [{
      groupTitle: initialTags.primary,
      primary: initialTags.primary,
      secondary: initialTags.secondary,
      files: [validResults[0].fileName],
      mergedContent: validResults[0].content
    }];
  }

  // Calculate pairwise similarity scores
  const similarityScores: SimilarityScore[] = [];
  for (let i = 0; i < validResults.length; i++) {
    for (let j = i + 1; j < validResults.length; j++) {
      const similarity = await getSimilarityScore(
        validResults[i].content,
        validResults[j].content,
        validResults[i].fileName,
        validResults[j].fileName
      );
      similarityScores.push({
        fileA: validResults[i].fileName,
        fileB: validResults[j].fileName,
        similarity
      });
    }
  }

  // Group files by similarity
  const groups: Set<string>[] = [];
  const processedFiles = new Set<string>();

  for (const score of similarityScores) {
    if (score.similarity >= 0.8) {
      const existingGroup = groups.find(group => 
        group.has(score.fileA) || group.has(score.fileB)
      );

      if (existingGroup) {
        existingGroup.add(score.fileA);
        existingGroup.add(score.fileB);
      } else {
        groups.push(new Set([score.fileA, score.fileB]));
      }
      processedFiles.add(score.fileA);
      processedFiles.add(score.fileB);
    }
  }

  // Add remaining files as single-file groups
  validResults.forEach(result => {
    if (!processedFiles.has(result.fileName)) {
      groups.push(new Set([result.fileName]));
    }
  });

  // Create final group structure with subject tags
  const contentGroups: ContentGroup[] = await Promise.all(
    groups.map(async group => {
      const groupFiles = Array.from(group);
      const groupResults = validResults.filter(r => groupFiles.includes(r.fileName));
      
      // Get topic excerpt for this group
      const groupExcerpt = getTopicExcerpt(groupResults);
      const { primary, secondary } = await getSubjectTags(groupExcerpt);
      
      // Merge content with clear section breaks
      const mergedContent = groupResults
        .map(r => r.content)
        .join('\n\n---\n\n');
      
      return {
        groupTitle: primary,
        primary,
        secondary,
        files: groupFiles,
        mergedContent
      };
    })
  );

  return contentGroups;
}