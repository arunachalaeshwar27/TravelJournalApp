import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { JournalEntry } from '@/types';
import { useTheme } from '@/theme/ThemeContext';
import { TagChip } from '@/components/ui/TagChip';
import { SyncBadge } from '@/components/ui/SyncBadge';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { formatDate } from '@/utils/dateUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing[4] * 2;

interface EntryCardProps {
  entry: JournalEntry;
  onPress: () => void;
  index: number;
}

export const EntryCard: React.FC<EntryCardProps> = ({ entry, onPress, index }) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.98); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  const coverPhoto = entry.photos[0];
  const displayTags = entry.tags.slice(0, 3);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      style={[animatedStyle, { marginHorizontal: spacing[4], marginBottom: spacing[3] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[styles.card, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}>

        {/* Cover photo */}
        {coverPhoto ? (
          <FastImage
            source={{ uri: coverPhoto.remoteUrl ?? coverPhoto.uri, priority: FastImage.priority.normal }}
            style={styles.coverPhoto}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.inputBackground }]}>
            <Text style={styles.coverPlaceholderIcon}>🌍</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
              {formatDate(entry.createdAt)}
            </Text>
            <SyncBadge status={entry.syncStatus} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
            {entry.title || 'Untitled Entry'}
          </Text>

          {/* Description */}
          {entry.description ? (
            <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {entry.description}
            </Text>
          ) : null}

          {/* Location */}
          {entry.locationName ? (
            <Text style={[styles.location, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              📍 {entry.locationName}
            </Text>
          ) : null}

          {/* Tags */}
          {displayTags.length > 0 && (
            <View style={styles.tagsRow}>
              {displayTags.map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
              {entry.tags.length > 3 && (
                <Text style={[styles.moreTags, { color: theme.colors.textSecondary }]}>
                  +{entry.tags.length - 3}
                </Text>
              )}
            </View>
          )}

          {/* Photos count */}
          {entry.photos.length > 1 && (
            <Text style={[styles.photoCount, { color: theme.colors.textSecondary }]}>
              🖼 {entry.photos.length} photos
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  coverPhoto: {
    width: '100%',
    height: 180,
  },
  coverPlaceholder: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderIcon: {
    fontSize: 40,
  },
  content: {
    padding: spacing[4],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  date: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing[1],
    lineHeight: 26,
  },
  description: {
    fontSize: typography.sizes.md,
    lineHeight: 22,
    marginBottom: spacing[2],
  },
  location: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing[2],
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing[1],
  },
  moreTags: {
    fontSize: typography.sizes.sm,
    marginLeft: spacing[1],
    alignSelf: 'center',
  },
  photoCount: {
    fontSize: typography.sizes.sm,
    marginTop: spacing[1],
  },
});
