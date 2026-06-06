import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Modal, ScrollView,
  Keyboard, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, MacroItem, MealPeriod } from '../context/MealContext';
import { detectVenue, Venue } from '../services/venueService';
import { fetchVenueMenu, MenuItem } from '../services/menuService';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

type FilterKey = 'all' | 'myfoods' | 'common';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'myfoods', label: 'My Foods' },
  { key: 'common',  label: 'Common' },
];

const PERIOD_LABELS: Record<MealPeriod, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

type ApiResult = {
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
  brand?: string;
};

type DisplayResult = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  brand?: string;
};

type SheetState = {
  name: string;
  baseCal: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
  servingSize: string;
};

function round1(n: number) { return Math.round(n * 10) / 10; }

export default function SearchScreen({ navigation, route }: Props) {
  const {
    addMeal, mealLog, updateMealItem,
    venue: ctxVenue, menuItems: ctxMenuItems, periodLabel: ctxPeriodLabel,
  } = useMealContext();
  const params = route?.params;

  const [nearbyVenue, setNearbyVenue] = useState<Venue | null>(ctxVenue);
  const [nearbyItems, setNearbyItems] = useState<MenuItem[]>(ctxVenue ? ctxMenuItems : []);
  const [nearbyPeriodLabel, setNearbyPeriodLabel] = useState<string>(ctxVenue ? ctxPeriodLabel : '');

  const editMode     = params?.editMode    ?? false;
  const mealId       = params?.mealId;
  const itemIndex    = params?.itemIndex;
  const existingItem = params?.existingItem;
  const selectedPeriod = params?.period as MealPeriod | undefined;
  const selectedPeriodLabel = selectedPeriod ? PERIOD_LABELS[selectedPeriod] : null;

  const [query, setQuery] = useState(
    params?.query ?? (editMode && existingItem ? existingItem.name : '')
  );
  const [apiResults, setApiResults] = useState<ApiResult[]>([]);
  const [loading, setLoading]       = useState(false);
  const [filter, setFilter]         = useState<FilterKey>('all');
  const [sheet, setSheet]           = useState<SheetState | null>(null);
  const [servings, setServings]     = useState(1.0);
  const [toastName, setToastName]   = useState<string | null>(null);

  // Build My Foods index from mealLog
  const myFoods = useMemo(() => {
    const map: Record<string, { item: MacroItem; count: number }> = {};
    mealLog.forEach(meal => {
      (meal.items ?? []).forEach(item => {
        const key = item.name.toLowerCase();
        if (!map[key]) map[key] = { item, count: 0 };
        map[key].count++;
      });
    });
    return map;
  }, [mealLog]);

  const myFoodResults = useMemo((): DisplayResult[] => {
    if (!query.trim()) return [];
    return Object.values(myFoods)
      .filter(({ item }) => item.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ item }) => ({
        name:        item.name,
        calories:    item.cal,
        protein:     item.protein,
        carbs:       item.carbs,
        fat:         item.fat,
        serving_size: '1 serving',
      }));
  }, [myFoods, query]);

  // API search — debounced 400ms, skipped when filter is myfoods
  useEffect(() => {
    if (filter === 'myfoods' || !query.trim()) {
      setApiResults([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${SERVER_URL}/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setApiResults(Array.isArray(data) ? data : []);
      } catch {
        setApiResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, filter]);

  const displayResults = useMemo((): DisplayResult[] => {
    if (filter === 'myfoods') return myFoodResults;

    // 'common' = USDA only; 'all' = everything
    const apiDisplay: DisplayResult[] = apiResults
      .filter(r => filter !== 'common' || !r.source || r.source === 'usda')
      .map(r => {
        const brandInName = r.brand && r.name.toLowerCase().includes(r.brand.toLowerCase());
        return {
          name:         r.name,
          calories:     r.calories,
          protein:      r.protein,
          carbs:        r.carbs,
          fat:          r.fat,
          serving_size: r.serving_size,
          brand:        !brandInName ? r.brand : undefined,
        };
      });

    if (filter !== 'all') return apiDisplay;

    // 'all': my foods first, then deduped API results
    const myNames = new Set(myFoodResults.map(r => r.name.toLowerCase()));
    return [
      ...myFoodResults,
      ...apiDisplay.filter(r => !myNames.has(r.name.toLowerCase())),
    ];
  }, [filter, apiResults, myFoodResults]);

  // Sync nearby state if context venue changes (e.g. Camera loaded it before Search opened)
  useEffect(() => {
    if (ctxVenue) {
      setNearbyVenue(ctxVenue);
      setNearbyItems(ctxMenuItems);
      setNearbyPeriodLabel(ctxPeriodLabel);
    }
  }, [ctxVenue, ctxMenuItems, ctxPeriodLabel]);

  // Detect venue silently if not already in context
  useEffect(() => {
    if (ctxVenue) return;
    detectVenue().then(async (detected) => {
      if (!detected) return;
      if (detected.type === 'restaurant' && detected.menuItems?.length) {
        setNearbyVenue(detected);
        setNearbyItems(detected.menuItems as MenuItem[]);
        setNearbyPeriodLabel('Menu');
      } else if (detected.type === 'dining_hall') {
        const date = new Date().toISOString().split('T')[0];
        const { items, periodLabel } = await fetchVenueMenu(detected, date);
        setNearbyVenue(detected);
        setNearbyItems(items);
        setNearbyPeriodLabel(periodLabel);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edit mode: auto-open sheet with existing item data
  useEffect(() => {
    if (editMode && existingItem) {
      setSheet({
        name:        existingItem.name,
        baseCal:     existingItem.cal,
        baseProtein: existingItem.protein,
        baseCarbs:   existingItem.carbs,
        baseFat:     existingItem.fat,
        servingSize: existingItem.portion,
      });
      setServings(1.0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openSheet(item: DisplayResult) {
    Keyboard.dismiss();
    setSheet({
      name:        item.name,
      baseCal:     item.calories,
      baseProtein: item.protein,
      baseCarbs:   item.carbs,
      baseFat:     item.fat,
      servingSize: item.serving_size,
    });
    setServings(1.0);
  }

  function openNearbySheet(item: MenuItem) {
    Keyboard.dismiss();
    setSheet({
      name:        item.name,
      baseCal:     item.calories,
      baseProtein: item.protein,
      baseCarbs:   item.carbs,
      baseFat:     item.fat,
      servingSize: '1 serving',
    });
    setServings(1.0);
  }

  function stepServings(delta: number) {
    setServings(prev => {
      const next = Math.round((prev + delta) * 2) / 2;
      return Math.min(10, Math.max(0.5, next));
    });
  }

  const scaledCal     = sheet ? Math.round(sheet.baseCal     * servings) : 0;
  const scaledProtein = sheet ? round1(sheet.baseProtein * servings) : 0;
  const scaledCarbs   = sheet ? round1(sheet.baseCarbs   * servings) : 0;
  const scaledFat     = sheet ? round1(sheet.baseFat     * servings) : 0;

  function buildItem(): MacroItem {
    return {
      name:    sheet!.name,
      portion: servings === 1 ? '1 serving' : `${servings} servings`,
      cal:     scaledCal,
      protein: scaledProtein,
      carbs:   scaledCarbs,
      fat:     scaledFat,
    };
  }

  function handleLogIt() {
    const item = buildItem();
    setSheet(null);
    addMeal({
      id:        String(Date.now()),
      timestamp: new Date().toISOString(),
      period:    selectedPeriod,
      items:     [item],
      totals:    { cal: item.cal, protein: item.protein, carbs: item.carbs, fat: item.fat },
    });
    setToastName(item.name);
    setTimeout(() => { setToastName(null); navigation.navigate('MainTabs', { screen: 'Dashboard' }); }, 1200);
  }

  function handleAddToMeal() {
    const item = buildItem();
    setSheet(null);
    navigation.navigate('Estimate', {
      addedItem: { name: item.name, cal: item.cal, protein: item.protein, carbs: item.carbs, fat: item.fat },
    });
  }

  function handleUpdate() {
    if (mealId == null || itemIndex == null) return;
    const item = buildItem();
    updateMealItem(mealId, itemIndex, item);
    setSheet(null);
    navigation.goBack();
  }

  const isEstimate = params?.context === 'estimate';

  return (
    <View style={s.container}>
      {toastName !== null && (
        <View style={s.toast}>
          <Text style={s.toastText}>✓ {toastName} logged</Text>
        </View>
      )}

      <View style={s.searchBar}>
        <TextInput
          style={s.input}
          placeholder="Search any food…"
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          autoFocus={!editMode}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {selectedPeriodLabel && !editMode && (
          <View style={s.periodPill}>
            <Text style={s.periodPillText}>Adding to {selectedPeriodLabel}</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterRow}
        contentContainerStyle={s.filterContent}
      >
        {FILTERS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.chip, filter === key && s.chipActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[s.chipText, filter === key && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={displayResults}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        ListHeaderComponent={
          nearbyVenue && nearbyItems.length > 0 ? (
            <View style={s.nearbySection}>
              <Text style={s.nearbySectionHeader}>
                {'📍 '}
                <Text style={s.nearbySectionVenue}>{nearbyVenue.name}</Text>
                {` — ${nearbyPeriodLabel} Menu`}
              </Text>
              {nearbyItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.nearbyItem}
                  onPress={() => openNearbySheet(item)}
                  activeOpacity={0.8}
                >
                  <Text style={s.nearbyItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.nearbyItemCal}>{Math.round(item.calories)} cal</Text>
                </TouchableOpacity>
              ))}
              <View style={s.nearbySectionDivider} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading && filter !== 'myfoods' ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color="#00E5A0" size="small" />
              <Text style={s.loadingText}>Searching…</Text>
            </View>
          ) : !query.trim() ? (
            <View style={s.emptyStateInline}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyText}>Search for any food, supplement, or product</Text>
            </View>
          ) : (
            <View style={s.emptyStateInline}>
              <Text style={s.emptyText}>No results for "{query}"</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.resultCard} onPress={() => openSheet(item)} activeOpacity={0.8}>
            {item.brand ? (
              <Text style={s.resultBrand} numberOfLines={1}>{item.brand}</Text>
            ) : null}
            <Text style={s.resultName} numberOfLines={2}>{item.name}</Text>
            <Text style={s.resultMeta}>~{Math.round(item.calories)} cal per serving</Text>
          </TouchableOpacity>
        )}
      />

      {/* Bottom sheet */}
      <Modal
        visible={sheet !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSheet(null)}
      >
        <View style={s.sheetWrap}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setSheet(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />

            <Text style={s.sheetName} numberOfLines={2}>{sheet?.name}</Text>

            <Text style={s.sheetCal}>{scaledCal}</Text>
            <Text style={s.sheetCalLabel}>cal</Text>

            <View style={s.pills}>
              <View style={[s.pill, s.pillGreen]}>
                <Text style={[s.pillText, s.pillTextGreen]}>{scaledProtein}g protein</Text>
              </View>
              <View style={[s.pill, s.pillOrange]}>
                <Text style={[s.pillText, s.pillTextOrange]}>{scaledCarbs}g carbs</Text>
              </View>
              <View style={[s.pill, s.pillRed]}>
                <Text style={[s.pillText, s.pillTextRed]}>{scaledFat}g fat</Text>
              </View>
            </View>

            <View style={s.stepperRow}>
              <TouchableOpacity
                style={[s.stepBtn, servings <= 0.5 && s.stepBtnDisabled]}
                onPress={() => stepServings(-0.5)}
                disabled={servings <= 0.5}
              >
                <Text style={s.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.servingsVal}>{servings}</Text>
              <TouchableOpacity
                style={[s.stepBtn, servings >= 10 && s.stepBtnDisabled]}
                onPress={() => stepServings(0.5)}
                disabled={servings >= 10}
              >
                <Text style={s.stepBtnText}>+</Text>
              </TouchableOpacity>
              <Text style={s.servingsUnit}>serving{servings !== 1 ? 's' : ''}</Text>
            </View>

            {editMode ? (
              <TouchableOpacity style={s.logBtn} onPress={handleUpdate}>
                <Text style={s.logBtnText}>Update</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={s.logBtn} onPress={handleLogIt}>
                  <Text style={s.logBtnText}>
                    {selectedPeriodLabel ? `Log to ${selectedPeriodLabel}` : 'Log It'}
                  </Text>
                </TouchableOpacity>
                {isEstimate && (
                  <TouchableOpacity style={s.addBtn} onPress={handleAddToMeal}>
                    <Text style={s.addBtnText}>Add to Meal</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },

  toast: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: '#00E5A0', paddingVertical: 14, alignItems: 'center',
  },
  toastText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },

  searchBar: { padding: 16, paddingBottom: 8 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: '#FFFFFF',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  periodPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#0A2A1A',
    borderWidth: 1,
    borderColor: '#1A4A2A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  periodPillText: { color: '#00E5A0', fontSize: 12, fontWeight: '700' },

  filterRow: { flexGrow: 0, paddingBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
  },
  chipActive: { backgroundColor: '#00E5A0', borderColor: '#00E5A0' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#8A8A8A' },
  chipTextActive: { color: '#0F0F0F' },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  loadingText: { fontSize: 14, color: '#8A8A8A' },

  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#8A8A8A', textAlign: 'center' },

  list: { padding: 12, paddingTop: 8 },
  resultCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  resultBrand: { fontSize: 11, fontWeight: '600', color: '#00E5A0', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  resultMeta: { fontSize: 13, color: '#8A8A8A' },

  // Sheet
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 1, borderColor: '#2A2A2A',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 20,
  },
  sheetName: {
    fontSize: 20, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 16,
  },
  sheetCal: { fontSize: 56, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  sheetCalLabel: { fontSize: 16, color: '#8A8A8A', textAlign: 'center', marginBottom: 20 },

  pills: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillGreen:       { backgroundColor: '#1A3A1A' },
  pillTextGreen:   { color: '#5CFF7C' },
  pillOrange:      { backgroundColor: '#3A2A00' },
  pillTextOrange:  { color: '#FFA040' },
  pillRed:         { backgroundColor: '#3A1010' },
  pillTextRed:     { color: '#FF6B6B' },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 14, marginBottom: 24,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { fontSize: 26, color: '#FFFFFF', lineHeight: 30 },
  servingsVal: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    minWidth: 44, textAlign: 'center',
  },
  servingsUnit: { fontSize: 14, color: '#8A8A8A', fontWeight: '500' },

  logBtn: {
    backgroundColor: '#00E5A0', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  logBtnText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
  addBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#1A1A1A',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // Nearby section
  nearbySection: { marginBottom: 4 },
  nearbySectionHeader: {
    fontSize: 12, fontWeight: '700', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 4, paddingVertical: 10,
  },
  nearbySectionVenue: { color: '#00E5A0' },
  nearbyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14, marginBottom: 6,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  nearbyItemName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1, marginRight: 12 },
  nearbyItemCal: { fontSize: 13, color: '#8A8A8A' },
  nearbySectionDivider: {
    height: 1, backgroundColor: '#2A2A2A', marginVertical: 12,
  },

  // Inline empty / loading state inside FlatList
  emptyStateInline: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
});
