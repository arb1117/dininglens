import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { RootStackParamList } from '../../App';
import { STORAGE_KEYS } from '../storage/storageKeys';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Permissions'> };

type PermStatus = 'unknown' | 'granted' | 'skipped';

export default function PermissionsScreen({ navigation }: Props) {
  const [locationStatus, setLocationStatus] = useState<PermStatus>('unknown');
  const [cameraStatus, setCameraStatus] = useState<PermStatus>('unknown');

  const canContinue =
    (locationStatus === 'granted' || locationStatus === 'skipped') &&
    (cameraStatus === 'granted' || cameraStatus === 'skipped');

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationStatus(status === 'granted' ? 'granted' : 'skipped');
  }

  async function requestCamera() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraStatus(status === 'granted' ? 'granted' : 'skipped');
  }

  async function handleContinue() {
    await AsyncStorage.setItem('@dininglens_permissions_done', 'true');
    const [goals, legacyGoals] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.GOALS),
      AsyncStorage.getItem('@dininglens_goals'),
    ]);
    navigation.reset({ index: 0, routes: [{ name: goals || legacyGoals ? 'MainTabs' : 'Goals' }] });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>DiningLens</Text>
        <Text style={styles.subtitle}>A couple of permissions to get started</Text>

        <View style={styles.rows}>
          <PermRow
            icon="📍"
            title="Location"
            description="Detects nearby dining halls and restaurants for better accuracy"
            status={locationStatus}
            onRequest={requestLocation}
            onSkip={() => setLocationStatus('skipped')}
          />
          <PermRow
            icon="📷"
            title="Camera"
            description="Scan meals and barcodes for instant macro tracking"
            status={cameraStatus}
            onRequest={requestCamera}
            onSkip={() => setCameraStatus('skipped')}
          />
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

type PermRowProps = {
  icon: string;
  title: string;
  description: string;
  status: PermStatus;
  onRequest: () => void;
  onSkip: () => void;
};

function PermRow({ icon, title, description, status, onRequest, onSkip }: PermRowProps) {
  const granted = status === 'granted';
  const skipped = status === 'skipped';
  const done = granted || skipped;

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowIcon}>{icon}</Text>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDesc}>{description}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        {done ? (
          <Text style={[styles.statusLabel, skipped && styles.statusSkipped]}>
            {granted ? '✓ Allowed' : 'Skipped'}
          </Text>
        ) : (
          <View style={styles.actionBtns}>
            <TouchableOpacity style={styles.allowBtn} onPress={onRequest}>
              <Text style={styles.allowBtnText}>Allow</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8A8A8A', textAlign: 'center', marginBottom: 48 },

  rows: { width: '100%', gap: 16, marginBottom: 48 },

  row: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 18,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  rowIcon: { fontSize: 28, marginRight: 14, marginTop: 2 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  rowDesc: { fontSize: 13, color: '#8A8A8A', lineHeight: 18 },
  rowRight: { alignItems: 'flex-end' },

  actionBtns: { flexDirection: 'row', gap: 10 },
  allowBtn: {
    backgroundColor: '#00E5A0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  allowBtnText: { color: '#0F0F0F', fontSize: 14, fontWeight: '700' },
  skipBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipBtnText: { color: '#8A8A8A', fontSize: 14 },

  statusLabel: { fontSize: 14, fontWeight: '600', color: '#00E5A0' },
  statusSkipped: { color: '#8A8A8A' },

  continueBtn: {
    width: '100%',
    backgroundColor: '#00E5A0',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.35 },
  continueBtnText: { color: '#0F0F0F', fontSize: 17, fontWeight: '700' },
});
