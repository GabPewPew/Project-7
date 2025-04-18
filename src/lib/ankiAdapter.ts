/**
 * Adapter for making anki-apkg-export work with Vite
 * This addresses the "script-loader!sql.js" issue
 */

// Import SQL.js directly
import initSqlJs from 'sql.js';

// Create a global reference to SQL.js
// This emulates what script-loader would do in Webpack
(window as any).SQL = initSqlJs;

// Export a function to initialize SQL.js
export async function initializeSqlJs(): Promise<void> {
  try {
    console.log('[AnkiAdapter] Initializing SQL.js...');
    const SQL = await initSqlJs({
      // Path to the sql-wasm.wasm file
      // This should be copied to the public folder to be accessible
      locateFile: (file: string) => `/sql-wasm.wasm`
    });
    
    // Make it available globally
    (window as any).SQL = SQL;
    console.log('[AnkiAdapter] SQL.js initialized successfully');
    return;
  } catch (error) {
    console.error('[AnkiAdapter] Failed to initialize SQL.js:', error);
    throw error;
  }
} 