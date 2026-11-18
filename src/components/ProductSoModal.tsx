import React, { useState } from 'react';
import { ProductSoDetail } from '../types';
import { calculateProductEceranPcsSO } from '../utils/calculations';
import { Calculator, Check, X } from 'lucide-react';

interface ProductSoModalProps {
  productName: string;
  unit?: string;
  initialDetail?: ProductSoDetail;
  onSave: (detail: ProductSoDetail) => void;
  onClose: () => void;
}

export const ProductSoModal: React.FC<ProductSoModalProps> = ({
  productName,
  unit = 'porsi',
  initialDetail,
  onSave,
  onClose,
}) => {
  const [eceran, setEceran] = useState<number>(initialDetail?.eceran || 0);
  const [pcs, setPcs] = useState<number>(initialDetail?.pcs || 0);

  const calculatedSo = calculateProductEceranPcsSO(eceran, pcs);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      eceran: Math.max(0, Number(eceran) || 0),
      pcs: Math.max(0, Number(pcs) || 0),
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
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hitung Stok Opname {productName}</h3>
              <p className="text-xs text-emerald-200">Rumus: PCS Atas + PCS Bawah</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Total SO di bagian atas modal */}
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">Total SO:</span>
            <span className="text-xl font-bold text-emerald-800 tabular-nums">
              {calculatedSo} <span className="text-xs font-normal text-emerald-700">{unit}</span>
            </span>
          </div>

          <div className="space-y-3">
            {/* Kotak input bagian atas */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                JUMLAH PCS ATAS
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={eceran === 0 ? '' : eceran}
                  onChange={(e) => setEceran(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-600 font-medium">pcs</span>
              </div>
            </div>

            {/* Kotak input bagian bawah */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                JUMLAH PCS BAWAH
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={pcs === 0 ? '' : pcs}
                  onChange={(e) => setPcs(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-600 font-medium">pcs</span>
              </div>
            </div>
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
              <span>Terapkan ke Baris {productName}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
