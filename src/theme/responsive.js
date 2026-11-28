import { useWindowDimensions } from 'react-native';

export function getResponsiveLayout(width, fontScale = 1) {
  const gutter = width <= 339 ? 16 : width <= 374 ? 18 : width <= 409 ? 20 : 24;
  const largeText = fontScale >= 1.5;
  return {
    gutter,
    compact: width <= 360 || largeText,
    headerStacked: width <= 339 || largeText,
    columns: width >= 360 && !largeText ? 2 : 1,
    fontScale,
    width,
  };
}

export function useResponsiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  return getResponsiveLayout(width, fontScale);
}
