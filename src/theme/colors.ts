export const palette = {
  // Brand
  primary: '#4F6CF7',
  primaryLight: '#7B93F9',
  primaryDark: '#2D4AE0',

  // Accent
  accent: '#FF7B5E',
  accentLight: '#FF9F8A',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  grey50: '#F9FAFB',
  grey100: '#F3F4F6',
  grey200: '#E5E7EB',
  grey300: '#D1D5DB',
  grey400: '#9CA3AF',
  grey500: '#6B7280',
  grey600: '#4B5563',
  grey700: '#374151',
  grey800: '#1F2937',
  grey900: '#111827',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Transparent
  transparent: 'transparent',
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.2)',
} as const;

export const lightColors = {
  background: palette.grey50,
  surface: palette.white,
  surfaceElevated: palette.white,
  card: palette.white,
  border: palette.grey200,
  divider: palette.grey100,
  text: palette.grey900,
  textSecondary: palette.grey500,
  textDisabled: palette.grey300,
  primary: palette.primary,
  accent: palette.accent,
  icon: palette.grey600,
  tabBar: palette.white,
  inputBackground: palette.grey100,
  shadow: 'rgba(0,0,0,0.08)',
  statusBar: 'dark-content' as const,
};

export const darkColors: typeof lightColors = {
  background: palette.grey900,
  surface: palette.grey800,
  surfaceElevated: palette.grey700,
  card: palette.grey800,
  border: palette.grey700,
  divider: palette.grey800,
  text: palette.white,
  textSecondary: palette.grey400,
  textDisabled: palette.grey600,
  primary: palette.primaryLight,
  accent: palette.accent,
  icon: palette.grey300,
  tabBar: palette.grey900,
  inputBackground: palette.grey700,
  shadow: 'rgba(0,0,0,0.4)',
  statusBar: 'light-content' as const,
};

export type ThemeColors = typeof lightColors;
