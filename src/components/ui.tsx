import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as flags from 'country-flag-icons/string/3x2';
import { Image } from 'expo-image';
import countryNames from 'i18n-iso-countries/langs/pt.json';
import { useState } from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { IconName } from '@/components/brand';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import type { Cost } from '@/features/travel/costs';
import {
  billToBRL,
  feesNote,
  formatAmount,
  formatBRL,
  mapsUrl,
  rateNote,
  statusTone,
  type StatusTone,
} from '@/features/travel/format';
import { bannerSource, isLink, placeLabel } from '@/features/travel/places';
import type { Currency } from '@/features/travel/schema';

const c = Colors.light;

const normalizeCountry = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const countryCodes = new Map(
  Object.entries(countryNames.countries).flatMap(([code, names]) =>
    (Array.isArray(names) ? names : [names]).map((name) => [normalizeCountry(name), code] as const),
  ),
);

function CountryFlag({ country }: { country?: string }) {
  if (!country) return null;
  const code = countryCodes.get(normalizeCountry(country)) ?? country.trim().toUpperCase();
  const svg = (flags as Record<string, string>)[code];
  if (!svg) return null;
  if (Platform.OS === 'web') {
    return <Image source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width: 24, height: 16 }} accessibilityLabel={`Bandeira: ${country}`} />;
  }
  return (
    <View accessible accessibilityLabel={`Bandeira: ${country}`}>
      <SvgXml xml={svg} width={24} height={16} />
    </View>
  );
}

export function Card({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/** Cartão que abre/fecha os detalhes ao toque. */
export function ExpandCard({
  header,
  children,
  defaultOpen = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card onPress={() => setOpen((o) => !o)}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>{header}</View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.textSecondary} />
      </View>
      {open && <View style={styles.details}>{children}</View>}
    </Card>
  );
}

/** Cabeçalho em forma de banner: foto de fundo com título e subtítulo em branco. */
export function BannerCard({
  source,
  title,
  subtitle,
  trailing,
  leading,
  country,
  compact = false,
}: {
  source: ImageSourcePropType | undefined;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  country?: string;
  /** Versão menor, para subdivisões (ex.: cidade dentro da viagem). */
  compact?: boolean;
}) {
  return (
    <View style={[styles.banner, compact && styles.bannerCompact]}>
      <ImageBackground source={source ?? {}} resizeMode="cover" style={styles.bannerImage}>
        <View style={[styles.bannerOverlay, !!leading && styles.bannerOverlayLeading]}>
          {leading ? <View style={styles.bannerLeading}>{leading}</View> : null}
          {country ? <View style={styles.bannerFlag}><CountryFlag country={country} /></View> : null}
          <View style={[styles.flex, !!country && styles.bannerContentWithFlag]}>
            <ThemedText type={compact ? 'subtitle' : 'title'} style={styles.bannerText}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" style={styles.bannerText}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {trailing}
        </View>
      </ImageBackground>
    </View>
  );
}

export function Accordion({
  title,
  subtitle,
  icon = 'city',
  defaultOpen = false,
  sub = false,
  banner,
  country,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  defaultOpen?: boolean;
  /** Segundo nível: visual menor, usado dentro de outro accordion. */
  sub?: boolean;
  /** URL de imagem: o cabeçalho vira um banner com o título sobre a foto. */
  banner?: string;
  country?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const chevron = open ? 'chevron-up' : 'chevron-down';

  if (banner && !sub) {
    return (
      <View style={[styles.accordion, styles.accordionLevel]}>
        <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => pressed && styles.pressed}>
          <BannerCard
            compact
            source={bannerSource(banner)}
            title={title}
            subtitle={subtitle}
            country={country}
            trailing={<MaterialCommunityIcons name={chevron} size={24} color="#FFFFFF" />}
          />
        </Pressable>
        {open && <View style={styles.accordionBody}>{children}</View>}
      </View>
    );
  }

  return (
    <View style={[styles.accordion, !sub && styles.accordionLevel]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.accordionHeader, sub && styles.accordionHeaderSub, pressed && styles.pressed]}>
        <IconBubble name={icon} size={sub ? 32 : 40} />
        <View style={styles.flex}>
          <ThemedText type={sub ? 'smallBold' : 'subtitle'} style={sub ? undefined : styles.accordionTitle}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <CountryFlag country={country} />
        <MaterialCommunityIcons name={chevron} size={24} color={c.textSecondary} />
      </Pressable>
      {open && <View style={[styles.accordionBody, sub && styles.accordionBodySub]}>{children}</View>}
    </View>
  );
}

export function IconBubble({ name, color = c.accent, bg = c.accentSoft, size = 40 }: {
  name: IconName;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 3, backgroundColor: bg }]}>
      <MaterialCommunityIcons name={name} size={size * 0.55} color={color} />
    </View>
  );
}

const toneColors: Record<StatusTone, { bg: string; fg: string }> = {
  good: { bg: '#D9F5E5', fg: '#147A3F' },
  warn: { bg: '#FFEFD0', fg: '#9A5B00' },
  neutral: { bg: '#E8EDF5', fg: '#4B5A70' },
};

export function StatusBadge({ status, colors }: { status: string; colors?: { bg: string; fg: string } }) {
  if (!status) return null;
  const { bg, fg } = colors ?? toneColors[statusTone(status)];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText type="smallBold" style={{ color: fg, fontSize: 12, lineHeight: 16 }}>
        {status}
      </ThemedText>
    </View>
  );
}

/** Valor total em R$ da reserva; some se não há lançamento no Financeiro. */
export function CostTag({ cost }: { cost: Cost }) {
  if (!cost.bills.length) return null;
  return (
    <View style={styles.costTag}>
      <MaterialCommunityIcons name="cash" size={16} color="#147A3F" />
      <ThemedText type="smallBold" style={{ color: '#147A3F' }}>
        {formatBRL(cost.totalBRL)}
      </ThemedText>
    </View>
  );
}

