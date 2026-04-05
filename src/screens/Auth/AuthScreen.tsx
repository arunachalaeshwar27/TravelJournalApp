import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeContext';
import { signInWithGoogle } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Auth'>;

export const AuthScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { isLoading, error } = useAuthStore();

  // Floating globe animation
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const globeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Sign-In Error', String(e));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.colors.statusBar}
        backgroundColor={theme.colors.background}
      />

      {/* Hero */}
      <View style={styles.hero}>
        <Animated.Text style={[styles.globe, globeStyle]}>🌍</Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(300).springify()}
          style={[styles.appName, { color: theme.colors.text }]}>
          Travel Journal
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(450).springify()}
          style={[styles.tagline, { color: theme.colors.textSecondary }]}>
          Capture every adventure.{'\n'}Remember every moment.
        </Animated.Text>
      </View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.cta}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Button
          label="Continue with Google"
          onPress={handleGoogleSignIn}
          isLoading={isLoading}
          fullWidth
          size="lg"
          style={styles.googleBtn}
          leftIcon={<Text style={styles.googleIcon}>G</Text>}
        />

        <Text style={[styles.terms, { color: theme.colors.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globe: {
    fontSize: 80,
    marginBottom: spacing[6],
  },
  appName: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.extraBold,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  tagline: {
    fontSize: typography.sizes.lg,
    textAlign: 'center',
    lineHeight: 28,
  },
  cta: {
    paddingBottom: spacing[8],
  },
  googleBtn: {
    marginBottom: spacing[4],
    borderRadius: 14,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 4,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: spacing[3],
    fontSize: typography.sizes.sm,
  },
  terms: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
});
