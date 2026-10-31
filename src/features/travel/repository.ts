import { isSheetsConfigured } from '@/config/env';
import { fetchTabs } from '@/services/sheets/client';

import { parseTables, tableKeys } from './parse';
import { sampleRows } from './sample-data';
import { schemas, type TableKey, type Tables } from './schema';

// A aba Locals pode não existir; sem ela o app só fica sem agrupamento por cidade.
const OPTIONAL_TABS: TableKey[] = ['locals'];

export async function loadTravelData(): Promise<Tables> {
  if (!isSheetsConfigured) return parseTables(sampleRows);

  const rows = await fetchTabs(tableKeys.map((k) => ({ prefix: schemas[k].tab, optional: OPTIONAL_TABS.includes(k) })));
  return parseTables(Object.fromEntries(tableKeys.map((k, i) => [k, rows[i]])) as Parameters<typeof parseTables>[0]);
}
