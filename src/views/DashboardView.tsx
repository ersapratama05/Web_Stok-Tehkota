import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch, DashboardStats, OwnerSummaryData, RekapRecord } from '../types';
import { apiFetch } from '../utils/api';
import { formatRupiah, formatDateIndo, getCurrentMonthStr, getTodayDateStr, getYesterdayDateStr } from '../utils/calculations';
import { clearBranchDrafts, computeLocalDashboardStats, getCachedRecords, setCachedRecords, saveRecordToLocal } from '../utils/storage';
import {
  TrendingUp,
  Wallet,
  CalendarCheck,
  PlusCircle,
  FileBarChart,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Scale,
  Coffee,
  History,
  Store,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToRekap: (date?: string) => void;
  onNavigateToLaporan: () => void;
  onNavigateToAi: () => void;
  onNavigateToPengiriman?: () => void;
  onViewRecordDetail: (record: RekapRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToRekap,
  onNavigateToLaporan,
  onNavigateToAi,
  onNavigateToPengiriman,
  onViewRecordDetail,
}) => {
  const { user, activeBranch, setActiveBranch } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummaryData | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState<'today' | 'yesterday' | '7days' | '30days' | 'month' | 'custom'>('month');
  const [summaryMonth, setSummaryMonth] = useState<string>(getCurrentMonthStr());
  const [customStart, setCustomStart] = useState<string>(getYesterdayDateStr());
  const [customEnd, setCustomEnd] = useState<string>(getTodayDateStr());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetTargetBranch, setResetTargetBranch] = useState<Branch | null>(null);
  const [resetMessage, setResetMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const branchRes = await apiFetch(`/api/dashboard?branch=${activeBranch}`);
      const contentType = branchRes.headers.get('content-type') || '';
      if (branchRes.ok && contentType.includes('application/json')) {
        const data = await branchRes.json();
        setStats(data);
        if (data.recentRekapan && Array.isArray(data.recentRekapan)) {
          for (const rec of data.recentRekapan) {
            saveRecordToLocal(rec);
          }
        }
      } else if (!navigator.onLine) {
        setStats(computeLocalDashboardStats(activeBranch));
      } else {
        const errJson = await branchRes.json().catch(() => null);
        setError(errJson?.error || 'Gagal mengambil data terbaru dari database pusat.');
      }

      if (user?.role === 'admin') {
        const params = new URLSearchParams({ period: summaryPeriod });
        if (summaryPeriod === 'month') params.set('month', summaryMonth);
        if (summaryPeriod === 'custom') {
          params.set('startDate', customStart);
          params.set('endDate', customEnd);
        }
        const ownerRes = await apiFetch(`/api/dashboard/owner-summary?${params.toString()}`);
        if (ownerRes.ok) {
          const oData = await ownerRes.json();
          setOwnerSummary(oData);
        }
      }
    } catch {
      if (!navigator.onLine) {
        setStats(computeLocalDashboardStats(activeBranch));
      } else {
        setError('Koneksi ke server pusat terputus. Coba muat ulang.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeBranch, user?.role, summaryPeriod, summaryMonth, customStart, customEnd]);

  const executeResetBranch = async () => {
    if (!resetTargetBranch) return;
    const branchToReset = resetTargetBranch;
    setResetTargetBranch(null);

    try {
      setIsResetting(true);
      const res = await apiFetch('/api/records/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: branchToReset }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResetMessage({ text: data?.error || 'Gagal mereset rekapan.', type: 'error' });
        return;
      }

      clearBranchDrafts(branchToReset);
      const remaining = getCachedRecords().filter((r) => r.branch !== branchToReset);
      setCachedRecords(remaining);

      setResetMessage({
        text: data?.message || `Rekapan Cabang ${branchToReset} berhasil di-reset.`,
        type: 'success',
      });
      await fetchDashboardData();
      setTimeout(() => setResetMessage(null), 5000);
    } catch (err: any) {
      setResetMessage({ text: 'Gagal mereset rekapan: ' + (err.message || 'Koneksi error'), type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time synchronization listener across connected devices
  useEffect(() => {
    const handleSync = () => {
      fetchDashboardData();
    };
    window.addEventListener('tehkota:sync-record', handleSync);
    window.addEventListener('tehkota:sync-transfer', handleSync);
    return () => {
      window.removeEventListener('tehkota:sync-record', handleSync);
      window.removeEventListener('tehkota:sync-transfer', handleSync);
    };
  }, [fetchDashboardData]);

  const currentMonthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const totalCombinedGross = ownerSummary?.combined.omsetKotor || 0;
  const sompokShare =
    totalCombinedGross > 0
      ? Math.round(((ownerSummary?.sompok.omsetKotor || 0) / totalCombinedGross) * 100)
      : 50;
  const suyudonoShare = totalCombinedGross > 0 ? 100 - sompokShare : 50;

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {error && (
        <div className="p-3.5 border rounded-xl bg-rose-50 border-rose-300 text-rose-900 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            className="px-2.5 py-1 rounded-lg bg-rose-700 text-white hover:bg-rose-800 text-[11px] font-bold"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Reset Notification Message */}
      {resetMessage && (
        <div
          className={`p-3.5 border rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs ${
            resetMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {resetMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{resetMessage.text}</span>
          </div>
          <button
            onClick={() => setResetMessage(null)}
            className="font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner / Hero Card with Teh Kota Official Circular Logo & Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#065f46] text-white p-5 sm:p-7 shadow-lg">
        <div className="absolute right-6 top-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

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
            Halo, {user?.role === 'admin' ? `${user?.name || 'Owner'} (${activeBranch})` : (user?.name || `Kasir ${activeBranch}`)} 👋
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
            Selamat bertugas! Kelola rekapan stok masuk, stok keluar, pemakaian gula pasir, pengiriman antarcabang, dan omset bersih outlet dengan akurat.
          </p>

          {user?.role === 'admin' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-emerald-200">Cabang Fokus:</span>
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

      {/* OWNER MULTI-BRANCH COMMAND CENTER (Visible strictly for Owner / admin) */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-2xl border-2 border-emerald-600/40 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-400 text-emerald-950">
                  Owner Command Center
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Ringkasan Gabungan Sompok &amp; Suyudono
                </h3>
              </div>
              {ownerSummary && (
                <p className="text-xs text-slate-600 mt-0.5">
                  Periode Data: <strong>{ownerSummary.startDate}</strong> s/d <strong>{ownerSummary.endDate}</strong>
                </p>
              )}
            </div>

            {/* Owner Summary Period Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'yesterday', label: 'Kemarin' },
                { id: '7days', label: '7 Hari' },
                { id: '30days', label: '30 Hari' },
                { id: 'month', label: 'Bulanan' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSummaryPeriod(p.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    summaryPeriod === p.id
                      ? 'bg-[#064e3b] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {summaryPeriod === 'month' && (
                <input
                  type="month"
                  value={summaryMonth}
                  onChange={(e) => setSummaryMonth(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 outline-none"
                />
              )}
              {summaryPeriod === 'custom' && (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 outline-none"
                  />
                  <span className="text-xs text-slate-500">-</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {ownerSummary && (
            <>
              {/* Combined Totals Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Gabungan Kotor</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatRupiah(ownerSummary.combined.omsetKotor)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Gabungan Bersih</span>
                  <span className="text-sm font-extrabold text-emerald-800 font-mono">
                    {formatRupiah(ownerSummary.combined.omsetBersih)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">Pengeluaran</span>
                  <span className="text-sm font-extrabold text-rose-700 font-mono">
                    {formatRupiah(ownerSummary.combined.pengeluaran)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-800 uppercase block">Total QRIS</span>
                  <span className="text-sm font-extrabold text-blue-700 font-mono">
                    {formatRupiah(ownerSummary.combined.qris)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-900 uppercase block flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Total Gula
                  </span>
                  <span className="text-sm font-extrabold text-amber-900 font-mono">
                    {ownerSummary.combined.totalGulaHabis} KG
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                  <span className="text-[10px] font-bold text-teal-800 uppercase block flex items-center gap-1">
                    <Coffee className="w-3 h-3" /> Cup Terjual
                  </span>
                  <span className="text-sm font-extrabold text-teal-900 font-mono">
                    {ownerSummary.combined.totalCupTerjual.toLocaleString('id-ID')} cup
                  </span>
                </div>
              </div>

              {/* Visual Omset Comparison Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span className="text-emerald-800">Sompok: {sompokShare}%</span>
                  <span>Porsi Omset Kotor Antarcabang</span>
                  <span className="text-amber-700">Suyudono: {suyudonoShare}%</span>
                </div>
                <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200">
                  <div
                    style={{ width: `${sompokShare}%` }}
                    className="bg-emerald-700 transition-all duration-300"
                  />
                  <div
                    style={{ width: `${suyudonoShare}%` }}
                    className="bg-amber-400 transition-all duration-300"
                  />
                </div>
              </div>

              {/* Side-by-Side Branch Cards: Sompok vs Suyudono */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {[ownerSummary.sompok, ownerSummary.suyudono].map((bStats) => (
                  <div
                    key={bStats.branch}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-emerald-800" />
                        <span className="text-sm font-bold text-slate-900">Cabang {bStats.branch}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveBranch(bStats.branch)}
                        className="text-[11px] font-bold text-emerald-800 hover:underline"
                      >
                        {activeBranch === bStats.branch ? 'Sedang Dipilih' : 'Fokus Cabang Ini'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Omset Kotor</span>
                        <strong className="font-mono text-slate-900">{formatRupiah(bStats.omsetKotor)}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-emerald-700 block">Omset Bersih</span>
                        <strong className="font-mono text-emerald-800">{formatRupiah(bStats.omsetBersih)}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Gula • Cup</span>
                        <strong className="font-mono text-slate-800">
                          {bStats.totalGulaHabis} KG • {bStats.totalCupTerjual} cup
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">IN / OUT Barang</span>
                        <strong className="font-mono text-slate-800">
                          +{bStats.totalInQty} / -{bStats.totalOutQty}
                        </strong>
                      </div>
                    </div>

                    {bStats.lowStockItems.length > 0 && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-900">
                        <strong className="block text-rose-800 mb-0.5">Stok Menipis ({bStats.branch}):</strong>
                        <div className="flex flex-wrap gap-1">
                          {bStats.lowStockItems.map((ls) => (
                            <span
                              key={ls.name}
                              className="bg-white border border-rose-200 px-1.5 py-0.5 rounded font-semibold"
                            >
                              {ls.name}: {ls.st} {ls.unit}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pending Transfers & Recent Audit Logs Strip */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-blue-700" />
                      Pengiriman Antarcabang Terbaru
                    </span>
                    {onNavigateToPengiriman && (
                      <button
                        type="button"
                        onClick={onNavigateToPengiriman}
                        className="text-[11px] font-bold text-emerald-800 hover:underline"
                      >
                        Buka Pengiriman ({ownerSummary.pendingTransfers.length} Pending) ➔
                      </button>
                    )}
                  </div>
                  {ownerSummary.recentTransfers.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada catatan pengiriman antarcabang.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {ownerSummary.recentTransfers.slice(0, 5).map((tr) => (
                        <div
                          key={tr.id}
                          className="text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <strong className="font-mono text-emerald-900">{tr.transferNumber}</strong>{' '}
                            <span className="text-slate-700">
                              ({tr.senderBranch} ➔ {tr.receiverBranch})
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              tr.status === 'Diterima'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tr.status === 'Ada Selisih'
                                ? 'bg-amber-100 text-amber-800'
                                : tr.status === 'Dibatalkan'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {tr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-700" />
                    Log Aktivitas Pengguna Terbaru
                  </span>
                  {ownerSummary.recentAuditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada aktivitas audit tercatat.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {ownerSummary.recentAuditLogs.slice(0, 6).map((log) => (
                        <div
                          key={log.id}
                          className="text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>{log.editedBy} ({log.branch})</span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {new Date(log.timestamp).toLocaleTimeString('id-ID')} WIB
                            </span>
                          </div>
                          <p className="text-slate-600 truncate">{log.note || log.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Single Branch KPI Cards: Omset Kotor, Omset Bersih, Rekapan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Omset Kotor {activeBranch}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats ? formatRupiah(stats.totalOmsetKotor) : '...'}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Total penerimaan kasir &amp; QRIS bulan ini
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Omset Bersih {activeBranch}
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

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigateToRekap()}
          className="flex items-center justify-between p-4 rounded-xl bg-[#064e3b] text-white hover:bg-[#047857] shadow-sm transition active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Rekapan Hari Ini</div>
              <div className="text-[11px] text-emerald-200">Stok, gula &amp; omset</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-emerald-300 group-hover:text-amber-400 transition-colors" />
        </button>

        {onNavigateToPengiriman && (
          <button
            onClick={onNavigateToPengiriman}
            className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-blue-600 hover:bg-blue-50/30 shadow-sm transition active:scale-[0.99] text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Pengiriman Barang</div>
                <div className="text-[11px] text-slate-600">Transfer stok antarcabang</div>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-blue-700 transition-colors" />
          </button>
        )}

        <button
          onClick={onNavigateToLaporan}
          className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-emerald-600 hover:bg-emerald-50/30 shadow-sm transition active:scale-[0.99] text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Laporan Bulanan</div>
              <div className="text-[11px] text-slate-600">Grafik &amp; riwayat harian</div>
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
              <div className="text-sm font-bold text-slate-900">Analisis AI</div>
              <div className="text-[11px] text-slate-600">Audit stok &amp; omset otomatis</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-amber-600 transition-colors" />
        </button>
      </div>

      {/* 7 Rekapan Terakhir */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
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
            {user?.role === 'admin' && (
              <button
                onClick={() => setResetTargetBranch(activeBranch)}
                disabled={isResetting}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                title={`Reset rekapan Cabang ${activeBranch} (otomatis membuat backup dahulu)`}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Reset {activeBranch}</span>
              </button>
            )}
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
          <div className="p-6 text-center text-xs text-rose-600">{error}</div>
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
            {stats.recentRekapan.map((record) => {
              const [, , dayNum] = record.date.split('-');
              return (
                <div
                  key={record.id}
                  onClick={() => onViewRecordDetail(record)}
                  className="p-3.5 sm:p-4 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex flex-col items-center justify-center shrink-0 border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 uppercase">
                        {new Date(Date.UTC(Number(record.date.slice(0, 4)), Number(record.date.slice(5, 7)) - 1, Number(dayNum || 1), 12)).toLocaleDateString('id-ID', {
                          month: 'short',
                          timeZone: 'Asia/Jakarta',
                        })}
                      </span>
                      <span className="text-sm font-bold">{parseInt(dayNum || '1', 10)}</span>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                        {formatDateIndo(record.date)}
                      </div>
                      <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>Kasir: {record.createdBy}</span>
                        <span>•</span>
                        <span>Omset Kotor: {formatRupiah(record.totalOmset)}</span>
                        {record.gulaDetail && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-800 font-semibold">
                              Gula: {record.gulaDetail.habisGula} KG
                            </span>
                          </>
                        )}
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
              );
            })}
          </div>
        )}
      </div>

      {/* In-app Owner Reset Confirmation Modal */}
      {resetTargetBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Reset Seluruh Rekapan {resetTargetBranch}?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sistem otomatis membuat <strong>Snapshot Backup Keamanan</strong> terlebih dahulu sebelum mengosongkan rekapan Cabang <strong>{resetTargetBranch}</strong>.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTargetBranch(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeResetBranch}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
