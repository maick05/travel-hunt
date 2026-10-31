import { formatDateTime } from './format';
import { createPlaces, type Coord } from './places';
import type { TripData } from './use-travel-data';

export type MapItem = { title: string; time: string };
export type MapPoint = { lat: number; lng: number; emoji: string; items: MapItem[] };
export type LegKind = 'air' | 'road' | 'foot';
export type MapLeg = {
  kind: LegKind;
  emoji: string;
  from: [number, number];
  to: [number, number];
  label: string;
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CATEGORY_EMOJI: Record<string, string> = {
  aeroporto: '✈️',
  hotel: '🏨',
  passeio: '📸',
  gastronomia: '🍽️',
};

export function legStyle(mode: string): { kind: LegKind; emoji: string } {
  const m = norm(mode);
  if (m === 'aviao') return { kind: 'air', emoji: '✈️' };
  if (m === 'a pe') return { kind: 'foot', emoji: '🚶' };
  if (m === 'onibus') return { kind: 'road', emoji: '🚌' };
  if (m === 'metro' || m === 'trem') return { kind: 'road', emoji: '🚆' };
  if (m === 'bicicleta') return { kind: 'road', emoji: '🚲' };
  return { kind: 'road', emoji: '🚗' };
}

const keyOf = (c: Coord) => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`;

export function buildMap(data: TripData) {
  const { resolve } = createPlaces(data.locals);
  const points = new Map<string, MapPoint>();
  const legs: MapLeg[] = [];
  const missing: string[] = [];

  const addItem = (c: Coord, emoji: string, item: MapItem) => {
    const k = keyOf(c);
    const p = points.get(k) ?? { lat: c.lat, lng: c.lng, emoji, items: [] };
    p.items.push(item);
    points.set(k, p);
  };

  let prev: Coord | null = null;
  for (const a of data.activities) {
    const c = resolve(a.place)?.coord;
    if (!c) {
      if (!missing.includes(a.title)) missing.push(a.title);
      continue;
    }
    addItem(c, CATEGORY_EMOJI[norm(a.category)] ?? '📍', { title: a.title, time: formatDateTime(a.start) });

    if (prev && keyOf(prev) !== keyOf(c)) {
      legs.push({
        ...legStyle(a.transportMode),
        from: [prev.lat, prev.lng],
        to: [c.lat, c.lng],
        label: [a.transportMode, a.transportRef].filter(Boolean).join(' · ') || a.title,
      });
    }
    prev = c;
  }

  for (const f of data.flights) {
    const from = resolve(f.from)?.coord;
    const to = resolve(f.to)?.coord;
    const name = `${f.airline} ${f.flightNumber}`.trim();
    if (from) addItem(from, '✈️', { title: `Partida · ${name} → ${f.toAirport}`, time: formatDateTime(f.departure) });
    if (to) addItem(to, '✈️', { title: `Chegada · ${name} de ${f.fromAirport}`, time: formatDateTime(f.arrival) });
    if (from && to && keyOf(from) !== keyOf(to)) {
      legs.push({
        kind: 'air',
        emoji: '✈️',
        from: [from.lat, from.lng],
        to: [to.lat, to.lng],
        label: `${name}: ${f.fromAirport} → ${f.toAirport}`,
      });
    }
  }

  return { points: [...points.values()], legs, missing };
}
