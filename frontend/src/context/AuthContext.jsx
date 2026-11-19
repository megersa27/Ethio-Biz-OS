import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { getCurrentUser } from '../services/api.js';

const AuthContext = createContext(null);

function getAuthStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || window.sessionStorage;
  } catch {
    return window.sessionStorage;
  }
}

function readStoredJson(key, fallback) {
  const storage = getAuthStorage();

  if (!storage) return fallback;

  try {
    const value = storage.getItem(key) || sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function clearStoredSession() {
  if (typeof window === 'undefined') return;

  ['ethioBizAccessToken', 'ethioBizUser', 'ethioBizBusiness'].forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const storage = getAuthStorage();
    const token = (storage ? storage.getItem('ethioBizAccessToken') : null)
      || sessionStorage.getItem('ethioBizAccessToken');

    if (!token) {
      setAuthChecking(false);
      return () => {
        cancelled = true;
      };
    }

    const cachedUser = readStoredJson('ethioBizUser', {});
    const cachedBusiness = readStoredJson('ethioBizBusiness', null);

    if (!cancelled && (cachedUser || cachedBusiness)) {
      setAuth({
        accessToken: token,
        user: cachedUser || {},
        business: cachedBusiness,
      });
      setAuthChecking(false);
    }

    async function restoreSession() {
      try {
        const result = await getCurrentUser(token);

        if (!cancelled) {
          setAuth({
            accessToken: token,
            user: { ...cachedUser, ...(result?.user || {}) },
            business: cachedBusiness,
          });
        }
      } catch {
        if (!cancelled) {
          clearStoredSession();
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
    const storage = getAuthStorage();

    if (storage) {
      storage.setItem('ethioBizAccessToken', result.accessToken);
      storage.setItem('ethioBizUser', JSON.stringify(result.user));
      storage.setItem('ethioBizBusiness', JSON.stringify(result.business));
    }

    sessionStorage.setItem('ethioBizAccessToken', result.accessToken);
    sessionStorage.setItem('ethioBizUser', JSON.stringify(result.user));
    sessionStorage.setItem('ethioBizBusiness', JSON.stringify(result.business));

    setAuth(result);
  }

  function updateProfile(profile) {
    if (!profile) return;

    const storage = getAuthStorage();
    const user = {
      ...readStoredJson('ethioBizUser', {}),
      ...(profile.user || {}),
    };
    const business = {
      ...readStoredJson('ethioBizBusiness', {}),
      ...(profile.business || {}),
    };

    if (storage) {
      storage.setItem('ethioBizUser', JSON.stringify(user));
      storage.setItem('ethioBizBusiness', JSON.stringify(business));
    }

    sessionStorage.setItem('ethioBizUser', JSON.stringify(user));
    sessionStorage.setItem('ethioBizBusiness', JSON.stringify(business));

    setAuth((current) => current ? {
      ...current,
      user: { ...current.user, ...(profile.user || {}) },
      business: { ...current.business, ...(profile.business || {}) },
    } : current);
  }

  function logout() {
    clearStoredSession();
    setAuth(null);
  }

  return (
    <AuthContext.Provider
      value={{ auth, authChecking, login, logout, updateProfile }}
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
