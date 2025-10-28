import { FileService } from './services/fileService';
import { MetadataService } from './services/metadataService';
import { TranslationService } from './services/translationService';

declare module 'fastify' {
  export interface FastifyInstance {
    fileService: FileService;
    metadataService: MetadataService;
    translationService: TranslationService;
  }
}