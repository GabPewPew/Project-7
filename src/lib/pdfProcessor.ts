import { FileMetadata } from './detectFileTypes';
import * as pdfjsLib from 'pdfjs-dist';

// Use a specific version of PDF.js worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface PDFProcessingResult {
  fileName: string;
  type: 'pdf';
  content: string;
  tables?: Array<{
    rows: Array<Array<string>>;
    pageNumber: number;
  }>;
}

class PDFProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFProcessingError';
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log('📄 Reading PDF file...');
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    console.log('📑 Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false, // Disable worker fetch to avoid CORS issues
      isEvalSupported: false, // Disable eval for security
      useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`📃 Processing page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Process each text item with position information
      const pageItems = textContent.items
        .map((item: any) => ({
          text: item.str,
          x: Math.round(item.transform[4]), // x position
          y: Math.round(item.transform[5]), // y position
          fontSize: Math.round(item.transform[0]) // font size
        }))
        .sort((a, b) => {
          // Sort by y position first (top to bottom)
          const yDiff = b.y - a.y;
          if (Math.abs(yDiff) > 5) return yDiff;
          // If y positions are close, sort by x position (left to right)
          return a.x - b.x;
        });

      // Group items into lines based on y-position
      const lines: string[][] = [];
      let currentLine: typeof pageItems = [];
      
      pageItems.forEach((item, index) => {
        if (index === 0) {
          currentLine.push(item);
          return;
        }

        const prevItem = pageItems[index - 1];
        // If y positions are close, items are on the same line
        if (Math.abs(item.y - prevItem.y) <= 5) {
          currentLine.push(item);
        } else {
          if (currentLine.length > 0) {
            lines.push(currentLine.map(i => i.text));
          }
          currentLine = [item];
        }
      });

      // Add the last line
      if (currentLine.length > 0) {
        lines.push(currentLine.map(i => i.text));
      }

      // Join lines with appropriate spacing
      const pageText = lines
        .map(line => line.join(' ').trim())
        .filter(line => line.length > 0)
        .join('\n');

      if (pageText.trim()) {
        pageTexts.push(pageText);
      }
    }
    
    const fullText = pageTexts.join('\n\n');
    
    if (!fullText.trim()) {
      throw new PDFProcessingError('No text content found in PDF');
    }

    console.log(`✅ Successfully extracted ${pageTexts.length} pages of text`);
    return fullText;
  } catch (error) {
    console.error('❌ PDF text extraction failed:', error);
    throw new PDFProcessingError(
      error instanceof Error ? error.message : 'Failed to extract text from PDF'
    );
  }
}

function detectTables(text: string): Array<{ rows: Array<Array<string>>; pageNumber: number }> {
  if (!text || typeof text !== 'string') {
    console.warn('Invalid text input for table detection');
    return [];
  }

  const tables: Array<{ rows: Array<Array<string>>; pageNumber: number }> = [];
  
  // Split text into lines and pages
  const pages = text.split('\n\n').filter(Boolean);
  
  pages.forEach((pageContent, pageIndex) => {
    const lines = pageContent.split('\n').map(line => line.trim()).filter(Boolean);
    
    let currentTable: Array<Array<string>> = [];
    let isInTable = false;
    let hasHeader = false;
    
    for (const line of lines) {
      // Detect potential table rows by looking for consistent delimiters or spacing
      const cells = line.split(/\s{2,}|\t|\|/).map(cell => cell.trim()).filter(Boolean);
      
      // Heuristics for table detection
      const isLikelyTableRow = 
        cells.length >= 2 && // At least 2 columns
        cells.every(cell => cell.length > 0) && // No empty cells
        !/^[A-Za-z]+ [A-Za-z]+/.test(line) && // Not likely a sentence
        !/^[•\-\*]/.test(line); // Not a bullet point
      
      if (isLikelyTableRow) {
        isInTable = true;
        
        // Check if this might be a header row
        if (!hasHeader && cells.every(cell => 
          cell === cell.toUpperCase() || // ALL CAPS
          /^[A-Z][a-z]+/.test(cell) // Title Case
        )) {
          hasHeader = true;
        }
        
        currentTable.push(cells);
      } else if (isInTable) {
        // End of table detected
        if (currentTable.length >= 2) { // Minimum 2 rows for a valid table
          // Ensure consistent column count
          const columnCount = currentTable[0].length;
          const validRows = currentTable.filter(row => row.length === columnCount);
          
          if (validRows.length >= 2) {
            tables.push({
              rows: validRows,
              pageNumber: pageIndex + 1
            });
          }
        }
        currentTable = [];
        isInTable = false;
        hasHeader = false;
      }
    }
    
    // Handle table at end of page
    if (isInTable && currentTable.length >= 2) {
      const columnCount = currentTable[0].length;
      const validRows = currentTable.filter(row => row.length === columnCount);
      
      if (validRows.length >= 2) {
        tables.push({
          rows: validRows,
          pageNumber: pageIndex + 1
        });
      }
    }
  });
  
  return tables;
}

export async function processPDF(file: File, metadata: FileMetadata): Promise<PDFProcessingResult> {
  if (metadata.fileType !== 'pdf') {
    throw new PDFProcessingError('Invalid file type. Expected PDF.');
  }

  try {
    console.log(`🔍 Processing PDF: ${metadata.fileName}`);
    
    // Extract text from PDF
    const text = await extractTextFromPDF(file);
    
    // Log content preview for debugging
    console.log('📄 Content preview:', text.slice(0, 300));
    console.log('📏 Total content length:', text.length);
    
    // Attempt to detect tables in the extracted text
    const tables = detectTables(text);
    
    console.log(`✅ PDF processing complete for ${metadata.fileName}`);
    if (tables.length > 0) {
      console.log(`📊 Found ${tables.length} potential tables`);
    }

    const result: PDFProcessingResult = {
      fileName: metadata.fileName,
      type: 'pdf',
      content: text,
      tables: tables.length > 0 ? tables : undefined
    };

    // Validate result before returning
    if (!result.content || typeof result.content !== 'string' || !result.content.trim()) {
      throw new PDFProcessingError('Failed to extract valid content from PDF');
    }

    return result;
  } catch (error) {
    console.error(`❌ Failed to process PDF ${metadata.fileName}:`, error);
    throw new PDFProcessingError(
      error instanceof Error ? error.message : 'Failed to process PDF'
    );
  }
}