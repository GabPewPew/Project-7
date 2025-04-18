import * as pdfjs from 'pdfjs-dist';

// Make sure the worker source is set
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Small 1x1 transparent pixel as a fallback image
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Creates a basic PDF file in memory with the specified number of pages
 * Each page will contain just the page number
 * 
 * @param pageCount Number of pages to create
 * @param title Optional title to include in the PDF
 * @returns A File object containing the PDF
 */
export function createBasicPdf(pageCount: number = 10, title?: string): File {
  // Create a very basic PDF with just enough structure to render
  const pdfContent = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Count ' + pageCount + '/Kids['
  ];
  
  // Add page references to the Kids array
  const pageRefs = [];
  for (let i = 0; i < pageCount; i++) {
    pageRefs.push((i + 3) + ' 0 R');
  }
  pdfContent.push(pageRefs.join(' ') + ']>>endobj');
  
  // Create each page object
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    pdfContent.push(
      // Page object - use a larger page size for better visuals (Letter size)
      (i + 3) + ' 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>/F2<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>>>/ExtGState<</GS1<</ca 1/CA 1>>>>>>/Contents ' + (pageCount + i + 3) + ' 0 R>>endobj'
    );
  }
  
  // Create each page content stream with improved styling
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    
    // Create a more visually appealing page with basic styling
    let content = [
      // Save graphics state
      'q',
      // Draw a light blue background header
      '0.9 0.95 1.0 rg', // Light blue color
      '0 742 612 50 re', // Rectangle at top of page
      'f',
      // Draw a footer
      '0.9 0.9 0.9 rg', // Light gray
      '0 0 612 40 re',
      'f',
      // Draw a border around the page
      '0.8 0.8 0.8 RG', // Border color
      '1 w', // Line width
      '10 10 592 772 re', // Rectangle with margin
      'S',
      // Text for page number (larger, centered, bold)
      'BT',
      '/F2 24 Tf', // Bold font
      '1 0 0 1 306 730 Tm', // Centered at top
      '0 0 0 rg', // Black text
      `(Page ${pageNum}) Tj`,
      'ET',
    ];
    
    // Add title if provided
    if (title) {
      content = [
        ...content,
        'BT',
        '/F2 18 Tf', // Bold font
        '1 0 0 1 306 650 Tm', // Centered below page number
        '0 g', // Black
        'q 0 0 0 rg', 
        `(${title}) Tj`,
        'Q',
        'ET',
      ];
    }
    
    // Add decorative elements based on page number
    content = [
      ...content,
      // Draw a horizontal line below the header
      '0.7 0.7 0.7 RG',
      '0.5 w',
      '50 700 512 0 re',
      'S',
      // Add page info at bottom
      'BT',
      '/F1 10 Tf',
      '1 0 0 1 306 20 Tm',
      '0.5 0.5 0.5 rg', // Gray text
      `(${title || 'Generated PDF'} - Page ${pageNum} of ${pageCount}) Tj`,
      'ET',
      // Text alignment - centered
      'BT',
      '/F1 16 Tf',
      '1 0 0 1 306 400 Tm',
      '0 g',
      '(This is sample content for page ' + pageNum + ') Tj',
      'ET',
      // Restore graphics state
      'Q'
    ];
    
    // Join all content with newlines
    const stream = content.join('\n');
    
    // Create the content object with the stream
    const contentObj = (pageCount + i + 3) + ' 0 obj<</Length ' + stream.length + '>>stream\n' + stream + '\nendstream\nendobj';
    pdfContent.push(contentObj);
  }
  
  // Create a simple xref table
  pdfContent.push('xref');
  pdfContent.push('0 ' + (pageCount * 2 + 3));
  pdfContent.push('0000000000 65535 f');
  
  let offset = 0;
  for (let i = 1; i < (pageCount * 2 + 3); i++) {
    // Calculate the offset (not accurate but sufficient for demonstration)
    offset += pdfContent[i-1].length + 1;
    // Format offset with leading zeros
    const offsetStr = offset.toString().padStart(10, '0');
    pdfContent.push(offsetStr + ' 00000 n');
  }
  
  // Trailer
  pdfContent.push('trailer<</Size ' + (pageCount * 2 + 3) + '/Root 1 0 R>>');
  pdfContent.push('startxref');
  pdfContent.push(offset.toString());
  pdfContent.push('%%EOF');
  
  // Join all lines with newlines
  const pdfString = pdfContent.join('\n');
  
  // Create a PDF file from the content
  const blob = new Blob([pdfString], { type: 'application/pdf' });
  return new File([blob], title || 'generated.pdf', { type: 'application/pdf' });
}

