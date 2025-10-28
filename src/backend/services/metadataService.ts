// src/backend/services/metadata.service.ts

import { FastifyBaseLogger } from 'fastify';
import { exiftool, Tags } from 'exiftool-vendored';

export class MetadataService {
  constructor(private logger: FastifyBaseLogger) {}

  async readMetadata(filePath: string): Promise<Tags> {
    return exiftool.read(filePath, {
      readArgs: ["-G1", "-a", "-u"],
    });
  }

  async writeMetadata(filePath: string, metadata: Record<string, string | string[]>): Promise<void> {
    const tagsToWrite: Record<string, any> = {};
    
    for (const key in metadata) {
      if (key === 'CaptionAbstract') tagsToWrite['Caption-Abstract'] = metadata[key];
      else tagsToWrite[key] = metadata[key];
    }
    
    tagsToWrite['Title'] = tagsToWrite['Title'] || tagsToWrite['ObjectName'] || '';
    tagsToWrite['ObjectName'] = tagsToWrite['Title'];
    tagsToWrite['Description'] = tagsToWrite['Description'] || tagsToWrite['Caption-Abstract'] || '';
    tagsToWrite['Caption-Abstract'] = tagsToWrite['Description'];
    tagsToWrite['Keywords'] = tagsToWrite['Keywords'] || [];
    tagsToWrite['ImageDescription'] = tagsToWrite['Description'];

    const writeArgs = [
      '-overwrite_original',
      '-Keywords=',
    ];

    this.logger.info({ msg: `Schreibe Metadaten in ${filePath}`, tags: tagsToWrite, args: writeArgs });
    await exiftool.write(filePath, tagsToWrite, { writeArgs: writeArgs });
  }
}