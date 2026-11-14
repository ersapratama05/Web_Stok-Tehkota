import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch, CupDetail, ExpenseItem, RekapRecord, StockItemRow } from '../types';
import { apiFetch } from '../utils/api';
import {
  calculateHabisGula,
  calculateOmsetAkhir,
  calculateStokAkhir,
  calculateTotalPengeluaran,
  formatDateIndo,
  formatNumberId,
  formatRupiah,
  getJakartaTimeStr,
  getTodayDateStr,
  getYesterdayDateStr,
  parseRupiahInput,
  validateGulaDetail,
} from '../utils/calculations';
import { createInitialStockRows } from '../utils/itemsList';
import { addToSyncQueue, getLocalDraft, saveLocalDraft, removeLocalDraft, saveRecordToLocal, getCachedRecords } from '../utils/storage';
import { CupModal } from '../components/CupModal';
import {
  Save,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Layers,
  Coffee,
  HelpCircle,
  Scale,
} from 'lucide-react';

interface RekapanFormViewProps {
  initialDate?: string;
  initialRecordId?: string;
  onSavedSuccess?: () => void;
}

export const RekapanFormView: React.FC<RekapanFormViewProps> = ({
  initialDate,
  initialRecordId,
  onSavedSuccess,
}) => {
  const { user, activeBranch, setActiveBranch, isOnline, syncStatus, setSyncStatus, lastSavedTime, setLastSavedTime } =
    useAuth();

  const [date, setDate] = useState<string>(initialDate || getTodayDateStr());
  const [stocks, setStocks] = useState<StockItemRow[]>(() => createInitialStockRows());
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [totalOmset, setTotalOmset] = useState<number>(0);
  const [qris, setQris] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [recordId, setRecordId] = useState<string | null>(initialRecordId || null);
  const [recordStatus, setRecordStatus] = useState<'draft' | 'saved' | 'final'>('draft');

  // Gula Calculation State (Rumus: (Ambil + Gula Kemarin) - Sisa Gula - Gula Cair = Habis Gula)
  const [gulaAmbil, setGulaAmbil] = useState<number>(0);
  const [gulaKemarin, setGulaKemarin] = useState<number>(0);
  const [sisaGula, setSisaGula] = useState<number>(0);
  const [gulaCair, setGulaCair] = useState<number>(0);

  // UI helpers
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [sectionFilter, setSectionFilter] = useState<'all' | 'stok' | 'pengeluaran' | 'gula' | 'keuangan'>('all');
  const [isCupModalOpen, setIsCupModalOpen] = useState<boolean>(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [hasServerRecord, setHasServerRecord] = useState<boolean>(false);
  const [hasPreviousGula, setHasPreviousGula] = useState<boolean>(false);
  const [previousGulaDate, setPreviousGulaDate] = useState<string | undefined>(undefined);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [conflictModal, setConflictModal] = useState<{
    conflictType: 'duplicate_date' | 'concurrent_edit';
    message: string;
    serverRecord: RekapRecord;
    pendingStatus: 'draft' | 'saved';
  } | null>(null);
  const [revisionInfo, setRevisionInfo] = useState<{
    revisionCount?: number;
    lastEditedBy?: string;
    lastEditedAt?: string;
    createdBy?: string;
  } | null>(null);

  // Autosave debounce timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // Calculations
  const totalPengeluaran = calculateTotalPengeluaran(expenses);
  const omsetAkhir = calculateOmsetAkhir(totalOmset, totalPengeluaran, qris);
  const habisGula = calculateHabisGula(gulaAmbil, gulaKemarin, sisaGula, gulaCair);
  const gulaValidation = validateGulaDetail({
    gulaAmbil,
    gulaKemarin,
    sisaGula,
    gulaCair,
    habisGula,
  });

  // Load record or previous day carryover when branch or date changes
  const loadDataForBranchAndDate = useCallback(
    async (targetBranch: Branch, targetDate: string) => {
      setIsLoadingRecord(true);
      setSaveMessage(null);
      setConflictModal(null);

      try {
        // 1. Primary Source of Truth: Central Server Database
        const res = await apiFetch(`/api/records?branch=${targetBranch}&date=${targetDate}`);
        if (res.ok) {
          const data = await res.json();
          if (data.records && data.records.length > 0) {
            const existing: RekapRecord = data.records[0];
            setRecordId(existing.id);
            setRecordStatus(existing.status);
            setHasServerRecord(true);
            setLoadedUpdatedAt(existing.updatedAt || null);
            setHasPreviousGula(false);
            setPreviousGulaDate(undefined);
            setStocks(existing.stocks);
            setExpenses(existing.expenses || []);
            setTotalOmset(existing.totalOmset || 0);
            setQris(existing.qris || 0);
            setNotes(existing.notes || '');
            setRevisionInfo({
              revisionCount: existing.revisionCount,
              lastEditedBy: existing.lastEditedBy,
              lastEditedAt: existing.lastEditedAt,
              createdBy: existing.createdBy,
            });
            if (existing.gulaDetail) {
              setGulaAmbil(existing.gulaDetail.gulaAmbil || 0);
              setGulaKemarin(existing.gulaDetail.gulaKemarin || 0);
              setSisaGula(existing.gulaDetail.sisaGula || 0);
              setGulaCair(existing.gulaDetail.gulaCair || 0);
            } else {
              setGulaAmbil(0);
              setGulaKemarin(0);
              setSisaGula(0);
              setGulaCair(0);
            }
            removeLocalDraft(targetBranch, targetDate);
            saveRecordToLocal(existing);
            setSaveMessage({
              text: `Membuka rekapan ${existing.status === 'draft' ? 'draf' : 'tersimpan di server pusat'} tanggal ${formatDateIndo(targetDate)}`,
              type: 'info',
            });
            setIsLoadingRecord(false);
            return;
          }
        }

        // 2. If no record on server, check local draft
        setHasServerRecord(false);
        setLoadedUpdatedAt(null);
        const localDraft = getLocalDraft(targetBranch, targetDate);
        if (localDraft) {
          setRecordId(localDraft.id || null);
          setRecordStatus(localDraft.status || 'draft');
          if (localDraft.stocks) setStocks(localDraft.stocks);
          if (localDraft.expenses) setExpenses(localDraft.expenses);
          if (localDraft.totalOmset !== undefined) setTotalOmset(localDraft.totalOmset);
          if (localDraft.qris !== undefined) setQris(localDraft.qris);
          if (localDraft.notes) setNotes(localDraft.notes);
          if (localDraft.gulaDetail) {
            setGulaAmbil(localDraft.gulaDetail.gulaAmbil || 0);
            setGulaKemarin(localDraft.gulaDetail.gulaKemarin || 0);
            setSisaGula(localDraft.gulaDetail.sisaGula || 0);
            setGulaCair(localDraft.gulaDetail.gulaCair || 0);
          }
          setHasPreviousGula(false);
          setPreviousGulaDate(undefined);
          setRevisionInfo(null);
          setSaveMessage({
            text: `Melanjutkan draf lokal sementara untuk tanggal ${formatDateIndo(targetDate)}`,
            type: 'info',
          });
          setIsLoadingRecord(false);
          return;
        }

        // 3. New record: Fetch previous day ST to auto-populate SA & Gula Kemarin (sisaGula hari sebelumnya)
        const prevRes = await apiFetch(`/api/records/previous-stock?branch=${targetBranch}&date=${targetDate}`);
        let prevStocksMap: Record<string, number> | undefined;
        let autoGulaKemarin = 0;
        let foundPrevGula = false;
        let prevDateLabel: string | undefined;
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          if (prevData.stocks) {
            prevStocksMap = prevData.stocks;
          }
          if (prevData.gulaKemarin !== undefined) {
            autoGulaKemarin = prevData.gulaKemarin;
          }
          foundPrevGula = Boolean(prevData.hasPreviousGula);
          prevDateLabel = prevData.previousDate;
        }

        // Offline / cached fallback for carryover SA & Gula Kemarin (sisaGula hari sebelumnya pada cabang sama)
        if (!prevStocksMap || (!foundPrevGula && autoGulaKemarin === 0)) {
          const cachedPrior = getCachedRecords()
            .filter((r) => r.branch === targetBranch && r.date < targetDate)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          if (cachedPrior) {
            if (!prevStocksMap && cachedPrior.stocks) {
              prevStocksMap = {};
              for (const item of cachedPrior.stocks) {
                prevStocksMap[item.name] = item.st;
              }
            }
            if (!foundPrevGula && cachedPrior.gulaDetail) {
              autoGulaKemarin = cachedPrior.gulaDetail.sisaGula || 0;
              foundPrevGula = true;
              prevDateLabel = cachedPrior.date;
            }
          }
        }

        const freshStocks = createInitialStockRows(prevStocksMap);
        setStocks(freshStocks);
        setRecordId(null);
        setRecordStatus('draft');
        setExpenses([]);
        setTotalOmset(0);
        setQris(0);
        setGulaAmbil(0);
        setGulaKemarin(autoGulaKemarin);
        setHasPreviousGula(foundPrevGula);
        setPreviousGulaDate(prevDateLabel);
        setSisaGula(0);
        setGulaCair(0);
        setNotes('');
        setRevisionInfo(null);
      } catch (err) {
        console.warn('Error loading record, falling back to local defaults', err);
        const freshStocks = createInitialStockRows();
        setStocks(freshStocks);
        setGulaAmbil(0);
        setGulaKemarin(0);
        setHasPreviousGula(false);
        setPreviousGulaDate(undefined);
        setSisaGula(0);
        setGulaCair(0);
      } finally {
        setIsLoadingRecord(false);
      }
    },
    []
  );

  // Sync props if changed externally (e.g. from clicking edit or table row)
  useEffect(() => {
    if (initialDate && initialDate !== date) {
      setDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (initialRecordId && initialRecordId !== recordId) {
      setRecordId(initialRecordId);
    }
  }, [initialRecordId]);

  // Trigger load on branch or date change
  useEffect(() => {
    loadDataForBranchAndDate(activeBranch, date);
  }, [activeBranch, date, loadDataForBranchAndDate]);

  // Listen for real-time synchronization events from other devices
  useEffect(() => {
    const handleSync = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.branch === activeBranch && detail.date === date) {
        if (detail.event === 'record_updated' || detail.event === 'record_created') {
          const editor = detail.editedBy || 'Pengguna lain';
          setSaveMessage({
            text: `Data rekapan Cabang ${activeBranch} tanggal ${formatDateIndo(date)} baru saja diperbarui oleh ${editor} dari perangkat lain. Memperbarui data terbaru...`,
            type: 'info',
          });
          loadDataForBranchAndDate(activeBranch, date);
        }
      }
    };

    window.addEventListener('tehkota:sync-record', handleSync);
    return () => window.removeEventListener('tehkota:sync-record', handleSync);
  }, [activeBranch, date, loadDataForBranchAndDate]);

  // Handle stock value changes
  const handleStockChange = (itemName: string, field: 'inQty' | 'outQty' | 'so', value: number) => {
    setStocks((prev) =>
      prev.map((item) => {
        if (item.name !== itemName) return item;

        const updated = { ...item };
        const safeVal = Math.max(0, Number(value) || 0);

        if (field === 'inQty') {
          updated.inQty = safeVal;
          updated.st = calculateStokAkhir(updated.sa, updated.inQty, updated.outQty);
        } else if (field === 'outQty') {
          updated.outQty = safeVal;
          updated.st = calculateStokAkhir(updated.sa, updated.inQty, updated.outQty);
        } else if (field === 'so') {
          updated.so = safeVal;
        }

        return updated;
      })
    );
  };

  // Handle CUP Modal Save
  const handleSaveCupDetail = (detail: CupDetail) => {
    setStocks((prev) =>
      prev.map((item) => {
        if (item.name !== 'CUP') return item;
        return {
          ...item,
          so: detail.calculatedSo,
          cupDetail: detail,
        };
      })
    );
  };

  // Expenses management
  const handleAddExpenseRow = () => {
    setExpenses((prev) => [
      ...prev,
      { id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, name: '', amount: 0 },
    ]);
  };

  const handleExpenseChange = (id: string, field: 'name' | 'amount', val: any) => {
    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.id !== id) return exp;
        return {
          ...exp,
          [field]: field === 'amount' ? Math.max(0, Number(val) || 0) : val,
        };
      })
    );
  };

  const handleDeleteExpenseRow = (id: string) => {
    setExpenses((prev) => prev.filter((exp) => exp.id !== id));
  };

  // Reset current form for revision (confirmed via in-app modal)
  const executeResetCurrentForm = async () => {
    setShowResetConfirm(false);
    try {
      if (recordId) {
        try {
          await apiFetch(`/api/records/${recordId}`, { method: 'DELETE' });
        } catch {
          // ignore offline
        }
      }

      removeLocalDraft(activeBranch, date);

      let prevStocksMap: Record<string, number> | undefined;
      let autoGulaKemarin = 0;
      let foundPrevGula = false;
      try {
        const prevRes = await apiFetch(`/api/records/previous-stock?branch=${activeBranch}&date=${date}`);
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          if (prevData.stocks) prevStocksMap = prevData.stocks;
          if (prevData.gulaKemarin !== undefined) autoGulaKemarin = prevData.gulaKemarin;
          foundPrevGula = Boolean(prevData.hasPreviousGula);
        }
      } catch {
        // fallback
      }

      const freshRows = createInitialStockRows(prevStocksMap);
      setStocks(freshRows);
      setExpenses([]);
      setTotalOmset(0);
      setQris(0);
      setGulaAmbil(0);
      setGulaKemarin(autoGulaKemarin);
      setHasPreviousGula(foundPrevGula);
      setSisaGula(0);
      setGulaCair(0);
      setNotes('');
      setRecordId(null);
      setHasServerRecord(false);
      setLoadedUpdatedAt(null);
      setRecordStatus('draft');
      setRevisionInfo(null);
      setSaveMessage({
        text: `Rekapan tanggal ${formatDateIndo(date)} berhasil di-reset dan siap diisi ulang.`,
        type: 'success',
      });
    } catch (err: any) {
      setSaveMessage({
        text: 'Gagal mereset rekapan: ' + (err.message || 'Terjadi kesalahan'),
        type: 'error',
      });
    }
  };

  // Save Record (Save as Draft or Save Final with Gula validation & conflict guard)
  const handleSaveRecord = async (statusToSave: 'draft' | 'saved' = 'saved', forceOverwrite = false) => {
    if (!gulaValidation.valid) {
      setSaveMessage({
        text: gulaValidation.error || 'Angka perhitungan gula tidak valid.',
        type: 'error',
      });
      setSectionFilter('gula');
      return;
    }

    setIsSaving(true);
    setSyncStatus('saving');
    const now = new Date();
    const timeStr = getJakartaTimeStr(now);
    const editorName = user?.name || (user?.role === 'admin' ? 'Owner Teh Kota' : `Kasir ${activeBranch}`);

    const payload: any = {
      id: recordId || `rek_${activeBranch.toLowerCase()}_${date.replace(/-/g, '')}`,
      branch: activeBranch,
      date,
      timeStr,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: revisionInfo?.createdBy || editorName,
      editorRole: user?.role,
      editorBranch: user?.branch,
      status: statusToSave,
      stocks,
      expenses,
      totalOmset,
      totalPengeluaran,
      qris,
      omsetAkhir,
      gulaDetail: {
        gulaAmbil,
        gulaKemarin,
        sisaGula,
        gulaCair,
        habisGula,
      },
      notes,
      mode: hasServerRecord ? 'update' : 'create',
      expectedUpdatedAt: loadedUpdatedAt || undefined,
      forceOverwrite,
    };

    saveLocalDraft(activeBranch, date, payload);

    if (!isOnline) {
      saveRecordToLocal(payload);
      addToSyncQueue(payload);
      setSyncStatus('offline');
      setLastSavedTime(`${timeStr} WIB`);
      setIsSaving(false);
      setSaveMessage({
        text: 'Tersimpan di antrean offline sementara perangkat. Akan dikirim ke database pusat saat Online kembali.',
        type: 'info',
      });
      return;
    }

    try {
      const res = await apiFetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.status === 409 && contentType.includes('application/json')) {
        const conflictData = await res.json();
        setSyncStatus('error');
        setConflictModal({
          conflictType: conflictData.conflictType || 'concurrent_edit',
          message: conflictData.error,
          serverRecord: conflictData.serverRecord,
          pendingStatus: statusToSave,
        });
        setIsSaving(false);
        return;
      }

      if (res.ok && contentType.includes('application/json')) {
        const resData = await res.json();
        setRecordId(resData.record.id);
        setRecordStatus(statusToSave);
        setHasServerRecord(true);
        setLoadedUpdatedAt(resData.record.updatedAt || null);
        setConflictModal(null);
        setSyncStatus('saved');
        setLastSavedTime(`${timeStr} WIB`);
        setRevisionInfo({
          revisionCount: resData.record.revisionCount,
          lastEditedBy: resData.record.lastEditedBy,
          lastEditedAt: resData.record.lastEditedAt,
          createdBy: resData.record.createdBy,
        });

        if (statusToSave === 'saved') {
          removeLocalDraft(activeBranch, date);
        }
        saveRecordToLocal(resData.record);

        setSaveMessage({
          text:
            statusToSave === 'draft'
              ? 'Draf berhasil disimpan ke database pusat!'
              : hasServerRecord
              ? 'Perubahan rekapan berhasil disimpan ke database pusat!'
              : 'Rekapan berhasil disimpan ke database pusat!',
          type: 'success',
        });
      } else {
        const errorData = await res.json().catch(() => null);
        setSyncStatus('error');
        setSaveMessage({
          text: errorData?.error || 'Gagal tersimpan: Server menolak penyimpanan.',
          type: 'error',
        });
        setIsSaving(false);
        return;
      }

      if (statusToSave === 'saved' && onSavedSuccess) {
        setTimeout(onSavedSuccess, 800);
      }
    } catch (err: any) {
      console.warn('API sync warning, queued for offline retry:', err);
      saveRecordToLocal(payload);
      addToSyncQueue(payload);
      setSyncStatus('offline');
      setLastSavedTime(`${timeStr} WIB`);
      setSaveMessage({
        text: 'Koneksi ke server terganggu. Rekapan masuk antrean sinkronisasi lokal sementara.',
        type: 'info',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Autosave Local Recovery Draft Debounced (1.5 seconds - backup only, not central DB)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      const draftPayload: Partial<RekapRecord> = {
        id: recordId || undefined,
        branch: activeBranch,
        date,
        stocks,
        expenses,
        totalOmset,
        totalPengeluaran,
        qris,
        omsetAkhir,
        gulaDetail: {
          gulaAmbil,
          gulaKemarin,
          sisaGula,
          gulaCair,
          habisGula,
        },
        notes,
        status: 'draft',
      };
      saveLocalDraft(activeBranch, date, draftPayload);
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [stocks, expenses, totalOmset, qris, notes, activeBranch, date, gulaAmbil, gulaKemarin, sisaGula, gulaCair, habisGula]);

  // Filter stocks by category and search
  const filteredStocks = stocks.filter((item) => {
    const matchesCategory =
      activeCategory === 'Semua' ||
      (activeCategory === 'Bahan Pokok' && item.category === 'Perlengkapan / Bahan Pokok') ||
      (activeCategory === 'Yoghurt' && item.category === 'Yoghurt Series') ||
      (activeCategory === 'Choco' && item.category === 'Choco Series') ||
      (activeCategory === 'Tea' && item.category === 'Tea Series') ||
      (activeCategory === 'Coffee' && item.category === 'Coffee Series');

    const matchesSearch =
      searchQuery.trim() === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const cupItem = stocks.find((s) => s.name === 'CUP');

  return (
    <div className="space-y-5 pb-32 md:pb-12">
      {/* Top Form Header Card: Branch, Date, Quick Buttons, Time */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600" />
              <span>Input Rekapan Harian</span>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Cabang {activeBranch}
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Kelola stok barang masuk, keluar, opname, dan pengeluaran harian
            </p>
          </div>

          {/* Quick Branch & Save Status info */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {recordStatus === 'draft' ? (
                <span className="text-amber-800 bg-amber-50 px-2 py-1 rounded-md font-bold">
                  Status: Draf
                </span>
              ) : (
                <span className="text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md font-bold">
                  Status: Tersimpan di Server
                </span>
              )}
            </span>

            {/* Revision Badge if edited */}
            {revisionInfo && revisionInfo.revisionCount !== undefined && revisionInfo.revisionCount > 0 && (
              <span
                className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200"
                title={`Dibuat oleh: ${revisionInfo.createdBy || '-'}. Terakhir diedit oleh: ${revisionInfo.lastEditedBy || '-'} (${revisionInfo.lastEditedAt ? new Date(revisionInfo.lastEditedAt).toLocaleTimeString('id-ID') : '-'})`}
              >
                Revisi #{revisionInfo.revisionCount} ({revisionInfo.lastEditedBy || 'Editor'})
              </span>
            )}

            <button
              type="button"
              onClick={() => loadDataForBranchAndDate(activeBranch, date)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
              title="Batalkan perubahan lokal & muat ulang data terbaru dari server"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition"
              title="Reset rekapan tanggal ini agar dapat direvisi / diisi ulang"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveRecord('draft')}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              title="Simpan sebagai draf sekarang"
            >
              Simpan Draf
            </button>
            <button
              type="button"
              disabled={isSaving || !gulaValidation.valid}
              onClick={() => handleSaveRecord('saved')}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : hasServerRecord ? 'Simpan Perubahan' : 'Simpan Rekapan'}</span>
            </button>
          </div>
        </div>

        {/* Date Selector Strip with "Kemarin" & "Hari Ini" Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-5 flex items-center gap-2">
            <div className="relative flex-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Pilih Tanggal Rekapan
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
                />
                <Calendar className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
              </div>
            </div>
            <div className="flex items-end gap-1.5 pt-4">
              <button
                type="button"
                onClick={() => setDate(getYesterdayDateStr())}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  date === getYesterdayDateStr()
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={() => setDate(getTodayDateStr())}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  date === getTodayDateStr()
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Hari Ini
              </button>
            </div>
          </div>

          {/* Branch Selector for Admin */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Cabang Operasional
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Sompok', 'Suyudono'] as Branch[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  disabled={user?.role !== 'admin' && user?.branch !== b}
                  onClick={() => setActiveBranch(b)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                    activeBranch === b
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${activeBranch === b ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                  <span>Cabang {b}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback & Last Saved Indicator */}
          <div className="sm:col-span-3 text-right">
            <div className="text-[11px] text-slate-600">
              Terakhir disimpan:
            </div>
            <div className="text-xs font-bold text-slate-800 tabular-nums">
              {lastSavedTime || 'Belum disimpan hari ini'}
            </div>
          </div>
        </div>

        {/* Informative Banner if saveMessage exists */}
        {saveMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : saveMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <span>{saveMessage.text}</span>
            <button
              onClick={() => setSaveMessage(null)}
              className="text-slate-600 hover:text-slate-700 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}
        {/* Quick Section Tabs (including dedicated Rekapan Gula focus) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 custom-scrollbar">
          {[
            { id: 'all', label: 'Semua Bagian' },
            { id: 'stok', label: 'Tabel Stok' },
            { id: 'pengeluaran', label: 'Pengeluaran' },
            { id: 'gula', label: 'Rekapan Gula' },
            { id: 'keuangan', label: 'Keuangan Akhir' },
          ].map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSectionFilter(sec.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                sectionFilter === sec.id
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: TABEL REKAP STOK */}
      {(sectionFilter === 'all' || sectionFilter === 'stok') && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar: Category Tabs & Search */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Tabel Rekap Stok</span>
                <span className="text-xs font-semibold text-slate-600">
                  ({filteredStocks.length} dari {stocks.length} barang)
                </span>
              </h3>
              <p className="text-xs text-slate-600">
                Rumus: <code className="text-emerald-800 font-bold">ST = SA + IN - OUT</code>. Stok awal (SA) otomatis mengambil ST rekapan sebelumnya.
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari nama barang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {['Semua', 'Bahan Pokok', 'Yoghurt', 'Choco', 'Tea', 'Coffee'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  activeCategory === cat
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Special Highlight Banner for CUP */}
        {cupItem && (
          <div className="bg-emerald-50/70 border-b border-emerald-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950">
                  Perhitungan Khusus CUP: 1 Slop = 50 Pcs
                </div>
                <div className="text-[11px] text-emerald-800">
                  {cupItem.cupDetail ? (
                    <span>
                      {cupItem.cupDetail.slop} Slop + {cupItem.cupDetail.pcs} Pcs = SO <strong>{cupItem.so} Pcs</strong>
                      {cupItem.cupDetail.rusakPcs > 0 && (
                        <span className="text-rose-700 font-bold ml-2">
                          (Rusak: {cupItem.cupDetail.rusakPcs} pcs)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>Klik tombol untuk menghitung SO CUP secara akurat</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCupModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 shrink-0"
            >
              Buka Hitung SO CUP
            </button>
          </div>
        )}

        {/* Horizontally scrollable responsive table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#064e3b] text-white text-xs uppercase font-bold tracking-wider">
                <th className="py-3 px-4 sticky-col-left bg-[#064e3b] z-20 min-w-[180px]">
                  Barang
                </th>
                <th className="py-3 px-3 text-center w-20">Satuan</th>
                <th className="py-3 px-3 text-right w-24">
                  <span title="Stok Awal (diambil dari ST hari sebelumnya)">SA</span>
                </th>
                <th className="py-3 px-3 text-right w-28">
                  <span title="Barang Masuk">IN</span>
                </th>
                <th className="py-3 px-3 text-right w-28">
                  <span title="Barang Keluar">OUT</span>
                </th>
                <th className="py-3 px-3 text-right w-28 bg-[#047857]">
                  <span title="Stok Akhir = SA + IN - OUT">ST (Otomatis)</span>
                </th>
                <th className="py-3 px-3 text-right w-32 bg-[#065f46]">
                  <span title="Stok Opname (Fisik Aktual)">SO (Fisik)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-600">
                    Tidak ada barang yang cocok dengan pencarian "{searchQuery}"
                  </td>
                </tr>
              ) : (
                filteredStocks.map((row, idx) => {
                  const isCup = row.name === 'CUP';

                  return (
                    <tr
                      key={row.name}
                      className={`hover:bg-slate-50 transition ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Frozen Barang Column */}
                      <td className="py-2.5 px-4 sticky-col-left bg-inherit font-semibold text-slate-900 border-r border-slate-100">
                        <div className="flex items-center justify-between">
                          <span>{row.name}</span>
                          {isCup && (
                            <button
                              type="button"
                              onClick={() => setIsCupModalOpen(true)}
                              className="text-[10px] text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 px-1.5 py-0.5 rounded font-bold"
                              title="Buka kalkulator CUP"
                            >
                              Slop/Pcs
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Satuan */}
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {row.unit}
                      </td>

                      {/* SA (Stok Awal) - Read-only from previous ST */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 tabular-nums">
                        {row.sa}
                      </td>

                      {/* IN (Editable) */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.inQty === 0 ? '' : row.inQty}
                          onChange={(e) => handleStockChange(row.name, 'inQty', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-right font-mono font-semibold rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-600 outline-none bg-white tabular-nums hover:border-slate-300"
                        />
                      </td>

                      {/* OUT (Editable) */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.outQty === 0 ? '' : row.outQty}
                          onChange={(e) => handleStockChange(row.name, 'outQty', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-right font-mono font-semibold rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-600 outline-none bg-white tabular-nums hover:border-slate-300"
                        />
                      </td>

                      {/* ST (Calculated: SA + IN - OUT) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40 tabular-nums">
                        {row.st}
                      </td>

                      {/* SO (Manual or CUP calculated) */}
                      <td className="py-2 px-2 text-right bg-emerald-50/20">
                        {isCup ? (
                          <div
                            onClick={() => setIsCupModalOpen(true)}
                            className="w-full px-2 py-1.5 text-right font-mono font-bold text-emerald-900 bg-emerald-100/60 hover:bg-emerald-200 rounded-lg cursor-pointer tabular-nums flex items-center justify-between"
                            title="Klik untuk ubah rincian slop/pcs"
                          >
                            <span className="text-[10px] text-emerald-700 font-sans">edit</span>
                            <span>{row.so}</span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.so === 0 ? '' : row.so}
                            onChange={(e) => handleStockChange(row.name, 'so', Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-2 py-1.5 text-right font-mono font-semibold rounded-lg border border-emerald-200 focus:ring-1 focus:ring-emerald-600 outline-none bg-white tabular-nums hover:border-emerald-300 text-emerald-950"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* SECTION 2: FORM PENGELUARAN */}
      {(sectionFilter === 'all' || sectionFilter === 'pengeluaran') && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Form Pengeluaran Operasional</span>
            </h3>
            <p className="text-xs text-slate-600">
              Catat pembelian es batu, kantong kresek, air galon, atau kebutuhan outlet lainnya.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddExpenseRow}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Baris</span>
          </button>
        </div>

        {/* Expense Rows List */}
        <div className="space-y-2.5">
          {expenses.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Belum ada pengeluaran hari ini. Tekan "Tambah Baris" jika ada pengeluaran kasir.
            </div>
          ) : (
            expenses.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80"
              >
                <span className="text-xs font-bold text-slate-600 w-6 text-center">
                  #{index + 1}
                </span>

                <div className="flex-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleExpenseChange(item.id, 'name', e.target.value)}
                    placeholder="Contoh: Es Batu Kristal (3 sak)"
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-600 outline-none bg-white"
                  />
                </div>

                <div className="w-36 sm:w-44 relative">
                  <span className="absolute left-2.5 top-2 text-xs text-slate-600 font-bold">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.amount === 0 ? '' : formatNumberId(item.amount)}
                    onChange={(e) => handleExpenseChange(item.id, 'amount', parseRupiahInput(e.target.value))}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-800 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-600 outline-none bg-white text-right tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteExpenseRow(item.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                  title="Hapus baris pengeluaran ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Total Pengeluaran Display */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
          <span className="text-xs font-bold text-rose-900">
            Total Pengeluaran (Otomatis):
          </span>
          <span className="text-base font-bold text-rose-700 font-mono tabular-nums">
            {formatRupiah(totalPengeluaran)}
          </span>
        </div>
      </div>
      )}

      {/* SECTION 3: REKAP & PERHITUNGAN GULA PASIR */}
      {(sectionFilter === 'all' || sectionFilter === 'gula') && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-700" />
              <span>Rekapan Gula Pasir (KG)</span>
            </h3>
            <p className="text-xs text-slate-600">
              Rumus Otomatis: <code className="text-emerald-800 font-bold">Gula Habis = Ambil + Gula Kemarin - Sisa - Cair</code>
            </p>
          </div>
          <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-900">
            Total Gula Habis: <span className="font-mono text-sm text-emerald-800">{habisGula} KG</span>
          </div>
        </div>

        {/* Sugar Validation Error / Warning */}
        {!gulaValidation.valid && gulaValidation.error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{gulaValidation.error}</span>
          </div>
        )}
        {gulaValidation.valid && gulaValidation.warning && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{gulaValidation.warning}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Gula Ambil */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1. Ambil (KG)
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={gulaAmbil === 0 ? '' : gulaAmbil}
                onChange={(e) => setGulaAmbil(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-full pl-3 pr-10 py-2 text-sm font-mono font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-right tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-500">KG</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Gula pasir baru diambil hari ini
            </p>
          </div>

          {/* Gula Kemarin */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                2. Gula Kemarin (KG)
              </label>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  hasPreviousGula
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {hasPreviousGula ? `Auto Sisa ${previousGulaDate || 'Kemarin'}` : 'Saldo Awal Manual'}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={gulaKemarin === 0 ? '' : gulaKemarin}
                onChange={(e) => setGulaKemarin(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-full pl-3 pr-10 py-2 text-sm font-mono font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-right tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-500">KG</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Otomatis dari Sisa Gula kemarin (bisa dikoreksi)
            </p>
          </div>

          {/* Sisa Gula */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              3. Sisa Gula Fisik (KG)
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={sisaGula === 0 ? '' : sisaGula}
                onChange={(e) => setSisaGula(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-full pl-3 pr-10 py-2 text-sm font-mono font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-right tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-500">KG</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Diteruskan ke Gula Kemarin besok
            </p>
          </div>

          {/* Gula Cair */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              4. Gula Cair (KG)
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={gulaCair === 0 ? '' : gulaCair}
                onChange={(e) => setGulaCair(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-full pl-3 pr-10 py-2 text-sm font-mono font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-right tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-500">KG</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Sisa gula cair siap pakai (KG)
            </p>
          </div>
        </div>

        {/* Calculation Result Breakdown Strip */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
            gulaValidation.valid
              ? 'bg-emerald-50/80 border-emerald-200'
              : 'bg-rose-50 border-rose-300'
          }`}
        >
          <div className="text-xs text-emerald-950">
            <span className="font-bold">Rincian Perhitungan:</span>{' '}
            <span className="font-mono">
              ({gulaAmbil} + {gulaKemarin}) - {sisaGula} - {gulaCair} ={' '}
              <strong className={gulaValidation.valid ? 'text-emerald-900 font-bold' : 'text-rose-700 font-bold'}>
                {habisGula} KG
              </strong>
            </span>
          </div>
          <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
            <span>Gula Habis:</span>
            <span
              className={`text-sm font-mono bg-white px-2.5 py-0.5 rounded-lg border shadow-2xs ${
                gulaValidation.valid
                  ? 'border-emerald-300 text-emerald-800'
                  : 'border-rose-400 text-rose-700'
              }`}
            >
              {habisGula} KG
            </span>
          </div>
        </div>
      </div>
      )}

      {/* SECTION 4: FORM KEUANGAN AKHIR */}
      {(sectionFilter === 'all' || sectionFilter === 'keuangan') && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Form Perhitungan Keuangan Akhir</span>
          </h3>
          <p className="text-xs text-slate-600">
            Rumus Wajib: <code className="text-emerald-800 font-bold">OMSET AKHIR = TOTAL OMSET - TOTAL PENGELUARAN - QRIS</code>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Omset Input */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Total Omset (Kotor)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-600 font-bold">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={totalOmset === 0 ? '' : formatNumberId(totalOmset)}
                onChange={(e) => setTotalOmset(parseRupiahInput(e.target.value))}
                placeholder="0"
                className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-right tabular-nums"
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              Seluruh penjualan tunai + non-tunai
            </p>
          </div>

          {/* Total Pengeluaran (Read-only Auto synced) */}
          <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-200">
            <label className="block text-xs font-bold text-rose-800 mb-1">
              Total Pengeluaran (Otomatis)
            </label>
            <div className="py-2 px-3 text-sm font-mono font-bold text-rose-700 bg-white rounded-lg border border-rose-200 text-right tabular-nums">
              {formatRupiah(totalPengeluaran)}
            </div>
            <p className="text-[10px] text-rose-700 mt-1">
              Dihitung otomatis dari tabel pengeluaran
            </p>
          </div>

          {/* QRIS Input */}
          <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-200">
            <label className="block text-xs font-bold text-blue-800 mb-1">
              QRIS (Non-Tunai)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-blue-600 font-bold">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={qris === 0 ? '' : formatNumberId(qris)}
                onChange={(e) => setQris(parseRupiahInput(e.target.value))}
                placeholder="0"
                className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold text-blue-900 rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-600 outline-none bg-white text-right tabular-nums"
              />
            </div>
            <p className="text-[10px] text-blue-700 mt-1">
              Uang langsung masuk ke rekening QRIS
            </p>
          </div>

          {/* Omset Akhir (Bersih Wajib) */}
          <div className="bg-emerald-50 p-3.5 rounded-xl border-2 border-emerald-600 shadow-sm">
            <label className="block text-xs font-bold text-emerald-900 mb-1">
              Omset Akhir (Setoran Bersih)
            </label>
            <div className="py-2 px-3 text-base sm:text-lg font-mono font-extrabold text-emerald-800 bg-white rounded-lg border border-emerald-300 text-right tabular-nums shadow-inner">
              {formatRupiah(omsetAkhir)}
            </div>
            <p className="text-[10px] text-emerald-800 font-semibold mt-1">
              Uang fisik tunai yang wajib disetorkan
            </p>
          </div>
        </div>

        {/* Optional Operational Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Catatan Tambahan Kasir / Outlet (Opsional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catat kondisi mesin sealer, kerusakan barang, atau pesan pergantian shift..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-600 outline-none"
          />
        </div>
      </div>
      )}

      {/* Floating Bottom Sticky Action Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:px-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-600 uppercase block">
                Omset Bersih
              </span>
              <span className="text-base sm:text-lg font-extrabold text-emerald-800 font-mono tabular-nums leading-none">
                {formatRupiah(omsetAkhir)}
              </span>
            </div>
            <div className="hidden sm:block text-xs text-slate-600 pl-3 border-l border-slate-200">
              <div>
                Gula Habis: <strong className="font-mono text-emerald-800">{habisGula} KG</strong> •{' '}
                <span
                  className={`font-bold ${
                    syncStatus === 'saving'
                      ? 'text-blue-700'
                      : syncStatus === 'error'
                      ? 'text-rose-700'
                      : syncStatus === 'offline'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {syncStatus === 'saving'
                    ? 'Sedang menyimpan...'
                    : syncStatus === 'error'
                    ? 'Gagal tersimpan'
                    : syncStatus === 'offline'
                    ? 'Offline'
                    : syncStatus === 'saved'
                    ? 'Berhasil tersimpan'
                    : 'Online'}
                </span>
              </div>
              {lastSavedTime && (
                <div className="text-[10px] text-slate-500">Terakhir diperbarui: {lastSavedTime}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveRecord('draft')}
              className="px-3 sm:px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition disabled:opacity-50"
            >
              Simpan Draf
            </button>
            <button
              type="button"
              disabled={isSaving || !gulaValidation.valid}
              onClick={() => handleSaveRecord('saved')}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Sedang menyimpan...' : hasServerRecord ? 'Simpan Perubahan' : 'Simpan Rekapan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CUP Special Calculation Modal */}
      {isCupModalOpen && (
        <CupModal
          initialDetail={cupItem?.cupDetail}
          onSave={handleSaveCupDetail}
          onClose={() => setIsCupModalOpen(false)}
        />
      )}

      {/* In-app Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Reset Rekapan Tanggal {date}?
            </h3>
            <p className="text-xs text-slate-600">
              Isian rekapan Cabang <strong>{activeBranch}</strong> tanggal <strong>{formatDateIndo(date)}</strong> akan dikosongkan kembali. Jika sudah tersimpan di server, rekapan lama untuk tanggal ini akan dihapus.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeResetCurrentForm}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTTP 409 Conflict / Duplicate Date Resolution Modal */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl space-y-3 border border-amber-300">
            <div className="flex items-center gap-2.5 text-amber-800">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {conflictModal.conflictType === 'duplicate_date'
                    ? 'Data Rekapan Tanggal Ini Sudah Ada'
                    : 'Konflik Edit Multi-Perangkat Terdeteksi'}
                </h3>
                <p className="text-[11px] text-amber-800">
                  Cabang {activeBranch} • {date}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed">
              {conflictModal.message}
            </p>

            <div className="text-[11px] text-slate-600 space-y-1">
              <div>
                Data di server saat ini: Omset <strong>{formatRupiah(conflictModal.serverRecord.totalOmset)}</strong> • Diperbarui oleh <strong>{conflictModal.serverRecord.lastEditedBy || conflictModal.serverRecord.createdBy}</strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConflictModal(null);
                  loadDataForBranchAndDate(activeBranch, date);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-emerald-700 bg-emerald-50 text-emerald-900 text-xs font-bold hover:bg-emerald-100"
              >
                Muat Data Terbaru Server
              </button>
              <button
                type="button"
                onClick={() => handleSaveRecord(conflictModal.pendingStatus, true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                Timpa dengan Data Saya
              </button>
            </div>
            <button
              type="button"
              onClick={() => setConflictModal(null)}
              className="w-full py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
