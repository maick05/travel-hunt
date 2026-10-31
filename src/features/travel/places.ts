import type { ImageSourcePropType } from 'react-native';

import banners from './banners.generated.json';
import { DRIVE_IMAGES } from './drive-images.generated';
import resolved from './places.generated.json';
import type { Tables } from './schema';

export type Coord = { lat: number; lng: number };
export type Place = { name: string; coord: Coord };

const RESOLVED = resolved as Record<string, { name: string; lat: number; lng: number }>;
const BANNER_FILES = banners as Record<string, string>;

const MAX_CITY_KM = 150;

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const isLink = (s: string) => /^https?:\/\//i.test(s.trim());

/**
 * Valor da coluna Banner: URL direta, link do Google Drive ou o nome de um arquivo do Drive.
 * Imagens do Drive são baixadas para assets/banners por scripts/resolve-places.mjs, porque o Drive
 * bloqueia hotlink; assim o Metro as empacota e serve em qualquer caminho base e plataforma.
 */
export function bannerSource(value: string): ImageSourcePropType | undefined {
  const v = value.trim();
  if (!isLink(v)) return BANNER_FILES[v] ? bannerSource(BANNER_FILES[v]) : undefined;
  const driveId = /drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?[^#]*?id=)([\w-]+)/.exec(v)?.[1];
  if (!driveId) return { uri: v };
  return DRIVE_IMAGES[driveId];
}

/** Link do Maps já resolvido para nome e coordenadas (feito no build por scripts/resolve-places.mjs). */
export function lookupLink(link: string): Place | undefined {
  const r = RESOLVED[link.trim()];
  return r ? { name: r.name, coord: { lat: r.lat, lng: r.lng } } : undefined;
}

/** Texto para exibir de um "Local": o nome do lugar se for link, senão o próprio texto. */
export function placeLabel(ref: string): string {
  return isLink(ref) ? (lookupLink(ref)?.name ?? 'Abrir no Maps') : ref;
}

function distanceKm(a: Coord, b: Coord): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Cada linha da aba Locals é uma cidade com um link do Maps que serve de âncora:
 * um lugar pertence à cidade cuja âncora está mais perto (até MAX_CITY_KM).
 */
export function createPlaces(locals: Tables['locals']) {
  const anchors = locals.flatMap((l) => {
    const place = lookupLink(l.link);
    return place ? [{ city: l.name, coord: place.coord }] : [];
  });
  const byName = new Map(anchors.map((a) => [norm(a.city), a]));
  const banners = new Map(locals.filter((l) => l.banner).map((l) => [norm(l.name), l.banner]));

  /** Aceita link do Maps ou nome de cidade da aba Locals. */
  function resolve(ref: string): Place | undefined {
    if (!ref) return undefined;
    if (isLink(ref)) return lookupLink(ref);
    const a = byName.get(norm(ref));
    return a ? { name: a.city, coord: a.coord } : undefined;
  }

  function cityOf(ref: string): string {
    if (ref && !isLink(ref)) return ref;
    const coord = resolve(ref)?.coord;
    if (!coord) return '';
    let best = { city: '', km: MAX_CITY_KM };
    for (const a of anchors) {
      const km = distanceKm(coord, a.coord);
      if (km < best.km) best = { city: a.city, km };
    }
    return best.city;
  }

  /** Imagem de banner da cidade (coluna Banner da aba Locals), se houver. */
  function bannerOf(city: string): string | undefined {
    return banners.get(norm(city));
  }

  return { resolve, cityOf, bannerOf };
}
