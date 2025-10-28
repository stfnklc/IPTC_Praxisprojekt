export class UiService {
    public readonly form: HTMLFormElement;
    public readonly fileInput: HTMLInputElement;
    public readonly resultsContainer: HTMLElement;
    public readonly tagSelectionFieldset: HTMLFieldSetElement;
    public readonly tagSelectionOptions: HTMLElement;
    public readonly selectAllButton: HTMLButtonElement;
    public readonly deselectAllButton: HTMLButtonElement;
    public readonly selectCommonButton: HTMLButtonElement;
    public readonly updateDisplayButton: HTMLButtonElement;
    public readonly originalFieldsContainer: HTMLElement;
    public readonly translatedFieldsContainer: HTMLElement;
    public readonly editForm: HTMLFormElement;
    public readonly translateButton: HTMLButtonElement;
    public readonly exportEditedButton: HTMLButtonElement;
    public readonly exportTranslatedButton: HTMLButtonElement;
    public readonly targetLanguageSelect: HTMLSelectElement;
    public readonly translationTargetLangLabel: HTMLElement;

    private readonly COMMON_TAGS: string[] = [
        'IPTC:ObjectName', 'File:FileName', 'XMP:Title',
        'IPTC:Caption-Abstract', 'XMP:Description', 'EXIF:ImageDescription',
        'IPTC:Keywords', 'XMP:Subject',
        'IPTC:Creator', 'XMP:Creator', 'EXIF:Artist',
        'IPTC:CopyrightNotice', 'XMP:Rights', 'EXIF:Copyright',
        'IPTC:City', 'IPTC:Province-State', 'IPTC:Country-PrimaryLocationName'
    ];
    
    constructor() {
        this.form = document.getElementById('upload-form') as HTMLFormElement;
        this.fileInput = document.getElementById('image-upload') as HTMLInputElement;
        this.resultsContainer = document.getElementById('results-container')!;
        this.tagSelectionFieldset = document.getElementById('tag-selection-fieldset') as HTMLFieldSetElement;
        this.tagSelectionOptions = document.getElementById('tag-selection-options')!;
        this.selectAllButton = document.getElementById('select-all-tags') as HTMLButtonElement;
        this.deselectAllButton = document.getElementById('deselect-all-tags') as HTMLButtonElement;
        this.selectCommonButton = document.getElementById('select-common-tags') as HTMLButtonElement;
        this.updateDisplayButton = document.getElementById('update-display-button') as HTMLButtonElement;
        this.originalFieldsContainer = document.getElementById('original-fields-container')!;
        this.translatedFieldsContainer = document.getElementById('translated-fields-container')!;
        this.editForm = document.getElementById('edit-form') as HTMLFormElement;
        this.translateButton = document.getElementById('translate-button') as HTMLButtonElement;
        this.exportEditedButton = document.getElementById('export-edited-button') as HTMLButtonElement;
        this.exportTranslatedButton = document.getElementById('export-translated-button') as HTMLButtonElement;
        this.targetLanguageSelect = document.getElementById('target-language') as HTMLSelectElement;
        this.translationTargetLangLabel = document.getElementById('translation-target-lang-label')!;
    }
    
    public showResultsContainer(show: boolean): void {
        this.resultsContainer.style.display = show ? 'block' : 'none';
    }

    public populateTagSelection(metadata: Record<string, any>): void {
        this.tagSelectionOptions.innerHTML = '';
        const tagKeys = Object.keys(metadata).sort();

        tagKeys.forEach(tagKey => {
            if (tagKey === 'SourceFile' || tagKey === 'ExifToolVersion' || tagKey === 'errors' || tagKey.startsWith('File:')) return;

            const value = metadata[tagKey];
            if (value === null || value === undefined || (typeof value !== 'object' && !value) || (Array.isArray(value) && value.length === 0) ) return;

            const div = document.createElement('div');
            div.classList.add('tag-option');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `select-${tagKey}`;
            checkbox.value = tagKey;
            checkbox.checked = this.COMMON_TAGS.includes(tagKey);

            const label = document.createElement('label');
            label.htmlFor = `select-${tagKey}`;
            label.textContent = tagKey;
            label.title = String(value);

            div.appendChild(checkbox);
            div.appendChild(label);
            this.tagSelectionOptions.appendChild(div);
        });
        this.tagSelectionFieldset.style.display = 'block';
    }

    public setAllCheckboxes(checked: boolean): void {
        this.tagSelectionOptions.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
            .forEach(cb => cb.checked = checked);
    }

    public selectCommonCheckboxes(): void {
        this.tagSelectionOptions.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
            .forEach(cb => cb.checked = this.COMMON_TAGS.includes(cb.value));
    }

    public displaySelectedMetadata(metadata: Record<string, any>): Set<string> {
        this.originalFieldsContainer.innerHTML = '';
        this.translatedFieldsContainer.innerHTML = '';
        const discoveredArrayTagKeys = new Set<string>();

        const selectedCheckboxes = this.tagSelectionOptions.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');

        selectedCheckboxes.forEach((checkbox) => {
            const tagKey = checkbox.value;
            let tagValue: any;

            try {
                tagValue = metadata[tagKey];
            } catch (err) {
                console.error(`FEHLER beim Zugriff auf metadata[${tagKey}]:`, err);
                return;
            }

            let displayValue = '';
            let elementType = 'input';
            let disableTranslationField = false;

            try {
                const isArray = Array.isArray(tagValue);
                const isObject = typeof tagValue === 'object' && tagValue !== null && !isArray;
                const isString = typeof tagValue === 'string';
                const isNumber = typeof tagValue === 'number';
                const isBoolean = typeof tagValue === 'boolean';

                if (isArray) {
                    discoveredArrayTagKeys.add(tagKey);
                    displayValue = tagValue.map((item: any) =>
                        (typeof item === 'object' && item !== null) ? JSON.stringify(item) : String(item ?? '')
                    ).join(', ');
                    elementType = 'textarea';
                } else if (isObject) {
                    if (tagValue.rawValue && typeof tagValue.rawValue === 'string') {
                        displayValue = tagValue.rawValue;
                    } else {
                        displayValue = JSON.stringify(tagValue, null, 2);
                    }
                    elementType = 'textarea';
                    disableTranslationField = true;
                } else if (isString) {
                    displayValue = tagValue;
                    if (tagValue.includes('\n') || tagValue.length > 60) {
                        elementType = 'textarea';
                    }
                } else if (isNumber || isBoolean) {
                    displayValue = String(tagValue);
                } else {
                    displayValue = tagValue?.toString() ?? '';
                }
            } catch (formatErr) {
                console.error(`FEHLER beim Formatieren von ${tagKey}:`, formatErr);
                if (formatErr instanceof Error) { displayValue = `[Formatierungsfehler: ${formatErr.message}]`; }
                else { displayValue = `[Unbekannter Formatierungsfehler]`; }
                elementType = 'textarea';
                disableTranslationField = true;
            }

            try {
                const ogGroup = document.createElement('div'); ogGroup.classList.add('form-group');
                const ogLabel = document.createElement('label'); ogLabel.htmlFor = `original-${tagKey}`; ogLabel.textContent = tagKey;
                const ogInput = document.createElement(elementType) as HTMLInputElement | HTMLTextAreaElement;
                ogInput.id = `original-${tagKey}`;
                ogInput.classList.add('original-field');
                ogInput.dataset.tagKey = tagKey;
                if (elementType === 'textarea') (ogInput as HTMLTextAreaElement).rows = 3;
                ogInput.value = displayValue;
                ogGroup.appendChild(ogLabel);
                ogGroup.appendChild(ogInput);
                this.originalFieldsContainer.appendChild(ogGroup);

                const trGroup = document.createElement('div'); trGroup.classList.add('form-group');
                const trLabel = document.createElement('label'); trLabel.htmlFor = `translated-${tagKey}`; trLabel.textContent = tagKey;
                const trInput = document.createElement(elementType) as HTMLInputElement | HTMLTextAreaElement;
                trInput.id = `translated-${tagKey}`;
                trInput.classList.add('translated-field');
                trInput.dataset.tagKey = tagKey;
                if (elementType === 'textarea') (trInput as HTMLTextAreaElement).rows = 3;
                trInput.value = '';
                if (disableTranslationField) {
                    trInput.disabled = true;
                    trInput.placeholder = "Kann nicht direkt übersetzt werden.";
                }
                trGroup.appendChild(trLabel);
                trGroup.appendChild(trInput);
                this.translatedFieldsContainer.appendChild(trGroup);

            } catch (domErr) { console.error(`FEHLER beim Erstellen der DOM-Elemente für ${tagKey}:`, domErr); }
        });

        this.updateLanguageLabel();
        return discoveredArrayTagKeys;
    }

    public getOriginalTagsToTranslate(): Record<string, string> {
        const tagsToTranslate: Record<string, string> = {};
        this.originalFieldsContainer.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.original-field')
            .forEach(input => {
                const tagKey = input.dataset.tagKey || input.id.replace('original-', '');
                if (!input.disabled && input.value && typeof input.value === 'string' && !input.value.startsWith('{') && !input.value.startsWith('[')) {
                    tagsToTranslate[tagKey] = input.value;
                }
            });
        return tagsToTranslate;
    }

    public getTargetLanguage(): { value: string, text: string } {
        const selectedOption = this.targetLanguageSelect.selectedOptions[0];
        return {
            value: this.targetLanguageSelect.value,
            text: selectedOption?.text || this.targetLanguageSelect.value
        };
    }

    public setTranslateButtonState(loading: boolean, langText: string): void {
        this.translateButton.disabled = loading;
        this.translateButton.textContent = loading ? `Übersetze nach ${langText}...` : 'Ausgewählte übersetzen';
    }

    public updateTranslationFields(translatedTags: Record<string, string>): void {
        for (const tagKey in translatedTags) {
            const translatedInput = this.translatedFieldsContainer.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#translated-${CSS.escape(tagKey)}`);
            if (translatedInput) {
                translatedInput.value = translatedTags[tagKey];
                translatedInput.disabled = false;
            } else {
                console.warn(`Übersetzungsfeld für ${tagKey} nicht gefunden.`);
            }
        }
    }
    
    public getExportData(exportType: 'edited' | 'translated', arrayTagKeys: Set<string>): { 
        metadataToWrite: Record<string, string | string[]>, 
        selectedFormat: string 
    } {
        const sourceContainer = exportType === 'edited' ? this.originalFieldsContainer : this.translatedFieldsContainer;
        const sourceFields = sourceContainer.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=checkbox]), textarea');

        const metadataToWrite: Record<string, string | string[]> = {};
        sourceFields.forEach(input => {
            const tagKeyWithPrefix = input.dataset.tagKey;
            if (!tagKeyWithPrefix || input.disabled) return;

            const tagKeyForWrite = tagKeyWithPrefix.includes(':') ? tagKeyWithPrefix.substring(tagKeyWithPrefix.indexOf(':') + 1) : tagKeyWithPrefix;

            let valueToWrite: string | string[] = input.value;
            if (arrayTagKeys.has(tagKeyWithPrefix)) {
                valueToWrite = input.value.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);
            }

            if (valueToWrite || (Array.isArray(valueToWrite) && valueToWrite.length >= 0)) {
                metadataToWrite[tagKeyForWrite] = valueToWrite;
            }
        });
        
        const selectedFormat = (document.querySelector('input[name="export-format"]:checked') as HTMLInputElement)?.value || 'image';
        
        return { metadataToWrite, selectedFormat };
    }
    
    public triggerDownload(blob: Blob, downloadFilename: string): void {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none'; 
        a.href = url; 
        a.download = downloadFilename;
        document.body.appendChild(a); 
        a.click(); 
        window.URL.revokeObjectURL(url); 
        a.remove();
    }
    
    public populateLanguages(languages: { language: string, name: string }[]): void {
        this.targetLanguageSelect.innerHTML = '';
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.language; 
            option.textContent = lang.name;
            this.targetLanguageSelect.appendChild(option);
        });

        const defaultLang = 'DE';
        if (languages.some(lang => lang.language === defaultLang)) {
            this.targetLanguageSelect.value = defaultLang; 
        }
        this.updateLanguageLabel();
    }

    public setLanguageErrorState(): void {
        this.targetLanguageSelect.innerHTML = '<option value="">Fehler</option>';
    }

    public updateLanguageLabel(): void {
        this.translationTargetLangLabel.textContent = this.targetLanguageSelect.selectedOptions[0]?.text || this.targetLanguageSelect.value;
    }

    public showAlert(message: string): void {
        alert(message);
    }
}