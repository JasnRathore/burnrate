import React from "react";
import { OpaqueColorValue, type StyleProp, type ViewStyle } from "react-native";
import {
  House,
  TrendUp,
  Receipt,
  Gauge,
  Gear,
  CaretRight,
  PlusCircle,
  CurrencyInr,
  PaperPlaneRight,
  Code,
  Heart,
  Bank,
  Microphone,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Warning,
  User,
  Shield,
  Moon,
  Info,
  Sliders,
  Question,
  Bell,
  Trash,
  ForkKnife,
  Car,
  HouseLine,
  BookOpen,
  ShoppingBag,
  Lightbulb,
  FilmSlate,
  FirstAid,
  Coins,
  SquaresFour,
  X,
  Check,
  CaretDown,
  CaretUp,
  CaretLeft,
  DotsThree,
  DotsThreeVertical,
  ArrowCounterClockwise,
  PencilSimple,
} from "phosphor-react-native";

// SF Symbols to Phosphor Icon Component mapping
const MAPPING: Record<string, React.ComponentType<any>> = {
  "house.fill": House,
  "chart.line.uptrend.xyaxis": TrendUp,
  "list.bullet.rectangle": Receipt,
  "gauge.with.dots.needle.67percent": Gauge,
  "gearshape.fill": Gear,
  "chevron.right": CaretRight,
  "plus.circle.fill": PlusCircle,
  "indianrupeesign.circle.fill": CurrencyInr,
  "paperplane.fill": PaperPlaneRight,
  "chevron.left.forwardslash.chevron.right": Code,
  "heart.fill": Heart,
  heart: Heart,
  microphone: Microphone,
  plus: Plus,
  "arrow.left": ArrowLeft,
  calendar: Calendar,
  "check.circle": CheckCircle,
  clock: Clock,
  warning: Warning,
  user: User,
  shield: Shield,
  moon: Moon,
  info: Info,
  sliders: Sliders,
  bell: Bell,
  trash: Trash,
  bank: Bank,
  // Context-specific categories
  "category.food": ForkKnife,
  "category.transport": Car,
  "category.rent": HouseLine,
  "category.college": BookOpen,
  "category.shopping": ShoppingBag,
  "category.bills": Lightbulb,
  "category.entertainment": FilmSlate,
  "category.health": FirstAid,
  "category.income": Coins,
  "category.other": SquaresFour,
  // Additional icons used in Quick Entry
  "xmark": X,
  "checkmark": Check,
  "chevron.down": CaretDown,
  "chevron.up": CaretUp,
  "chevron.left": CaretLeft,
  "ellipsis": DotsThree,
  "ellipsis.vertical": DotsThreeVertical,
  "pencil": PencilSimple,
  "arrow.counterclockwise": ArrowCounterClockwise,
};

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses high-quality Phosphor Icons for a premium, unified look.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = "regular",
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?:
    | "thin"
    | "light"
    | "regular"
    | "medium"
    | "semibold"
    | "bold"
    | "heavy"
    | "fill"
    | "duotone";
}) {
  const IconComponent = MAPPING[name] || Question;

  // Map standard weight strings to Phosphor weight names
  const getPhosphorWeight = (w: string) => {
    switch (w) {
      case "thin":
        return "thin";
      case "light":
        return "light";
      case "regular":
      case "medium":
      case "semibold":
        return "regular";
      case "bold":
      case "heavy":
        return "bold";
      case "fill":
        return "fill";
      case "duotone":
        return "duotone";
      default:
        return "regular";
    }
  };

  // OpaqueColorValue is typically resolved by React Native, so we pass it directly to color
  return (
    <IconComponent
      size={size}
      color={color as string}
      weight={getPhosphorWeight(weight)}
      style={style}
    />
  );
}
