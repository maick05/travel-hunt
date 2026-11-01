import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandBadge, categoryIcon, mealIcon, modeIcon, type IconName } from '@/components/brand';
import { PieChart, type ChartItem } from '@/components/charts';
import { ThemedText } from '@/components/themed-text';
import TripMap from '@/components/trip-map';
import {
    Accordion,
    Card,
    CostLines,
    CostTag,
    Empty,
    ExpandCard,
    Field,
    FileLink,
    IconBubble,
    PlaceLink,
    StatusBadge,
    Tabs
} from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { costFor } from './costs';
import {
    billToBRL,
    dayKey,
    formatAmount,
    formatBRL,
    formatDate,
    formatDateTime,
    formatDayHeading,
    formatDuration,
    formatTime,
    rateNote,
    statusTone,
} from './format';
import { buildMap } from './map-data';
import { createPlaces, placeLabel } from './places';
import type { Flight } from './schema';
import type { TripData } from './use-travel-data';

type ItineraryView = 'list' | 'map';
const VIEWS: { key: ItineraryView; label: string; icon: IconName }[] = [
  { key: 'list', label: 'Lista', icon: 'format-list-bulleted' },
  { key: 'map', label: 'Mapa', icon: 'map' },
];

export function ItinerarySection({
  data,
  onOpenTransport,
}: {
  data: TripData;
  onOpenTransport?: (key: string) => void;
}) {
  const [view, setView] = useState<ItineraryView>('list');

  if (!data.activities.length) return <Empty />;

  return (
    <View style={styles.list}>
      <Tabs tabs={VIEWS} value={view} onChange={setView} />
      {view === 'map' ? (
        <ItineraryMap data={data} />
      ) : (
        <ItineraryList data={data} onOpenTransport={onOpenTransport} />
      )}
    </View>
  );
}

function ItineraryMap({ data }: { data: TripData }) {
  const { points, legs, missing } = useMemo(() => buildMap(data), [data]);

  if (!points.length) {
    return <Empty>Nenhum lugar com coordenadas. Preencha a aba Locais na planilha.</Empty>;
  }

  return (
    <View style={styles.list}>
      <TripMap points={points} legs={legs} dom={{ style: { width: '100%', height: 520 } }} />
      {missing.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Sem coordenadas: {missing.join(', ')}
        </ThemedText>
      )}
    </View>
  );
}

