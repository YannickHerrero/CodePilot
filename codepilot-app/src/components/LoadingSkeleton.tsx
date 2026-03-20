import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { colors } from "@/constants/theme";

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function LoadingSkeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.surfaceElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
      }}
    >
      <LoadingSkeleton width="60%" height={18} />
      <LoadingSkeleton width="80%" height={14} />
      <LoadingSkeleton width="30%" height={12} />
    </View>
  );
}

export function SessionItemSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
      }}
    >
      <LoadingSkeleton width="70%" height={16} />
      <LoadingSkeleton width="40%" height={12} />
    </View>
  );
}
