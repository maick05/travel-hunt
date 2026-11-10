import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BrandBadge, categoryIcon, mealIcon, modeIcon, type IconName } from '@/components/brand';
import { PieChart, type ChartItem } from '@/components/charts';
import { ExternalLink } from '@/components/external-link';
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
import { cityCostKey, costFor, costsByCity, mealCostsByType, moneyBreakdown } from './costs';
import { EditButton } from './edit-item';
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
    toBRL,
} from './format';
import { buildMap, itineraryActivities } from './map-data';
import { createPlaces, isLink, placeLabel } from './places';
import { reserveResult, sheetQuote } from './quotes';
import { assetKey, hasReserveAsset } from './reserves';
import type { Bill, Currency, Flight } from './schema';
import type { TripData } from './use-travel-data';

type ItineraryView = 'list' | 'map';
function ListScroll({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <ScrollView nestedScrollEnabled style={{ maxHeight: Math.min(560, Math.max(240, height * 0.6)) }} contentContainerStyle={[styles.list, styles.listContent]}>
      {children}
    </ScrollView>
  );
}

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
        <ListScroll><ItineraryList data={data} onOpenTransport={onOpenTransport} /></ListScroll>
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
    const activities = itineraryActivities(data);
    for (const a of activities) {
      const city = cityOf(a.place);
      byCity.set(city, [...(byCity.get(city) ?? []), a]);
    }

    const totals = costsByCity(data);
    return { groups: [...byCity.entries()], bannerOf, countryOf, spentIn: (city: string) => totals.get(cityCostKey(city))?.totalBRL ?? 0 };
  }, [data]);

  if (groups.length === 0) return <Empty>Nenhuma atividade no itinerário.</Empty>;
  if (groups.length === 1 && !groups[0][0]) {
    return <DayList data={data} activities={groups[0][1]} onOpenTransport={onOpenTransport} />;
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
                    {a.reserved !== null || a.reservationAvailableDate !== null || a.reservationWaitReason ? (
                      <TransportIconTip tip={[
                        a.reserved === null ? '' : `Reservado (ticket/valor): ${a.reserved ? 'Sim' : 'Não'}`,
                        a.reservationAvailableDate === null ? '' : `Reserva possível em: ${formatDate(a.reservationAvailableDate)}`,
                        a.reservationWaitReason ? `Motivo da espera: ${a.reservationWaitReason}` : '',
                      ].filter(Boolean).join('\n')}>
                        <MaterialCommunityIcons name={a.reserved ? 'ticket-confirmation-outline' : 'ticket-outline'} size={20} color={Colors.light.accent} />
                      </TransportIconTip>
                    ) : null}
                  </View>
                  <PlaceLink place={a.place} />
                  {a.company ? (
                    <View style={styles.meta}>
                      <BrandBadge name={a.company} size={24} logoOnly />
                      <Field label="Empresa" value={a.company} />
                    </View>
                  ) : null}
                  {isLink(a.link) ? (
                    <ExternalLink href={a.link.trim() as never}>
                      <ThemedText type="small" style={{ color: Colors.light.accent }}>
                        <MaterialCommunityIcons name="open-in-new" size={16} color={Colors.light.accent} /> Site da atividade
                      </ThemedText>
                    </ExternalLink>
                  ) : null}
                  <Field label="Obs." value={a.notes} />
                  <FileLink url={a.voucher} />
                  <ActivityCost data={data} code={a.code} />
                  <EditButton table="activities" item={a} title="atividade" />
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
    <ListScroll>
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
                  <EditButton table="flights" item={f} title="trecho de voo" />
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
    </ListScroll>
  );
}

export function HotelsSection({ data }: { data: TripData }) {
  if (!data.hotels.length) return <Empty />;
  return (
    <ListScroll>
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
            <EditButton table="hotels" item={h} title="hospedagem" />
          </ExpandCard>
        );
      })}
    </ListScroll>
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
      <ListScroll>
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
      </ListScroll>
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
                    <BrandBadge name={t.platform} size={36} />
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
            <EditButton table="transports" item={t} title="transporte" />
          </ExpandCard>
        );
      })}
    </View>
  );
}

function TransportIconTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const show = hovered || focused || pinned;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tip}
      accessibilityState={{ expanded: show }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setPinned(false); }}
      onPress={(event) => {
        event.stopPropagation();
        setFocused(false);
        setPinned((visible) => !visible);
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
  const [view, setView] = useState<'list' | 'chart'>('list');
  const [chart, setChart] = useState<'type' | 'status'>('type');
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
      <Tabs tabs={FOOD_VIEWS} value={view} onChange={setView} secondary />
      {view === 'chart' ? (
        <>
          <Tabs tabs={FOOD_CHARTS} value={chart} onChange={setChart} secondary />
          {chart === 'type' ? <MealChart data={data} /> : <MealStatusChart data={data} />}
        </>
      ) : <ListScroll>{[...cities.entries()].map(([key, group]) => (
          <Accordion
            key={key}
            title={group.city || 'Sem local'}
            banner={bannerOf(group.city)}
            country={countryOf(group.city)}
            subtitle={`${group.meals.length} ${group.meals.length === 1 ? 'refeição' : 'refeições'}`}>
            <FoodDays data={data} meals={group.meals} />
          </Accordion>
        ))}</ListScroll>}
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
                <EditButton table="meals" item={m} title="refeição" />
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

const FOOD_VIEWS: { key: 'list' | 'chart'; label: string; icon: IconName }[] = [
  { key: 'list', label: 'Lista', icon: 'format-list-bulleted' },
  { key: 'chart', label: 'Gráfico', icon: 'chart-pie' },
];

const FOOD_CHARTS: { key: 'type' | 'status'; label: string; icon: IconName }[] = [
  { key: 'type', label: 'Tipo', icon: 'silverware-fork-knife' },
  { key: 'status', label: 'Status', icon: 'list-status' },
];

type MoneyChart = 'type' | 'category' | 'status' | 'meals' | 'currency' | 'paymentMethod';
const MONEY_CHARTS: { key: MoneyChart; label: string; icon: IconName }[] = [
  { key: 'type', label: 'Tipo', icon: 'shape-outline' },
  { key: 'category', label: 'Categoria', icon: 'tag-outline' },
  { key: 'status', label: 'Status', icon: 'list-status' },
  { key: 'meals', label: 'Refeições', icon: 'silverware-fork-knife' },
  { key: 'currency', label: 'Moeda', icon: 'cash-multiple' },
  { key: 'paymentMethod', label: 'Pagamento', icon: 'credit-card-outline' },
];

function MealChart({ data }: { data: TripData }) {
  const items = [...mealCostsByType(data)].map(([label, value], index) => ({
    label, value, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));
  return <PieChart title="Despesas por tipo de refeição" items={items} format={formatBRL} />;
}

function MealStatusChart({ data }: { data: TripData }) {
  const totals = new Map<string, number>();
  for (const meal of data.meals) {
    const status = meal.status.trim() || 'Sem status';
    totals.set(status, (totals.get(status) ?? 0) + 1);
  }
  const items = [...totals].map(([label, value], index) => ({ label, value, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }));
  return <PieChart title="Refeições por status" items={items} format={(value) => `${value} ${value === 1 ? 'refeição' : 'refeições'}`} />;
}

type MoneyView = 'charts' | 'bills' | 'cities' | 'reserves';
const MONEY_VIEWS: { key: MoneyView; label: string; icon: IconName }[] = [
  { key: 'charts', label: 'Gráficos', icon: 'chart-pie' },
  { key: 'bills', label: 'Despesas', icon: 'format-list-bulleted' },
  { key: 'cities', label: 'Por local', icon: 'map-marker' },
  { key: 'reserves', label: 'Reservas', icon: 'safe' },
];

const BILL_TYPE_ICONS: Record<string, IconName> = {
  atividade: 'ticket-confirmation',
  comida: 'food',
  hospedagem: 'bed',
  transporte: 'car',
  voo: 'airplane',
};

const BILL_CATEGORY_ICONS: Record<string, IconName> = {
  combustivel: 'gas-station',
  comida: 'food',
  hospedagem: 'bed',
  ingresso: 'ticket-confirmation',
  passagem: 'ticket',
  'transporte privativo': 'car',
};

function billIcon(value: string | null, kind: 'type' | 'category'): IconName {
  const normalized = (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return (kind === 'type' ? BILL_TYPE_ICONS : BILL_CATEGORY_ICONS)[normalized] ?? (kind === 'type' ? 'shape-outline' : 'tag-outline');
}

const reserveNumber = (value: number | null) => value === null ? undefined :
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 20 }).format(value);

function reserveMoney(value: number | null, code: string, currencies: Currency[]): string | undefined {
  if (value === null) return undefined;
  if (code === 'R$') return formatBRL(value);
  const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const brl = toBRL(value, currencies.find((currency) => currency.symbol === code));
  return `${code} ${formatted}${brl === null ? '' : ` ≈ ${formatBRL(brl)}`}`.trim();
}

export function MoneySection({ data }: { data: TripData }) {
  const [view, setView] = useState<MoneyView>('charts');
  const [chart, setChart] = useState<MoneyChart>('type');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  if (!data.bills.length && !data.valueReserves.length) return <Empty />;

  const converted = data.bills.map((b) => ({ bill: b, brl: billToBRL(b, data.currencies) }));
  const types = [...new Set(data.bills.map((bill) => bill.type))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const categories = [...new Set(data.bills
    .filter((bill) => selectedType === null || bill.type === selectedType)
    .map((bill) => bill.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filtered = converted.filter(({ bill }) =>
    (selectedType === null || bill.type === selectedType) &&
    (selectedCategory === null || bill.category === selectedCategory));

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

  const byType = group((b) => b.type, (_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
  const byCategory = group((b) => b.category || 'Sem categoria', (_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
  const byStatus = group((b) => b.status || 'Sem status', (label) => TONE_COLORS[statusTone(label)]);
  const chartItems = (totals: Map<string, number>): ChartItem[] => [...totals].map(([label, value], index) => ({
    label, value, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));
  const paymentMethods = [...new Set(data.bills.map((bill) => bill.paymentMethod))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const currencies = [...new Set(data.bills.map((bill) => bill.currency))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

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
      {(view === 'bills' || view === 'cities') && (
        <View style={styles.filterRow}>
          <FilterSelect
            label="Tipo"
            kind="type"
            value={selectedType}
            options={types}
            emptyLabel="Sem tipo"
            onChange={(value) => { setSelectedType(value); setSelectedCategory(null); }}
          />
          <FilterSelect
            label="Categoria"
            kind="category"
            value={selectedCategory}
            options={categories}
            emptyLabel="Sem categoria"
            onChange={setSelectedCategory}
          />
        </View>
      )}
      {view === 'charts' ? (
        <>
          <Tabs tabs={MONEY_CHARTS} value={chart} onChange={setChart} secondary />
          {chart === 'type' && <PieChart key="type" title="Despesas por tipo" items={byType} format={formatBRL} />}
          {chart === 'category' && <PieChart key="category" title="Despesas por categoria" items={byCategory} format={formatBRL} />}
          {chart === 'status' && <PieChart key="status" title="Despesas por status" items={byStatus} format={formatBRL} />}
          {chart === 'meals' && <MealChart data={data} />}
          {chart === 'currency' && (
            <>
              <View style={styles.filterRow}>
                <FilterSelect label="Meio de pagamento" kind="paymentMethod" value={selectedPayment} options={paymentMethods} emptyLabel="Sem meio de pagamento" allLabel="Todos" onChange={setSelectedPayment} />
              </View>
              <PieChart key="currency" title="Despesas por moeda (R$)" items={chartItems(moneyBreakdown(data, 'currency', selectedPayment))} format={formatBRL} />
            </>
          )}
          {chart === 'paymentMethod' && (
            <>
              <View style={styles.filterRow}>
                <FilterSelect label="Moeda" kind="currency" value={selectedCurrency} options={currencies} emptyLabel="Sem moeda" onChange={setSelectedCurrency} />
              </View>
              <PieChart key="paymentMethod" title="Despesas por meio de pagamento (R$)" items={chartItems(moneyBreakdown(data, 'paymentMethod', selectedCurrency))} format={formatBRL} />
            </>
          )}
        </>
      ) : view === 'bills' ? (
        filtered.length ? <ListScroll>{filtered.map(({ bill, brl }, index) => (
          <BillCard key={`${bill.reference}-${bill.description}-${index}`} bill={bill} brl={brl} currencies={data.currencies} reserves={data.valueReserves} />
        ))}</ListScroll> : <Empty>Nenhuma despesa encontrada.</Empty>
      ) : view === 'reserves' ? (
        <ListScroll><ValueReserves data={data} /></ListScroll>
      ) : (
        <ListScroll><CityCosts data={{ ...data, bills: filtered.map(({ bill }) => bill) }} /></ListScroll>
      )}
    </View>
  );
}

function ValueReserves({ data }: { data: TripData }) {
  if (!data.valueReserves.length) return <Empty>Nenhuma reserva de valor cadastrada.</Empty>;

  const assets = new Map<string, typeof data.valueReserves>();
  for (const reserve of data.valueReserves) {
    const key = assetKey(reserve.asset);
    assets.set(key, [...(assets.get(key) ?? []), reserve]);
  }
  return (
    <View style={styles.list}>
      {[...assets.entries()].map(([key, reserves]) => {
        const bills = key ? data.bills.filter((bill) => hasReserveAsset(bill.valueReserve, key)) : [];
        return <ReserveGroup key={key} reserves={reserves} bills={bills} data={data} />;
      })}
    </View>
  );
}

function ReserveGroup({ reserves, bills, data }: { reserves: TripData['valueReserves']; bills: Bill[]; data: TripData }) {
  const [open, setOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const asset = reserves[0].asset || 'Sem ativo';
  const descriptions = [...new Set(reserves.map((reserve) => reserve.assetDescription.trim()).filter(Boolean))];
  const assetTitle = [asset, ...descriptions].join(' · ');
  return (
    <View style={styles.list}>
      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Despesas vinculadas ao ativo ${assetTitle}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          onHoverIn={() => setShowTip(true)}
          onHoverOut={() => setShowTip(false)}
          onFocus={() => setShowTip(true)}
          onBlur={() => setShowTip(false)}
          style={[styles.reserveHeader, showTip && styles.transportIconActive]}>
          <ThemedText type="smallBold" style={styles.reserveTitle}>{assetTitle}</ThemedText>
          <View style={styles.iconTip}>
            <MaterialCommunityIcons name="receipt-text-outline" size={22} color={open ? Colors.light.accent : Colors.light.textSecondary} />
            {showTip && (
              <View style={styles.reserveTooltipWrap} pointerEvents="none">
                <View style={styles.transportTooltip}>
                  <ThemedText type="small" style={styles.tooltipText}>Despesas vinculadas ao ativo</ThemedText>
                </View>
              </View>
            )}
          </View>
        </Pressable>
        {reserves.map((reserve, index) => (
          <View key={`${reserve.id}-${index}`} style={styles.reserveEntry}>
            <View style={styles.row}>
              {reserve.platform ? <BrandBadge name={reserve.platform} size={36} /> : null}
              <View style={styles.flex}>
                <ThemedText type="smallBold">{reserve.platform || 'Plataforma não informada'}</ThemedText>
                {reserve.value !== null ? (
                  <ThemedText type="smallBold">{reserveMoney(reserve.value, reserve.currency, data.currencies)}</ThemedText>
                ) : null}
                <ReserveQuote reserve={reserve} />
                <View style={styles.metaRow}>
                  <TransportIconTip tip={[
                    reserve.id ? `Reserva: ${reserve.id}` : '',
                    reserve.date === null ? '' : `Data: ${formatDate(reserve.date)}`,
                    reserve.type ? `Tipo: ${reserve.type}` : '',
                    reserve.assetDescription ? `Ativo: ${reserve.assetDescription}` : '',
                    reserve.fees === null ? '' : `Custo em taxas: ${reserveMoney(reserve.fees, reserve.currency, data.currencies)}`,
                    reserve.usedRate === null ? '' : `Cotação usada: ${reserveNumber(reserve.usedRate)}`,
                  ].filter(Boolean).join('\n') || 'Detalhes da reserva não informados'}>
                    <MaterialCommunityIcons name="information-outline" size={20} color={Colors.light.accent} />
                  </TransportIconTip>
                  {reserve.status ? (
                    <TransportIconTip tip={`Status: ${reserve.status}`}>
                      <MaterialCommunityIcons name={statusTone(reserve.status) === 'good' ? 'check-circle-outline' : 'clock-outline'} size={20} color={Colors.light.accent} />
                    </TransportIconTip>
                  ) : null}
                  {reserve.quantity !== null ? (
                    <View style={styles.meta}>
                      <TransportIconTip tip="Quantidade do ativo">
                        <MaterialCommunityIcons name="cube-outline" size={20} color={Colors.light.accent} />
                      </TransportIconTip>
                      <ThemedText type="small">{reserveNumber(reserve.quantity)}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <EditButton table="valueReserves" item={reserve} title="reserva de valor" />
              </View>
            </View>
          </View>
        ))}
      </Card>
      {open && (bills.length > 0 ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">Despesas desta viagem</ThemedText>
          {bills.map((bill, index) => (
            <BillCard key={`${bill.reference}-${bill.description}-${index}`} bill={bill} brl={billToBRL(bill, data.currencies)} currencies={data.currencies} reserves={data.valueReserves} />
          ))}
        </>
      ) : <Empty>Nenhuma despesa vinculada a este ativo nesta viagem.</Empty>)}
    </View>
  );
}

function ReserveQuote({ reserve }: { reserve: TripData['valueReserves'][number] }) {
  const quote = sheetQuote(reserve);
  if (!quote) return <ThemedText type="small" themeColor="textSecondary">Cotação indisponível na planilha</ThemedText>;
  const result = reserveResult(reserve, quote);
  const price = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(quote.price);
  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary">Cotação: {reserve.currency} {price} · Planilha</ThemedText>
      {result ? (
        <>
          <ThemedText type="small">Valor atual: {reserveMoney(result.current, reserve.currency, [])}</ThemedText>
          <ThemedText type="smallBold" style={{ color: result.difference < 0 ? '#B42318' : '#167044' }}>
            {result.difference < 0 ? 'Prejuízo' : 'Lucro'}: {reserveMoney(Math.abs(result.difference), reserve.currency, [])}
          </ThemedText>
        </>
      ) : <ThemedText type="small" themeColor="textSecondary">Resultado indisponível: quantidade ou valor não informado</ThemedText>}
    </View>
  );
}

function FilterSelect({ label, kind, value, options, emptyLabel, allLabel = 'Todas', onChange }: {
  label: string;
  kind: 'type' | 'category' | 'currency' | 'paymentMethod';
  value: string | null;
  options: string[];
  emptyLabel: string;
  allLabel?: string;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const choices: (string | null)[] = [null, ...options];
  const optionLabel = (option: string | null) => option === null ? allLabel : option || emptyLabel;
  const optionIcon = (option: string | null): IconName => kind === 'currency' ? 'cash-multiple'
    : kind === 'paymentMethod' ? 'credit-card-outline' : billIcon(option, kind);
  return (
    <View style={styles.filterField}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${optionLabel(value)}`} onPress={() => setOpen(true)} style={styles.filterSelect}>
        <MaterialCommunityIcons name={optionIcon(value)} size={18} color={Colors.light.accent} />
        <ThemedText type="small" numberOfLines={1} style={styles.filterValue}>{optionLabel(value)}</ThemedText>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.light.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.filterBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar filtro" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.filterMenu}>
            <View style={styles.filterMenuHeader}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.filterOptions}>
              {choices.map((option) => (
                <Pressable
                  key={option === null ? '__all__' : `value-${option}`}
                  accessibilityRole="radio"
                  accessibilityLabel={optionLabel(option)}
                  accessibilityState={{ checked: value === option }}
                  onPress={() => { onChange(option); setOpen(false); }}
                  style={styles.filterOption}>
                  <MaterialCommunityIcons name={optionIcon(option)} size={18} color={Colors.light.accent} />
                  <ThemedText type="small" style={styles.filterValue}>{optionLabel(option)}</ThemedText>
                  {value === option && <MaterialCommunityIcons name="check" size={20} color={Colors.light.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
            <BillCard key={`${bill.reference}-${bill.description}-${index}`} bill={bill} brl={brl} currencies={data.currencies} reserves={data.valueReserves} share={share} />
          ))}
        </Accordion>
      ))}
    </View>
  );
}

function BillCard({ bill, brl, currencies, reserves, share = 1 }: { bill: Bill; brl: number | null; currencies: Currency[]; reserves: TripData['valueReserves']; share?: number }) {
  const currency = currencies.find((item) => item.symbol === bill.currency);
  const note = rateNote(bill) || feesNote(bill, currencies);
  const reserveTip = bill.valueReserve.map((asset) => {
    const matches = reserves.filter((reserve) => hasReserveAsset([asset], reserve.asset));
    return matches.length ? matches.map((reserve) =>
      `${asset} · ${reserve.platform || 'Plataforma não informada'}${reserve.id ? ` #${reserve.id}` : ''}: ${reserveMoney(reserve.value, reserve.currency, currencies) ?? 'valor não informado'}`,
    ).join('\n') : `${asset}: reserva não encontrada`;
  }).join('\n');
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{bill.description}</ThemedText>
          {(bill.type || bill.category) ? (
            <View style={styles.metaRow}>
              {bill.type ? <Meta icon={billIcon(bill.type, 'type')} text={bill.type} /> : null}
              {bill.category ? <Meta icon={billIcon(bill.category, 'category')} text={bill.category} /> : null}
            </View>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {[bill.person, bill.paymentMethod].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="small">
            {formatAmount(bill.amount, currency, bill.currency)}
            {brl !== null && (bill.currency !== 'R$' || share !== 1) ? ` ≈ ${formatBRL(brl)}` : ''}
          </ThemedText>
          {share !== 1 ? <ThemedText type="small" themeColor="textSecondary">Parcela do voo neste local</ThemedText> : null}
          {note ? <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText> : null}
          {bill.valueReserve.length ? (
            <View style={styles.reserveIndicator}>
              <View style={styles.reserveIndicatorText}>
                <Field label="Reserva de valor" value={bill.valueReserve.join(', ')} />
              </View>
              <TransportIconTip tip={reserveTip}>
                <MaterialCommunityIcons name="information-outline" size={18} color={Colors.light.accent} />
              </TransportIconTip>
            </View>
          ) : null}
          <FileLink url={bill.receipt} label="Comprovante" />
          <EditButton table="bills" item={bill} title="despesa" />
        </View>
        <StatusBadge status={bill.status} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  listContent: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.two },
  filterRow: { flexDirection: 'row', gap: Spacing.two },
  filterField: { flex: 1, minWidth: 0, gap: Spacing.one },
  filterSelect: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.backgroundElement },
  filterValue: { flex: 1 },
  filterBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  filterMenu: { width: '100%', maxWidth: 420, maxHeight: '75%', borderRadius: Spacing.two, backgroundColor: Colors.light.backgroundElement },
  filterMenuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  filterOptions: { flexGrow: 0 },
  filterOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  reserveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  reserveEntry: { borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: Spacing.two },
  reserveTitle: { flex: 1, marginRight: Spacing.two },
  reserveTooltipWrap: { position: 'absolute', bottom: '100%', right: 0, width: 220, alignItems: 'flex-end', marginBottom: Spacing.one },
  reserveIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  reserveIndicatorText: { flexShrink: 1, minWidth: 0 },
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
