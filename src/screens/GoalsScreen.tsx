import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, UserGoals } from '../context/MealContext';
import { API_BASE_URL } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Goals'>;

type GoalKey = 'lose' | 'maintain' | 'build';
type Step = 'goal' | 'profile' | 'activity' | 'result' | 'manual';

const GOALS_KEY   = '@dininglens_goals';
const PROFILE_KEY = '@dininglens_profile';

const GOAL_CARDS: { key: GoalKey; emoji: string; label: string; desc: string }[] = [
  { key: 'lose',     emoji: '🔥', label: 'Lose Weight',    desc: 'Burn fat and slim down' },
  { key: 'maintain', emoji: '⚖️', label: 'Stay the Same',  desc: 'Maintain my current weight' },
  { key: 'build',    emoji: '💪', label: 'Build Muscle',   desc: 'Get stronger and gain mass' },
];

function fmtCal(n: number) {
  return n >= 1000
    ? `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}`
    : String(n);
}

// ─── Small reusable components ────────────────────────────────────────────────

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.backLink} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Text style={s.backLinkText}>← Back</Text>
    </TouchableOpacity>
  );
}

function UnitToggle({
  left, right, active, onToggle,
}: { left: string; right: string; active: 'left' | 'right'; onToggle: () => void }) {
  return (
    <TouchableOpacity style={s.unitToggle} onPress={onToggle} activeOpacity={0.7}>
      <View style={[s.unitOpt, active === 'left'  && s.unitOptActive]}>
        <Text style={[s.unitOptText, active === 'left'  && s.unitOptTextActive]}>{left}</Text>
      </View>
      <View style={[s.unitOpt, active === 'right' && s.unitOptActive]}>
        <Text style={[s.unitOptText, active === 'right' && s.unitOptTextActive]}>{right}</Text>
      </View>
    </TouchableOpacity>
  );
}

