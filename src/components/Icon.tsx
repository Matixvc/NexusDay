import type { ElementType } from 'react';
import Svg, { SvgProps } from 'react-native-svg';
import AlertCircle from 'lucide-react-native/icons/alert-circle';
import Bell from 'lucide-react-native/icons/bell';
import Bot from 'lucide-react-native/icons/bot';
import Cake from 'lucide-react-native/icons/cake';
import Calendar from 'lucide-react-native/icons/calendar';
import Check from 'lucide-react-native/icons/check';
import CheckCircle from 'lucide-react-native/icons/check-circle';
import CheckCircle2 from 'lucide-react-native/icons/check-circle-2';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Clock from 'lucide-react-native/icons/clock';
import Copy from 'lucide-react-native/icons/copy';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Edit2 from 'lucide-react-native/icons/edit-2';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import FileText from 'lucide-react-native/icons/file-text';
import Folder from 'lucide-react-native/icons/folder';
import Grid from 'lucide-react-native/icons/grid';
import Heart from 'lucide-react-native/icons/heart';
import Home from 'lucide-react-native/icons/home';
import Image from 'lucide-react-native/icons/image';
import Info from 'lucide-react-native/icons/info';
import List from 'lucide-react-native/icons/list';
import Lock from 'lucide-react-native/icons/lock';
import Menu from 'lucide-react-native/icons/menu';
import Mic from 'lucide-react-native/icons/mic';
import Minus from 'lucide-react-native/icons/minus';
import Palette from 'lucide-react-native/icons/palette';
import Plus from 'lucide-react-native/icons/plus';
import Save from 'lucide-react-native/icons/save';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Share2 from 'lucide-react-native/icons/share-2';
import Shield from 'lucide-react-native/icons/shield';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Star from 'lucide-react-native/icons/star';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Unlock from 'lucide-react-native/icons/unlock';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import Zap from 'lucide-react-native/icons/zap';

export interface IconProps extends Omit<SvgProps, 'color'> {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const LUCIDE_ICONS: Record<string, ElementType> = {
  home: Home,
  schedule: Grid,
  calendar: Calendar,
  birthdays: Cake,
  settings: Settings,
  habit: CheckCircle2,
  money: CreditCard,
  ai: Bot,
  search: Search,
  note: FileText,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
  checkCircle: CheckCircle,
  clock: Clock,
  user: User,
  bell: Bell,
  lock: Lock,
  unlock: Unlock,
  shield: Shield,
  shieldCheck: ShieldCheck,
  eye: Eye,
  eyeOff: EyeOff,
  trash: Trash2,
  edit: Edit2,
  save: Save,
  copy: Copy,
  share: Share2,
  menu: Menu,
  list: List,
  folder: Folder,
  image: Image,
  mic: Mic,
  heart: Heart,
  star: Star,
  zap: Zap,
  alertCircle: AlertCircle,
  info: Info,
  palette: Palette,
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
