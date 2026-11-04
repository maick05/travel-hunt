import { schemas, type FieldSpec, type Row, type SheetCell, type SheetRows, type TableKey, type Tables } from './schema';

const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const DAY_MS = 86_400_000;

// Colunas pré-preenchidas na planilha mesmo em linhas vazias.
const FILLER_KEYS = new Set(['trip', 'code', 'id', 'reserved']);

function toText(v: SheetCell): string {
  return v == null ? '' : String(v).trim();
}

function toNumber(v: SheetCell): number | null {
  if (typeof v === 'number') return v;
  const n = parseFloat(toText(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function toDate(v: SheetCell): number | null {
  return typeof v === 'number' ? Math.round((v - EXCEL_EPOCH_OFFSET_DAYS) * DAY_MS) : null;
}

function toBoolean(v: SheetCell): boolean | null {
  if (typeof v === 'boolean') return v;
  const value = toText(v).toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function parseTable<S extends FieldSpec>(rows: SheetRows, fields: S): Row<S>[] {
  const [header = [], ...body] = rows;
  const columnOf = new Map<string, number[]>();
  header.forEach((value, index) => {
    const name = toText(value).toLowerCase();
    columnOf.set(name, [...(columnOf.get(name) ?? []), index]);
  });
  const keys = Object.keys(fields);

  const result: Row<S>[] = [];
  for (const row of body) {
    const item: Record<string, string | string[] | number | boolean | null> = {};
    let hasData = false;

    for (const key of keys) {
      const field = fields[key];
      const columns = [field.header, ...(field.aliases ?? [])].map((headerName) => columnOf.get(headerName.toLowerCase())).find(Boolean);
      const col = columns?.[field.occurrence ?? columns.length - 1];
      const cell = col === undefined ? undefined : row[col];
      const value = field.type === 'text' ? toText(cell) : field.type === 'number' ? toNumber(cell) :
        field.type === 'boolean' ? toBoolean(cell) : field.type === 'list' ? toText(cell).split(',').map((part) => part.trim()).filter(Boolean) : toDate(cell);
      item[key] = value;
      if (!FILLER_KEYS.has(key) && value !== '' && value !== null && (!Array.isArray(value) || value.length > 0)) hasData = true;
    }
    if (hasData) result.push(item as Row<S>);
  }
  return result;
}

export const tableKeys = Object.keys(schemas) as TableKey[];

export function parseTables(raw: Record<TableKey, SheetRows>): Tables {
  return Object.fromEntries(tableKeys.map((k) => [k, parseTable(raw[k], schemas[k].fields)])) as Tables;
}
