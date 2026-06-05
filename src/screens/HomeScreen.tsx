import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchMenu } from '../services/menuService';
import { useMealContext } from '../context/MealContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

export default function HomeScreen({ navigation }: Props) {
  const { menuItems, setMenuItems } = useMealContext();
  const [periodLabel, setPeriodLabel] = useState('Dinner');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenu().then(({ items, periodLabel: label }) => {
      setMenuItems(items);
      setPeriodLabel(label);
      setLoading(false);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{`Duncan Dining Hall · ${periodLabel}`}</Text>
      <Text style={styles.sectionLabel}>Today's Menu</Text>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#500000" />
          <Text style={styles.loadingText}>Loading menu…</Text>
        </View>
      ) : (
        <FlatList
          data={menuItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.menuItem}>
              <Text style={styles.menuItemText}>{item.name}</Text>
              <Text style={styles.menuItemMacros}>{item.calories} cal</Text>
            </View>
          )}
          style={styles.list}
        />
      )}
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Camera')}>
        <Text style={styles.buttonText}>Take Meal Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate('History')}>
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Meal History</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 22, fontWeight: '800', color: '#500000', marginBottom: 16, marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#888' },
  list: { flex: 1, marginBottom: 16 },
  menuItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuItemText: { fontSize: 16, color: '#333', flex: 1 },
  menuItemMacros: { fontSize: 13, color: '#888', marginLeft: 8 },
  button: { backgroundColor: '#500000', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  secondaryButtonText: { color: '#500000' },
});
