import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Branch, User, RekapRecord } from '../types';
import { clearSyncQueue, getSyncQueue, saveRecordToLocal, setCachedRecords, getCachedRecords } from '../utils/storage';

export type CentralSyncStatus = 'connected' | 'saving' | 'saved' | 'offline' | 'error';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeBranch: Branch;
  setActiveBranch: (branch: Branch) => void;
  login: (username: string, password: string, branch?: Branch) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (branch: Branch) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isOnline: boolean;
  syncStatus: CentralSyncStatus;
  setSyncStatus: (status: CentralSyncStatus) => void;
  lastSavedTime: string | null;
  setLastSavedTime: (time: string) => void;
  syncNotice: string | null;
  setSyncNotice: (notice: string | null) => void;
  triggerSync: () => Promise<number>;
  refreshCentralData: () => Promise<void>;
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
  const [syncStatus, setSyncStatus] = useState<CentralSyncStatus>('connected');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const lastSyncTimestampRef = useRef<string>(new Date().toISOString());

  // SSE EventSource & Polling setup
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const setupSSE = () => {
      if (!isOnline) {
        setSyncStatus('offline');
        return;
      }

      try {
        eventSource = new EventSource(`/api/sync/stream?branch=${activeBranch}`);

        eventSource.onopen = () => {
          setSyncStatus('connected');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'record_created' || data.event === 'record_updated') {
              if (data.record) {
                saveRecordToLocal(data.record);
                const editor = data.editedBy || 'Pengguna lain';
                const actionText = data.event === 'record_updated' ? 'memperbarui' : 'menginput';
                setSyncNotice(`${editor} baru saja ${actionText} rekapan Cabang ${data.branch} (${data.date}).`);
                setTimeout(() => setSyncNotice(null), 5000);
              }
              setSyncStatus('saved');
              setLastSavedTime(new Date().toLocaleTimeString('id-ID'));
              window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: data }));
            } else if (data.event === 'record_deleted' || data.event === 'batch_sync') {
              setSyncStatus('saved');
              window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: data }));
            }
          } catch {}
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          // Retry after 5s
          reconnectTimer = setTimeout(setupSSE, 5000);
        };
      } catch {
        // Fallback to polling
      }
    };

    // Periodic poll as redundant multi-device guarantee
    const pollUpdates = async () => {
      if (!isOnline) return;
      try {
        const res = await fetch(`/api/sync/poll?branch=${activeBranch}&since=${encodeURIComponent(lastSyncTimestampRef.current)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.serverTime) {
            lastSyncTimestampRef.current = json.serverTime;
          }
          if (Array.isArray(json.records) && json.records.length > 0) {
            for (const rec of json.records) {
              saveRecordToLocal(rec);
            }
            window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: { event: 'poll_update', records: json.records } }));
          }
        }
      } catch {}
    };

    setupSSE();
    pollTimer = setInterval(pollUpdates, 10000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [activeBranch, isOnline]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('connected');
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

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        return { success: false, error: (data && data.error) || 'Username atau kata sandi salah' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      const assignedBranch = (data.user.branch !== 'All' ? data.user.branch : (branch || 'Sompok')) as Branch;
      setActiveBranch(assignedBranch);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal terhubung ke server API' };
    }
  };

  const quickLogin = async (branch: Branch) => {
    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        return { success: false, error: (data && data.error) || `Gagal masuk ke Cabang ${branch}` };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setActiveBranch(branch);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal terhubung ke server API' };
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

  const refreshCentralData = async (): Promise<void> => {
    try {
      setSyncStatus('saving');
      const res = await fetch(`/api/records?branch=${activeBranch}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.records)) {
          setCachedRecords(json.records);
          setSyncStatus('saved');
          setLastSavedTime(new Date().toLocaleTimeString('id-ID'));
          window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: { event: 'manual_refresh', records: json.records } }));
        }
      }
    } catch {
      setSyncStatus('error');
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
        syncNotice,
        setSyncNotice,
        triggerSync,
        refreshCentralData,
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
