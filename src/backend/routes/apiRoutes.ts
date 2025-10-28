import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import fs from 'fs'; 

const apiRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.post('/upload', async (request, reply) => {
    let targetPath: string | undefined;
    try {
      const data = await request.file();
      if (!data) { return reply.status(400).send({ error: 'Keine Datei hochgeladen.' }); }

      targetPath = fastify.fileService.getFilePath(data.filename);
      await fastify.fileService.saveUploadedFile(data, targetPath);
      fastify.log.info(`Datei erfolgreich gespeichert unter: ${targetPath}`);

      const allGroupedTags = await fastify.metadataService.readMetadata(targetPath);
      fastify.log.info({ msg: 'Alle Metadaten mit Gruppen ausgelesen', count: Object.keys(allGroupedTags).length });

      return {
        filename: data.filename,
        metadata: allGroupedTags,
      };
    } catch (err) {
      fastify.log.error(err, 'Fehler beim Auslesen oder Speichern der Datei');
      if (targetPath && fs.existsSync(targetPath)) {
        fastify.fileService.deleteFileSync(targetPath);
      }
      return reply.status(500).send({ error: 'Fehler beim Verarbeiten der Datei auf dem Server.' });
    }
  });

  fastify.post('/write-and-download', async (request, reply) => {
    let tempFilePath = '';
    try {
      const { filename, metadata, format = 'image' } = request.body as {
        filename: string;
        metadata: Record<string, string | string[]>;
        format?: 'image' | 'json' | 'zip';
      };

      if (!filename || !metadata) { return reply.status(400).send({ error: 'Fehlende Daten.' }); }

      const originalFilePath = fastify.fileService.getFilePath(filename);

      if (!fs.existsSync(originalFilePath)) {
        fastify.log.error(`Originaldatei nicht gefunden: ${originalFilePath}`);
        return reply.status(404).send({ error: 'Originaldatei nicht mehr auf dem Server gefunden.' });
      }

      if (format === 'json') {
        const jsonFilename = `metadata_${path.parse(filename).name}.json`;
        reply.header('Content-Disposition', `attachment; filename="${jsonFilename}"`);
        reply.header('Content-Type', 'application/json');
        return reply.send(JSON.stringify(metadata, null, 2));
      }

      tempFilePath = await fastify.fileService.createTempFileCopy(originalFilePath, filename);
      fastify.log.info(`Datei kopiert nach: ${tempFilePath}`);

      await fastify.metadataService.writeMetadata(tempFilePath, metadata);
      
      fastify.log.info(`Metadaten erfolgreich in temporäre Datei ${tempFilePath} geschrieben.`);
      const finalStats = fs.statSync(tempFilePath);
      fastify.log.info({ msg: `Temporäre Datei Größe nach Schreiben`, finalSize: finalStats.size });

      if (format === 'image') {
        const imageFilename = `exported_${filename}`;
        const { buffer, contentType } = await fastify.fileService.getImageBufferAndType(tempFilePath);
        
        reply.header('Content-Disposition', `attachment; filename="${imageFilename}"`);
        reply.header('Content-Type', contentType);

        reply.raw.on('finish', () => {
          fastify.fileService.deleteFile(tempFilePath, (err) => {
            if (err) fastify.log.error(err, `Fehler beim Löschen der Temp-Datei ${tempFilePath} nach Senden`);
            else fastify.log.info(`Temp-Datei ${tempFilePath} nach Senden gelöscht.`);
          });
        });

        return reply.send(buffer);
      }

      if (format === 'zip') {
        const zipFilename = `exported_${path.parse(filename).name}.zip`;
        const imageFilenameInZip = `exported_${filename}`;
        
        reply.header('Content-Disposition', `attachment; filename="${zipFilename}"`);
        reply.header('Content-Type', 'application/zip');

        const { archive, imageBuffer } = fastify.fileService.createZipStream(tempFilePath);

        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            fastify.log.warn(err, "Archiver warning (ENOENT likely ignorable)");
          } else {
            fastify.log.error(err, "Archiver warning");
          }
        });
        archive.on('error', (err) => {
          fastify.log.error(err, "Archiver critical error");
          if (!reply.raw.writableEnded) {
            reply.code(500).send({ error: 'Fehler beim Erstellen des ZIP-Archivs.' });
          }
          if (fs.existsSync(tempFilePath)) {
             try { fastify.fileService.deleteFileSync(tempFilePath); } catch (e) { console.error("Error deleting temp file on ZIP error:", e); }
          }
        });
        reply.send(archive);

        try {
            archive.append(imageBuffer, { name: imageFilenameInZip });
        } catch (readErr) {
          fastify.log.error(readErr, "Error reading temp file for ZIP");
          archive.abort();
          if (!reply.raw.writableEnded) {
            reply.code(500).send({ error: 'Fehler beim Lesen der Bilddatei für ZIP.' });
          }
          if (fs.existsSync(tempFilePath)) { fastify.fileService.deleteFileSync(tempFilePath); }
          return;
        }

        archive.finalize().then(() => {
          fastify.log.info(`ZIP stream finalized. Temp file ${tempFilePath} should be processed.`);
        });

        reply.raw.on('finish', () => {
           fastify.log.info(`ZIP response stream finished. Cleaning up ${tempFilePath}...`);
            if (fs.existsSync(tempFilePath)) {
              fastify.fileService.deleteFile(tempFilePath, (err) => {
                if (err) fastify.log.error(err, `Fehler beim Löschen der Temp-Datei ${tempFilePath} nach ZIP`);
                else fastify.log.info(`Temp-Datei ${tempFilePath} nach ZIP gelöscht.`);
              });
           }
        });

        return reply;
      }

      return reply.status(400).send({ error: 'Unbekanntes Exportformat.' });

    } catch (err) {
      fastify.log.error(err, 'FEHLER in /api/write-and-download');
      if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fastify.fileService.deleteFileSync(tempFilePath); } catch (e) { console.error("Error deleting temp file on failure:", e); }
      }
      if (err instanceof Error) { return reply.status(500).send({ error: `Serverfehler: ${err.message}` }); }
      return reply.status(500).send({ error: 'Ein unbekannter schwerwiegender Fehler ist auf dem Server aufgetreten.' });
    }
  });

  fastify.post('/translate', async (request, reply) => {
    try {
      const { tagsToTranslate, arrayKeys, targetLang } = request.body as {
        tagsToTranslate: Record<string, string>,
        arrayKeys: string[],
        targetLang: string
      };

      const translatedTags = await fastify.translationService.translateTags(tagsToTranslate, arrayKeys, targetLang);
      fastify.log.info(`Übersetzung erfolgreich. Sende ${Object.keys(translatedTags).length} übersetzte Tag(s) zurück.`);
      return translatedTags;

    } catch (err) {
      fastify.log.error(err, 'Fehler bei der Übersetzung');
      const errorMessage = (err instanceof Error) ? err.message : 'Unbekannter Fehler.';
      return reply.status(500).send({ error: `Fehler bei der Kommunikation mit dem Übersetzungsdienst: ${errorMessage}` });
    }
  });

  fastify.get('/languages', async (request, reply) => {
    try {
      fastify.log.info('Rufe DeepL /languages Endpunkt ab...');
      const languages = await fastify.translationService.getLanguages();
      fastify.log.info(`Erfolgreich ${languages.length} Zielsprachen von DeepL erhalten.`);
      return languages;
    } catch (err) {
      fastify.log.error(err, 'Fehler beim Abrufen der DeepL Sprachenliste');
      return reply.status(500).send([]);
    }
  });
};

export default apiRoutes;