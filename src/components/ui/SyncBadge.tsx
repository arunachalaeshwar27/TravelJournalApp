import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSyncStore } from '@/store/syncStore';
import { SyncStatus } from '@/types';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  local: { label: 'Not synced', color: '#F59E0B' },
  syncing: { label: 'Syncing...', color: '#3B82F6' },
  synced: { label: 'Synced', color: '#22C55E' },
  conflict: { label: 'Conflict', color: '#EF4444' },
  error: { label: 'Sync error', color: '#EF4444' },
};

interface Props {
  status: SyncStatus;
}

export const SyncBadge: React.FC<Props> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}20` }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

export const GlobalSyncIndicator: React.FC = () => {
  const { isOnline, pendingCount } = useSyncStore();

  if (isOnline && pendingCount === 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: isOnline ? '#3B82F620' : '#F59E0B20' }]}>
      <View style={[styles.dot, { backgroundColor: isOnline ? '#3B82F6' : '#F59E0B' }]} />
      <Text style={[styles.label, { color: isOnline ? '#3B82F6' : '#F59E0B' }]}>
        {isOnline ? `Syncing ${pendingCount} items` : 'Offline'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semiBold,
  },
});
