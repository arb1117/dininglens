import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';

type Props = {
  reason?: 'trial_expired' | 'coach_limit';
  resetAt?: string;
};

export default function PaywallPlaceholder({ reason = 'trial_expired', resetAt }: Props) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const title   = reason === 'coach_limit' ? 'Daily limit reached' : 'Free trial ended';
  const body    = reason === 'coach_limit'
    ? `You've used today's AI Coach messages.${resetAt ? `\nResets at midnight.` : ''}`
    : 'Your free trial has ended. Upgrade to keep tracking your nutrition with AI.';
  const cta     = 'Subscribe — coming soon';

  return (
    <View style={s.container}>
      <Text style={s.icon}>{reason === 'coach_limit' ? '⏳' : '🔒'}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>

      <TouchableOpacity style={s.ctaBtn} disabled>
        <Text style={s.ctaText}>{cta}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.logBtn}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
      >
        <Text style={s.logText}>View my log</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0F0F0F',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  icon:  { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  body:  { fontSize: 15, color: '#8A8A8A', textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  ctaBtn: {
    backgroundColor: '#2A2A2A', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 40,
    marginBottom: 14, opacity: 0.5,
    borderWidth: 1, borderColor: '#3A3A3A',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#8A8A8A', textAlign: 'center' },

  logBtn: {
    paddingVertical: 12, paddingHorizontal: 24,
  },
  logText: { fontSize: 14, color: '#00E5A0', fontWeight: '600' },
});
