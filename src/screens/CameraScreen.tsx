import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { detectVenue } from '../services/venueService';
import { fetchMenu } from '../services/menuService';
import { useMealContext } from '../context/MealContext';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'> };

type VenueStatus = 'loading' | 'found' | 'none';

export default function CameraScreen({ navigation }: Props) {
  const { setMenuItems, setPeriodLabel, setVenue, venue, periodLabel } = useMealContext();
  const [venueStatus, setVenueStatus] = useState<VenueStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function loadVenueAndMenu() {
      setVenueStatus('loading');
      try {
        // Stub coords — Phase 3 will pass real GPS coords
        const detected = await detectVenue({ lat: 0, lon: 0 });

        if (cancelled) return;

        if (!detected) {
          setVenue(null);
          setVenueStatus('none');
          return;
        }

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

    loadVenueAndMenu();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={styles.container}>
      {/* Venue status banner */}
      <VenueBanner status={venueStatus} venueName={venue?.name} periodLabel={periodLabel} />

      {/* Camera placeholder */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Meal photo placeholder</Text>
      </View>

      {/* Analyze button */}
      <TouchableOpacity
        style={styles.analyzeButton}
        onPress={() => navigation.navigate('Estimate')}
      >
        <Text style={styles.analyzeButtonText}>Analyze Meal</Text>
      </TouchableOpacity>

      {/* Floating history button */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.historyButtonText}>📋</Text>
      </TouchableOpacity>
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
        <ActivityIndicator size="small" color="#888" style={{ marginRight: 8 }} />
        <Text style={styles.bannerTextMuted}>Detecting venue…</Text>
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
  // none — render nothing
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 36,
  },
  bannerFound: {
    backgroundColor: '#edf7ed',
  },
  bannerText: {
    fontSize: 13,
    color: '#333',
  },
  bannerVenue: {
    fontWeight: '700',
    color: '#2e7d32',
  },
  bannerTextMuted: {
    fontSize: 13,
    color: '#888',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#ccc',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  analyzeButton: {
    backgroundColor: '#500000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  historyButton: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#500000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  historyButtonText: {
    fontSize: 20,
  },
});
