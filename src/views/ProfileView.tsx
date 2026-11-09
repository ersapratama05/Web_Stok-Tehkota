import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch } from '../types';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  User,
  Mail,
  Store,
  ShieldCheck,
  LogOut,
  Smartphone,
  CheckCircle2,
  Database,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface ProfileViewProps {
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout }) => {
  const { user, activeBranch, setActiveBranch, logout, isOnline } = useAuth();
  const { isInstalled } = usePWAInstall();

  const handleLogoutClick = () => {
    logout();
    onLogout();
  };

  return (
    <div className="space-y-5 pb-24 md:pb-8 max-w-2xl mx-auto">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Cover Strip */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#065f46] h-28 relative">
          <div className="absolute -bottom-12 left-6">
            <div className="w-24 h-24 rounded-full bg-white p-1 shadow-xl border-2 border-emerald-400 overflow-hidden flex items-center justify-center">
              <img
                src="/assets/aistudio/images_b8dc7357.jpg"
                alt="Profil Teh Kota"
                className="w-full h-full object-contain rounded-full bg-white"
              />
            </div>
          </div>
        </div>

        {/* User Info Body */}
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
              {user?.role === 'admin' ? 'Supervisor / Admin' : 'Kasir Resmi'}
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
                Status Koneksi
              </span>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span>{isOnline ? 'Online (Tersinkron)' : 'Offline (Tersimpan Lokal)'}</span>
              </div>
            </div>
          </div>

          {/* Branch Switcher for Admin */}
          {user?.role === 'admin' && (
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Pindah Cabang Aktif (Hak Akses Admin)
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

      {/* PWA & Mobile Install Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Aplikasi Kasir Mobile (PWA)
            </h3>
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

      {/* Account Info & Logout */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-700" />
          <span>Informasi Sistem &amp; Keamanan Data</span>
        </h3>

        <div className="text-xs text-slate-600 space-y-2">
          <p>
            • Seluruh data rekapan stok, formulir CUP, dan pengeluaran tersimpan secara permanen pada server basis data outlet Teh Kota.
          </p>
          <p>
            • Mode offline aktif otomatis jika koneksi terputus dan akan disinkronkan kembali saat online.
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
            <span>Keluar dari Akun Kasir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
