const form = document.getElementById('upload-form') as HTMLFormElement;
const fileInput = document.getElementById('image-upload') as HTMLInputElement;
const resultsContainer = document.getElementById('results-container')!;
const metadataOutput = document.getElementById('metadata-output')!;
let currentFilename = '';

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log('Formular abgeschickt. Starte Upload...'); 

    const files = fileInput.files;
    if (!files || files.length === 0) {
        alert('Bitte wähle eine Datei aus.');
        return;
    }

    const formData = new FormData();
    formData.append('file', files[0]);
    try {
        console.log('Sende fetch-Anfrage an /api/upload...'); 
        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData,
        });

        console.log('Antwort vom Server erhalten:', response); 
        if (!response.ok) {   
            const errorText = await response.text();
            throw new Error(`Serverfehler: ${response.status} - ${errorText}`);
        } 
        const result = await response.json();
        currentFilename = result.filename;
        displayMetadata(result.metadata);
        console.log('Metadaten-Anzeige wurde aufgerufen.'); 
    } catch (error) {
        console.error('FEHLER im fetch-Block:', error); 
        alert('Ein Fehler ist aufgetreten. Siehe Browser-Konsole für Details.');
    }
});

const translateButton = document.getElementById('translate-button')!;
translateButton.addEventListener('click', async () => {
  
  // 1. Original-Daten aus den Formularfeldern auslesen
  const originalTitle = (document.getElementById('original-title') as HTMLInputElement).value;
  const originalDescription = (document.getElementById('original-description') as HTMLTextAreaElement).value;
  const originalKeywords = (document.getElementById('original-keywords') as HTMLTextAreaElement).value;

  console.log('Sende zur Übersetzung:', { originalTitle, originalDescription, originalKeywords });

  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: originalTitle,
        description: originalDescription,
        keywords: originalKeywords,
      }),
    });

    if (!response.ok) {
      throw new Error('Fehler bei der Übersetzung.');
    }

    const translatedData = await response.json();
    console.log('Übersetzung erhalten:', translatedData);

    (document.getElementById('translated-title') as HTMLInputElement).value = translatedData.title;
    (document.getElementById('translated-description') as HTMLTextAreaElement).value = translatedData.description;
    (document.getElementById('translated-keywords') as HTMLTextAreaElement).value = translatedData.keywords;

  } catch (error) {
    console.error('Fehler beim Übersetzen:', error);
    alert('Die Übersetzung ist fehlgeschlagen. (Ist der DeepL API Key korrekt?)');
  }
});

const editForm = document.getElementById('edit-form') as HTMLFormElement;

editForm.addEventListener('submit', async (event) => {
    event.preventDefault(); 
    console.log('Export-Formular abgeschickt. Verhindere Neuladen.');
    const title = (document.getElementById('original-title') as HTMLInputElement).value;
    const description = (document.getElementById('original-description') as HTMLTextAreaElement).value;
    const keywordsString = (document.getElementById('original-keywords') as HTMLTextAreaElement).value;
    const keywords = keywordsString.split(',')       
                               .map(kw => kw.trim())   
                               .filter(kw => kw.length > 0); 
    if (!currentFilename) {
        alert('Fehler: Keinen Dateinamen gefunden. Bitte lade das Bild erneut hoch.');
        return;
    }
    const payload = {
        filename: currentFilename,
        metadata: {
            title: title,
            description: description,
            keywords: keywords 
        }
    };
    console.log('SENDE AN SERVER:', JSON.stringify(payload, null, 2));

    try {
        console.log('Sende Daten an /api/write-and-download...');
        const response = await fetch('http://localhost:3000/api/write-and-download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: currentFilename,
                metadata: {
                    title: title,
                    description: description,
                    keywords: keywords 
                }
            })
        });

        if (!response.ok) {
            throw new Error('Fehler beim Erstellen der Datei auf dem Server.');
        }

        console.log('Datei vom Server erhalten, starte Download...');
        const blob = await response.blob(); 
        const url = window.URL.createObjectURL(blob);   
        const a = document.createElement('a'); 
        a.style.display = 'none';
        a.href = url;
        a.download = `translated_${currentFilename}`; 
        document.body.appendChild(a);  
        a.click(); 

        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error('Fehler beim Exportieren:', error);
        alert('Export fehlgeschlagen. Siehe Konsole für Details.');
    }
});


function displayMetadata(metadata: { title: string; description: string; keywords: string[] }) {
    const originalTitle = document.getElementById('original-title') as HTMLInputElement;
    const originalDescription = document.getElementById('original-description') as HTMLTextAreaElement;
    const originalKeywords = document.getElementById('original-keywords') as HTMLTextAreaElement;
    
    originalTitle.value = metadata.title;
    originalDescription.value = metadata.description;
    originalKeywords.value = metadata.keywords.join(', ');

    resultsContainer.style.display = 'block';
}