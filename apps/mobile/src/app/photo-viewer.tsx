import { useLocalSearchParams } from "expo-router";
import { PhotoViewer } from "../components/photo-viewer";

export default function PhotoViewerScreen() {
  const { uri = "", title = "Photo", entityType, entityId, index } = useLocalSearchParams<{ uri?: string; title?: string; entityType?: "room" | "item" | "receipt"; entityId?: string; index?: string }>();
  const target = entityType && entityId && index !== undefined ? { entityType, entityId, index: Number(index) } : undefined;
  return <PhotoViewer uri={uri} title={title} {...(target ? { target } : {})} />;
}
