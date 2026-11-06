import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ScreenBackground } from '@/components/screen-background';
import { ThemedText } from '@/components/themed-text';
import { BannerCard, Card, Empty, IconBubble } from '@/components/ui';
import { isSheetsConfigured } from '@/config/env';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { countdownLabel, formatDate } from '@/features/travel/format';
import { bannerSource } from '@/features/travel/places';
import { tripBanner } from '@/features/travel/trip-banners';
import { useTravels } from '@/features/travel/use-travel-data';
import { canEdit, enableEditing, USE_REMOTE } from '@/services/remote';

export default function TripsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useTravels();
  const [editing, setEditing] = useState(canEdit());
  const [showRole, setShowRole] = useState(false);
  const [role, setRole] = useState('');
  const [roleError, setRoleError] = useState('');

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Viagens</ThemedText>
        {USE_REMOTE && !editing && (showRole ? (
          <View style={styles.list}>
            <TextInput value={role} onChangeText={setRole} secureTextEntry autoCapitalize="none" placeholder="MD5 de edição" style={styles.roleInput} />
            {roleError ? <ThemedText>{roleError}</ThemedText> : null}
            <Pressable onPress={async () => { try { await enableEditing(role); await queryClient.invalidateQueries({ queryKey: ['travel-data'] }); setRole(''); setEditing(true); } catch (e) { setRoleError((e as Error).message); } }}>
              <ThemedText type="link">Habilitar edição</ThemedText>
            </Pressable>
          </View>
        ) : <Pressable onPress={() => setShowRole(true)}><ThemedText type="link">Habilitar edição</ThemedText></Pressable>)}
        {!isSheetsConfigured && !USE_REMOTE && (
          <ThemedText type="small" themeColor="textSecondary">
            Exibindo dados de exemplo. Configure EXPO_PUBLIC_SHEETS_ID e EXPO_PUBLIC_SHEETS_API_KEY para usar sua planilha.
          </ThemedText>
        )}

        {isLoading ? (
          <ActivityIndicator />
        ) : error ? (
          <View style={styles.list}>
            <ThemedText>{(error as Error).message}</ThemedText>
            <Pressable onPress={() => refetch()}>
              <ThemedText type="link">Tentar novamente</ThemedText>
            </Pressable>
          </View>
        ) : !data?.travels.length ? (
          <Empty>Nenhuma viagem cadastrada.</Empty>
        ) : (
          <View style={styles.list}>
            {data.travels.map((t) => (
              <Link key={t.name} href={{ pathname: '/trip', params: { name: t.name } }} asChild>
                <Pressable style={({ pressed }) => pressed && styles.pressed}>
                  {(bannerSource(t.banner) ?? tripBanner(t.name)) ? (
                    <BannerCard
                      source={bannerSource(t.banner) ?? tripBanner(t.name)}
                      title={t.name}
                      subtitle={`${formatDate(t.startDate)} → ${formatDate(t.endDate)} · ${countdownLabel(t.startDate, t.endDate)}`}
                    />
                  ) : (
                    <Card>
                      <View style={styles.row}>
                        <IconBubble name="airplane-takeoff" size={48} />
                        <View style={styles.flex}>
                          <ThemedText type="subtitle">{t.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {formatDate(t.startDate)} → {formatDate(t.endDate)}
                          </ThemedText>
                          <ThemedText type="smallBold" themeColor="accent">
                            {countdownLabel(t.startDate, t.endDate)}
                          </ThemedText>
                        </View>
                      </View>
                    </Card>
                  )}
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  list: { gap: Spacing.two },
  pressed: { opacity: 0.85 },
  roleInput: { borderWidth: 1, borderColor: '#B9C1C3', borderRadius: 4, padding: 10, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});
