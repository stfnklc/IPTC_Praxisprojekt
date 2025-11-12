import { StateService } from "./stateService";
import { ApiService } from "./apiService";
import { UiService } from "./uiService";

const IPTC_TEMPLATE_FIELDS: string[] = [
    'IPTC:ObjectName', 'IPTC:Caption-Abstract', 'IPTC:Keywords',
    'IPTC:Creator', 'IPTC:CopyrightNotice', 'IPTC:Credit',
    'IPTC:City', 'IPTC:Province-State', 'IPTC:Country-PrimaryLocationName'
];
const TEMPLATE_ARRAY_KEYS: Set<string> = new Set(['IPTC:Keywords']);


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
        
        this.ui.addTemplateButton.addEventListener('click', this.handleLoadTemplate.bind(this));
        
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
        if (this.ui.appTitle) {
            this.ui.appTitle.addEventListener('click', this.handleGoToUpload.bind(this));
        }
        if (this.ui.backToUploadButton) {
            this.ui.backToUploadButton.addEventListener('click', this.handleGoToUpload.bind(this));
        }
    }

    private handleGoToUpload(): void {
        this.ui.resetToUploadView();
        this.state.setUploadResult('', {}); 
        this.state.resetArrayTagKeys();
    }

    private async uploadFile(): Promise<boolean> {
        const files = this.ui.fileInput.files;
        if (!files || files.length === 0) {
            this.ui.showAlert('Bitte wähle eine Datei aus.');
            return false;
        }

        const formData = new FormData(this.ui.form);
        
        try {
            const result = await this.api.uploadImage(formData);
            this.state.setUploadResult(result.filename, result.metadata);
            return true; 
        } catch (error) {
            console.error('Upload Fehler:', error);
            const message = (error instanceof Error) ? error.message : String(error);
            this.ui.showAlert(`Fehler beim Hochladen der Datei: ${message}`);
            return false; 
        }
    }

    private async handleLoadTemplate(): Promise<void> {
        const files = this.ui.fileInput.files;
        if (!files || files.length === 0) {
            this.ui.showAlert("Bitte wähle zuerst ein Bild aus, auf das die Vorlage angewendet werden soll.");
            return; 
        }
        
        const selectedFilename = files[0].name;
        let isUploaded = (this.state.getFilename() === selectedFilename);
        if (!isUploaded) {
            const uploadSuccess = await this.uploadFile();
            if (!uploadSuccess) {

                return;
            }
        }

        this.state.setArrayTagKeys(TEMPLATE_ARRAY_KEYS);
        this.ui.displayBlankTemplate(IPTC_TEMPLATE_FIELDS, TEMPLATE_ARRAY_KEYS);
        this.ui.showResultsContainer(true);

        const accordion = document.getElementById('tag-selection-accordion') as HTMLDetailsElement;
        if (accordion) {
             accordion.open = false;
             const summary = accordion.querySelector('summary') as HTMLElement;
             if (summary) summary.style.display = 'none';
        }
    }

    private updateDisplayedFields(): void {
        const discoveredArrayKeys = this.ui.displaySelectedMetadata(this.state.getMetadata());
        this.state.setArrayTagKeys(discoveredArrayKeys);
    }

    private async handleUploadSubmit(event: Event): Promise<void> {
        event.preventDefault();

        const uploadSuccess = await this.uploadFile();

        if (uploadSuccess) {
            const accordion = document.getElementById('tag-selection-accordion') as HTMLDetailsElement;
            if (accordion) {
                accordion.open = true;
                const summary = accordion.querySelector('summary') as HTMLElement;
                if (summary) summary.style.display = 'block';
            }
            
            this.ui.populateTagSelection(this.state.getMetadata());
            this.updateDisplayedFields();
            this.ui.showResultsContainer(true);
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