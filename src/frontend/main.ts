const form = document.getElementById('upload-form') as HTMLFormElement;
const fileInput = document.getElementById('image-upload') as HTMLInputElement;
const resultsContainer = document.getElementById('results-container')!;
const metadataOutput = document.getElementById('metadata-output')!;

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
        displayMetadata(result.metadata);
        console.log('Metadaten-Anzeige wurde aufgerufen.'); 
    } catch (error) {
        console.error('FEHLER im fetch-Block:', error); 
        alert('Ein Fehler ist aufgetreten. Siehe Browser-Konsole für Details.');
    }
});

function displayMetadata(metadata: { title: string; description: string; keywords: string[] }) {
    metadataOutput.innerHTML = `
        <p><strong>Titel:</strong> ${metadata.title}</p>
        <p><strong>Beschreibung:</strong> ${metadata.description}</p>
        <p><strong>Schlagwörter:</strong> ${metadata.keywords.join(', ')}</p>
    `;
    resultsContainer.style.display = 'block';
}