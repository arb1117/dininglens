import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import type { RootStackParamList, TabParamList } from '../../App';
import ProfileScreen from '../screens/ProfileScreen';

// Lazy imports so the main navigator doesn't load heavy screens up front
const DashboardScreen = require('../screens/DashboardScreen').default;
const AIChatScreen    = require('../screens/AIChatScreen').default;

const Tab = createBottomTabNavigator<TabParamList>();

const ACTION_ITEMS: { icon: string; label: string; action: string }[] = [
  { icon: '📷', label: 'Scan Meal',     action: 'scan'    },
  { icon: '🖼',  label: 'Upload Photo',  action: 'upload'  },
  { icon: '🔍', label: 'Search Foods',  action: 'search'  },
  { icon: '🤖', label: 'Ask AI',        action: 'ai'      },
];

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.addBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={s.addBtnText}>+</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 22, opacity: color === '#00E5A0' ? 1 : 0.45 }}>{emoji}</Text>;
}

// Placeholder rendered when Add tab is technically "selected" (never visible)
function AddPlaceholder() { return null; }

export default function MainTabNavigator() {
  const rootNav = useNavigation<NavigationProp<RootStackParamList>>();
  const [sheetVisible, setSheetVisible] = useState(false);

  function handleAction(action: string) {
    setSheetVisible(false);
    setTimeout(() => {
      switch (action) {
        case 'scan':    rootNav.navigate('Camera'); break;
        case 'upload':  rootNav.navigate('Camera', { initialMode: 'gallery' }); break;
        case 'search':  rootNav.navigate('Search'); break;
        case 'barcode': rootNav.navigate('Camera', { initialMode: 'barcode' }); break;
        case 'dining':  rootNav.navigate('Camera', { initialMode: 'dining'  }); break;
        case 'ai':      rootNav.navigate('MainTabs', { screen: 'AICoach' }); break;
      }
    }, 150); // wait for sheet close animation
  }

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: s.tabBar,
          tabBarActiveTintColor: '#00E5A0',
          tabBarInactiveTintColor: '#8A8A8A',
          tabBarLabelStyle: s.tabLabel,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
          }}
        />
        <Tab.Screen
          name="Add"
          component={AddPlaceholder}
          options={{
            tabBarLabel: '',
            tabBarIcon: () => null,
            tabBarButton: () => (
              <AddButton onPress={() => setSheetVisible(true)} />
            ),
          }}
        />
        <Tab.Screen
          name="AICoach"
          component={AIChatScreen}
          options={{
            tabBarLabel: 'AI Coach',
            tabBarIcon: ({ color }) => <TabIcon emoji="🤖" color={color} />,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
          }}
        />
      </Tab.Navigator>

      {/* Add action sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Add</Text>
          {ACTION_ITEMS.map(item => (
            <TouchableOpacity
              key={item.action}
              style={s.actionRow}
              onPress={() => handleAction(item.action)}
              activeOpacity={0.75}
            >
              <Text style={s.actionIcon}>{item.icon}</Text>
              <Text style={s.actionLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.cancelBtn} onPress={() => setSheetVisible(false)}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1A1A1A',
    borderTopColor: '#2A2A2A',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  addBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00E5A0',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 8,
    shadowColor: '#00E5A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  addBtnText: { fontSize: 30, color: '#0F0F0F', lineHeight: 34, fontWeight: '300' },

  // Sheet
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingHorizontal: 24,
    borderTopWidth: 1, borderColor: '#2A2A2A',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#3A3A3A', alignSelf: 'center', marginTop: 12, marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 13, fontWeight: '700', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  actionIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  actionLabel: { fontSize: 17, color: '#FFFFFF', fontWeight: '500' },
  cancelBtn: { paddingVertical: 18, alignItems: 'center' },
  cancelText: { fontSize: 16, color: '#8A8A8A', fontWeight: '600' },
});
