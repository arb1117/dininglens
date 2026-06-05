import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useMealContext, LoggedMeal } from '../context/MealContext';

function MealCard({ meal }: { meal: LoggedMeal }) {
  return (
    <View style={styles.card}>
      <Text style={styles.timestamp}>{meal.timestamp}</Text>
      {meal.items.map(item => (
        <View key={item.name} style={styles.itemRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemPortion}>{item.portion}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.totalsRow}>
        <Text style={styles.totalChip}>{meal.totals.cal} cal</Text>
        <Text style={styles.totalChip}>{meal.totals.protein}g protein</Text>
        <Text style={styles.totalChip}>{meal.totals.carbs}g carbs</Text>
        <Text style={styles.totalChip}>{meal.totals.fat}g fat</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { mealLog } = useMealContext();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Meal History</Text>
      {mealLog.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No meals logged yet.</Text>
        </View>
      ) : (
        <FlatList
          data={mealLog}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <MealCard meal={item} />}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 22, fontWeight: '800', color: '#500000', marginBottom: 16, marginTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#aaa' },
  list: { paddingBottom: 20 },
  card: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12 },
  timestamp: { fontSize: 12, color: '#888', marginBottom: 10, fontWeight: '600' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { fontSize: 14, color: '#333' },
  itemPortion: { fontSize: 14, color: '#888', fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 10 },
  totalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  totalChip: { fontSize: 12, color: '#500000', backgroundColor: '#ffe6e6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '600' },
});
