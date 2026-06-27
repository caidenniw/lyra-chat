#!/usr/bin/env node
// scripts/fix-worker-ext.js
// Renames .ts worker files in dist/ to .js so Vercel serves correct MIME type.
// Vite 8 outputs worker files with .ts extension which Vercel interprets as video/mp2t.

import { readdirSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist', 'assets');

const files = readdirSync(distDir);
const tsWorkerFiles = files.filter(f => f.endsWith('.ts') && f.includes('streamWorker'));

for (const file of tsWorkerFiles) {
  const oldPath = join(distDir, file);
  const newPath = join(distDir, file.replace('.ts', '.js'));
  
  // Rename file
  renameSync(oldPath, newPath);
  console.log(`Renamed: ${file} → ${file.replace('.ts', '.js')}`);
  
  // Update references in other JS files
  const jsFiles = files.filter(f => f.endsWith('.js'));
  for (const jsFile of jsFiles) {
    const jsPath = join(distDir, jsFile);
    const content = readFileSync(jsPath, 'utf-8');
    const oldRef = file;
    const newRef = file.replace('.ts', '.js');
    
    if (content.includes(oldRef)) {
      const updated = content.replaceAll(oldRef, newRef);
      writeFileSync(jsPath, updated);
      console.log(`Updated reference in ${jsFile}: ${oldRef} → ${newRef}`);
    }
  }
}

console.log('Worker extension fix complete.');
