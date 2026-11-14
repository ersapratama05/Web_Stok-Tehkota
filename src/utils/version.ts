export const APP_VERSION = '1.4.0';
export const APP_RELEASE_DATE = '14 November 2026';
export const APP_BUILD_NAME = 'Database Cloud Terpusat, Pengiriman Barang Antarcabang & Dashboard Owner v1.4.0';

export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  features: string[];
}

export const RELEASE_HISTORY: ReleaseNote[] = [
  {
    version: '1.4.0',
    date: '14 Nov 2026',
    title: 'Penyempurnaan Total Operasional & Pengiriman Antarcabang',
    features: [
      'Dukungan database cloud PostgreSQL (Supabase / Neon) dengan migrasi otomatis aman & sistem backup/restore JSON.',
      'Menu baru Catatan Pengiriman Barang Antarcabang (Sompok ↔ Suyudono) dengan konfirmasi penerimaan, deteksi selisih, integrasi stok IN/OUT otomatis, dan export PDF.',
      'Dashboard Owner Terpadu lintas cabang (Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulanan, Rentang Kustom), ringkasan stok, gula, pengiriman pending, & log aktivitas.',
      'Autentikasi token bertanda tangan server & RBAC ketat di API, manajemen akun oleh Owner, serta proteksi konflik edit bersamaan (Optimistic Concurrency Control).',
      'Perbaikan zona waktu Asia/Jakarta (WIB), Gula Kemarin otomatis dari Sisa Gula hari sebelumnya, serta logo resmi Teh Kota pada hasil download PDF & JPG A4 2 kolom.',
    ],
  },
  {
    version: '1.3.0',
    date: '11 Nov 2026',
    title: 'Database Terpusat & Sinkronisasi Multi-Perangkat',
    features: [
      'Satu database server pusat untuk seluruh perangkat (HP Outlet, Laptop Owner, dll).',
      'Sinkronisasi real-time instan melalui Server-Sent Events (SSE) dan auto-polling cadangan.',
      'Dukungan edit rekapan lintas perangkat dengan pencatatan riwayat perubahan (Log Audit Trail).',
      'Pemisahan hak akses: Kasir hanya dapat mengelola cabangnya (Sompok / Suyudono), Owner akses penuh.',
      'Indikator sinkronisasi 5 status di header: Online, Menyinkronkan, Tersimpan di Server, Offline, Gagal.',
    ],
  },
  {
    version: '1.2.0',
    date: '11 Nov 2026',
    title: 'Rekapan Gula Otomatis & Format Cetak Kertas Manual',
    features: [
      'Fitur perhitungan Gula Pasir otomatis dengan rumus: (Ambil + Gula Kemarin) - Sisa - Cair = Habis Gula.',
      'Desain cetak PDF & JPG 2 kolom menyerupai kertas rekapitulasi manual outlet Teh Kota.',
      'Sistem Auto-Update PWA & Manajemen Pembaruan Aplikasi di akun Owner.',
    ],
  },
  {
    version: '1.1.0',
    date: '08 Nov 2026',
    title: 'Analisis AI & Multi-Cabang',
    features: [
      'Integrasi Gemini AI untuk audit stok dan omset harian.',
      'Dukungan multi-cabang (Sompok & Suyudono) dengan pemisahan kasir dan owner.',
      'Manajemen draf otomatis dan sinkronisasi offline.',
    ],
  },
  {
    version: '1.0.0',
    date: '01 Nov 2026',
    title: 'Rilis Perdana Sistem Rekapan Teh Kota',
    features: [
      'Pencatatan harian stok barang, pengeluaran, dan omset.',
      'Perhitungan otomatis Stock Opname CUP dan Omset Bersih.',
    ],
  },
];
