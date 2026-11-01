import { billToBRL } from './format';
import { createPlaces } from './places';
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
    (sum, b) => sum + (billToBRL(b, data.currencies) ?? 0),
    0,
  );
  return { bills, totalBRL };
}

export type CityCost = {
  city: string;
  totalBRL: number;
  bills: { bill: Bill; brl: number | null; share: number }[];
};

export const cityCostKey = (city: string) => normalize(city).replace(/\s+/g, ' ');

export function costsByCity(data: TripData): Map<string, CityCost> {
  const { cityOf } = createPlaces(data.locals);
  const totals = new Map<string, CityCost>();
  const add = (city: string, cost: Cost, share = 1) => {
    if (!cost.bills.length) return;
    const key = cityCostKey(city);
    const item = totals.get(key) ?? { city, totalBRL: 0, bills: [] };
    const value = cost.totalBRL * share;
    item.totalBRL += value;
    for (const bill of cost.bills) {
      const brl = billToBRL(bill, data.currencies);
      item.bills.push({ bill, brl: brl === null ? null : brl * share, share });
    }
    totals.set(key, item);
  };

  for (const activity of data.activities) add(cityOf(activity.place), costFor(data, 'activities', activity.code));
  for (const meal of data.meals) add(cityOf(meal.place), costFor(data, 'meals', meal.code));
  const seenHotels = new Set<string>();
  for (const hotel of data.hotels) {
    if (seenHotels.has(hotel.code)) continue;
    seenHotels.add(hotel.code);
    add(cityOf(hotel.link) || cityOf(hotel.city), costFor(data, 'hotels', hotel.code));
  }
  const legsByCode = new Map<string, TripData['flights']>();
  for (const flight of data.flights) legsByCode.set(flight.code, [...(legsByCode.get(flight.code) ?? []), flight]);
  for (const [code, legs] of legsByCode) {
    const cost = costFor(data, 'flights', code);
    for (const flight of legs) add(cityOf(flight.to), cost, 1 / legs.length);
  }
  const seenTransports = new Set<string>();
  for (const transport of data.transports) {
    if (seenTransports.has(transport.code)) continue;
    seenTransports.add(transport.code);
    add(cityOf(transport.to), costFor(data, 'transports', transport.code));
  }
  return totals;
}
