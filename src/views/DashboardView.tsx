import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch, DashboardStats, RekapRecord } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/calculations';
import { clearBranchDrafts, computeLocalDashboardStats, getCachedRecords, setCachedRecords, saveRecordToLocal } from '../utils/storage';
import {
  TrendingUp,
  Wallet,
  CalendarCheck,
  PlusCircle,
  FileBarChart,
  Sparkles,
  ChevronRight,
  Store,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToRekap: (date?: string) => void;
  onNavigateToLaporan: () => void;
  onNavigateToAi: () => void;
  onViewRecordDetail: (record: RekapRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToRekap,
  onNavigateToLaporan,
  onNavigateToAi,
  onViewRecordDetail,
}) => {
  const { user, activeBranch, setActiveBranch } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/dashboard?branch=${activeBranch}`, {
        cache: 'no-store',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStats(data);
        if (data.recentRekapan && Array.isArray(data.recentRekapan)) {
          for (const rec of data.recentRekapan) {
            saveRecordToLocal(rec);
          }
        }
        return;
      }
      // Fallback lokal jika API server tidak merespon JSON (misal static Vercel)
      const localStats = computeLocalDashboardStats(activeBranch);
      setStats(localStats);
    } catch {
      // Fallback lokal tanpa melempar error
      const localStats = computeLocalDashboardStats(activeBranch);
      setStats(localStats);
    } finally {
      setLoading(false);
    }
  };

  const handleResetBranch = async (branchToReset: Branch) => {
    const confirmMsg = `Yakin ingin mereset seluruh rekapan Cabang ${branchToReset} menjadi 0? Tindakan ini akan mengosongkan semua riwayat rekapan dan draf untuk cabang ini.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsResetting(true);
      clearBranchDrafts(branchToReset);
      const remaining = getCachedRecords().filter((r) => r.branch !== branchToReset);
      setCachedRecords(remaining);

      try {
        await fetch('/api/records/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: branchToReset }),
        });
      } catch {
        // Abaikan jika server offline
      }

      setResetMessage(`Rekapan Cabang ${branchToReset} berhasil di-reset menjadi 0.`);
      await fetchDashboardData();
      setTimeout(() => setResetMessage(null), 4000);
    } catch (err: any) {
      alert('Gagal mereset rekapan: ' + (err.message || 'Koneksi error'));
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeBranch]);

  // Real-time synchronization listener across connected devices
  useEffect(() => {
    const handleSync = () => {
      fetchDashboardData();
    };
    window.addEventListener('tehkota:sync-record', handleSync);
    return () => window.removeEventListener('tehkota:sync-record', handleSync);
  }, [activeBranch]);

  // Current month label (e.g. "November 2026")
  const currentMonthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {/* Reset Notification Message */}
      {resetMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-semibold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{resetMessage}</span>
          </div>
          <button
            onClick={() => setResetMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner / Hero Card with Teh Kota Logo & Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#065f46] text-white p-5 sm:p-7 shadow-lg">
        {/* Soft background glow */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Teh Kota Official Photo / Circular Badge for both branches */}
        <div className="absolute right-4 sm:right-7 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-white p-1.5 shadow-2xl border-4 border-emerald-400/80 flex items-center justify-center overflow-hidden">
            <img
              src="/assets/aistudio/image_764559de.png"
              alt="Logo Resmi Teh Kota"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
        </div>

        <div className="relative z-10 max-w-[calc(100%-92px)] sm:max-w-md md:max-w-xl">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-400 text-emerald-950">
              Outlet Aktif: Cabang {activeBranch}
            </span>
            <span className="text-xs text-emerald-200">
              {currentMonthLabel}
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Halo, {user?.role === 'admin' ? (user?.name ? `${user.name} (${activeBranch})` : `Owner (${activeBranch})`) : (user?.name && user.name !== 'Kasir' && user.name !== 'Budi Santoso' ? user.name : `Kasir ${user?.branch && user.branch !== 'All' ? user.branch : activeBranch}`)} 👋
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
            Selamat bertugas! Kelola rekapan stok masuk, stok keluar, pengeluaran harian, dan pantau omset bersih outlet dengan akurat.
          </p>

          {/* Branch Switcher Pill Bar (if Admin) */}
          {user?.role === 'admin' && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-emerald-200">Pilih Cabang:</span>
              {(['Sompok', 'Suyudono'] as Branch[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setActiveBranch(b)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeBranch === b
                      ? 'bg-amber-400 text-emerald-950 shadow-sm'
                      : 'bg-emerald-900/60 text-emerald-100 hover:bg-emerald-900'
                  }`}
                >
                  Cabang {b}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards: Omset Kotor, Omset Bersih, Rekapan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Total Omset Kotor */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Omset Kotor Bulan Ini
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats ? formatRupiah(stats.totalOmsetKotor) : '...'}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Total penerimaan kasir &amp; QRIS
          </p>
        </div>

        {/* Card 2: Total Omset Bersih */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Omset Bersih Bulan Ini
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums font-mono">
            {stats ? formatRupiah(stats.totalOmsetBersih) : '...'}
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-1">
            Total Omset - Pengeluaran - QRIS
          </p>
        </div>

        {/* Card 3: Jumlah Rekapan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Jumlah Rekapan
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {stats ? `${stats.rekapCount} Hari` : '...'}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Tersimpan pada bulan {currentMonthLabel}
          </p>
        </div>
      </div>

      {/* 3 Quick Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onNavigateToRekap()}
          className="flex items-center justify-between p-4 rounded-xl bg-[#064e3b] text-white hover:bg-[#047857] shadow-sm transition active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Buat Rekapan Hari Ini</div>
              <div className="text-[11px] text-emerald-200">Input stok &amp; pengeluaran</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-emerald-300 group-hover:text-amber-400 transition-colors" />
        </button>

        <button
          onClick={onNavigateToLaporan}
          className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-emerald-600 hover:bg-emerald-50/30 shadow-sm transition active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Laporan Bulanan</div>
              <div className="text-[11px] text-slate-600">Grafik tren &amp; riwayat harian</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-700 transition-colors" />
        </button>

        <button
          onClick={onNavigateToAi}
          className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-amber-500 hover:bg-amber-50/30 shadow-sm transition active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Analisis Rekapan AI</div>
              <div className="text-[11px] text-slate-600">Deteksi stok &amp; perbandingan</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-amber-600 transition-colors" />
        </button>
      </div>

      {/* 7 Rekapan Terakhir */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-700" />
              <span>Daftar 7 Rekapan Terakhir</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Riwayat rekapan terbaru di Cabang {activeBranch}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResetBranch('Sompok')}
              disabled={isResetting}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
              title="Reset seluruh rekapan Cabang Sompok ke 0"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset Rekapan Sompok</span>
            </button>
            <button
              onClick={fetchDashboardData}
              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition"
              title="Segarkan data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-600">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
            Memuat data rekapan...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-600">
            {error}
          </div>
        ) : !stats?.recentRekapan || stats.recentRekapan.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-600">
            Belum ada rekapan di Cabang {activeBranch}.
            <div className="mt-3">
              <button
                onClick={() => onNavigateToRekap()}
                className="px-3.5 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
              >
                Mulai Buat Rekapan
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats.recentRekapan.map((record) => (
              <div
                key={record.id}
                onClick={() => onViewRecordDetail(record)}
                className="p-3.5 sm:p-4 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex flex-col items-center justify-center shrink-0 border border-emerald-100">
                    <span className="text-[10px] text-emerald-600 uppercase">
                      {new Date(record.date).toLocaleDateString('id-ID', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold">
                      {new Date(record.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                      {formatDateIndo(record.date)}
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                      <span>Kasir: {record.createdBy}</span>
                      <span>•</span>
                      <span>Omset Kotor: {formatRupiah(record.totalOmset)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs sm:text-sm font-bold text-emerald-700 font-mono">
                      {formatRupiah(record.omsetAkhir)}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {record.status === 'draft' ? (
                        <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Draf</span>
                      ) : (
                        <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Selesai</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
