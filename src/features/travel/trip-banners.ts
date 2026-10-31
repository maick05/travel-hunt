import type { ImageSourcePropType } from 'react-native';

// Uma imagem por viagem em assets/trips/<id>.png. O Metro exige `require` est\u00e1tico: ao criar uma
// viagem nova, salve a imagem e acrescente a linha aqui.
const TRIP_BANNERS: Record<string, ImageSourcePropType> = {
  'eclipse-08-2027': require('../../../assets/trips/eclipse-08-2027.png'),
};

/** Identificador da viagem: o nome sem acentos, em min\u00fasculas e com h\u00edfens ("Eclipse 08/2027" \u2192 "eclipse-08-2027"). */
export function tripId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function tripBanner(name: string): ImageSourcePropType | undefined {
  return TRIP_BANNERS[tripId(name)];
}
