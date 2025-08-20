import * as fs from 'node:fs';
import pdf from 'pdf-parse'
import { Embeder } from "../ports/Embedder";
import * as path from 'node:path';
import { VectorStore, DocumentChunk } from '../ports/VectorStore';

export class IngestHandler {
  constructor(private readonly vectorStore: VectorStore, private readonly embeder: Embeder) {}

  private isDirectory(pathName: string): boolean {
    try {
      const stats = fs.statSync(pathName);
      return stats.isDirectory();
    } catch (error) {
      return false
    }
  }

  private isPdfFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.pdf';
  }

  private async getAllPdfFiles(dirPath: string): Promise<string[]> {
    const pdfFiles: string[] = [];

    const processDirectory = (currentPath: string) => {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          processDirectory(fullPath);
        } else if (this.isPdfFile(fullPath)) {
          pdfFiles.push(fullPath);
        }
      }
    };

    processDirectory(dirPath);
    return pdfFiles;
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .trim();
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return this.sanitizeText(data.text);
    } catch (error) {
      console.error(`❌ Error processing PDF ${path.basename(filePath)}:`, error);
      return '';
    }
  }

  private chunkByParagraphs(content: string,  options: { chunkSize: number, overlap: number }): string[] {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim())
    const chunks: string[] = []

    let i = 0
    while (i < paragraphs.length) {
      let currentChunk = ''
      let paragraphsInChunk = 0

      while (i + paragraphsInChunk < paragraphs.length) {
        const testChunk = currentChunk +
          (currentChunk ? '\n\n' : '') +
          paragraphs[i + paragraphsInChunk]

        if (testChunk.length > options.chunkSize && currentChunk) break

        currentChunk = testChunk
        paragraphsInChunk++
      }

      chunks.push(currentChunk.trim())

      const overlapParagraphs = Math.ceil(paragraphsInChunk * (options.overlap / options.
  chunkSize))
      i += Math.max(1, paragraphsInChunk - overlapParagraphs)
    }

    return chunks
  }


  private async getChunks(source: string, content: string, chunkSize: number): Promise<{ text: string, metadata: Record<string, any>}[]> {
    const chunks: string[] = this.chunkByParagraphs(content, {
      chunkSize,
      overlap: Math.floor(chunkSize * 0.1) // 10% overlap
    });

    return chunks.map((chunk, index) => ({
      text: chunk,
      metadata: {
        source,
        chunkIndex: index,
        fileName: path.basename(source)
      }
    }));
  }

  public async run(pathName: string, chunkSize: number = 1000) {
    const normalizedPath = path.normalize(pathName.trim());
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Path does not exist: ${normalizedPath}`);
    }

    let filesToProcess: string[] = [];

    if (this.isDirectory(normalizedPath)) {
      console.log(`📁 Processing directory: ${normalizedPath}`);
      filesToProcess = await this.getAllPdfFiles(normalizedPath);

      if (filesToProcess.length === 0) {
        throw new Error(`No PDF files found in directory: ${normalizedPath}`);
      }

      console.log(`📄 Found ${filesToProcess.length} PDF files:`);
      filesToProcess.forEach(file => console.log(`  - ${path.basename(file)}`));
    } else {
      if (!this.isPdfFile(normalizedPath)) {
        throw new Error(`File is not a PDF: ${normalizedPath}`);
      }
      filesToProcess = [normalizedPath];
      console.log(`📄 Processing single file: ${normalizedPath}`);
    }

    let successfulFiles = 0;
    let skippedFiles = 0;

    for (const filePath of filesToProcess) {
      console.log(`🔄 Processing: ${path.basename(filePath)}`);

      try {
        const content = await this.extractTextFromPdf(filePath);
        if (!content.trim()) {
          console.warn(`⚠️  No text extracted from: ${path.basename(filePath)}`);
          skippedFiles++;
          continue;
        }

        console.log(`📝 Extracted ${content.length} characters from ${path.basename(filePath)}`);

        const chunks = await this.getChunks(filePath, content, chunkSize);
        console.log(`📦 Created ${chunks.length} chunks from ${path.basename(filePath)}`);

        const documentChunks: DocumentChunk[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await this.embeder.getEmbeddings(chunk.text);

          documentChunks.push({
            content: chunk.text,
            embedding,
            metadata: chunk.metadata,
            source: filePath,
            chunkIndex: i
          });
        }

        try {
          console.log(`💾 Inserting ${documentChunks.length} chunks from ${path.basename(filePath)}`);
          await this.vectorStore.insertDocuments(documentChunks);
          console.log(`✅ Successfully processed ${path.basename(filePath)}`);
          successfulFiles++;
        } catch (dbError: any) {
          if (dbError.code === '22021') {
            console.error(`❌ Encoding error in ${path.basename(filePath)} - skipping file`);
            console.error(`   File contains invalid UTF-8 characters that cannot be stored`);
            skippedFiles++;
          } else {
            console.error(`❌ Database error for ${path.basename(filePath)}:`, dbError.message);
            skippedFiles++;
          }
        }

      } catch (fileError: any) {
        console.error(`❌ Error processing ${path.basename(filePath)}:`, fileError.message);
        skippedFiles++;
      }
    }

    if (successfulFiles === 0) {
      throw new Error('No files were successfully processed');
    }

    console.log(`🎉 Processing complete:`);
    console.log(`   ✅ Successfully processed: ${successfulFiles} files`);
    if (skippedFiles > 0) {
      console.log(`   ⚠️  Skipped: ${skippedFiles} files`);
    }
  }
}