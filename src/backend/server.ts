import { app } from './app';
import { exiftool } from 'exiftool-vendored';

const start = async () => {
  try {
    await app.listen({ port: 3000 });
    app.log.info(`Server lauscht auf http://localhost:3000`);
  } catch (err) {
    app.log.error(err, 'Fehler beim Serverstart');
    process.exit(1);
  }
};

const closeExifTool = () => {
  app.log.info('Fahre ExifTool-Prozess herunter...');
  exiftool.end();
};

process.on('SIGTERM', closeExifTool);
process.on('SIGINT', closeExifTool);

start();