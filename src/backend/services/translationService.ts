import { FastifyBaseLogger } from 'fastify';

export class TranslationService {
  constructor(
    private logger: FastifyBaseLogger,
    private apiKey?: string,
    private apiUrl?: string
  ) {}

  async translateTags(
    tagsToTranslate: Record<string, string>,
    arrayKeys: string[],
    targetLang: string
  ): Promise<Record<string, string>> {
    
    if (!this.apiKey) {
      this.logger.error('DeepL API Key nicht gefunden.');
      throw new Error('Server-Konfigurationsfehler (API Key).');
    }
    if (!tagsToTranslate || Object.keys(tagsToTranslate).length === 0) {
      this.logger.warn('Keine Tags zum Übersetzen empfangen.');
      return {};
    }
    if (!targetLang) {
      throw new Error('Keine Zielsprache (targetLang) angegeben.');
    }

    const arrayKeySet = new Set(arrayKeys || []);
    const originalKeysAndIndices: { key: string, isElement: boolean, originalIndex?: number }[] = [];
    const textsToTranslate: string[] = [];

    for (const key in tagsToTranslate) {
      const text = tagsToTranslate[key];
      if (text && typeof text === 'string') {
        if (arrayKeySet.has(key)) {
          const elements = text.split(',').map(el => el.trim()).filter(el => el.length > 0);
          if (elements.length > 0) {
            elements.forEach((element, index) => {
              textsToTranslate.push(element);
              originalKeysAndIndices.push({ key: key, isElement: true, originalIndex: index });
            });
          } else {
            originalKeysAndIndices.push({ key: key, isElement: false });
          }
        } else {
          textsToTranslate.push(text);
          originalKeysAndIndices.push({ key: key, isElement: false });
        }
      } else {
        originalKeysAndIndices.push({ key: key, isElement: false });
      }
    }

    if (textsToTranslate.length === 0) {
      this.logger.warn("Keine gültigen Texte zum Senden an DeepL gefunden.");
      return {};
    }

    this.logger.info(`Sende ${textsToTranslate.length} Text-Element(e) an DeepL zur Übersetzung nach ${targetLang}...`);

    const response = await fetch(`${this.apiUrl}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: textsToTranslate,
        target_lang: targetLang
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error({ msg: 'DeepL API Fehler', status: response.status, body: errorBody });
      throw new Error(`DeepL API Fehler: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    const translations = result.translations as { text: string }[];

    if (!translations || translations.length !== textsToTranslate.length) {
      this.logger.error({msg: 'Unerwartete Antwortstruktur von DeepL', expected: textsToTranslate.length, received: translations?.length, data: result});
      throw new Error('Anzahl der Übersetzungen stimmt nicht mit gesendeten Texten überein.');
    }

    const translatedTags: Record<string, string> = {};
    const tempArrayStorage: Record<string, string[]> = {};
    let translationIndex = 0;

    for (const mappingInfo of originalKeysAndIndices) {
      const key = mappingInfo.key;

      if (mappingInfo.isElement) {
        if (!tempArrayStorage[key]) { tempArrayStorage[key] = []; }
        if (translations[translationIndex]) {
          const translatedText = translations[translationIndex].text;
          if (mappingInfo.originalIndex !== undefined) {
            tempArrayStorage[key][mappingInfo.originalIndex] = translatedText;
          } else {
            tempArrayStorage[key].push(translatedText);
          }
        } else { this.logger.warn(`Fehlende Übersetzung für Index ${translationIndex}, Key ${key}`); }
        translationIndex++;
      } else if (tagsToTranslate[key] && typeof tagsToTranslate[key] === 'string' && !arrayKeySet.has(key)) {
        if (translations[translationIndex]) {
          translatedTags[key] = translations[translationIndex].text;
        } else { this.logger.warn(`Fehlende Übersetzung für Index ${translationIndex}, Key ${key}`); }
        translationIndex++;
      } else {
        translatedTags[key] = tagsToTranslate[key] || '';
      }
    }

    for (const key in tempArrayStorage) {
      translatedTags[key] = tempArrayStorage[key].filter(el => el !== undefined && el !== null).join(', ');
    }
    
    this.logger.info({ msg: "DEBUG: Finales translatedTags Objekt VOR dem Senden", data: translatedTags });

     if (Object.keys(translatedTags).length === 0 && textsToTranslate.length > 0) {
       this.logger.warn("WARNUNG: Übersetzungs-Ergebnisobjekt ist leer!");
     }
     
    return translatedTags;
  }

  async getLanguages(): Promise<any[]> {
    if (!this.apiKey) {
      this.logger.error('DeepL API Key nicht gefunden für Sprachenabruf.');
      throw new Error('Server-Konfigurationsfehler (API Key).');
    }
    
    const response = await fetch(`${this.apiUrl}/v2/languages?type=target`, {
      method: 'GET',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error({ msg: 'DeepL API /languages Fehler', status: response.status, body: errorBody });
      throw new Error(`DeepL API Fehler (${response.status}): ${errorBody}`);
    }

    const languages = await response.json();
    languages.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
    
    return languages;
  }
}