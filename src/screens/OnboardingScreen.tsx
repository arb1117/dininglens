import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DiningLens</Text>
      <Text style={styles.subtitle}>Dining hall macro tracking made easy.</Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>Texas A&amp;M University</Text>
        <Text style={styles.infoText}>Duncan Dining Hall</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 36, fontWeight: '800', color: '#500000', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 40 },
  infoBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, marginBottom: 48, width: '100%', alignItems: 'center' },
  infoText: { fontSize: 16, color: '#333', fontWeight: '600', marginBottom: 4 },
  button: { backgroundColor: '#500000', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 48 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
