import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { useJournalStore } from '@/store/journalStore';
import { signOut } from '@/services/authService';
import { useTheme } from '@/theme/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatDate } from '@/utils/dateUtils';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Main'>;
type ThemeMode = 'light' | 'dark' | 'system';

export const ProfileScreen: React.FC = () => {
  const { theme, mode, setMode, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const { isOnline, lastSyncAt, pendingCount } = useSyncStore();
  const { entries } = useJournalStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.replace('Auth');
        },
      },
    ]);
  };

  const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
    { label: '☀️ Light', value: 'light' },
    { label: '🌙 Dark', value: 'dark' },
    { label: '📱 System', value: 'system' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Profile</Text>

        {/* Avatar + user info */}
        <Card style={styles.profileCard}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarInitial}>
                {user?.name?.[0]?.toUpperCase() ?? 'T'}
              </Text>
            </View>
          )}
          <Text style={[styles.userName, { color: theme.colors.text }]}>{user?.name}</Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.providerBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Text style={[styles.providerText, { color: theme.colors.primary }]}>
              via {user?.provider}
            </Text>
          </View>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Stats</Text>
          <View style={styles.statsRow}>
            <StatItem label="Entries" value={String(entries.length)} theme={theme} />
            <StatItem label="Photos" value={String(entries.reduce((a, e) => a + e.photos.length, 0))} theme={theme} />
            <StatItem label="Pending sync" value={String(pendingCount)} theme={theme} />
          </View>
          <View style={[styles.syncRow, { borderTopColor: theme.colors.border }]}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#22C55E' : '#F59E0B' }]} />
            <Text style={[styles.syncText, { color: theme.colors.textSecondary }]}>
              {isOnline ? 'Online' : 'Offline'}
              {lastSyncAt ? ` · Last sync: ${formatDate(lastSyncAt, 'MMM d h:mm a')}` : ''}
            </Text>
          </View>
        </Card>

        {/* Appearance */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Appearance</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setMode(opt.value)}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor:
                      mode === opt.value ? theme.colors.primary : theme.colors.inputBackground,
                  },
                ]}>
                <Text
                  style={[
                    styles.themeBtnText,
                    { color: mode === opt.value ? '#fff' : theme.colors.text },
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Sign out */}
        <Button
          label="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          fullWidth
          style={styles.signOutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const StatItem: React.FC<{ label: string; value: string; theme: any }> = ({ label, value, theme }) => (
  <View style={styles.statItem}>
    <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[12] },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.extraBold,
    marginBottom: spacing[5],
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: spacing[4],
    paddingVertical: spacing[6],
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing[3] },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  avatarInitial: { fontSize: 36, color: '#fff', fontWeight: 'bold' },
  userName: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, marginBottom: spacing[1] },
  userEmail: { fontSize: typography.sizes.sm, marginBottom: spacing[2] },
  providerBadge: { paddingHorizontal: spacing[3], paddingVertical: 3, borderRadius: radius.full },
  providerText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semiBold },
  statsCard: { marginBottom: spacing[4] },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing[3] },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: typography.sizes['2xl'], fontWeight: typography.weights.bold },
  statLabel: { fontSize: typography.sizes.xs, marginTop: 2 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[3],
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing[2] },
  syncText: { fontSize: typography.sizes.sm },
  section: { marginBottom: spacing[4] },
  themeRow: { flexDirection: 'row', gap: spacing[2] },
  themeBtn: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, alignItems: 'center' },
  themeBtnText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  signOutBtn: { marginTop: spacing[4] },
});
