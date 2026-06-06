import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useMealContext } from '../context/MealContext';
import type { RootStackParamList } from '../../App';

const PRESET_LABELS: Record<string, string> = {
  lose:     '🔥 Lose Weight',
  maintain: '⚖️ Stay the Same',
  build:    '💪 Build Muscle',
};

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { goals, mealLog } = useMealContext();

  const streak = React.useMemo(() => {
    const dates = new Set(mealLog.map(m => new Date(m.timestamp).toDateString()));
    const d = new Date();
    if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let count = 0;
    while (dates.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }, [mealLog]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.header}>Profile</Text>

      {/* Goal card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Current Goal</Text>
        <Text style={s.goalPreset}>{PRESET_LABELS[goals.preset] ?? 'Custom'}</Text>
        <View style={s.macroRow}>
          <View style={s.macroChip}>
            <Text style={s.macroVal}>{goals.calories}</Text>
            <Text style={s.macroLbl}>cal</Text>
          </View>
          <View style={s.macroChip}>
            <Text style={s.macroVal}>{goals.protein}g</Text>
            <Text style={s.macroLbl}>protein</Text>
          </View>
          <View style={s.macroChip}>
            <Text style={s.macroVal}>{goals.carbs}g</Text>
            <Text style={s.macroLbl}>carbs</Text>
          </View>
          <View style={s.macroChip}>
            <Text style={s.macroVal}>{goals.fat}g</Text>
            <Text style={s.macroLbl}>fat</Text>
          </View>
        </View>
        <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('Goals')}>
          <Text style={s.editBtnText}>Edit Goal</Text>
        </TouchableOpacity>
      </View>

      {/* Streak card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Logging Streak</Text>
        <Text style={s.streakNum}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
        <Text style={s.streakSub}>
          {streak >= 2 ? `${streak} days in a row!` : streak === 1 ? 'Logged today — keep it up!' : 'Log a meal to start your streak'}
        </Text>
      </View>

      {/* History */}
      <TouchableOpacity style={s.historyBtn} onPress={() => navigation.navigate('History')}>
        <Text style={s.historyBtnText}>📋  View Meal History</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },

  header: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 24 },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  goalPreset: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  macroChip: {
    flex: 1, alignItems: 'center', backgroundColor: '#2A2A2A',
    borderRadius: 10, paddingVertical: 10, marginHorizontal: 3,
  },
  macroVal: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  macroLbl: { fontSize: 10, color: '#8A8A8A', marginTop: 2, fontWeight: '500' },
  editBtn: {
    borderWidth: 1, borderColor: '#00E5A0', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  editBtnText: { color: '#00E5A0', fontWeight: '700', fontSize: 14 },

  streakNum: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  streakSub: { fontSize: 13, color: '#8A8A8A' },

  historyBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  historyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
