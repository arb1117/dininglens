import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, MacroItem } from '../context/MealContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Estimate'>;

type Portion = 'Small' | 'Normal' | 'Large' | 'Double';

const MULTIPLIERS: Record<Portion, number> = {
  Small: 0.6,
  Normal: 1.0,
  Large: 1.4,
  Double: 2.0,
};

const PORTIONS: Portion[] = ['Small', 'Normal', 'Large', 'Double'];

function round1(n: number) { return Math.round(n * 10) / 10; }

function multiplierToPortion(m: number): Portion {
  if (m <= 0.8) return 'Small';
  if (m <= 1.2) return 'Normal';
  if (m <= 1.7) return 'Large';
  return 'Double';
}

type NormalizedItem = {
  id: string;
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  initialPortion: Portion;
};

export default function EstimateScreen({ navigation, route }: Props) {
  const { addMeal, menuItems, venue } = useMealContext();
  const { analysisResult } = route.params;

  /**
   * Resolve detected items into NormalizedItem[]:
   *  - dining_hall mode: cross-reference names against menuItems from context
   *  - generic mode: use calories/macros directly from API response
   *  - fallback (no result): first 3 from menuItems
   */
  const detectedItems = useMemo<NormalizedItem[]>(() => {
    if (!analysisResult || analysisResult.detectedItems.length === 0) {
      return menuItems.slice(0, 3).map((item, i) => ({
        id: item.id ?? `fallback-${i}`,
        name: item.name,
        cal: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        initialPortion: 'Normal' as Portion,
      }));
    }

    if (analysisResult.mode === 'dining_hall') {
      return analysisResult.detectedItems
        .map(detected => {
          const match = menuItems.find(
            m => m.name.toLowerCase() === detected.name.toLowerCase()
          );
          if (!match) return null;
          return {
            id: match.id,
            name: match.name,
            cal: match.calories,
            protein: match.protein,
            carbs: match.carbs,
            fat: match.fat,
            initialPortion: multiplierToPortion(detected.portionMultiplier),
          };
        })
        .filter((x): x is NormalizedItem => x !== null);
    }

    // generic mode — use API data directly
    return analysisResult.detectedItems.map((item, i) => ({
      id: `generic-${i}`,
      name: item.name,
      cal: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      initialPortion: multiplierToPortion(item.portionMultiplier),
    }));
  }, [analysisResult, menuItems]);

  const [portions, setPortions] = useState<Record<string, Portion>>(
    Object.fromEntries(detectedItems.map(i => [i.id, i.initialPortion]))
  );

  function getPortionFor(id: string): Portion { return portions[id] ?? 'Normal'; }

  function getScaled(item: NormalizedItem, portion: Portion) {
    const m = MULTIPLIERS[portion];
    return {
      cal:     round1(item.cal     * m),
      protein: round1(item.protein * m),
      carbs:   round1(item.carbs   * m),
      fat:     round1(item.fat     * m),
    };
  }

  const totals = detectedItems.reduce(
    (acc, item) => {
      const s = getScaled(item, getPortionFor(item.id));
      return {
        cal:     round1(acc.cal     + s.cal),
        protein: round1(acc.protein + s.protein),
        carbs:   round1(acc.carbs   + s.carbs),
        fat:     round1(acc.fat     + s.fat),
      };
    },
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  function handleLogMeal() {
    const items: MacroItem[] = detectedItems.map(item => {
      const portion = getPortionFor(item.id);
      const scaled = getScaled(item, portion);
      return { name: item.name, portion, ...scaled };
    });
    addMeal({ id: String(Date.now()), timestamp: new Date().toLocaleString(), items, totals });
    navigation.navigate('Camera');
  }

  const isFallback = !analysisResult || analysisResult.detectedItems.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Meal Estimate</Text>

      {/* Venue context card */}
      {venue && !isFallback && (
        <View style={styles.venueCard}>
          <Text style={styles.venueCardText}>
            {'✓ Matched to '}
            <Text style={styles.venueCardName}>{venue.name}</Text>
            {' menu'}
          </Text>
          <TouchableOpacity>
            <Text style={styles.venueCardLink}>View menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fallback notice */}
      {isFallback && (
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackText}>Using default menu items — tap portions to adjust</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>
        {isFallback ? 'Menu Items' : 'Detected Items'}
      </Text>

      {detectedItems.map(item => {
        const portion = getPortionFor(item.id);
        const scaled = getScaled(item, portion);
        return (
          <View key={item.id} style={styles.itemCard}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.portionRow}>
              {PORTIONS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.portionBtn, portion === p && styles.portionBtnActive]}
                  onPress={() => setPortions(prev => ({ ...prev, [item.id]: p }))}
                >
                  <Text style={[styles.portionBtnText, portion === p && styles.portionBtnTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroText}>{scaled.cal} cal</Text>
              <Text style={styles.macroText}>{scaled.protein}g protein</Text>
              <Text style={styles.macroText}>{scaled.carbs}g carbs</Text>
              <Text style={styles.macroText}>{scaled.fat}g fat</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.totalsCard}>
        <Text style={styles.totalsTitle}>Meal Totals</Text>
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.cal}</Text>
            <Text style={styles.totalLabel}>cal</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.protein}g</Text>
            <Text style={styles.totalLabel}>protein</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.carbs}g</Text>
            <Text style={styles.totalLabel}>carbs</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.fat}g</Text>
            <Text style={styles.totalLabel}>fat</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogMeal}>
        <Text style={styles.buttonText}>Log Meal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 22, fontWeight: '800', color: '#500000', marginBottom: 12, marginTop: 8 },
  venueCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#edf7ed', borderRadius: 10, paddingVertical: 10,
    paddingHorizontal: 14, marginBottom: 16,
  },
  venueCardText: { fontSize: 13, color: '#333' },
  venueCardName: { fontWeight: '700', color: '#2e7d32' },
  venueCardLink: { fontSize: 13, color: '#500000', fontWeight: '600', textDecorationLine: 'underline' },
  fallbackCard: {
    backgroundColor: '#fff8e1', borderRadius: 10, paddingVertical: 10,
    paddingHorizontal: 14, marginBottom: 16,
  },
  fallbackText: { fontSize: 13, color: '#795548' },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#888',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  itemCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 10 },
  portionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  portionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e8e8e8', alignItems: 'center' },
  portionBtnActive: { backgroundColor: '#500000' },
  portionBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  portionBtnTextActive: { color: '#fff' },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macroText: {
    fontSize: 12, color: '#666', backgroundColor: '#ececec',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  totalsCard: { backgroundColor: '#500000', borderRadius: 14, padding: 20, marginTop: 8, marginBottom: 20 },
  totalsTitle: {
    color: '#fff', fontSize: 14, fontWeight: '700',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalItem: { alignItems: 'center' },
  totalValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  button: { backgroundColor: '#500000', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
