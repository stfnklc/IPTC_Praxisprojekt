import { FastifyBaseLogger } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util';
// KORREKTUR: 'Readable' statt 'Stream' importieren
import { pipeline, Readable } from 'stream'; 
import archiver from 'archiver';
import mime from 'mime-types';

const pump = util.promisify(pipeline);

export class FileService {
  constructor(
    private logger: FastifyBaseLogger,
    private uploadsDir: string
  ) {}

  getFilePath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  // KORREKTUR: Den Typ von 'data.file' auf 'Readable' ändern
  async saveUploadedFile(data: { file: Readable, filename: string }, targetPath: string): Promise<void> {
    await pump(data.file, fs.createWriteStream(targetPath));
  }

  async createTempFileCopy(originalFilePath: string, filename: string): Promise<string> {
    const tempFilename = `temp_${Date.now()}_${filename}`;
    const tempFilePath = path.join(this.uploadsDir, tempFilename);
    fs.copyFileSync(originalFilePath, tempFilePath);
    return tempFilePath;
  }

  deleteFile(filePath: string, callback: (err: NodeJS.ErrnoException | null) => void): void {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, callback);
    } else {
        callback(null);
    }
  }
  
  deleteFileSync(filePath: string): void {
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }
  }

  fileExists(filePath: string): boolean {
      return fs.existsSync(filePath);
  }

  async getImageBufferAndType(filePath: string): Promise<{ buffer: Buffer, contentType: string }> {
    const buffer = fs.readFileSync(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    return { buffer, contentType };
  }

  createZipStream(filenameInZip: string): { archive: archiver.Archiver, imageBuffer: Buffer } {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const imageBuffer = fs.readFileSync(filenameInZip); 
    return { archive, imageBuffer };
  }
}