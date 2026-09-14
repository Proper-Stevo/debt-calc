import { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/lib/theme';

interface CircularDialProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  label?: string;
}

export default function CircularDial({
  value,
  onChange,
  min = 0,
  max = 500,
  step = 10,
  size = 200,
  label = '',
}: CircularDialProps) {
  const theme = useTheme();
  const radius = size / 2;
  const strokeWidth = 14;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  const viewRef = useRef<View>(null);
  const center = useRef({ x: 0, y: 0 });

  function angleToValue(angle: number): number {
    const percent = angle / 360;
    const raw = min + percent * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, stepped));
  }

  function updateFromPage(pageX: number, pageY: number) {
    const dx = pageX - center.current.x;
    const dy = pageY - center.current.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    onChange(angleToValue(angle));
  }

  // react-native-gesture-handler correctly negotiates with the parent FlatList,
  // unlike the plain PanResponder approach - so dragging here won't trigger
  // the list to scroll underneath it.
 const pan = Gesture.Pan()
  .runOnJS(true)
  .onBegin((e) => {
      viewRef.current?.measureInWindow((x, y, w, h) => {
        center.current = { x: x + w / 2, y: y + h / 2 };
        updateFromPage(e.absoluteX, e.absoluteY);
      });
    })
    .onUpdate((e) => {
      updateFromPage(e.absoluteX, e.absoluteY);
    });

  const progress = (value - min) / (max - min);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <GestureDetector gesture={pan}>
      <View ref={viewRef} style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={radius}
            cy={radius}
            r={innerRadius}
            stroke={theme.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={radius}
            cy={radius}
            r={innerRadius}
            stroke={theme.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${radius}, ${radius}`}
          />
        </Svg>
        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={[styles.value, { color: theme.textPrimary }]}>${value}</Text>
          {label ? <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text> : null}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: { fontSize: 28, fontWeight: '600' },
  label: { fontSize: 12, marginTop: 2 },
});