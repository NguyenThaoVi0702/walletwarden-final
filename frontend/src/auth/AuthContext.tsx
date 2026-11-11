import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setUnauthorizedHandler, tokenStore } from "../api/client";
import { fetchMe, queryKeys } from "../api/hooks";
import type { TokenResponse } from "../api/types";
import { AuthContext, type AuthState } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState(() => tokenStore.get());

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  });

  const signOut = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    qc.clear();
  }, [qc]);

  const signIn = useCallback(
    (res: TokenResponse) => {
      tokenStore.set(res.access_token);
      qc.setQueryData(queryKeys.me, res.user);
      setToken(res.access_token);
    },
    [qc],
  );

  // Any 401 clears the token; RequireAuth then redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(() => {});
  }, [signOut]);

  const value = useMemo<AuthState>(
    () => ({
      user: token ? (me.data ?? null) : null,
      loading: token !== null && me.isPending && !me.isError,
      signIn,
      signOut,
    }),
    [token, me.data, me.isPending, me.isError, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
