import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface TagChipProps {
  label: string;
  onRemove?: () => void;
  onPress?: () => void;
  selected?: boolean;
  variant?: 'default' | 'filter';
}

export const TagChip: React.FC<TagChipProps> = ({
  label,
  onRemove,
  onPress,
  selected = false,
  variant = 'default',
}) => {
  const { theme } = useTheme();

  const isFilter = variant === 'filter';
  const bgColor = selected || !isFilter
    ? `${theme.colors.primary}20`
    : theme.colors.inputBackground;
  const textColor = selected || !isFilter
    ? theme.colors.primary
    : theme.colors.textSecondary;
  const borderColor = selected ? theme.colors.primary : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !onRemove}
      style={[
        styles.chip,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: 1,
        },
      ]}>
      <Text style={[styles.label, { color: textColor }]}>#{label}</Text>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={[styles.removeIcon, { color: textColor }]}>×</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginRight: spacing[2],
    marginBottom: spacing[2],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  removeBtn: {
    marginLeft: spacing[1],
  },
  removeIcon: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: typography.weights.bold,
  },
});
