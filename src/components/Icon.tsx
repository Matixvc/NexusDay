import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { SvgProps } from 'react-native-svg';

export interface IconProps extends Omit<SvgProps, 'color'> {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const LUCIDE_ICONS: Record<string, React.ComponentType<any>> = {
  home: () => require('lucide-react-native').Home,
  schedule: () => require('lucide-react-native').Grid,
  calendar: () => require('lucide-react-native').Calendar,
  birthdays: () => require('lucide-react-native').Cake,
  settings: () => require('lucide-react-native').Settings,
  habit: () => require('lucide-react-native').CheckCircle2,
  money: () => require('lucide-react-native').CreditCard,
  ai: () => require('lucide-react-native').Bot,
  search: () => require('lucide-react-native').Search,
  note: () => require('lucide-react-native').FileText,
  chevronDown: () => require('lucide-react-native').ChevronDown,
  chevronUp: () => require('lucide-react-native').ChevronUp,
  chevronLeft: () => require('lucide-react-native').ChevronLeft,
  chevronRight: () => require('lucide-react-native').ChevronRight,
  plus: () => require('lucide-react-native').Plus,
  minus: () => require('lucide-react-native').Minus,
  x: () => require('lucide-react-native').X,
  check: () => require('lucide-react-native').Check,
  checkCircle: () => require('lucide-react-native').CheckCircle,
  clock: () => require('lucide-react-native').Clock,
  user: () => require('lucide-react-native').User,
  bell: () => require('lucide-react-native').Bell,
  lock: () => require('lucide-react-native').Lock,
  unlock: () => require('lucide-react-native').Unlock,
  shield: () => require('lucide-react-native').Shield,
  shieldCheck: () => require('lucide-react-native').ShieldCheck,
  eye: () => require('lucide-react-native').Eye,
  eyeOff: () => require('lucide-react-native').EyeOff,
  trash: () => require('lucide-react-native').Trash2,
  edit: () => require('lucide-react-native').Edit2,
  save: () => require('lucide-react-native').Save,
  copy: () => require('lucide-react-native').Copy,
  share: () => require('lucide-react-native').Share2,
  menu: () => require('lucide-react-native').Menu,
  list: () => require('lucide-react-native').List,
  folder: () => require('lucide-react-native').Folder,
  image: () => require('lucide-react-native').Image,
  mic: () => require('lucide-react-native').Mic,
  heart: () => require('lucide-react-native').Heart,
  star: () => require('lucide-react-native').Star,
  zap: () => require('lucide-react-native').Zap,
  alertCircle: () => require('lucide-react-native').AlertCircle,
  info: () => require('lucide-react-native').Info,
};

export function Icon({ name, size = 24, color, strokeWidth = 2, ...rest }: IconProps) {
  const IconComponent = LUCIDE_ICONS[name];

  if (!IconComponent) {
    if (__DEV__) {
      console.warn(`[Icon] Icono no resuelto: "${name}".`);
    }
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} {...rest}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }

  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} {...rest} />;
}

const styles = StyleSheet.create({});