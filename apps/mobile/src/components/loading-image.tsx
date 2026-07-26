import { useEffect, useRef, useState } from "react";
import { Animated, Image, type ImageProps, type ImageStyle, StyleSheet, View, type StyleProp } from "react-native";

export function LoadingImage({ uri, style, resizeMode = "cover", dark = false, ...props }: Omit<ImageProps, "source" | "style"> & { uri: string; style: StyleProp<ImageStyle>; dark?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [uri]);
  return <View style={[style, styles.frame]}>
    <Image {...props} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={resizeMode} onLoad={(event) => { setLoaded(true); props.onLoad?.(event); }} onError={(event) => { setLoaded(true); props.onError?.(event); }} />
    {!loaded ? <ImageSkeleton dark /> : null}
  </View>;
}

export function ImageSkeleton({ style, dark = false }: { style?: StyleProp<ImageStyle>; dark?: boolean }) {
  const pulse = useRef(new Animated.Value(.45)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: .9, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: .45, duration: 700, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style, dark ? styles.dark : styles.light, { opacity: pulse }]} />;
}

const styles = StyleSheet.create({ frame: { overflow: "hidden" }, light: { backgroundColor: "#d9d8d1" }, dark: { backgroundColor: "#26302b" } });
