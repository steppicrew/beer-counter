#!/usr/bin/env node
/**
 * Applies ANDROID_APP_ID from .env to the native project.
 *
 * The application id is the app's permanent identity on Play — it can never
 * be changed once published — so it lives in capacitor.config.json as the
 * committed default, and .env may override it for a fork or a test upload.
 *
 * Rewrites capacitor.config.json, the Gradle applicationId/namespace, and the
 * Java package directory so `cap sync` and Gradle agree.
 *
 *   yarn node scripts/sync-app-id.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

// Minimal .env reader: no dependency, and it must not clobber real env vars.
function readEnv() {
  const file = resolve(root, '.env');
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv();
const configPath = resolve(root, 'capacitor.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const desired = process.env.ANDROID_APP_ID || env.ANDROID_APP_ID || config.appId;

if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(desired)) {
  console.error(
    `Invalid ANDROID_APP_ID "${desired}".\n` +
      'Use reverse-DNS, lowercase, at least two segments — e.g. de.steppicrew.beercounter.',
  );
  process.exit(1);
}

if (checkOnly) {
  console.log(`app id: ${desired}${desired === config.appId ? '' : ` (overrides ${config.appId})`}`);
  process.exit(0);
}

let changed = false;

if (config.appId !== desired) {
  const previous = config.appId;
  config.appId = desired;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`capacitor.config.json  ${previous} → ${desired}`);
  changed = true;
}

const gradlePath = resolve(root, 'android/app/build.gradle');
if (existsSync(gradlePath)) {
  const before = readFileSync(gradlePath, 'utf8');
  const after = before
    .replace(/applicationId "[^"]+"/, `applicationId "${desired}"`)
    .replace(/namespace "[^"]+"/, `namespace "${desired}"`);
  if (after !== before) {
    writeFileSync(gradlePath, after);
    console.log(`android/app/build.gradle  applicationId + namespace → ${desired}`);
    changed = true;
  }
}

// strings.xml carries the package name for Capacitor's own plugin routing.
const stringsPath = resolve(root, 'android/app/src/main/res/values/strings.xml');
if (existsSync(stringsPath)) {
  const before = readFileSync(stringsPath, 'utf8');
  const after = before
    .replace(
      /<string name="package_name">[^<]*<\/string>/,
      `<string name="package_name">${desired}</string>`,
    )
    .replace(
      /<string name="custom_url_scheme">[^<]*<\/string>/,
      `<string name="custom_url_scheme">${desired}</string>`,
    );
  if (after !== before) {
    writeFileSync(stringsPath, after);
    console.log('android/…/values/strings.xml  package_name + custom_url_scheme');
    changed = true;
  }
}

// MainActivity must sit in a directory matching its package declaration.
const javaRoot = resolve(root, 'android/app/src/main/java');
if (existsSync(javaRoot)) {
  const target = resolve(javaRoot, ...desired.split('.'));
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'MainActivity.java') found.push(full);
    }
  };
  walk(javaRoot);

  for (const file of found) {
    const source = readFileSync(file, 'utf8').replace(/^package .*;/m, `package ${desired};`);
    if (dirname(file) !== target) {
      mkdirSync(target, { recursive: true });
      writeFileSync(resolve(target, 'MainActivity.java'), source);
      rmSync(file);
      console.log(`MainActivity.java → ${desired.split('.').join('/')}/`);
      changed = true;
    } else if (source !== readFileSync(file, 'utf8')) {
      writeFileSync(file, source);
      changed = true;
    }
  }
}

console.log(changed ? `\nApp id is ${desired}.` : `App id already ${desired}.`);
