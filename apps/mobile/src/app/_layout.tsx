import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { InventoryProvider } from "../inventory-context";
import { AuthProvider, useAuth } from "../auth-context";
import { AuthScreen } from "../components/auth-screen";

export default function RootLayout() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}

function AuthenticatedApp() {
  const { signedIn } = useAuth();
  if (!signedIn) return <AuthScreen />;
  return (
    <InventoryProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </InventoryProvider>
  );
}
