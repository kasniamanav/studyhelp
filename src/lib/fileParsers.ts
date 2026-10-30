import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_PDF_PAGES = 50;

export interface ExtractedFileResult {
  text: string;
  pageCount?: number;
  fileName: string;
}

export async function parseFile(file: File): Promise<ExtractedFileResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds 10MB limit. Please upload a smaller document.');
  }

  const name = file.name.toLowerCase();

  // 1. Plain text
  if (name.endsWith('.txt')) {
    const text = await file.text();
    return { text, fileName: file.name };
  }

  // 2. PDF Document
  if (name.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      if (numPages > MAX_PDF_PAGES) {
        throw new Error(`PDF exceeds page limit (${numPages} pages). Maximum allowed is ${MAX_PDF_PAGES} pages.`);
      }

      let fullText = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      return { text: fullText.trim(), pageCount: numPages, fileName: file.name };
    } catch (err: any) {
      throw new Error(`Could not read PDF: ${err.message || 'Corrupted file'}`);
    }
  }

  // 3. Word Document (.docx)
  if (name.endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { text: result.value.trim(), fileName: file.name };
    } catch (err: any) {
      throw new Error(`Could not read DOCX: ${err.message || 'Invalid format'}`);
    }
  }

  // 4. PowerPoint Presentation (.pptx)
  if (name.endsWith('.pptx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      let fullText = '';
      let slideNum = 1;

      // Slides are located in ppt/slides/slide{1..n}.xml
      const slideFiles = Object.keys(zip.files).filter((k) =>
        k.match(/^ppt\/slides\/slide\d+\.xml$/i)
      );
      // Sort naturally by slide number
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10);
        const numB = parseInt(b.replace(/\D/g, ''), 10);
        return numA - numB;
      });

      for (const slidePath of slideFiles) {
        const slideXml = await zip.files[slidePath].async('string');
        // Extract text inside <a:t> tags
        const regex = /<a:t[^>]*>(.*?)<\/a:t>/gi;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(slideXml)) !== null) {
          if (match[1]) matches.push(match[1]);
        }
        if (matches.length > 0) {
          fullText += `--- Slide ${slideNum} ---\n${matches.join(' ')}\n\n`;
        }
        slideNum++;
      }

      return { text: fullText.trim(), pageCount: slideFiles.length, fileName: file.name };
    } catch (err: any) {
      throw new Error(`Could not read PPTX: ${err.message || 'Invalid format'}`);
    }
  }

  throw new Error('Unsupported file format. Please upload .txt, .pdf, .docx, or .pptx');
}

