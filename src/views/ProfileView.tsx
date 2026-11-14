import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BackupSnapshotMeta, Branch, User as AppUser } from '../types';
import { apiFetch } from '../utils/api';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APP_VERSION, APP_RELEASE_DATE, RELEASE_HISTORY } from '../utils/version';
import {
  Mail,
  Store,
  LogOut,
  Smartphone,
  CheckCircle2,
  Database,
  RefreshCw,
  Users,
  KeyRound,
  Download,
  Archive,
  RotateCcw,
  AlertTriangle,
  Plus,
  ShieldCheck,
} from 'lucide-react';

interface ProfileViewProps {
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout }) => {
  const { user, activeBranch, setActiveBranch, logout, isOnline } = useAuth();
  const { isInstalled } = usePWAInstall();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Storage & Health Metadata
  const [storageInfo, setStorageInfo] = useState<{
    mode: string;
    persistentCloud: boolean;
    ephemeralWarning?: boolean;
    initError?: string | null;
    filePath?: string;
    recordsCount?: number;
    transfersCount?: number;
    defaultSecretWarning?: boolean;
  } | null>(null);

  // Owner User Management State
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'kasir' | 'admin'>('kasir');
  const [newBranch, setNewBranch] = useState<Branch>('Sompok');
  const [pwTargetUser, setPwTargetUser] = useState<AppUser | null>(null);
  const [updatedPassword, setUpdatedPassword] = useState('');

  // Owner Backup & Restore State
  const [backups, setBackups] = useState<BackupSnapshotMeta[]>([]);
  const [backupNote, setBackupNote] = useState('');
  const [restoreConfirmTarget, setRestoreConfirmTarget] = useState<BackupSnapshotMeta | null>(null);
  const [adminMessage, setAdminMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isBusyAdmin, setIsBusyAdmin] = useState(false);

  const loadSystemAndAdminData = useCallback(async () => {
    try {
      const hRes = await apiFetch('/api/health');
      if (hRes.ok) {
        const h = await hRes.json();
        setStorageInfo({
          ...(h.storage || { mode: 'json', persistentCloud: false }),
          recordsCount: h.recordsCount,
          transfersCount: h.transfersCount,
          defaultSecretWarning: h.defaultSecretWarning,
        });
      }

      if (user?.role === 'admin') {
        const [uRes, bRes] = await Promise.all([apiFetch('/api/users'), apiFetch('/api/backups')]);
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsersList(uData.users || []);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBackups(bData.backups || []);
        }
      }
    } catch {
      // ignore offline
    }
  }, [user?.role]);

  useEffect(() => {
    loadSystemAndAdminData();
  }, [loadSystemAndAdminData]);

  const handleForceUpdate = async () => {
    setIsRefreshing(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const names = await caches.keys();
        for (const n of names) {
          await caches.delete(n);
        }
      }
    } catch (e) {
      console.warn('Error clearing cache:', e);
    }
    window.location.href = window.location.origin + window.location.pathname + '?update=' + Date.now();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusyAdmin(true);
    setAdminMessage(null);
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          name: newName,
          email: newEmail || undefined,
          password: newPassword,
          role: newRole,
          branch: newRole === 'admin' ? 'All' : newBranch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminMessage({ text: data.error || 'Gagal membuat akun baru', type: 'error' });
        return;
      }
      setAdminMessage({ text: `Akun ${data.user.username} berhasil dibuat.`, type: 'success' });
      setShowAddUser(false);
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      await loadSystemAndAdminData();
    } finally {
      setIsBusyAdmin(false);
    }
  };

  const handleUpdateUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTargetUser) return;
    setIsBusyAdmin(true);
    setAdminMessage(null);
    try {
      const res = await apiFetch(`/api/users/${pwTargetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: updatedPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminMessage({ text: data.error || 'Gagal mengganti kata sandi', type: 'error' });
        return;
      }
      setAdminMessage({ text: `Kata sandi ${pwTargetUser.username} berhasil diperbarui.`, type: 'success' });
      setPwTargetUser(null);
      setUpdatedPassword('');
    } finally {
      setIsBusyAdmin(false);
    }
  };

  const handleToggleUserActive = async (target: AppUser) => {
    if (target.id === user?.id) {
      setAdminMessage({ text: 'Anda tidak dapat menonaktifkan akun Anda sendiri.', type: 'error' });
      return;
    }
    setIsBusyAdmin(true);
    try {
      const res = await apiFetch(`/api/users/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: target.active === false }),
      });
      if (res.ok) {
        setAdminMessage({
          text: `Status akun ${target.username} diperbarui.`,
          type: 'success',
        });
        await loadSystemAndAdminData();
      }
    } finally {
      setIsBusyAdmin(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBusyAdmin(true);
    setAdminMessage(null);
    try {
      const res = await apiFetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: backupNote.trim() || 'Backup manual Owner' }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMessage({ text: 'Snapshot backup database berhasil dibuat.', type: 'success' });
        setBackupNote('');
        await loadSystemAndAdminData();
      } else {
        setAdminMessage({ text: data.error || 'Gagal membuat backup', type: 'error' });
      }
    } finally {
      setIsBusyAdmin(false);
    }
  };

  const handleDownloadBackupJson = async () => {
    setIsBusyAdmin(true);
    try {
      const res = await apiFetch('/api/backups/export');
      if (!res.ok) {
        setAdminMessage({ text: 'Gagal mengunduh file backup JSON', type: 'error' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TehKota_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsBusyAdmin(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmTarget) return;
    setIsBusyAdmin(true);
    try {
      const res = await apiFetch(`/api/backups/${restoreConfirmTarget.id}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMessage({ text: data.message || 'Database berhasil dipulihkan.', type: 'success' });
        setRestoreConfirmTarget(null);
        await loadSystemAndAdminData();
      } else {
        setAdminMessage({ text: data.error || 'Gagal memulihkan backup', type: 'error' });
      }
    } finally {
      setIsBusyAdmin(false);
    }
  };

  const handleLogoutClick = () => {
    logout();
    onLogout();
  };

  return (
    <div className="space-y-5 pb-24 md:pb-8 max-w-2xl mx-auto">
      {/* Admin Feedback Banner */}
      {adminMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            adminMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <span>{adminMessage.text}</span>
          <button onClick={() => setAdminMessage(null)} className="font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#065f46] h-28 relative">
          <div className="absolute -bottom-12 left-6">
            <div className="w-24 h-24 rounded-full bg-white p-1 shadow-xl border-2 border-emerald-400 overflow-hidden flex items-center justify-center">
              <img
                src="/assets/aistudio/image_764559de.png"
                alt="Profil Teh Kota"
                className="w-full h-full object-contain rounded-full bg-white"
              />
            </div>
          </div>
        </div>

        <div className="pt-14 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{user?.email}</span>
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              {user?.role === 'admin' ? 'Owner / Admin' : 'Kasir Resmi'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                Cabang Penugasan
              </span>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <Store className="w-4 h-4 text-emerald-700" />
                <span>
                  {user?.branch === 'All' ? 'Kedua Cabang (Akses Penuh)' : `Cabang ${user?.branch}`}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                Database Pusat &amp; Sinkronisasi
              </span>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    !isOnline || storageInfo?.ephemeralWarning ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                <span>
                  {!isOnline
                    ? 'Offline (Antrean Lokal)'
                    : storageInfo?.persistentCloud
                    ? 'PostgreSQL Cloud Permanen'
                    : storageInfo?.ephemeralWarning
                    ? 'Vercel `/tmp` Sementara (Wajib Set DATABASE_URL)'
                    : 'Server Database Lokal Aktif (Set DATABASE_URL untuk Cloud)'}
                </span>
              </div>
              {storageInfo?.initError && (
                <p className="text-[10px] text-rose-600 mt-1 font-medium">
                  Error DB: {storageInfo.initError}
                </p>
              )}
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Pindah Cabang Aktif (Hak Akses Owner)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Sompok', 'Suyudono'] as Branch[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setActiveBranch(b)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      activeBranch === b
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Cabang {b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OWNER ONLY: USER ACCOUNT & PASSWORD MANAGEMENT */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-800" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Manajemen Akun &amp; Kata Sandi</h3>
                <p className="text-[11px] text-slate-600">
                  Kelola akun Owner dan Kasir cabang dengan enkripsi kata sandi acak (scrypt).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddUser(!showAddUser)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Akun</span>
            </button>
          </div>

          {showAddUser && (
            <form onSubmit={handleCreateUser} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Username login *"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none"
                />
                <input
                  type="text"
                  placeholder="Nama Lengkap *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none"
                />
                <input
                  type="email"
                  placeholder="Email (opsional)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none"
                />
                <input
                  type="password"
                  placeholder="Kata Sandi min 6 karakter *"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'kasir' | 'admin')}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold outline-none"
                >
                  <option value="kasir">Peran: Kasir Cabang</option>
                  <option value="admin">Peran: Owner / Admin</option>
                </select>
                {newRole === 'kasir' && (
                  <select
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value as Branch)}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold outline-none"
                  >
                    <option value="Sompok">Cabang Sompok</option>
                    <option value="Suyudono">Cabang Suyudono</option>
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isBusyAdmin}
                  className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white font-bold disabled:opacity-50"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {usersList.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{u.name}</span>
                    <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      {u.username}
                    </code>
                    {u.active === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {u.role === 'admin' ? 'Owner (Semua Cabang)' : `Kasir Cabang ${u.branch}`} • {u.email}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPwTargetUser(u);
                      setUpdatedPassword('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-semibold"
                  >
                    <KeyRound className="w-3 h-3 text-amber-600" />
                    <span>Ubah Sandi</span>
                  </button>
                  {u.id !== user.id && (
                    <button
                      type="button"
                      disabled={isBusyAdmin}
                      onClick={() => handleToggleUserActive(u)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        u.active === false
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {u.active === false ? 'Aktifkan' : 'Nonaktifkan'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OWNER ONLY: BACKUP & RECOVERY */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-800" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Backup &amp; Pemulihan Database</h3>
                <p className="text-[11px] text-slate-600">
                  Simpan snapshot titik aman database atau unduh arsip lengkap JSON sebelum perubahan besar.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isBusyAdmin}
              onClick={handleDownloadBackupJson}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Unduh JSON</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
              placeholder="Catatan backup (misal: Sebelum tutup buku bulan November)..."
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none"
            />
            <button
              type="button"
              disabled={isBusyAdmin}
              onClick={handleCreateBackup}
              className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 disabled:opacity-50"
            >
              Buat Snapshot Sekarang
            </button>
          </div>

          {backups.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada snapshot backup tersimpan di server.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {backups.map((bk) => (
                <div
                  key={bk.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{bk.note}</div>
                    <div className="text-[11px] text-slate-600">
                      {new Date(bk.createdAt).toLocaleString('id-ID')} • {bk.recordsCount} rekapan, {bk.transfersCount} pengiriman
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusyAdmin}
                    onClick={() => setRestoreConfirmTarget(bk)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Pulihkan</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PWA & Mobile Install Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Aplikasi Kasir Mobile (PWA)</h3>
            <p className="text-xs text-slate-600">
              Instal aplikasi ini di layar utama HP untuk penggunaan cepat tanpa browser bar.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-700">
            {isInstalled ? (
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Aplikasi sudah terpasang di perangkat ini (Mode Standalone)</span>
              </span>
            ) : (
              <span>Tekan tombol untuk memasang ke HP:</span>
            )}
          </div>
          <PWAInstallButton />
        </div>
      </div>

      {/* Version & Update Management Card */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/50 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Manajemen Update Aplikasi &amp; Pembaruan
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-emerald-950">
                  v{APP_VERSION} Terpasang
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Tanggal Rilis: {APP_RELEASE_DATE} • Status: <span className="text-emerald-700 font-bold">Terbaru &amp; Aman</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Riwayat Pembaruan &amp; Fitur Baru:
          </span>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {RELEASE_HISTORY.map((rel) => (
              <div key={rel.version} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Versi {rel.version} ({rel.title})</span>
                  <span className="text-[10px] text-slate-500">{rel.date}</span>
                </div>
                <ul className="space-y-1 text-slate-600 pl-3">
                  {rel.features.map((feat, idx) => (
                    <li key={idx} className="list-disc">{feat}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-2 pt-3">
          <p className="leading-relaxed">
            Jika perangkat kasir belum menampilkan pembaruan versi {APP_VERSION}, tekan tombol ini untuk menyegarkan cache aplikasi tanpa menghapus data rekapan di server.
          </p>
          <button
            type="button"
            onClick={handleForceUpdate}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 text-amber-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Memeriksa & Memperbarui Sistem...' : 'Periksa Pembaruan & Muat Ulang'}</span>
          </button>
        </div>
      </div>

      {/* System Security & Logout */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-700" />
          <span>Informasi Sistem &amp; Keamanan Data</span>
        </h3>

        <div className="text-xs text-slate-600 space-y-2">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Mode Penyimpanan: <strong>{storageInfo?.persistentCloud ? 'Cloud PostgreSQL Terpusat' : 'Server Persistent Storage'}</strong>
              {storageInfo?.recordsCount !== undefined ? ` (${storageInfo.recordsCount} rekapan tersimpan)` : ''}
            </span>
          </p>
          <p>
            • Seluruh rekapan stok, gula pasir (KG), dan pengiriman barang tersimpan terpusat untuk semua perangkat resmi.
          </p>
          <p>
            • Username login: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-800">{user?.username}</code>
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>{user?.role === 'admin' ? 'Keluar dari Akun Owner' : `Keluar dari Akun Kasir (${user?.branch})`}</span>
          </button>
        </div>
      </div>

      {/* Modal: Ubah Kata Sandi Pengguna */}
      {pwTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleUpdateUserPassword} className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Ubah Kata Sandi: {pwTargetUser.username}
            </h3>
            <p className="text-xs text-slate-600">
              Masukkan kata sandi baru minimal 6 karakter untuk akun <strong>{pwTargetUser.name}</strong>.
            </p>
            <input
              type="password"
              value={updatedPassword}
              onChange={(e) => setUpdatedPassword(e.target.value)}
              placeholder="Kata sandi baru..."
              minLength={6}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPwTargetUser(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isBusyAdmin}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-800 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Simpan Sandi Baru
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Konfirmasi Restore Snapshot */}
      {restoreConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Pulihkan Snapshot Backup?</h3>
            <p className="text-xs text-slate-600">
              Data saat ini akan dipulihkan ke kondisi <strong>{restoreConfirmTarget.note}</strong> ({restoreConfirmTarget.recordsCount} rekapan). Sistem otomatis membuat cadangan kondisi sekarang sebelum restore.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmTarget(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isBusyAdmin}
                onClick={handleConfirmRestore}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700"
              >
                Ya, Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
