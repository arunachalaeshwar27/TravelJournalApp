/**
 * Travel Journal App — Root Component
 *
 * Wraps the entire app in:
 *  - GestureHandlerRootView (required by react-native-gesture-handler)
 *  - ThemeProvider (dark/light mode)
 *  - RootNavigator (all screens + navigation)
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/theme/ThemeContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { configureGoogleSignIn } from '@/services/authService';

// Configure Google Sign-In once at module level
configureGoogleSignIn();

const App: React.FC = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  </GestureHandlerRootView>
);

export default App;
