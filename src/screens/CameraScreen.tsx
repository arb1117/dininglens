import React, { useEffect, useRef, useState } from 'react';
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
import { detectVenue } from '../services/venueService';
import { fetchMenu } from '../services/menuService';
import { analyzeImage } from '../services/visionService';
import { useMealContext } from '../context/MealContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'> };

type VenueStatus = 'loading' | 'found' | 'none';

export default function CameraScreen({ navigation }: Props) {
  const { setMenuItems, setPeriodLabel, setVenue, venue, periodLabel, menuItems } =
    useMealContext();

  const [permission, requestPermission] = useCameraPermissions();
  const [venueStatus, setVenueStatus] = useState<VenueStatus>('loading');
  const [analyzing, setAnalyzing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  // Venue + menu load on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setVenueStatus('loading');
      try {
        const detected = await detectVenue({ lat: 0, lon: 0 });
        if (cancelled) return;
        if (!detected) { setVenue(null); setVenueStatus('none'); return; }
        setVenue(detected);
        const date = new Date().toISOString().split('T')[0];
        const { items, periodLabel: label } = await fetchMenu(detected.locationId, date);
        if (cancelled) return;
        setMenuItems(items);
        setPeriodLabel(label);
        setVenueStatus('found');
      } catch {
        if (!cancelled) setVenueStatus('none');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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

      const result = await analyzeImage(
        photo.base64,
        venueStatus === 'found' ? menuItems : undefined
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
        {/* Top overlay — safe area + banner */}
        <SafeAreaView style={styles.topOverlay}>
          <VenueBanner
            status={venueStatus}
            venueName={venue?.name}
            periodLabel={periodLabel}
          />
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
          {/* Shutter */}
          <TouchableOpacity
            style={[styles.shutter, analyzing && styles.shutterDisabled]}
            onPress={handleShutter}
            disabled={analyzing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {/* Floating history button */}
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

function VenueBanner({
  status,
  venueName,
  periodLabel,
}: {
  status: VenueStatus;
  venueName?: string;
  periodLabel: string;
}) {
  if (status === 'loading') {
    return (
      <View style={styles.banner}>
        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.bannerText}>Detecting venue…</Text>
      </View>
    );
  }
  if (status === 'found' && venueName) {
    return (
      <View style={[styles.banner, styles.bannerFound]}>
        <Text style={styles.bannerText}>
          {'📍 '}
          <Text style={styles.bannerVenue}>{venueName}</Text>
          {` — ${periodLabel} menu loaded`}
        </Text>
      </View>
    );
  }
  return null;
}

const SHUTTER_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Top overlay
  topOverlay: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  bannerFound: {
    backgroundColor: 'rgba(46,125,50,0.75)',
  },
  bannerText: { fontSize: 13, color: '#fff' },
  bannerVenue: { fontWeight: '700' },
  errorBanner: {
    backgroundColor: 'rgba(180,0,0,0.75)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  errorBannerText: { fontSize: 13, color: '#fff', textAlign: 'center' },

  // Analyzing overlay
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  analyzingText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  // Bottom controls
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

  // Permission screen
  permissionScreen: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#500000',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#500000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
