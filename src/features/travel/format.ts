import type { Bill, Currency, DateValue } from './schema';

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

/** Converte para R$ pelo câmbio da aba Currency (milhas inclusive: o câmbio é por milha). */
export function toBRL(amount: number | null, currency: Currency | undefined): number | null {
  if (amount === null || !currency || currency.rateBRL === null) return null;
  return amount * currency.rateBRL;
}

/** Custo em R$ de um lançamento: a cotação utilizada, quando preenchida (0 = nada gasto), senão o câmbio da moeda. */
export function billToBRL(bill: Bill, currencies: Currency[]): number | null {
  if (bill.usedRate !== null) return bill.amount === null ? null : bill.amount * bill.usedRate;
  const base = toBRL(
    bill.amount,
    currencies.find((c) => c.symbol === bill.currency),
  );
  const fees = bill.usedRate === null ? foreignFees(bill, currencies) : null;
  return base === null || !fees ? base : base * (1 + fees.spread) * (1 + fees.iof);
}

/** Estimativa de encargos: spread do cartão e IOF sobre o valor convertido. */
export const SPREAD_CARTAO = 0.04;
export const IOF_EXTERIOR = 0.035;

/** Encargos de compra em moeda fiduciária estrangeira; null para R$, milhas e outros tipos. */
export function foreignFees(bill: Bill, currencies: Currency[]): { spread: number; iof: number } | null {
  const currency = currencies.find((c) => c.symbol === bill.currency);
  if (!currency || currency.symbol === 'R$') return null;
  if (!/fiduci/i.test(currency.type.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return null;
  const card = /cr[eé]dito/i.test(bill.paymentMethod);
  return { spread: card ? SPREAD_CARTAO : 0, iof: card ? 0 : IOF_EXTERIOR };
}

/** Texto dos encargos aplicados; vazio quando não há. */
export function feesNote(bill: Bill, currencies: Currency[]): string {
  if (bill.usedRate !== null) return '';
  const fees = foreignFees(bill, currencies);
  if (!fees) return '';
  const pct = (n: number) => `${formatNumber(n * 100)}%`;
  return [fees.spread ? `Spread ${pct(fees.spread)}` : '', fees.iof ? `IOF ${pct(fees.iof)}` : '']
    .filter(Boolean).join(' + ');
}

export function formatRate(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 5 }).format(n);
}

/** Observação sobre a cotação utilizada; vazio quando vale o câmbio padrão. */
export function rateNote(bill: Bill): string {
  if (bill.usedRate === null) return '';
  return bill.usedRate === 0 ? 'Sem custo' : `Cotação utilizada: ${formatRate(bill.usedRate)}`;
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
