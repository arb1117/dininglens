import React, { useRef, useState, useEffect } from 'react';
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
import { KNOWN_VENUES, detectVenue } from '../services/venueService';
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

  useEffect(() => {
    detectVenue().then(detected => {
      if (detected && diningHallStatus === 'inactive') {
        enableDiningHallModeForVenue(detected);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableDiningHallModeForVenue(venueToLoad = KNOWN_VENUES[0]) {
    setDiningHallStatus('loading');
    try {
      const date = new Date().toISOString().split('T')[0];
      const { items, periodLabel: label } = await fetchMenu(venueToLoad.locationId, date);
      setVenue(venueToLoad);
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
    let imageBase64: string | undefined;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });

      if (!photo?.base64) throw new Error('No image data');
      imageBase64 = photo.base64;

      const result = await analyzeImage(
        photo.base64,
        isDiningHallMode ? menuItems : undefined
      );

      navigation.navigate('Estimate', { analysisResult: result, imageBase64 });
    } catch (err) {
      console.error('Shutter error:', err);
      setErrorBanner('Estimate unavailable — using defaults');
      navigation.navigate('Estimate', { analysisResult: undefined, imageBase64 });
    } finally {
      setAnalyzing(false);
    }
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#00E5A0" /></View>;
  }

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

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">

        {/* Active venue banner — slim top bar with teal background */}
        {diningHallStatus === 'active' && venue && (
          <SafeAreaView style={styles.venueBanner}>
            <View style={styles.venueBannerContent}>
              <Text style={styles.venueBannerText} numberOfLines={1}>
                {'📍 '}
                <Text style={styles.venueBannerName}>{venue.name}</Text>
                {` — ${periodLabel}`}
              </Text>
              <TouchableOpacity onPress={disableDiningHallMode} style={styles.venueBannerDismiss}>
                <Text style={styles.venueBannerDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}

        {/* Loading banner */}
        {diningHallStatus === 'loading' && (
          <SafeAreaView style={styles.loadingBanner}>
            <View style={styles.loadingBannerContent}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.loadingBannerText}>Loading dining hall menu…</Text>
            </View>
          </SafeAreaView>
        )}

        {/* Error banner */}
        {errorBanner && (
          <SafeAreaView style={styles.errorBannerWrap}>
            <View style={styles.errorBannerContent}>
              <Text style={styles.errorBannerText}>{errorBanner}</Text>
            </View>
          </SafeAreaView>
        )}

        {/* Analyzing overlay */}
        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>Analyzing meal...</Text>
          </View>
        )}

        {/* Shutter — centered, 80px from bottom */}
        <View style={styles.shutterContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.shutter, analyzing && styles.shutterDisabled]}
            onPress={handleShutter}
            disabled={analyzing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>

        {/* Inactive venue chip — bottom-left */}
        {diningHallStatus === 'inactive' && (
          <TouchableOpacity
            style={styles.venueChip}
            onPress={() => enableDiningHallModeForVenue()}
          >
            <Text style={styles.venueChipText}>🍽 Dining hall?</Text>
          </TouchableOpacity>
        )}

        {/* History button — bottom-right */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.historyButtonText}>📋</Text>
        </TouchableOpacity>

      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' },

  // Active venue banner — slim full-width top bar
  venueBanner: { backgroundColor: '#00E5A0' },
  venueBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  venueBannerText: { flex: 1, fontSize: 13, color: '#0F0F0F' },
  venueBannerName: { fontWeight: '700' },
  venueBannerDismiss: { paddingLeft: 12 },
  venueBannerDismissText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },

  // Loading banner
  loadingBanner: { backgroundColor: 'rgba(0,0,0,0.55)' },
  loadingBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  loadingBannerText: { fontSize: 13, color: '#fff' },

  // Error banner
  errorBannerWrap: { backgroundColor: 'rgba(180,0,0,0.8)' },
  errorBannerContent: { paddingHorizontal: 16, paddingVertical: 9 },
  errorBannerText: { fontSize: 13, color: '#fff', textAlign: 'center' },

  // Analyzing overlay
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  analyzingText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  // Shutter — full-width container at bottom: 80 so button self-centers
  shutterContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  // Inactive venue chip — bottom-left
  venueChip: {
    position: 'absolute',
    left: 20,
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  venueChipText: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // History button — bottom-right
  historyButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
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
    flex: 1, backgroundColor: '#0F0F0F',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  permissionTitle: {
    fontSize: 22, fontWeight: '800', color: '#FFFFFF',
    marginBottom: 16, textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15, color: '#8A8A8A', textAlign: 'center',
    lineHeight: 22, marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#00E5A0', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  permissionButtonText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});
