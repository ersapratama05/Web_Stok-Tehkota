import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide if already running in standalone PWA mode
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-2.5 py-1.5 text-xs shadow-sm transition active:scale-95"
        title="Instal Aplikasi Rekapan Teh Kota di HP / PC"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Instal App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-300 text-emerald-950 font-bold px-2.5 py-1.5 text-xs transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Instal iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-800 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-emerald-900">Pasang di iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <p>
                    Tekan tombol <strong>Bagikan (Share)</strong> <Share className="inline w-3.5 h-3.5 mx-1" /> pada bilah menu Safari bawah.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <p>
                    Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama</strong> (Add to Home Screen) <PlusSquare className="inline w-3.5 h-3.5 mx-1" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <p>
                    Tekan <strong>Tambah (Add)</strong> di pojok kanan atas. Aplikasi Teh Kota siap digunakan seperti app bawaan!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-emerald-800 text-white font-semibold py-2.5 text-xs hover:bg-emerald-700 transition"
              >
                Mengerti &amp; Tutup
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
