import React, { useState } from 'react';
import { RekapRecord } from '../types';
import { formatDateIndo, formatNumberId, formatRupiah } from '../utils/calculations';
import {
  exportRecordToCsv,
  exportRecordToImage,
  exportRecordToPdf,
} from '../utils/exportUtils';
import {
  X,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Calendar,
  Store,
  User,
  Coffee,
  Receipt,
  Download,
  AlertTriangle,
} from 'lucide-react';

interface HistoryDetailModalProps {
  record: RekapRecord;
  onClose: () => void;
  onEdit: (record: RekapRecord) => void;
  onDeleteSuccess: () => void;
}

export const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({
  record,
  onClose,
  onEdit,
  onDeleteSuccess,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/records/${record.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus rekapan dari server');
      onDeleteSuccess();
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus');
      setIsDeleting(false);
    }
  };

  const cup = record.stocks.find((s) => s.name === 'CUP');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto max-h-[92vh] flex flex-col">
        {/* Header Strip */}
        <div className="bg-[#064e3b] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-amber-400 font-bold border border-emerald-700">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Detail Rekapan Cabang {record.branch}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    record.status === 'draft'
                      ? 'bg-amber-400 text-emerald-950'
                      : 'bg-emerald-400 text-emerald-950'
                  }`}
                >
                  {record.status === 'draft' ? 'Draf' : 'Tersimpan'}
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                {formatDateIndo(record.date)} • Kasir: {record.createdBy} • Jam {record.timeStr || '-'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar: Edit, Delete, Exports */}
        <div className="bg-slate-50 px-4 sm:px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(record);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Rekapan</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          </div>

          {/* Download buttons: PDF, JPG, PNG, CSV */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-600 mr-1 hidden sm:inline">
              Unduh:
            </span>
            <button
              onClick={() => exportRecordToPdf(record)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-xs"
              title="Unduh format PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => exportRecordToImage(record, 'jpeg')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-xs"
              title="Unduh format JPG"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>JPG</span>
            </button>
            <button
              onClick={() => exportRecordToImage(record, 'png')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-xs"
              title="Unduh format PNG"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>PNG</span>
            </button>
            <button
              onClick={() => exportRecordToCsv(record)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-xs"
              title="Unduh format CSV (Excel)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Financial Summary 4 Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">
                Total Omset (Kotor)
              </span>
              <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                {formatRupiah(record.totalOmset)}
              </span>
            </div>
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800 uppercase block">
                Total Pengeluaran
              </span>
              <span className="text-base font-bold text-rose-700 font-mono tabular-nums">
                {formatRupiah(record.totalPengeluaran)}
              </span>
            </div>
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">
                QRIS (Non-Tunai)
              </span>
              <span className="text-base font-bold text-blue-700 font-mono tabular-nums">
                {formatRupiah(record.qris)}
              </span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border-2 border-emerald-600">
              <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                Omset Akhir (Bersih)
              </span>
              <span className="text-base font-extrabold text-emerald-800 font-mono tabular-nums">
                {formatRupiah(record.omsetAkhir)}
              </span>
            </div>
          </div>

          {/* CUP Special Detail if available */}
          {cup && cup.cupDetail && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-emerald-700" />
                <span>
                  <strong>Stok Opname CUP:</strong> {cup.cupDetail.slop} Slop ({cup.cupDetail.slop * 50} pcs) + {cup.cupDetail.pcs} Pcs = <strong>SO {cup.cupDetail.calculatedSo} Pcs</strong>
                </span>
              </div>
              <span className="text-rose-700 font-bold bg-white px-2 py-0.5 rounded border border-rose-200">
                CUP Rusak: {cup.cupDetail.rusakPcs} pcs
              </span>
            </div>
          )}

          {/* Tabel Stok */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Rincian Stok Barang (SA, IN, OUT, ST, SO)
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2 px-3">Nama Barang</th>
                    <th className="py-2 px-2 text-center">Sat</th>
                    <th className="py-2 px-2 text-right">SA</th>
                    <th className="py-2 px-2 text-right">IN</th>
                    <th className="py-2 px-2 text-right">OUT</th>
                    <th className="py-2 px-2 text-right text-emerald-800 bg-emerald-50/50">ST</th>
                    <th className="py-2 px-2 text-right bg-emerald-50/70">SO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {record.stocks.map((item, idx) => {
                    return (
                      <tr key={item.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-1.5 px-2 text-center text-slate-600">{item.unit}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">{item.sa}</td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums text-emerald-700">
                          {item.inQty > 0 ? `+${item.inQty}` : '0'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums text-rose-700">
                          {item.outQty > 0 ? `-${item.outQty}` : '0'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30 tabular-nums">
                          {item.st}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 bg-emerald-50/50 tabular-nums">
                          {item.so}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel Pengeluaran */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Daftar Pengeluaran Operasional
            </h4>
            {record.expenses && record.expenses.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
                {record.expenses.map((exp, idx) => (
                  <div key={exp.id || idx} className="p-2.5 px-3.5 flex items-center justify-between bg-white">
                    <span className="font-semibold text-slate-800">
                      #{idx + 1} {exp.name}
                    </span>
                    <span className="font-mono font-bold text-rose-700 tabular-nums">
                      {formatRupiah(exp.amount)}
                    </span>
                  </div>
                ))}
                <div className="p-2.5 px-3.5 flex items-center justify-between bg-rose-50/60 font-bold text-rose-900">
                  <span>TOTAL PENGELUARAN:</span>
                  <span className="font-mono tabular-nums">{formatRupiah(record.totalPengeluaran)}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-600 bg-slate-50 rounded-xl">
                Tidak ada pengeluaran operasional.
              </div>
            )}
          </div>

          {/* Notes if any */}
          {record.notes && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
              <strong className="block text-slate-900 mb-1">Catatan Operasional:</strong>
              <p className="whitespace-pre-line">{record.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:px-5 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Omset Bersih: <span className="font-bold font-mono text-emerald-800">{formatRupiah(record.omsetAkhir)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Hapus Rekapan Ini?</h3>
            <p className="text-xs text-slate-600">
              Rekapan Cabang {record.branch} tanggal {record.date} akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
            </p>
            {deleteError && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
                {deleteError}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
