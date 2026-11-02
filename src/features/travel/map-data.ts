import { formatDateTime, formatDuration } from './format';
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
  destination: string;
  duration: string;
  estimateDuration: boolean;
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
  const { resolve, cityOf } = createPlaces(data.locals);
  const points = new Map<string, MapPoint>();
  const legs: MapLeg[] = [];
  const missing: string[] = [];

  const addItem = (c: Coord, emoji: string, item: MapItem) => {
    const k = keyOf(c);
    const p = points.get(k) ?? { lat: c.lat, lng: c.lng, emoji, items: [] };
    p.items.push(item);
    points.set(k, p);
  };

  let prev: { coord: Coord; city: string } | null = null;
  for (const a of data.activities) {
    const c = resolve(a.place)?.coord;
    if (!c) {
      if (!missing.includes(a.title)) missing.push(a.title);
      prev = null;
      continue;
    }
    const category = norm(a.category);
    const emoji = category === 'transporte' && a.transportMode
      ? legStyle(a.transportMode).emoji
      : CATEGORY_EMOJI[category] ?? '📍';
    addItem(c, emoji, { title: a.title, time: formatDateTime(a.start) });

    const city = cityOf(a.place);
    const style = legStyle(a.transportMode);
    if (prev && city && norm(prev.city) === norm(city) && keyOf(prev.coord) !== keyOf(c) &&
      a.transportMode && !a.transportRef && style.kind !== 'air') {
      legs.push({
        ...style,
        from: [prev.coord.lat, prev.coord.lng],
        to: [c.lat, c.lng],
        label: a.transportMode,
        destination: a.title || resolve(a.place)?.name || a.place,
        duration: '',
        estimateDuration: style.kind === 'foot' || ['automovel', 'carro', 'taxi', 'uber'].includes(norm(a.transportMode)),
      });
    }
    prev = { coord: c, city };
  }

  for (const transport of data.transports) {
    const from = resolve(transport.from)?.coord;
    const to = resolve(transport.to)?.coord;
    if (from && to && keyOf(from) !== keyOf(to)) {
      legs.push({
        ...legStyle(transport.mode),
        from: [from.lat, from.lng],
        to: [to.lat, to.lng],
        label: [transport.mode, transport.details].filter(Boolean).join(' · '),
        destination: resolve(transport.to)?.name || transport.to,
        duration: formatDuration(transport.departure, transport.arrival),
        estimateDuration: ['a pe', 'automovel', 'carro', 'taxi', 'uber'].includes(norm(transport.mode)),
      });
    }
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
        destination: [f.toAirport, f.to].filter(Boolean).join(' · '),
        duration: formatDuration(f.departure, f.arrival),
        estimateDuration: false,
      });
    }
  }

  return { points: [...points.values()], legs, missing };
}
