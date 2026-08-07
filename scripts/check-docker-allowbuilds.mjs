#!/usr/bin/env node
// ─── Dockerfile allowBuilds sync guard ─────────────────────────────────
// pnpm 11 hard-fails a fresh install on any ignored build script
// (ERR_PNPM_IGNORED_BUILDS). Both production Dockerfiles rebuild
// pnpm-workspace.yaml at build time from an inline, trimmed allowBuilds
// map — so a new approval added to the root workspace without the matching
// entry in a Dockerfile breaks every image build (hit twice in deploy).
//
// This script fails CI with the list of missing entries. Run from the repo
// root:
//   node scripts/check-docker-allowbuilds.mjs            # verify both files
//   node scripts/check-docker-allowbuilds.mjs --yaml apps/web/Dockerfile
//        # print the exact trimmed workspace yaml the Dockerfile builds
//        # (useful for reproducing the image install locally)
import { readFileSync } from 'node:fs';

const root = readFileSync('pnpm-workspace.yaml', 'utf8');
const allowed = [...root.matchAll(/^ {2}['"]?([^'":\s#]+)['"]?: true\b/gm)].map((m) => m[1]);

const DOCKERFILES = ['apps/web/Dockerfile', 'apps/api/Dockerfile'];

function extractYaml(dockerfile) {
  const src = readFileSync(dockerfile, 'utf8');
  const block = src.match(/RUN printf '%s\\n' \\\n([\s\S]*?)\n\s*>\s*pnpm-workspace\.yaml/);
  if (!block) {
    throw new Error(`${dockerfile}: could not locate the trimmed pnpm-workspace.yaml block`);
  }
  return [...block[1].matchAll(/^[ \t]*"((?:[^"\\]|\\.)*)"[ \t]*(?:\\|$)/gm)]
    .map((m) => m[1].replace(/\\"/g, '"'))
    .join('\n');
}

const emit = process.argv.indexOf('--yaml');
if (emit !== -1) {
  const file = process.argv[emit + 1];
  if (!file) {
    console.error('Usage: check-docker-allowbuilds.mjs --yaml <Dockerfile>');
    process.exit(2);
  }
  process.stdout.write(`${extractYaml(file)}\n`);
  process.exit(0);
}

let failed = false;
for (const file of DOCKERFILES) {
  try {
    const yaml = extractYaml(file);
    const missing = allowed.filter((key) => !yaml.includes(key));
    if (missing.length) {
      failed = true;
      console.error(`✗ ${file} — missing allowBuilds entries: ${missing.join(', ')}`);
      console.error('  Add them to the inline map (must mirror pnpm-workspace.yaml).');
    } else {
      console.log(`✓ ${file} — allowBuilds in sync (${allowed.length} entries)`);
    }
  } catch (err) {
    failed = true;
    console.error(`✗ ${err.message}`);
  }
}

process.exit(failed ? 1 : 0);
