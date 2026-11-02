import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export type ChartItem = { label: string; value: number; color: string };

const SIZE = 180;
const STROKE = 34;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Pizza (rosca) com legenda; tocar numa fatia ou item da legenda destaca e mostra o valor no centro. */
export function PieChart({
  title,
  items,
  format,
}: {
  title: string;
  items: ChartItem[];
  format: (n: number) => string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const data = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((s, i) => s + i.value, 0);
  const active = data.find((i) => i.label === selected);
  const toggle = (label: string) => setSelected((s) => (s === label ? null : label));
  const segments = data.reduce<{ length: number; offset: number }[]>((result, item) => {
    const previous = result[result.length - 1];
    result.push({
      length: (item.value / total) * CIRCUMFERENCE,
      offset: previous ? previous.offset + previous.length : 0,
    });
    return result;
  }, []);

  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      {total === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Sem valores para exibir.
        </ThemedText>
      ) : (
        <View style={styles.body}>
          <View style={styles.chart}>
            <Svg width={SIZE} height={SIZE}>
              <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
                {data.map((i, index) => {
                  const { length, offset } = segments[index];
                  const dimmed = active && active.label !== i.label;
                  return (
                    <Circle
                      key={i.label}
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={i.color}
                      strokeOpacity={dimmed ? 0.35 : 1}
                      strokeWidth={active?.label === i.label ? STROKE + 8 : STROKE}
                      strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                      strokeDashoffset={-offset}
                      onPress={() => toggle(i.label)}
                    />
                  );
                })}
              </G>
            </Svg>
            <View style={styles.center} pointerEvents="none">
              <ThemedText type="small" themeColor="textSecondary">
                {active ? active.label : 'Total'}
              </ThemedText>
              <ThemedText type="smallBold">{format(active ? active.value : total)}</ThemedText>
              {active && (
                <ThemedText type="small" themeColor="textSecondary">
                  {((active.value / total) * 100).toFixed(0)}%
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.legend}>
            {data.map((i) => (
              <Pressable key={i.label} onPress={() => toggle(i.label)} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: i.color }]} />
                <ThemedText type="small" style={styles.label}>
                  {i.label}
                </ThemedText>
                <ThemedText type="smallBold">{format(i.value)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.pct}>
                  {((i.value / total) * 100).toFixed(0)}%
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.three, alignItems: 'center' },
  chart: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 100 },
  legend: { alignSelf: 'stretch', gap: Spacing.two },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1 },
  pct: { width: 40, textAlign: 'right' },
});
