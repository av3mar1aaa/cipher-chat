import { Platform } from 'react-native';

export const COLORS = {
  bg: '#0a0a0a',
  bgSecondary: '#111111',
  bgTertiary: '#1a1a1a',
  green: '#00ff41',
  greenDim: '#00cc33',
  greenDark: '#003300',
  greenBg: '#0a1f0a',
  text: '#e0e0e0',
  textDim: '#666666',
  border: '#222222',
  danger: '#ff4444',
  white: '#ffffff',
};

export const FONTS = {
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};
