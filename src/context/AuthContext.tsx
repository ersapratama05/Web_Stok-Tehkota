import React, { createContext, useContext, useState, useEffect } from 'react';
import { Branch, User } from '../types';
import { clearSyncQueue, getSyncQueue } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeBranch: Branch;
  setActiveBranch: (branch: Branch) => void;
  login: (username: string, password: string, branch?: Branch) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (branch: Branch) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isOnline: boolean;
  syncStatus: 'saved' | 'saving' | 'error' | 'offline';
  setSyncStatus: (status: 'saved' | 'saving' | 'error' | 'offline') => void;
  lastSavedTime: string | null;
  setLastSavedTime: (time: string) => void;
  triggerSync: () => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'tehkota_auth_token';
const USER_KEY = 'tehkota_auth_user';
const BRANCH_KEY = 'tehkota_active_branch';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.name === 'Kasir' && parsed.branch && parsed.branch !== 'All') {
        parsed.name = `Kasir ${parsed.branch}`;
        localStorage.setItem(USER_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [activeBranch, setActiveBranchState] = useState<Branch>(() => {
    const saved = localStorage.getItem(BRANCH_KEY);
    return (saved as Branch) || 'Sompok';
  });

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error' | 'offline'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setActiveBranch = (b: Branch) => {
    setActiveBranchState(b);
    localStorage.setItem(BRANCH_KEY, b);
  };

  const login = async (username: string, password: string, branch?: Branch) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, branch }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      const assignedBranch = (data.user.branch !== 'All' ? data.user.branch : (branch || 'Sompok')) as Branch;
      setActiveBranch(assignedBranch);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server gagal' };
    }
  };

  const quickLogin = async (branch: Branch) => {
    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      setActiveBranch(branch);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server gagal' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const triggerSync = async (): Promise<number> => {
    const queue = getSyncQueue();
    if (queue.length === 0) return 0;

    try {
      setSyncStatus('saving');
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue }),
      });

      if (res.ok) {
        const data = await res.json();
        clearSyncQueue();
        setSyncStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString('id-ID'));
        return data.synced || 0;
      } else {
        setSyncStatus('error');
        return 0;
      }
    } catch {
      setSyncStatus('error');
      return 0;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeBranch,
        setActiveBranch,
        login,
        quickLogin,
        logout,
        isOnline,
        syncStatus,
        setSyncStatus,
        lastSavedTime,
        setLastSavedTime,
        triggerSync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
