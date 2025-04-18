/**
 * Type declarations for libraries without TypeScript definitions
 */

declare module 'anki-apkg-export' {
  interface AnkiExportOptions {
    description?: string;
    [key: string]: any;
  }

  class AnkiExport {
    constructor(deckName: string, options?: AnkiExportOptions);
    addCard(front: string, back: string, tags?: string[]): void;
    addMedia(filename: string, data: ArrayBuffer): void;
    save(): Promise<Blob>;
  }

  export default AnkiExport;
}

declare module 'sql.js' {
  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }
  
  type SqlValue = number | string | Uint8Array | null;
  type ParamsObject = Record<string, SqlValue>;
  type ParamsCallback = (obj: ParamsObject) => void;
  
  interface SqlJsStatic {
    Database: any;
  }
  
  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  
  export default initSqlJs;
} 