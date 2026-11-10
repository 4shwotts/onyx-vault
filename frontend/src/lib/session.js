import { createContext, useContext } from 'react';

// The signed-in user, as /auth/me reports it: { id, email, isDemo,
// demoExpiresAt }. Provided by ProtectedRoute to every signed-in page.
export const SessionContext = createContext({ user: null });

export function useSession() {
  return useContext(SessionContext);
}
