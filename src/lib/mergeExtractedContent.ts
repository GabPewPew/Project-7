import { ProcessingResult } from '../types';

interface ExtractedContent {
  narrativeText: string;
  tables: string[];
  title?: string;
  headings: string[];
}

function extractTitle(content: string): string | undefined {
  if (!content || typeof content !== 'string') {
    return undefined;
  }

  const lines = content.split('\n').slice(0, 5);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length > 10 && trimmed.length < 100) {
      return trimmed;
    }
  }
  return undefined;
}

function extractHeadings(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split('\n');
  return lines
    .filter(line => {
      const trimmed = line.trim();
      return (
        trimmed &&
        trimmed.length < 100 &&
        (trimmed.endsWith(':') || /^[A-Z][A-Za-z\s]{2,}$/.test(trimmed))
      );
    })
    .map(line => line.trim());
}

function formatTable(rows: Array<Array<string>>): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  // Create header row
  const header = rows[0].map(cell => cell || 'Column');
  
  // Create separator row
  const separator = header.map(() => '---');
  
  // Format all rows
  const formattedRows = [
    header.join(' | '),
    separator.join(' | '),
    ...rows.slice(1).map(row => row.map(cell => cell || '').join(' | '))
  ];

  return formattedRows.join('\n');
}

function extractContentStructure(result: ProcessingResult): ExtractedContent {
  const defaultContent: ExtractedContent = {
    narrativeText: '',
    tables: [],
    headings: []
  };

  if (!result || typeof result.content !== 'string' || !result.content.trim()) {
    console.warn('Invalid content structure in result:', result);
    return defaultContent;
  }

  try {
    const content = result.content;
    const lines = content.split('\n');
    
    // Extract narrative text (non-table content)
    const narrativeLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.includes('|') && !trimmed.match(/^\s*[-–—]\s+/);
    });

    // Format tables if present
    const tables = result.tables && Array.isArray(result.tables)
      ? result.tables.map(table => {
          if (table && Array.isArray(table.rows)) {
            return formatTable(table.rows);
          }
          return '';
        }).filter(Boolean)
      : [];

    return {
      narrativeText: narrativeLines.join('\n'),
      tables,
      title: extractTitle(content),
      headings: extractHeadings(content)
    };
  } catch (error) {
    console.error('Error extracting content structure:', error);
    return defaultContent;
  }
}

function getSemanticExcerpt(content: ExtractedContent): string {
  if (!content || typeof content.narrativeText !== 'string') {
    console.warn('Invalid content for semantic excerpt:', content);
    return '';
  }

  const parts: string[] = [];

  // Add title if available
  if (content.title) {
    parts.push(content.title);
  }

  // Add first few headings
  if (Array.isArray(content.headings) && content.headings.length > 0) {
    parts.push(...content.headings.slice(0, 3));
  }

  // Add first few paragraphs of narrative text
  const narrativeChunks = content.narrativeText
    .split('\n\n')
    .filter(chunk => chunk.trim().length > 50)
    .slice(0, 2);
  
  parts.push(...narrativeChunks);

  return parts.join('\n\n');
}

export function mergeExtractedContent(results: ProcessingResult[]): string {
  if (!Array.isArray(results) || results.length === 0) {
    console.warn('No valid results to merge');
    return '';
  }

  const sections: string[] = [];
  const extractedContents: ExtractedContent[] = [];

  results.forEach((result) => {
    if (!result || typeof result.content !== 'string' || !result.content.trim()) {
      console.warn('Invalid result:', result);
      return;
    }

    try {
      const extracted = extractContentStructure(result);
      extractedContents.push(extracted);

      // Add file header
      sections.push(`## ${result.type.toUpperCase()}: ${result.fileName}`);
      
      // Add title if found
      if (extracted.title) {
        sections.push(`### ${extracted.title}`);
      }

      // Add narrative content
      if (extracted.narrativeText) {
        sections.push(extracted.narrativeText);
      }

      // Add relevant tables (if any)
      if (Array.isArray(extracted.tables) && extracted.tables.length > 0) {
        sections.push('\n### Tables\n');
        extracted.tables.forEach((table, index) => {
          if (table) {
            sections.push(`#### Table ${index + 1}`);
            sections.push(table);
            sections.push(''); // Empty line after table
          }
        });
      }

      // Add separator between files
      sections.push('\n---\n');
    } catch (error) {
      console.error('Error processing result:', error);
    }
  });

  const mergedContent = sections.join('\n\n');
  console.log('📄 Merged content ready for processing');
  
  return mergedContent;
}

export function getTopicExcerpt(results: ProcessingResult[]): string {
  if (!Array.isArray(results) || results.length === 0) {
    console.warn('No valid results for topic excerpt');
    return '';
  }

  try {
    const extractedContents = results
      .filter(result => result && typeof result.content === 'string' && result.content.trim())
      .map(result => extractContentStructure(result));
    
    const excerpts = extractedContents.map(content => getSemanticExcerpt(content));
    return excerpts.filter(Boolean).join('\n\n---\n\n');
  } catch (error) {
    console.error('Error getting topic excerpt:', error);
    return '';
  }
}