import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'> };

export default function CameraScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Capture Your Meal</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Meal photo placeholder</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Estimate')}>
        <Text style={styles.buttonText}>Analyze Meal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, alignItems: 'center' },
  header: { fontSize: 22, fontWeight: '800', color: '#500000', marginBottom: 24, marginTop: 8, alignSelf: 'flex-start' },
  placeholder: { width: '100%', flex: 1, backgroundColor: '#ccc', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  placeholderText: { fontSize: 18, color: '#666', fontWeight: '500' },
  button: { backgroundColor: '#500000', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 48, width: '100%', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
