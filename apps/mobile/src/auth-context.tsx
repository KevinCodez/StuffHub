import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authenticate, hasSession, requestPasswordReset, signOut } from "./backend-api";

interface AuthValue { ready: boolean; signedIn: boolean; signIn: (email: string, password: string) => Promise<void>; signUp: (email: string, password: string, displayName: string, homeName: string) => Promise<void>; forgotPassword: (email: string) => Promise<string>; logOut: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false); const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { hasSession().then(setSignedIn).finally(() => setReady(true)); }, []);
  return <AuthContext.Provider value={{ ready, signedIn,
    signIn: async (email, password) => { await authenticate("sign-in", { email, password }); setSignedIn(true); },
    signUp: async (email, password, displayName, homeName) => { await authenticate("sign-up", { email, password, displayName, homeName }); setSignedIn(true); },
    forgotPassword: requestPasswordReset,
    logOut: async () => { await signOut(); setSignedIn(false); },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be inside AuthProvider"); return value; }
