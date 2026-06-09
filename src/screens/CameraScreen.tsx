import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KNOWN_VENUES, detectVenueFull, Venue } from '../services/venueService';
import { fetchVenueMenu } from '../services/menuService';
import { CHAIN_MENUS, getChainMenuItems } from '../data/chainMenus';
import { analyzeImage } from '../services/visionService';
import { useMealContext } from '../context/MealContext';
import { API_BASE_URL } from '../config/api';
import { useEntitlement } from '../hooks/useEntitlement';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

type DiningHallStatus = 'inactive' | 'loading' | 'active';
type ScanMode = 'photo' | 'barcode';
type EatingOutMode = 'options' | 'search';

type VenueSearchResult = {
  id: string;
  name: string;
  subtitle?: string;
  type: 'dining_hall' | 'restaurant';
  venueRef?: Venue;
  chainName?: string;
};

export default function CameraScreen({ navigation, route }: Props) {
  const { setMenuItems, setPeriodLabel, setVenue, venue, periodLabel, menuItems, mealLog, goals } =
    useMealContext();
  const { entitlement } = useEntitlement();

  const [permission, requestPermission] = useCameraPermissions();
  const [diningHallStatus, setDiningHallStatus] = useState<DiningHallStatus>('inactive');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState('Analyzing meal...');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(
    route.params?.initialMode === 'barcode' ? 'barcode' : 'photo'
  );
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [barcodeNotFoundCode, setBarcodeNotFoundCode] = useState<string | null>(null);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showEatingOutModal, setShowEatingOutModal] = useState(false);
  const [eatingOutMode, setEatingOutMode] = useState<EatingOutMode>('options');
  const [venueSearch, setVenueSearch] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [venueDistanceKm, setVenueDistanceKm] = useState<number | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const lastScanAt = useRef<number>(0);

  const isDiningHallMode = diningHallStatus === 'active';

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

  const streak = useMemo(() => {
    const loggedDates = new Set(
      mealLog.map(m => new Date(m.timestamp).toDateString())
    );
    const d = new Date();
    // If today has no log, start counting from yesterday
    if (!loggedDates.has(d.toDateString())) {
      d.setDate(d.getDate() - 1);
    }
    let count = 0;
    while (loggedDates.has(d.toDateString())) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [mealLog]);

  const calProgress = Math.min(todayTotals.cal / goals.calories, 1);
  const calOver = todayTotals.cal > goals.calories;

  const venueSearchResults = useMemo((): VenueSearchResult[] => {
    const q = venueSearch.trim().toLowerCase();
    const results: VenueSearchResult[] = [];

    KNOWN_VENUES.forEach(v => {
      if (!q || v.name.toLowerCase().includes(q) || v.institution.toLowerCase().includes(q)) {
        results.push({ id: `venue-${v.id}`, name: v.name, subtitle: v.institution, type: 'dining_hall', venueRef: v });
      }
    });

    Object.keys(CHAIN_MENUS).forEach(chain => {
      if (!q || chain.toLowerCase().includes(q)) {
        results.push({
          id: `chain-${chain}`, name: chain,
          subtitle: `${CHAIN_MENUS[chain].length} items`,
          type: 'restaurant', chainName: chain,
        });
      }
    });

    return results.slice(0, 30);
  }, [venueSearch]);

  function formatCal(n: number): string {
    return n >= 1000
      ? `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}`
      : String(n);
  }

  // Auto-enable dining hall mode when launched from Add sheet with 'dining' action
  // Auto-launch gallery picker when opened in gallery mode
  useEffect(() => {
    if (route.params?.initialMode === 'dining') {
      enableDiningHallModeForVenue();
    } else if (route.params?.initialMode === 'gallery') {
      handleGalleryPick();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (route.params?.initialMode === 'dining') return; // handled above
    detectVenueFull().then(({ venue: detected, distanceKm }) => {
      if (!detected || diningHallStatus !== 'inactive') return;
      setVenueDistanceKm(isFinite(distanceKm) ? distanceKm : null);

      if (detected.type === 'restaurant' && detected.menuItems?.length) {
        setVenue(detected);
        setMenuItems(detected.menuItems);
        setPeriodLabel('Menu');
        setDiningHallStatus('active');
      } else if (detected.type === 'dining_hall') {
        enableDiningHallModeForVenue(detected);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableDiningHallModeForVenue(venueToLoad = KNOWN_VENUES[0]) {
    setDiningHallStatus('loading');
    try {
      const date = new Date().toISOString().split('T')[0];
      const { items, periodLabel: label } = await fetchVenueMenu(venueToLoad, date);
      setVenue(venueToLoad);
      setMenuItems(items);
      setPeriodLabel(label);
      setDiningHallStatus('active');
    } catch {
      setDiningHallStatus('inactive');
      setErrorBanner("Couldn't load menu — using generic mode");
    }
  }

  function disableDiningHallMode() {
    setDiningHallStatus('inactive');
    setVenue(null);
  }

  function showTrialExpiredAlert() {
    Alert.alert(
      'Free trial ended',
      'Your free trial has ended. Upgrade to keep tracking your nutrition.',
      [{ text: 'OK' }]
    );
  }

  async function handleShutter() {
    if (!cameraRef.current || analyzing) return;
    if (entitlement && !entitlement.canUseApp) { showTrialExpiredAlert(); return; }
    setAnalyzing(true);
    setAnalyzingLabel('Analyzing meal...');
    const wakingTimer = setTimeout(
      () => setAnalyzingLabel('Starting analysis server…\nThis may take up to 30 seconds.'),
      6_000
    );
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

      clearTimeout(wakingTimer);
      navigation.navigate('Estimate', { analysisResult: result, imageBase64 });
    } catch (err) {
      clearTimeout(wakingTimer);
      console.error('Shutter error:', err);
      navigation.navigate('Estimate', { analysisResult: undefined, imageBase64, analysisError: true });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleBarcodeScan({ data }: { data: string }) {
    const now = Date.now();
    if (now - lastScanAt.current < 3000 || barcodeScanning) return;
    if (entitlement && !entitlement.canUseApp) { showTrialExpiredAlert(); return; }
    lastScanAt.current = now;
    setBarcodeScanning(true);
    setBarcodeError(null);
    setBarcodeNotFoundCode(null);
    try {
      const res = await fetch(`${API_BASE_URL}/barcode?code=${encodeURIComponent(data)}`);
      if (res.status === 404) {
        setBarcodeError('Product not found — try searching manually');
        setBarcodeNotFoundCode(data);
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

  async function handleGalleryPick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorBanner('Photo library access denied — enable in Settings');
      if (route.params?.initialMode === 'gallery') navigation.goBack();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      base64: true,
      quality: 0.5,
    });
    if (result.canceled) {
      if (route.params?.initialMode === 'gallery') navigation.goBack();
      return;
    }
    const base64 = result.assets?.[0]?.base64;
    if (!base64) {
      setErrorBanner('Could not load photo');
      if (route.params?.initialMode === 'gallery') navigation.goBack();
      return;
    }
    setAnalyzing(true);
    setAnalyzingLabel('Analyzing meal...');
    const galleryWakingTimer = setTimeout(
      () => setAnalyzingLabel('Starting analysis server…\nThis may take up to 30 seconds.'),
      6_000
    );
    setErrorBanner(null);
    try {
      const analysisResult = await analyzeImage(base64, isDiningHallMode ? menuItems : undefined);
      clearTimeout(galleryWakingTimer);
      navigation.navigate('Estimate', { analysisResult, imageBase64: base64 });
    } catch {
      clearTimeout(galleryWakingTimer);
      navigation.navigate('Estimate', { analysisResult: undefined, imageBase64: base64, analysisError: true });
    } finally {
      setAnalyzing(false);
    }
  }

  function closeEatingOutModal() {
    setShowEatingOutModal(false);
    setEatingOutMode('options');
    setVenueSearch('');
  }

  async function handleUseLocation() {
    setDetectingLocation(true);
    try {
      const { venue: detected, distanceKm, permissionDenied } = await detectVenueFull();
      closeEatingOutModal();
      if (permissionDenied) {
        const key = 'locationDeniedShown';
        const already = await AsyncStorage.getItem(key).catch(() => null);
        if (!already) {
          await AsyncStorage.setItem(key, '1').catch(() => {});
          setErrorBanner('Location access helps auto-detect nearby dining halls and restaurants');
        }
        return;
      }
      if (!detected) { setErrorBanner('No venue found nearby'); return; }
      setVenueDistanceKm(isFinite(distanceKm) ? distanceKm : null);
      if (detected.type === 'restaurant' && detected.menuItems?.length) {
        setVenue(detected);
        setMenuItems(detected.menuItems);
        setPeriodLabel('Menu');
        setDiningHallStatus('active');
      } else if (detected.type === 'dining_hall') {
        enableDiningHallModeForVenue(detected);
      }
    } catch {
      setErrorBanner('Location detection failed');
    } finally {
      setDetectingLocation(false);
    }
  }

  async function handleSelectVenue(result: VenueSearchResult) {
    closeEatingOutModal();
    setVenueDistanceKm(null);
    if (result.type === 'dining_hall' && result.venueRef) {
      enableDiningHallModeForVenue(result.venueRef);
    } else if (result.chainName) {
      const items = getChainMenuItems(result.chainName);
      const syntheticVenue: Venue = {
        id: result.chainName,
        name: result.name,
        institution: result.name,
        type: 'restaurant',
        locationId: result.chainName,
        provider: 'generic',
        coords: { lat: 0, lon: 0 },
        menuItems: items,
      };
      setVenue(syntheticVenue);
      setMenuItems(items);
      setPeriodLabel('Menu');
      setDiningHallStatus('active');
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

        {/* Active venue — small ambient pill at top */}
        {diningHallStatus === 'active' && venue && (
          <View style={styles.venuePillContainer} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.venuePill}
              onPress={disableDiningHallMode}
              activeOpacity={0.75}
            >
              <Text style={styles.venuePillText}>
                📍 {venue.name}{venueDistanceKm != null
                  ? ` · ${venueDistanceKm < 0.1 ? `${Math.round(venueDistanceKm * 1000)}m` : `${venueDistanceKm.toFixed(1)} km`}`
                  : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading venue — small spinner pill */}
        {diningHallStatus === 'loading' && (
          <View style={styles.venuePillContainer} pointerEvents="none">
            <View style={styles.venuePill}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          </View>
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
            <Text style={[styles.analyzingText, { textAlign: 'center' }]}>{analyzingLabel}</Text>
          </View>
        )}

        {/* Barcode mode overlay — box-none so recovery buttons receive touches */}
        {scanMode === 'barcode' && (
          <View style={styles.barcodeOverlay} pointerEvents="box-none">
            <View style={styles.barcodeFrame} pointerEvents="none" />
            <Text style={styles.barcodeScanText} pointerEvents="none">
              {barcodeScanning ? 'Looking up product…' : 'Point camera at barcode'}
            </Text>
            {barcodeScanning && <ActivityIndicator color="#00E5A0" style={{ marginTop: 8 }} />}
          </View>
        )}

        {/* Barcode not-found recovery card — rendered outside the pointer-blocking overlay */}
        {scanMode === 'barcode' && barcodeError && (
          <View style={styles.barcodeRecoveryWrap}>
            <View style={styles.barcodeRecoveryCard}>
              <Text style={styles.barcodeRecoveryTitle}>Product not found</Text>
              <Text style={styles.barcodeRecoveryDesc}>
                {barcodeNotFoundCode
                  ? 'This barcode isn\'t in the database yet. Type the product name to search.'
                  : 'Lookup failed — try again or use one of the options below.'}
              </Text>

              <TouchableOpacity
                style={styles.barcodeRecoveryBtn}
                onPress={() => {
                  setBarcodeNotFoundCode(null);
                  setBarcodeError(null);
                  navigation.navigate('Search', { query: '' });
                }}
              >
                <Text style={styles.barcodeRecoveryBtnText}>🔍  Search by product name</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.barcodeRecoveryBtn}
                onPress={() => {
                  setBarcodeNotFoundCode(null);
                  setBarcodeError(null);
                  navigation.navigate('Estimate', {
                    analysisResult: undefined,
                    imageBase64: undefined,
                  });
                }}
              >
                <Text style={styles.barcodeRecoveryBtnText}>✏️  Enter nutrition manually</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.barcodeRecoveryBtn, styles.barcodeRecoveryBtnSecondary]}
                onPress={() => {
                  setBarcodeNotFoundCode(null);
                  setBarcodeError(null);
                  lastScanAt.current = 0;
                }}
              >
                <Text style={styles.barcodeRecoveryBtnTextSecondary}>↩  Try scanning again</Text>
              </TouchableOpacity>
            </View>
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

        {/* Gallery picker — bottom-left, at shutter level */}
        {scanMode === 'photo' && (
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={handleGalleryPick}
            disabled={analyzing}
          >
            <Text style={styles.galleryButtonText}>🖼</Text>
          </TouchableOpacity>
        )}

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

        {/* Eating out? chip — bottom-left, when no venue detected or loading */}
        {(diningHallStatus === 'inactive' || diningHallStatus === 'loading') && (
          <TouchableOpacity
            style={styles.eatingOutChip}
            onPress={() => diningHallStatus === 'inactive' && setShowEatingOutModal(true)}
            disabled={diningHallStatus === 'loading'}
          >
            {diningHallStatus === 'loading' ? (
              <View style={styles.eatingOutLoadingRow}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
                <Text style={styles.eatingOutChipText}>Loading menu...</Text>
              </View>
            ) : (
              <Text style={styles.eatingOutChipText}>🍽 Eating out?</Text>
            )}
          </TouchableOpacity>
        )}

        {/* History button — bottom-right */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.historyButtonText}>📋</Text>
        </TouchableOpacity>

        {/* Daily summary bar — tap to open Goals */}
        <TouchableOpacity
          style={styles.summaryBar}
          onPress={() => navigation.navigate('Goals')}
          activeOpacity={0.8}
        >
          <Text style={styles.summaryGearIcon}>⚙️</Text>
          {todayTotals.cal === 0 ? (
            <Text style={styles.summaryEmpty}>Start logging · tap to set goal</Text>
          ) : (
            <>
              <View style={styles.summaryCalRow}>
                <Text style={styles.summaryCalLine}>
                  {formatCal(todayTotals.cal)} cal today
                </Text>
                {streak >= 2 && (
                  <TouchableOpacity
                    style={styles.streakBadge}
                    onPress={e => { e.stopPropagation?.(); setShowStreakModal(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.streakText}>🔥 {streak}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.summaryMacros}>
                <Text style={styles.summarySep}>{todayTotals.protein}g protein</Text>
                <Text style={styles.summarySep}>·</Text>
                <Text style={styles.summarySep}>{todayTotals.carbs}g carbs</Text>
                <Text style={styles.summarySep}>·</Text>
                <Text style={styles.summarySep}>{todayTotals.fat}g fat</Text>
              </View>
            </>
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

      {/* Eating out? modal */}
      <Modal
        visible={showEatingOutModal}
        transparent
        animationType="slide"
        onRequestClose={closeEatingOutModal}
      >
        <TouchableOpacity style={styles.eoBackdrop} activeOpacity={1} onPress={closeEatingOutModal} />
        <View style={styles.eoSheet}>
          <View style={styles.eoHandle} />
          <Text style={styles.eoTitle}>Where are you eating?</Text>

          {eatingOutMode === 'options' ? (
            <>
              <TouchableOpacity style={styles.eoOption} onPress={handleUseLocation} disabled={detectingLocation}>
                <Text style={styles.eoOptionIcon}>📍</Text>
                <View style={styles.eoOptionText}>
                  <Text style={styles.eoOptionTitle}>Use my location</Text>
                  <Text style={styles.eoOptionSub}>Auto-detect nearby venue or restaurant</Text>
                </View>
                {detectingLocation && <ActivityIndicator color="#00E5A0" size="small" />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.eoOption} onPress={() => setEatingOutMode('search')}>
                <Text style={styles.eoOptionIcon}>🔍</Text>
                <View style={styles.eoOptionText}>
                  <Text style={styles.eoOptionTitle}>Search a place</Text>
                  <Text style={styles.eoOptionSub}>Type a dining hall or restaurant name</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.eoSearchInput}
                placeholder="Search dining halls & restaurants…"
                placeholderTextColor="#555"
                value={venueSearch}
                onChangeText={setVenueSearch}
                autoFocus
              />
              <FlatList
                data={venueSearchResults}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.eoResultList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.eoResult} onPress={() => handleSelectVenue(item)}>
                    <Text style={styles.eoResultIcon}>{item.type === 'dining_hall' ? '🍽' : '🍔'}</Text>
                    <View style={styles.eoResultText}>
                      <Text style={styles.eoResultName}>{item.name}</Text>
                      {item.subtitle ? <Text style={styles.eoResultSub}>{item.subtitle}</Text> : null}
                      <Text style={styles.eoResultSourceTag}>
                        {item.type === 'dining_hall' ? 'Official campus dining menu' : 'Chain database — estimated calories'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          <TouchableOpacity style={styles.eoCancel} onPress={closeEatingOutModal}>
            <Text style={styles.eoCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Streak modal */}
      <Modal
        visible={showStreakModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStreakModal(false)}
      >
        <TouchableOpacity
          style={styles.streakModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowStreakModal(false)}
        >
          <View style={styles.streakModalBox}>
            <Text style={styles.streakModalEmoji}>🔥</Text>
            <Text style={styles.streakModalTitle}>
              You've logged {streak} days in a row!
            </Text>
            <TouchableOpacity
              style={styles.streakModalBtn}
              onPress={() => setShowStreakModal(false)}
            >
              <Text style={styles.streakModalBtnText}>Nice!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' },

  // Venue pill — small ambient badge at the top
  venuePillContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  venuePill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.4)',
  },
  venuePillText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },

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

  // Gallery picker button — bottom-left at shutter level
  galleryButton: {
    position: 'absolute',
    left: 20,
    bottom: 90,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButtonText: { fontSize: 24 },

  // Search button — bottom-left, above eating-out chip
  searchButton: {
    position: 'absolute',
    left: 20,
    bottom: 205,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: { fontSize: 22 },

  // Eating out? chip — bottom-left
  eatingOutChip: {
    position: 'absolute',
    left: 16,
    bottom: 155,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  eatingOutChipText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  eatingOutLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Eating out modal
  eoBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  eoSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingHorizontal: 20,
    borderTopWidth: 1, borderColor: '#2A2A2A',
    maxHeight: '75%',
  },
  eoHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#3A3A3A', alignSelf: 'center', marginTop: 12, marginBottom: 18,
  },
  eoTitle: {
    fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16,
  },
  eoOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  eoOptionIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  eoOptionText: { flex: 1 },
  eoOptionTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  eoOptionSub: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  eoSearchInput: {
    backgroundColor: '#0F0F0F', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#FFFFFF',
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 10,
  },
  eoResultList: { flexGrow: 0, maxHeight: 300 },
  eoResult: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  eoResultIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  eoResultText: { flex: 1 },
  eoResultName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  eoResultSub: { fontSize: 12, color: '#8A8A8A', marginTop: 1 },
  eoResultSourceTag: { fontSize: 10, color: '#555', marginTop: 2, fontStyle: 'italic' },
  eoCancel: { paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  eoCancelText: { fontSize: 15, color: '#8A8A8A', fontWeight: '600' },

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

  // Daily summary bar — bottom of screen
  summaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
  },
  summaryGearIcon: {
    position: 'absolute',
    right: 14,
    top: 8,
    fontSize: 14,
    opacity: 0.55,
  },
  summaryCalLine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  summaryMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summarySep: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
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
  barcodeErrorWrap: { alignItems: 'center', marginTop: 10, gap: 10 },
  barcodeErrorText: {
    color: '#FF9500',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  barcodeSearchBtn: {
    backgroundColor: '#00E5A0',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  barcodeSearchBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 14 },

  // Barcode recovery card
  barcodeRecoveryWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 140,
    alignItems: 'center', paddingHorizontal: 24,
  },
  barcodeRecoveryCard: {
    backgroundColor: 'rgba(15,15,15,0.96)',
    borderRadius: 18, padding: 20, width: '100%',
    borderWidth: 1, borderColor: '#3A3A3A',
    gap: 10,
  },
  barcodeRecoveryTitle: {
    fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 4,
  },
  barcodeRecoveryDesc: {
    fontSize: 13, color: '#8A8A8A', lineHeight: 18, marginBottom: 4,
  },
  barcodeRecoveryBtn: {
    backgroundColor: '#00E5A0', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center',
  },
  barcodeRecoveryBtnSecondary: {
    backgroundColor: '#2A2A2A',
  },
  barcodeRecoveryBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 14 },
  barcodeRecoveryBtnTextSecondary: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

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

  // Summary bar cal row (with optional streak badge)
  summaryCalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 6,
  },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3,
  },
  streakText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Streak modal
  streakModalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  streakModalBox: {
    backgroundColor: '#1A1A1A', borderRadius: 20, padding: 32,
    alignItems: 'center', width: 280,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  streakModalEmoji: { fontSize: 48, marginBottom: 12 },
  streakModalTitle: {
    fontSize: 17, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 24, lineHeight: 24,
  },
  streakModalBtn: {
    backgroundColor: '#00E5A0', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  streakModalBtnText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});
