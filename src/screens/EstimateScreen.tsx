import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, TextInput, ActivityIndicator, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext, MacroItem } from '../context/MealContext';
import { MenuItem } from '../services/menuService';
import { AnalysisResult } from '../services/visionService';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

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
  confidence?: number;
  manuallyAdded?: boolean;
};

function buildInitialItems(
  analysisResult: Props['route']['params']['analysisResult'],
  menuItems: ReturnType<typeof useMealContext>['menuItems']
): NormalizedItem[] {
  // Image quality / low confidence errors: start empty so user sees the error banner,
  // not a confusing set of fallback items
  if (
    analysisResult?.reason === 'image_quality' ||
    analysisResult?.reason === 'low_confidence'
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
          confidence: detected.confidence,
        };
      })
      .filter((x): x is NormalizedItem => x !== null);
  }

  return analysisResult.detectedItems.map((item, i) => ({
    id: `generic-${i}`,
    name: item.name,
    cal: item.calories ?? 0,
    protein: item.protein ?? 0,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    initialPortion: multiplierToPortion(item.portionMultiplier),
    confidence: item.confidence,
  }));
}

export default function EstimateScreen({ navigation, route }: Props) {
  const { addMeal, menuItems, venue } = useMealContext();
  const { analysisResult, imageBase64 } = route.params;

  const [items, setItems] = useState<NormalizedItem[]>(() =>
    buildInitialItems(analysisResult, menuItems)
  );

  const [portions, setPortions] = useState<Record<string, Portion>>(
    () => Object.fromEntries(
      buildInitialItems(analysisResult, menuItems).map(i => [i.id, i.initialPortion])
    )
  );

  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  // Add-item modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Re-evaluate state
  const [feedbackText, setFeedbackText] = useState('');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [hasReanalyzed, setHasReanalyzed] = useState(false);

  const isDiningHallMode = venue !== null;

  // Custom header back button — returns to Camera without logging
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

  function removeItem(id: string) {
    swipeableRefs.current[id]?.close();
    setItems(prev => prev.filter(i => i.id !== id));
    setPortions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function openAddModal() {
    setSearchQuery('');
    setLookupError(null);
    setAddModalVisible(true);
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
        initialPortion: 'Normal',
        manuallyAdded: true,
      };
      setItems(prev => [...prev, newItem]);
      setPortions(prev => ({ ...prev, [newItem.id]: 'Normal' }));
      setAddModalVisible(false);
      setSearchQuery('');
    } catch {
      setLookupError('Could not find item — try a different name.');
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
      initialPortion: 'Normal',
      manuallyAdded: true,
    };
    setItems(prev => [...prev, newItem]);
    setPortions(prev => ({ ...prev, [newItem.id]: 'Normal' }));
    setAddModalVisible(false);
    setSearchQuery('');
  }

  async function handleReanalyze() {
    if (!feedbackText.trim() || !imageBase64) return;
    console.log('[reanalyze] starting, imageBase64 length:', imageBase64.length, 'server:', SERVER_URL);
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
      console.log('[reanalyze] success, items:', newResult.detectedItems?.length);
      const newItems = buildInitialItems(newResult, menuItems);
      setItems(newItems);
      setPortions(Object.fromEntries(newItems.map(i => [i.id, i.initialPortion])));
      setFeedbackText('');
      setHasReanalyzed(true);
    } catch (err) {
      console.error('[reanalyze] error:', err);
      setReanalyzeError(err instanceof Error ? err.message : 'Re-evaluate failed — check your connection.');
    } finally {
      setReanalyzing(false);
    }
  }

  const totals = useMemo(() =>
    items.reduce(
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
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, portions]
  );

  function handleLogMeal() {
    const mealItems: MacroItem[] = items.map(item => {
      const portion = getPortionFor(item.id);
      const scaled = getScaled(item, portion);
      return { name: item.name, portion, ...scaled };
    });
    addMeal({ id: String(Date.now()), timestamp: new Date().toLocaleString(), items: mealItems, totals });
    navigation.pop();
  }

  const imageQualityError = !hasReanalyzed && (
    analysisResult?.reason === 'image_quality' || analysisResult?.reason === 'low_confidence'
  );
  const isFallback = !hasReanalyzed && !imageQualityError &&
    (!analysisResult || analysisResult.detectedItems.length === 0);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.header}>Meal Estimate</Text>

        {/* Fix 2: image quality / low confidence error banner */}
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

        {venue && !isFallback && (
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
            <Text style={styles.fallbackText}>Using default menu items — tap portions to adjust</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>
          {isFallback ? 'Menu Items' : 'Detected Items'}
        </Text>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No items — add items manually</Text>
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
                  <Text style={styles.itemName}>{item.name}</Text>
                  {!item.manuallyAdded && item.confidence !== undefined && (
                    <View style={styles.confidenceRow}>
                      <View style={styles.confidenceBarTrack}>
                        <View style={[
                          styles.confidenceBarFill,
                          { width: `${Math.round(item.confidence * 100)}%` as any },
                          item.confidence < 0.6 && styles.confidenceBarLow,
                        ]} />
                      </View>
                      <Text style={[
                        styles.confidenceText,
                        item.confidence < 0.6 && styles.confidenceLow,
                      ]}>
                        {Math.round(item.confidence * 100)}% confident
                      </Text>
                    </View>
                  )}
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
              </Swipeable>
            );
          })
        )}

        {/* AI feedback / re-evaluate row — only shown when we have an image to reanalyze */}
        {imageBase64 && (
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackLabel}>Correct the AI</Text>
            <View style={styles.feedbackRow}>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Tell the AI what's wrong… (e.g. 'those are bananas not rice')"
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

        <TouchableOpacity style={styles.addItemBtn} onPress={openAddModal}>
          <Text style={styles.addItemBtnText}>+ Add item</Text>
        </TouchableOpacity>

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
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder={isDiningHallMode ? 'Filter menu items…' : 'Search food…'}
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

          {isDiningHallMode && (
            <FlatList
              data={filteredMenuItems}
              keyExtractor={m => m.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.menuItemRow} onPress={() => handleAddMenuItemTap(item)}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemMacros}>{item.calories} cal</Text>
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
  header: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 12, marginTop: 8 },

  headerBack: { paddingRight: 16, paddingVertical: 4 },
  headerBackText: { color: '#FFFFFF', fontSize: 16 },

  imageQualityBanner: {
    backgroundColor: '#2A1500',
    borderWidth: 1,
    borderColor: '#FF9500',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  imageQualityText: { flex: 1, fontSize: 14, color: '#FF9500', fontWeight: '500' },
  retakeBtn: {
    backgroundColor: '#FF9500', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
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

  itemCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  itemName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },

  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  confidenceBarTrack: {
    width: 60, height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden',
  },
  confidenceBarFill: { height: 4, backgroundColor: '#00E5A0', borderRadius: 2 },
  confidenceBarLow: { backgroundColor: '#FF9500' },
  confidenceText: { fontSize: 12, color: '#8A8A8A' },
  confidenceLow: { color: '#FF9500' },

  portionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  portionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#2A2A2A', alignItems: 'center',
  },
  portionBtnActive: { backgroundColor: '#00E5A0' },
  portionBtnText: { fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  portionBtnTextActive: { color: '#0F0F0F' },

  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macroText: {
    fontSize: 12, color: '#8A8A8A', backgroundColor: '#2A2A2A',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },

  removeAction: {
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 12,
    marginBottom: 12,
  },
  removeActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 24,
    alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  emptyText: { fontSize: 14, color: '#8A8A8A', fontStyle: 'italic' },

  // Feedback / re-evaluate
  feedbackSection: {
    marginBottom: 16,
  },
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
    marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
  },
  addItemBtnText: { fontSize: 15, fontWeight: '600', color: '#00E5A0' },

  totalsCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 20,
    marginTop: 4, marginBottom: 20, borderWidth: 1, borderColor: '#2A2A2A',
  },
  totalsTitle: {
    color: '#8A8A8A', fontSize: 12, fontWeight: '700',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalItem: { alignItems: 'center' },
  totalValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  totalLabel: { color: '#8A8A8A', fontSize: 12, fontWeight: '500', marginTop: 2 },

  button: {
    backgroundColor: '#00E5A0', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
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

  lookupError: {
    color: '#FF4444', fontSize: 13, paddingHorizontal: 16, marginBottom: 8,
  },

  menuItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  menuItemName: { fontSize: 15, color: '#FFFFFF', flex: 1 },
  menuItemMacros: { fontSize: 13, color: '#8A8A8A' },
});
