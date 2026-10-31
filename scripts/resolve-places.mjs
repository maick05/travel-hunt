// Resolve links do Google Maps (inclusive maps.app.goo.gl) para nome + coordenadas e grava em
// src/features/travel/places.generated.json. Lê todos os links da planilha pela API do Sheets.
// Uso: npm run places   (usa EXPO_PUBLIC_SHEETS_ID e EXPO_PUBLIC_SHEETS_API_KEY do ambiente ou do .env)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/features/travel/places.generated.json', import.meta.url));
const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));

if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const id = process.env.EXPO_PUBLIC_SHEETS_ID;
const key = process.env.EXPO_PUBLIC_SHEETS_API_KEY;
if (!id || !key) {
  console.log('[places] Sheets não configurado; mantendo o arquivo atual.');
  process.exit(0);
}

const LINK = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)\S*$/i;
const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API ${res.status}`);
  return res.json();
}

async function sheetLinks() {
  const meta = await getJson(`${base}?fields=sheets.properties.title&key=${key}`);
  const ranges = meta.sheets.map((s) => `ranges=${encodeURIComponent(`'${s.properties.title.replace(/'/g, "''")}'`)}`).join('&');
  const data = await getJson(`${base}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&key=${key}`);
  const links = new Set();
  for (const range of data.valueRanges) {
    for (const row of range.values ?? []) {
      for (const cell of row) if (typeof cell === 'string' && LINK.test(cell.trim())) links.add(cell.trim());
    }
  }
  return [...links];
}

// O Google responde 302 com a URL completa no header Location; seguimos à mão para ler a URL final.
async function finalUrl(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { redirect: 'manual', headers: { 'accept-language': 'pt-BR' } });
    const next = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !next) return url;
    url = new URL(next, url).toString();
  }
  return url;
}

function parse(url) {
  const exact = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url);
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url);
  const m = exact ?? view;
  if (!m) return null;
  const nameMatch = /\/maps\/place\/([^/@?]+)/.exec(url);
  const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : '';
  return { name, lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

const known = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const links = await sheetLinks();
const pending = links.filter((l) => !known[l]);
console.log(`[places] ${links.length} link(s) na planilha, ${pending.length} novo(s).`);

for (const link of pending) {
  try {
    const place = parse(await finalUrl(link));
    if (place) known[link] = place;
    else console.warn(`[places] Sem coordenadas: ${link}`);
  } catch (e) {
    console.warn(`[places] Falha em ${link}: ${e.message}`);
  }
}

const sorted = Object.fromEntries(Object.entries(known).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');

// Arquivos do Drive inseridos como chip: a API de valores só devolve o nome; o link está no chip.
const BANNERS_OUT = fileURLToPath(new URL('../src/features/travel/banners.generated.json', import.meta.url));
const DRIVE = /^https?:\/\/drive\.google\.com\//i;
const DRIVE_ID = /drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?[^#]*?id=)([\w-]+)/;
const IMAGES_TS = fileURLToPath(new URL('../src/features/travel/drive-images.generated.ts', import.meta.url));
const IMAGES_DIR = fileURLToPath(new URL('../assets/banners/', import.meta.url));
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// O Drive não deixa outros sites embutirem a imagem (CORP same-site); por isso baixamos para assets/banners.
async function downloadDriveImage(fileId) {
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, { redirect: 'follow' });
  const type = (res.headers.get('content-type') ?? '').split(';')[0];
  if (!res.ok || !EXT[type]) throw new Error(`não é uma imagem pública (${res.status} ${type})`);
  mkdirSync(IMAGES_DIR, { recursive: true });
  const name = `${fileId}.${EXT[type]}`;
  writeFileSync(IMAGES_DIR + name, Buffer.from(await res.arrayBuffer()));
  return name;
}

try {
  const grid = await getJson(
    `${base}?includeGridData=true&fields=sheets.properties.title,sheets.data.rowData.values(formattedValue,hyperlink,chipRuns)&key=${key}`,
  );
  const files = existsSync(BANNERS_OUT) ? JSON.parse(readFileSync(BANNERS_OUT, 'utf8')) : {};
  const driveLinks = new Set();
  for (const sheet of grid.sheets ?? []) {
    // Banners das viagens são imagens locais em assets/trips; só as outras abas usam o Drive.
    if (/^travels/i.test(sheet.properties?.title ?? '')) continue;
    for (const data of sheet.data ?? []) {
      for (const row of data.rowData ?? []) {
        for (const cell of row.values ?? []) {
          const uri =
            (cell.chipRuns ?? []).map((r) => r.chip?.richLinkProperties?.uri).find((u) => u && DRIVE.test(u)) ??
            (cell.hyperlink && DRIVE.test(cell.hyperlink) ? cell.hyperlink : undefined);
          if (uri && cell.formattedValue) files[cell.formattedValue.trim()] = uri;
          if (cell.formattedValue && DRIVE.test(cell.formattedValue.trim())) driveLinks.add(cell.formattedValue.trim());
        }
      }
    }
  }
  const sortedFiles = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BANNERS_OUT, JSON.stringify(sortedFiles, null, 2) + '\n');
  console.log(`[places] ${Object.keys(sortedFiles).length} arquivo(s) do Drive mapeado(s).`);

  mkdirSync(IMAGES_DIR, { recursive: true });
  const ids = new Set([...driveLinks, ...Object.values(sortedFiles)].map((l) => DRIVE_ID.exec(l)?.[1]).filter(Boolean));
  for (const fileId of ids) {
    if (readdirSync(IMAGES_DIR).some((f) => f.startsWith(`${fileId}.`))) continue;
    try {
      console.log(`[places] Imagem baixada: ${await downloadDriveImage(fileId)}`);
    } catch (e) {
      console.warn(`[places] Falha ao baixar ${fileId}: ${e.message}`);
    }
  }

  // O Metro precisa de `require` estático: geramos o módulo a partir dos arquivos que existem.
  const entries = readdirSync(IMAGES_DIR)
    .sort()
    .map((f) => `  '${f.replace(/\.[^.]+$/, '')}': require('../../../assets/banners/${f}'),`);
  writeFileSync(
    IMAGES_TS,
    `// Gerado por scripts/resolve-places.mjs. Não edite.\nexport const DRIVE_IMAGES: Record<string, number> = {\n${entries.join('\n')}\n};\n`,
  );
} catch (e) {
  console.warn(`[places] Não foi possível ler os arquivos do Drive: ${e.message}`);
}
