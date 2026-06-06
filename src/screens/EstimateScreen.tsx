import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, TextInput, ActivityIndicator, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, MacroItem, LoggedMeal, MealPeriod, autoDetectPeriod } from '../context/MealContext';
import { MenuItem } from '../services/menuService';
import { AnalysisResult } from '../services/visionService';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

type Props = NativeStackScreenProps<RootStackParamList, 'Estimate'>;

// ─── Visual portion picker ────────────────────────────────────────────────────

type VisualPortion = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

const VISUAL_PORTIONS: VisualPortion[] = ['tiny', 'small', 'medium', 'large', 'huge'];

const VISUAL_MULTIPLIERS: Record<VisualPortion, number> = {
  tiny:   0.4,
  small:  0.6,
  medium: 1.0,
  large:  1.4,
  huge:   2.0,
};

const VISUAL_LABELS: Record<VisualPortion, { emoji: string; label: string }> = {
  tiny:   { emoji: '🤏', label: 'Tiny'   },
  small:  { emoji: '✋', label: 'Small'  },
  medium: { emoji: '🍽', label: 'Medium' },
  large:  { emoji: '🥣', label: 'Large'  },
  huge:   { emoji: '📦', label: 'Huge'   },
};

// ─── Macro traffic lights ─────────────────────────────────────────────────────
// Thresholds per single meal

function proteinSignal(g: number) {
  if (g >= 25) return '✅';
  if (g >= 10) return '🟡';
  return '🔴';
}
function carbSignal(g: number) {
  if (g <= 60)  return '✅';
  if (g <= 120) return '🟡';
  return '🔴';
}
function fatSignal(g: number) {
  if (g <= 20) return '✅';
  if (g <= 40) return '🟡';
  return '🔴';
}

// ─── Normalized item ──────────────────────────────────────────────────────────

function round1(n: number) { return Math.round(n * 10) / 10; }

type ItemSource = 'ai' | 'menu' | 'barcode' | 'manual';

type NormalizedItem = {
  id: string;
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number;
  manuallyAdded?: boolean;
  source?: ItemSource;
};

const SOURCE_BADGE: Record<ItemSource, string> = {
  ai:     '📷 AI estimated',
  menu:   '📋 Menu matched',
  barcode:'📦 Barcode scanned',
  manual: '🔍 Manually added',
};

function buildInitialItems(
  analysisResult: Props['route']['params']['analysisResult'],
  menuItems: ReturnType<typeof useMealContext>['menuItems'],
  routeSource?: string
): NormalizedItem[] {
  if (
    analysisResult?.reason === 'image_quality' ||
    analysisResult?.reason === 'low_confidence' ||
    analysisResult?.reason === 'no_food'
  ) {
    return [];
  }

  if (!analysisResult || analysisResult.detectedItems.length === 0) {
    return menuItems.slice(0, 3).map((item, i) => ({
      id: item.id ?? `fallback-${i}`,
      name: item.name,
      cal: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: 'menu' as ItemSource,
    }));
  }

  if (analysisResult.mode === 'dining_hall') {
    return analysisResult.detectedItems
      .map(detected => {
        const match = menuItems.find(
          m => m.name.toLowerCase() === detected.name.toLowerCase()
        );
        if (!match) return null;
        const scale = detected.estimatedQuantityGrams != null
          ? detected.estimatedQuantityGrams / 100
          : detected.portionMultiplier;
        return {
          id: match.id,
          name: match.name,
          cal: Math.round(match.calories * scale),
          protein: round1(match.protein * scale),
          carbs: round1(match.carbs * scale),
          fat: round1(match.fat * scale),
          confidence: detected.confidence,
          source: 'menu' as ItemSource,
        };
      })
      .filter((x) => x !== null) as NormalizedItem[];
  }

  const src: ItemSource = routeSource === 'barcode' ? 'barcode' : 'ai';
  return analysisResult.detectedItems.map((item, i) => ({
    id: `generic-${i}`,
    name: item.name,
    cal: item.calories ?? 0,
    protein: item.protein ?? 0,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    confidence: item.confidence,
    source: src,
  }));
}

// ─── History autocomplete ────────────────────────────────────────────────────

type HistorySuggestion = { count: number; item: MacroItem; name: string };

