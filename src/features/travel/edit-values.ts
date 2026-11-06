import type { EditSheet } from '../../services/remote';
import { sourceRowOf } from './parse';
import { schemas, type FieldSpec, type TableKey } from './schema';

const EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86400000;

export function editFieldType(sheet: string, header: string): string | undefined {
  const schema = Object.values(schemas).find((item) => sheet.trim().toLowerCase().startsWith(item.tab.toLowerCase()));
  return Object.values(schema?.fields ?? {}).find((field) =>
    [field.header, ...(field.aliases ?? [])].some((name) => name.toLowerCase() === header.trim().toLowerCase()))?.type;
}

export function dateInput(value: number): string {
  return new Date(EPOCH + Math.round(value * DAY)).toISOString().slice(0, 19).replace('T', ' ');
}

export function dateSerial(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day) || date.getUTCHours() !== Number(hour) || date.getUTCMinutes() !== Number(minute) || date.getUTCSeconds() !== Number(second)) return null;
  return (timestamp - EPOCH) / DAY;
}

function equalRows(left: unknown[], right: unknown[]): boolean {
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
    const first = left[index] ?? '';
    const second = right[index] ?? '';
    return typeof first === 'number' && typeof second === 'number' ? Math.abs(first - second) < 1e-8 : first === second;
  }).every(Boolean);
}

export function findEditItem(sheets: EditSheet[], table: TableKey, item: Record<string, unknown>) {
  const schema = schemas[table];
  const sheet = sheets.find((entry) => entry.nome.trim().toLowerCase().startsWith(schema.tab.toLowerCase()));
  if (!sheet) throw new Error('Dados para edição não encontrados.');
  const fields: FieldSpec = schema.fields;
  const original = sourceRowOf(item);
  if (!original || !equalRows(original.header, sheet.cabecalho)) throw new Error('Dados para edição desatualizados. Atualize a viagem e tente novamente.');
  const candidates = sheet.linhas.filter((row) => equalRows(original.row, row.cells.map((cell) => cell.valor)));
  if (candidates.length !== 1) throw new Error('Não foi possível identificar o item com segurança. Atualize os dados e tente novamente.');
  const row = candidates[0];
  const editable = Object.entries(fields).flatMap(([key, field]) => {
    if (key === 'trip' || (table === 'travels' && (key === 'name' || key === 'id'))) return [];
    const columns = [field.header, ...(field.aliases ?? [])].map((name) =>
      sheet.cabecalho.flatMap((header, index) => String(header).trim().toLowerCase() === name.toLowerCase() ? [index] : []),
    ).find((indexes) => indexes.length);
    const column = columns?.[field.occurrence ?? columns.length - 1];
    if (column === undefined || !row.cells[column] || row.cells[column].formula) return [];
    return [{ key, label: key === 'menuFile' ? 'Arquivo do cardápio' : field.header, type: field.type, column, value: row.cells[column].valor }];
  });
  return { sheet, row, fields: editable };
}