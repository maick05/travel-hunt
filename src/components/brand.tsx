import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

type Brand = { color: string; fg?: string; logo?: ImageSourcePropType; icon?: IconName };

// Marcas com `logo` mostram a imagem; as demais ganham um selo com a cor e a inicial.
const BRANDS: Record<string, Brand> = {
  avianca: { color: '#E1251B', logo: require('@/assets/brands/avianca.png') },
  latam: { color: '#B3003C' },
  gol: { color: '#FF7A1A' },
  azul: { color: '#1F5CC6' },
  tap: { color: '#0E8A5F' },
  iberia: { color: '#D7192D' },
  smiles: { color: '#F7941D' },
  booking: { color: '#1A4FA3' },
  airbnb: { color: '#FF5A5F' },
  decolar: { color: '#7C3AED' },
  expedia: { color: '#FFC72C', fg: '#1B2A41' },
  'conducao propria': { color: '#356B55', icon: 'steering' },
  flixbus: { color: '#73D700', logo: require('@/assets/brands/flixbus.png') },
  uber: { color: '#1B1B1B', logo: require('@/assets/brands/uber.png') },
  '99': { color: '#FFD400', fg: '#1B2A41' },
  cabify: { color: '#7B3FF2' },
};

export function BrandBadge({ name, size = 40 }: { name: string; size?: number }) {
  if (!name) return null;
  const brand = BRANDS[norm(name)] ?? { color: '#8FA3BF' };
  if (brand.logo) {
    return (
      <View style={[styles.badge, styles.logoBox, { width: size, height: size, borderRadius: size / 3 }]}>
        <Image source={brand.logo} style={{ width: size * 0.8, height: size * 0.8 }} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 3, backgroundColor: brand.color }]}>
      {brand.icon ? (
        <MaterialCommunityIcons name={brand.icon} size={size * 0.6} color={brand.fg ?? '#FFFFFF'} />
      ) : (
        <ThemedText type="smallBold" style={{ color: brand.fg ?? '#FFFFFF', fontSize: size * 0.45 }}>
          {name.trim().charAt(0).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

const MODE_ICONS: Record<string, IconName> = {
  aviao: 'airplane',
  automovel: 'car',
  carro: 'car',
  taxi: 'taxi',
  uber: 'car',
  'a pe': 'walk',
  onibus: 'bus',
  metro: 'subway-variant',
  trem: 'train',
  barco: 'ferry',
  bicicleta: 'bicycle',
};

export function modeIcon(mode: string): IconName {
  return MODE_ICONS[norm(mode)] ?? 'map-marker-path';
}

export function mealIcon(type: string): IconName {
  const t = norm(type);
  if (t.includes('cafe')) return 'coffee';
  if (t.includes('almoco')) return 'silverware-fork-knife';
  if (t.includes('lanche')) return 'cookie';
  if (t.includes('janta') || t.includes('jantar')) return 'noodles';
  return 'food';
}

export function categoryIcon(category: string): IconName {
  const c = norm(category);
  if (c.includes('aeroporto')) return 'airplane-takeoff';
  if (c.includes('traslado')) return 'map-marker';
  if (c.includes('hotel')) return 'bed';
  if (c.includes('passeio')) return 'camera';
  if (c.includes('gastronomia')) return 'silverware-fork-knife';
  return 'map-marker';
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  logoBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFCFE6' },
});
