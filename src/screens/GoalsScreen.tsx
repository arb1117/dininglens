import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, UserGoals } from '../context/MealContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Goals'>;

type PresetKey = 'lose' | 'maintain' | 'build';

const PRESETS: { key: PresetKey; emoji: string; label: string; goals: Omit<UserGoals, 'preset'> }[] = [
  {
    key: 'lose',
    emoji: '🔥',
    label: 'Lose Weight',
    goals: { calories: 1800, protein: 150, carbs: 150, fat: 60 },
  },
  {
    key: 'maintain',
    emoji: '⚖️',
    label: 'Stay the Same',
    goals: { calories: 2200, protein: 150, carbs: 220, fat: 70 },
  },
  {
    key: 'build',
    emoji: '💪',
    label: 'Build Muscle',
    goals: { calories: 2800, protein: 200, carbs: 280, fat: 90 },
  },
];

const GOALS_KEY = '@dininglens_goals';

export default function GoalsScreen({ navigation }: Props) {
  const { setGoals } = useMealContext();
  const [selected, setSelected] = useState<PresetKey>('maintain');
  const [showCustomize, setShowCustomize] = useState(false);

  const activePreset = PRESETS.find(p => p.key === selected)!;
  const [calories, setCalories] = useState(String(activePreset.goals.calories));
  const [protein,  setProtein]  = useState(String(activePreset.goals.protein));
  const [carbs,    setCarbs]    = useState(String(activePreset.goals.carbs));
  const [fat,      setFat]      = useState(String(activePreset.goals.fat));

  function selectPreset(key: PresetKey) {
    const p = PRESETS.find(pr => pr.key === key)!;
    setSelected(key);
    setCalories(String(p.goals.calories));
    setProtein(String(p.goals.protein));
    setCarbs(String(p.goals.carbs));
    setFat(String(p.goals.fat));
  }

  async function handleSave() {
    const g: UserGoals = {
      preset:   selected,
      calories: parseInt(calories) || activePreset.goals.calories,
      protein:  parseInt(protein)  || activePreset.goals.protein,
      carbs:    parseInt(carbs)    || activePreset.goals.carbs,
      fat:      parseInt(fat)      || activePreset.goals.fat,
    };
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(g));
    setGoals(g);
    navigation.navigate('Camera');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>What's your goal?</Text>
        <Text style={s.subtitle}>Pick one to get personalized daily targets</Text>

        {PRESETS.map(preset => {
          const isActive = selected === preset.key;
          return (
            <TouchableOpacity
              key={preset.key}
              style={[s.card, isActive && s.cardActive]}
              onPress={() => selectPreset(preset.key)}
              activeOpacity={0.8}
            >
              <View style={s.cardLeft}>
                <Text style={s.cardEmoji}>{preset.emoji}</Text>
                <View style={s.cardText}>
                  <Text style={[s.cardLabel, isActive && s.cardLabelActive]}>{preset.label}</Text>
                  <Text style={s.cardMacros}>
                    {preset.goals.calories} cal · {preset.goals.protein}g P · {preset.goals.carbs}g C · {preset.goals.fat}g F
                  </Text>
                </View>
              </View>
              {isActive && <View style={s.dot} />}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={s.customizeToggle}
          onPress={() => setShowCustomize(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.customizeToggleText}>
            Customize targets {showCustomize ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showCustomize && (
          <View style={s.customizeBox}>
            {([
              { label: 'Calories', value: calories, set: setCalories, unit: 'cal' },
              { label: 'Protein',  value: protein,  set: setProtein,  unit: 'g' },
              { label: 'Carbs',    value: carbs,    set: setCarbs,    unit: 'g' },
              { label: 'Fat',      value: fat,      set: setFat,      unit: 'g' },
            ] as const).map(field => (
              <View key={field.label} style={s.fieldRow}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <View style={s.fieldInputWrap}>
                  <TextInput
                    style={s.fieldInput}
                    value={field.value}
                    onChangeText={field.set}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <Text style={s.fieldUnit}>{field.unit}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
          <Text style={s.saveBtnText}>Set My Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  content: { padding: 24, paddingTop: 48, paddingBottom: 60 },

  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8A8A8A', marginBottom: 32 },

  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 2, borderColor: '#2A2A2A',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardActive: { borderColor: '#00E5A0' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  cardEmoji: { fontSize: 28 },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 17, fontWeight: '700', color: '#8A8A8A', marginBottom: 4 },
  cardLabelActive: { color: '#FFFFFF' },
  cardMacros: { fontSize: 12, color: '#555' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#00E5A0' },

  customizeToggle: { paddingVertical: 14, alignItems: 'center' },
  customizeToggleText: { fontSize: 14, color: '#00E5A0', fontWeight: '600' },

  customizeBox: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 28,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  fieldLabel: { fontSize: 15, color: '#8A8A8A', fontWeight: '500', flex: 1 },
  fieldInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: {
    backgroundColor: '#2A2A2A', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 16, color: '#FFFFFF', fontWeight: '700',
    minWidth: 80, textAlign: 'center',
  },
  fieldUnit: { fontSize: 14, color: '#8A8A8A', fontWeight: '500' },

  saveBtn: {
    backgroundColor: '#00E5A0', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  saveBtnText: { color: '#0F0F0F', fontSize: 17, fontWeight: '700' },
});
