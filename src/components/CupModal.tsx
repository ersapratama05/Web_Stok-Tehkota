import React, { useState } from 'react';
import { CupDetail } from '../types';
import { calculateCupSO } from '../utils/calculations';
import { Coffee, AlertTriangle, Check, X } from 'lucide-react';

interface CupModalProps {
  initialDetail?: CupDetail;
  onSave: (detail: CupDetail) => void;
  onClose: () => void;
}

export const CupModal: React.FC<CupModalProps> = ({ initialDetail, onSave, onClose }) => {
  const [slop, setSlop] = useState<number>(initialDetail?.slop || 0);
  const [pcs, setPcs] = useState<number>(initialDetail?.pcs || 0);
  const [rusakPcs, setRusakPcs] = useState<number>(initialDetail?.rusakPcs || 0);

  const calculatedSo = calculateCupSO(slop, pcs);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slop: Number(slop) || 0,
      pcs: Number(pcs) || 0,
      rusakPcs: Number(rusakPcs) || 0,
      calculatedSo,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#064e3b] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-400">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hitung Stok Opname CUP</h3>
              <p className="text-xs text-emerald-200">Rumus: 1 Slop = 50 Pcs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">Total Fisik SO Terhitung:</span>
            <span className="text-xl font-bold text-emerald-800 tabular-nums">
              {calculatedSo} <span className="text-xs font-normal text-emerald-700">pcs</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Slop (Utuh)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={slop === 0 ? '' : slop}
                  onChange={(e) => setSlop(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-600 font-medium">slop</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">= {slop * 50} pcs</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Eceran (Pcs)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pcs === 0 ? '' : pcs}
                  onChange={(e) => setPcs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-600 font-medium">pcs</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">Sisa eceran terbuka</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>CUP Rusak / Pecah / Afkir (Pcs)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={rusakPcs === 0 ? '' : rusakPcs}
                onChange={(e) => setRusakPcs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-rose-300 bg-rose-50/40 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none tabular-nums text-rose-900"
              />
              <span className="absolute right-3 top-2.5 text-xs text-rose-600 font-medium">pcs</span>
            </div>
            <p className="text-[10px] text-rose-600 mt-1">
              *Dicatat terpisah untuk audit dan evaluasi operasional outlet.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan ke Baris CUP</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
