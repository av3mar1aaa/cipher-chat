import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';

const AVATAR_COLORS = ['#00ff41', '#00cc33', '#009922', '#006611'];

export default function Avatar({ name, size = 44, online = false }) {
  const letter = (name || '?')[0].toUpperCase();
  const colorIndex = (name || '').charCodeAt(0) % AVATAR_COLORS.length;
  const bgColor = AVATAR_COLORS[colorIndex];

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.circle, {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor + '22',
        borderColor: bgColor,
      }]}>
        <Text style={[styles.letter, { fontSize: size * 0.4, color: bgColor }]}>{letter}</Text>
      </View>
      {online && (
        <View style={[styles.onlineDot, {
          right: 0,
          bottom: 0,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: size * 0.14,
        }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5
  },
  letter: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#00ff41',
    borderWidth: 2,
    borderColor: '#0a0a0a'
  },
});
