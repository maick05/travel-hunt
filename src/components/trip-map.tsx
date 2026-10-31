'use dom';

import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';

import type { MapLeg, MapPoint } from '@/features/travel/map-data';

const COLORS = { air: '#4F8DF7', road: '#F59E42', foot: '#34C28A' } as const;
const HEIGHT = 520;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

type LatLng = [number, number];

/** Rota por estrada/calçada via OSRM; devolve null se o serviço falhar. */
async function route(leg: MapLeg, signal: AbortSignal): Promise<LatLng[] | null> {
  const base =
    leg.kind === 'foot'
      ? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
      : 'https://router.project-osrm.org/route/v1/driving';
  const coords = `${leg.from[1]},${leg.from[0]};${leg.to[1]},${leg.to[0]}`;
  try {
    const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] } }[] };
    const line = json.routes?.[0]?.geometry.coordinates;
    return line ? line.map(([lng, lat]) => [lat, lng]) : null;
  } catch {
    return null;
  }
}

export default function TripMap({
  points,
  legs,
}: {
  points: MapPoint[];
  legs: MapLeg[];
  dom?: import('expo/dom').DOMProps;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify({ points, legs });

  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    const abort = new AbortController();
    const data = JSON.parse(signature) as { points: MapPoint[]; legs: MapLeg[] };

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !ref.current) return;

      const m = L.map(ref.current);
      map = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(m);

      const pin = (latlng: LatLng, emoji: string, popup: string, small = false) =>
        L.marker(latlng, {
          icon: L.divIcon({
            className: '',
            html: `<div class="tm-pin${small ? ' tm-small' : ''}">${emoji}</div>`,
            iconSize: small ? [28, 28] : [38, 38],
            iconAnchor: small ? [14, 14] : [19, 19],
          }),
        })
          .bindPopup(popup)
          .addTo(m);

      const bounds: LatLng[] = [];

      for (const p of data.points) {
        const list = p.items.map((i) => `<div><b>${esc(i.time)}</b> ${esc(i.title)}</div>`).join('');
        pin([p.lat, p.lng], p.emoji, list);
        bounds.push([p.lat, p.lng]);
      }

      const drawLeg = async (leg: MapLeg) => {
        const style = { color: COLORS[leg.kind], weight: 4, opacity: 0.85 };
        const straight: LatLng[] = [leg.from, leg.to];
        let path = straight;
        let options: import('leaflet').PolylineOptions = leg.kind === 'air' ? { ...style, dashArray: '4 10' } : style;

        if (leg.kind !== 'air') {
          const routed = await route(leg, abort.signal);
          if (cancelled) return;
          if (routed && routed.length > 1) {
            path = routed;
            if (leg.kind === 'foot') options = { ...style, dashArray: '2 8' };
          } else {
            options = { ...style, dashArray: '4 10', opacity: 0.5 };
          }
        }

        L.polyline(path, options).addTo(m);
        const mid = path[Math.floor(path.length / 2)];
        pin(mid, leg.emoji, esc(leg.label), true);
        bounds.push(...path);
      };

      await Promise.all(data.legs.map(drawLeg));
      if (cancelled) return;

      if (bounds.length) m.fitBounds(bounds, { padding: [40, 40] });
      else m.setView([0, 0], 2);
    })();

    return () => {
      cancelled = true;
      abort.abort();
      map?.remove();
    };
  }, [signature]);

  return (
    <>
      <style>{`
        .tm-pin { width: 38px; height: 38px; border-radius: 50%; background: #fff; border: 2px solid #4F8DF7;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
          box-shadow: 0 2px 8px rgba(40, 80, 160, 0.3); }
        .tm-small { width: 28px; height: 28px; font-size: 15px; border-width: 1px; }
      `}</style>
      <div ref={ref} style={{ width: '100%', height: HEIGHT, borderRadius: 16, overflow: 'hidden' }} />
    </>
  );
}
