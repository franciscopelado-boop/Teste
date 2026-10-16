// Copia os arquivos do app web para www/, a pasta que o Capacitor empacota no APK.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const files = ['index.html', 'style.css', 'app.js', 'manifest.json', 'icon.svg', 'sw.js', 'vendor'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of files) cpSync(f, `www/${f}`, { recursive: true });
console.log('www/ pronto');
