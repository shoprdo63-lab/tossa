import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync, copyFile } from 'fs';
import { promisify } from 'util';

const copyFilePromise = promisify(copyFile);

/**
 * AliSmart Finder Pro - Vite Configuration
 * Multi-entry build system for Chrome Extension:
 * 1. Content Script (content.js) - Injected into AliExpress pages
 * 2. Background (background.js) - Service Worker
 * 3. Sidebar (index.html) - Popup/Sidebar UI
 * 
 * Features: HMR, production optimization, CSS isolation, Chrome extension compatible
 */

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const isProduction = mode === 'production';

  return {
    plugins: [
      react({
        // Fast refresh for development
        fastRefresh: isDev,
        // Remove prop types in production
        removeConsole: isProduction,
      }),
      
      // Custom plugin to copy extension files after build
      {
        name: 'copy-extension-files',
        async closeBundle() {
          const outDir = resolve(__dirname, 'dist');
          const publicDir = resolve(__dirname, 'public');
          
          // Ensure dist directory exists
          try {
            mkdirSync(outDir, { recursive: true });
          } catch (e) {
            // Directory already exists
          }
          
          // Copy manifest.json
          try {
            copyFileSync(
              resolve(publicDir, 'manifest.json'),
              resolve(outDir, 'manifest.json')
            );
            console.log('✓ Copied manifest.json');
          } catch (e) {
            console.warn('⚠ Could not copy manifest.json:', e.message);
          }
          
          // Copy icons directory recursively
          try {
            const copyDir = async (src, dest) => {
              try {
                mkdirSync(dest, { recursive: true });
                const entries = readdirSync(src, { withFileTypes: true });
                
                for (const entry of entries) {
                  const srcPath = resolve(src, entry.name);
                  const destPath = resolve(dest, entry.name);
                  
                  if (entry.isDirectory()) {
                    await copyDir(srcPath, destPath);
                  } else {
                    await copyFilePromise(srcPath, destPath);
                  }
                }
              } catch (e) {
                // Directory doesn't exist
              }
            };
            
            await copyDir(resolve(publicDir, 'icons'), resolve(outDir, 'icons'));
            console.log('✓ Copied icons');
          } catch (e) {
            console.warn('⚠ Could not copy icons:', e.message);
          }
          
          // Copy any other static assets
          try {
            const entries = readdirSync(publicDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isFile() && entry.name !== 'manifest.json') {
                await copyFilePromise(
                  resolve(publicDir, entry.name),
                  resolve(outDir, entry.name)
                );
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    ],

    // Base URL - must be relative for Chrome extensions
    base: './',

    // Build configuration
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
      
      // Source maps: inline in dev, none in production (Chrome extension restrictions)
      sourcemap: isDev ? 'inline' : false,
      
      // CSS code splitting
      cssCodeSplit: true,
      
      // Disable module preload for Chrome extensions
      modulePreload: false,
      
      // Target modern browsers
      target: ['chrome90', 'firefox88'],
      
      // Minification
      minify: isProduction ? 'esbuild' : false,
      
      // Rollup options for multi-entry build
      rollupOptions: {
        input: {
          // Sidebar/Popup UI entry point
          main: resolve(__dirname, 'index.html'),
          // Content Script entry point
          content: resolve(__dirname, 'src/content/index.jsx'),
          // Background Service Worker entry point
          background: resolve(__dirname, 'src/background/index.js')
        },
        
        output: {
          // Entry file names - keep background.js and content.js at root
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'content') {
              return 'content.js';
            }
            if (chunkInfo.name === 'background') {
              return 'background.js';
            }
            return 'assets/[name]-[hash].js';
          },
          
          // Chunk file names
          chunkFileNames: 'assets/[name]-[hash].js',
          
          // Asset file names with proper organization
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name;
            if (!info) return 'assets/[name]-[hash][extname]';
            
            // CSS files
            if (info.endsWith('.css')) {
              if (assetInfo.originalFileName?.includes('content')) {
                return 'content.css';
              }
              return 'assets/styles/[name]-[hash][extname]';
            }
            
            // Images
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(info)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            
            // Fonts
            if (/\.(woff2?|ttf|otf|eot)$/i.test(info)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            
            return 'assets/[name]-[hash][extname]';
          }
        }
      },
      
      // ESBuild options for production optimization
      esbuild: {
        drop: isProduction ? ['console', 'debugger'] : [],
        pure: isProduction ? ['console.log', 'console.info'] : [],
      }
    },

    // Development server with HMR
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      
      // HMR configuration
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
        overlay: true,
      },
      
      // CORS for Chrome extension development
      cors: {
        origin: [/chrome-extension:/, /moz-extension:/],
        credentials: true,
      },
      
      // File watching
      watch: {
        usePolling: true,
        interval: 1000,
      },
      
      // Auto-open browser disabled for extension dev
      open: false,
    },

    // Preview server for testing production build
    preview: {
      port: 4173,
      strictPort: true,
      host: true,
    },

    // Path resolution with aliases
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@services': resolve(__dirname, 'src/services'),
        '@components': resolve(__dirname, 'src/components'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@sidebar': resolve(__dirname, 'src/sidebar'),
        '@content': resolve(__dirname, 'src/content'),
        '@i18n': resolve(__dirname, 'src/i18n'),
        '@background': resolve(__dirname, 'src/background'),
      }
    },

    // CSS configuration
    css: {
      devSourcemap: true,
      postcss: './postcss.config.js',
      modules: {
        scopeBehaviour: 'local',
        generateScopedName: isDev 
          ? '[name]__[local]___[hash:base64:5]' 
          : '[hash:base64:8]',
      }
    },

    // Dependency optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-i18next',
        'i18next',
        'recharts',
      ],
      exclude: [
        'chrome', // Chrome APIs - should not be bundled
      ],
    },

    // Environment variables
    define: {
      __VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0'),
      __DEV__: JSON.stringify(isDev),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },

    // Environment prefix
    envPrefix: 'VITE_',
  };
});