/**
 * Extracts an image of a specific page from a PDF file
 * 
 * @param pdfFile The PDF file to extract from
 * @param pageNumber The page number to render (1-indexed)
 * @param scale The scale to render at (default: 1.0)
 * @returns A Promise resolving to a base64-encoded image
 */
export async function extractPageImage(pdfFile: File, pageNumber: number, scale: number = 1.0): Promise<string> {
  try {
    console.log(`Starting page image extraction for PDF "${pdfFile.name}", page ${pageNumber}`);
    
    if (!pdfFile || pdfFile.size === 0) {
      console.error(`Invalid PDF file or empty file: ${pdfFile?.name || 'unknown'}`);
      return FALLBACK_IMAGE;
    }
    
    // Load the file data
    const fileData = await readFileAsArrayBuffer(pdfFile);
    if (!fileData || fileData.byteLength === 0) {
      console.error('Failed to read PDF file data');
      return FALLBACK_IMAGE;
    }
    
    console.log(`Successfully read ${fileData.byteLength} bytes from PDF file`);

    // Create a new PDF.js task with specific parameters
    const pdfTask = pdfjs.getDocument({
      data: new Uint8Array(fileData),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      disableFontFace: false,
      isEvalSupported: true,
      useSystemFonts: true, // Allow system fonts to improve rendering
    });
    
    try {
      console.log(`Loading PDF document...`);
      const pdf = await pdfTask.promise;
      console.log(`PDF document loaded with ${pdf.numPages} pages`);
      
      if (pageNumber < 1 || pageNumber > pdf.numPages) {
        console.error(`Page number ${pageNumber} is outside valid range (1-${pdf.numPages})`);
        return FALLBACK_IMAGE;
      }
      
      // Get the specified page
      console.log(`Getting page ${pageNumber}...`);
      const page = await pdf.getPage(pageNumber);
      
      // Apply scale for better quality images
      const viewport = page.getViewport({ scale });
      
      // Create off-screen canvas with higher resolution for better quality
      console.log(`Creating canvas with dimensions ${viewport.width} x ${viewport.height}`);
      const canvas = document.createElement('canvas');
      
      // Use pixel ratio for higher quality on high DPI displays
      const pixelRatio = window.devicePixelRatio || 1;
      const scaledWidth = Math.floor(viewport.width * pixelRatio);
      const scaledHeight = Math.floor(viewport.height * pixelRatio);
      
      // Set display size
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      // Set actual size considering device pixel ratio
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      
      // Force pixel dimensions to be reasonable for a thumbnail
      const MAX_DIMENSION = 1200; // Increased for better quality
      if (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / canvas.width, MAX_DIMENSION / canvas.height);
        canvas.width = Math.floor(canvas.width * ratio);
        canvas.height = Math.floor(canvas.height * ratio);
        console.log(`Resized canvas to ${canvas.width} x ${canvas.height}`);
      }
      
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        console.error('Could not get canvas 2D context');
        return FALLBACK_IMAGE;
      }
      
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Adjust viewport to match canvas size with pixel ratio consideration
      const scaledViewport = page.getViewport({ 
        scale: Math.min(canvas.width / viewport.width, canvas.height / viewport.height) * scale * pixelRatio
      });
      
      // Render the page with higher quality settings
      console.log(`Rendering page ${pageNumber} to canvas...`);
      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
        intent: 'display',
      }).promise;
      
      console.log(`Page ${pageNumber} rendered successfully, converting to image...`);
      
      // Convert to image with better quality
      try {
        // Try JPEG with medium quality for better visuals
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // Increased quality
        
        if (dataUrl && dataUrl.length > 100) {
          console.log(`Successfully created JPEG image for page ${pageNumber}, length: ${dataUrl.length}`);
          return dataUrl;
        }
        
        // If JPEG fails, try PNG as fallback
        console.log(`JPEG conversion failed or too small, trying PNG...`);
        const pngDataUrl = canvas.toDataURL('image/png');
        
        if (pngDataUrl && pngDataUrl.length > 100) {
          console.log(`Successfully created PNG image for page ${pageNumber}, length: ${pngDataUrl.length}`);
          return pngDataUrl;
        }
        
        throw new Error('Failed to generate valid image data');
      } catch (e) {
        console.error(`Error converting canvas to image: ${e}`);
        return FALLBACK_IMAGE;
      }
    } catch (e) {
      console.error(`Error processing PDF page ${pageNumber}: ${e}`);
      return FALLBACK_IMAGE;
    }
  } catch (error) {
    console.error(`Unhandled error in extractPageImage: ${error}`);
    return FALLBACK_IMAGE;
  }
}

/**
 * Helper function to read a File as ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Batch processes multiple pages from a PDF to extract page images
 * 
 * @param pdfFile The PDF file to extract from
 * @param pageNumbers Array of page numbers to extract images for
 * @param scale The scale to render at (default: 1.0)
 * @returns A Promise resolving to a map of page numbers to base64 images
 */
