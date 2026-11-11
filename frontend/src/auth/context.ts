import { createContext } from "react";
import type { TokenResponse, User } from "../api/types";

export interface AuthState {
  user: User | null;
  /** true while a token exists but /api/me has not loaded yet. */
  loading: boolean;
  signIn: (res: TokenResponse) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
