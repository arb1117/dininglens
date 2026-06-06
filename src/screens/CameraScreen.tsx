import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { KNOWN_VENUES } from '../services/venueService';
import { fetchMenu } from '../services/menuService';
import { analyzeImage } from '../services/visionService';
import { useMealContext } from '../context/MealContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'> };

type DiningHallStatus = 'inactive' | 'loading' | 'active';

export default function CameraScreen({ navigation }: Props) {
  const { setMenuItems, setPeriodLabel, setVenue, venue, periodLabel, menuItems } =
    useMealContext();

  const [permission, requestPermission] = useCameraPermissions();
  const [diningHallStatus, setDiningHallStatus] = useState<DiningHallStatus>('inactive');
  const [analyzing, setAnalyzing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  const isDiningHallMode = diningHallStatus === 'active';

  async function enableDiningHallMode() {
    setDiningHallStatus('loading');
    try {
      const duncan = KNOWN_VENUES[0];
      const date = new Date().toISOString().split('T')[0];
      const { items, periodLabel: label } = await fetchMenu(duncan.locationId, date);
      setVenue(duncan);
      setMenuItems(items);
      setPeriodLabel(label);
      setDiningHallStatus('active');
    } catch {
      setDiningHallStatus('inactive');
    }
  }

  function disableDiningHallMode() {
    setDiningHallStatus('inactive');
    setVenue(null);
  }

  async function handleShutter() {
    if (!cameraRef.current || analyzing) return;
    setAnalyzing(true);
    setErrorBanner(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });

      if (!photo?.base64) throw new Error('No image data');

      // Only pass menu context when user has opted into dining hall mode
      const result = await analyzeImage(
        photo.base64,
        isDiningHallMode ? menuItems : undefined
      );

      navigation.navigate('Estimate', { analysisResult: result });
    } catch (err) {
      console.error('Shutter error:', err);
      setErrorBanner('Estimate unavailable — using defaults');
      navigation.navigate('Estimate', { analysisResult: undefined });
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Permission not yet determined ──────────────────────────
  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#500000" /></View>;
  }

  // ── Permission denied ──────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionBody}>
          DiningLens needs camera access to photograph your meal and estimate macros.
          {'\n\n'}Enable it in Settings → Privacy → Camera.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Camera ready ───────────────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">

        {/* Top overlay */}
        <SafeAreaView style={styles.topOverlay}>
          {/* Dining hall status banner / toggle */}
          {diningHallStatus === 'inactive' && (
            <TouchableOpacity style={styles.diningToggle} onPress={enableDiningHallMode}>
              <Text style={styles.diningToggleText}>🍽 Near a dining hall? Tap to enable</Text>
            </TouchableOpacity>
          )}

          {diningHallStatus === 'loading' && (
            <View style={styles.banner}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.bannerText}>Loading dining hall menu…</Text>
            </View>
          )}

          {diningHallStatus === 'active' && venue && (
            <View style={[styles.banner, styles.bannerFound]}>
              <Text style={styles.bannerText} numberOfLines={1}>
                {'📍 '}
                <Text style={styles.bannerVenue}>{venue.name}</Text>
                {` — ${periodLabel} menu loaded`}
              </Text>
              <TouchableOpacity onPress={disableDiningHallMode} style={styles.bannerDismiss}>
                <Text style={styles.bannerDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {errorBanner && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorBanner}</Text>
            </View>
          )}
        </SafeAreaView>

        {/* Analyzing overlay */}
        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>Analyzing meal…</Text>
          </View>
        )}

        {/* Bottom controls */}
        <SafeAreaView style={styles.bottomOverlay}>
          <TouchableOpacity
            style={[styles.shutter, analyzing && styles.shutterDisabled]}
            onPress={handleShutter}
            disabled={analyzing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.historyButtonText}>📋</Text>
          </TouchableOpacity>
        </SafeAreaView>

      </CameraView>
    </View>
  );
}

const SHUTTER_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topOverlay: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  // Inactive dining hall toggle chip
  diningToggle: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  diningToggleText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // Active/loading venue banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  bannerFound: { backgroundColor: 'rgba(46,125,50,0.85)' },
  bannerText: { fontSize: 13, color: '#fff', flex: 1 },
  bannerVenue: { fontWeight: '700' },
  bannerDismiss: { paddingLeft: 10, paddingVertical: 2 },
  bannerDismissText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },

  errorBanner: {
    backgroundColor: 'rgba(180,0,0,0.75)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  errorBannerText: { fontSize: 13, color: '#fff', textAlign: 'center' },

  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  analyzingText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
  },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: {
    width: SHUTTER_SIZE - 18,
    height: SHUTTER_SIZE - 18,
    borderRadius: (SHUTTER_SIZE - 18) / 2,
    backgroundColor: '#fff',
  },
  historyButton: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButtonText: { fontSize: 22 },

  permissionScreen: {
    flex: 1, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  permissionTitle: {
    fontSize: 22, fontWeight: '800', color: '#500000',
    marginBottom: 16, textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15, color: '#555', textAlign: 'center',
    lineHeight: 22, marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#500000', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
