#!/usr/bin/env node
/**
 * Single source of truth for the version. Bumps package.json's `version`
 * (semver, shown in the app and used as Android versionName) and
 * `androidVersionCode` (monotonic integer Play Console requires).
 *
 *   node scripts/bump-version.mjs [patch|minor|major]   default: patch
 *   node scripts/bump-version.mjs --set 2.1.0
 *   node scripts/bump-version.mjs --print               read-only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const args = process.argv.slice(2);

if (args.includes('--print')) {
  console.log(`${pkg.version} (versionCode ${pkg.androidVersionCode})`);
  process.exit(0);
}

const setIndex = args.indexOf('--set');
let next;

if (setIndex !== -1) {
  next = args[setIndex + 1];
  if (!/^\d+\.\d+\.\d+$/.test(next ?? '')) {
    console.error('--set needs a semver like 2.1.0');
    process.exit(1);
  }
} else {
  const level = args[0] ?? 'patch';
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  if (level === 'major') next = `${major + 1}.0.0`;
  else if (level === 'minor') next = `${major}.${minor + 1}.0`;
  else if (level === 'patch') next = `${major}.${minor}.${patch + 1}`;
  else {
    console.error(`Unknown bump level "${level}" — use patch, minor or major.`);
    process.exit(1);
  }
}

const previous = pkg.version;
pkg.version = next;
// Play Console rejects a versionCode that is not strictly greater than the
// last uploaded one, so this only ever moves forward — never derived from
// the semver, which could go backwards on a rollback.
pkg.androidVersionCode = (pkg.androidVersionCode ?? 0) + 1;

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`${previous} → ${pkg.version}  (versionCode ${pkg.androidVersionCode})`);
