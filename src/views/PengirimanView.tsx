import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch, BranchTransfer, TransferItem } from '../types';
import { apiFetch } from '../utils/api';
import {
  convertTransferQtyToStockQty,
  formatDateIndo,
  getTodayDateStr,
} from '../utils/calculations';
import { TEH_KOTA_ITEMS } from '../utils/itemsList';
import { exportTransfersToPdf } from '../utils/exportUtils';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileDown,
  Search,
  RotateCcw,
  ArrowRight,
  PackageCheck,
  History,
  X,
} from 'lucide-react';

interface DraftTransferRow {
  id: string;
  itemName: string;
  customName: string;
  isCustom: boolean;
  unit: string;
  sentQty: string;
  note: string;
}

export const PengirimanView: React.FC = () => {
  const { user, activeBranch } = useAuth();
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Create Form State
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [formDate, setFormDate] = useState<string>(getTodayDateStr());
  const [senderBranch, setSenderBranch] = useState<Branch>(
    user?.role === 'admin' ? activeBranch : ((user?.branch as Branch) || activeBranch)
  );
  const [receiverBranch, setReceiverBranch] = useState<Branch>(
    (user?.role === 'admin' ? activeBranch : ((user?.branch as Branch) || activeBranch)) === 'Sompok'
      ? 'Suyudono'
      : 'Sompok'
  );
  const [senderName, setSenderName] = useState<string>(user?.name || '');
  const [formNotes, setFormNotes] = useState<string>('');
  const [draftItems, setDraftItems] = useState<DraftTransferRow[]>([
    {
      id: `row_${Date.now()}`,
      itemName: 'CUP',
      customName: '',
      isCustom: false,
      unit: 'slop',
      sentQty: '',
      note: '',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Confirm Receipt Modal State
  const [confirmModalTransfer, setConfirmModalTransfer] = useState<BranchTransfer | null>(null);
  const [confirmReceiverName, setConfirmReceiverName] = useState<string>(user?.name || '');
  const [confirmNote, setConfirmNote] = useState<string>('');
  const [confirmItemQtys, setConfirmItemQtys] = useState<Record<string, { actualQty: string; note: string }>>({});
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Detail Modal State
  const [detailTransfer, setDetailTransfer] = useState<BranchTransfer | null>(null);

  // Cancel Confirmation Modal State
  const [cancelTarget, setCancelTarget] = useState<BranchTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  useEffect(() => {
    if (user?.role !== 'admin' && (user?.branch === 'Sompok' || user?.branch === 'Suyudono')) {
      setSenderBranch(user.branch);
      setReceiverBranch(user.branch === 'Sompok' ? 'Suyudono' : 'Sompok');
    } else {
      setSenderBranch(activeBranch);
      setReceiverBranch(activeBranch === 'Sompok' ? 'Suyudono' : 'Sompok');
    }
    if (user?.name) {
      setSenderName((prev) => prev || user.name);
      setConfirmReceiverName((prev) => prev || user.name);
    }
  }, [user, activeBranch]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter !== 'All') params.set('branch', branchFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (startDateFilter) params.set('startDate', startDateFilter);
      if (endDateFilter) params.set('endDate', endDateFilter);
      if (searchFilter.trim()) params.set('search', searchFilter.trim());

      const res = await apiFetch(`/api/transfers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransfers(Array.isArray(data.transfers) ? data.transfers : []);
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Gagal memuat catatan pengiriman', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [branchFilter, statusFilter, startDateFilter, endDateFilter, searchFilter]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    const handleSync = () => {
      fetchTransfers();
    };
    window.addEventListener('tehkota:sync-transfer', handleSync);
    window.addEventListener('tehkota:sync-record', handleSync);
    return () => {
      window.removeEventListener('tehkota:sync-transfer', handleSync);
      window.removeEventListener('tehkota:sync-record', handleSync);
    };
  }, [fetchTransfers]);

  const handleSenderBranchChange = (b: Branch) => {
    setSenderBranch(b);
    setReceiverBranch(b === 'Sompok' ? 'Suyudono' : 'Sompok');
  };

  const handleAddDraftRow = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        itemName: 'GULA',
        customName: '',
        isCustom: false,
        unit: 'kg',
        sentQty: '',
        note: '',
      },
    ]);
  };

  const handleDraftItemChange = (id: string, field: keyof DraftTransferRow, val: string | boolean) => {
    setDraftItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        if (field === 'itemName') {
          if (val === '__CUSTOM__') {
            updated.isCustom = true;
            updated.unit = 'pcs';
          } else {
            updated.isCustom = false;
            const found = TEH_KOTA_ITEMS.find((i) => i.name === val);
            if (val === 'CUP') {
              updated.unit = 'slop';
            } else if (val === 'GULA') {
              updated.unit = 'kg';
            } else if (found) {
              updated.unit = found.unit;
            }
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveDraftRow = (id: string) => {
    setDraftItems((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!senderName.trim()) {
      setFeedback({ text: 'Nama pengirim wajib diisi.', type: 'error' });
      return;
    }

    const preparedItems: Partial<TransferItem>[] = [];
    for (const row of draftItems) {
      const name = row.isCustom ? row.customName.trim() : row.itemName.trim();
      const qty = parseFloat(row.sentQty);
      if (!name) {
        setFeedback({ text: 'Semua baris harus memiliki nama barang.', type: 'error' });
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        setFeedback({ text: `Jumlah kirim untuk "${name}" harus lebih dari 0.`, type: 'error' });
        return;
      }
      preparedItems.push({
        id: row.id,
        itemName: name,
        isCustom: row.isCustom,
        unit: row.unit.trim() || 'pcs',
        sentQty: qty,
        note: row.note.trim() || undefined,
      });
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          senderBranch,
          receiverBranch,
          senderName: senderName.trim(),
          notes: formNotes.trim(),
          items: preparedItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || 'Gagal menyimpan catatan pengiriman', type: 'error' });
        return;
      }

      setFeedback({
        text: data.message || `Pengiriman ${data.transfer?.transferNumber} berhasil dibuat.`,
        type: 'success',
      });
      setShowCreateForm(false);
      setFormNotes('');
      setDraftItems([
        {
          id: `row_${Date.now()}`,
          itemName: 'CUP',
          customName: '',
          isCustom: false,
          unit: 'slop',
          sentQty: '',
          note: '',
        },
      ]);
      await fetchTransfers();
      window.dispatchEvent(new CustomEvent('tehkota:sync-transfer', { detail: { transfer: data.transfer } }));
    } catch (err: any) {
      setFeedback({ text: err.message || 'Gagal menghubungi server', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmModal = (tr: BranchTransfer) => {
    const initialMap: Record<string, { actualQty: string; note: string }> = {};
    tr.items.forEach((item) => {
      initialMap[item.id] = { actualQty: String(item.sentQty), note: '' };
    });
    setConfirmItemQtys(initialMap);
    setConfirmReceiverName(user?.name || `Kasir ${tr.receiverBranch}`);
    setConfirmNote('');
    setConfirmModalTransfer(tr);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModalTransfer) return;
    if (!confirmReceiverName.trim()) {
      setFeedback({ text: 'Nama penerima barang wajib diisi.', type: 'error' });
      return;
    }

    setIsConfirming(true);
    try {
      const itemsPayload = confirmModalTransfer.items.map((item) => {
        const entry = confirmItemQtys[item.id];
        return {
          id: item.id,
          itemName: item.itemName,
          actualQty: entry ? Math.max(0, parseFloat(entry.actualQty) || 0) : item.sentQty,
          note: entry?.note || undefined,
        };
      });

      const res = await apiFetch(`/api/transfers/${confirmModalTransfer.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverName: confirmReceiverName.trim(),
          confirmationNote: confirmNote.trim(),
          items: itemsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || 'Gagal mengonfirmasi penerimaan barang', type: 'error' });
        return;
      }

      setFeedback({ text: data.message, type: 'success' });
      setConfirmModalTransfer(null);
      await fetchTransfers();
      window.dispatchEvent(new CustomEvent('tehkota:sync-transfer', { detail: { transfer: data.transfer } }));
    } catch (err: any) {
      setFeedback({ text: err.message || 'Terjadi kesalahan saat konfirmasi', type: 'error' });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const res = await apiFetch(`/api/transfers/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason.trim() || 'Dibatalkan oleh pengguna',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ text: data.error || 'Gagal membatalkan pengiriman', type: 'error' });
        return;
      }
      setFeedback({ text: data.message, type: 'success' });
      setCancelTarget(null);
      setCancelReason('');
      await fetchTransfers();
      window.dispatchEvent(new CustomEvent('tehkota:sync-transfer', { detail: { transfer: data.transfer } }));
    } catch (err: any) {
      setFeedback({ text: err.message || 'Gagal menghubungi server', type: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const filterDesc =
        user?.role === 'admin'
          ? `${branchFilter === 'All' ? 'Sompok & Suyudono' : `Cabang ${branchFilter}`} (${statusFilter})`
          : `Cabang ${user?.branch} (${statusFilter})`;
      await exportTransfersToPdf(transfers, filterDesc);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Summary counts
  const pendingCount = transfers.filter((t) => t.status === 'Menunggu Diterima').length;
  const acceptedCount = transfers.filter((t) => t.status === 'Diterima').length;
  const discrepancyCount = transfers.filter((t) => t.status === 'Ada Selisih').length;

  // Incoming pending transfers for the current branch / owner
  const incomingPending = transfers.filter(
    (t) =>
      t.status === 'Menunggu Diterima' &&
      (user?.role === 'admin' || t.receiverBranch === user?.branch)
  );

  const canConfirmTransfer = (tr: BranchTransfer) =>
    tr.status === 'Menunggu Diterima' &&
    (user?.role === 'admin' || user?.branch === tr.receiverBranch);

  const canCancelTransfer = (tr: BranchTransfer) =>
    tr.status !== 'Dibatalkan' &&
    (user?.role === 'admin' ||
      (tr.status === 'Menunggu Diterima' && user?.branch === tr.senderBranch));

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-800" />
            <span>Catatan Pengiriman Barang Antarcabang</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Mutasi stok keluar &amp; masuk antara Cabang Sompok dan Suyudono terintegrasi otomatis ke rekapan stok harian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-rose-600" />
            <span>{isExportingPdf ? 'Menyiapkan PDF...' : 'Unduh PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold shadow-sm transition active:scale-95"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreateForm ? 'Tutup Form' : 'Buat Pengiriman Baru'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <span className="font-semibold">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* Status Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5">
          <span className="text-[10px] font-bold text-blue-800 uppercase block">
            Menunggu Diterima
          </span>
          <span className="text-xl font-extrabold text-blue-900 font-mono">{pendingCount}</span>
        </div>
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5">
          <span className="text-[10px] font-bold text-emerald-800 uppercase block">
            Sudah Diterima
          </span>
          <span className="text-xl font-extrabold text-emerald-900 font-mono">{acceptedCount}</span>
        </div>
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5">
          <span className="text-[10px] font-bold text-amber-800 uppercase block">
            Ada Selisih
          </span>
          <span className="text-xl font-extrabold text-amber-900 font-mono">{discrepancyCount}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <span className="text-[10px] font-bold text-slate-600 uppercase block">
            Total Catatan
          </span>
          <span className="text-xl font-extrabold text-slate-900 font-mono">{transfers.length}</span>
        </div>
      </div>

      {/* Actionable Alert: Incoming Transfers Waiting Confirmation */}
      {incomingPending.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
            <PackageCheck className="w-5 h-5 text-blue-700" />
            <span>
              Konfirmasi Barang Masuk ({incomingPending.length} Pengiriman Menunggu Diterima)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingPending.map((tr) => (
              <div
                key={tr.id}
                className="bg-white rounded-xl p-3.5 border border-blue-200 shadow-xs flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-900">
                      {tr.transferNumber}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {tr.senderBranch} ➔ {tr.receiverBranch}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Tanggal: <strong>{tr.date}</strong> • Pengirim: <strong>{tr.senderName}</strong>
                  </p>
                  <ul className="mt-1.5 text-xs text-slate-800 space-y-0.5">
                    {tr.items.map((i) => (
                      <li key={i.id}>
                        • {i.itemName}: <strong>{i.sentQty} {i.unit}</strong>
                        {i.itemName.toUpperCase() === 'CUP' && i.unit.toLowerCase() === 'slop' && (
                          <span className="text-[10px] text-emerald-700 ml-1">
                            ({convertTransferQtyToStockQty(i.itemName, i.sentQty, i.unit)} pcs)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => openConfirmModal(tr)}
                  className="w-full py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                >
                  Konfirmasi Terima Barang Ini
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Transfer Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white rounded-2xl border-2 border-emerald-600 shadow-md p-4 sm:p-5 space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Form Catatan Pengiriman Barang Baru
              </h3>
              <p className="text-xs text-slate-600">
                Menyimpan catatan ini otomatis mencatat barang keluar (OUT) di cabang pengirim. Stok masuk (IN) penerima bertambah setelah dikonfirmasi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Tanggal Pengiriman
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Cabang Pengirim
              </label>
              <select
                value={senderBranch}
                disabled={user?.role !== 'admin'}
                onChange={(e) => handleSenderBranchChange(e.target.value as Branch)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-600 outline-none disabled:bg-slate-100"
              >
                <option value="Sompok">Cabang Sompok</option>
                <option value="Suyudono">Cabang Suyudono</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Cabang Tujuan Penerima
              </label>
              <div className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cabang {receiverBranch}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Nama Pengirim / Kurir *
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Nama kasir / kurir"
                required
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Multi-Item Rows */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase">
                Daftar Barang yang Dikirim ({draftItems.length} barang)
              </label>
              <button
                type="button"
                onClick={handleAddDraftRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Barang</span>
              </button>
            </div>

            {draftItems.map((row, idx) => {
              const effName = row.isCustom ? row.customName : row.itemName;
              const numQty = parseFloat(row.sentQty) || 0;
              const convertedStock = convertTransferQtyToStockQty(effName, numQty, row.unit);
              const showCupHint =
                effName.toUpperCase() === 'CUP' && row.unit.toLowerCase() === 'slop' && numQty > 0;

              return (
                <div
                  key={row.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      #{idx + 1} Pilih Barang
                    </label>
                    <select
                      value={row.isCustom ? '__CUSTOM__' : row.itemName}
                      onChange={(e) => handleDraftItemChange(row.id, 'itemName', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white outline-none"
                    >
                      {TEH_KOTA_ITEMS.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ Barang Lain / Custom...</option>
                    </select>
                    {row.isCustom && (
                      <input
                        type="text"
                        value={row.customName}
                        onChange={(e) => handleDraftItemChange(row.id, 'customName', e.target.value)}
                        placeholder="Ketik nama barang custom..."
                        className="mt-1.5 w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-400 bg-white outline-none"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Jumlah Kirim
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={row.sentQty}
                      onChange={(e) => handleDraftItemChange(row.id, 'sentQty', e.target.value)}
                      placeholder="0"
                      required
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-slate-300 bg-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Satuan
                    </label>
                    <input
                      type="text"
                      value={row.unit}
                      onChange={(e) => handleDraftItemChange(row.id, 'unit', e.target.value)}
                      placeholder="pcs/slop/kg"
                      required
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Keterangan Item (Opsional)
                    </label>
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) => handleDraftItemChange(row.id, 'note', e.target.value)}
                      placeholder="Misal: titip driver sore"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftRow(row.id)}
                      disabled={draftItems.length === 1}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {showCupHint && (
                    <div className="sm:col-span-12 text-[11px] text-emerald-800 font-semibold">
                      Konversi otomatis stok CUP (1 slop = 50 pcs): <strong>{convertedStock} pcs</strong> akan dicatat keluar di {senderBranch}.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Umum Pengiriman (Opsional)
            </label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Contoh: Pengiriman stok darurat karena akhir pekan ramai"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Kirim & Catat Pengiriman'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative lg:col-span-2">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Cari nomor KRM, nama barang, pengirim..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white outline-none"
          >
            <option value="All">Semua Status</option>
            <option value="Menunggu Diterima">Menunggu Diterima</option>
            <option value="Diterima">Diterima</option>
            <option value="Ada Selisih">Ada Selisih</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>

          {user?.role === 'admin' ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white outline-none"
            >
              <option value="All">Semua Cabang</option>
              <option value="Sompok">Cabang Sompok</option>
              <option value="Suyudono">Cabang Suyudono</option>
            </select>
          ) : (
            <div className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center">
              Cabang {user?.branch}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              title="Dari tanggal"
              className="w-full px-2 py-2 text-[11px] font-semibold rounded-xl border border-slate-300 outline-none"
            />
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              title="Sampai tanggal"
              className="w-full px-2 py-2 text-[11px] font-semibold rounded-xl border border-slate-300 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Transfers History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Riwayat Catatan Pengiriman Barang
          </h3>
          <button
            type="button"
            onClick={fetchTransfers}
            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg"
            title="Segarkan daftar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-600">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
            Memuat data pengiriman...
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-600">
            Belum ada catatan pengiriman barang antarcabang untuk filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs min-w-[760px]">
              <thead>
                <tr className="bg-[#064e3b] text-white font-bold">
                  <th className="py-2.5 px-4">No. Pengiriman</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Rute Cabang</th>
                  <th className="py-2.5 px-3">Barang</th>
                  <th className="py-2.5 px-3">Pengirim / Penerima</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((tr) => {
                  const statusBadge =
                    tr.status === 'Diterima'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : tr.status === 'Ada Selisih'
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : tr.status === 'Dibatalkan'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200';

                  return (
                    <tr key={tr.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-900">
                        {tr.transferNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{tr.date}</td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {tr.senderBranch} <span className="text-emerald-700">➔</span> {tr.receiverBranch}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {tr.items.map((item, idx) => (
                          <div key={item.id || idx}>
                            • <strong>{item.itemName}</strong>: {item.sentQty} {item.unit}
                            {item.actualQty !== undefined && item.actualQty !== item.sentQty && (
                              <span className="text-amber-700 font-bold ml-1">
                                (Diterima: {item.actualQty})
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div>Kirim: {tr.senderName}</div>
                        {tr.receiverName && <div>Terima: {tr.receiverName}</div>}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge}`}
                        >
                          {tr.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canConfirmTransfer(tr) && (
                            <button
                              type="button"
                              onClick={() => openConfirmModal(tr)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-bold"
                            >
                              Konfirmasi
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDetailTransfer(tr)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold"
                          >
                            Detail
                          </button>
                          {canCancelTransfer(tr) && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(tr)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold border border-rose-200"
                            >
                              Batal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Konfirmasi Penerimaan Barang */}
      {confirmModalTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmSubmit}
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
          >
            <div className="bg-[#064e3b] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  Konfirmasi Penerimaan {confirmModalTransfer.transferNumber}
                </h3>
                <p className="text-xs text-emerald-200">
                  Dari Cabang {confirmModalTransfer.senderBranch} ke Cabang {confirmModalTransfer.receiverBranch}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalTransfer(null)}
                className="p-1 text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kasir / Penerima di Cabang {confirmModalTransfer.receiverBranch} *
                </label>
                <input
                  type="text"
                  value={confirmReceiverName}
                  onChange={(e) => setConfirmReceiverName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Verifikasi Jumlah Aktual yang Diterima
                </label>
                {confirmModalTransfer.items.map((item) => {
                  const currentVal = confirmItemQtys[item.id]?.actualQty ?? String(item.sentQty);
                  const numActual = parseFloat(currentVal) || 0;
                  const diff = Math.round((numActual - item.sentQty) * 100) / 100;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {item.itemName} ({item.unit})
                        </span>
                        <span className="text-slate-600">
                          Dikirim: <strong>{item.sentQty} {item.unit}</strong>
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Jumlah Diterima Aktual
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={currentVal}
                            onChange={(e) =>
                              setConfirmItemQtys((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...(prev[item.id] || { note: '' }),
                                  actualQty: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-slate-300 bg-white outline-none"
                          />
                        </div>
                        <div className="text-xs">
                          {diff === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sesuai Pengiriman
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Selisih: {diff > 0 ? `+${diff}` : diff} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Penerimaan / Kondisi Barang (Opsional)
                </label>
                <input
                  type="text"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Misal: Diterima dalam kondisi baik dan lengkap"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalTransfer(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isConfirming}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
              >
                {isConfirming ? 'Menyimpan...' : 'Simpan Konfirmasi & Tambah Stok Masuk'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Detail Pengiriman & Audit Log */}
      {detailTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="bg-[#064e3b] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  Detail {detailTransfer.transferNumber}
                </h3>
                <p className="text-xs text-emerald-200">
                  {formatDateIndo(detailTransfer.date)} • {detailTransfer.senderBranch} ➔ {detailTransfer.receiverBranch}
                </p>
              </div>
              <button
                onClick={() => setDetailTransfer(null)}
                className="p-1 text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Pengirim</span>
                  <span className="font-bold text-slate-900">{detailTransfer.senderName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Penerima</span>
                  <span className="font-bold text-slate-900">{detailTransfer.receiverName || 'Menunggu Konfirmasi'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Status</span>
                  <span className="font-bold text-emerald-800">{detailTransfer.status}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Integrasi Stok</span>
                  <span className="font-semibold text-slate-700">
                    OUT: {detailTransfer.stockAppliedToSender ? 'Ya' : 'Tidak'} • IN: {detailTransfer.stockAppliedToReceiver ? 'Ya' : 'Belum'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase mb-2">Rincian Barang</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2 px-3">Barang</th>
                        <th className="py-2 px-3 text-right">Kirim</th>
                        <th className="py-2 px-3 text-right">Diterima</th>
                        <th className="py-2 px-3 text-right">Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailTransfer.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.itemName} ({item.unit})
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{item.sentQty}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                            {item.actualQty ?? '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                            {item.discrepancy !== undefined && item.discrepancy !== 0 ? item.discrepancy : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(detailTransfer.notes || detailTransfer.confirmationNote || detailTransfer.cancelReason) && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  {detailTransfer.notes && (
                    <p><strong>Catatan Pengirim:</strong> {detailTransfer.notes}</p>
                  )}
                  {detailTransfer.confirmationNote && (
                    <p><strong>Catatan Penerima:</strong> {detailTransfer.confirmationNote}</p>
                  )}
                  {detailTransfer.cancelReason && (
                    <p className="text-rose-700"><strong>Alasan Batal:</strong> {detailTransfer.cancelReason}</p>
                  )}
                </div>
              )}

              {detailTransfer.auditLogs && detailTransfer.auditLogs.length > 0 && (
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 space-y-2">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <History className="w-4 h-4" />
                    <span>Riwayat Aktivitas Pengiriman</span>
                  </div>
                  {detailTransfer.auditLogs.map((log) => (
                    <div key={log.id} className="bg-white p-2 rounded-lg border border-blue-100 text-[11px]">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-blue-900">{log.editedBy}</span>
                        <span className="text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {log.note && <p className="text-slate-700 mt-0.5">{log.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDetailTransfer(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Batalkan Pengiriman */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-center text-slate-900">
              Batalkan {cancelTarget.transferNumber}?
            </h3>
            <p className="text-xs text-slate-600 text-center">
              Seluruh mutasi stok keluar/masuk yang sudah tercatat dari pengiriman ini akan otomatis dikembalikan.
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Alasan pembatalan (opsional)..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 outline-none"
            />
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={isCancelling}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {isCancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
