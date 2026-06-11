import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useMealContext } from '../context/MealContext';
import type { RootStackParamList } from '../../App';
import { useEntitlement } from '../hooks/useEntitlement';
import { listCustomFoods, deleteCustomFood } from '../services/customFoodService';
import { getLatestWeight, addWeightEntry, getTrend } from '../services/weightService';
import type { WeightTrend } from '../services/weightService';
import type { StoredCustomFood, StoredWeightEntry } from '../storage/schema';

const APP_VERSION = '1.0.0-beta';

const PRESET_LABELS: Record<string, string> = {
  lose:          '🔥 Lose Fat',
  maintain:      '⚖️ Maintain Weight',
  build:         '💪 Build Muscle',
  recomposition: '🔄 Recompose',
};

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { goals, mealLog, deleteMeal, resetDayStats } = useMealContext();
  const { entitlement } = useEntitlement();
  const debugTaps = useRef(0);
  const debugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customFoods, setCustomFoods] = useState<StoredCustomFood[]>([]);
  const [showAllCustomFoods, setShowAllCustomFoods] = useState(false);
  const [latestWeight, setLatestWeight] = useState<StoredWeightEntry | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightNote, setWeightNote] = useState('');

  const refreshCustomFoods = useCallback(() => {
    listCustomFoods().then(setCustomFoods).catch(() => {});
  }, []);

  const refreshWeight = useCallback(() => {
    getLatestWeight().then(setLatestWeight).catch(() => {});
    getTrend().then(setWeightTrend).catch(() => {});
  }, []);

  // Tab screens stay mounted, so reload on every focus — custom foods created in
  // SearchScreen and weights logged elsewhere must appear without an app restart.
  useFocusEffect(useCallback(() => {
    refreshCustomFoods();
    refreshWeight();
  }, [refreshCustomFoods, refreshWeight]));

  function handleLogWeight() {
    const w = parseFloat(weightInput);
    if (!w || w <= 0) return;
    addWeightEntry(w, undefined, weightNote.trim() || undefined)
      .then(() => {
        setWeightInput('');
        setWeightNote('');
        setShowWeightModal(false);
        refreshWeight();
      })
      .catch(() => {});
  }

  function handleDeleteCustomFood(id: string) {
    Alert.alert('Remove saved food?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          deleteCustomFood(id).then(refreshCustomFoods).catch(() => {});
        },
      },
    ]);
  }

  function trialStatusText(): string | null {
    if (!entitlement) return null;
    if (entitlement.status === 'trialing') {
      const ms   = new Date(entitlement.trialEndsAt).getTime() - Date.now();
      const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
      return days > 0 ? `Free trial — ${days} day${days === 1 ? '' : 's'} remaining` : 'Trial expired';
    }
    if (entitlement.canUseApp) return 'Subscription active';
    return 'Trial expired';
  }

  function handleVersionTap() {
    debugTaps.current += 1;
    if (debugTimer.current) clearTimeout(debugTimer.current);
    debugTimer.current = setTimeout(() => { debugTaps.current = 0; }, 2000);
    if (debugTaps.current >= 5) {
      debugTaps.current = 0;
      navigation.navigate('Debug');
    }
  }

  const streak = React.useMemo(() => {
    const dates = new Set(mealLog.map(m => new Date(m.timestamp).toDateString()));
    const d = new Date();
    if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let count = 0;
    while (dates.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }, [mealLog]);

  const todayMeals = React.useMemo(() => {
    const today = new Date().toDateString();
    return mealLog.filter(m => new Date(m.timestamp).toDateString() === today);
  }, [mealLog]);

  function resetToday() {
    Alert.alert(
      'Reset Today\'s Log',
      `Delete all ${todayMeals.length} meal${todayMeals.length === 1 ? '' : 's'} logged today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            todayMeals.forEach(m => deleteMeal(m.id));
            resetDayStats();
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        {trialStatusText() !== null && (
          <Text style={s.trialStatus}>{trialStatusText()}</Text>
        )}
      </View>

      {/* Streak card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Logging Streak</Text>
        <Text style={s.streakNum}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
        <Text style={s.streakSub}>
          {streak >= 2 ? `${streak} days in a row!` : streak === 1 ? 'Logged today — keep it up!' : 'Log a meal to start your streak'}
        </Text>
      </View>

      {/* Stats */}
      <View style={s.card}>
        <Text style={s.cardTitle}>All Time</Text>
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{mealLog.length}</Text>
            <Text style={s.statLbl}>meals logged</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statVal}>{todayMeals.length}</Text>
            <Text style={s.statLbl}>today</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statVal}>{streak}</Text>
            <Text style={s.statLbl}>day streak</Text>
          </View>
        </View>
        {todayMeals.length > 0 && (
          <TouchableOpacity style={s.resetBtn} onPress={resetToday}>
            <Text style={s.resetBtnText}>Reset today's log</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* History */}
      <TouchableOpacity style={s.historyBtn} onPress={() => navigation.navigate('History')}>
        <Text style={s.historyBtnText}>📋  View Meal History</Text>
      </TouchableOpacity>

      {/* Weight */}
      <View style={[s.card, { marginTop: 16 }]}>
        <View style={s.myFoodsHeader}>
          <Text style={s.cardTitle}>Weight</Text>
          {weightTrend !== null && (
            <Text style={[s.trendBadge,
              weightTrend === 'up' ? s.trendUp : weightTrend === 'down' ? s.trendDown : s.trendFlat
            ]}>
              {weightTrend === 'up' ? '▲ trending up' : weightTrend === 'down' ? '▼ trending down' : '→ stable'}
            </Text>
          )}
        </View>
        {latestWeight !== null ? (
          <Text style={s.weightDisplay}>{latestWeight.weightLbs} lbs</Text>
        ) : (
          <Text style={s.myFoodsEmpty}>No weight entries yet</Text>
        )}
        <TouchableOpacity style={[s.editBtn, { marginTop: 12 }]} onPress={() => setShowWeightModal(true)}>
          <Text style={s.editBtnText}>Log weight</Text>
        </TouchableOpacity>
      </View>

      {/* My Foods */}
      <View style={[s.card, { marginTop: 0 }]}>
        <View style={s.myFoodsHeader}>
          <Text style={s.cardTitle}>My Foods</Text>
          <Text style={s.myFoodsCount}>{customFoods.length} saved</Text>
        </View>
        {customFoods.length === 0 ? (
          <Text style={s.myFoodsEmpty}>Foods you log manually are saved here for quick re-use</Text>
        ) : (
          <>
            {(showAllCustomFoods ? customFoods : customFoods.slice(0, 4)).map(f => (
              <View key={f.id} style={s.myFoodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.myFoodName} numberOfLines={1}>{f.name}</Text>
                  <Text style={s.myFoodMeta}>{f.calories} cal · used {f.useCount}×</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteCustomFood(f.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.myFoodDelete}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {customFoods.length > 4 && (
              <TouchableOpacity onPress={() => setShowAllCustomFoods(v => !v)} style={s.showMoreBtn}>
                <Text style={s.showMoreText}>
                  {showAllCustomFoods ? 'Show less' : `Show all ${customFoods.length} foods`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* HealthKit notice */}
      <View style={s.hkNotice}>
        <Text style={s.hkNoticeText}>
          HealthKit integration is not active in this beta. Exercise calorie burns are AI estimates only.
        </Text>
      </View>

      {/* Version — tap 5× to open debug screen */}
      <TouchableOpacity onPress={handleVersionTap} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
        <Text style={s.version}>DiningLens {APP_VERSION}</Text>
      </TouchableOpacity>
    </ScrollView>

    {/* Log Weight Modal */}
    <Modal visible={showWeightModal} transparent animationType="slide" onRequestClose={() => setShowWeightModal(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={wm.backdrop} activeOpacity={1} onPress={() => setShowWeightModal(false)} />
        <View style={wm.sheet}>
          <View style={wm.handle} />
          <Text style={wm.title}>Log Weight</Text>
          <Text style={wm.fieldLabel}>Weight (lbs)</Text>
          <TextInput
            style={wm.input}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder="175.5"
            placeholderTextColor="#555"
            autoFocus
            selectTextOnFocus
          />
          <Text style={wm.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={wm.input}
            value={weightNote}
            onChangeText={setWeightNote}
            placeholder="morning, post-workout…"
            placeholderTextColor="#555"
          />
          <TouchableOpacity
            style={[wm.saveBtn, !weightInput.trim() && wm.saveBtnDisabled]}
            onPress={handleLogWeight}
            disabled={!weightInput.trim()}
          >
            <Text style={wm.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
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

  trialStatus: { fontSize: 11, color: '#8A8A8A', marginTop: 10, textAlign: 'center' },

  streakNum: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  streakSub: { fontSize: 13, color: '#8A8A8A' },

  historyBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  historyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  statLbl: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
  resetBtn: {
    marginTop: 14, paddingVertical: 10, alignItems: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: '#3A1A1A',
  },
  resetBtnText: { color: '#FF6B6B', fontSize: 13, fontWeight: '600' },

  myFoodsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  myFoodsCount: { fontSize: 12, color: '#8A8A8A', fontWeight: '600' },
  myFoodsEmpty: { fontSize: 13, color: '#555', lineHeight: 18 },
  myFoodRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2A2A2A',
  },
  myFoodName: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  myFoodMeta: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
  myFoodDelete: { fontSize: 14, color: '#555', paddingHorizontal: 6 },
  showMoreBtn: { paddingTop: 10, alignItems: 'center' },
  showMoreText: { fontSize: 13, color: '#00E5A0', fontWeight: '600' },

  weightDisplay: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  trendBadge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  trendUp: { color: '#FF6B6B', backgroundColor: '#2A1010' },
  trendDown: { color: '#00E5A0', backgroundColor: '#0A2A1A' },
  trendFlat: { color: '#8A8A8A', backgroundColor: '#2A2A2A' },

  hkNotice: {
    marginTop: 16, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  hkNoticeText: { fontSize: 12, color: '#555', lineHeight: 18 },

  version: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 32 },
});

const wm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: '#2A2A2A',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: '#FFFFFF', marginBottom: 18,
  },
  saveBtn: { backgroundColor: '#00E5A0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});
