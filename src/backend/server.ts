import Fastify from 'fastify';
import path from 'path';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream';


const pump = util.promisify(pipeline);
const fastify = Fastify({ logger: true }); // Logger gibt nützliche Infos im Terminal aus
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS-Plugin für Frontend Anfragen 
fastify.register(cors, { origin: '*' });

// Multipart-Plugin für Datei-Uploads
fastify.register(multipart);

// Static-Plugin um HTML/CSS/JS-Dateien auszuliefern
fastify.register(staticFiles, {
  root: path.join(__dirname, '..', '..', 'public'),
  prefix: '/',
});

fastify.register(staticFiles, {
  root: path.join(__dirname, '..', 'frontend'), 
  prefix: '/frontend/',
  decorateReply: false
});

fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

fastify.post('/api/upload', async (request, reply) => {
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ error: 'Keine Datei hochgeladen.' });
  }
  const targetPath = path.join(uploadsDir, data.filename);
  try {
    await pump(data.file, fs.createWriteStream(targetPath));
    fastify.log.info(`Datei erfolgreich gespeichert unter: ${targetPath}`);
    // TODO:EXIFTOOL-LOGIK

    //Platzhalter-Antwort für Tests
    return {
      filename: data.filename,
      metadata: {
        title: 'Beispieltitel aus dem Backend',
        description: 'Dies ist eine Beispielbeschreibung.',
        keywords: ['Test', 'Beispiel', 'Metadaten'],
      },
    };
  } catch (err) {
    fastify.log.error(err, 'Fehler beim Speichern der Datei:');
    return reply.status(500).send({ error: 'Fehler beim Verarbeiten der Datei auf dem Server.' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info(`Server lauscht auf http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();