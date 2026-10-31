import { toBRL } from './format';
import type { Bill } from './schema';
import type { TripData } from './use-travel-data';

export type CostKind = 'flights' | 'hotels' | 'transports' | 'meals' | 'activities';

// Valor da coluna "Tipo" da aba Money para cada categoria.
const BILL_TYPE: Record<CostKind, string> = {
  flights: 'voo',
  hotels: 'hospedagem',
  transports: 'transporte',
  meals: 'comida',
  activities: 'atividade',
};

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export type Cost = { bills: Bill[]; totalBRL: number };

export function costFor(data: TripData, kind: CostKind, code: string): Cost {
  const bills = data.bills.filter((b) => normalize(b.type) === BILL_TYPE[kind] && b.reference === code);
  const totalBRL = bills.reduce(
    (sum, b) => sum + (toBRL(b.amount, data.currencies.find((c) => c.symbol === b.currency)) ?? 0),
    0,
  );
  return { bills, totalBRL };
}
