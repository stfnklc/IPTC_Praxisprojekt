import { StateService } from "./stateService";
import { ApiService } from "./apiService";
import { UiService } from "./uiService";

class App {
    private state: StateService;
    private api: ApiService;
    private ui: UiService;

    constructor() {
        this.state = new StateService();
        this.api = new ApiService();
        this.ui = new UiService();
    }

    public init(): void {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadLanguages();
            this.setupEventListeners();
        });
    }

    private async loadLanguages(): Promise<void> {
        try {
            const languages = await this.api.getLanguages();
            this.ui.populateLanguages(languages);
        } catch (error) {
            console.error("Fehler beim Laden der Sprachenliste:", error);
            this.ui.setLanguageErrorState();
        }
    }

    private setupEventListeners(): void {
        this.ui.form.addEventListener('submit', this.handleUploadSubmit.bind(this));
        
        this.ui.selectAllButton.addEventListener('click', () => {
            this.ui.setAllCheckboxes(true);
            this.updateDisplayedFields();
        });
        
        this.ui.deselectAllButton.addEventListener('click', () => {
            this.ui.setAllCheckboxes(false);
            this.updateDisplayedFields();
        });
        
        this.ui.selectCommonButton.addEventListener('click', () => {
            this.ui.selectCommonCheckboxes();
            this.updateDisplayedFields();
        });
        
        this.ui.updateDisplayButton.addEventListener('click', this.updateDisplayedFields.bind(this));
        
        this.ui.translateButton.addEventListener('click', this.handleTranslate.bind(this));
        
        this.ui.exportEditedButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleExport('edited');
        });
        
        this.ui.exportTranslatedButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleExport('translated');
        });

        this.ui.targetLanguageSelect.addEventListener('change', () => {
            this.ui.updateLanguageLabel();
        });
    }

    private updateDisplayedFields(): void {
        const discoveredArrayKeys = this.ui.displaySelectedMetadata(this.state.getMetadata());
        this.state.setArrayTagKeys(discoveredArrayKeys);
    }

    private async handleUploadSubmit(event: Event): Promise<void> {
        event.preventDefault();
        
        const files = this.ui.fileInput.files;
        if (!files || files.length === 0) {
            this.ui.showAlert('Bitte wähle eine Datei aus.');
            return;
        }

        const formData = new FormData(this.ui.form);
        
        try {
            const result = await this.api.uploadImage(formData);
            this.state.setUploadResult(result.filename, result.metadata);
            
            this.ui.populateTagSelection(this.state.getMetadata());
            this.updateDisplayedFields();
            this.ui.showResultsContainer(true);

        } catch (error) {
            console.error('Upload Fehler:', error);
            const message = (error instanceof Error) ? error.message : String(error);
            this.ui.showAlert(`Fehler beim Auslesen der Metadaten: ${message}`);
        }
    }

    private async handleTranslate(): Promise<void> {
        const tagsToTranslate = this.ui.getOriginalTagsToTranslate();
        if (Object.keys(tagsToTranslate).length === 0) {
            this.ui.showAlert("Keine übersetzbaren Textfelder ausgewählt oder gefüllt.");
            return;
        }

        const targetLang = this.ui.getTargetLanguage();
        this.ui.setTranslateButtonState(true, targetLang.text);

        try {
            const translatedTags = await this.api.translateTags(
                tagsToTranslate,
                Array.from(this.state.getArrayTagKeys()),
                targetLang.value
            );
            
            this.ui.updateTranslationFields(translatedTags);
            this.ui.showAlert('Übersetzung abgeschlossen!');

        } catch (error) {
            console.error('Übersetzungsfehler:', error);
            const message = (error instanceof Error) ? error.message : 'Unbekannter Fehler.';
            this.ui.showAlert(`Übersetzung fehlgeschlagen: ${message}\n(API Key korrekt? Genug Kontingent?)`);
        } finally {
            this.ui.setTranslateButtonState(false, targetLang.text);
        }
    }

    private async handleExport(exportType: 'edited' | 'translated'): Promise<void> {
        const { metadataToWrite, selectedFormat } = this.ui.getExportData(
            exportType, 
            this.state.getArrayTagKeys()
        );

        if (Object.keys(metadataToWrite).length === 0) {
            this.ui.showAlert(`Keine ${exportType === 'edited' ? 'bearbeiteten Original-' : 'übersetzten '}Daten zum Speichern vorhanden.`);
            return;
        }

        const currentFilename = this.state.getFilename();
        if (!currentFilename) {
            this.ui.showAlert('Kein Dateiname.');
            return;
        }

        try {
            const { blob, downloadFilename } = await this.api.writeAndDownload(
                currentFilename,
                metadataToWrite,
                selectedFormat
            );
            
            this.ui.triggerDownload(blob, downloadFilename);
            this.ui.showAlert('Export erfolgreich!');

        } catch (error) {
            console.error('Exportfehler:', error);
            const message = (error instanceof Error) ? error.message : 'Unbekannter Fehler.';
            this.ui.showAlert(`Export fehlgeschlagen: ${message}`);
        }
    }
}

const app = new App();
app.init();