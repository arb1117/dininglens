import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMealContext } from '../context/MealContext';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

type SearchResult = {
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Multiplier = { label: string; value: number; portion: 'Small' | 'Normal' | 'Large' | 'Double' };

const MULTIPLIERS: Multiplier[] = [
  { label: '½x', value: 0.5, portion: 'Small' },
  { label: '1x', value: 1.0, portion: 'Normal' },
  { label: '2x', value: 2.0, portion: 'Double' },
];

function round1(n: number) { return Math.round(n * 10) / 10; }

export default function SearchScreen({ navigation, route }: Props) {
  const { addMeal } = useMealContext();

  const [query, setQuery] = useState(route?.params?.query ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState<Multiplier>(MULTIPLIERS[1]);
  const [loggedName, setLoggedName] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${SERVER_URL}/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setSelectedIndex(null);
      } catch (err) {
        console.error('[search]', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function handleLog(item: SearchResult) {
    const m = multiplier.value;
    const mealItem = {
      name: item.name,
      portion: multiplier.portion,
      cal: round1(item.calories * m),
      protein: round1(item.protein * m),
      carbs: round1(item.carbs * m),
      fat: round1(item.fat * m),
    };
    addMeal({
      id: String(Date.now()),
      timestamp: new Date().toLocaleString(),
      items: [mealItem],
      totals: { cal: mealItem.cal, protein: mealItem.protein, carbs: mealItem.carbs, fat: mealItem.fat },
    });
    setLoggedName(item.name);
    setTimeout(() => navigation.navigate('Camera'), 900);
  }

  return (
    <View style={styles.container}>
      {loggedName !== null && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✓ {loggedName} logged</Text>
        </View>
      )}

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search any food, supplement, or product…"
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#00E5A0" size="small" />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      )}

      {!loading && results.length === 0 && !query.trim() && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Search for any food, supplement, or product</Text>
        </View>
      )}

      {!loading && results.length === 0 && query.trim().length > 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const expanded = selectedIndex === index;
          const m = expanded ? multiplier.value : 1.0;
          return (
            <TouchableOpacity
              style={[styles.resultCard, expanded && styles.resultCardExpanded]}
              onPress={() => {
                if (selectedIndex === index) {
                  setSelectedIndex(null);
                } else {
                  setSelectedIndex(index);
                  setMultiplier(MULTIPLIERS[1]);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.resultRow}>
                <View style={styles.resultLeft}>
                  <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.resultServing}>{item.serving_size}</Text>
                </View>
                <View style={styles.resultRight}>
                  <Text style={styles.resultCal}>{Math.round(item.calories * m)}</Text>
                  <Text style={styles.resultCalLabel}>cal</Text>
                </View>
              </View>

              <View style={styles.macroPills}>
                <Text style={styles.macroPill}>{round1(item.protein * m)}g P</Text>
                <Text style={styles.macroPill}>{round1(item.carbs * m)}g C</Text>
                <Text style={styles.macroPill}>{round1(item.fat * m)}g F</Text>
              </View>

              {expanded && (
                <View style={styles.portionRow}>
                  <View style={styles.multiplierBtns}>
                    {MULTIPLIERS.map(opt => (
                      <TouchableOpacity
                        key={opt.label}
                        style={[styles.multBtn, multiplier.value === opt.value && styles.multBtnActive]}
                        onPress={() => setMultiplier(opt)}
                      >
                        <Text style={[styles.multBtnText, multiplier.value === opt.value && styles.multBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.logBtn} onPress={() => handleLog(item)}>
                    <Text style={styles.logBtnText}>Log</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },

  toast: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#00E5A0',
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 10,
  },
  toastText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },

  searchBar: { padding: 16, paddingBottom: 8 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  loadingText: { fontSize: 14, color: '#8A8A8A' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#8A8A8A', textAlign: 'center' },

  list: { padding: 12, paddingTop: 4 },

  resultCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  resultCardExpanded: { borderColor: '#00E5A0' },

  resultRow: { flexDirection: 'row', alignItems: 'flex-start' },
  resultLeft: { flex: 1, marginRight: 12 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  resultServing: { fontSize: 12, color: '#8A8A8A' },
  resultRight: { alignItems: 'flex-end' },
  resultCal: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  resultCalLabel: { fontSize: 11, color: '#8A8A8A' },

  macroPills: { flexDirection: 'row', gap: 6, marginTop: 8 },
  macroPill: {
    fontSize: 12, color: '#8A8A8A', backgroundColor: '#2A2A2A',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },

  portionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  multiplierBtns: { flexDirection: 'row', gap: 8, flex: 1 },
  multBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#2A2A2A', alignItems: 'center',
  },
  multBtnActive: { backgroundColor: '#00E5A0' },
  multBtnText: { fontSize: 14, fontWeight: '600', color: '#8A8A8A' },
  multBtnTextActive: { color: '#0F0F0F' },

  logBtn: {
    backgroundColor: '#00E5A0', borderRadius: 8,
    paddingHorizontal: 22, paddingVertical: 9,
  },
  logBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
});
