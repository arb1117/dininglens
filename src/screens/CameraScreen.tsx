import React, { useRef, useState, useEffect, useMemo } from 'react';
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

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'> };

type DiningHallStatus = 'inactive' | 'loading' | 'active';
type ScanMode = 'photo' | 'barcode';

export default function CameraScreen({ navigation }: Props) {
  const { setMenuItems, setPeriodLabel, setVenue, venue, periodLabel, menuItems, mealLog } =
    useMealContext();

  const [permission, requestPermission] = useCameraPermissions();
  const [diningHallStatus, setDiningHallStatus] = useState<DiningHallStatus>('inactive');
  const [analyzing, setAnalyzing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('photo');
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const lastScanAt = useRef<number>(0);

  const isDiningHallMode = diningHallStatus === 'active';

  const DAILY_GOAL_CAL = 2500;

  const todayTotals = useMemo(() => {
    const today = new Date().toDateString();
    return mealLog
      .filter(m => new Date(m.timestamp).toDateString() === today)
      .reduce(
        (acc, meal) => ({
          cal:     Math.round(acc.cal     + meal.totals.cal),
          protein: Math.round((acc.protein + meal.totals.protein) * 10) / 10,
          carbs:   Math.round((acc.carbs   + meal.totals.carbs)   * 10) / 10,
          fat:     Math.round((acc.fat     + meal.totals.fat)     * 10) / 10,
        }),
        { cal: 0, protein: 0, carbs: 0, fat: 0 }
      );
  }, [mealLog]);

  const calProgress = Math.min(todayTotals.cal / DAILY_GOAL_CAL, 1);
  const calOver = todayTotals.cal > DAILY_GOAL_CAL;

  function formatCal(n: number): string {
    return n >= 1000
      ? `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}`
      : String(n);
  }

  useEffect(() => {
    detectVenue().then(detected => {
      if (!detected || diningHallStatus !== 'inactive') return;

      if (detected.type === 'restaurant' && detected.menuItems?.length) {
        // Restaurant with a known menu — load directly without a dineoncampus fetch
        setVenue(detected);
        setMenuItems(detected.menuItems);
        setPeriodLabel('Menu');
        setDiningHallStatus('active');
      } else if (detected.type === 'dining_hall') {
        enableDiningHallModeForVenue(detected);
      }
      // Restaurant with no menu → stay in generic mode (no banner)
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

  async function handleBarcodeScan({ data }: { data: string }) {
    const now = Date.now();
    if (now - lastScanAt.current < 3000 || barcodeScanning) return;
    lastScanAt.current = now;
    setBarcodeScanning(true);
    setBarcodeError(null);
    try {
      const res = await fetch(`${SERVER_URL}/barcode?code=${encodeURIComponent(data)}`);
      if (res.status === 404) {
        setBarcodeError('Product not found — try scanning again');
        setBarcodeScanning(false);
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const product = await res.json();
      const analysisResult = {
        detectedItems: [{
          name: product.name,
          portionMultiplier: (product.estimatedQuantityGrams || 100) / 100,
          confidence: 1.0,
          estimatedQuantityGrams: product.estimatedQuantityGrams || 100,
          calories: product.calories,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
        }],
        mode: 'generic' as const,
      };
      navigation.navigate('Estimate', { analysisResult, source: 'barcode' });
    } catch {
      setBarcodeError('Lookup failed — try again');
    } finally {
      setBarcodeScanning(false);
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
          DiningLens needs camera access to photograph your meal and scan barcodes.
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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanMode === 'barcode' ? handleBarcodeScan : undefined}
        barcodeScannerSettings={scanMode === 'barcode' ? {
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
        } : undefined}
      >

        {/* Active venue banner — slim top bar with teal background */}
        {diningHallStatus === 'active' && venue && (
          <SafeAreaView style={styles.venueBanner}>
            <View style={styles.venueBannerContent}>
              <Text style={styles.venueBannerText} numberOfLines={1}>
                {'📍 '}
                <Text style={styles.venueBannerName}>{venue.name}</Text>
                {venue.type === 'restaurant' ? ' — Restaurant menu loaded' : ` — ${periodLabel} menu loaded`}
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

        {/* Barcode mode overlay */}
        {scanMode === 'barcode' && (
          <View style={styles.barcodeOverlay} pointerEvents="none">
            <View style={styles.barcodeFrame} />
            <Text style={styles.barcodeScanText}>
              {barcodeScanning ? 'Looking up product…' : 'Point camera at barcode'}
            </Text>
            {barcodeError && <Text style={styles.barcodeErrorText}>{barcodeError}</Text>}
            {barcodeScanning && <ActivityIndicator color="#00E5A0" style={{ marginTop: 8 }} />}
          </View>
        )}

        {/* Torch toggle — top-right */}
        <TouchableOpacity
          style={[styles.torchButton, torch && styles.torchButtonOn]}
          onPress={() => setTorch(t => !t)}
        >
          <Text style={styles.torchButtonText}>🔦</Text>
        </TouchableOpacity>

        {/* Barcode toggle — top-right, below torch */}
        <TouchableOpacity
          style={[styles.barcodeButton, scanMode === 'barcode' && styles.barcodeButtonOn]}
          onPress={() => {
            setScanMode(m => m === 'barcode' ? 'photo' : 'barcode');
            setBarcodeError(null);
            lastScanAt.current = 0;
          }}
        >
          <Text style={styles.barcodeButtonText}>📦</Text>
        </TouchableOpacity>

        {/* Shutter — centered, 80px from bottom (hidden in barcode mode) */}
        {scanMode === 'photo' && (
          <View style={styles.shutterContainer} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.shutter, analyzing && styles.shutterDisabled]}
              onPress={handleShutter}
              disabled={analyzing}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </View>
        )}

        {/* Search button — bottom-left, above venue chip */}
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>

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

        {/* Daily macro summary bar */}
        <TouchableOpacity
          style={styles.summaryBar}
          onPress={() => navigation.navigate('History')}
          activeOpacity={0.8}
        >
          {todayTotals.cal === 0 ? (
            <Text style={styles.summaryEmpty}>0 cal  ·  Start logging</Text>
          ) : (
            <View style={styles.summaryMacros}>
              <Text style={styles.summaryChip}>{formatCal(todayTotals.cal)} cal</Text>
              <Text style={styles.summarySep}>·</Text>
              <Text style={styles.summaryChip}>{todayTotals.protein}g P</Text>
              <Text style={styles.summarySep}>·</Text>
              <Text style={styles.summaryChip}>{todayTotals.carbs}g C</Text>
              <Text style={styles.summarySep}>·</Text>
              <Text style={styles.summaryChip}>{todayTotals.fat}g F</Text>
            </View>
          )}
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: `${calProgress * 100}%` as any },
              calOver && styles.progressFillOver,
            ]} />
          </View>
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

  // Shutter — full-width container at bottom: 90 so button self-centers (bumped 10px for summary bar)
  shutterContainer: {
    position: 'absolute',
    bottom: 90,
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

  // Search button — bottom-left, above venue chip
  searchButton: {
    position: 'absolute',
    left: 20,
    bottom: 165,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: { fontSize: 22 },

  // Inactive venue chip — bottom-left
  venueChip: {
    position: 'absolute',
    left: 20,
    bottom: 110,
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
    bottom: 110,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButtonText: { fontSize: 22 },

  // Daily macro summary bar — bottom of screen, above shutter
  summaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  summaryMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  summaryChip: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summarySep: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  summaryEmpty: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#00E5A0',
    borderRadius: 2,
  },
  progressFillOver: {
    backgroundColor: '#FF9500',
  },

  // Torch button — top-right
  torchButton: {
    position: 'absolute',
    right: 20,
    top: 60,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchButtonOn: { backgroundColor: 'rgba(255,255,255,0.9)' },
  torchButtonText: { fontSize: 22 },

  // Barcode toggle button — top-right, below torch
  barcodeButton: {
    position: 'absolute',
    right: 20,
    top: 116,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeButtonOn: { backgroundColor: '#00E5A0' },
  barcodeButtonText: { fontSize: 22 },

  // Barcode scanning overlay
  barcodeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeFrame: {
    width: 260,
    height: 170,
    borderWidth: 2,
    borderColor: '#00E5A0',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  barcodeScanText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 18,
    textAlign: 'center',
  },
  barcodeErrorText: {
    color: '#FF9500',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

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
