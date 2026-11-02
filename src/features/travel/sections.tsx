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
import { cityCostKey, costFor, costsByCity } from './costs';
import {
  billToBRL,
  dayKey,
  feesNote,
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
import type { Bill, Currency, Flight } from './schema';
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
      <Tabs tabs={VIEWS} value={view} onChange={setView} secondary />
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

  if (!points.length && !legs.length) {
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
  const { groups, bannerOf, countryOf, spentIn } = useMemo(() => {
    const { cityOf, bannerOf, countryOf } = createPlaces(data.locals);
    const byCity = new Map<string, typeof data.activities>();
    for (const a of data.activities) {
      const city = cityOf(a.place);
      byCity.set(city, [...(byCity.get(city) ?? []), a]);
    }

    const totals = costsByCity(data);
    return { groups: [...byCity.entries()], bannerOf, countryOf, spentIn: (city: string) => totals.get(cityCostKey(city))?.totalBRL ?? 0 };
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
          country={countryOf(city)}
          subtitle={[
            `${items.length} ${items.length === 1 ? 'atividade' : 'atividades'}`,
            formatDate(items[0].start),
            spentIn(city) > 0 ? `Gasto: ${formatBRL(spentIn(city))}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}>
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

function FlightStatusBadge({ status }: { status: string }) {
  const colors = normText(status) === 'viaje facil' ? { bg: '#F7941D', fg: '#1B1B1B' } : undefined;
  return <StatusBadge status={status} colors={colors} />;
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
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {[...new Set(legs.map((l) => l.status))].map((s) => (
                    <FlightStatusBadge key={s} status={s} />
                  ))}
                  <CostTag cost={cost} />
                </View>
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
                    <FlightStatusBadge status={f.status} />
                  </View>
                  <Field label="Partida" value={`${formatDateTime(f.departure)} · ${f.from}`} />
                  <Field label="Chegada" value={`${formatDateTime(f.arrival)} · ${f.to}`} />
                  <Field label="Etapa do percurso" value={f.stage} />
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
                <StatusBadge status={h.status} />
              </View>
            }>
            <PlaceLink place={h.link} />
            <Field label="Plataforma" value={h.platform} />
            <Field label="Contato" value={h.contact} />
            <Field label="Reserva" value={h.code} />
            <FileLink url={h.voucher} />
            <CostLines cost={cost} currencies={data.currencies} />
          </ExpandCard>
        );
      })}
    </View>
  );
}

type TransportView = 'list' | 'destinations';
const TRANSPORT_VIEWS: { key: TransportView; label: string; icon: IconName }[] = [
  { key: 'list', label: 'Lista', icon: 'format-list-bulleted' },
  { key: 'destinations', label: 'Por destino', icon: 'map-marker' },
];

export function TransportSection({ data, focusKey }: { data: TripData; focusKey?: string }) {
  const [view, setView] = useState<TransportView>('list');
  if (!data.transports.length) return <Empty />;

  const { cityOf, bannerOf, countryOf } = createPlaces(data.locals);
  const destinations = new Map<string, { city: string; transports: TripData['transports'] }>();
  for (const transport of data.transports) {
    const city = cityOf(transport.to).trim();
    const key = cityCostKey(city);
    const group = destinations.get(key) ?? { city, transports: [] };
    group.transports.push(transport);
    destinations.set(key, group);
  }

  return (
    <View style={styles.list}>
      <Tabs tabs={TRANSPORT_VIEWS} value={view} onChange={setView} secondary />
      {view === 'list' ? (
        <TransportCards data={data} transports={data.transports} focusKey={focusKey} />
      ) : (
        [...destinations.entries()].map(([key, group]) => (
          <Accordion
            key={key}
            title={group.city || 'Sem local'}
            banner={bannerOf(group.city)}
            country={countryOf(group.city)}
            subtitle={`${group.transports.length} ${group.transports.length === 1 ? 'transporte' : 'transportes'}`}
            defaultOpen={group.transports.some((transport) => transportKey(transport) === focusKey)}>
            <TransportCards data={data} transports={group.transports} focusKey={focusKey} />
          </Accordion>
        ))
      )}
    </View>
  );
}

function TransportCards({ data, transports, focusKey }: { data: TripData; transports: TripData['transports']; focusKey?: string }) {
  return (
    <View style={styles.list}>
      {transports.map((t) => {
        const cost = costFor(data, 'transports', t.code);
        return (
          <ExpandCard
            key={transportKey(t)}
            defaultOpen={focusKey === transportKey(t)}
            header={
              <View style={styles.row}>
                <TransportIconTip tip={`${t.mode || 'Não informado'}`}>
                  <IconBubble name={modeIcon(t.mode)} />
                </TransportIconTip>
                {t.platform ? (
                  <TransportIconTip tip={`${t.platform}`}>
                    <BrandBadge name={t.platform} size={32} />
                  </TransportIconTip>
                ) : null}
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{t.details || t.mode}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDateTime(t.departure)}
                  </ThemedText>
                  <CostTag cost={cost} />
                </View>
                <StatusBadge status={t.status} />
              </View>
            }>
            <Field label="Saída" value={`${formatDateTime(t.departure)} · ${placeLabel(t.from)}`} />
            <Field label="Chegada" value={`${formatDateTime(t.arrival)} · ${placeLabel(t.to)}`} />
            <FileLink url={t.voucher} />
            <Field label="Meio" value={[t.mode, t.platform].filter(Boolean).join(' · ')} />
            <CostLines cost={cost} currencies={data.currencies} />
          </ExpandCard>
        );
      })}
    </View>
  );
}

function TransportIconTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tip}
      onHoverIn={() => setShow(true)}
      onHoverOut={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onPress={(event) => {
        event.stopPropagation();
        setShow((visible) => !visible);
      }}
      style={[styles.iconTip, show && styles.transportIconActive]}>
      {children}
      {show && (
        <View style={styles.transportTooltipWrap} pointerEvents="none">
          <View style={styles.transportTooltip}>
            <ThemedText type="small" style={[styles.tooltipText, styles.transportTooltipText]}>{tip}</ThemedText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function FoodSection({ data }: { data: TripData }) {
  if (!data.meals.length) return <Empty />;

  const { cityOf, bannerOf, countryOf } = createPlaces(data.locals);
  const cities = new Map<string, { city: string; meals: TripData['meals'] }>();
  for (const meal of data.meals) {
    const city = cityOf(meal.place).trim();
    const key = cityCostKey(city);
    const group = cities.get(key) ?? { city, meals: [] };
    group.meals.push(meal);
    cities.set(key, group);
  }

  return (
    <View style={styles.list}>
      {[...cities.entries()].map(([key, group]) => (
        <Accordion
          key={key}
          title={group.city || 'Sem local'}
          banner={bannerOf(group.city)}
          country={countryOf(group.city)}
          subtitle={`${group.meals.length} ${group.meals.length === 1 ? 'refeição' : 'refeições'}`}>
          <FoodDays data={data} meals={group.meals} />
        </Accordion>
      ))}
    </View>
  );
}

function FoodDays({ data, meals }: { data: TripData; meals: TripData['meals'] }) {
  const days = new Map<string, TripData['meals']>();
  for (const m of meals) {
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
                <Field label="Cidade" value={m.place} />
                <Field label="Cardápio" value={m.menu} />
                <FileLink url={m.menuFile} label="Abrir cardápio" />
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

type MoneyView = 'charts' | 'bills' | 'cities';
const MONEY_VIEWS: { key: MoneyView; label: string; icon: IconName }[] = [
  { key: 'charts', label: 'Gráficos', icon: 'chart-pie' },
  { key: 'bills', label: 'Despesas', icon: 'format-list-bulleted' },
  { key: 'cities', label: 'Por local', icon: 'map-marker' },
];

export function MoneySection({ data }: { data: TripData }) {
  const [view, setView] = useState<MoneyView>('charts');
  if (!data.bills.length) return <Empty />;

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

      <Tabs tabs={MONEY_VIEWS} value={view} onChange={setView} secondary />
      {view === 'charts' ? (
        <>
          <PieChart title="Despesas por categoria" items={byCategory} format={formatBRL} />
          <PieChart title="Despesas por status" items={byStatus} format={formatBRL} />
        </>
      ) : view === 'bills' ? (
        converted.map(({ bill, brl }, index) => (
          <BillCard key={`${bill.reference}-${bill.description}-${index}`} bill={bill} brl={brl} currencies={data.currencies} />
        ))
      ) : (
        <CityCosts data={data} />
      )}
    </View>
  );
}

function CityCosts({ data }: { data: TripData }) {
  const cities = [...costsByCity(data).entries()];
  const { bannerOf, cityOf, countryOf } = createPlaces(data.locals);
  const firstActivity = new Map<string, number>();
  for (const activity of data.activities) {
    if (activity.start === null) continue;
    const key = cityCostKey(cityOf(activity.place));
    firstActivity.set(key, Math.min(firstActivity.get(key) ?? Infinity, activity.start));
  }
  cities.sort(([left], [right]) => (firstActivity.get(left) ?? Infinity) - (firstActivity.get(right) ?? Infinity));
  if (!cities.length) return <Empty>Nenhuma despesa vinculada a um local.</Empty>;
  return (
    <View style={styles.list}>
      {cities.map(([key, city]) => (
        <Accordion key={key} title={city.city || 'Sem local'} banner={bannerOf(city.city)} country={countryOf(city.city)} subtitle={`Total estimado: ${formatBRL(city.totalBRL)}`}>
          {city.bills.map(({ bill, brl, share }, index) => (
            <BillCard key={`${bill.reference}-${bill.description}-${index}`} bill={bill} brl={brl} currencies={data.currencies} share={share} />
          ))}
        </Accordion>
      ))}
    </View>
  );
}

function BillCard({ bill, brl, currencies, share = 1 }: { bill: Bill; brl: number | null; currencies: Currency[]; share?: number }) {
  const currency = currencies.find((item) => item.symbol === bill.currency);
  const note = rateNote(bill) || feesNote(bill, currencies);
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{bill.description}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[bill.type, bill.person, bill.paymentMethod].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="small">
            {formatAmount(bill.amount, currency, bill.currency)}
            {brl !== null && (bill.currency !== 'R$' || share !== 1) ? ` ≈ ${formatBRL(brl)}` : ''}
          </ThemedText>
          {share !== 1 ? <ThemedText type="small" themeColor="textSecondary">Parcela do voo neste local</ThemedText> : null}
          {note ? <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText> : null}
          <FileLink url={bill.receipt} label="Comprovante" />
        </View>
        <StatusBadge status={bill.status} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: Spacing.half },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  iconTip: { position: 'relative', justifyContent: 'center' },
  transportIconActive: { zIndex: 10 },
  transportTooltipWrap: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    width: 200,
    alignItems: 'flex-start',
    marginBottom: Spacing.one,
  },
  transportTooltip: {
    maxWidth: 200,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.text,
  },
  transportTooltipText: { textAlign: 'center' },
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
