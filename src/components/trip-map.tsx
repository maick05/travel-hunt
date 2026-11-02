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
async function route(leg: MapLeg, signal: AbortSignal): Promise<{ path: LatLng[]; distance: number; duration: number } | null> {
  const base =
    leg.kind === 'foot'
      ? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
      : 'https://router.project-osrm.org/route/v1/driving';
  const coords = `${leg.from[1]},${leg.from[0]};${leg.to[1]},${leg.to[0]}`;
  try {
    const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
    const result = json.routes?.[0];
    return result ? { path: result.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distance: result.distance, duration: result.duration } : null;
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

      const pin = (latlng: LatLng, emoji: string, popup: string, priority: number, small = false) =>
        L.marker(latlng, {
          zIndexOffset: priority * 10000,
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
        pin([p.lat, p.lng], p.emoji, list, p.priority);
        bounds.push([p.lat, p.lng]);
      }

      const drawLeg = async (leg: MapLeg) => {
        const style = { color: COLORS[leg.kind], weight: 4, opacity: 0.85 };
        const straight: LatLng[] = [leg.from, leg.to];
        let path = straight;
        let distance = m.distance(leg.from, leg.to);
        let routedDuration: number | null = null;
        let isRouted = false;
        let options: import('leaflet').PolylineOptions = leg.kind === 'air' ? { ...style, dashArray: '4 10' } : style;

        if (leg.kind !== 'air') {
          const routed = await route(leg, abort.signal);
          if (cancelled) return;
          if (routed && routed.path.length > 1 && Number.isFinite(routed.distance)) {
            path = routed.path;
            distance = routed.distance;
            routedDuration = Number.isFinite(routed.duration) ? routed.duration : null;
            isRouted = true;
            if (leg.kind === 'foot') options = { ...style, dashArray: '2 8' };
          } else {
            options = { ...style, dashArray: '4 10', opacity: 0.5 };
          }
        }

        L.polyline(path, options).addTo(m);
        const mid: LatLng = path.length === 2
          ? [(path[0][0] + path[1][0]) / 2, (path[0][1] + path[1][1]) / 2]
          : path[Math.floor(path.length / 2)];
        const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(distance / 1000);
        const minutes = routedDuration === null ? null : Math.max(1, Math.round(routedDuration / 60));
        const estimatedTime = minutes === null ? '' : [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : '', minutes % 60 ? `${minutes % 60}min` : ''].filter(Boolean).join(' ');
        const time = leg.duration
          ? `Intervalo dos horários: ${leg.duration}${leg.kind === 'air' ? ' (sem ajuste de fuso)' : ''}`
          : leg.estimateDuration && estimatedTime ? `Tempo estimado: ${estimatedTime}` : 'Tempo indisponível';
        const details = [leg.label, `Destino: ${leg.destination}`, `${isRouted ? 'Distância' : 'Distância em linha reta'}: ${km} km`, time];
        pin(mid, leg.emoji, details.map((detail) => `<div>${esc(detail)}</div>`).join(''), leg.priority, true);
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
