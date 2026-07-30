/**
 * MangaVerse Mobile Asset Generator
 * 
 * Converts SVG source files to PNG format required by Expo/Android/iOS.
 * 
 * Usage: node scripts/generate-assets.js
 * Prerequisites: npm install sharp
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ASSETS_DIR = join(__dirname, '..', 'assets');
const APP_JSON_PATH = join(__dirname, '..', 'app.json');

async function generateAssets() {
  console.log('🎨 MangaVerse Asset Generator');
  console.log('');

  // Check if sharp is available
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('❌ sharp is not installed. Install it with:');
    console.log('   pnpm add -D sharp');
    console.log('');
    console.log('   Then run this script again.');
    process.exit(1);
  }

  const assets = [
    { input: 'icon.svg', output: 'icon.png', size: 1024 },
    { input: 'adaptive-icon.svg', output: 'adaptive-icon.png', size: 1024 },
    { input: 'splash.svg', output: 'splash.png', size: 1024 },
  ];

  for (const asset of assets) {
    const inputPath = join(ASSETS_DIR, asset.input);
    const outputPath = join(ASSETS_DIR, asset.output);

    if (!existsSync(inputPath)) {
      console.log(`⚠️  Source file not found: ${asset.input} — skipping`);
      continue;
    }

    try {
      const svgBuffer = readFileSync(inputPath);
      await sharp(svgBuffer)
        .resize(asset.size, asset.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outputPath);
      console.log(`✅ Generated ${asset.output} (${asset.size}×${asset.size} PNG)`);
    } catch (err) {
      console.log(`❌ Failed to convert ${asset.input}: ${err.message}`);
    }
  }

  console.log('');
  console.log('📝 Next: Update app.json to reference .png files instead of .svg');
  console.log('   See assets/README.md for details.');
}

generateAssets().catch(console.error);
