import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IconName } from '@/components/brand';
import { ScreenBackground } from '@/components/screen-background';
import { ThemedText } from '@/components/themed-text';
import { BannerCard, Empty, Tabs } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { billToBRL, countdownLabel, formatBRL, formatDate } from '@/features/travel/format';
import { bannerSource } from '@/features/travel/places';
import {
    FlightsSection,
    FoodSection,
    HotelsSection,
    ItinerarySection,
    MoneySection,
    TransportSection,
} from '@/features/travel/sections';
import { tripBanner } from '@/features/travel/trip-banners';
import { selectTrip, useTravelData } from '@/features/travel/use-travel-data';

const TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'itinerary', label: 'Itinerário', icon: 'map-clock' },
  { key: 'flights', label: 'Voos', icon: 'airplane' },
  { key: 'hotels', label: 'Hospedagem', icon: 'bed' },
  { key: 'transport', label: 'Transporte', icon: 'car' },
  { key: 'food', label: 'Comida', icon: 'silverware-fork-knife' },
  { key: 'money', label: 'Financeiro', icon: 'wallet' },
];

type TabKey = 'itinerary' | 'flights' | 'hotels' | 'transport' | 'food' | 'money';

function TripBackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar para viagens"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={styles.backButton}>
      <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
    </Pressable>
  );
}

export default function TripScreen() {
  const { name = '' } = useLocalSearchParams<{ name: string }>();
  const { data, isLoading, error } = useTravelData();
  const [tab, setTab] = useState<TabKey>('itinerary');
  const [transportFocus, setTransportFocus] = useState<string>();

  const travel = data?.travels.find((t) => t.name === name);
  const trip = useMemo(() => (data ? selectTrip(data, name) : null), [data, name]);
  const totalBRL = trip ? trip.bills.reduce((sum, b) => sum + (billToBRL(b, trip.currencies) ?? 0), 0) : 0;

  return (
    <ScreenBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {(!trip || !travel || isLoading || error) && <TripBackButton />}
        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <ThemedText>{(error as Error).message}</ThemedText>
        ) : !trip || !travel ? (
          <Empty>Viagem não encontrada.</Empty>
        ) : (
          <>
            {(bannerSource(travel.banner) ?? tripBanner(travel.name)) ? (
              <BannerCard
                source={bannerSource(travel.banner) ?? tripBanner(travel.name)}
                title={travel.name}
                leading={<TripBackButton />}
                subtitle={`${formatDate(travel.startDate)} → ${formatDate(travel.endDate)}\n${countdownLabel(travel.startDate, travel.endDate)} · Total estimado: ${formatBRL(totalBRL)}`}
              />
            ) : (
              <View style={styles.hero}>
                <TripBackButton />
                <ThemedText type="small" style={styles.heroSub}>
                  {countdownLabel(travel.startDate, travel.endDate)}
                </ThemedText>
                <ThemedText type="title" style={styles.heroText}>
                  {travel.name}
                </ThemedText>
                <ThemedText style={styles.heroSub}>
                  {formatDate(travel.startDate)} → {formatDate(travel.endDate)}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.heroText}>
                  Total estimado: {formatBRL(totalBRL)}
                </ThemedText>
              </View>
            )}
            <Tabs tabs={TABS as { key: TabKey; label: string; icon: IconName }[]} value={tab} onChange={setTab} />
            {tab === 'itinerary' && (
              <ItinerarySection
                data={trip}
                onOpenTransport={(key) => {
                  setTransportFocus(key);
                  setTab('transport');
                }}
              />
            )}
            {tab === 'flights' && <FlightsSection data={trip} />}
            {tab === 'hotels' && <HotelsSection data={trip} />}
            {tab === 'transport' && <TransportSection data={trip} focusKey={transportFocus} />}
            {tab === 'food' && <FoodSection data={trip} />}
            {tab === 'money' && <MoneySection data={trip} />}
          </>
        )}
      </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(27,42,65,0.75)',
  },
  hero: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.one,
    backgroundColor: Colors.light.accent,
  },
  heroText: { color: '#FFFFFF' },
  heroSub: { color: 'rgba(255,255,255,0.85)' },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
