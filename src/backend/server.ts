import Fastify from 'fastify';
import path from 'path';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream';
import 'dotenv/config';
import mime from 'mime-types';
import { exiftool } from "exiftool-vendored";


const pump = util.promisify(pipeline);
const fastify = Fastify({ logger: true });
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

fastify.register(cors, { origin: '*' });
fastify.register(multipart);
fastify.register(staticFiles, { root: path.join(__dirname, '..', '..', 'public'), prefix: '/' });
fastify.register(staticFiles, { root: path.join(__dirname, '..', 'frontend'), prefix: '/frontend/', decorateReply: false });

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
    
    const tags = await exiftool.read(targetPath);

    const iptcData = {
      title: tags.Title || tags.ObjectName || tags.Headline || '',
      description: tags['Caption-Abstract'] || tags.Description || '',
      keywords: tags.Keywords || [], 
      copyright: tags.Copyright || tags.Credit || ''
    };
    
    fastify.log.info({ msg: 'Metadaten erfolgreich ausgelesen', data: iptcData });
    return {
      filename: data.filename,
      metadata: iptcData,
    };
  } catch (err) {
    fastify.log.error(err, 'Fehler beim Auslesen oder Speichern der Datei');
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }
    return reply.status(500).send({ error: 'Fehler beim Verarbeiten der Datei auf dem Server.' });
  }
});

fastify.post('/api/write-and-download', async (request, reply) => {
  let newFilePath = '';
  try {
    const { filename, metadata } = request.body as {
      filename: string;
      metadata: { title: string; description: string; keywords: string[] };
    };

    if (!filename || !metadata) { return reply.status(400).send({ error: 'Fehlende Daten.' }); }

    const originalFilePath = path.join(uploadsDir, filename);
    const newFilename = `translated_${filename}`;
    newFilePath = path.join(uploadsDir, newFilename); 

    if (!fs.existsSync(originalFilePath)) { }

    fs.copyFileSync(originalFilePath, newFilePath);
    fastify.log.info(`Datei kopiert nach: ${newFilePath}`);
    
    const tagsToWrite = {
      'Title': metadata.title,               
      'ObjectName': metadata.title,          
      'Description': metadata.description,   
      'IPTC:Caption-Abstract': metadata.description, 
      'IPTC:Keywords': metadata.keywords, 
      'EXIF:ImageDescription': metadata.description, 
    };

    fastify.log.info({ msg: "SIMPLE OVERWRITE: Sende an ExifTool", file: newFilePath, tags: tagsToWrite });
    await exiftool.write(newFilePath, tagsToWrite);
    
    fastify.log.info(`Metadaten erfolgreich in ${newFilePath} geschrieben.`);
    const finalStats = fs.statSync(newFilePath);
    fastify.log.info({ msg: "SIMPLE OVERWRITE: Finale Größe", finalSize: finalStats.size });

    const fileBuffer = fs.readFileSync(newFilePath);
    reply.header('Content-Disposition', `attachment; filename="${newFilename}"`);
    reply.header('Content-Type', 'image/jpeg');
    return reply.send(fileBuffer);
  
  } catch (err) {
    fastify.log.error(err, 'FEHLER in /api/write-and-download');
    if (newFilePath && fs.existsSync(newFilePath)) { fs.unlinkSync(newFilePath); }
    if (err instanceof Error) { return reply.status(500).send({ error: `Serverfehler: ${err.message}` }); }
    return reply.status(500).send({ error: 'Unbekannter Fehler.' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info(`Server lauscht auf http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err, 'Fehler beim Serverstart');
    process.exit(1);
  }
};

const closeExifTool = () => {
  fastify.log.info('Fahre ExifTool-Prozess herunter...')
  exiftool.end();
};

process.on('SIGTERM', closeExifTool);
process.on('SIGINT', closeExifTool);

start();