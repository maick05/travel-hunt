import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Fundo das telas: degrad\u00ea c\u00e9u-areia, brilhos suaves, curvas de n\u00edvel de mapa e uma rota tracejada. */
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7E9FD9" />
              <Stop offset="0.6" stopColor="#A3BCE6" />
              <Stop offset="1" stopColor="#CDBE9E" />
            </LinearGradient>
            <RadialGradient id="glowBlue" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#2F6FE0" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#2F6FE0" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="glowSand" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#E8893A" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#E8893A" stopOpacity="0" />
            </RadialGradient>
            {/* Linhas peri\u00f3dicas (come\u00e7am e terminam na mesma altura) para o padr\u00e3o repetir sem emendas. */}
            <Pattern id="topo" width="360" height="240" patternUnits="userSpaceOnUse">
              <Path d="M0 40 C90 0 270 80 360 40" fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
              <Path d="M0 110 C100 70 260 150 360 110" fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
              <Path d="M0 180 C80 150 280 215 360 180" fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
              <Circle cx="180" cy="130" r="1.8" fill="#FFFFFF" />
            </Pattern>
          </Defs>

          <Rect width="100%" height="100%" fill="url(#sky)" />
          <Circle cx="92%" cy="6%" r="38%" fill="url(#glowBlue)" />
          <Circle cx="4%" cy="88%" r="42%" fill="url(#glowSand)" />

          <Rect width="100%" height="100%" fill="url(#topo)" opacity={0.6} />
          <Line x1="-2%" y1="104%" x2="104%" y2="34%" stroke="#4F8DF7" strokeOpacity={0.28} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" />
          <Circle cx="6%" cy="96%" r="5" fill="#4F8DF7" fillOpacity={0.35} />
          <Circle cx="94%" cy="40%" r="5" fill="#4F8DF7" fillOpacity={0.35} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
