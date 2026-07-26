import { useEffect, useState } from "react";
import { Image, type ImageStyle, Pressable, type StyleProp } from "react-native";
import { router } from "expo-router";
import { LoadingImage } from "./loading-image";

export function TappablePhoto({ uri, title, style, target, openViewer = false, conformToPhoto = false, resizeMode = "cover" }: { uri: string; title: string; style: StyleProp<ImageStyle>; target?: { entityType: "room" | "item" | "receipt"; entityId: string; index: number }; openViewer?: boolean; conformToPhoto?: boolean; resizeMode?: "cover" | "contain" }) {
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  useEffect(() => { if (conformToPhoto) Image.getSize(uri, (width, height) => setAspectRatio(width / height)); }, [conformToPhoto, uri]);
  const image = <LoadingImage uri={uri} style={[style, conformToPhoto && { height: undefined, aspectRatio }]} resizeMode={resizeMode} />;
  if (!target && !openViewer) return image;
  return <Pressable onPress={(event) => { event.stopPropagation(); router.push({ pathname: "/photo-viewer", params: { uri, title, ...(target ? { entityType: target.entityType, entityId: target.entityId, index: String(target.index) } : {}) } }); }} accessibilityRole="imagebutton" accessibilityLabel={`View ${title}`}>{image}</Pressable>;
}
