import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JournalStackParamList } from '@/types';
import { useJournalStore } from '@/store/journalStore';
import { enqueueEntrySync } from '@/services/syncService';
import { TagChip } from '@/components/ui/TagChip';
import { SyncBadge } from '@/components/ui/SyncBadge';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatDateTime } from '@/utils/dateUtils';

const { width: W } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalDetail'>;
type Route = RouteProp<JournalStackParamList, 'JournalDetail'>;

export const JournalDetailScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { entryId } = route.params;
  const { activeEntry, loadEntry, deleteEntry } = useJournalStore();

  useEffect(() => {
    loadEntry(entryId);
  }, [entryId]);

  const handleEdit = () => {
    navigation.navigate('JournalEditor', { entryId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (activeEntry) {
              await deleteEntry(entryId);
              await enqueueEntrySync({ ...activeEntry, isDeleted: true }, 'delete');
            }
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (!activeEntry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text, padding: spacing[4] }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtn, { color: theme.colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        {/* Photo carousel */}
        {activeEntry.photos.length > 0 && (
          <FlatList
            data={activeEntry.photos}
            keyExtractor={p => p.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('PhotoViewer', {
                    photos: activeEntry.photos,
                    initialIndex: activeEntry.photos.indexOf(item),
                  })
                }>
                <FastImage
                  source={{ uri: item.remoteUrl ?? item.uri }}
                  style={[styles.photo, { width: W }]}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </TouchableOpacity>
            )}
            style={styles.photoCarousel}
          />
        )}

        <Animated.View entering={FadeInDown.springify()} style={styles.body}>
          {/* Meta */}
          <View style={styles.metaRow}>
            <SyncBadge status={activeEntry.syncStatus} />
            <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
              {formatDateTime(activeEntry.createdAt)}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {activeEntry.title}
          </Text>

          {/* Location */}
          {activeEntry.locationName ? (
            <Text style={[styles.location, { color: theme.colors.textSecondary }]}>
              📍 {activeEntry.locationName}
            </Text>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />

          {/* Description */}
          <Text style={[styles.description, { color: theme.colors.text }]}>
            {activeEntry.description || 'No description added.'}
          </Text>

          {/* Tags */}
          {activeEntry.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Tags</Text>
              <View style={styles.tagsRow}>
                {activeEntry.tags.map(tag => (
                  <TagChip key={tag} label={tag} />
                ))}
              </View>
            </View>
          )}

          {/* Photo tags breakdown */}
          {activeEntry.photos.some(p => p.tags.length > 0) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                AI Photo Tags
              </Text>
              {activeEntry.photos.map((photo, i) =>
                photo.tags.length > 0 ? (
                  <View key={photo.id} style={styles.photoTagRow}>
                    <FastImage
                      source={{ uri: photo.remoteUrl ?? photo.uri }}
                      style={styles.photoThumb}
                    />
                    <View style={styles.photoTagsList}>
                      {photo.tags.map(tag => (
                        <TagChip key={tag} label={tag} />
                      ))}
                    </View>
                  </View>
                ) : null,
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
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
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { fontSize: typography.sizes.lg },
  headerActions: { flexDirection: 'row', gap: spacing[4] },
  actionBtn: { padding: 4 },
  actionText: { fontSize: typography.sizes.base, fontWeight: typography.weights.semiBold },
  scrollContent: { paddingBottom: spacing[16] },
  photoCarousel: { height: 280 },
  photo: { height: 280 },
  body: { padding: spacing[4] },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  date: { fontSize: typography.sizes.sm },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.extraBold,
    lineHeight: 36,
    marginBottom: spacing[2],
  },
  location: { fontSize: typography.sizes.md, marginBottom: spacing[3] },
  divider: { height: 1, marginVertical: spacing[4] },
  description: {
    fontSize: typography.sizes.base,
    lineHeight: 26,
  },
  section: { marginTop: spacing[6] },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  photoTagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    marginRight: spacing[3],
  },
  photoTagsList: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
});
