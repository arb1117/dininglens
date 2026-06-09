import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, UserGoals } from '../context/MealContext';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getJSON, setJSON } from '../storage/storageClient';
import { seedWeightFromProfile } from '../services/weightService';
import {
  ActivityLevel,
  ACTIVITY_LABELS,
  ACTIVITY_DESCRIPTIONS,
  calculateAll,
  estimateActivityLevel,
  goalKeyToBodyGoal,
} from '../utils/nutritionCalculator';

type Props = NativeStackScreenProps<RootStackParamList, 'Goals'>;

type GoalKey = 'lose' | 'maintain' | 'build' | 'recomposition';
type Step = 'goal' | 'profile' | 'activity' | 'result' | 'manual';

const GOAL_CARDS: { key: GoalKey; emoji: string; label: string; desc: string }[] = [
  { key: 'lose',          emoji: '🔥', label: 'Lose Fat',         desc: 'Burn fat with a calorie deficit' },
  { key: 'maintain',      emoji: '⚖️', label: 'Maintain Weight',   desc: 'Stay at my current weight' },
  { key: 'build',         emoji: '💪', label: 'Build Muscle',      desc: 'Get stronger and gain mass' },
  { key: 'recomposition', emoji: '🔄', label: 'Recompose',         desc: 'Lose fat and build muscle together' },
];

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active',
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
  const [sex,       setSex]       = useState<'male' | 'female' | 'other' | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Step 3 — activity (structured + free text)
  const [dailySteps,       setDailySteps]       = useState('');
  const [workoutsPerWeek,  setWorkoutsPerWeek]  = useState('');
  const [workoutIntensity, setWorkoutIntensity] = useState<'light' | 'moderate' | 'intense' | null>(null);
  const [jobType,          setJobType]          = useState<'desk' | 'lightly_active' | 'very_active' | null>(null);
  const [activityDesc,     setActivityDesc]     = useState('');
  const [activityLevel,    setActivityLevel]    = useState<ActivityLevel>('moderately_active');
  const [levelOverridden,  setLevelOverridden]  = useState(false);

  // Step 4 — calculated result
  const [calcResult, setCalcResult] = useState<{
    explanation: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    bmr: number;
    tdee: number;
  } | null>(null);

  // Manual override / power user path
  const [manCal,     setManCal]     = useState('2200');
  const [manProtein, setManProtein] = useState('150');
  const [manCarbs,   setManCarbs]   = useState('220');
  const [manFat,     setManFat]     = useState('70');

  // ── Load existing data on mount (returning user editing from Profile) ─────
  useEffect(() => {
    getJSON<UserGoals | null>(STORAGE_KEYS.GOALS, null).then(g => {
      if (!g || typeof g !== 'object') return;
      if (GOAL_CARDS.find(c => c.key === g.preset)) setSelectedGoal(g.preset as GoalKey);
      setManCal(String(g.calories));
      setManProtein(String(g.protein));
      setManCarbs(String(g.carbs));
      setManFat(String(g.fat));
    });
    getJSON<Record<string, unknown> | null>(STORAGE_KEYS.PROFILE, null).then(p => {
      if (!p || typeof p !== 'object') return;
      setUseMetric((p.useMetric as boolean) ?? false);
      setHeightFt(p.heightFt ? String(p.heightFt) : '5');
      setHeightIn(p.heightIn ? String(p.heightIn) : '10');
      setHeightCm(p.heightCm ? String(p.heightCm) : '');
      setUseKg((p.useKg as boolean) ?? false);
      setWeight(p.weight ? String(p.weight) : '');
      setAge(p.age ? String(p.age) : '');
      setSex((p.sex as 'male' | 'female' | 'other' | null) ?? null);
      setActivityDesc((p.activityDescription as string) ?? '');
      if (p.dailySteps) setDailySteps(String(p.dailySteps));
      if (p.workoutsPerWeek !== undefined) setWorkoutsPerWeek(String(p.workoutsPerWeek));
      if (p.workoutIntensity) setWorkoutIntensity(p.workoutIntensity as 'light' | 'moderate' | 'intense');
      if (p.jobType) setJobType(p.jobType as 'desk' | 'lightly_active' | 'very_active');
      if (p.activityLevel) setActivityLevel(p.activityLevel as typeof activityLevel);
    });
  }, []);

  // ── Re-estimate activity level whenever structured fields change ──────────
  useEffect(() => {
    if (levelOverridden) return;
    const estimated = estimateActivityLevel({
      dailySteps:      dailySteps ? parseInt(dailySteps) : undefined,
      workoutsPerWeek: workoutsPerWeek ? parseInt(workoutsPerWeek) : undefined,
      workoutIntensity: workoutIntensity ?? undefined,
      jobType:         jobType ?? undefined,
      description:     activityDesc,
    });
    setActivityLevel(estimated);
  }, [dailySteps, workoutsPerWeek, workoutIntensity, jobType, activityDesc, levelOverridden]);

  // ── Unit toggles with auto-conversion ────────────────────────────────────
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

  // ── Profile validation ────────────────────────────────────────────────────
  function validateProfile(): string | null {
    const ageN = parseInt(age);
    if (!ageN || ageN < 10 || ageN > 120) return 'Please enter a valid age (10–120).';

    const weightN = parseFloat(weight);
    if (!weightN || weightN <= 0) return 'Please enter your weight.';
    const weightLbs = useKg ? weightN * 2.205 : weightN;
    if (weightLbs < 50 || weightLbs > 700) return 'Please enter a weight between 50–700 lbs.';

    if (useMetric) {
      const cmN = parseFloat(heightCm);
      if (!cmN || cmN < 91 || cmN > 244) return 'Please enter a height between 91–244 cm.';
    } else {
      const ft = parseInt(heightFt) || 0;
      const inches = parseInt(heightIn) || 0;
      const totalIn = ft * 12 + inches;
      if (totalIn < 36 || totalIn > 96) return 'Please enter a height between 3–8 feet.';
    }

    if (!sex) return 'Please select your biological sex.';
    return null;
  }

  const profileComplete = !validateProfile();

  // ── Calculate locally ─────────────────────────────────────────────────────
  function handleCalculate() {
    const weightN   = parseFloat(weight);
    const weightLbs = useKg ? weightN * 2.205 : weightN;
    const weightKg  = useKg ? weightN : weightN / 2.205;

    const ft = parseInt(heightFt) || 5;
    const inches = parseInt(heightIn) || 10;
    const cm = useMetric
      ? parseFloat(heightCm)
      : Math.round((ft * 12 + inches) * 2.54);

    const ageN = parseInt(age);
    const bodyGoal = goalKeyToBodyGoal(selectedGoal);
    const result = calculateAll({
      weightKg: Math.round(weightKg * 10) / 10,
      weightLbs: Math.round(weightLbs * 10) / 10,
      heightCm: Math.round(cm),
      age: ageN,
      sex: sex!,
      activityLevel,
      bodyGoal,
    });

    const goalLabel = GOAL_CARDS.find(c => c.key === selectedGoal)?.label ?? 'your goal';
    const explanation =
      `Estimated from your height, weight, age, sex, and ${ACTIVITY_LABELS[activityLevel].toLowerCase()} activity level. ` +
      `Your base metabolic rate is ${fmtCal(result.bmr)} cal/day. ` +
      `With your activity level, that's ${fmtCal(result.tdee)} calories burned daily. ` +
      `Your target for "${goalLabel}" is ${fmtCal(result.calories)} cal/day.`;

    setCalcResult({ explanation, ...result });
    setStep('result');
  }

  // ── Save helpers ──────────────────────────────────────────────────────────
  async function persistProfile() {
    const weightN   = parseFloat(weight) || 0;
    const weightLbs = useKg ? weightN * 2.205 : weightN;
    const weightKg  = useKg ? weightN : weightN / 2.205;
    const ft = parseInt(heightFt) || 0;

    const profile = {
      useMetric,
      heightFt: ft,
      heightIn: parseInt(heightIn) || 0,
      heightCm: useMetric ? parseFloat(heightCm) || 0 : Math.round((ft * 12 + (parseInt(heightIn) || 0)) * 2.54),
      useKg,
      weight: weightN,
      weightLbs: Math.round(weightLbs * 10) / 10,
      weightKg: Math.round(weightKg * 10) / 10,
      age: parseInt(age) || 0,
      sex,
      activityDescription: activityDesc,
      dailySteps:      dailySteps ? parseInt(dailySteps) : undefined,
      workoutsPerWeek: workoutsPerWeek ? parseInt(workoutsPerWeek) : undefined,
      workoutIntensity: workoutIntensity ?? undefined,
      jobType:         jobType ?? undefined,
      activityLevel,
      bodyGoal:        goalKeyToBodyGoal(selectedGoal),
      calculatedCalories: calcResult?.calories,
      calculatedProtein:  calcResult?.protein,
      calculatedFat:      calcResult?.fat,
      calculatedCarbs:    calcResult?.carbs,
    };
    await setJSON(STORAGE_KEYS.PROFILE, profile);
  }

  async function saveAndGo(cal: number, protein: number, carbs: number, fat: number) {
    const g: UserGoals = { preset: selectedGoal, calories: cal, protein, carbs, fat };
    await setJSON(STORAGE_KEYS.GOALS, g);
    setGoals(g);
    await persistProfile();
    const weightN = parseFloat(weight) || 0;
    const weightLbs = useKg ? weightN * 2.205 : weightN;
    seedWeightFromProfile(weightLbs).catch(() => {});
    navigation.navigate('MainTabs');
  }

  async function saveManual() {
    const cal     = parseInt(manCal)     || 2200;
    const protein = parseInt(manProtein) || 150;
    const carbs   = parseInt(manCarbs)   || 220;
    const fat     = parseInt(manFat)     || 70;
    const g: UserGoals = { preset: selectedGoal, calories: cal, protein, carbs, fat };
    await setJSON(STORAGE_KEYS.GOALS, g);
    setGoals(g);
    await persistProfile();
    const weightN = parseFloat(weight) || 0;
    const weightLbs = useKg ? weightN * 2.205 : weightN;
    seedWeightFromProfile(weightLbs).catch(() => {});
    navigation.navigate('MainTabs');
  }

  function openManualFromResult() {
    if (calcResult) {
      setManCal(String(calcResult.calories));
      setManProtein(String(calcResult.protein));
      setManCarbs(String(calcResult.carbs));
      setManFat(String(calcResult.fat));
    }
    setStep('manual');
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // ── Step 1 — Goal selection ───────────────────────────────────────────────
  if (step === 'goal') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>What's your goal?</Text>
          <Text style={s.subtitle}>We'll calculate your personal targets in 2 quick steps.</Text>

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

          <TouchableOpacity style={s.skipLink} onPress={saveManual}>
            <Text style={s.skipLinkText}>Skip for now — use default targets</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2 — Quick profile ─────────────────────────────────────────────────
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
            {(['male', 'female', 'other'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[s.sexBtn, sex === opt && s.sexBtnActive]}
                onPress={() => setSex(opt)}
              >
                <Text style={[s.sexBtnText, sex === opt && s.sexBtnTextActive]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {profileError && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{profileError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { marginTop: 32 }]}
            onPress={() => {
              const err = validateProfile();
              if (err) { setProfileError(err); return; }
              setProfileError(null);
              setStep('activity');
            }}
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

  // ── Step 3 — Activity ──────────────────────────────────────────────────────
  if (step === 'activity') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <BackLink onPress={() => setStep('profile')} />
          <Text style={s.stepNote}>Step 2 of 2</Text>
          <Text style={s.title}>Activity level</Text>
          <Text style={s.subtitle}>Fill in what you know — we'll estimate the rest. All fields are optional.</Text>

          {/* Daily steps */}
          <Text style={s.fieldLabel}>Daily steps (optional)</Text>
          <NumInput value={dailySteps} onChangeText={setDailySteps} placeholder="e.g. 8000" suffix="steps/day" maxLength={6} />

          {/* Workouts per week */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Workouts per week (optional)</Text>
          <NumInput value={workoutsPerWeek} onChangeText={setWorkoutsPerWeek} placeholder="e.g. 3" suffix="days/week" maxLength={2} />

          {/* Workout intensity */}
          {workoutsPerWeek && parseInt(workoutsPerWeek) > 0 && (
            <>
              <Text style={[s.fieldLabel, { marginTop: 20 }]}>Workout intensity</Text>
              <View style={s.inlineRow}>
                {(['light', 'moderate', 'intense'] as const).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.triBtn, workoutIntensity === opt && s.triBtnActive]}
                    onPress={() => setWorkoutIntensity(workoutIntensity === opt ? null : opt)}
                  >
                    <Text style={[s.triBtnText, workoutIntensity === opt && s.triBtnTextActive]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Job type */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Job type</Text>
          <View style={s.inlineRow}>
            {([
              { key: 'desk', label: 'Desk job' },
              { key: 'lightly_active', label: 'On my feet' },
              { key: 'very_active', label: 'Very active' },
            ] as const).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.triBtn, jobType === opt.key && s.triBtnActive, { flex: 1 }]}
                onPress={() => setJobType(jobType === opt.key ? null : opt.key)}
              >
                <Text style={[s.triBtnText, jobType === opt.key && s.triBtnTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Free text */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Or describe your typical day (optional)</Text>
          <TextInput
            style={s.activityInput}
            value={activityDesc}
            onChangeText={text => { setActivityDesc(text); setLevelOverridden(false); }}
            placeholder="e.g. I walk 8,000 steps most days, lift 3×/week, and sit at a desk otherwise."
            placeholderTextColor="#555"
            multiline
            textAlignVertical="top"
            maxLength={400}
          />

          {/* Estimated level + manual override */}
          <View style={s.estimatedLevelBox}>
            <Text style={s.estimatedLevelLabel}>
              {levelOverridden ? 'Activity level (set manually)' : 'Estimated activity level'}
            </Text>
            <Text style={s.estimatedLevelValue}>{ACTIVITY_LABELS[activityLevel]}</Text>
            <Text style={s.estimatedLevelDesc}>{ACTIVITY_DESCRIPTIONS[activityLevel]}</Text>
            <Text style={[s.fieldLabel, { marginTop: 12, marginBottom: 8 }]}>Tap to change</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {ACTIVITY_LEVELS.map(lvl => (
                  <TouchableOpacity
                    key={lvl}
                    style={[s.levelChip, activityLevel === lvl && s.levelChipActive]}
                    onPress={() => { setActivityLevel(lvl); setLevelOverridden(true); }}
                  >
                    <Text style={[s.levelChipText, activityLevel === lvl && s.levelChipTextActive]}>
                      {ACTIVITY_LABELS[lvl]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, { marginTop: 28 }]}
            onPress={handleCalculate}
          >
            <Text style={s.primaryBtnText}>Calculate my targets →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.skipLink} onPress={() => setStep('manual')}>
            <Text style={s.skipLinkText}>Skip — I'll set my own targets</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 4 — Result ────────────────────────────────────────────────────────
  if (step === 'result' && calcResult) {
    const goalLabel = GOAL_CARDS.find(c => c.key === selectedGoal)?.label ?? 'your goal';
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <BackLink onPress={() => setStep('activity')} />
        <Text style={s.title}>Here's what we recommend</Text>

        <View style={s.explanationBox}>
          <Text style={s.explanationText}>{calcResult.explanation}</Text>
        </View>

        <View style={s.goalBadge}>
          <Text style={s.goalBadgeText}>{GOAL_CARDS.find(c => c.key === selectedGoal)?.emoji} {goalLabel}</Text>
        </View>

        <View style={s.calCard}>
          <Text style={s.calNum}>{fmtCal(calcResult.calories)}</Text>
          <Text style={s.calLabel}>calories per day</Text>
          <Text style={s.calSub}>BMR {fmtCal(calcResult.bmr)} · TDEE {fmtCal(calcResult.tdee)}</Text>
        </View>

        <View style={s.macroRow}>
          <View style={[s.macroChip, { backgroundColor: '#1A3A1A' }]}>
            <Text style={[s.macroChipVal, { color: '#5CFF7C' }]}>{calcResult.protein}g</Text>
            <Text style={s.macroChipLabel}>protein</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: '#3A2800' }]}>
            <Text style={[s.macroChipVal, { color: '#FFA040' }]}>{calcResult.carbs}g</Text>
            <Text style={s.macroChipLabel}>carbs</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: '#3A1010' }]}>
            <Text style={[s.macroChipVal, { color: '#FF6B6B' }]}>{calcResult.fat}g</Text>
            <Text style={s.macroChipLabel}>fat</Text>
          </View>
        </View>

        <Text style={s.disclaimer}>These are estimates. Adjust anytime in your profile.</Text>

        <TouchableOpacity style={s.primaryBtn} onPress={() => saveAndGo(calcResult.calories, calcResult.protein, calcResult.carbs, calcResult.fat)}>
          <Text style={s.primaryBtnText}>Looks good — let's go ✓</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.secondaryBtn, { marginTop: 12 }]} onPress={openManualFromResult}>
          <Text style={s.secondaryBtnText}>Adjust these numbers</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Manual entry (power user or override) ─────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackLink onPress={() => setStep(calcResult ? 'result' : 'goal')} />
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

  primaryBtn: {
    backgroundColor: '#00E5A0', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  primaryBtnText: { color: '#0F0F0F', fontSize: 17, fontWeight: '700' },

  secondaryBtn: {
    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', backgroundColor: '#1A1A1A',
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  skipLink:     { paddingVertical: 14, alignItems: 'center' },
  skipLinkText: { fontSize: 14, color: '#555' },

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

  triBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  triBtnActive: { borderColor: '#00E5A0', backgroundColor: '#0A2A1A' },
  triBtnText: { fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  triBtnTextActive: { color: '#00E5A0' },

  activityInput: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    fontSize: 15, color: '#FFFFFF', lineHeight: 22,
    borderWidth: 1, borderColor: '#2A2A2A',
    minHeight: 110, marginBottom: 16,
  },

  estimatedLevelBox: {
    backgroundColor: '#0A1A0A', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1A3A1A',
  },
  estimatedLevelLabel: { fontSize: 11, fontWeight: '700', color: '#5CFF7C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  estimatedLevelValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  estimatedLevelDesc:  { fontSize: 13, color: '#6A9A6A', lineHeight: 18 },

  levelChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#2A2A2A',
  },
  levelChipActive: { backgroundColor: '#00E5A0' },
  levelChipText: { fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
  levelChipTextActive: { color: '#0F0F0F' },

  errorBox:  { backgroundColor: '#2A1010', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#5A2020' },
  errorText: { fontSize: 14, color: '#FF6B6B' },

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
  calSub:   { fontSize: 12, color: '#555', marginTop: 6 },

  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  macroChip: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  macroChipVal:   { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  macroChipLabel: { fontSize: 11, color: '#8A8A8A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  disclaimer: { fontSize: 12, color: '#444', textAlign: 'center', marginBottom: 24 },

  manualRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  manualLabel: { fontSize: 16, color: '#FFFFFF', fontWeight: '600', flex: 1 },
});
