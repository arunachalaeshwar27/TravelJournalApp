import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn } from 'react-native-reanimated';
import { JournalStackParamList, JournalEntry } from '@/types';
import { useJournalStore } from '@/store/journalStore';
import { useAuthStore } from '@/store/authStore';
import { EntryCard } from '@/components/journal/EntryCard';
import { GlobalSyncIndicator } from '@/components/ui/SyncBadge';
import { useTheme } from '@/theme/ThemeContext';
import { runSyncCycle } from '@/services/syncService';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalList'>;

export const JournalListScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { filteredEntries, isLoading, isSyncing, loadEntries } = useJournalStore();
  const { user } = useAuthStore();

  useEffect(() => {
    console.log('DEBUG: JournalListScreen - storeId:', useAuthStore.getState().storeId, 'hasUser:', !!user);
    if (user) loadEntries(user.id);
  }, [user]);

  const handleRefresh = useCallback(async () => {
    await runSyncCycle();
    if (user) await loadEntries(user.id);
  }, [user]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<JournalEntry>) => (
      <EntryCard
        entry={item}
        index={index}
        onPress={() => navigation.navigate('JournalDetail', { entryId: item.id })}
      />
    ),
    [navigation],
  );

  const renderEmpty = () => (
    <Animated.View entering={FadeIn.delay(300)} style={styles.empty}>
      <Text style={styles.emptyIcon}>✈️</Text>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No entries yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        Tap + to record your first travel memory!
      </Text>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
            Hello, {user?.name?.split(' ')[0] ?? 'Traveler'} 👋
          </Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>My Journal</Text>
        </View>
        <View style={styles.headerRight}>
          <GlobalSyncIndicator />
          <TouchableOpacity
            onPress={() => navigation.navigate('JournalEditor', {})}
            style={[styles.fab, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filteredEntries}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  greeting: {
    fontSize: typography.sizes.sm,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.extraBold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 26,
  },
  listContent: {
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing[6],
  },
  emptyIcon: { fontSize: 60, marginBottom: spacing[4] },
  emptyTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
  },
});
