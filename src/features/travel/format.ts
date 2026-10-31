import type { Currency, DateValue } from './schema';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(v: DateValue): string {
  if (v === null) return '—';
  const d = new Date(v);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatTime(v: DateValue): string {
  if (v === null) return '';
  const d = new Date(v);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Duração entre dois instantes como "1h 30min"; vazio se não houver intervalo. */
export function formatDuration(start: DateValue, end: DateValue): string {
  if (start === null || end === null || end <= start) return '';
  const minutes = Math.round((end - start) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : '', m ? `${m}min` : ''].filter(Boolean).join(' ');
}

export function formatDateTime(v: DateValue): string {
  return v === null ? '—' : `${formatDate(v)} ${formatTime(v)}`;
}

/** Chave yyyy-mm-dd para agrupar por dia. */
export function dayKey(v: DateValue): string {
  return v === null ? '' : new Date(v).toISOString().slice(0, 10);
}

export function formatDayHeading(v: DateValue): string {
  if (v === null) return 'Sem data';
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(v));
  return `${formatDate(v)} · ${weekday}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);
}

export function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function formatAmount(amount: number | null, currency: Currency | undefined, code: string): string {
  if (amount === null) return '—';
  return `${currency?.symbol ?? code} ${formatNumber(amount)}`;
}

/** Converte para R$. Moedas do tipo "Milha" têm câmbio por milheiro (1.000 milhas). */
export function toBRL(amount: number | null, currency: Currency | undefined): number | null {
  if (amount === null || !currency || currency.rateBRL === null) return null;
  const unit = currency.type.toLowerCase() === 'milha' ? 1000 : 1;
  return (amount / unit) * currency.rateBRL;
}

export function mapsUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

export type StatusTone = 'good' | 'warn' | 'neutral';

/** Dias inteiros até a data (negativo se já passou). */
export function daysUntil(v: DateValue): number | null {
  if (v === null) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((v - today) / 86_400_000);
}

export function countdownLabel(start: DateValue, end: DateValue): string {
  const toStart = daysUntil(start);
  const toEnd = daysUntil(end);
  if (toStart === null) return '';
  if (toStart > 0) return toStart === 1 ? 'Começa amanhã' : `Faltam ${toStart} dias`;
  if (toEnd !== null && toEnd >= 0) return 'Em andamento';
  return 'Concluída';
}

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.startsWith('não') || s.startsWith('nao') || s === 'pendente') return 'warn';
  if (s.startsWith('pago') || s === 'reservado') return 'good';
  return 'neutral';
}
