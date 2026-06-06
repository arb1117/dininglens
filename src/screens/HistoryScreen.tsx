import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useMealContext, LoggedMeal } from '../context/MealContext';

function MealCard({ meal }: { meal: LoggedMeal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      <Text style={styles.timestamp}>{meal.timestamp}</Text>

      {expanded && (
        <View style={styles.itemsContainer}>
          {meal.items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPortion}>{item.portion}</Text>
              </View>
              <View style={styles.itemMacros}>
                <Text style={styles.itemMacroText}>{item.cal} cal</Text>
                <Text style={styles.itemMacroText}>{item.protein}g P</Text>
                <Text style={styles.itemMacroText}>{item.carbs}g C</Text>
                <Text style={styles.itemMacroText}>{item.fat}g F</Text>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
        </View>
      )}

      <View style={styles.totalsRow}>
        <View style={styles.macroChip}>
          <Text style={styles.macroChipValue}>{meal.totals.cal}</Text>
          <Text style={styles.macroChipLabel}>cal</Text>
        </View>
        <View style={styles.macroChip}>
          <Text style={styles.macroChipValue}>{meal.totals.protein}g</Text>
          <Text style={styles.macroChipLabel}>protein</Text>
        </View>
        <View style={styles.macroChip}>
          <Text style={styles.macroChipValue}>{meal.totals.carbs}g</Text>
          <Text style={styles.macroChipLabel}>carbs</Text>
        </View>
        <View style={styles.macroChip}>
          <Text style={styles.macroChipValue}>{meal.totals.fat}g</Text>
          <Text style={styles.macroChipLabel}>fat</Text>
        </View>
      </View>

      <Text style={styles.expandHint}>{expanded ? '▲ collapse' : '▼ show items'}</Text>
    </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#0F0F0F', padding: 20 },
  header: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 16, marginTop: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#8A8A8A' },

  list: { paddingBottom: 20 },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  timestamp: { fontSize: 12, color: '#8A8A8A', marginBottom: 12, fontWeight: '600' },

  itemsContainer: { marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  itemLeft: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  itemPortion: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  itemMacros: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  itemMacroText: {
    fontSize: 11, color: '#8A8A8A', backgroundColor: '#2A2A2A',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },

  divider: { height: 1, backgroundColor: '#2A2A2A', marginBottom: 12 },

  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroChip: {
    flex: 1, alignItems: 'center', backgroundColor: '#2A2A2A',
    borderRadius: 8, paddingVertical: 8, marginHorizontal: 3,
  },
  macroChipValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  macroChipLabel: { fontSize: 10, color: '#8A8A8A', marginTop: 2, fontWeight: '500' },

  expandHint: { fontSize: 11, color: '#8A8A8A', textAlign: 'center', marginTop: 10 },
});
