import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const MENU_ITEMS = [
  'Grilled Chicken Breast',
  'White Rice',
  'Green Beans',
  'Mac and Cheese',
  'Turkey Burger',
];

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Duncan Dining Hall · Dinner</Text>
      <Text style={styles.sectionLabel}>Today's Menu</Text>
      <FlatList
        data={MENU_ITEMS}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>{item}</Text>
          </View>
        )}
        style={styles.list}
      />
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
  list: { flex: 1, marginBottom: 16 },
  menuItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuItemText: { fontSize: 16, color: '#333' },
  button: { backgroundColor: '#500000', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#f0f0f0' },
  secondaryButtonText: { color: '#500000' },
});
