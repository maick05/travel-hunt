import { useQuery } from '@tanstack/react-query';

import { loadTravelData } from './repository';
import type { Tables } from './schema';

export function useTravelData() {
  return useQuery({ queryKey: ['travel-data'], queryFn: loadTravelData, staleTime: 60_000 });
}

export type TripData = Omit<Tables, 'travels'>;

const byTrip = <T extends { trip: string }>(items: T[], name: string) => items.filter((i) => i.trip === name);
const byDate = <T,>(items: T[], get: (i: T) => number | null) =>
  [...items].sort((a, b) => (get(a) ?? Infinity) - (get(b) ?? Infinity));

export function selectTrip(data: Tables, name: string): TripData {
  return {
    activities: byDate(byTrip(data.activities, name), (a) => a.start),
    bills: byTrip(data.bills, name),
    flights: byDate(byTrip(data.flights, name), (f) => f.departure),
    hotels: byDate(byTrip(data.hotels, name), (h) => h.checkIn),
    meals: byDate(byTrip(data.meals, name), (m) => m.date),
    transports: byDate(byTrip(data.transports, name), (t) => t.departure),
    currencies: data.currencies,
    valueReserves: byDate(data.valueReserves, (reserve) => reserve.date),
    locals: data.locals,
    coords: data.coords,
  };
}
