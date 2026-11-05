import AsyncStorage from '@react-native-async-storage/async-storage';
import { md5 } from 'js-md5';

import { env, isSheetsConfigured } from '@/config/env';
import { USE_REMOTE, fetchRemoteTabs, remoteCacheScope } from '@/services/remote';
import { fetchTabs, pickTabs } from '@/services/sheets/client';

import { parseTable, parseTables, tableKeys } from './parse';
import { registerCoords } from './places';
import { sampleRows } from './sample-data';
import { schemas, type SheetRows, type TableKey, type Tables, type Travel } from './schema';

// Abas que podem não existir: sem Locals não há agrupamento por cidade; sem Coordenadas vale o que o build resolveu.
const OPTIONAL_TABS: TableKey[] = ['locals', 'coords', 'valueReserves'];

export const TRAVEL_CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function loadTravels(): Promise<{ travels: Travel[]; fetchedAt: number }> {
  const scope = USE_REMOTE ? remoteCacheScope() : isSheetsConfigured ? md5(env.sheetsId) : 'sample';
  const key = `travel-hunt:travels:v1:${scope}`;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const cached = JSON.parse(stored) as { rows: SheetRows; fetchedAt: number };
      if (Array.isArray(cached.rows) && cached.rows.every(Array.isArray) && Number.isFinite(cached.fetchedAt) &&
          cached.fetchedAt <= Date.now() && Date.now() - cached.fetchedAt < TRAVEL_CACHE_DURATION) {
        return { travels: parseTable(cached.rows, schemas.travels.fields), fetchedAt: cached.fetchedAt };
      }
    }
  } catch {}

  const tabs = [{ prefix: schemas.travels.tab }];
  let fetchedAt = Date.now();
  let rows: SheetRows;
  if (USE_REMOTE) {
    const response = await fetchRemoteTabs('viagens');
    rows = pickTabs(response.tabs, tabs)[0];
    fetchedAt = response.fetchedAt;
  } else {
    rows = isSheetsConfigured ? (await fetchTabs(tabs))[0] : sampleRows.travels;
    fetchedAt = Date.now();
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ rows, fetchedAt }));
  } catch {}
  return { travels: parseTable(rows, schemas.travels.fields), fetchedAt };
}

export async function loadTravelData(viagem: string): Promise<Tables> {
  if (!viagem.trim()) throw new Error('Informe a viagem.');
  if (!USE_REMOTE && !isSheetsConfigured) return parseTables(sampleRows);

  const tabs = tableKeys.map((k) => ({ prefix: schemas[k].tab, optional: OPTIONAL_TABS.includes(k) }));
  const rows = USE_REMOTE ? pickTabs((await fetchRemoteTabs('viagem', viagem)).tabs, tabs) : await fetchTabs(tabs);
  const tables = parseTables(
    Object.fromEntries(tableKeys.map((k, i) => [k, rows[i]])) as Parameters<typeof parseTables>[0],
  );
  registerCoords(tables.coords);
  return tables;
}
