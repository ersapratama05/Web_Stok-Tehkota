import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Branch, User } from '../types';
import { clearSyncQueue, getSyncQueue, saveRecordToLocal, setCachedRecords } from '../utils/storage';
import { apiFetch } from '../utils/api';
import { getJakartaTimeStr } from '../utils/calculations';

export type CentralSyncStatus = 'connected' | 'saving' | 'saved' | 'offline' | 'error';

export interface StorageHealthInfo {
  mode: 'postgresql' | 'file' | string;
  isVercel?: boolean;
  hasDatabaseUrl?: boolean;
  persistentCloud: boolean;
  ephemeralWarning?: boolean;
  initError?: string | null;
}

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
  storageHealth: StorageHealthInfo | null;
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
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => `${getJakartaTimeStr()} WIB`);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealthInfo | null>(null);
  const lastSyncTimestampRef = useRef<string | null>(null);

  // Check backend storage health on boot
  useEffect(() => {
    if (!isOnline) return;
    apiFetch('/api/health')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.storage) {
            setStorageHealth(data.storage);
          }
        }
      })
      .catch(() => {});
  }, [isOnline]);

  // Validate session on boot if token exists
  useEffect(() => {
    if (!token || !isOnline) return;
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (res.status === 401) {
          logout();
        } else if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.user) {
            setUser(json.user);
            localStorage.setItem(USER_KEY, JSON.stringify(json.user));
          }
        }
      })
      .catch(() => {});
  }, [token]);

  // SSE EventSource & Fast Polling setup
  useEffect(() => {
    if (!user || !token) return;

    let eventSource: EventSource | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let disposed = false;

    const pollUpdates = async (forceFull = false) => {
      if (!isOnline || !token || disposed) return;
      try {
        // Owner always monitors All branches so Sompok & Suyudono updates arrive in real time
        const pollBranch = user.role === 'admin' ? 'All' : user.branch;
        const sinceParam = !forceFull && lastSyncTimestampRef.current
          ? `&since=${encodeURIComponent(lastSyncTimestampRef.current)}`
          : '';
        const res = await apiFetch(`/api/sync/poll?branch=${encodeURIComponent(pollBranch)}${sinceParam}`);
        if (res.status === 401) {
          logout();
          return;
        }
        if (res.ok) {
          const json = await res.json();
          const wasInitialized = Boolean(lastSyncTimestampRef.current);
          if (json.serverTime) {
            lastSyncTimestampRef.current = json.serverTime;
          }

          if (json.hasDeletions) {
            await refreshCentralData();
          } else if (Array.isArray(json.records) && json.records.length > 0) {
            if (!wasInitialized) {
              setCachedRecords(json.records);
            } else {
              for (const rec of json.records) {
                saveRecordToLocal(rec);
              }
              const latest = json.records[0];
              const editor = latest?.lastEditedBy || latest?.createdBy || 'Perangkat lain';
              setSyncNotice(
                `Data terbaru Cabang ${latest.branch} (${latest.date}) diperbarui oleh ${editor}.`
              );
              setTimeout(() => setSyncNotice(null), 5000);
            }
            setSyncStatus('saved');
            setLastSavedTime(`${getJakartaTimeStr()} WIB`);
            window.dispatchEvent(
              new CustomEvent('tehkota:sync-record', { detail: { event: 'poll_update', records: json.records } })
            );
          } else {
            setLastSavedTime(`${getJakartaTimeStr()} WIB`);
          }

          if (Array.isArray(json.transfers) && json.transfers.length > 0) {
            if (wasInitialized) {
              setSyncStatus('saved');
              setLastSavedTime(`${getJakartaTimeStr()} WIB`);
            }
            window.dispatchEvent(
              new CustomEvent('tehkota:sync-transfer', { detail: { event: 'poll_update', transfers: json.transfers } })
            );
          }
        }
      } catch {
        // Keep silent retry on transient poll error
      }
    };

    const setupSSE = () => {
      if (!isOnline || disposed) {
        setSyncStatus('offline');
        return;
      }

      try {
        const sseBranch = user.role === 'admin' ? 'All' : user.branch;
        const sseUrl = `/api/sync/stream?branch=${encodeURIComponent(
          sseBranch
        )}&token=${encodeURIComponent(token)}`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          setSyncStatus('connected');
          pollUpdates(false);
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
              if (data.timestamp) lastSyncTimestampRef.current = data.timestamp;
              setSyncStatus('saved');
              setLastSavedTime(`${getJakartaTimeStr()} WIB`);
              window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: data }));
            } else if (
              data.event === 'transfer_created' ||
              data.event === 'transfer_confirmed' ||
              data.event === 'transfer_cancelled'
            ) {
              const tr = data.transfer;
              if (tr) {
                const msgMap: Record<string, string> = {
                  transfer_created: `Pengiriman baru ${tr.transferNumber} dari Cabang ${tr.senderBranch} ke ${tr.receiverBranch}.`,
                  transfer_confirmed: `Pengiriman ${tr.transferNumber} telah dikonfirmasi (${tr.status}) oleh ${tr.receiverName || tr.receiverBranch}.`,
                  transfer_cancelled: `Pengiriman ${tr.transferNumber} dibatalkan.`,
                };
                setSyncNotice(msgMap[data.event] || 'Data pengiriman barang diperbarui.');
                setTimeout(() => setSyncNotice(null), 6000);
              }
              if (data.timestamp) lastSyncTimestampRef.current = data.timestamp;
              setSyncStatus('saved');
              setLastSavedTime(`${getJakartaTimeStr()} WIB`);
              window.dispatchEvent(new CustomEvent('tehkota:sync-transfer', { detail: data }));
              window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: data }));
            } else if (data.event === 'record_deleted' || data.event === 'batch_sync') {
              if (data.timestamp) lastSyncTimestampRef.current = data.timestamp;
              setSyncStatus('saved');
              setLastSavedTime(`${getJakartaTimeStr()} WIB`);
              refreshCentralData();
            }
          } catch {}
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          if (!disposed) {
            reconnectTimer = setTimeout(setupSSE, 6000);
          }
        };
      } catch {
        // Fallback purely to 5s polling (e.g. serverless Vercel)
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        pollUpdates(false);
      }
    };

    // Initial full sync immediately + 5-second reliable polling across devices
    pollUpdates(true);
    setupSSE();
    pollTimer = setInterval(() => pollUpdates(false), 5000);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      disposed = true;
      if (eventSource) eventSource.close();
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isOnline, user?.id, user?.role, user?.branch, token]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('connected');
      triggerSync();
      refreshCentralData();
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
    if (user && user.role !== 'admin' && user.branch !== 'All' && user.branch !== b) {
      return;
    }
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

      setCachedRecords([]);
      lastSyncTimestampRef.current = null;
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      const assignedBranch = (data.user.branch !== 'All' ? data.user.branch : branch || 'Sompok') as Branch;
      setActiveBranchState(assignedBranch);
      localStorage.setItem(BRANCH_KEY, assignedBranch);
      setLastSavedTime(`${getJakartaTimeStr()} WIB`);
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

      setCachedRecords([]);
      lastSyncTimestampRef.current = null;
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setActiveBranchState(branch);
      localStorage.setItem(BRANCH_KEY, branch);
      setLastSavedTime(`${getJakartaTimeStr()} WIB`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal terhubung ke server API' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    lastSyncTimestampRef.current = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setCachedRecords([]);
  };

  const triggerSync = async (): Promise<number> => {
    const queue = getSyncQueue();
    if (queue.length === 0) return 0;

    try {
      setSyncStatus('saving');
      const res = await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue }),
      });

      if (res.ok) {
        const data = await res.json();
        clearSyncQueue();
        if (Array.isArray(data.records)) {
          for (const rec of data.records) {
            saveRecordToLocal(rec);
          }
        }
        setSyncStatus('saved');
        setLastSavedTime(`${getJakartaTimeStr()} WIB`);
        window.dispatchEvent(new CustomEvent('tehkota:sync-record', { detail: { event: 'batch_sync' } }));
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
      const branchQuery = user?.role === 'admin' ? 'All' : user?.branch || activeBranch;
      const res = await apiFetch(`/api/records?branch=${encodeURIComponent(branchQuery)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.records)) {
          setCachedRecords(json.records);
          setSyncStatus('saved');
          setLastSavedTime(`${getJakartaTimeStr()} WIB`);
          window.dispatchEvent(
            new CustomEvent('tehkota:sync-record', { detail: { event: 'manual_refresh', records: json.records } })
          );
          window.dispatchEvent(new CustomEvent('tehkota:sync-transfer', { detail: { event: 'manual_refresh' } }));
        }
      } else {
        setSyncStatus('error');
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
        storageHealth,
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
