import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch } from '../types';
import { Store, Lock, User, ArrowRight, AlertCircle, Shield, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { login, quickLogin } = useAuth();

  // Loading state for quick 1-click cashier access
  const [quickLoadingBranch, setQuickLoadingBranch] = useState<Branch | null>(null);

  // Owner credentials state - left completely empty by default as requested:
  // "jangan otomatis langung ada biar saya saja yang login"
  const [ownerUsername, setOwnerUsername] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [ownerLoading, setOwnerLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1-Click Direct Cashier Login (No password needed, like a demo mode)
  const handleQuickBranchLogin = async (branch: Branch) => {
    setError(null);
    setQuickLoadingBranch(branch);
    const res = await quickLogin(branch);
    setQuickLoadingBranch(null);

    if (res.success) {
      onLoginSuccess();
    } else {
      setError(res.error || `Gagal masuk ke Cabang ${branch}.`);
    }
  };

  // Owner Login Submit (Requires manual username & password)
  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerUsername.trim() || !ownerPassword.trim()) {
      setError('Silakan masukkan username dan kata sandi Owner.');
      return;
    }

    setOwnerLoading(true);
    // Owner has access to all branches ('All'), default active to Sompok
    const res = await login(ownerUsername.trim(), ownerPassword.trim(), 'Sompok');
    setOwnerLoading(false);

    if (res.success) {
      onLoginSuccess();
    } else {
      setError('Username atau kata sandi Owner salah.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#064e3b] via-[#047857] to-[#022c22] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/40 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header Banner with Official Cup Logo */}
        <div className="bg-[#064e3b] text-white p-6 sm:p-7 text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="w-24 h-24 rounded-full mx-auto mb-3 bg-white p-1 shadow-xl border-3 border-emerald-400 overflow-hidden flex items-center justify-center">
              <img
                src="/assets/aistudio/image_764559de.png"
                alt="Logo Teh Kota"
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icon.svg';
                }}
              />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Rekapan Teh Kota
            </h1>
            <p className="text-xs text-emerald-200 mt-1 font-medium">
              Sistem Operasional Stok &amp; Omset Harian
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* SECTION 1: MASUK LANGSUNG CABANG (KASIR - 1 KLIK TANPA PASSWORD) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Masuk Cabang (Kasir)
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Langsung Masuk
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Klik cabang di bawah untuk langsung membuka rekapan kasir tanpa perlu kata sandi:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Button Cabang Sompok */}
              <button
                type="button"
                onClick={() => handleQuickBranchLogin('Sompok')}
                disabled={quickLoadingBranch !== null || ownerLoading}
                className="group relative p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/90 border-2 border-emerald-600/30 hover:border-emerald-700 text-emerald-950 font-bold transition-all shadow-xs hover:shadow-md active:scale-[0.98] disabled:opacity-50 text-left flex flex-col justify-between"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                    <Store className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-1.5 py-0.5 rounded-md">
                    Kasir
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                    Cabang Sompok
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    {quickLoadingBranch === 'Sompok' ? 'Memuat...' : 'Klik untuk masuk →'}
                  </div>
                </div>
              </button>

              {/* Button Cabang Suyudono */}
              <button
                type="button"
                onClick={() => handleQuickBranchLogin('Suyudono')}
                disabled={quickLoadingBranch !== null || ownerLoading}
                className="group relative p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/90 border-2 border-emerald-600/30 hover:border-emerald-700 text-emerald-950 font-bold transition-all shadow-xs hover:shadow-md active:scale-[0.98] disabled:opacity-50 text-left flex flex-col justify-between"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                    <Store className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-1.5 py-0.5 rounded-md">
                    Kasir
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                    Cabang Suyudono
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    {quickLoadingBranch === 'Suyudono' ? 'Memuat...' : 'Klik untuk masuk →'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* DIVIDER */}
          <div className="relative py-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-3 text-[10px] font-bold tracking-wider uppercase text-slate-600">
              Atau Akses Khusus Owner
            </span>
          </div>

          {/* SECTION 2: LOGIN OWNER (DENGAN KATA SANDI - TIDAK OTOMATIS) */}
          <form onSubmit={handleOwnerSubmit} className="space-y-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Login Owner / Supervisor
                </h3>
                <p className="text-[11px] text-slate-500">
                  Wajib menggunakan kata sandi untuk mengelola kedua cabang
                </p>
              </div>
            </div>

            {/* Input Username Owner - Blank by default */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username Owner
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ownerUsername}
                  onChange={(e) => setOwnerUsername(e.target.value)}
                  placeholder="Masukkan username Owner"
                  autoComplete="off"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-white text-slate-900"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Input Password Owner - Blank by default */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kata Sandi Owner
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Masukkan kata sandi Owner"
                  autoComplete="off"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-white text-slate-900"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Submit Button Owner */}
            <button
              type="submit"
              disabled={ownerLoading || quickLoadingBranch !== null}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-[0.99] disabled:opacity-50 mt-1 cursor-pointer"
            >
              {ownerLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Masuk sebagai Owner</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
