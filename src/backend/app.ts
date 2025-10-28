import Fastify, { FastifyInstance } from 'fastify';
import path from 'path';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'fs';
import 'dotenv/config';

import apiRoutes from './routes/apiRoutes';
import { FileService } from './services/fileService';
import { MetadataService } from './services/metadataService';
import { TranslationService } from './services/translationService';

const fastify: FastifyInstance = Fastify({ logger: true });

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileService = new FileService(fastify.log, uploadsDir);
const metadataService = new MetadataService(fastify.log);
const translationService = new TranslationService(
  fastify.log,
  process.env.DEEPL_API_KEY,
  process.env.DEEPL_API_URL || 'https://api-free.deepl.com'
);

fastify.decorate('fileService', fileService);
fastify.decorate('metadataService', metadataService);
fastify.decorate('translationService', translationService);

fastify.register(cors, { origin: '*' });
fastify.register(multipart);
fastify.register(staticFiles, { root: path.join(__dirname, '..', '..', 'public'), prefix: '/' });
fastify.register(staticFiles, { root: path.join(__dirname, '..', 'frontend'), prefix: '/frontend/', decorateReply: false });

fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

fastify.register(apiRoutes, { prefix: '/api' });

export { fastify as app };