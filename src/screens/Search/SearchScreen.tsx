import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JournalStackParamList, JournalEntry, SearchFilters } from '@/types';
import { useJournalStore } from '@/store/journalStore';
import { useAuthStore } from '@/store/authStore';
import { TextInput } from '@/components/ui/TextInput';
import { TagChip } from '@/components/ui/TagChip';
import { EntryCard } from '@/components/journal/EntryCard';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalList'>;

// Collect all unique tags across all entries
function collectAllTags(entries: JournalEntry[]): string[] {
  const set = new Set<string>();
  entries.forEach(e => e.tags.forEach(t => set.add(t)));
  return Array.from(set).sort();
}

export const SearchScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { entries, filteredEntries, applyFilters, clearFilters, isLoading } = useJournalStore();
  const { user } = useAuthStore();

  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const allTags = collectAllTags(entries);

  const handleSearch = useCallback(async () => {
    if (!user) return;
    const filters: SearchFilters = {};
    if (query.trim()) filters.query = query.trim();
    if (selectedTags.length) filters.tags = selectedTags;
    if (dateFrom && dateTo) {
      filters.dateRange = {
        start: new Date(dateFrom).toISOString(),
        end: new Date(dateTo).toISOString(),
      };
    }
    await applyFilters(filters, user.id);
    setHasSearched(true);
  }, [query, selectedTags, dateFrom, dateTo, user]);

  const handleClear = async () => {
    setQuery('');
    setSelectedTags([]);
    setDateFrom('');
    setDateTo('');
    setHasSearched(false);
    if (user) await clearFilters(user.id);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const renderEntry = useCallback(
    ({ item, index }: ListRenderItemInfo<JournalEntry>) => (
      <EntryCard
        entry={item}
        index={index}
        onPress={() => navigation.navigate('JournalDetail', { entryId: item.id })}
      />
    ),
    [navigation],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Search</Text>
      </View>

      {/* Search box */}
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title or description..."
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          containerStyle={styles.searchInput}
        />
      </View>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <View style={styles.tagSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Filter by tag
          </Text>
          <FlatList
            data={allTags}
            keyExtractor={t => t}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagList}
            renderItem={({ item }) => (
              <TagChip
                label={item}
                variant="filter"
                selected={selectedTags.includes(item)}
                onPress={() => toggleTag(item)}
              />
            )}
          />
        </View>
      )}

      {/* Date range filters */}
      <View style={styles.dateRow}>
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
          placeholder="From (YYYY-MM-DD)"
          containerStyle={styles.dateInput}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={[styles.dateSep, { color: theme.colors.textSecondary }]}>—</Text>
        <TextInput
          value={dateTo}
          onChangeText={setDateTo}
          placeholder="To (YYYY-MM-DD)"
          containerStyle={styles.dateInput}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Button
          label="Search"
          onPress={handleSearch}
          isLoading={isLoading}
          fullWidth
          style={styles.searchBtn}
        />
        {hasSearched && (
          <Button
            label="Clear"
            onPress={handleClear}
            variant="ghost"
            style={styles.clearBtn}
          />
        )}
      </View>

      {/* Results */}
      {hasSearched && (
        <Animated.View entering={FadeIn} style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: theme.colors.textSecondary }]}>
            {filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>
      )}

      <FlatList
        data={hasSearched ? filteredEntries : []}
        keyExtractor={item => item.id}
        renderItem={renderEntry}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          hasSearched ? (
            <Animated.View entering={FadeIn} style={styles.noResults}>
              <Text style={styles.noResultsIcon}>🔍</Text>
              <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>
                No entries match your filters
              </Text>
            </Animated.View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.extraBold,
  },
  searchBox: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  searchInput: {},
  tagSection: {
    marginBottom: spacing[3],
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  tagList: {
    paddingHorizontal: spacing[4],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  dateInput: { flex: 1 },
  dateSep: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  searchBtn: { flex: 1 },
  clearBtn: {},
  resultsHeader: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  resultsCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  list: { paddingBottom: spacing[12] },
  noResults: {
    paddingTop: 60,
    alignItems: 'center',
  },
  noResultsIcon: { fontSize: 50, marginBottom: spacing[3] },
  noResultsText: {
    fontSize: typography.sizes.base,
    textAlign: 'center',
  },
});
