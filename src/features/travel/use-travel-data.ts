import { useQuery } from '@tanstack/react-query';

import { loadTravelData, loadTravels, TRAVEL_CACHE_DURATION } from './repository';
import { assetKey } from './reserves';
import type { Tables } from './schema';

export function useTravels() {
  return useQuery({
    queryKey: ['travels'],
    queryFn: loadTravels,
    staleTime: (query) => query.state.data ? Math.max(0, query.state.data.fetchedAt + TRAVEL_CACHE_DURATION - query.state.dataUpdatedAt) : 0,
    refetchInterval: (query) => {
      if (!query.state.data) return false;
      const remaining = query.state.data.fetchedAt + TRAVEL_CACHE_DURATION - Date.now();
      return remaining > 0 ? remaining : 60_000;
    },
  });
}

export function useTravelData(name: string) {
  return useQuery({ queryKey: ['travel-data', name], queryFn: () => loadTravelData(name), enabled: !!name.trim(), staleTime: 60_000, structuralSharing: false });
}

export type TripData = Omit<Tables, 'travels'>;

const byTrip = <T extends { trip: string }>(items: T[], name: string) => items.filter((i) => i.trip === name);
const byDate = <T,>(items: T[], get: (i: T) => number | null) =>
  [...items].sort((a, b) => (get(a) ?? Infinity) - (get(b) ?? Infinity));

export function selectTrip(data: Tables, name: string): TripData {
  const bills = byTrip(data.bills, name);
  const assets = new Set(bills.flatMap((bill) => bill.valueReserve.map(assetKey)));
  return {
    activities: byDate(byTrip(data.activities, name), (a) => a.start),
    bills,
    flights: byDate(byTrip(data.flights, name), (f) => f.departure),
    hotels: byDate(byTrip(data.hotels, name), (h) => h.checkIn),
    meals: byDate(byTrip(data.meals, name), (m) => m.date),
    transports: byDate(byTrip(data.transports, name), (t) => t.departure),
    currencies: data.currencies,
    valueReserves: byDate(data.valueReserves.filter((reserve) => assets.has(assetKey(reserve.asset))), (reserve) => reserve.date),
    locals: data.locals,
    coords: data.coords,
  };
}