export async function extractMultiplePageImages(
  pdfFile: File, 
  pageNumbers: number[], 
  scale: number = 1.0
): Promise<Map<number, string>> {
  const pageImages = new Map<number, string>();
  
  if (!pageNumbers || pageNumbers.length === 0) {
    console.warn('No page numbers provided for image extraction');
    return pageImages;
  }
  
  if (!pdfFile || !(pdfFile instanceof File)) {
    console.error('Invalid PDF file provided for image extraction');
    pageNumbers.forEach(pageNum => {
      pageImages.set(pageNum, FALLBACK_IMAGE);
    });
    return pageImages;
  }
  
  console.log(`Starting batch image extraction for ${pageNumbers.length} pages from "${pdfFile.name}"`);
  
  try {
    // Load PDF data once for all pages
    const fileData = await readFileAsArrayBuffer(pdfFile);
    if (!fileData || fileData.byteLength === 0) {
      throw new Error('Failed to read PDF file data');
    }
    
    console.log(`Successfully read ${fileData.byteLength} bytes from PDF file`);

    // Create a PDF.js document once
    const pdfTask = pdfjs.getDocument({
      data: new Uint8Array(fileData),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      disableFontFace: false,
      isEvalSupported: true,
      useSystemFonts: true,
    });
    
    const pdf = await pdfTask.promise;
    console.log(`PDF document loaded with ${pdf.numPages} pages`);
    
    // Filter invalid page numbers
    const validPageNumbers = pageNumbers.filter(pageNum => 
      pageNum >= 1 && pageNum <= pdf.numPages
    );
    
    if (validPageNumbers.length === 0) {
      console.error('No valid page numbers found within PDF range');
      pageNumbers.forEach(pageNum => {
        pageImages.set(pageNum, FALLBACK_IMAGE);
      });
      return pageImages;
    }

    // Use a batch approach - process a few pages concurrently to balance performance
    const BATCH_SIZE = 3; // Number of pages to process concurrently
    for (let i = 0; i < validPageNumbers.length; i += BATCH_SIZE) {
      const batch = validPageNumbers.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}: Pages ${batch.join(', ')}`);
      
      // Process this batch concurrently
      const batchPromises = batch.map(async pageNum => {
        try {
          // Get the page
          const page = await pdf.getPage(pageNum);
          
          // Create a canvas for this page
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          
          // Use pixel ratio for higher quality on high DPI displays
          const pixelRatio = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio); 
          
          // Force reasonable dimensions
          const MAX_DIMENSION = 1200;
          if (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION) {
            const ratio = Math.min(MAX_DIMENSION / canvas.width, MAX_DIMENSION / canvas.height);
            canvas.width = Math.floor(canvas.width * ratio);
            canvas.height = Math.floor(canvas.height * ratio);
          }
          
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) throw new Error('Could not get canvas 2D context');
          
          // Fill with white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Adjust viewport to match canvas size
          const scaledViewport = page.getViewport({ 
            scale: Math.min(canvas.width / viewport.width, canvas.height / viewport.height) * scale * pixelRatio
          });
          
          // Render the page
          await page.render({
            canvasContext: ctx,
            viewport: scaledViewport,
            intent: 'display',
          }).promise;
          
          // Convert to image
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          
          if (dataUrl && dataUrl.length > 100) {
            console.log(`Successfully created image for page ${pageNum}, length: ${Math.round(dataUrl.length/1024)}KB`);
            return { pageNum, image: dataUrl };
          }
          
          // If JPEG fails, try PNG
          const pngDataUrl = canvas.toDataURL('image/png');
          if (pngDataUrl && pngDataUrl.length > 100) {
            console.log(`Created PNG fallback for page ${pageNum}, length: ${Math.round(pngDataUrl.length/1024)}KB`);
            return { pageNum, image: pngDataUrl };
          }
          
          throw new Error('Failed to generate valid image data');
        } catch (err) {
          console.error(`Failed to extract image for page ${pageNum}:`, err);
          return { pageNum, image: FALLBACK_IMAGE };
        }
      });
      
      // Wait for all pages in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add results to the map
      batchResults.forEach(({ pageNum, image }) => {
        pageImages.set(pageNum, image);
      });
      
      // Add a small delay between batches to prevent browser throttling
      if (i + BATCH_SIZE < validPageNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Batch extraction complete. Extracted ${pageImages.size} page images.`);
  } catch (error) {
    console.error('Error in batch image extraction:', error);
    // Set fallback images for any pages that weren't processed
    pageNumbers.forEach(pageNum => {
      if (!pageImages.has(pageNum)) {
        pageImages.set(pageNum, FALLBACK_IMAGE);
      }
    });
  }
  
  return pageImages;
} 