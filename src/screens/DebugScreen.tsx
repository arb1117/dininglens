import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Clipboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config/api';
import { useMealContext } from '../context/MealContext';
import { useEntitlement } from '../hooks/useEntitlement';
import { getInstallId } from '../services/identityService';

// App version from package.json — expo-constants would be more accurate in a real build
const APP_VERSION = '1.0.0-beta';

type HealthState = 'unknown' | 'checking' | 'ok' | 'error';

export default function DebugScreen() {
  const navigation = useNavigation();
  const { mealLog, goals } = useMealContext();
  const { loading: entLoading, entitlement } = useEntitlement();

  const [health, setHealth]           = useState<HealthState>('unknown');
  const [healthMs, setHealthMs]       = useState<number | null>(null);
  const [lastError, setLastError]     = useState<string>('None');
  const [clearing, setClearing]       = useState(false);
  const [installIdPrefix, setInstallIdPrefix] = useState<string>('…');

  useEffect(() => {
    checkHealth();
    AsyncStorage.getItem('@dininglens_last_error')
      .then(v => { if (v) setLastError(v); })
      .catch(() => {});
    getInstallId()
      .then(id => setInstallIdPrefix(id.slice(0, 8)))
      .catch(() => {});
  }, []);

  async function checkHealth() {
    setHealth('checking');
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const ms = Date.now() - start;
      setHealthMs(ms);
      setHealth(res.ok ? 'ok' : 'error');
    } catch {
      setHealthMs(Date.now() - start);
      setHealth('error');
    }
  }

  async function clearLocalData() {
    Alert.alert(
      'Clear All Local Data',
      'This will delete all logged meals, goals, water, and exercise data. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const dininglensKeys = keys.filter(k => k.startsWith('@dininglens'));
              await AsyncStorage.multiRemove(dininglensKeys);
              Alert.alert('Done', 'All local data cleared. Restart the app to see defaults.');
            } catch {
              Alert.alert('Error', 'Could not clear data — try again.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }

  function trialDaysLeft(): string {
    if (!entitlement) return '—';
    const ms = new Date(entitlement.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days}d` : 'expired';
  }

  function copyDebugInfo() {
    const info = [
      `DiningLens ${APP_VERSION}`,
      `Install ID: ${installIdPrefix}…`,
      `Backend: ${API_BASE_URL}`,
      `Health: ${health}${healthMs != null ? ` (${healthMs}ms)` : ''}`,
      `Entitlement: ${entitlement?.status ?? '?'} / coach ${entitlement?.coachMessagesRemaining ?? '?'} left`,
      `Meals logged: ${mealLog.length}`,
      `Goal: ${goals.calories}kcal / ${goals.protein}g P / ${goals.carbs}g C / ${goals.fat}g F`,
      `Last error: ${lastError}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');
    Clipboard.setString(info);
    Alert.alert('Copied', 'Debug info copied to clipboard.');
  }

  const healthColor = health === 'ok' ? '#00E5A0' : health === 'error' ? '#FF4444' : '#8A8A8A';
  const healthLabel = health === 'checking' ? 'Checking…' : health === 'ok' ? `OK (${healthMs}ms)` : health === 'error' ? `Unreachable (${healthMs}ms)` : 'Tap to check';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Debug Info</Text>
        <Text style={s.subtitle}>For bug reports — no API keys shown</Text>

        <View style={s.card}>
          <Row label="App version"  value={APP_VERSION} />
          <Row label="Install ID"   value={`${installIdPrefix}…`} mono />
          <Row label="Backend URL"  value={API_BASE_URL} mono />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Backend Health</Text>
          <View style={s.healthRow}>
            {health === 'checking'
              ? <ActivityIndicator color="#00E5A0" size="small" />
              : <View style={[s.healthDot, { backgroundColor: healthColor }]} />
            }
            <Text style={[s.healthLabel, { color: healthColor }]}>{healthLabel}</Text>
            <TouchableOpacity style={s.checkBtn} onPress={checkHealth}>
              <Text style={s.checkBtnText}>Recheck</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Entitlement</Text>
          {entLoading
            ? <ActivityIndicator color="#00E5A0" size="small" style={{ alignSelf: 'flex-start' }} />
            : <>
                <Row label="Status"        value={entitlement?.status ?? '—'} />
                <Row label="Trial ends"    value={trialDaysLeft()} />
                <Row label="Coach left"    value={entitlement ? `${entitlement.coachMessagesRemaining} / ${entitlement.coachMessagesLimit}` : '—'} />
                <Row label="Can use app"   value={entitlement ? (entitlement.canUseApp ? 'yes' : 'no') : '—'} />
              </>
          }
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Local State</Text>
          <Row label="Meals in log" value={String(mealLog.length)} />
          <Row label="Today's meals" value={String(
            mealLog.filter(m => new Date(m.timestamp).toDateString() === new Date().toDateString()).length
          )} />
          <Row label="Calorie goal" value={`${goals.calories} kcal`} />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Last Error</Text>
          <Text style={s.lastErrorText}>{lastError}</Text>
        </View>

        <TouchableOpacity style={s.copyBtn} onPress={copyDebugInfo}>
          <Text style={s.copyBtnText}>Copy Debug Info</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.clearBtn}
          onPress={clearLocalData}
          disabled={clearing}
        >
          {clearing
            ? <ActivityIndicator color="#FF4444" size="small" />
            : <Text style={s.clearBtnText}>Clear All Local Data</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && s.rowValueMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 24 },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 14,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: 14, color: '#8A8A8A', flex: 1 },
  rowValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', flex: 2, textAlign: 'right' },
  rowValueMono: { fontFamily: 'monospace', fontSize: 11, color: '#8A8A8A' },

  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  checkBtn: {
    backgroundColor: '#2A2A2A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  checkBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },

  lastErrorText: { fontSize: 13, color: '#FF6B6B', lineHeight: 18 },

  copyBtn: {
    backgroundColor: '#2A2A2A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 12,
  },
  copyBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },

  clearBtn: {
    backgroundColor: '#2A0A0A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#5A1A1A',
  },
  clearBtnText: { fontSize: 15, color: '#FF4444', fontWeight: '700' },

  backBtn: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  backBtnText: { fontSize: 15, color: '#8A8A8A', fontWeight: '600' },
});
