/**
 * Generate VAPID key pair for web push notifications.
 *
 * Usage:
 *   pnpm --filter @mangaverse/api webpush:generate-keys
 *
 * Prints the public + private keys and optionally appends them to the
 * API's .env file (which is gitignored).
 */
import webpush from 'web-push';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔑 Generated VAPID keys:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@mangaverse.app`);
console.log('\n');

if (process.argv.includes('--write') && existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf8');
  let next = env.trimEnd();

  if (!next.includes('VAPID_PUBLIC_KEY')) {
    next += `\n\n# Web Push VAPID keys (generate with webpush:generate-keys)\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}\nVAPID_SUBJECT=mailto:admin@mangaverse.app\n`;
    writeFileSync(envPath, next + '\n', 'utf8');
    console.log('✅ Appended VAPID keys to .env');
  } else {
    console.log('ℹ️  VAPID keys already present in .env — not overwriting.');
  }
} else {
  console.log('To write these to .env automatically, re-run with: --write');
}
