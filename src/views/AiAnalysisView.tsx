import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch, AiAnalysisResult } from '../types';
import { exportAiAnalysisToPdf, exportAiAnalysisToTxt } from '../utils/exportUtils';
import {
  Sparkles,
  StopCircle,
  FileText,
  FileDown,
  AlertTriangle,
  TrendingUp,
  Package,
  Layers,
  ArrowRightLeft,
  CheckCircle,
  HelpCircle,
  Calendar,
  Store,
} from 'lucide-react';

export const AiAnalysisView: React.FC = () => {
  const { user, activeBranch } = useAuth();

  const [selectedBranches, setSelectedBranches] = useState<Branch[]>(['Sompok']);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [promptNotes, setPromptNotes] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleBranchToggle = (branch: Branch) => {
    setSelectedBranches((prev) => {
      if (prev.includes(branch)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((b) => b !== branch);
      } else {
        return [...prev, branch];
      }
    });
  };

  const handleSelectBoth = () => {
    setSelectedBranches(['Sompok', 'Suyudono']);
  };

  const startAnalysis = async () => {
    setError(null);
    setIsAnalyzing(true);
    setResult(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branches: selectedBranches,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          promptNotes: promptNotes.trim() || undefined,
        }),
        signal: abortController.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const errData = await res.json();
          throw new Error(errData.error || 'Gagal memproses analisis AI');
        } else {
          throw new Error('Layanan AI server belum aktif pada hosting ini. Fitur rekapan, stok, dan omset tetap dapat digunakan secara lokal.');
        }
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Layanan AI server belum merespon JSON.');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Proses analisis AI berhasil dihentikan atas permintaan pengguna.');
      } else {
        setError(err.message || 'Terjadi kesalahan saat memanggil layanan AI.');
      }
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const stopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const branchLabel = selectedBranches.length === 2 ? 'Sompok & Suyudono' : selectedBranches[0];

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#0f766e] rounded-2xl p-5 sm:p-6 text-white shadow-md">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-emerald-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analisis Rekapan Berbasis AI</span>
            </span>
            <span className="text-xs text-emerald-200">Gemini 3.8 Flash</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Analisis Stok &amp; Omset Otomatis
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
            AI menganalisis data rekapan asli dari database untuk menemukan pergerakan stok tidak biasa, barang yang menipis, evaluasi margin omset, dan perbandingan performa antar cabang.
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
          Pengaturan Parameter Analisis
        </h3>

        {/* 1. Branch Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            1. Pilih Cabang yang Ingin Dianalisis
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedBranches(['Sompok'])}
              className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                selectedBranches.length === 1 && selectedBranches.includes('Sompok')
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Hanya Cabang Sompok</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedBranches(['Suyudono'])}
              className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                selectedBranches.length === 1 && selectedBranches.includes('Suyudono')
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Hanya Cabang Suyudono</span>
            </button>

            <button
              type="button"
              onClick={handleSelectBoth}
              className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                selectedBranches.length === 2
                  ? 'bg-amber-400 text-emerald-950 border-amber-500 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Kedua Cabang (Perbandingan)</span>
            </button>
          </div>
        </div>

        {/* 2. Date Range Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dari Tanggal (Opsional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sampai Tanggal (Opsional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>
        </div>

        {/* 3. User Notes / Focus */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Fokus Khusus / Pertanyaan Tambahan (Opsional)
          </label>
          <input
            type="text"
            value={promptNotes}
            onChange={(e) => setPromptNotes(e.target.value)}
            placeholder="Contoh: Fokuskan evaluasi pada penggunaan bahan Tea Series dan selisih stok CUP..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
          />
        </div>

        {/* Action Buttons: Mulai & Hentikan */}
        <div className="flex items-center gap-2 pt-2">
          {!isAnalyzing ? (
            <button
              onClick={startAnalysis}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs sm:text-sm font-bold shadow-md transition active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Mulai Analisis Rekapan AI</span>
            </button>
          ) : (
            <button
              onClick={stopAnalysis}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md transition active:scale-95 animate-pulse"
            >
              <StopCircle className="w-4 h-4" />
              <span>Hentikan Analisis</span>
            </button>
          )}

          <span className="text-[11px] text-slate-600">
            *AI hanya membaca data rekapan aktual tanpa mengubah database.
          </span>
        </div>
      </div>

      {/* Loading state animation */}
      {isAnalyzing && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-sm space-y-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 animate-spin text-emerald-700" />
          </div>
          <h4 className="text-sm font-bold text-emerald-950">
            Gemini AI sedang membaca &amp; menganalisis data rekapan...
          </h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Memeriksa pergerakan 45 jenis stok, menghitung selisih fisik SO, rasio pengeluaran harian, dan tren omset kasir.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Pemberitahuan Sistem:</strong>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result Cards Display */}
      {result && (
        <div className="space-y-4 animate-in fade-in">
          {/* Result Actions Bar: Download PDF & TXT */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Hasil Analisis Selesai</span>
              </h3>
              <p className="text-xs text-slate-600">
                Waktu pemrosesan: {new Date(result.timestamp).toLocaleTimeString('id-ID')} WIB
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportAiAnalysisToPdf(result, branchLabel)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5 text-amber-300" />
                <span>Unduh PDF</span>
              </button>
              <button
                onClick={() => exportAiAnalysisToTxt(result, branchLabel)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Unduh TXT</span>
              </button>
            </div>
          </div>

          {/* 1. Ringkasan Eksekutif */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>1. Ringkasan Eksekutif</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
              {result.summary}
            </p>
          </div>

          {/* 2. Wawasan Pergerakan Stok & Penjualan */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>2. Wawasan Penjualan &amp; Pergerakan Stok</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {result.stockInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Deteksi Anomali */}
          {result.anomalies && result.anomalies.length > 0 && (
            <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>3. Deteksi Anomali &amp; Perubahan Stok Tidak Biasa</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-amber-950">
                {result.anomalies.map((anom, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-700 font-bold">•</span>
                    <span>{anom}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 4. Peringatan Stok Menipis / Kritis */}
          {result.lowStockAlerts && result.lowStockAlerts.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>4. Peringatan Stok Kritis (Perlu Restok Segera)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.lowStockAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-rose-950 mb-1">
                      <span>{alert.item}</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-300">
                        Sisa ST: {alert.currentSt}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800">{alert.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Analisis Keuangan & Omset */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>5. Analisis Keuangan, QRIS, &amp; Margin</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
              {result.financialAnalysis}
            </p>
          </div>

          {/* 6. Perbandingan Antarcabang (jika ada) */}
          {result.branchComparison && (
            <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
                <span>6. Perbandingan Performa Antarcabang</span>
              </h4>
              <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed font-medium">
                {result.branchComparison}
              </p>
            </div>
          )}

          {/* 7. Rekomendasi Taktis */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
              <span>7. Rekomendasi Pengelolaan Stok &amp; Efisiensi Biaya</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">✓</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
