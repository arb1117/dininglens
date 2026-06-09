import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Modal, ScrollView,
  Keyboard, Platform, TouchableWithoutFeedback, KeyboardAvoidingView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, MacroItem, MealPeriod, autoDetectPeriod } from '../context/MealContext';
import { detectVenue, Venue } from '../services/venueService';
import { fetchVenueMenu, MenuItem } from '../services/menuService';
import { apiFetch } from '../services/apiClient';
import { useEntitlement } from '../hooks/useEntitlement';
import PaywallPlaceholder from '../components/PaywallPlaceholder';

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
  const { entitlement, loading: entLoading } = useEntitlement();
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
  const [toastName, setToastName]   = useState<string | null>(null);

  // Serving UI
  const [servingMode, setServingMode]   = useState<'structured' | 'natural'>('structured');
  const [amount, setAmount]             = useState('1');
  const [unit, setUnit]                 = useState('serving');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [nlInput, setNlInput]           = useState('');
  const [nlLoading, setNlLoading]       = useState(false);
  const [nlExplanation, setNlExplanation] = useState<string | null>(null);

  // Period picker
  const [pickedPeriod, setPickedPeriod] = useState<MealPeriod>(
    selectedPeriod ?? autoDetectPeriod()
  );
  const periodLocked = !!selectedPeriod;

  // Custom food modal
  const [customVisible, setCustomVisible] = useState(false);
  const [customName, setCustomName]       = useState('');
  const [customCal, setCustomCal]         = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs]     = useState('');
  const [customFat, setCustomFat]         = useState('');

  function handleLogCustom() {
    const name = customName.trim();
    if (!name) return;
    const item: MacroItem = {
      name,
      portion: '1 serving',
      cal:     parseInt(customCal)     || 0,
      protein: parseFloat(customProtein) || 0,
      carbs:   parseFloat(customCarbs)   || 0,
      fat:     parseFloat(customFat)     || 0,
    };
    addMeal({
      id:        String(Date.now()),
      timestamp: new Date().toISOString(),
      period:    pickedPeriod,
      items:     [item],
      totals:    { cal: item.cal, protein: item.protein, carbs: item.carbs, fat: item.fat },
    });
    setCustomVisible(false);
    setCustomName(''); setCustomCal(''); setCustomProtein(''); setCustomCarbs(''); setCustomFat('');
    setToastName(name);
    setTimeout(() => { setToastName(null); navigation.navigate('MainTabs', { screen: 'Dashboard' }); }, 1200);
  }

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
        const res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
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
      setAmount('1'); setUnit('serving'); setServingMode('structured'); setNlInput(''); setNlExplanation(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetServingState() {
    setAmount('1'); setUnit('serving'); setServingMode('structured');
    setNlInput(''); setNlExplanation(null);
  }

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
    resetServingState();
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
    resetServingState();
  }

  // ── Serving helpers ────────────────────────────────────────────────────────

  function parseGramWeight(servingSize: string): number | null {
    const gm = servingSize.match(/(\d+\.?\d*)\s*g\b/i);
    if (gm) return parseFloat(gm[1]);
    const oz = servingSize.match(/(\d+\.?\d*)\s*oz\b/i);
    if (oz) return parseFloat(oz[1]) * 28.35;
    return null;
  }

  function parseMlVolume(servingSize: string): number | null {
    const ml = servingSize.match(/(\d+\.?\d*)\s*(ml|mL)/);
    if (ml) return parseFloat(ml[1]);
    const floz = servingSize.match(/(\d+\.?\d*)\s*fl\.?\s*oz/i);
    if (floz) return parseFloat(floz[1]) * 29.57;
    return null;
  }

  function getUnitOptions(servingSize: string): string[] {
    const gw = parseGramWeight(servingSize);
    const ml = parseMlVolume(servingSize);
    const opts = ['serving'];
    if (gw) opts.push('g', 'oz', 'cup', 'tbsp', 'tsp');
    else if (ml) opts.push('ml', 'fl oz', 'cup', 'tbsp', 'tsp');
    opts.push('piece', 'slice', 'scoop');
    return opts;
  }

  function computeServingMultiplier(n: number, u: string, gw: number | null, ml: number | null): number {
    if (n <= 0) return 0;
    switch (u) {
      case 'g':    return gw ? n / gw : n;
      case 'oz':   return gw ? (n * 28.35) / gw : n;
      case 'ml':   return ml ? n / ml : n;
      case 'fl oz': return ml ? (n * 29.57) / ml : n;
      case 'cup':  return gw ? (n * 240) / gw : ml ? (n * 240) / ml : n;
      case 'tbsp': return gw ? (n * 15)  / gw : ml ? (n * 15)  / ml : n;
      case 'tsp':  return gw ? (n * 5)   / gw : ml ? (n * 5)   / ml : n;
      default: return n; // serving, piece, slice, scoop
    }
  }

  const gramWeight = sheet ? parseGramWeight(sheet.servingSize) : null;
  const mlVolume   = sheet ? parseMlVolume(sheet.servingSize)   : null;
  const servings   = computeServingMultiplier(parseFloat(amount) || 0, unit, gramWeight, mlVolume);

  const scaledCal     = sheet ? Math.round(sheet.baseCal     * servings) : 0;
  const scaledProtein = sheet ? round1(sheet.baseProtein * servings) : 0;
  const scaledCarbs   = sheet ? round1(sheet.baseCarbs   * servings) : 0;
  const scaledFat     = sheet ? round1(sheet.baseFat     * servings) : 0;

  async function handleNLSubmit() {
    if (!nlInput.trim() || !sheet) return;
    setNlLoading(true);
    setNlExplanation(null);
    try {
      const res = await apiFetch('/interpret-quantity', {
        method: 'POST',
        body: JSON.stringify({
          foodName: sheet.name,
          description: nlInput.trim(),
          servingSize: sheet.servingSize,
          caloriesPerServing: sheet.baseCal,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const gw = parseGramWeight(sheet.servingSize);
      if (gw && data.estimatedGrams) {
        setAmount(String(data.estimatedGrams));
        setUnit('g');
      } else {
        setAmount(String(data.servings ?? 1));
        setUnit('serving');
      }
      setNlExplanation(data.explanation ?? '');
      setServingMode('structured');
    } catch {
      setNlExplanation('Could not estimate — please enter manually');
    } finally {
      setNlLoading(false);
    }
  }

  function buildItem(): MacroItem {
    const portionStr = unit === 'serving'
      ? (parseFloat(amount) === 1 ? '1 serving' : `${amount} servings`)
      : `${amount} ${unit}`;
    return {
      name:    sheet!.name,
      portion: portionStr,
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
      period:    pickedPeriod,
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

  if (!entLoading && entitlement && !entitlement.canUseApp) {
    return <PaywallPlaceholder reason="trial_expired" />;
  }

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
        <TouchableOpacity
          style={[s.chip, s.chipCustom]}
          onPress={() => setCustomVisible(true)}
        >
          <Text style={s.chipCustomText}>+ Custom</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && filter !== 'myfoods' && (
        <View style={s.searchLoadingBar}>
          <ActivityIndicator size="small" color="#00E5A0" />
        </View>
      )}

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
              <Text style={s.nearbySectionSource}>
                {nearbyVenue.type === 'dining_hall'
                  ? 'Official campus dining menu'
                  : 'Matched from chain database — calories are approximate'}
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
              <Text style={s.emptySubText}>Try a different search or log it manually</Text>
              <TouchableOpacity
                style={s.customFoodBtn}
                onPress={() => { setCustomName(query.trim()); setCustomVisible(true); }}
              >
                <Text style={s.customFoodBtnText}>Log "{query}" as custom food</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.aiSuggestionBtn}
                onPress={() => navigation.navigate('MainTabs', { screen: 'AICoach' })}
              >
                <Text style={s.aiSuggestionText}>Ask AI Coach instead →</Text>
              </TouchableOpacity>
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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

            {/* ── Serving UI ─────────────────────────────────────────── */}
            {servingMode === 'structured' ? (
              <View style={s.servingRow}>
                <TextInput
                  style={s.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  selectTextOnFocus
                />
                <TouchableOpacity style={s.unitBtn} onPress={() => setShowUnitPicker(true)}>
                  <Text style={s.unitBtnText}>{unit}</Text>
                  <Text style={s.unitBtnChevron}>▾</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.nlRow}>
                <TextInput
                  style={s.nlInput}
                  value={nlInput}
                  onChangeText={setNlInput}
                  placeholder="e.g. 'a big bowl', 'two scoops'…"
                  placeholderTextColor="#555"
                  returnKeyType="send"
                  onSubmitEditing={handleNLSubmit}
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.nlSendBtn, (nlLoading || !nlInput.trim()) && s.nlSendBtnDisabled]}
                  onPress={handleNLSubmit}
                  disabled={nlLoading || !nlInput.trim()}
                >
                  {nlLoading
                    ? <ActivityIndicator color="#0F0F0F" size="small" />
                    : <Text style={s.nlSendBtnText}>↵</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => { setServingMode(m => m === 'structured' ? 'natural' : 'structured'); setNlExplanation(null); }}>
              <Text style={s.servingModeToggle}>
                {servingMode === 'structured' ? 'Describe amount instead' : '← Enter amount manually'}
              </Text>
            </TouchableOpacity>

            {nlExplanation ? (
              <Text style={s.nlExplanationText}>{nlExplanation}</Text>
            ) : null}

            {/* ── Period picker — always shown so user can change before logging ── */}
            {!editMode && (
              <View style={s.periodPickerRow}>
                {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealPeriod[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.mealPeriodPill, pickedPeriod === p && s.mealPeriodPillActive]}
                    onPress={() => setPickedPeriod(p)}
                  >
                    <Text style={[s.mealPeriodPillText, pickedPeriod === p && s.mealPeriodPillTextActive]}>
                      {PERIOD_LABELS[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {editMode ? (
              <TouchableOpacity style={s.logBtn} onPress={handleUpdate}>
                <Text style={s.logBtnText}>Update</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={s.logBtn} onPress={handleLogIt}>
                  <Text style={s.logBtnText}>Log to {PERIOD_LABELS[pickedPeriod]}</Text>
                </TouchableOpacity>
                {isEstimate && (
                  <TouchableOpacity style={s.addBtn} onPress={handleAddToMeal}>
                    <Text style={s.addBtnText}>Add to Meal</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>

      {/* Unit picker modal */}
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitPicker(false)}
      >
        <TouchableOpacity style={s.unitPickerBackdrop} activeOpacity={1} onPress={() => setShowUnitPicker(false)} />
        <View style={s.unitPickerBox}>
          {getUnitOptions(sheet?.servingSize ?? '').map(u => (
            <TouchableOpacity
              key={u}
              style={[s.unitPickerOption, unit === u && s.unitPickerOptionActive]}
              onPress={() => { setUnit(u); setShowUnitPicker(false); }}
            >
              <Text style={[s.unitPickerOptionText, unit === u && s.unitPickerOptionTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* ── Custom Food Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={customVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCustomVisible(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setCustomVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.customSheet}
        >
          <View style={s.handle} />
          <Text style={s.customSheetTitle}>Custom Food</Text>
          <Text style={s.customSheetSub}>
            Log anything — AI may have missed it
          </Text>

          <Text style={s.customLabel}>Name</Text>
          <TextInput
            style={s.customInput}
            value={customName}
            onChangeText={setCustomName}
            placeholder="e.g. Chicken sandwich"
            placeholderTextColor="#555"
            autoFocus
          />

          <View style={s.customRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.customLabel}>Calories</Text>
              <TextInput
                style={s.customInput}
                value={customCal}
                onChangeText={setCustomCal}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={s.customRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.customLabel}>Protein (g)</Text>
              <TextInput
                style={s.customInput}
                value={customProtein}
                onChangeText={setCustomProtein}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.customLabel}>Carbs (g)</Text>
              <TextInput
                style={s.customInput}
                value={customCarbs}
                onChangeText={setCustomCarbs}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.customLabel}>Fat (g)</Text>
              <TextInput
                style={s.customInput}
                value={customFat}
                onChangeText={setCustomFat}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={s.customLabel}>Meal period</Text>
          <View style={s.customPeriodRow}>
            {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealPeriod[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.customPeriodBtn, pickedPeriod === p && s.customPeriodBtnActive]}
                onPress={() => setPickedPeriod(p)}
              >
                <Text style={[s.customPeriodBtnText, pickedPeriod === p && s.customPeriodBtnTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.logCustomBtn, !customName.trim() && s.logCustomBtnDisabled]}
            onPress={handleLogCustom}
            disabled={!customName.trim()}
          >
            <Text style={s.logCustomBtnText}>Log Custom Food</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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

  searchLoadingBar: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  loadingText: { fontSize: 14, color: '#8A8A8A' },

  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#8A8A8A', textAlign: 'center' },

  chipCustom: { backgroundColor: '#0A2A1A', borderColor: '#1A4A2A' },
  chipCustomText: { fontSize: 14, fontWeight: '700', color: '#00E5A0' },

  customFoodBtn: {
    backgroundColor: '#0A2A1A', borderRadius: 12, borderWidth: 1, borderColor: '#1A4A2A',
    paddingHorizontal: 18, paddingVertical: 10,
  },
  customFoodBtnText: { fontSize: 14, color: '#00E5A0', fontWeight: '700' },

  // Custom food modal
  customSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 1, borderColor: '#2A2A2A',
  },
  customSheetTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  customSheetSub: { fontSize: 13, color: '#8A8A8A', marginBottom: 20 },
  customLabel: { fontSize: 12, fontWeight: '600', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  customInput: {
    backgroundColor: '#2A2A2A', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: '#FFFFFF', marginBottom: 16,
  },
  customRow: { flexDirection: 'row', marginBottom: 0 },
  customPeriodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  customPeriodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#2A2A2A', alignItems: 'center',
  },
  customPeriodBtnActive: { backgroundColor: '#00E5A0' },
  customPeriodBtnText: { color: '#8A8A8A', fontWeight: '600', fontSize: 12 },
  customPeriodBtnTextActive: { color: '#0F0F0F' },
  logCustomBtn: {
    backgroundColor: '#00E5A0', borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  logCustomBtnDisabled: { opacity: 0.4 },
  logCustomBtnText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },

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

  // Serving UI — structured mode
  servingRow: {
    flexDirection: 'row', gap: 10, marginBottom: 8,
  },
  amountInput: {
    flex: 1, backgroundColor: '#0F0F0F', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  unitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0F0F0F', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2A2A2A', minWidth: 90,
  },
  unitBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  unitBtnChevron: { fontSize: 12, color: '#8A8A8A' },

  // Serving UI — natural language mode
  nlRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  nlInput: {
    flex: 1, backgroundColor: '#0F0F0F', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  nlSendBtn: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: '#00E5A0', alignItems: 'center', justifyContent: 'center',
  },
  nlSendBtnDisabled: { opacity: 0.4 },
  nlSendBtnText: { fontSize: 20, color: '#0F0F0F', fontWeight: '700' },
  nlExplanationText: {
    fontSize: 12, color: '#00E5A0', fontStyle: 'italic', marginBottom: 12, textAlign: 'center',
  },

  servingModeToggle: {
    fontSize: 12, color: '#8A8A8A', textAlign: 'center',
    marginBottom: 16, textDecorationLine: 'underline',
  },

  // Period picker in sheet
  periodPickerRow: {
    flexDirection: 'row', gap: 6, marginBottom: 16,
  },
  mealPeriodPill: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#0F0F0F',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  mealPeriodPillActive: { backgroundColor: '#00E5A0', borderColor: '#00E5A0' },
  mealPeriodPillText: { fontSize: 11, fontWeight: '600', color: '#8A8A8A' },
  mealPeriodPillTextActive: { color: '#0F0F0F' },

  // Unit picker modal
  unitPickerBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  unitPickerBox: {
    position: 'absolute', bottom: 120, alignSelf: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A2A',
    overflow: 'hidden', minWidth: 160,
  },
  unitPickerOption: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  unitPickerOptionActive: { backgroundColor: '#002A1A' },
  unitPickerOptionText: { fontSize: 16, color: '#FFFFFF' },
  unitPickerOptionTextActive: { color: '#00E5A0', fontWeight: '700' },

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
  nearbySectionSource: {
    fontSize: 11, color: '#555', paddingHorizontal: 4, marginBottom: 6, fontStyle: 'italic',
  },
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
  emptyStateInline: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 10 },
  emptySubText: { fontSize: 13, color: '#555', textAlign: 'center' },
  aiSuggestionBtn: {
    marginTop: 6,
    backgroundColor: '#1A2A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#00E5A0',
  },
  aiSuggestionText: { color: '#00E5A0', fontSize: 14, fontWeight: '600' },
});
