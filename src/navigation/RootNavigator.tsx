/**
 * Root Navigator
 *
 * Stack structure:
 *   RootStack
 *     ├── Splash (checks auth & bootstraps DB)
 *     ├── Auth  (Google Sign-In)
 *     └── Main  (Bottom Tabs)
 *           ├── Journal Tab → JournalStack
 *           │     ├── JournalList
 *           │     ├── JournalDetail
 *           │     ├── JournalEditor
 *           │     └── PhotoViewer
 *           ├── Search Tab → SearchScreen
 *           └── Profile Tab → ProfileScreen
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import { RootStackParamList, MainTabParamList, JournalStackParamList } from '@/types';
import { AuthScreen } from '@/screens/Auth/AuthScreen';
import { JournalListScreen } from '@/screens/Journal/JournalListScreen';
import { JournalDetailScreen } from '@/screens/Journal/JournalDetailScreen';
import { JournalEditorScreen } from '@/screens/Journal/JournalEditorScreen';
import { SearchScreen } from '@/screens/Search/SearchScreen';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/ThemeContext';
import { restoreSession } from '@/services/authService';
import { getDatabase } from '@/database/db';
import { startSyncEngine } from '@/services/syncService';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const JournalStack = createNativeStackNavigator<JournalStackParamList>();

// ─── Journal Stack ────────────────────────────────────────────────────────────

const JournalNavigator: React.FC = () => (
  <JournalStack.Navigator screenOptions={{ headerShown: false }}>
    <JournalStack.Screen name="JournalList" component={JournalListScreen} />
    <JournalStack.Screen
      name="JournalDetail"
      component={JournalDetailScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <JournalStack.Screen
      name="JournalEditor"
      component={JournalEditorScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
    <JournalStack.Screen
      name="PhotoViewer"
      component={PhotoViewerPlaceholder}
      options={{ animation: 'fade' }}
    />
  </JournalStack.Navigator>
);

// Placeholder — full implementation with zoom/pan in production
const PhotoViewerPlaceholder: React.FC = () => {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff' }}>Photo Viewer</Text>
    </View>
  );
};

// ─── Bottom Tabs ──────────────────────────────────────────────────────────────

const TAB_ICON: Record<string, string> = {
  JournalList: '📓',
  Search: '🔍',
  Profile: '👤',
};

const MainTabs: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
            {TAB_ICON[route.name]}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
      })}>
      <Tab.Screen name="JournalList" component={JournalNavigator} options={{ title: 'Journal' }} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// ─── Splash / Bootstrap ───────────────────────────────────────────────────────

const SplashScreen: React.FC<{ onReady: (isAuth: boolean) => void }> = ({ onReady }) => {
  const { theme } = useTheme();

  useEffect(() => {
    (async () => {
      // 1. Init SQLite
      await getDatabase();
      // 2. Restore session from Keychain
      const isAuth = await restoreSession();
      // 3. Start background sync engine
      startSyncEngine();
      onReady(isAuth);
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 64 }}>🌍</Text>
      <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
    </View>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export const RootNavigator: React.FC = () => {
  const { theme } = useTheme();
  const [initialRoute, setInitialRoute] = useState<'Auth' | 'Main' | null>(null);

  const navigationTheme = {
    dark: theme.dark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  if (!initialRoute) {
    return <SplashScreen onReady={isAuth => setInitialRoute(isAuth ? 'Main' : 'Auth')} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Root.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}>
        <Root.Screen name="Auth" component={AuthScreen} />
        <Root.Screen name="Main" component={MainTabs} />
      </Root.Navigator>
    </NavigationContainer>
  );
};