export function CostLines({ cost, currencies }: { cost: Cost; currencies: Currency[] }) {
  if (!cost.bills.length) return <ThemedText type="small" themeColor="textSecondary">Sem valor lançado.</ThemedText>;
  return (
    <View style={styles.costBox}>
      {cost.bills.map((b, i) => {
        const currency = currencies.find((x) => x.symbol === b.currency);
        const brl = billToBRL(b, currencies);
        return (
          <View key={`${b.description}-${i}`} style={styles.costLine}>
            <View style={styles.flex}>
              <ThemedText type="small">{b.description}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatAmount(b.amount, currency, b.currency)}
                {b.person ? ` · ${b.person}` : ''}
                {rateNote(b) || feesNote(b, currencies) ? ` · ${rateNote(b) || feesNote(b, currencies)}` : ''}
              </ThemedText>
              <FileLink url={b.receipt} label="Comprovante" />
            </View>
            <View style={styles.costRight}>
              {brl !== null && <ThemedText type="smallBold">{formatBRL(brl)}</ThemedText>}
              <StatusBadge status={b.status} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Botão para abrir o PDF da reserva (link do Drive) em nova aba; some se a célula não tiver link. */
export function FileLink({ url, label = 'Reserva (PDF)' }: { url: string; label?: string }) {
  if (!isLink(url)) return null;
  return (
    <ExternalLink href={url.trim() as never}>
      <ThemedText type="small" style={styles.link}>
        <MaterialCommunityIcons name="file-pdf-box" size={16} color={c.accent} /> {label}
      </ThemedText>
    </ExternalLink>
  );
}

export function PlaceLink({ place }: { place: string }) {
  if (!place) return null;
  const url = isLink(place) ? place.trim() : mapsUrl(place);
  return (
    <ExternalLink href={url as never}>
      <ThemedText type="small" style={styles.link}>
        <MaterialCommunityIcons name="map-marker" size={14} color={c.accent} /> {placeLabel(place)}
      </ThemedText>
    </ExternalLink>
  );
}

export function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {label}: <ThemedText type="small">{value}</ThemedText>
    </ThemedText>
  );
}

export function Heading({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>
      {children}
    </ThemedText>
  );
}

export function Empty({ children = 'Nada cadastrado.' }: { children?: string }) {
  return <ThemedText themeColor="textSecondary">{children}</ThemedText>;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  secondary = false,
}: {
  tabs: { key: T; label: string; icon: IconName }[];
  value: T;
  onChange: (key: T) => void;
  secondary?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, secondary && styles.tabsSecondary]}>
      {tabs.map((t) => {
        const active = t.key === value;
        const color = secondary ? (active ? c.text : c.textSecondary) : (active ? '#FFFFFF' : c.text);
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={secondary
              ? [styles.tab, styles.tabSecondary, active && styles.tabSecondaryActive]
              : [styles.tab, active ? { backgroundColor: c.accent } : styles.tabIdle]}>
            <MaterialCommunityIcons name={t.icon} size={18} color={secondary ? color : (active ? '#FFFFFF' : c.textSecondary)} />
            <ThemedText type="smallBold" style={{ color }}>
              {t.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.one },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    backgroundColor: c.backgroundElement,
    borderWidth: 1,
    borderColor: c.border,
    boxShadow: '0 2px 8px rgba(40, 80, 160, 0.18)',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  accordion: { gap: Spacing.two },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: c.accentSoft,
  },
  accordionTitle: { fontSize: 22, lineHeight: 28 },
  banner: { minHeight: 150, borderRadius: Spacing.three, overflow: 'hidden', backgroundColor: c.accentSoft },
  bannerImage: { flex: 1 },
  bannerCompact: { minHeight: 84 },
  // Subdivisão da viagem: recuada e com uma linha de destaque à esquerda.
  accordionLevel: { marginLeft: Spacing.three, paddingLeft: Spacing.two, borderLeftWidth: 3, borderLeftColor: c.accent },
  bannerOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  bannerText: { color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bannerFlag: { position: 'absolute', top: Spacing.three, right: Spacing.three },
  bannerContentWithFlag: { paddingRight: 28 },
  bannerOverlayLeading: { paddingTop: 68 },
  bannerLeading: { position: 'absolute', top: Spacing.two, left: Spacing.two },
  accordionBody: { gap: Spacing.two },
  accordionHeaderSub: { padding: Spacing.two, backgroundColor: c.backgroundElement, borderWidth: 1, borderColor: c.border },
  accordionBodySub: { paddingLeft: Spacing.two, borderLeftWidth: 2, borderLeftColor: c.accentSoft },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  details: { gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: c.border },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: 99 },
  costTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 99,
    backgroundColor: '#D9F5E5',
  },
  costBox: { gap: Spacing.two },
  costLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  costRight: { alignItems: 'flex-end', gap: Spacing.one },
  link: { color: c.accent },
  heading: { textTransform: 'uppercase', marginTop: Spacing.two },
  tabs: { gap: Spacing.two, paddingVertical: Spacing.one },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 99,
  },
  tabIdle: { backgroundColor: c.backgroundElement, borderWidth: 1, borderColor: c.border },
  tabsSecondary: { alignSelf: 'flex-start', gap: Spacing.half, padding: Spacing.half, borderRadius: Spacing.two, backgroundColor: '#C6D6EE' },
  tabSecondary: { minHeight: 44, borderRadius: 6, paddingVertical: Spacing.one },
  tabSecondaryActive: { backgroundColor: c.backgroundElement },
});