function NumInput({
  value, onChangeText, placeholder, suffix, style: extraStyle, maxLength,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  style?: object;
  maxLength?: number;
}) {
  return (
    <View style={[s.numInputWrap, extraStyle]}>
      <TextInput
        style={s.numInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        placeholder={placeholder ?? '—'}
        placeholderTextColor="#555"
        selectTextOnFocus
        maxLength={maxLength ?? 5}
      />
      {suffix ? <Text style={s.numSuffix}>{suffix}</Text> : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GoalsScreen({ navigation }: Props) {
  const { setGoals } = useMealContext();

  const [step, setStep] = useState<Step>('goal');

  // Step 1 — goal
  const [selectedGoal, setSelectedGoal] = useState<GoalKey>('maintain');

  // Step 2 — profile
  const [useMetric, setUseMetric] = useState(false);
  const [heightFt,  setHeightFt]  = useState('5');
  const [heightIn,  setHeightIn]  = useState('10');
  const [heightCm,  setHeightCm]  = useState('');
  const [useKg,     setUseKg]     = useState(false);
  const [weight,    setWeight]    = useState('');
  const [age,       setAge]       = useState('');
  const [sex,       setSex]       = useState<'male' | 'female' | null>(null);

  // Step 3 — activity
  const [activityDesc,  setActivityDesc]  = useState('');
  const [calculating,   setCalculating]   = useState(false);
  const [calcError,     setCalcError]     = useState<string | null>(null);

  // Step 4 — AI result
  const [aiResult, setAiResult] = useState<{
    explanation: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);

  // Manual override / power user path
  const [manCal,     setManCal]     = useState('2200');
  const [manProtein, setManProtein] = useState('150');
  const [manCarbs,   setManCarbs]   = useState('220');
  const [manFat,     setManFat]     = useState('70');

  // ── Load existing data on mount (returning user editing from Profile) ────────
  useEffect(() => {
    AsyncStorage.getItem(GOALS_KEY).then(raw => {
      if (!raw) return;
      try {
        const g = JSON.parse(raw) as UserGoals;
        if (GOAL_CARDS.find(c => c.key === g.preset)) setSelectedGoal(g.preset);
        setManCal(String(g.calories));
        setManProtein(String(g.protein));
        setManCarbs(String(g.carbs));
        setManFat(String(g.fat));
      } catch {}
    });
    AsyncStorage.getItem(PROFILE_KEY).then(raw => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        setUseMetric(p.useMetric ?? false);
        setHeightFt(p.heightFt ? String(p.heightFt) : '5');
        setHeightIn(p.heightIn ? String(p.heightIn) : '10');
        setHeightCm(p.heightCm ? String(p.heightCm) : '');
        setUseKg(p.useKg ?? false);
        setWeight(p.weight ? String(p.weight) : '');
        setAge(p.age ? String(p.age) : '');
        setSex(p.sex ?? null);
        setActivityDesc(p.activityDescription ?? '');
      } catch {}
    });
  }, []);

  // ── Unit toggles with auto-conversion ────────────────────────────────────────
  function toggleMetric() {
    if (!useMetric) {
      const ft = parseInt(heightFt) || 5;
      const inches = parseInt(heightIn) || 10;
      setHeightCm(String(Math.round((ft * 12 + inches) * 2.54)));
    } else {
      const totalIn = Math.round((parseFloat(heightCm) || 178) / 2.54);
      setHeightFt(String(Math.floor(totalIn / 12)));
      setHeightIn(String(totalIn % 12));
    }
    setUseMetric(v => !v);
  }

  function toggleKg() {
    const cur = parseFloat(weight);
    if (!useKg && cur > 0) setWeight(String(Math.round(cur / 2.205)));
    else if (useKg && cur > 0) setWeight(String(Math.round(cur * 2.205)));
    setUseKg(v => !v);
  }

  // ── Profile complete check ────────────────────────────────────────────────────
  const profileComplete =
    !!sex &&
    !!(parseInt(age) >= 10) &&
    !!(parseFloat(weight) > 0) &&
    !!(useMetric
      ? parseFloat(heightCm) > 0
      : (parseInt(heightFt) > 0));

  // ── TDEE calculation ─────────────────────────────────────────────────────────
  async function handleCalculate() {
    if (!profileComplete) return;
    setCalculating(true);
    setCalcError(null);

    const ft = parseInt(heightFt) || 5;
    const inches = parseInt(heightIn) || 10;
    const cm = useMetric
      ? parseFloat(heightCm)
      : Math.round((ft * 12 + inches) * 2.54);
    const kg = useKg
      ? parseFloat(weight)
      : parseFloat(weight) / 2.205;

    try {
      const res = await fetch(`${API_BASE_URL}/calculate-tdee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          height_cm: Math.round(cm),
          weight_kg: Math.round(kg * 10) / 10,
          age: parseInt(age),
          sex,
          goal: selectedGoal,
          activityDescription: activityDesc.trim(),
        }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      setAiResult({
        explanation: data.explanation,
        calories:    data.calories,
        protein:     data.protein,
        carbs:       data.carbs,
        fat:         data.fat,
      });
      setStep('result');
    } catch {
      setCalcError('Calculation failed — try again or set your targets manually.');
    } finally {
      setCalculating(false);
    }
  }

  // ── Save helpers ──────────────────────────────────────────────────────────────
  async function saveAndGo(cal: number, protein: number, carbs: number, fat: number) {
    const g: UserGoals = { preset: selectedGoal, calories: cal, protein, carbs, fat };
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(g));
    setGoals(g);

    const profile = {
      useMetric, heightFt: parseInt(heightFt) || 0, heightIn: parseInt(heightIn) || 0,
      heightCm: parseFloat(heightCm) || 0,
      useKg, weight: parseFloat(weight) || 0,
      age: parseInt(age) || 0,
      sex,
      activityDescription: activityDesc,
    };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(() => {});
    navigation.navigate('MainTabs');
  }

  async function saveManual() {
    const cal     = parseInt(manCal)     || 2200;
    const protein = parseInt(manProtein) || 150;
    const carbs   = parseInt(manCarbs)   || 220;
    const fat     = parseInt(manFat)     || 70;
    const g: UserGoals = { preset: selectedGoal, calories: cal, protein, carbs, fat };
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(g));
    setGoals(g);
    navigation.navigate('MainTabs');
  }

  function openManualFromResult() {
    if (aiResult) {
      setManCal(String(aiResult.calories));
      setManProtein(String(aiResult.protein));
      setManCarbs(String(aiResult.carbs));
      setManFat(String(aiResult.fat));
    }
    setStep('manual');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Step 1 — Goal selection ───────────────────────────────────────────────────
  if (step === 'goal') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>What's your goal?</Text>
          <Text style={s.subtitle}>We'll calculate your personal targets in 3 quick questions.</Text>

          {GOAL_CARDS.map(card => {
            const active = selectedGoal === card.key;
            return (
              <TouchableOpacity
                key={card.key}
                style={[s.card, active && s.cardActive]}
                onPress={() => setSelectedGoal(card.key)}
                activeOpacity={0.8}
              >
                <View style={s.cardLeft}>
                  <Text style={s.cardEmoji}>{card.emoji}</Text>
                  <View>
                    <Text style={[s.cardLabel, active && s.cardLabelActive]}>{card.label}</Text>
                    <Text style={s.cardDesc}>{card.desc}</Text>
                  </View>
                </View>
                {active && <View style={s.dot} />}
              </TouchableOpacity>
            );
          })}

          {/* Power-user escape hatch */}
          <TouchableOpacity
            style={[s.card, s.cardEscape]}
            onPress={() => setStep('manual')}
            activeOpacity={0.8}
          >
            <View style={s.cardLeft}>
              <Text style={s.cardEmoji}>⚙️</Text>
              <View>
                <Text style={s.cardLabel}>I know what I'm doing</Text>
                <Text style={s.cardDesc}>Set my own calorie and macro targets</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.primaryBtn} onPress={() => setStep('profile')}>
            <Text style={s.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2 — Quick profile ────────────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <BackLink onPress={() => setStep('goal')} />
          <Text style={s.stepNote}>Step 1 of 2</Text>
          <Text style={s.title}>Quick profile</Text>
          <Text style={s.subtitle}>Used only to calculate your calorie needs — never shared.</Text>

          {/* Height */}
          <Text style={s.fieldLabel}>Height</Text>
          <View style={s.inlineRow}>
            {useMetric ? (
              <NumInput value={heightCm} onChangeText={setHeightCm} placeholder="178" suffix="cm" style={{ flex: 1 }} maxLength={3} />
            ) : (
              <>
                <NumInput value={heightFt} onChangeText={setHeightFt} placeholder="5" suffix="ft" style={{ flex: 1 }} maxLength={1} />
                <View style={s.rowGap} />
                <NumInput value={heightIn} onChangeText={setHeightIn} placeholder="10" suffix="in" style={{ flex: 1 }} maxLength={2} />
              </>
            )}
            <View style={s.rowGap} />
            <UnitToggle
              left="ft/in" right="cm"
              active={useMetric ? 'right' : 'left'}
              onToggle={toggleMetric}
            />
          </View>

          {/* Weight */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Weight</Text>
          <View style={s.inlineRow}>
            <NumInput
              value={weight}
              onChangeText={setWeight}
              placeholder={useKg ? '70' : '154'}
              suffix={useKg ? 'kg' : 'lbs'}
              style={{ flex: 1 }}
              maxLength={4}
            />
            <View style={s.rowGap} />
            <UnitToggle left="lbs" right="kg" active={useKg ? 'right' : 'left'} onToggle={toggleKg} />
          </View>

          {/* Age */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Age</Text>
          <NumInput value={age} onChangeText={setAge} placeholder="25" suffix="years" maxLength={3} />

          {/* Biological sex */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Biological sex</Text>
          <Text style={s.fieldNote}>Used for the BMR formula — not stored for any other purpose.</Text>
          <View style={[s.inlineRow, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[s.sexBtn, sex === 'male' && s.sexBtnActive]}
              onPress={() => setSex('male')}
            >
              <Text style={[s.sexBtnText, sex === 'male' && s.sexBtnTextActive]}>Male</Text>
            </TouchableOpacity>
            <View style={s.rowGap} />
            <TouchableOpacity
              style={[s.sexBtn, sex === 'female' && s.sexBtnActive]}
              onPress={() => setSex('female')}
            >
              <Text style={[s.sexBtnText, sex === 'female' && s.sexBtnTextActive]}>Female</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, { marginTop: 32 }, !profileComplete && s.primaryBtnDisabled]}
            onPress={() => setStep('activity')}
            disabled={!profileComplete}
          >
            <Text style={s.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.skipLink} onPress={() => setStep('manual')}>
            <Text style={s.skipLinkText}>Skip — I'll set my own targets</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 3 — Activity description ─────────────────────────────────────────────
  if (step === 'activity') {
    return (
      <View style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <BackLink onPress={() => { setCalcError(null); setStep('profile'); }} />
          <Text style={s.stepNote}>Step 2 of 2</Text>
          <Text style={s.title}>Describe your lifestyle</Text>
          <Text style={s.subtitle}>Our AI uses this to estimate how active you are — no checkboxes needed.</Text>

          <TextInput
            style={s.activityInput}
            value={activityDesc}
            onChangeText={setActivityDesc}
            placeholder="Describe a typical day — what do you do for work, how often do you exercise, how active are you outside the gym?"
            placeholderTextColor="#555"
            multiline
            textAlignVertical="top"
            maxLength={400}
          />

          <View style={s.examplesBox}>
            <Text style={s.examplesTitle}>Examples</Text>
            <Text style={s.exampleText}>"I sit at a desk all day but lift weights 4× a week and walk 20 min during lunch."</Text>
            <Text style={s.exampleText}>"I'm a nurse on my feet 12-hour shifts, 3 days a week. No structured gym time."</Text>
            <Text style={s.exampleText}>"Mostly sedentary — remote work, occasional walks on weekends."</Text>
          </View>

          {calcError !== null && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{calcError}</Text>
              <TouchableOpacity onPress={() => { setCalcError(null); setStep('manual'); }} style={s.errorLink}>
                <Text style={s.errorLinkText}>Set targets manually instead →</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, (calculating || activityDesc.trim().length < 10) && s.primaryBtnDisabled]}
            onPress={handleCalculate}
            disabled={calculating || activityDesc.trim().length < 10}
          >
            {calculating ? (
              <View style={s.loadingRow}>
                <ActivityIndicator color="#0F0F0F" size="small" />
                <Text style={[s.primaryBtnText, { marginLeft: 10 }]}>Analyzing your lifestyle…</Text>
              </View>
            ) : (
              <Text style={s.primaryBtnText}>Calculate my targets →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.skipLink} onPress={() => setStep('manual')}>
            <Text style={s.skipLinkText}>Skip — I'll set my own targets</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {calculating && (
        <View style={s.calcOverlay}>
          <ActivityIndicator size="large" color="#00E5A0" />
          <Text style={s.calcOverlayText}>Calculating your targets...</Text>
        </View>
      )}
      </View>
    );
  }

  // ── Step 4 — AI result ────────────────────────────────────────────────────────
  if (step === 'result' && aiResult) {
    const goalLabel = GOAL_CARDS.find(c => c.key === selectedGoal)?.label ?? 'your goal';
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <BackLink onPress={() => setStep('activity')} />
        <Text style={s.title}>Here's what we recommend</Text>

        {/* AI explanation */}
        <View style={s.explanationBox}>
          <Text style={s.explanationText}>{aiResult.explanation}</Text>
        </View>

        {/* Goal badge */}
        <View style={s.goalBadge}>
          <Text style={s.goalBadgeText}>{GOAL_CARDS.find(c => c.key === selectedGoal)?.emoji} {goalLabel}</Text>
        </View>

        {/* Big calorie number */}
        <View style={s.calCard}>
          <Text style={s.calNum}>{fmtCal(aiResult.calories)}</Text>
          <Text style={s.calLabel}>calories per day</Text>
        </View>

        {/* Macro breakdown */}
        <View style={s.macroRow}>
          <View style={[s.macroChip, { backgroundColor: '#1A3A1A' }]}>
            <Text style={[s.macroChipVal, { color: '#5CFF7C' }]}>{aiResult.protein}g</Text>
            <Text style={s.macroChipLabel}>protein</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: '#3A2800' }]}>
            <Text style={[s.macroChipVal, { color: '#FFA040' }]}>{aiResult.carbs}g</Text>
            <Text style={s.macroChipLabel}>carbs</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: '#3A1010' }]}>
            <Text style={[s.macroChipVal, { color: '#FF6B6B' }]}>{aiResult.fat}g</Text>
            <Text style={s.macroChipLabel}>fat</Text>
          </View>
        </View>

        <Text style={s.disclaimer}>These are estimates. Adjust anytime in your profile.</Text>

        <TouchableOpacity style={s.primaryBtn} onPress={() => saveAndGo(aiResult.calories, aiResult.protein, aiResult.carbs, aiResult.fat)}>
          <Text style={s.primaryBtnText}>Looks good — let's go ✓</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.secondaryBtn, { marginTop: 12 }]} onPress={openManualFromResult}>
          <Text style={s.secondaryBtnText}>Adjust these numbers</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Manual entry (power user or override) ─────────────────────────────────────
  // step === 'manual'
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackLink onPress={() => setStep(aiResult ? 'result' : 'goal')} />
        <Text style={s.title}>Set your targets</Text>
        <Text style={s.subtitle}>Enter the daily numbers you want to hit.</Text>

        {([
          { label: 'Calories', value: manCal,     set: setManCal,     unit: 'cal' },
          { label: 'Protein',  value: manProtein,  set: setManProtein,  unit: 'g'   },
          { label: 'Carbs',    value: manCarbs,    set: setManCarbs,    unit: 'g'   },
          { label: 'Fat',      value: manFat,      set: setManFat,      unit: 'g'   },
        ] as const).map(field => (
          <View key={field.label} style={s.manualRow}>
            <Text style={s.manualLabel}>{field.label}</Text>
            <View style={s.numInputWrap}>
              <TextInput
                style={s.numInput}
                value={field.value}
                onChangeText={field.set}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={5}
              />
              <Text style={s.numSuffix}>{field.unit}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={[s.primaryBtn, { marginTop: 32 }]} onPress={saveManual}>
          <Text style={s.primaryBtnText}>Save targets</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  content: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 60 },

  backLink: { marginBottom: 20 },
  backLinkText: { fontSize: 15, color: '#8A8A8A', fontWeight: '500' },

  stepNote: { fontSize: 12, color: '#555', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  title:    { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8A8A8A', marginBottom: 28, lineHeight: 22 },

  // Goal cards
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 2, borderColor: '#2A2A2A',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardActive:  { borderColor: '#00E5A0' },
  cardEscape:  { borderColor: '#2A2A2A', borderStyle: 'dashed', opacity: 0.7 },
  cardLeft:    { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  cardEmoji:   { fontSize: 26 },
  cardLabel:   { fontSize: 17, fontWeight: '700', color: '#8A8A8A', marginBottom: 3 },
  cardLabelActive: { color: '#FFFFFF' },
  cardDesc:    { fontSize: 13, color: '#555' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#00E5A0' },

  // Buttons
  primaryBtn: {
    backgroundColor: '#00E5A0', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#0F0F0F', fontSize: 17, fontWeight: '700' },

  secondaryBtn: {
    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', backgroundColor: '#1A1A1A',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  skipLink:     { paddingVertical: 14, alignItems: 'center' },
  skipLinkText: { fontSize: 14, color: '#555' },

  // Profile form
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#8A8A8A', marginBottom: 8 },
  fieldNote:  { fontSize: 12, color: '#444', marginBottom: 4, lineHeight: 16 },

  inlineRow: { flexDirection: 'row', alignItems: 'center' },
  rowGap:    { width: 10 },

  numInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  numInput:     { fontSize: 18, fontWeight: '700', color: '#FFFFFF', minWidth: 44, textAlign: 'center', padding: 0 },
  numSuffix:    { fontSize: 13, color: '#8A8A8A', fontWeight: '500' },

  unitToggle: { flexDirection: 'row', backgroundColor: '#2A2A2A', borderRadius: 8, overflow: 'hidden' },
  unitOpt:         { paddingHorizontal: 10, paddingVertical: 8 },
  unitOptActive:   { backgroundColor: '#00E5A0' },
  unitOptText:     { fontSize: 12, fontWeight: '700', color: '#8A8A8A' },
  unitOptTextActive: { color: '#0F0F0F' },

  sexBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  sexBtnActive:     { borderColor: '#00E5A0', backgroundColor: '#0A2A1A' },
  sexBtnText:       { fontSize: 16, fontWeight: '700', color: '#8A8A8A' },
  sexBtnTextActive: { color: '#00E5A0' },

  // Activity step
  activityInput: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    fontSize: 15, color: '#FFFFFF', lineHeight: 22,
    borderWidth: 1, borderColor: '#2A2A2A',
    minHeight: 140, marginBottom: 16,
  },
  examplesBox: {
    backgroundColor: '#0F1A0F', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1A3A1A', marginBottom: 20,
  },
  examplesTitle: { fontSize: 11, fontWeight: '700', color: '#5CFF7C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  exampleText:   { fontSize: 13, color: '#6A9A6A', marginBottom: 6, lineHeight: 18, fontStyle: 'italic' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  errorBox:  { backgroundColor: '#2A1010', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#5A2020' },
  errorText: { fontSize: 14, color: '#FF6B6B', marginBottom: 8 },
  errorLink: {},
  errorLinkText: { fontSize: 13, color: '#FF9500', fontWeight: '600' },

  // Result step
  explanationBox: {
    backgroundColor: '#0A2A1A', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1A4A2A', marginBottom: 20,
  },
  explanationText: { fontSize: 15, color: '#AAFFCC', lineHeight: 22 },

  goalBadge: {
    alignSelf: 'flex-start', backgroundColor: '#1A1A1A',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20,
  },
  goalBadgeText: { fontSize: 13, fontWeight: '700', color: '#8A8A8A' },

  calCard: {
    backgroundColor: '#1A1A1A', borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  calNum:   { fontSize: 52, fontWeight: '900', color: '#FFFFFF' },
  calLabel: { fontSize: 16, color: '#8A8A8A', marginTop: 4 },

  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  macroChip: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  macroChipVal:   { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  macroChipLabel: { fontSize: 11, color: '#8A8A8A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  disclaimer: { fontSize: 12, color: '#444', textAlign: 'center', marginBottom: 24 },

  // Manual step
  manualRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  manualLabel: { fontSize: 16, color: '#FFFFFF', fontWeight: '600', flex: 1 },

  // Calculating overlay
  calcOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,15,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  calcOverlayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
