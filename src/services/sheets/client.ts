import { env } from '@/config/env';
import type { SheetRows } from '@/features/travel/schema';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao acessar o Google Sheets (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Busca as abas cujo título começa com cada prefixo (ignora emoji e espaços do título).
 * Valores vêm sem formatação e datas como número serial, igual ao parser espera.
 */
export async function fetchTabs(tabs: { prefix: string; optional?: boolean }[]): Promise<SheetRows[]> {
  const base = `${BASE_URL}/${env.sheetsId}`;
  const key = `key=${encodeURIComponent(env.sheetsApiKey)}`;

  const meta = await getJson<{ sheets: { properties: { title: string } }[] }>(
    `${base}?fields=sheets.properties.title&${key}`,
  );
  const titles = meta.sheets.map((s) => s.properties.title);

  const resolved = tabs.map(({ prefix, optional }) => {
    const title = titles.find((t) => t.trim().toLowerCase().startsWith(prefix.toLowerCase()));
    if (!title && !optional) throw new Error(`Aba "${prefix}" não encontrada na planilha.`);
    return title;
  });

  const found = resolved.filter((t): t is string => !!t);
  const ranges = found.map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'`)}`).join('&');
  const data = await getJson<{ valueRanges: { values?: SheetRows }[] }>(
    `${base}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&${key}`,
  );

  let next = 0;
  return resolved.map((t) => (t ? (data.valueRanges[next++].values ?? []) : []));
}
