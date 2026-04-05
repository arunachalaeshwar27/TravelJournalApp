import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const containerStyle: ViewStyle = {
    backgroundColor: getBackground(variant, theme.colors),
    paddingVertical: getPaddingV(size),
    paddingHorizontal: getPaddingH(size),
    borderRadius: radius.md,
    borderWidth: variant === 'secondary' || variant === 'ghost' ? 1.5 : 0,
    borderColor: variant === 'secondary' ? theme.colors.primary : theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.5 : 1,
  };

  const labelStyle: TextStyle = {
    color: getTextColor(variant, theme.colors),
    fontSize: getFontSize(size),
    fontWeight: typography.weights.semiBold,
    marginLeft: leftIcon ? spacing[2] : 0,
  };

  return (
    <AnimatedTouchable
      style={[containerStyle, animatedStyle, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || isLoading}
      activeOpacity={1}>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : theme.colors.primary}
        />
      ) : (
        <>
          {leftIcon}
          <Text style={[labelStyle, textStyle]}>{label}</Text>
        </>
      )}
    </AnimatedTouchable>
  );
};

function getBackground(variant: Variant, colors: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (variant) {
    case 'primary': return colors.primary;
    case 'danger': return '#EF4444';
    default: return 'transparent';
  }
}

function getTextColor(variant: Variant, colors: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (variant) {
    case 'primary':
    case 'danger': return '#FFFFFF';
    default: return colors.primary;
  }
}

function getPaddingV(size: Size) {
  return size === 'sm' ? 8 : size === 'md' ? 13 : 17;
}

function getPaddingH(size: Size) {
  return size === 'sm' ? 14 : size === 'md' ? 20 : 28;
}

function getFontSize(size: Size) {
  return size === 'sm' ? 13 : size === 'md' ? 15 : 17;
}
