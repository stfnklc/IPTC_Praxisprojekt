export class StateService {
    private _currentFilename: string = '';
    private _arrayTagKeys: Set<string> = new Set();
    private _currentAllMetadata: Record<string, any> = {};

    public setUploadResult(filename: string, metadata: Record<string, any>): void {
        this._currentFilename = filename;
        this._currentAllMetadata = metadata;
    }

    public getFilename(): string {
        return this._currentFilename;
    }

    public getMetadata(): Record<string, any> {
        return this._currentAllMetadata;
    }

    public setArrayTagKeys(keys: Set<string>): void {
        this._arrayTagKeys = keys;
    }
    
    public addArrayTagKey(key: string): void {
        this._arrayTagKeys.add(key);
    }

    public getArrayTagKeys(): Set<string> {
        return this._arrayTagKeys;
    }

    public isArrayTag(key: string): boolean {
        return this._arrayTagKeys.has(key);
    }

    public resetArrayTagKeys(): void {
        this._arrayTagKeys.clear();
    }
}