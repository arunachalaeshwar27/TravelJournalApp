export { palette, lightColors, darkColors } from './colors';
export type { ThemeColors } from './colors';
export { typography } from './typography';
export { spacing, radius, shadow } from './spacing';

import { lightColors, darkColors } from './colors';
import { typography } from './typography';
import { spacing, radius, shadow } from './spacing';

export const lightTheme = {
  dark: false,
  colors: lightColors,
  typography,
  spacing,
  radius,
  shadow,
};

export const darkTheme = {
  ...lightTheme,
  dark: true,
  colors: darkColors,
};

export type AppTheme = typeof lightTheme;