function getHistorySuggestions(mealLog: LoggedMeal[], query: string): HistorySuggestion[] {
  const freq: Record<string, HistorySuggestion> = {};
  mealLog.forEach(meal => {
    (meal.items || []).forEach(item => {
      const key = item.name.toLowerCase();
      if (!freq[key]) freq[key] = { count: 0, item, name: item.name };
      freq[key].count++;
    });
  });
  return Object.values(freq)
    .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EstimateScreen({ navigation, route }: Props) {
  const { addMeal, menuItems, venue, mealLog } = useMealContext();
  const { analysisResult, imageBase64, source, analysisError } = route.params;

  const [items, setItems] = useState<NormalizedItem[]>(() =>
    buildInitialItems(analysisResult, menuItems, source)
  );
  const [portions, setPortions] = useState<Record<string, VisualPortion>>(
    () => Object.fromEntries(
      buildInitialItems(analysisResult, menuItems, source).map(i => [i.id, 'medium' as VisualPortion])
    )
  );

  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const [pickedPeriod, setPickedPeriod] = useState<MealPeriod>(autoDetectPeriod());
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [feedbackText, setFeedbackText] = useState('');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [hasReanalyzed, setHasReanalyzed] = useState(false);

  const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDiningHallMode = venue !== null;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim() || isDiningHallMode) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSuggestions(getHistorySuggestions(mealLog, searchQuery.trim()));
      setShowSuggestions(true);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, isDiningHallMode, mealLog]);

  // Handle item added from SearchScreen via "Add to Meal"
  useEffect(() => {
    const ai = route.params?.addedItem;
    if (!ai) return;
    const newItem: NormalizedItem = {
      id: `search-${Date.now()}`,
      name: ai.name,
      cal: ai.cal,
      protein: ai.protein,
      carbs: ai.carbs,
      fat: ai.fat,
      manuallyAdded: true,
      source: 'manual',
    };
    setItems(prev => [...prev, newItem]);
    setPortions(prev => ({ ...prev, [newItem.id]: 'medium' as VisualPortion }));
    navigation.setParams({ addedItem: undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.addedItem]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const filteredMenuItems = useMemo(() =>
    searchQuery.trim()
      ? menuItems.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : menuItems,
    [menuItems, searchQuery]
  );

  function getPortionFor(id: string): VisualPortion { return portions[id] ?? 'medium'; }

  function getScaled(item: NormalizedItem, portion: VisualPortion) {
    const m = VISUAL_MULTIPLIERS[portion];
    return {
      cal:     Math.round(item.cal     * m),
      protein: round1(item.protein * m),
      carbs:   round1(item.carbs   * m),
      fat:     round1(item.fat     * m),
    };
  }

  function removeItem(id: string) {
    swipeableRefs.current[id]?.close();
    setItems(prev => prev.filter(i => i.id !== id));
    setPortions(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function handleLookup() {
    if (!searchQuery.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`${SERVER_URL}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const newItem: NormalizedItem = {
        id: `manual-${Date.now()}`,
        name: data.name ?? searchQuery.trim(),
        cal: typeof data.calories === 'number' ? data.calories : 0,
        protein: typeof data.protein === 'number' ? data.protein : 0,
        carbs: typeof data.carbs === 'number' ? data.carbs : 0,
        fat: typeof data.fat === 'number' ? data.fat : 0,
        manuallyAdded: true,
        source: 'manual',
      };
      setItems(prev => [...prev, newItem]);
      setPortions(prev => ({ ...prev, [newItem.id]: 'medium' }));
      setAddModalVisible(false);
      setSearchQuery('');
    } catch {
      setLookupError('Could not find that food — try a different name.');
    } finally {
      setLookupLoading(false);
    }
  }

  function handleAddMenuItemTap(menuItem: MenuItem) {
    const newItem: NormalizedItem = {
      id: `manual-${Date.now()}`,
      name: menuItem.name,
      cal: menuItem.calories,
      protein: menuItem.protein,
      carbs: menuItem.carbs,
      fat: menuItem.fat,
      manuallyAdded: true,
      source: 'manual',
    };
    setItems(prev => [...prev, newItem]);
    setPortions(prev => ({ ...prev, [newItem.id]: 'medium' }));
    setAddModalVisible(false);
    setSearchQuery('');
  }

  function handleSuggestionTap(suggestion: HistorySuggestion) {
    const newItem: NormalizedItem = {
      id: `history-${Date.now()}`,
      name: suggestion.name,
      cal: suggestion.item.cal,
      protein: suggestion.item.protein,
      carbs: suggestion.item.carbs,
      fat: suggestion.item.fat,
      manuallyAdded: true,
      source: 'manual',
    };
    setItems(prev => [...prev, newItem]);
    setPortions(prev => ({ ...prev, [newItem.id]: 'medium' }));
    setAddModalVisible(false);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleReanalyze() {
    if (!feedbackText.trim() || !imageBase64) return;
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const res = await fetch(`${SERVER_URL}/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          feedback: feedbackText.trim(),
          previousItems: items.map(i => ({ name: i.name })),
          menuItems: isDiningHallMode ? menuItems : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`Server ${res.status}: ${errBody.error ?? 'unknown error'}`);
      }
      const newResult = await res.json() as AnalysisResult;
      const newItems = buildInitialItems(newResult, menuItems, source);
      setItems(newItems);
      setPortions(Object.fromEntries(newItems.map(i => [i.id, 'medium' as VisualPortion])));
      setFeedbackText('');
      setHasReanalyzed(true);
    } catch (err) {
      setReanalyzeError(err instanceof Error ? err.message : 'Re-evaluate failed.');
    } finally {
      setReanalyzing(false);
    }
  }

  const totals = useMemo(() =>
    items.reduce(
      (acc, item) => {
        const s = getScaled(item, getPortionFor(item.id));
        return {
          cal:     Math.round(acc.cal     + s.cal),
          protein: round1(acc.protein + s.protein),
          carbs:   round1(acc.carbs   + s.carbs),
          fat:     round1(acc.fat     + s.fat),
        };
      },
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, portions]
  );

  function handleLogMeal() {
    if (items.length === 0) return;
    const mealItems: MacroItem[] = items.map(item => {
      const portion = getPortionFor(item.id);
      const scaled = getScaled(item, portion);
      return { name: item.name, portion: VISUAL_LABELS[portion].label, ...scaled };
    });
    addMeal({ id: String(Date.now()), timestamp: new Date().toISOString(), period: pickedPeriod, items: mealItems, totals });
    navigation.navigate('MainTabs', { screen: 'Dashboard' });
  }

  const imageQualityError = !hasReanalyzed && (
    analysisResult?.reason === 'image_quality' || analysisResult?.reason === 'low_confidence'
  );
  const noFoodError = !hasReanalyzed && analysisResult?.reason === 'no_food';
  const isFallback = !hasReanalyzed && !imageQualityError &&
    !noFoodError && (!analysisResult || analysisResult.detectedItems.length === 0);
  const sectionTitle = noFoodError ? 'No Food Detected' : isFallback ? 'Menu Items' : 'What you ate';

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <View style={styles.headerRow}>
          <Text style={styles.header}>Meal Estimate</Text>
          {source === 'barcode' && (
            <View style={styles.barcodeBadge}>
              <Text style={styles.barcodeBadgeText}>📦 Scanned</Text>
            </View>
          )}
        </View>

        {analysisError && (
          <View style={styles.analysisErrorCard}>
            <Text style={styles.analysisErrorText}>
              Couldn't analyze this photo — check your connection and try again.
            </Text>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => navigation.pop()}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {imageQualityError && (
          <View style={styles.imageQualityBanner}>
            <Text style={styles.imageQualityText}>
              📸 Image too dark or unclear — try again in better lighting
            </Text>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => navigation.pop()}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {noFoodError && (
          <View style={styles.imageQualityBanner}>
            <Text style={styles.imageQualityText}>
              No food detected - add an item below or retake the photo
            </Text>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => navigation.pop()}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {venue && !isFallback && !imageQualityError && !noFoodError && (
          <View style={styles.venueCard}>
            <Text style={styles.venueCardText}>
              {'✓ Matched to '}
              <Text style={styles.venueCardName}>{venue.name}</Text>
              {' menu'}
            </Text>
          </View>
        )}

        {isFallback && (
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackText}>Using default menu items — tap a size to adjust</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>{sectionTitle}</Text>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {noFoodError ? 'No meal items found in this photo.' : 'No items yet - add something below'}
            </Text>
          </View>
        ) : (
          items.map(item => {
            const portion = getPortionFor(item.id);
            const scaled = getScaled(item, portion);
            return (
              <Swipeable
                key={item.id}
                ref={ref => { swipeableRefs.current[item.id] = ref; }}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={styles.removeAction}
                    onPress={() => removeItem(item.id)}
                  >
                    <Text style={styles.removeActionText}>Remove</Text>
                  </TouchableOpacity>
                )}
                onSwipeableOpen={() => removeItem(item.id)}
              >
                <View style={styles.itemCard}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.source && (
                      <View style={styles.sourceBadge}>
                        <Text style={styles.sourceBadgeText}>{SOURCE_BADGE[item.source]}</Text>
                      </View>
                    )}
                  </View>

                  {/* Visual portion picker */}
                  <View style={styles.visualPortionRow}>
                    {VISUAL_PORTIONS.map(vp => (
                      <TouchableOpacity
                        key={vp}
                        style={[styles.vpBtn, portion === vp && styles.vpBtnActive]}
                        onPress={() => setPortions(prev => ({ ...prev, [item.id]: vp }))}
                      >
                        <Text style={styles.vpEmoji}>{VISUAL_LABELS[vp].emoji}</Text>
                        <Text style={[styles.vpLabel, portion === vp && styles.vpLabelActive]}>
                          {VISUAL_LABELS[vp].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Calories — prominent */}
                  <Text style={styles.itemCalories}>{scaled.cal} cal</Text>

                  {/* Macros — secondary */}
                  <Text style={styles.itemMacros}>
                    {scaled.protein}g protein · {scaled.carbs}g carbs · {scaled.fat}g fat
                  </Text>

                  {/* Confidence — amber only for AI estimates below 0.6 */}
                  {item.source === 'ai' && item.confidence !== undefined && item.confidence < 0.6 && (
                    <Text style={styles.confidenceAmber}>
                      ~{Math.round(item.confidence * 100)}% sure
                    </Text>
                  )}
                </View>
              </Swipeable>
            );
          })
        )}

        {imageBase64 && (
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>Something wrong?</Text>
            <View style={styles.feedbackRow}>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Tell the AI what's wrong…"
                placeholderTextColor="#555"
                value={feedbackText}
                onChangeText={text => { setFeedbackText(text); setReanalyzeError(null); }}
                multiline
                returnKeyType="default"
              />
              <TouchableOpacity
                style={[styles.reanalyzeBtn, (!feedbackText.trim() || reanalyzing) && styles.reanalyzeBtnDisabled]}
                onPress={handleReanalyze}
                disabled={!feedbackText.trim() || reanalyzing}
              >
                {reanalyzing
                  ? <ActivityIndicator color="#0F0F0F" size="small" />
                  : <Text style={styles.reanalyzeBtnText}>Re-evaluate</Text>
                }
              </TouchableOpacity>
            </View>
            {reanalyzeError !== null && (
              <Text style={styles.reanalyzeError}>{reanalyzeError}</Text>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.addItemBtn} onPress={() => {
          setSearchQuery('');
          setLookupError(null);
          setSuggestions([]);
          setShowSuggestions(false);
          setAddModalVisible(true);
        }}>
          <Text style={styles.addItemBtnText}>+ Add item</Text>
        </TouchableOpacity>

        {/* Totals card with traffic lights */}
        <View style={styles.totalsCard}>
          {venue && !isFallback && !imageQualityError && !noFoodError && (
            <Text style={styles.estimateStatusTeal}>✓ Using {venue.name} menu</Text>
          )}
          {source === 'barcode' && (
            <Text style={styles.estimateStatusTeal}>✓ Exact product data</Text>
          )}
          {!venue && source !== 'barcode' && imageBase64 && !isFallback && !imageQualityError && !noFoodError && (
            <Text style={styles.estimateStatusSecondary}>AI estimate — tap to correct</Text>
          )}
          <Text style={styles.totalsTitle}>This meal</Text>
          <Text style={styles.totalCalories}>{totals.cal} calories</Text>
          <Text style={styles.totalMacros}>
            {totals.protein}g protein · {totals.carbs}g carbs · {totals.fat}g fat
          </Text>
          {items.length > 0 && (
            <View style={styles.trafficRow}>
              <Text style={styles.trafficItem}>{proteinSignal(totals.protein)} Protein</Text>
              <Text style={styles.trafficItem}>{carbSignal(totals.carbs)} Carbs</Text>
              <Text style={styles.trafficItem}>{fatSignal(totals.fat)} Fat</Text>
            </View>
          )}
        </View>

        {/* Meal period picker */}
        <View style={styles.periodPickerRow}>
          {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodPillBtn, pickedPeriod === p && styles.periodPillBtnActive]}
              onPress={() => setPickedPeriod(p)}
            >
              <Text style={[styles.periodPillBtnText, pickedPeriod === p && styles.periodPillBtnTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, items.length === 0 && styles.buttonDisabled]}
          onPress={handleLogMeal}
          disabled={items.length === 0}
        >
          <Text style={styles.buttonText}>Log Meal</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TouchableOpacity onPress={() => {
              setAddModalVisible(false);
              setSuggestions([]);
              setShowSuggestions(false);
            }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={isDiningHallMode ? 'Filter menu items…' : 'What food do you want to add?'}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={isDiningHallMode ? undefined : handleLookup}
              autoFocus
            />
            {!isDiningHallMode && (
              <TouchableOpacity
                style={[styles.searchBtn, lookupLoading && styles.searchBtnDisabled]}
                onPress={handleLookup}
                disabled={lookupLoading}
              >
                {lookupLoading
                  ? <ActivityIndicator color="#0F0F0F" size="small" />
                  : <Text style={styles.searchBtnText}>Search</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          {lookupError !== null && (
            <Text style={styles.lookupError}>{lookupError}</Text>
          )}

          {!isDiningHallMode && showSuggestions && (
            <View style={styles.autocompleteDropdown}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={s.name}
                  style={[styles.autocompleteRow, i < suggestions.length - 1 && styles.autocompleteRowBorder]}
                  onPress={() => handleSuggestionTap(s)}
                >
                  <View style={styles.autocompleteLeft}>
                    <Text style={styles.autocompleteName}>{s.name}</Text>
                    <Text style={styles.autocompleteCount}>{s.count}× logged · {s.item.cal} cal</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {suggestions.length < 3 && (
                <TouchableOpacity
                  style={[
                    styles.autocompleteRow,
                    suggestions.length > 0 && styles.autocompleteRowBorder,
                    styles.autocompleteDbRow,
                  ]}
                  onPress={() => {
                    const q = searchQuery.trim();
                    setAddModalVisible(false);
                    setSearchQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    navigation.navigate('Search', { query: q, context: 'estimate' });
                  }}
                >
                  <Text style={styles.autocompleteDbText}>Search food database →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isDiningHallMode && (
            <FlatList
              data={filteredMenuItems}
              keyExtractor={m => m.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.menuItemRow} onPress={() => handleAddMenuItemTap(item)}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemCal}>{item.calories} cal</Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  content: { padding: 20, paddingBottom: 40 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 8 },
  header: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  barcodeBadge: {
    backgroundColor: '#1A2A1A', borderWidth: 1, borderColor: '#00E5A0',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  barcodeBadgeText: { fontSize: 12, fontWeight: '700', color: '#00E5A0' },

  headerBack: { paddingRight: 16, paddingVertical: 4 },
  headerBackText: { color: '#FFFFFF', fontSize: 16 },

  analysisErrorCard: {
    backgroundColor: '#1A0A0A', borderWidth: 1, borderColor: '#FF4444',
    borderRadius: 12, padding: 14, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  analysisErrorText: { flex: 1, fontSize: 14, color: '#FF6B6B', fontWeight: '500' },

  imageQualityBanner: {
    backgroundColor: '#2A1500', borderWidth: 1, borderColor: '#FF9500',
    borderRadius: 12, padding: 14, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  imageQualityText: { flex: 1, fontSize: 14, color: '#FF9500', fontWeight: '500' },
  retakeBtn: { backgroundColor: '#FF9500', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  retakeBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 13 },

  venueCard: {
    backgroundColor: '#1A1A1A', borderRadius: 10, paddingVertical: 10,
    paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },
  venueCardText: { fontSize: 13, color: '#8A8A8A' },
  venueCardName: { fontWeight: '700', color: '#00E5A0' },

  fallbackCard: {
    backgroundColor: '#1A1A1A', borderRadius: 10, paddingVertical: 10,
    paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },
  fallbackText: { fontSize: 13, color: '#8A8A8A' },

  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },

  // Item card
  itemCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  itemHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  itemName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  sourceBadge: {
    backgroundColor: '#1A1A2A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    flexShrink: 0,
  },
  sourceBadgeText: { fontSize: 10, color: '#8A8AAA', fontWeight: '600' },
  confidenceAmber: { fontSize: 12, color: '#FF9500', marginTop: 6, fontStyle: 'italic' },

  // Visual portion picker
  visualPortionRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  vpBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#2A2A2A',
  },
  vpBtnActive: { backgroundColor: '#00E5A0' },
  vpEmoji: { fontSize: 18, marginBottom: 2 },
  vpLabel: { fontSize: 10, fontWeight: '600', color: '#8A8A8A' },
  vpLabelActive: { color: '#0F0F0F' },

  // Calories + macros display
  itemCalories: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  itemMacros: { fontSize: 13, color: '#8A8A8A' },

  // Confidence (kept for backward compat, unused)
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  confidenceBarTrack: { width: 60, height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden' },
  confidenceBarFill: { height: 4, backgroundColor: '#00E5A0', borderRadius: 2 },
  confidenceBarLow: { backgroundColor: '#FF9500' },
  confidenceText: { fontSize: 11, color: '#555' },
  confidenceLow: { color: '#FF9500' },

  removeAction: {
    backgroundColor: '#FF4444', justifyContent: 'center', alignItems: 'center',
    width: 90, borderRadius: 12, marginBottom: 12,
  },
  removeActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 24,
    alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  emptyText: { fontSize: 14, color: '#8A8A8A', fontStyle: 'italic' },

  // Feedback
  feedbackSection: { marginBottom: 16 },
  feedbackLabel: {
    fontSize: 12, fontWeight: '600', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  feedbackRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feedbackInput: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: '#FFFFFF',
    borderWidth: 1, borderColor: '#2A2A2A', minHeight: 44,
  },
  reanalyzeBtn: {
    backgroundColor: '#00E5A0', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center', minWidth: 96,
  },
  reanalyzeBtnDisabled: { opacity: 0.4 },
  reanalyzeBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 14 },
  reanalyzeError: { color: '#FF4444', fontSize: 12, marginTop: 6 },

  addItemBtn: {
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#1A1A1A',
  },
  addItemBtnText: { fontSize: 15, fontWeight: '600', color: '#00E5A0' },

  // Totals card
  totalsCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: '#2A2A2A',
  },
  estimateStatusTeal: {
    fontSize: 12, color: '#00E5A0', fontWeight: '600', marginBottom: 10,
  },
  estimateStatusSecondary: {
    fontSize: 12, color: '#8A8A8A', fontStyle: 'italic', marginBottom: 10,
  },
  totalsTitle: {
    fontSize: 12, fontWeight: '700', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  totalCalories: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  totalMacros: { fontSize: 14, color: '#8A8A8A', marginBottom: 14 },
  trafficRow: { flexDirection: 'row', gap: 14 },
  trafficItem: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  periodPickerRow: {
    flexDirection: 'row', gap: 6, marginBottom: 12,
  },
  periodPillBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 10, backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  periodPillBtnActive: { backgroundColor: '#00E5A0', borderColor: '#00E5A0' },
  periodPillBtnText: { fontSize: 11, fontWeight: '600', color: '#8A8A8A' },
  periodPillBtnTextActive: { color: '#0F0F0F' },

  button: { backgroundColor: '#00E5A0', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F0F0F' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalClose: { fontSize: 18, color: '#8A8A8A', paddingLeft: 16 },

  searchRow: { flexDirection: 'row', padding: 16, gap: 10 },
  searchInput: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  searchBtn: {
    backgroundColor: '#00E5A0', borderRadius: 10, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
  lookupError: { color: '#FF4444', fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },

  menuItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  menuItemName: { fontSize: 15, color: '#FFFFFF', flex: 1 },
  menuItemCal: { fontSize: 13, color: '#8A8A8A' },

  // Autocomplete dropdown
  autocompleteDropdown: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  autocompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  autocompleteRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  autocompleteLeft: { flex: 1 },
  autocompleteName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  autocompleteCount: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  autocompleteDbRow: { justifyContent: 'center' },
  autocompleteDbText: { fontSize: 14, color: '#00E5A0', fontWeight: '600' },
});
