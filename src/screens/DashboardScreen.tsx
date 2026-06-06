import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useMealContext } from '../context/MealContext';
import type { RootStackParamList } from '../../App';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

const PERIOD_ORDER: MealPeriod[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const PERIOD_LABELS: Record<MealPeriod, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

type ExerciseEntry = {
  id: string;
  name: string;
  duration: number;
  type: 'cardio' | 'strength' | 'other';
  caloriesBurned: number;
};

function getPeriodFromTimestamp(ts: string): MealPeriod {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h < 10 || (h === 10 && m < 30)) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snacks';
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Calorie Ring ─────────────────────────────────────────────────────────────

function CalorieRing({ consumed, goal, burned }: { consumed: number; goal: number; burned: number }) {
  const SIZE = 200;
  const R = 80;
  const STROKE = 14;
  const circumference = 2 * Math.PI * R;
  const net = consumed - burned;
  const progress = Math.min(Math.max(net, 0) / goal, 1);
  const remaining = Math.max(goal - net, 0);
  const over = net > goal;
  const ringColor = over ? '#FF4444' : net / goal > 0.9 ? '#FF9500' : '#00E5A0';

  return (
    <View style={ring.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke="#2A2A2A" strokeWidth={STROKE} fill="none"
        />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          stroke={ringColor} strokeWidth={STROKE} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          transform={`rotate(-90, ${SIZE / 2}, ${SIZE / 2})`}
        />
      </Svg>
      <View style={ring.center}>
        <Text style={[ring.bigNum, over && ring.bigNumOver]}>{remaining}</Text>
        <Text style={ring.label}>{over ? 'over goal' : 'cal remaining'}</Text>
        <Text style={ring.sub}>{consumed} eaten{burned > 0 ? ` · ${burned} burned` : ''}</Text>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  wrapper: { alignItems: 'center', position: 'relative' },
  center: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  bigNum: { fontSize: 38, fontWeight: '900', color: '#FFFFFF' },
  bigNumOver: { color: '#FF4444' },
  label: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
  sub: { fontSize: 11, color: '#555', marginTop: 4 },
});

// ─── Macro Bar ────────────────────────────────────────────────────────────────

const MACRO_COLORS: Record<string, string> = {
  Protein: '#4A90D9',
  Carbs: '#FF9500',
  Fat: '#FFD700',
};

function MacroBar({ label, consumed, goal }: { label: string; consumed: number; goal: number }) {
  const progress = Math.min(consumed / Math.max(goal, 1), 1);
  const color = MACRO_COLORS[label] ?? '#00E5A0';
  const over = consumed > goal;
  return (
    <View style={mb.row}>
      <Text style={mb.label}>{label}</Text>
      <View style={mb.barTrack}>
        <View style={[mb.barFill, { width: `${progress * 100}%` as any }, over && mb.barOver, { backgroundColor: color }]} />
      </View>
      <Text style={mb.nums}>{consumed}<Text style={mb.goal}>/{goal}g</Text></Text>
    </View>
  );
}

const mb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  label: { width: 56, fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#2A2A2A', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barOver: { backgroundColor: '#FF4444' },
  nums: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', minWidth: 64, textAlign: 'right' },
  goal: { fontSize: 11, fontWeight: '400', color: '#8A8A8A' },
});

// ─── Water Tracker ────────────────────────────────────────────────────────────

function WaterTracker({ cups, onToggle }: { cups: number; onToggle: (i: number) => void }) {
  return (
    <View style={wt.row}>
      <Text style={wt.icon}>💧</Text>
      <View style={wt.cups}>
        {Array.from({ length: 8 }, (_, i) => (
          <TouchableOpacity key={i} onPress={() => onToggle(i)} style={wt.cup}>
            <Text style={[wt.cupIcon, i < cups ? wt.cupFilled : wt.cupEmpty]}>
              {i < cups ? '🥤' : '○'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={wt.total}>{cups * 8}<Text style={wt.totalUnit}>/64oz</Text></Text>
    </View>
  );
}

const wt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 20 },
  cups: { flex: 1, flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  cup: { padding: 4 },
  cupIcon: { fontSize: 18 },
  cupFilled: { opacity: 1 },
  cupEmpty: { color: '#4A4A4A', fontWeight: '300' },
  total: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  totalUnit: { fontSize: 11, color: '#8A8A8A', fontWeight: '400' },
});

// ─── Add Exercise Modal ───────────────────────────────────────────────────────

type ExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<ExerciseEntry, 'id'>) => void;
};

function AddExerciseModal({ visible, onClose, onAdd }: ExerciseModalProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [type, setType] = useState<'cardio' | 'strength' | 'other'>('cardio');
  const [estimating, setEstimating] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setEstimating(true);
    let kcal = 0;
    try {
      const r = await fetch(`${SERVER_URL}/estimate-exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), duration: parseInt(duration) || 30, type }),
      });
      if (r.ok) {
        const d = await r.json();
        kcal = d.caloriesBurned ?? 0;
      }
    } catch {
      // fallback estimate: ~7 cal/min cardio, ~4 strength
      const mins = parseInt(duration) || 30;
      kcal = type === 'cardio' ? mins * 7 : mins * 4;
    } finally {
      setEstimating(false);
    }
    onAdd({ name: name.trim(), duration: parseInt(duration) || 30, type, caloriesBurned: kcal });
    setName('');
    setDuration('30');
    setType('cardio');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={em.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={em.sheet}>
        <View style={em.handle} />
        <Text style={em.title}>Log Exercise</Text>

        <Text style={em.fieldLabel}>Exercise name</Text>
        <TextInput
          style={em.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Running, Weight lifting"
          placeholderTextColor="#555"
        />

        <Text style={em.fieldLabel}>Duration (minutes)</Text>
        <TextInput
          style={em.input}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          selectTextOnFocus
        />

        <Text style={em.fieldLabel}>Type</Text>
        <View style={em.typeRow}>
          {(['cardio', 'strength', 'other'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[em.typeBtn, type === t && em.typeBtnActive]}
              onPress={() => setType(t)}
            >
              <Text style={[em.typeBtnText, type === t && em.typeBtnTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[em.addBtn, (!name.trim() || estimating) && em.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!name.trim() || estimating}
        >
          {estimating
            ? <ActivityIndicator color="#0F0F0F" />
            : <Text style={em.addBtnText}>Log Exercise</Text>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
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
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#2A2A2A', alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: '#00E5A0' },
  typeBtnText: { color: '#8A8A8A', fontWeight: '600', fontSize: 14 },
  typeBtnTextActive: { color: '#0F0F0F' },
  addBtn: { backgroundColor: '#00E5A0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { mealLog, goals } = useMealContext();

  const today = new Date().toDateString();

  const todayMeals = useMemo(
    () => mealLog.filter(m => new Date(m.timestamp).toDateString() === today),
    [mealLog, today]
  );

  const todayTotals = useMemo(
    () => todayMeals.reduce(
      (acc, meal) => ({
        cal: Math.round(acc.cal + meal.totals.cal),
        protein: Math.round((acc.protein + meal.totals.protein) * 10) / 10,
        carbs: Math.round((acc.carbs + meal.totals.carbs) * 10) / 10,
        fat: Math.round((acc.fat + meal.totals.fat) * 10) / 10,
      }),
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    ),
    [todayMeals]
  );

  const streak = useMemo(() => {
    const dates = new Set(mealLog.map(m => new Date(m.timestamp).toDateString()));
    const d = new Date();
    if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let count = 0;
    while (dates.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }, [mealLog]);

  // Group today's meals by period
  const mealsByPeriod = useMemo(() => {
    const groups: Record<MealPeriod, { mealId: string; name: string; cal: number; portion: string }[]> = {
      breakfast: [], lunch: [], dinner: [], snacks: [],
    };
    for (const meal of todayMeals) {
      const period = (meal as any).period ?? getPeriodFromTimestamp(meal.timestamp);
      for (const item of meal.items) {
        groups[period as MealPeriod]?.push({ mealId: meal.id, name: item.name, cal: item.cal, portion: item.portion });
      }
    }
    return groups;
  }, [todayMeals]);

  // Water state
  const waterKey = `@dininglens_water_${today}`;
  const [waterCups, setWaterCups] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem(waterKey).then(v => setWaterCups(v ? parseInt(v) : 0)).catch(() => {});
  }, [waterKey]);

  function toggleWater(index: number) {
    const next = index < waterCups ? index : index + 1;
    setWaterCups(next);
    AsyncStorage.setItem(waterKey, String(next)).catch(() => {});
  }

  // Exercise state
  const exerciseKey = `@dininglens_exercise_${today}`;
  const [exerciseLog, setExerciseLog] = useState<ExerciseEntry[]>([]);
  const [exerciseExpanded, setExerciseExpanded] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(exerciseKey).then(raw => {
      if (raw) try { setExerciseLog(JSON.parse(raw)); } catch {}
    }).catch(() => {});
  }, [exerciseKey]);

  function addExercise(entry: Omit<ExerciseEntry, 'id'>) {
    const full: ExerciseEntry = { ...entry, id: String(Date.now()) };
    setExerciseLog(prev => {
      const next = [...prev, full];
      AsyncStorage.setItem(exerciseKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  const totalBurned = exerciseLog.reduce((a, e) => a + e.caloriesBurned, 0);

  // Micros expanded
  const [microsExpanded, setMicrosExpanded] = useState(false);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()}, Andrew</Text>
            <Text style={s.dateLabel}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          </View>
          {streak >= 2 && (
            <View style={s.streakBadge}>
              <Text style={s.streakText}>🔥 {streak}</Text>
            </View>
          )}
        </View>

        {/* Calorie ring */}
        <View style={s.ringCard}>
          <CalorieRing consumed={todayTotals.cal} goal={goals.calories} burned={totalBurned} />
          <View style={s.macroSection}>
            <MacroBar label="Protein" consumed={Math.round(todayTotals.protein)} goal={goals.protein} />
            <MacroBar label="Carbs"   consumed={Math.round(todayTotals.carbs)}   goal={goals.carbs} />
            <MacroBar label="Fat"     consumed={Math.round(todayTotals.fat)}     goal={goals.fat} />
          </View>
        </View>

        {/* Food log by period */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Today's Log</Text>
          {PERIOD_ORDER.map(period => {
            const items = mealsByPeriod[period];
            const periodCal = items.reduce((a, i) => a + i.cal, 0);
            return (
              <View key={period} style={s.periodGroup}>
                <View style={s.periodHeader}>
                  <Text style={s.periodLabel}>{PERIOD_LABELS[period]}</Text>
                  <View style={s.periodHeaderRight}>
                    {periodCal > 0 && <Text style={s.periodCal}>{periodCal} cal</Text>}
                    <TouchableOpacity
                      style={s.addItemBtn}
                      onPress={() => navigation.navigate('Search', { context: period })}
                    >
                      <Text style={s.addItemBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {items.length === 0 ? (
                  <Text style={s.emptyPeriod}>Tap + to add {PERIOD_LABELS[period].toLowerCase()}</Text>
                ) : (
                  items.map((item, i) => (
                    <TouchableOpacity
                      key={`${item.mealId}-${i}`}
                      style={s.foodItem}
                      onPress={() => navigation.navigate('Search', {
                        editMode: true,
                        mealId: item.mealId,
                        query: item.name,
                      })}
                    >
                      <Text style={s.foodItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.foodItemCal}>{item.cal} cal</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            );
          })}
        </View>

        {/* Water tracker */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Water</Text>
          <WaterTracker cups={waterCups} onToggle={toggleWater} />
        </View>

        {/* Exercise section */}
        <View style={s.card}>
          <TouchableOpacity style={s.cardHeaderRow} onPress={() => setExerciseExpanded(v => !v)}>
            <Text style={s.cardTitle}>🏃 Exercise</Text>
            <View style={s.cardHeaderRight}>
              {totalBurned > 0 && <Text style={s.burnedLabel}>{totalBurned} cal burned</Text>}
              <TouchableOpacity
                style={s.expandAddBtn}
                onPress={e => { e.stopPropagation?.(); setShowExerciseModal(true); }}
              >
                <Text style={s.expandAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          {exerciseExpanded && (
            exerciseLog.length === 0 ? (
              <Text style={s.emptyPeriod}>No exercise logged today</Text>
            ) : (
              exerciseLog.map(e => (
                <View key={e.id} style={s.exerciseItem}>
                  <Text style={s.exerciseName}>{e.name}</Text>
                  <Text style={s.exerciseDetail}>{e.duration} min · {e.caloriesBurned} cal</Text>
                </View>
              ))
            )
          )}
        </View>

        {/* Micros section */}
        <View style={[s.card, s.cardLast]}>
          <TouchableOpacity style={s.cardHeaderRow} onPress={() => setMicrosExpanded(v => !v)}>
            <Text style={s.cardTitle}>Micronutrients</Text>
            <Text style={s.chevron}>{microsExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {microsExpanded && (
            <Text style={s.microsEmpty}>
              Log more meals with USDA data to see micronutrient breakdown
            </Text>
          )}
        </View>

      </ScrollView>

      <AddExerciseModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onAdd={addExercise}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0F0F' },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  dateLabel: { fontSize: 13, color: '#8A8A8A', marginTop: 2 },
  streakBadge: {
    backgroundColor: '#2A2A2A', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 4,
  },
  streakText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  ringCard: {
    backgroundColor: '#1A1A1A', borderRadius: 20, marginHorizontal: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 14,
  },
  macroSection: { width: '100%', marginTop: 24 },

  section: { marginHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },

  periodGroup: {
    backgroundColor: '#1A1A1A', borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden',
  },
  periodHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  periodHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodLabel: { fontSize: 14, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.8 },
  periodCal: { fontSize: 12, color: '#8A8A8A' },
  addItemBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
  },
  addItemBtnText: { fontSize: 18, color: '#00E5A0', lineHeight: 22, fontWeight: '300' },

  emptyPeriod: { fontSize: 13, color: '#4A4A4A', paddingHorizontal: 16, paddingVertical: 14 },

  foodItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: '#222',
  },
  foodItemName: { flex: 1, fontSize: 14, color: '#FFFFFF', marginRight: 12 },
  foodItemCal: { fontSize: 13, color: '#8A8A8A', fontWeight: '600' },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 16, marginHorizontal: 16, padding: 18,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 14,
  },
  cardLast: { marginBottom: 0 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  burnedLabel: { fontSize: 12, color: '#8A8A8A' },
  expandAddBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
  },
  expandAddBtnText: { fontSize: 18, color: '#00E5A0', lineHeight: 22, fontWeight: '300' },
  chevron: { fontSize: 12, color: '#8A8A8A' },

  exerciseItem: {
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#2A2A2A', marginTop: 12,
  },
  exerciseName: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginBottom: 2 },
  exerciseDetail: { fontSize: 12, color: '#8A8A8A' },

  microsEmpty: { fontSize: 13, color: '#4A4A4A', marginTop: 12, lineHeight: 18 },
});
