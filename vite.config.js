import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Add a plugin to handle the script-loader requirement in anki-apkg-export
    {
      name: 'handle-script-loader',
      // This transform plugin intercepts the attempt to require('script-loader!sql.js')
      transform(code, id) {
        if (id.includes('anki-apkg-export')) {
          // Replace the problematic require with a comment
          return code.replace(
            `require('script-loader!sql.js');`, 
            `// script-loader requirement removed - using our own SQL.js initialization`
          );
        }
      }
    }
  ],
  // Add resolve aliases if needed
  resolve: {
    alias: {
      // This is needed if there are any Node.js specific modules
      'path': 'path-browserify',
    }
  },
  optimizeDeps: {
    include: ['sql.js']
  },
  // Define process.env variables for the browser environment
  define: {
    'process.env.APP_ENV': JSON.stringify('browser')
  }
}) 