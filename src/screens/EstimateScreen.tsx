import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useMealContext, MacroItem } from '../context/MealContext';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Estimate'> };

type Portion = 'Small' | 'Normal' | 'Large' | 'Double';

const MULTIPLIERS: Record<Portion, number> = {
  Small: 0.6,
  Normal: 1.0,
  Large: 1.4,
  Double: 2.0,
};

const BASE_ITEMS = [
  { name: 'Grilled Chicken Breast', cal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'White Rice', cal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Green Beans', cal: 35, protein: 1.8, carbs: 8, fat: 0.2 },
];

const PORTIONS: Portion[] = ['Small', 'Normal', 'Large', 'Double'];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function EstimateScreen({ navigation }: Props) {
  const { addMeal } = useMealContext();
  const [portions, setPortions] = useState<Record<string, Portion>>(
    Object.fromEntries(BASE_ITEMS.map(i => [i.name, 'Normal' as Portion]))
  );

  function getScaled(item: typeof BASE_ITEMS[0], portion: Portion) {
    const m = MULTIPLIERS[portion];
    return {
      cal: round1(item.cal * m),
      protein: round1(item.protein * m),
      carbs: round1(item.carbs * m),
      fat: round1(item.fat * m),
    };
  }

  const totals = BASE_ITEMS.reduce(
    (acc, item) => {
      const scaled = getScaled(item, portions[item.name]);
      return {
        cal: round1(acc.cal + scaled.cal),
        protein: round1(acc.protein + scaled.protein),
        carbs: round1(acc.carbs + scaled.carbs),
        fat: round1(acc.fat + scaled.fat),
      };
    },
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  function handleLogMeal() {
    const items: MacroItem[] = BASE_ITEMS.map(item => {
      const scaled = getScaled(item, portions[item.name]);
      return { name: item.name, portion: portions[item.name], ...scaled };
    });
    addMeal({
      id: String(Date.now()),
      timestamp: new Date().toLocaleString(),
      items,
      totals,
    });
    navigation.navigate('History');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Meal Estimate</Text>
      <Text style={styles.sectionLabel}>Detected Items</Text>
      {BASE_ITEMS.map(item => {
        const scaled = getScaled(item, portions[item.name]);
        return (
          <View key={item.name} style={styles.itemCard}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.portionRow}>
              {PORTIONS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.portionBtn, portions[item.name] === p && styles.portionBtnActive]}
                  onPress={() => setPortions(prev => ({ ...prev, [item.name]: p }))}
                >
                  <Text style={[styles.portionBtnText, portions[item.name] === p && styles.portionBtnTextActive]}>
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
          <View style={styles.totalItem}><Text style={styles.totalValue}>{totals.cal}</Text><Text style={styles.totalLabel}>cal</Text></View>
          <View style={styles.totalItem}><Text style={styles.totalValue}>{totals.protein}g</Text><Text style={styles.totalLabel}>protein</Text></View>
          <View style={styles.totalItem}><Text style={styles.totalValue}>{totals.carbs}g</Text><Text style={styles.totalLabel}>carbs</Text></View>
          <View style={styles.totalItem}><Text style={styles.totalValue}>{totals.fat}g</Text><Text style={styles.totalLabel}>fat</Text></View>
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
  header: { fontSize: 22, fontWeight: '800', color: '#500000', marginBottom: 16, marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  itemCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 10 },
  portionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  portionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e8e8e8', alignItems: 'center' },
  portionBtnActive: { backgroundColor: '#500000' },
  portionBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  portionBtnTextActive: { color: '#fff' },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macroText: { fontSize: 12, color: '#666', backgroundColor: '#ececec', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  totalsCard: { backgroundColor: '#500000', borderRadius: 14, padding: 20, marginTop: 8, marginBottom: 20 },
  totalsTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalItem: { alignItems: 'center' },
  totalValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  button: { backgroundColor: '#500000', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
