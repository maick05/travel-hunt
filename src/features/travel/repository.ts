import { isSheetsConfigured } from '@/config/env';
import { USE_REMOTE, fetchRemoteTabs } from '@/services/remote';
import { fetchTabs, pickTabs } from '@/services/sheets/client';

import { parseTables, tableKeys } from './parse';
import { registerCoords } from './places';
import { sampleRows } from './sample-data';
import { schemas, type TableKey, type Tables } from './schema';

// Abas que podem não existir: sem Locals não há agrupamento por cidade; sem Coordenadas vale o que o build resolveu.
const OPTIONAL_TABS: TableKey[] = ['locals', 'coords'];

export async function loadTravelData(): Promise<Tables> {
  if (!USE_REMOTE && !isSheetsConfigured) return parseTables(sampleRows);

  const tabs = tableKeys.map((k) => ({ prefix: schemas[k].tab, optional: OPTIONAL_TABS.includes(k) }));
  const rows = USE_REMOTE ? pickTabs(await fetchRemoteTabs(), tabs) : await fetchTabs(tabs);
  const tables = parseTables(
    Object.fromEntries(tableKeys.map((k, i) => [k, rows[i]])) as Parameters<typeof parseTables>[0],
  );
  registerCoords(tables.coords);
  return tables;
}
