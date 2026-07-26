import { useLocalSearchParams } from "expo-router";
import { useInventory } from "../../inventory-context";
import { PhotoViewer } from "../../components/photo-viewer";

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findPhoto, rooms } = useInventory();
  const photo = findPhoto(id);
  const room = rooms.find((entry) => entry.photos.some((candidate) => candidate.id === id));
  const index = room?.photos.findIndex((candidate) => candidate.id === id) ?? -1;
  const target = room && index >= 0 ? { entityType: "room" as const, entityId: room.id, index } : undefined;
  return <PhotoViewer uri={photo?.uri ?? ""} title="Room photo" {...(target ? { target } : {})} />;
}
