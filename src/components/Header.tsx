import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch } from '../types';
import { Wifi, WifiOff, Clock, Store, ChevronDown, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProfile }) => {
  const { user, activeBranch, setActiveBranch, isOnline, syncStatus, lastSavedTime, logout } = useAuth();
  const [wibTime, setWibTime] = useState<string>('');
  const [branchDropdown, setBranchDropdown] = useState(false);

  // Live real-time WIB clock (ticking every 1s)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format with WIB (UTC+7)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const timeFormatter = new Intl.DateTimeFormat('id-ID', options);
      setWibTime(`${timeFormatter.format(now)} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBranchSelect = (b: Branch) => {
    setActiveBranch(b);
    setBranchDropdown(false);
  };

  const getSyncBadge = () => {
    if (!isOnline) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-md border border-amber-500/30">
          <WifiOff className="w-3 h-3 text-amber-400" />
          <span>Offline (Lokal)</span>
        </span>
      );
    }
    if (syncStatus === 'saving') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-blue-200 bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-500/30 animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin text-blue-300" />
          <span>Menyimpan...</span>
        </span>
      );
    }
    if (syncStatus === 'error') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-rose-200 bg-rose-900/40 px-2 py-0.5 rounded-md border border-rose-500/30">
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span>Gagal Sinkron</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-200 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-600/30">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>Tersimpan {lastSavedTime ? `(${lastSavedTime})` : ''}</span>
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-[#064e3b] text-white shadow-md border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-white border-2 border-emerald-400 shadow-sm shrink-0 flex items-center justify-center p-0.5">
            <img
              src="/assets/aistudio/images_b8dc7357.jpg"
              alt="Logo Teh Kota"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                // fallback to SVG icon if image not reachable
                (e.target as HTMLImageElement).src = '/icon.svg';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-white leading-none">
                Teh Kota
              </h1>
              <span className="hidden xs:inline-block text-[10px] tracking-wider uppercase font-bold bg-amber-400 text-emerald-950 px-1.5 py-0.5 rounded font-sans">
                Kasir
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-200 font-medium">
              Rekapan Harian Cabang
            </p>
          </div>
        </div>

        {/* Center: Live WIB Clock & Sync Badge */}
        <div className="hidden md:flex flex-col items-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-100 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-700/50">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="tabular-nums">{wibTime}</span>
          </div>
          <div className="mt-1">{getSyncBadge()}</div>
        </div>

        {/* Right Zone: Branch Selector & Profile */}
        <div className="flex items-center gap-2">
          {/* Branch Dropdown */}
          <div className="relative">
            <button
              onClick={() => user?.role === 'admin' && setBranchDropdown(!branchDropdown)}
              disabled={user?.role !== 'admin'}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                user?.role === 'admin'
                  ? 'bg-emerald-800 hover:bg-emerald-700 cursor-pointer border border-emerald-600'
                  : 'bg-emerald-950/70 border border-emerald-800 cursor-default'
              }`}
              title={user?.role === 'admin' ? 'Klik untuk mengganti cabang' : `Terkunci di Cabang ${activeBranch}`}
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white font-bold">{activeBranch}</span>
              {user?.role === 'admin' && <ChevronDown className="w-3.5 h-3.5 text-emerald-300" />}
            </button>

            {branchDropdown && user?.role === 'admin' && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-100">
                  Ganti Akses Cabang
                </div>
                {(['Sompok', 'Suyudono'] as Branch[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => handleBranchSelect(b)}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-emerald-50 ${
                      activeBranch === b ? 'text-emerald-700 bg-emerald-50/60 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span>Cabang {b}</span>
                    {activeBranch === b && <span className="text-emerald-600">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* In-App PWA Install Button */}
          <PWAInstallButton />

          {/* Profile Trigger */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
            title="Buka Profil"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-emerald-400 shrink-0">
              <img
                src="/assets/aistudio/images_b8dc7357.jpg"
                alt="Avatar"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <span className="hidden sm:inline-block max-w-[90px] truncate">{user?.name}</span>
          </button>
        </div>
      </div>

      {/* Mobile Sub-strip: live time & sync status for mobile screen */}
      <div className="md:hidden px-3 py-1 bg-emerald-950/80 border-t border-emerald-800/60 flex items-center justify-between text-[11px] text-emerald-200">
        <div className="flex items-center gap-1.5 tabular-nums font-medium">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{wibTime}</span>
        </div>
        <div>{getSyncBadge()}</div>
      </div>
    </header>
  );
};
