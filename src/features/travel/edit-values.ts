import { schemas } from './schema';

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