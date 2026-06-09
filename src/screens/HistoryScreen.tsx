import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMealContext, LoggedMeal, MacroItem, autoDetectPeriod } from '../context/MealContext';
import { RootStackParamList } from '../../App';
import { saveMealFromLoggedMeal } from '../services/savedMealService';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

type MealCardProps = {
  meal: LoggedMeal;
  onEditItem: (mealId: string, itemIndex: number, item: MacroItem) => void;
  onDelete: (mealId: string) => void;
  onLogAgain: (meal: LoggedMeal) => void;
  onRemoveItem: (mealId: string, itemIndex: number) => void;
  onSave: (meal: LoggedMeal) => void;
};

function MealCard({ meal, onEditItem, onDelete, onLogAgain, onRemoveItem, onSave }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);

  function confirmDelete() {
    Alert.alert('Delete this meal?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(meal.id) },
    ]);
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.timestamp}>
            {new Date(meal.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(meal.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.itemCount}>{meal.items.length} item{meal.items.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onLogAgain(meal)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.actionBtnText}>↺</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.saveActionBtn]}
            onPress={() => onSave(meal)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.actionBtnText}>💾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteActionBtn]}
            onPress={confirmDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.actionBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!expanded && meal.items.length > 0 && (
        <Text style={styles.itemsSummary} numberOfLines={1}>
          {meal.items.map(i => i.name).join(', ')}
        </Text>
      )}

      {expanded && (
        <View style={styles.itemsContainer}>
          {meal.items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPortion}>{item.portion}</Text>
              </View>
              <View style={styles.itemRight}>
                <View style={styles.itemMacros}>
                  <Text style={styles.itemMacroText}>{item.cal} cal</Text>
                  <Text style={styles.itemMacroText}>{item.protein}g P</Text>
                  <Text style={styles.itemMacroText}>{item.carbs}g C</Text>
                  <Text style={styles.itemMacroText}>{item.fat}g F</Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => onEditItem(meal.id, i, item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeItemBtn}
                  onPress={() => onRemoveItem(meal.id, i)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeItemBtnText}>✕</Text>
                </TouchableOpacity>
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

export default function HistoryScreen({ navigation }: Props) {
  const { mealLog, addMeal, deleteMeal, deleteMealItem } = useMealContext();
  const [toast, setToast] = useState<string | null>(null);
  const today = new Date().toDateString();

  const groupedDays = useMemo(() => {
    const groups: Record<string, LoggedMeal[]> = {};
    mealLog.forEach(meal => {
      const key = new Date(meal.timestamp).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(meal);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([dateStr, meals]) => {
        const totals = meals.reduce(
          (acc, m) => ({
            cal: Math.round(acc.cal + m.totals.cal),
            protein: Math.round((acc.protein + m.totals.protein) * 10) / 10,
            carbs: Math.round((acc.carbs + m.totals.carbs) * 10) / 10,
            fat: Math.round((acc.fat + m.totals.fat) * 10) / 10,
          }),
          { cal: 0, protein: 0, carbs: 0, fat: 0 }
        );
        const d = new Date(dateStr);
        const isToday = dateStr === today;
        const isYesterday = dateStr === new Date(Date.now() - 86400000).toDateString();
        const label = isToday ? 'Today'
          : isYesterday ? 'Yesterday'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return { dateStr, label, meals, totals, isToday };
      });
  }, [mealLog, today]);

  function handleEditItem(mealId: string, itemIndex: number, item: MacroItem) {
    navigation.navigate('Search', { editMode: true, mealId, itemIndex, existingItem: item });
  }

  function handleLogAgain(meal: LoggedMeal) {
    addMeal({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
      period: meal.period ?? autoDetectPeriod(),
      items: meal.items,
      totals: meal.totals,
    });
    setToast('✓ Logged again');
    setTimeout(() => setToast(null), 1800);
  }

  function handleCopyDay(meals: LoggedMeal[]) {
    const now = Date.now();
    meals.forEach((meal, i) => {
      addMeal({
        id: `${now + i}_${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toISOString(),
        period: meal.period ?? autoDetectPeriod(),
        items: meal.items,
        totals: meal.totals,
      });
    });
    setToast(`✓ ${meals.length} meal${meals.length !== 1 ? 's' : ''} copied to today`);
    setTimeout(() => setToast(null), 1800);
  }

  function handleRemoveItem(mealId: string, itemIndex: number) {
    deleteMealItem(mealId, itemIndex);
  }

  function handleSave(meal: LoggedMeal) {
    saveMealFromLoggedMeal(meal)
      .then(() => {
        setToast('✓ Saved to Saved Meals');
        setTimeout(() => setToast(null), 1800);
      })
      .catch(() => {});
  }

  return (
    <View style={styles.container}>
      {toast !== null && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <Text style={styles.header}>Meal History</Text>
      {mealLog.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No meals logged yet</Text>
          <Text style={styles.emptySubText}>Log your first meal from the Dashboard or Camera tab.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groupedDays.map(({ dateStr, label, meals, totals, isToday }) => (
            <View key={dateStr}>
              <View style={styles.dayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayLabel}>{label}</Text>
                  <Text style={styles.dayTotals}>
                    {totals.cal} cal · {totals.protein}g P · {totals.carbs}g C · {totals.fat}g F
                  </Text>
                </View>
                {!isToday && (
                  <TouchableOpacity style={styles.copyDayBtn} onPress={() => handleCopyDay(meals)}>
                    <Text style={styles.copyDayBtnText}>Copy day</Text>
                  </TouchableOpacity>
                )}
              </View>
              {meals.map(meal => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onEditItem={handleEditItem}
                  onDelete={deleteMeal}
                  onLogAgain={handleLogAgain}
                  onRemoveItem={handleRemoveItem}
                  onSave={handleSave}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', padding: 20 },
  header: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 16, marginTop: 8 },

  toast: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: '#00E5A0', paddingVertical: 12, alignItems: 'center',
  },
  toastText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 18, color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#8A8A8A', textAlign: 'center', lineHeight: 20 },

  list: { paddingBottom: 20 },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardHeaderLeft: { flex: 1 },
  timestamp: { fontSize: 12, color: '#8A8A8A', fontWeight: '600' },
  itemCount: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },

  cardActions: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
  },
  saveActionBtn: { backgroundColor: '#0A2A1A' },
  deleteActionBtn: { backgroundColor: '#2A1010' },
  actionBtnText: { fontSize: 15 },

  itemsSummary: { fontSize: 13, color: '#8A8A8A', marginBottom: 10 },

  itemsContainer: { marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  itemLeft: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  itemPortion: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemMacros: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' },
  itemMacroText: {
    fontSize: 11, color: '#8A8A8A', backgroundColor: '#2A2A2A',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  editBtn: { padding: 4 },
  editBtnText: { fontSize: 14 },
  removeItemBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#2A1010', alignItems: 'center', justifyContent: 'center',
  },
  removeItemBtnText: { fontSize: 11, color: '#FF6B6B', fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#2A2A2A', marginBottom: 12 },

  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroChip: {
    flex: 1, alignItems: 'center', backgroundColor: '#2A2A2A',
    borderRadius: 8, paddingVertical: 8, marginHorizontal: 3,
  },
  macroChipValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  macroChipLabel: { fontSize: 10, color: '#8A8A8A', marginTop: 2, fontWeight: '500' },

  expandHint: { fontSize: 11, color: '#8A8A8A', textAlign: 'center', marginTop: 10 },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4,
    marginTop: 8, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  dayLabel: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  dayTotals: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
  copyDayBtn: {
    backgroundColor: '#0A2A1A', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#1A4A2A',
  },
  copyDayBtnText: { fontSize: 12, fontWeight: '700', color: '#00E5A0' },
});
