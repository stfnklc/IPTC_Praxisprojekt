export class ApiService {

    private pathParse(filePath: string): { name: string, ext: string, base: string } {
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot === -1) {
            return { name: filePath, ext: '', base: filePath };
        }
        const extension = filePath.substring(lastDot);
        const name = filePath.substring(0, lastDot);
        return { name, ext: extension, base: filePath };
    }

    private async handleFetchError(response: Response): Promise<Error> {
        let errorMsg = `Serverfehler (${response.status})`;
        let responseText = '';
        try {
            responseText = await response.text();
            const errData = JSON.parse(responseText);
            errorMsg += `: ${errData.error || errData.message}`;
        } catch (e) {
            if (responseText.trim()) {
                 errorMsg += `: ${responseText.substring(0, 100)}...`;
            }
        }
        return new Error(errorMsg);
    }

    async uploadImage(formData: FormData): Promise<{ filename: string, metadata: Record<string, any> }> {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        
        if (!response.ok) {
            throw await this.handleFetchError(response);
        }
        
        return response.json();
    }

    async getLanguages(): Promise<{ language: string, name: string }[]> {
        const response = await fetch('/api/languages');
        if (!response.ok) {
            throw new Error(`Sprachliste Ladefehler (${response.status})`);
        }
        const languages = await response.json();
        if (!languages || languages.length === 0) {
            throw new Error("Keine Sprachen empfangen.");
        }
        return languages;
    }

    async translateTags(
        tagsToTranslate: Record<string, string>, 
        arrayKeys: string[], 
        targetLang: string
    ): Promise<Record<string, string>> {
        
        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tagsToTranslate: tagsToTranslate,
                arrayKeys: arrayKeys,
                targetLang: targetLang
            }),
        };

        const response = await fetch('/api/translate', fetchOptions);
        const responseText = await response.text();

        if (!response.ok) {
            let errorMsg = `Serverfehler (${response.status})`;
            try {
                const errorData = JSON.parse(responseText);
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (parseError) {
                if (responseText.trim()) { errorMsg += `: ${responseText.substring(0, 100)}...`; }
            }
            throw new Error(errorMsg);
        }

        if (!responseText || responseText.trim() === '') {
            throw new Error('Leere Antwort vom Server erhalten.');
        }

        return JSON.parse(responseText);
    }
    
    async writeAndDownload(
        filename: string, 
        metadata: Record<string, string | string[]>, 
        format: string
    ): Promise<{ blob: Blob, downloadFilename: string }> {
        
        const payload = {
            filename: filename,
            metadata: metadata,
            format: format
        };

        const response = await fetch('/api/write-and-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw await this.handleFetchError(response);
        }

        let downloadFilename = `exported_${filename}`;
        const blob = await response.blob();
        const contentTypeHeader = response.headers.get('Content-Type');

        if (contentTypeHeader?.includes('application/json')) {
            downloadFilename = `exported_${this.pathParse(filename).name}.json`;
        } else if (contentTypeHeader?.includes('application/zip')) {
            downloadFilename = `exported_${this.pathParse(filename).name}.zip`;
        } else {
            downloadFilename = `exported_${filename}`;
        }
        
        return { blob, downloadFilename };
    }
}