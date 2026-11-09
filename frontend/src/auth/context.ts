import { createContext } from "react";
import type { TokenResponse, User } from "../api/types";

export interface AuthState {
  user: User | null;
  /** true khi đang có token nhưng chưa tải xong /api/me. */
  loading: boolean;
  signIn: (res: TokenResponse) => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
