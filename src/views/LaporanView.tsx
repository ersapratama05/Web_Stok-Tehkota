import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch, MonthlyReportData, RekapRecord } from '../types';
import { formatDateIndo, formatRupiah } from '../utils/calculations';
import { computeLocalMonthlyReport, getCachedRecords, getLocalDraft } from '../utils/storage';
import {
  FileBarChart,
  Calendar,
  TrendingUp,
  Wallet,
  Receipt,
  ChevronRight,
  RotateCcw,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';

interface LaporanViewProps {
  onOpenRecordDetail: (record: RekapRecord) => void;
  onNavigateToRekap: (date: string) => void;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  onOpenRecordDetail,
  onNavigateToRekap,
}) => {
  const { user, activeBranch, setActiveBranch } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<Branch | 'All'>(activeBranch);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [rangeFilter, setRangeFilter] = useState<'all_month' | 'today' | 'yesterday' | '7days' | '30days'>('all_month');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const fetchMonthlyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/monthly?branch=${selectedBranch}&month=${selectedMonth}`, {
        cache: 'no-store',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setReportData(data);
        return;
      }
      const localData = computeLocalMonthlyReport(selectedBranch, selectedMonth);
      setReportData(localData);
    } catch {
      const localData = computeLocalMonthlyReport(selectedBranch, selectedMonth);
      setReportData(localData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedBranch, selectedMonth]);

  // Real-time synchronization listener: auto-refresh when any device saves
  useEffect(() => {
    const handleSync = () => {
      fetchMonthlyReport();
    };
    window.addEventListener('tehkota:sync-record', handleSync);
    return () => window.removeEventListener('tehkota:sync-record', handleSync);
  }, [selectedBranch, selectedMonth]);

  // Handle clicking a day in the table
  const handleDayClick = async (dateStr: string, hasRekap: boolean, rekapId?: string) => {
    if (hasRekap && rekapId) {
      try {
        const res = await fetch(`/api/records/${rekapId}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          onOpenRecordDetail(data.record);
          return;
        }
      } catch {
        // fallback
      }
      // Cek cache lokal
      const cached = getCachedRecords().find((r) => r.id === rekapId || r.date === dateStr);
      if (cached) {
        onOpenRecordDetail(cached);
        return;
      }
      const draft = getLocalDraft(selectedBranch === 'All' ? 'Sompok' : selectedBranch, dateStr);
      if (draft) {
        onOpenRecordDetail(draft);
        return;
      }
    }
    // If no record, open form with this date
    onNavigateToRekap(dateStr);
  };

  // SVG Chart Dimensions & Computations
  // Quick date filtering computations
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yDate = new Date(now);
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = `${yDate.getFullYear()}-${pad(yDate.getMonth() + 1)}-${pad(yDate.getDate())}`;

  const d7Date = new Date(now);
  d7Date.setDate(d7Date.getDate() - 7);
  const min7Date = `${d7Date.getFullYear()}-${pad(d7Date.getMonth() + 1)}-${pad(d7Date.getDate())}`;

  const d30Date = new Date(now);
  d30Date.setDate(d30Date.getDate() - 30);
  const min30Date = `${d30Date.getFullYear()}-${pad(d30Date.getMonth() + 1)}-${pad(d30Date.getDate())}`;

  const allDailyList = reportData?.dailyData || [];
  const filteredDailyList = allDailyList.filter((d) => {
    if (rangeFilter === 'today' && d.date !== todayStr) return false;
    if (rangeFilter === 'yesterday' && d.date !== yesterdayStr) return false;
    if (rangeFilter === '7days' && d.date < min7Date) return false;
    if (rangeFilter === '30days' && d.date < min30Date) return false;
    if (searchFilter.trim() !== '') {
      const q = searchFilter.toLowerCase();
      if (!d.date.includes(q) && !d.dayName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const dailyList = allDailyList;
  const maxOmset = Math.max(
    ...dailyList.map((d) => Math.max(d.omsetKotor, d.omsetBersih)),
    2000000
  );

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-emerald-800" />
              <span>Laporan &amp; Riwayat Terpusat</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live Sync
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Pantau tren omset kotor, omset bersih, dan riwayat harian seluruh cabang secara real-time
            </p>
          </div>

          <button
            onClick={fetchMonthlyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Filter Controls: Branch & Month */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Branch Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Cabang
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Sompok', 'Suyudono', 'All'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  disabled={user?.role !== 'admin' && b !== user?.branch}
                  onClick={() => setSelectedBranch(b)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    selectedBranch === b
                      ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {b === 'All' ? 'Kedua Cabang' : `Cabang ${b}`}
                </button>
              ))}
            </div>
          </div>

          {/* Month Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Bulan Laporan
            </label>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
              <Calendar className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Quick Range Tabs: Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulan Ini */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-[11px] font-bold text-slate-500 mr-1 shrink-0">Filter Cepat:</span>
            {[
              { id: 'all_month', label: 'Bulan Ini' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: '7days', label: '7 Hari Terakhir' },
              { id: '30days', label: '30 Hari Terakhir' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRangeFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  rangeFilter === tab.id
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari tanggal / hari..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none w-full sm:w-48 bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards: Bulanan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
            Omset Kotor Bulanan
          </span>
          <span className="text-base sm:text-xl font-bold text-slate-900 font-mono tabular-nums">
            {reportData ? formatRupiah(reportData.totalOmsetKotor) : '...'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/50">
          <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">
            Omset Bersih Bulanan
          </span>
          <span className="text-base sm:text-xl font-bold text-emerald-800 font-mono tabular-nums">
            {reportData ? formatRupiah(reportData.totalOmsetBersih) : '...'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-rose-800 uppercase block mb-1">
            Total Pengeluaran
          </span>
          <span className="text-base sm:text-xl font-bold text-rose-700 font-mono tabular-nums">
            {reportData ? formatRupiah(reportData.totalPengeluaran) : '...'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-blue-800 uppercase block mb-1">
            Total QRIS (Non-Tunai)
          </span>
          <span className="text-base sm:text-xl font-bold text-blue-700 font-mono tabular-nums">
            {reportData ? formatRupiah(reportData.totalQris) : '...'}
          </span>
        </div>
      </div>

      {/* Interactive Charts: Tren Omset Harian */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Grafik Tren &amp; Perbandingan Omset Harian
            </h3>
            <p className="text-xs text-slate-600">
              Perbandingan Omset Kotor (Emas) vs Omset Bersih (Hijau)
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                chartType === 'line'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>Garis</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                chartType === 'bar'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Batang</span>
            </button>
          </div>
        </div>

        {/* Chart Viewport */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-600">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mr-2" />
            Memuat grafik...
          </div>
        ) : dailyList.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-600">
            Tidak ada data rekapan untuk bulan ini.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[650px] sm:min-w-full">
              {/* SVG Chart */}
              <div className="h-64 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 900 240">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = 200 - pct * 170;
                    const val = maxOmset * pct;
                    return (
                      <g key={i}>
                        <line
                          x1="50"
                          y1={y}
                          x2="880"
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x="45"
                          y={y + 3}
                          fontSize="9"
                          fill="#94a3b8"
                          textAnchor="end"
                          className="font-mono"
                        >
                          {val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}k`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Bar or Line */}
                  {chartType === 'bar' ? (
                    // Bar Chart
                    dailyList.map((d, idx) => {
                      const totalDays = dailyList.length;
                      const availWidth = 820;
                      const step = availWidth / totalDays;
                      const x = 55 + idx * step;
                      const barW = Math.max(step * 0.35, 4);

                      const hKotor = (d.omsetKotor / maxOmset) * 170;
                      const hBersih = (d.omsetBersih / maxOmset) * 170;

                      return (
                        <g key={d.date} className="group cursor-pointer">
                          {/* Omset Kotor Bar */}
                          <rect
                            x={x}
                            y={200 - hKotor}
                            width={barW}
                            height={hKotor}
                            fill="#f59e0b"
                            rx="2"
                            className="transition-all hover:opacity-80"
                          />
                          {/* Omset Bersih Bar */}
                          <rect
                            x={x + barW + 1}
                            y={200 - hBersih}
                            width={barW}
                            height={hBersih}
                            fill="#059669"
                            rx="2"
                            className="transition-all hover:opacity-80"
                          />
                          {/* X label every 3 days */}
                          {idx % 3 === 0 && (
                            <text
                              x={x + barW}
                              y="220"
                              fontSize="9"
                              fill="#64748b"
                              textAnchor="middle"
                            >
                              {idx + 1}
                            </text>
                          )}
                        </g>
                      );
                    })
                  ) : (
                    // Line Chart
                    <>
                      {/* Area Fill for Omset Bersih */}
                      <path
                        d={`M 55 200 ${dailyList
                          .map((d, i) => {
                            const x = 55 + i * (820 / (dailyList.length - 1 || 1));
                            const y = 200 - (d.omsetBersih / maxOmset) * 170;
                            return `L ${x} ${y}`;
                          })
                          .join(' ')} L 875 200 Z`}
                        fill="rgba(5, 150, 105, 0.12)"
                      />

                      {/* Line for Omset Kotor (Amber) */}
                      <path
                        d={`M ${dailyList
                          .map((d, i) => {
                            const x = 55 + i * (820 / (dailyList.length - 1 || 1));
                            const y = 200 - (d.omsetKotor / maxOmset) * 170;
                            return `${i === 0 ? '' : 'L'} ${x} ${y}`;
                          })
                          .join(' ')}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                      />

                      {/* Line for Omset Bersih (Emerald) */}
                      <path
                        d={`M ${dailyList
                          .map((d, i) => {
                            const x = 55 + i * (820 / (dailyList.length - 1 || 1));
                            const y = 200 - (d.omsetBersih / maxOmset) * 170;
                            return `${i === 0 ? '' : 'L'} ${x} ${y}`;
                          })
                          .join(' ')}`}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.5"
                      />

                      {/* Data Points */}
                      {dailyList.map((d, idx) => {
                        const x = 55 + idx * (820 / (dailyList.length - 1 || 1));
                        const yBersih = 200 - (d.omsetBersih / maxOmset) * 170;
                        if (d.hasRekap) {
                          return (
                            <circle
                              key={d.date}
                              cx={x}
                              cy={yBersih}
                              r="4"
                              fill="#064e3b"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="cursor-pointer hover:r-6 transition-all"
                            />
                          );
                        }
                        return null;
                      })}

                      {/* X Labels */}
                      {dailyList.map((d, idx) => {
                        const x = 55 + idx * (820 / (dailyList.length - 1 || 1));
                        if (idx % 3 === 0) {
                          return (
                            <text
                              key={d.date}
                              x={x}
                              y="220"
                              fontSize="9"
                              fill="#64748b"
                              textAnchor="middle"
                            >
                              {idx + 1}
                            </text>
                          );
                        }
                        return null;
                      })}
                    </>
                  )}
                </svg>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center justify-center gap-6 pt-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Omset Kotor (Rp)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600" />
                  <span>Omset Bersih (Rp)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabel Riwayat Harian Bulanan (Clickable row opens detail or form) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Tabel Riwayat Rekapan Harian
            </h3>
            <p className="text-xs text-slate-600">
              Klik pada baris tanggal untuk melihat detail lengkap atau membuat rekapan baru.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#064e3b] text-white font-bold">
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-3 text-right">Omset Kotor</th>
                <th className="py-2.5 px-3 text-right">Pengeluaran</th>
                <th className="py-2.5 px-3 text-right">QRIS</th>
                <th className="py-2.5 px-3 text-right">Omset Bersih</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDailyList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Tidak ada rekapan untuk filter yang dipilih ({rangeFilter !== 'all_month' ? rangeFilter : 'bulan ini'}{searchFilter ? `, pencarian "${searchFilter}"` : ''}).
                  </td>
                </tr>
              ) : (
                filteredDailyList.map((day, idx) => (
                  <tr
                    key={day.date}
                    onClick={() => handleDayClick(day.date, day.hasRekap, day.rekapId)}
                    className={`hover:bg-emerald-50/40 cursor-pointer transition ${
                      day.hasRekap ? (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50') : 'bg-slate-50/20 text-slate-400'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{day.dayName}</span>
                        <span className="text-[11px] text-slate-600">{day.date}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                      {day.hasRekap ? formatRupiah(day.omsetKotor) : '-'}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700">
                      {day.hasRekap ? formatRupiah(day.pengeluaran) : '-'}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-700">
                      {day.hasRekap ? formatRupiah(day.qris) : '-'}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 tabular-nums">
                      {day.hasRekap ? formatRupiah(day.omsetBersih) : '-'}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {day.hasRekap ? (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            day.status === 'draft'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {day.status === 'draft' ? 'Draf' : 'Tersimpan'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Belum diisi</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px] inline-flex items-center gap-0.5">
                          {day.hasRekap ? 'Detail' : '+ Buat'}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        {day.hasRekap && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToRekap(day.date);
                            }}
                            className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition"
                            title="Edit rekapan tanggal ini langsung"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
