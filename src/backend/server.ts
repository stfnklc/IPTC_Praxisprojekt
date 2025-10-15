import Fastify from 'fastify';
import path from 'path';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'fs';
import util from 'util';
import { pipeline } from 'stream';
import ExifReader from 'exifreader';
import 'dotenv/config';


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
    const tags = await ExifReader.load(targetPath);

    let keywords: string[] = [];
    if (tags.Keywords && Array.isArray(tags.Keywords)) {
        keywords = tags.Keywords.map(tag => tag.description);
    } 
    else if (tags.XPKeywords && tags.XPKeywords.description) {
        keywords = tags.XPKeywords.description.split(';').map(kw => kw.trim());
    }

    const iptcData = {
      title: tags.Headline?.description 
             || tags.XPTitle?.description 
             || tags['Object Name']?.description 
             || '',

      description: tags['Caption/Abstract']?.description 
                   || tags.ImageDescription?.description 
                   || tags.XPSubject?.description 
                   || '',
      
      keywords: keywords,
      
      copyright: tags.Copyright?.description || tags.creditLine?.description || ''
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