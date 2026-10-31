// Baixa todas as abas da planilha no build e grava public/data.enc.json criptografado (AES-256-GCM,
// chave derivada da senha com PBKDF2). A chave da API e o ID da planilha ficam só no servidor do build.
// Uso: SHEETS_ID, SHEETS_API_KEY e SITE_PASSWORD no ambiente (ou no .env) e `node scripts/build-data.mjs`.
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../public/', import.meta.url));

if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const id = process.env.SHEETS_ID ?? process.env.EXPO_PUBLIC_SHEETS_ID;
const key = process.env.SHEETS_API_KEY ?? process.env.EXPO_PUBLIC_SHEETS_API_KEY;
const password = process.env.SITE_PASSWORD;
if (!id || !key || !password) {
  console.error('[data] Defina SHEETS_ID, SHEETS_API_KEY e SITE_PASSWORD.');
  process.exit(1);
}

const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API ${res.status}`);
  return res.json();
}

const meta = await getJson(`${base}?fields=sheets.properties.title&key=${key}`);
const titles = meta.sheets.map((s) => s.properties.title);
const ranges = titles.map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'`)}`).join('&');
const data = await getJson(
  `${base}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&key=${key}`,
);

const tabs = Object.fromEntries(titles.map((t, i) => [t, data.valueRanges[i].values ?? []]));
const payload = JSON.stringify({ updatedAt: new Date().toISOString(), tabs });

const ITERATIONS = 250_000;
const salt = randomBytes(16);
const iv = randomBytes(12);
const aesKey = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
// O Web Crypto espera o tag de autenticação logo após o texto cifrado.
const blob = Buffer.concat([encrypted, cipher.getAuthTag()]);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_DIR + 'data.enc.json',
  JSON.stringify({ v: 1, iter: ITERATIONS, salt: salt.toString('base64'), iv: iv.toString('base64'), data: blob.toString('base64') }),
);
console.log(`[data] ${titles.length} aba(s) gravadas em public/data.enc.json (criptografado).`);
