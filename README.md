# Übersetzungsautomation im Digital Asset Managment: </br> NMT-Integration für IPTC-Metadaten.

## Projektbeschreibung

Dieses Projekt wurde im Rahmen des Universitätsmoduls „Praxisprojekt“ entwickelt. Ziel ist es, einen funktionsfähigen Prototyp einer Web-Anwendung bereitzustellen, der den Umgang mit IPTC-Daten in Bilddateien erleichtert und den Übersetzungsprozess unterstützt.

## Problemstellung

In vielen Workflows der Medien- und Bildbearbeitung werden IPTC-Metadaten (z. B. Titel, Beschreibung, Schlagwörter) genutzt.
Herausforderungen:

IPTC-Daten liegen häufig nur in einer Sprache vor. Eine manuelle Übersetzung ist zeitaufwendig. Fehlerhafte oder unvollständige Übersetzungen können zu Problemen bei Suchmaschinen, Archiven oder Bildagenturen führen.

## Projektidee

### Die Web-App soll folgende Funktionen bereitstellen:

- Extraktion von IPTC-Daten aus hochgeladenen Bilddateien

- Automatische Übersetzungsvorschläge für IPTC-Felder

- Review- und Editierfunktion für Nutzer:innen, um Vorschläge anzupassen

- Schreiben der finalen Übersetzung zurück in die Bilddatei

### Exportmöglichkeiten:

- als neue Bilddatei mit den übersetzten IPTC-Daten

- als ZIP-Archiv (z. B. mit mehreren Bildern)

- als JSON-Datei zur Weiterverarbeitung

## Ziel des Projekts

Am Ende soll ein fertiger Prototyp entstehen, der den gesamten Prozess – von der Datenextraktion bis zum Export – in einer benutzerfreundlichen Oberfläche abbildet.

## Tech-Stack (geplant/aktuell)

Frontend: Vite, React und TypeScript

Backend: Node.js, TypeScript und Fastify

Übersetzung: API-Anbindung (DeepLFree)

Metadaten-Verarbeitung: ExifTool 

Speicherung: lokales Dateisystem

ORM u. DB: Prisma und SQLite
