import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Full implementation in Stage D
export default function AIChatScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>AI Coach</Text>
      <Text style={s.sub}>Coming in Stage D</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  sub: { fontSize: 15, color: '#8A8A8A' },
});
