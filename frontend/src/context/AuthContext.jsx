import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { getCurrentUser } from '../services/api.js';

const AuthContext = createContext(null);

function readStoredJson(key, fallback) {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function clearStoredSession() {
  sessionStorage.removeItem('ethioBizAccessToken');
  sessionStorage.removeItem('ethioBizUser');
  sessionStorage.removeItem('ethioBizBusiness');
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = sessionStorage.getItem('ethioBizAccessToken');

    if (!token) {
      setAuthChecking(false);
      return () => {
        cancelled = true;
      };
    }

    async function restoreSession() {
      try {
        const result = await getCurrentUser(token);
        const cachedUser = readStoredJson('ethioBizUser', {});
        const cachedBusiness = readStoredJson('ethioBizBusiness', null);

        if (!cancelled) {
          setAuth({
            accessToken: token,
            user: { ...cachedUser, ...result.user },
            business: cachedBusiness,
          });
        }
      } catch {
        clearStoredSession();

        if (!cancelled) {
          setAuth(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function login(result) {
    sessionStorage.setItem('ethioBizAccessToken', result.accessToken);
    sessionStorage.setItem('ethioBizUser', JSON.stringify(result.user));
    sessionStorage.setItem('ethioBizBusiness', JSON.stringify(result.business));

    setAuth(result);
  }

  function logout() {
    clearStoredSession();
    setAuth(null);
  }

  return (
    <AuthContext.Provider
      value={{ auth, authChecking, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
