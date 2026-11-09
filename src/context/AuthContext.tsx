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

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));

        const assignedBranch = (data.user.branch !== 'All' ? data.user.branch : (branch || 'Sompok')) as Branch;
        setActiveBranch(assignedBranch);
        return { success: true };
      }

      if (contentType.includes('application/json')) {
        const data = await res.json();
        return { success: false, error: data.error || 'Login gagal' };
      }

      // Standalone fallback (misal hosting Vercel static tanpa backend API)
      if (username === 'Tehkota321' && password === 'Tehkota321') {
        const localOwner: User = {
          id: 'usr_owner',
          username: 'Tehkota321',
          name: 'Owner Teh Kota',
          email: 'owner@tehkota.com',
          role: 'admin',
          branch: 'All',
        };
        const localToken = 'token_owner_' + Date.now();
        setToken(localToken);
        setUser(localOwner);
        localStorage.setItem(TOKEN_KEY, localToken);
        localStorage.setItem(USER_KEY, JSON.stringify(localOwner));
        setActiveBranch(branch || 'Sompok');
        return { success: true };
      }
      return { success: false, error: 'Username atau kata sandi Owner salah!' };
    } catch (err: any) {
      if (username === 'Tehkota321' && password === 'Tehkota321') {
        const localOwner: User = {
          id: 'usr_owner',
          username: 'Tehkota321',
          name: 'Owner Teh Kota',
          email: 'owner@tehkota.com',
          role: 'admin',
          branch: 'All',
        };
        const localToken = 'token_owner_' + Date.now();
        setToken(localToken);
        setUser(localOwner);
        localStorage.setItem(TOKEN_KEY, localToken);
        localStorage.setItem(USER_KEY, JSON.stringify(localOwner));
        setActiveBranch(branch || 'Sompok');
        return { success: true };
      }
      return { success: false, error: 'Username atau kata sandi Owner salah!' };
    }
  };

  const quickLogin = async (branch: Branch) => {
    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setActiveBranch(branch);
        return { success: true };
      }

      // Standalone fallback untuk kasir 1-klik langsung masuk tanpa password
      const localUser: User = {
        id: `usr_kasir_${branch.toLowerCase()}`,
        username: `kasir.${branch.toLowerCase()}`,
        name: `Kasir Cabang ${branch}`,
        email: `kasir.${branch.toLowerCase()}@tehkota.com`,
        role: 'kasir',
        branch: branch,
      };
      const localToken = `token_kasir_${branch.toLowerCase()}_` + Date.now();
      setToken(localToken);
      setUser(localUser);
      localStorage.setItem(TOKEN_KEY, localToken);
      localStorage.setItem(USER_KEY, JSON.stringify(localUser));
      setActiveBranch(branch);
      return { success: true };
    } catch (err: any) {
      // Masuk langsung jika server offline / hosting static Vercel
      const localUser: User = {
        id: `usr_kasir_${branch.toLowerCase()}`,
        username: `kasir.${branch.toLowerCase()}`,
        name: `Kasir Cabang ${branch}`,
        email: `kasir.${branch.toLowerCase()}@tehkota.com`,
        role: 'kasir',
        branch: branch,
      };
      const localToken = `token_kasir_${branch.toLowerCase()}_` + Date.now();
      setToken(localToken);
      setUser(localUser);
      localStorage.setItem(TOKEN_KEY, localToken);
      localStorage.setItem(USER_KEY, JSON.stringify(localUser));
      setActiveBranch(branch);
      return { success: true };
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