function ItineraryList({ data, onOpenTransport }: { data: TripData; onOpenTransport?: (key: string) => void }) {
  const { groups, bannerOf } = useMemo(() => {
    const { cityOf, bannerOf } = createPlaces(data.locals);
    const byCity = new Map<string, typeof data.activities>();
    for (const a of data.activities) {
      const city = cityOf(a.place);
      byCity.set(city, [...(byCity.get(city) ?? []), a]);
    }
    return { groups: [...byCity.entries()], bannerOf };
  }, [data]);

  if (groups.length === 1 && !groups[0][0]) {
    return <DayList data={data} activities={data.activities} onOpenTransport={onOpenTransport} />;
  }

  return (
    <View style={styles.list}>
      {groups.map(([city, items]) => (
        <Accordion
          key={city || 'sem-cidade'}
          title={city || 'Sem cidade'}
          banner={bannerOf(city)}
          subtitle={`${items.length} ${items.length === 1 ? 'atividade' : 'atividades'} · ${formatDate(items[0].start)}`}>
          <DayList data={data} activities={items} onOpenTransport={onOpenTransport} />
        </Accordion>
      ))}
    </View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon} size={18} color={Colors.light.accent} />
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

/** Só o ícone; o texto aparece ao passar o mouse. Com `onPress`, o clique age; sem ele, alterna o texto (celular). */
function IconTip({ icon, tip, onPress }: { icon: IconName; tip: string; onPress?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <Pressable
      accessibilityLabel={tip}
      onHoverIn={() => setShow(true)}
      onHoverOut={() => setShow(false)}
      onPress={() => (onPress ? onPress() : setShow((s) => !s))}
      style={styles.iconTip}>
      <MaterialCommunityIcons name={icon} size={20} color={Colors.light.accent} />
      {show && (
        <View style={styles.tooltipWrap} pointerEvents="none">
          <View style={styles.tooltip}>
            <ThemedText type="small" style={styles.tooltipText}>
              {tip}
            </ThemedText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Valores da aba Money (Tipo "Atividade") ligados à atividade pelo código; some se não houver. */
function ActivityCost({ data, code }: { data: TripData; code: string }) {
  const cost = costFor(data, 'activities', code);
  if (!cost.bills.length) return null;
  return (
    <Accordion sub icon="cash" title="Valores" subtitle={formatBRL(cost.totalBRL)}>
      <CostLines cost={cost} currencies={data.currencies} />
    </Accordion>
  );
}

const normText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function transportKey(t: { code: string; details: string }) {
  return `${t.code}-${t.details}`;
}

function DayList({
  data,
  activities,
  onOpenTransport,
}: {
  data: TripData;
  activities: TripData['activities'];
  onOpenTransport?: (key: string) => void;
}) {
  // A referência da atividade casa com a coluna Detalhes da aba Transport.
  const findTransport = (ref: string) =>
    ref ? data.transports.find((t) => normText(t.details) === normText(ref)) : undefined;

  const days = new Map<string, typeof activities>();
  for (const a of activities) {
    const key = dayKey(a.start);
    days.set(key, [...(days.get(key) ?? []), a]);
  }

  return (
    <View style={styles.list}>
      {[...days.values()].map((items) => (
        <Accordion
          key={dayKey(items[0].start)}
          sub
          icon="calendar"
          title={formatDayHeading(items[0].start)}
          subtitle={`${items.length} ${items.length === 1 ? 'atividade' : 'atividades'}`}>
          {items.map((a) => (
            <Card key={a.code}>
              <View style={styles.row}>
                <IconBubble name={categoryIcon(a.category)} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{a.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatTime(a.start)}
                    {a.end !== null && a.end !== a.start ? ` – ${formatTime(a.end)}` : ''}
                  </ThemedText>
                  <View style={styles.metaRow}>
                    {formatDuration(a.start, a.end) ? (
                      <Meta icon="timer-outline" text={formatDuration(a.start, a.end)} />
                    ) : null}
                    {a.transportMode ? (
                      <IconTip
                        icon={modeIcon(a.transportMode)}
                        tip={[a.transportMode, a.transportRef].filter(Boolean).join(' · ')}
                        onPress={
                          onOpenTransport && findTransport(a.transportRef)
                            ? () => onOpenTransport(transportKey(findTransport(a.transportRef)!))
                            : undefined
                        }
                      />
                    ) : null}
                  </View>
                  <PlaceLink place={a.place} />
                  <Field label="Obs." value={a.notes} />
                  <FileLink url={a.voucher} />
                  <ActivityCost data={data} code={a.code} />
                </View>
              </View>
            </Card>
          ))}
        </Accordion>
      ))}
    </View>
  );
}

export function FlightsSection({ data }: { data: TripData }) {
  if (!data.flights.length) return <Empty />;

  const bookings = new Map<string, Flight[]>();
  for (const f of data.flights) bookings.set(f.code, [...(bookings.get(f.code) ?? []), f]);

  return (
    <View style={styles.list}>
      {[...bookings.entries()].map(([code, legs]) => {
        const cost = costFor(data, 'flights', code);
        return (
          <ExpandCard
            key={code}
            header={
              <View style={styles.row}>
                <IconBubble name="ticket-confirmation" />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Reserva {code}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {legs[0].passengers} · {legs.length} {legs.length === 1 ? 'trecho' : 'trechos'}
                  </ThemedText>
                </View>
                <CostTag cost={cost} />
              </View>
            }>
            <View style={styles.legs}>
              {legs.map((f) => (
                <View key={`${f.code}-${f.flightNumber}`} style={styles.leg}>
                  <View style={styles.row}>
                    <BrandBadge name={f.airline} size={32} />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">
                        {f.fromAirport} → {f.toAirport}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {f.airline} {f.flightNumber}
                      </ThemedText>
                    </View>
                    <StatusBadge status={f.status} />
                  </View>
                  <Field label="Partida" value={`${formatDateTime(f.departure)} · ${f.from}`} />
                  <Field label="Chegada" value={`${formatDateTime(f.arrival)} · ${f.to}`} />
                  <FileLink url={f.voucher} />
                </View>
              ))}
            </View>
            <Accordion
              sub
              icon="cash"
              title="Valores da reserva"
              subtitle={cost.bills.length ? formatBRL(cost.totalBRL) : undefined}>
              <CostLines cost={cost} currencies={data.currencies} />
            </Accordion>
          </ExpandCard>
        );
      })}
    </View>
  );
}

export function HotelsSection({ data }: { data: TripData }) {
  if (!data.hotels.length) return <Empty />;
  return (
    <View style={styles.list}>
      {data.hotels.map((h) => {
        const cost = costFor(data, 'hotels', h.code);
        return (
          <ExpandCard
            key={h.code || h.name}
            header={
              <View style={styles.row}>
                <BrandBadge name={h.platform} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{h.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(h.checkIn)} → {formatDate(h.checkOut)}
                  </ThemedText>
                  <CostTag cost={cost} />
                </View>
              </View>
            }>
            <PlaceLink place={h.link} />
            <Field label="Plataforma" value={h.platform} />
            <Field label="Contato" value={h.contact} />
            <Field label="Reserva" value={h.code} />
            <FileLink url={h.voucher} />
            <StatusBadge status={h.status} />
            <CostLines cost={cost} currencies={data.currencies} />
          </ExpandCard>
        );
      })}
    </View>
  );
}

export function TransportSection({ data, focusKey }: { data: TripData; focusKey?: string }) {
  if (!data.transports.length) return <Empty />;
  return (
    <View style={styles.list}>
      {data.transports.map((t) => {
        const cost = costFor(data, 'transports', t.code);
        return (
          <ExpandCard
            key={transportKey(t)}
            defaultOpen={focusKey === transportKey(t)}
            header={
              <View style={styles.row}>
                <IconBubble name={modeIcon(t.mode)} />
                <BrandBadge name={t.platform} size={32} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{t.details || t.mode}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDateTime(t.departure)}
                  </ThemedText>
                  <CostTag cost={cost} />
                </View>
              </View>
            }>
            <Field label="Saída" value={`${formatDateTime(t.departure)} · ${placeLabel(t.from)}`} />
            <Field label="Chegada" value={`${formatDateTime(t.arrival)} · ${placeLabel(t.to)}`} />
            <FileLink url={t.voucher} />
            <Field label="Meio" value={[t.mode, t.platform].filter(Boolean).join(' · ')} />
            <StatusBadge status={t.status} />
            <CostLines cost={cost} currencies={data.currencies} />
          </ExpandCard>
        );
      })}
    </View>
  );
}

export function FoodSection({ data }: { data: TripData }) {
  if (!data.meals.length) return <Empty />;

  const days = new Map<string, typeof data.meals>();
  for (const m of data.meals) {
    const key = dayKey(m.date);
    days.set(key, [...(days.get(key) ?? []), m]);
  }

  return (
    <View style={styles.list}>
      {[...days.values()].map((items) => (
        <Accordion
          key={dayKey(items[0].date)}
          sub
          icon="calendar"
          title={formatDayHeading(items[0].date)}
          subtitle={`${items.length} ${items.length === 1 ? 'refeição' : 'refeições'}`}>
          {items.map((m) => {
            const cost = costFor(data, 'meals', m.code);
            return (
              <ExpandCard
                key={m.code}
                header={
                  <View style={styles.row}>
                    <IconBubble name={mealIcon(m.type)} color="#E8833A" bg="#FFEBDC" />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{m.type}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {m.description}
                      </ThemedText>
                      <CostTag cost={cost} />
                    </View>
                    <StatusBadge status={m.status} />
                  </View>
                }>
                <PlaceLink place={m.place} />
                <CostLines cost={cost} currencies={data.currencies} />
              </ExpandCard>
            );
          })}
        </Accordion>
      ))}
    </View>
  );
}

const CATEGORY_COLORS = ['#4F8DF7', '#34C28A', '#F59E42', '#A678F0', '#F06A8A', '#3CC4D6'];
const TONE_COLORS = { good: '#34C28A', warn: '#F59E42', neutral: '#8FA3BF' } as const;

export function MoneySection({ data }: { data: TripData }) {
  if (!data.bills.length) return <Empty />;

  const rate = (code: string) => data.currencies.find((c) => c.symbol === code);
  const converted = data.bills.map((b) => ({ bill: b, brl: billToBRL(b, data.currencies) }));

  const sum = (pred: (tone: ReturnType<typeof statusTone>) => boolean) =>
    converted.filter((c) => pred(statusTone(c.bill.status))).reduce((acc, c) => acc + (c.brl ?? 0), 0);

  const group = (keyOf: (b: (typeof data.bills)[number]) => string, colorOf: (key: string, i: number) => string) => {
    const totals = new Map<string, number>();
    for (const { bill, brl } of converted) {
      const key = keyOf(bill) || 'Outros';
      totals.set(key, (totals.get(key) ?? 0) + (brl ?? 0));
    }
    return [...totals.entries()].map(([label, value], i): ChartItem => ({ label, value, color: colorOf(label, i) }));
  };

  const byCategory = group((b) => b.type, (_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
  const byStatus = group((b) => b.status || 'Sem status', (label) => TONE_COLORS[statusTone(label)]);

  return (
    <View style={styles.list}>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Total estimado
        </ThemedText>
        <ThemedText type="title">{formatBRL(sum(() => true))}</ThemedText>
        <Field label="Pago / reservado" value={formatBRL(sum((t) => t === 'good'))} />
        <Field label="Pendente" value={formatBRL(sum((t) => t !== 'good'))} />
      </Card>

      <PieChart title="Despesas por categoria" items={byCategory} format={formatBRL} />
      <PieChart title="Despesas por status" items={byStatus} format={formatBRL} />

      {converted.map(({ bill: b, brl }, i) => (
        <Card key={`${b.reference}-${b.description}-${i}`}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{b.description}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[b.type, b.person, b.paymentMethod].filter(Boolean).join(' · ')}
              </ThemedText>
              <ThemedText type="small">
                {formatAmount(b.amount, rate(b.currency), b.currency)}
                {brl !== null && b.currency !== 'R$' ? ` ≈ ${formatBRL(brl)}` : ''}
              </ThemedText>
              {rateNote(b) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {rateNote(b)}
                </ThemedText>
              ) : null}
              <FileLink url={b.receipt} label="Comprovante" />
            </View>
            <StatusBadge status={b.status} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: Spacing.half },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  iconTip: { position: 'relative', justifyContent: 'center' },
  // Faixa de 360px centrada no ícone de 20px; o balão dentro dela ocupa só o tamanho do texto.
  tooltipWrap: {
    position: 'absolute',
    bottom: '100%',
    left: -170,
    width: 360,
    alignItems: 'center',
    marginBottom: Spacing.one,
    zIndex: 10,
  },
  tooltip: {
    maxWidth: 360,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.text,
  },
  tooltipText: { color: '#FFFFFF' },
  legs: { gap: Spacing.three },
  leg: { gap: Spacing.one, paddingLeft: Spacing.three, borderLeftWidth: 3, borderLeftColor: Colors.light.accent },
});
