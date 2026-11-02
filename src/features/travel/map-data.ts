import { formatDateTime, formatDuration } from './format';
import { createPlaces, type Coord } from './places';
import type { TripData } from './use-travel-data';

export type MapItem = { title: string; time: string };
export type MapPoint = { lat: number; lng: number; emoji: string; priority: number; items: MapItem[] };
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
  priority: number;
  departure: number | null;
  arrival: number | null;
  departureEstimated: boolean;
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const PRIORITY = { other: 0, route: 1, sightseeing: 2, transport: 3, airport: 4, flight: 5, origin: 6, finalAirport: 7 } as const;

const CATEGORY_EMOJI: Record<string, string> = {
  aeroporto: '🛫',
  traslado: '📍',
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

  const addItem = (c: Coord, emoji: string, priority: number, item: MapItem) => {
    const k = keyOf(c);
    const p = points.get(k) ?? { lat: c.lat, lng: c.lng, emoji, priority, items: [] };
    if (priority > p.priority) {
      p.emoji = emoji;
      p.priority = priority;
    }
    p.items.push(item);
    points.set(k, p);
  };

  let prev: { coord: Coord; city: string; end: number | null } | null = null;
  const lastActivity = data.activities[data.activities.length - 1];
  for (const a of data.activities) {
    const c = resolve(a.place)?.coord;
    if (!c) {
      if (!missing.includes(a.title)) missing.push(a.title);
      prev = null;
      continue;
    }
    const category = norm(a.category);
    const ownTransport = a.transportRef && data.transports.some((transport) =>
      norm(transport.details) === norm(a.transportRef) && norm(transport.platform) === 'conducao propria');
    const finalAirport = a === lastActivity && category === 'aeroporto';
    const emoji = finalAirport ? '🛬'
      : ownTransport && (category === 'transporte' || category === 'traslado')
      ? '🚙'
      : category === 'transporte' && a.transportMode
      ? legStyle(a.transportMode).emoji
      : CATEGORY_EMOJI[category] ?? '📍';
    const priority = finalAirport ? PRIORITY.finalAirport
      : category === 'aeroporto' ? PRIORITY.airport
      : category === 'transporte' || category === 'traslado' ? PRIORITY.transport
      : category === 'passeio' ? PRIORITY.sightseeing
      : PRIORITY.other;
    addItem(c, emoji, priority, { title: a.title, time: formatDateTime(a.start) });

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
        priority: PRIORITY.route,
        departure: prev.end !== null && a.start !== null && prev.end <= a.start ? prev.end : null,
        arrival: null,
        departureEstimated: true,
      });
    }
    prev = { coord: c, city, end: a.end };
  }

  for (const transport of data.transports) {
    const from = resolve(transport.from)?.coord;
    const to = resolve(transport.to)?.coord;
    if (from && to && keyOf(from) !== keyOf(to)) {
      const style = legStyle(transport.mode);
      legs.push({
        ...style,
        emoji: norm(transport.platform) === 'conducao propria' ? '🚙' : style.emoji,
        from: [from.lat, from.lng],
        to: [to.lat, to.lng],
        label: [transport.mode, transport.details].filter(Boolean).join(' · '),
        destination: resolve(transport.to)?.name || transport.to,
        duration: formatDuration(transport.departure, transport.arrival),
        estimateDuration: ['a pe', 'automovel', 'carro', 'taxi', 'uber'].includes(norm(transport.mode)),
        priority: style.kind === 'air' ? PRIORITY.flight : PRIORITY.route,
        departure: transport.departure,
        arrival: transport.arrival,
        departureEstimated: false,
      });
    }
  }

  for (const f of data.flights) {
    const from = resolve(f.from)?.coord;
    const to = resolve(f.to)?.coord;
    const name = `${f.airline} ${f.flightNumber}`.trim();
    if (from) addItem(from, CATEGORY_EMOJI.aeroporto, PRIORITY.flight, { title: `Partida · ${name} → ${f.toAirport}`, time: formatDateTime(f.departure) });
    if (to) addItem(to, CATEGORY_EMOJI.aeroporto, PRIORITY.flight, { title: `Chegada · ${name} de ${f.fromAirport}`, time: formatDateTime(f.arrival) });
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
        priority: PRIORITY.flight,
        departure: f.departure,
        arrival: f.arrival,
        departureEstimated: false,
      });
    }
  }

  let origin: { coord: Coord; time: number | null } | null = null;
  const considerOrigin = (place: string, time: number | null) => {
    const coord = resolve(place)?.coord;
    if (coord && (!origin || (time !== null && (origin.time === null || time < origin.time)))) {
      origin = { coord, time };
    }
  };
  for (const flight of data.flights) considerOrigin(flight.from, flight.departure);
  for (const transport of data.transports) considerOrigin(transport.from, transport.departure);
  for (const activity of data.activities) considerOrigin(activity.place, activity.start);
  if (origin) {
    const start = origin as { coord: Coord; time: number | null };
    addItem(start.coord, '🚩', PRIORITY.origin, { title: 'Início da viagem', time: formatDateTime(start.time) });
  }

  return { points: [...points.values()], legs, missing };
}
