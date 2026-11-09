import { jsPDF } from 'jspdf';
import { AiAnalysisResult, RekapRecord } from '../types';
import { formatNumberId, formatRupiah } from './calculations';

/**
 * Unduh Rekapan sebagai File CSV
 */
export function exportRecordToCsv(record: RekapRecord): void {
  const lines: string[] = [];

  // Metadata
  lines.push(`REKAPAN TEH KOTA - CABANG ${record.branch.toUpperCase()}`);
  lines.push(`Tanggal;${record.date}`);
  lines.push(`Waktu Rekap;${record.timeStr || '-'}`);
  lines.push(`Kasir / Pencatat;${record.createdBy}`);
  lines.push(`Status;${record.status.toUpperCase()}`);
  lines.push('');

  // Ringkasan Keuangan
  lines.push('RINGKASAN KEUANGAN');
  lines.push(`Total Omset (Kotor);Rp ${record.totalOmset}`);
  lines.push(`Total Pengeluaran;Rp ${record.totalPengeluaran}`);
  lines.push(`QRIS (Non-Tunai);Rp ${record.qris}`);
  lines.push(`Omset Akhir (Bersih);Rp ${record.omsetAkhir}`);
  lines.push('');

  // Tabel Stok
  lines.push('TABEL REKAP STOK');
  lines.push('Kategori;Nama Barang;Satuan;SA (Stok Awal);IN (Masuk);OUT (Keluar);ST (Stok Akhir);SO (Opname)');
  for (const item of record.stocks) {
    lines.push(
      `"${item.category}";"${item.name}";"${item.unit}";${item.sa};${item.inQty};${item.outQty};${item.st};${item.so}`
    );
  }
  lines.push('');

  // Perhitungan Khusus CUP
  const cup = record.stocks.find((s) => s.name === 'CUP');
  if (cup && cup.cupDetail) {
    lines.push('DETAIL STOK OPNAME CUP');
    lines.push(`Jumlah Slop;${cup.cupDetail.slop} slop`);
    lines.push(`Jumlah Pcs;${cup.cupDetail.pcs} pcs`);
    lines.push(`Total Fisik SO;${cup.cupDetail.calculatedSo} pcs`);
    lines.push(`CUP Rusak;${cup.cupDetail.rusakPcs} pcs`);
    lines.push('');
  }

  // Pengeluaran
  lines.push('DAFTAR PENGELUARAN OPERASIONAL');
  lines.push('No;Nama Pengeluaran;Harga (Rp)');
  if (record.expenses && record.expenses.length > 0) {
    record.expenses.forEach((exp, idx) => {
      lines.push(`${idx + 1};"${exp.name}";${exp.amount}`);
    });
  } else {
    lines.push(';Tidak ada pengeluaran;0');
  }
  lines.push(`;TOTAL PENGELUARAN;${record.totalPengeluaran}`);

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rekap_TehKota_${record.branch}_${record.date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Unduh Rekapan sebagai File PDF menggunakan jsPDF
 */
export function exportRecordToPdf(record: RekapRecord): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Box
  doc.setFillColor(6, 78, 59); // Emerald 900
  doc.rect(10, y, pageWidth - 20, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAPAN TEH KOTA', 16, y + 9);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`CABANG ${record.branch.toUpperCase()} | TANGGAL: ${record.date}`, 16, y + 16);

  doc.setFontSize(9);
  doc.text(`Kasir: ${record.createdBy}  |  Waktu: ${record.timeStr || '-'}`, 16, y + 21);

  y += 30;

  // Financial Summary Cards
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, y, pageWidth - 20, 22, 2, 2, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.text('TOTAL OMSET (KOTOR)', 14, y + 6);
  doc.text('TOTAL PENGELUARAN', 62, y + 6);
  doc.text('QRIS (NON-TUNAI)', 114, y + 6);
  doc.text('OMSET AKHIR (BERSIH)', 155, y + 6);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiah(record.totalOmset), 14, y + 13);
  doc.setTextColor(220, 38, 38);
  doc.text(formatRupiah(record.totalPengeluaran), 62, y + 13);
  doc.setTextColor(2, 132, 199);
  doc.text(formatRupiah(record.qris), 114, y + 13);
  doc.setTextColor(5, 150, 105);
  doc.text(formatRupiah(record.omsetAkhir), 155, y + 13);

  y += 28;

  // CUP Special Box if available
  const cup = record.stocks.find((s) => s.name === 'CUP');
  if (cup && cup.cupDetail) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(10, y, pageWidth - 20, 12, 1, 1, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(6, 78, 59);
    doc.text(
      `PENGISIAN CUP: ${cup.cupDetail.slop} Slop (${cup.cupDetail.slop * 50} pcs) + ${cup.cupDetail.pcs} Pcs = SO ${cup.cupDetail.calculatedSo} Pcs  |  CUP Rusak: ${cup.cupDetail.rusakPcs} Pcs`,
      14,
      y + 7
    );
    y += 16;
  }

  // Stock Table Header
  doc.setFillColor(6, 78, 59);
  doc.rect(10, y, pageWidth - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BARANG', 13, y + 5);
  doc.text('SAT', 75, y + 5);
  doc.text('SA', 98, y + 5);
  doc.text('IN', 120, y + 5);
  doc.text('OUT', 142, y + 5);
  doc.text('ST', 164, y + 5);
  doc.text('SO', 185, y + 5);

  y += 7;

  // Stock rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  record.stocks.forEach((row, idx) => {
    // Check page overflow
    if (y > 275) {
      doc.addPage();
      y = 15;
      // Header for next page
      doc.setFillColor(6, 78, 59);
      doc.rect(10, y, pageWidth - 20, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('BARANG (Lanjutan)', 13, y + 5);
      doc.text('SAT', 75, y + 5);
      doc.text('SA', 98, y + 5);
      doc.text('IN', 120, y + 5);
      doc.text('OUT', 142, y + 5);
      doc.text('ST', 164, y + 5);
      doc.text('SO', 185, y + 5);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, y, pageWidth - 20, 5.5, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(row.name.length > 32 ? row.name.substring(0, 30) + '..' : row.name, 13, y + 4);
    doc.text(row.unit, 75, y + 4);
    doc.text(String(row.sa), 98, y + 4);
    doc.text(String(row.inQty), 120, y + 4);
    doc.text(String(row.outQty), 142, y + 4);
    doc.text(String(row.st), 164, y + 4);
    doc.text(String(row.so), 185, y + 4);

    y += 5.5;
  });

  // Expenses Section
  y += 6;
  if (y > 250) {
    doc.addPage();
    y = 15;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 78, 59);
  doc.text('RINCIAN PENGELUARAN:', 10, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  if (record.expenses && record.expenses.length > 0) {
    record.expenses.forEach((exp) => {
      doc.text(`• ${exp.name}`, 14, y);
      doc.text(formatRupiah(exp.amount), 150, y);
      y += 4.5;
    });
  } else {
    doc.text('• Tidak ada pengeluaran tercatat', 14, y);
    y += 4.5;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak secara otomatis dari Aplikasi Rekapan Teh Kota pada ${new Date().toLocaleString('id-ID')}`, 10, 287);

  doc.save(`Rekap_TehKota_${record.branch}_${record.date}.pdf`);
}

/**
 * Unduh Rekapan sebagai File Gambar (PNG / JPG)
 */
export function exportRecordToImage(record: RekapRecord, format: 'png' | 'jpeg'): void {
  const canvas = document.createElement('canvas');
  const scale = 2; // High-res retina
  const width = 800;
  // Estimate height based on items and expenses
  const rowHeight = 24;
  const headerHeight = 220;
  const stockHeight = (record.stocks.length + 2) * rowHeight;
  const expenseHeight = (Math.max(record.expenses.length, 1) + 2) * 22;
  const height = headerHeight + stockHeight + expenseHeight + 100;

  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Green Brand Header
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, 0, width, 90);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('REKAPAN TEH KOTA', 28, 42);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`CABANG ${record.branch.toUpperCase()}`, 28, 66);

  ctx.fillStyle = '#ffffff';
  ctx.font = '12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Tanggal: ${record.date}  |  Kasir: ${record.createdBy}`, width - 260, 66);

  // Financial Cards Strip
  let curY = 110;
  const cardW = 175;
  const cardH = 65;
  const cards = [
    { label: 'OMSET KOTOR', val: formatRupiah(record.totalOmset), color: '#0f172a' },
    { label: 'PENGELUARAN', val: formatRupiah(record.totalPengeluaran), color: '#dc2626' },
    { label: 'QRIS', val: formatRupiah(record.qris), color: '#0284c7' },
    { label: 'OMSET AKHIR', val: formatRupiah(record.omsetAkhir), color: '#059669' },
  ];

  cards.forEach((c, idx) => {
    const x = 28 + idx * (cardW + 14);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillRect(x, curY, cardW, cardH);
    ctx.strokeRect(x, curY, cardW, cardH);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.label, x + 12, curY + 22);

    ctx.fillStyle = c.color;
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.val, x + 12, curY + 48);
  });

  curY += 85;

  // CUP Note
  const cup = record.stocks.find((s) => s.name === 'CUP');
  if (cup && cup.cupDetail) {
    ctx.fillStyle = '#ecfdf5';
    ctx.strokeStyle = '#a7f3d0';
    ctx.fillRect(28, curY, width - 56, 32);
    ctx.strokeRect(28, curY, width - 56, 32);
    ctx.fillStyle = '#065f46';
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `CUP STOK OPNAME: ${cup.cupDetail.slop} Slop + ${cup.cupDetail.pcs} Pcs = ${cup.cupDetail.calculatedSo} Pcs  |  Rusak: ${cup.cupDetail.rusakPcs} Pcs`,
      40,
      curY + 20
    );
    curY += 44;
  }

  // Stock Table Header
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(28, curY, width - 56, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BARANG', 40, curY + 20);
  ctx.fillText('SAT', 260, curY + 20);
  ctx.fillText('SA', 350, curY + 20);
  ctx.fillText('IN', 440, curY + 20);
  ctx.fillText('OUT', 530, curY + 20);
  ctx.fillText('ST', 620, curY + 20);
  ctx.fillText('SO', 710, curY + 20);

  curY += 30;

  // Stock Rows
  record.stocks.forEach((row, i) => {
    ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(28, curY, width - 56, rowHeight);

    ctx.fillStyle = '#1e293b';
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(row.name, 40, curY + 16);
    ctx.fillText(row.unit, 260, curY + 16);
    ctx.fillText(String(row.sa), 350, curY + 16);
    ctx.fillText(String(row.inQty), 440, curY + 16);
    ctx.fillText(String(row.outQty), 530, curY + 16);
    ctx.fillText(String(row.st), 620, curY + 16);
    ctx.fillText(String(row.so), 710, curY + 16);

    curY += rowHeight;
  });

  curY += 24;

  // Expenses Title
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('RINCIAN PENGELUARAN:', 28, curY);
  curY += 18;

  ctx.font = '11px "Plus Jakarta Sans", sans-serif';
  if (record.expenses && record.expenses.length > 0) {
    record.expenses.forEach((exp) => {
      ctx.fillStyle = '#334155';
      ctx.fillText(`• ${exp.name}`, 36, curY);
      ctx.fillText(formatRupiah(exp.amount), width - 160, curY);
      curY += 20;
    });
  } else {
    ctx.fillStyle = '#64748b';
    ctx.fillText('• Tidak ada pengeluaran operasional', 36, curY);
    curY += 20;
  }

  // Footer
  curY += 20;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Aplikasi Rekapan Teh Kota - Sompok & Suyudono', 28, curY);

  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const dataUrl = canvas.toDataURL(mime, 0.95);

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Rekap_TehKota_${record.branch}_${record.date}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Unduh Hasil Analisis AI sebagai TXT
 */
export function exportAiAnalysisToTxt(analysis: AiAnalysisResult, branchName: string): void {
  const lines: string[] = [
    '==================================================',
    `LAPORAN ANALISIS REKAPAN AI - TEH KOTA`,
    `Cabang: ${branchName}`,
    `Waktu Analisis: ${new Date(analysis.timestamp).toLocaleString('id-ID')}`,
    '==================================================\n',
    '1. RINGKASAN EKSEKUTIF:',
    analysis.summary,
    '\n2. WAWASAN PERGERAKAN STOK & PENJUALAN:',
    ...analysis.stockInsights.map((s) => `• ${s}`),
    '\n3. DETEKSI ANOMALI & PERUBAHAN TIDAK BIASA:',
    ...analysis.anomalies.map((a) => `• ${a}`),
    '\n4. PERINGATAN STOK MENIPIS / KRITIS:',
    ...analysis.lowStockAlerts.map(
      (l) => `• [${l.item}] Sisa ST: ${l.currentSt} - Tindakan: ${l.recommendation}`
    ),
    '\n5. ANALISIS KEUANGAN & OMSET:',
    analysis.financialAnalysis,
  ];

  if (analysis.branchComparison) {
    lines.push('\n6. PERBANDINGAN PERFORMA ANTARCABANG:');
    lines.push(analysis.branchComparison);
  }

  lines.push('\n7. REKOMENDASI PENGELOLAAN STOK & EFISIENSI:');
  lines.push(...analysis.recommendations.map((r) => `• ${r}`));

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Analisis_AI_TehKota_${branchName.replace(/\s+/g, '_')}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Unduh Hasil Analisis AI sebagai PDF
 */
export function exportAiAnalysisToPdf(analysis: AiAnalysisResult, branchName: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  // Header
  doc.setFillColor(6, 78, 59);
  doc.rect(10, y, pageWidth - 20, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN ANALISIS REKAPAN AI - TEH KOTA', 15, y + 9);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cabang: ${branchName} | Dibuat: ${new Date(analysis.timestamp).toLocaleString('id-ID')}`, 15, y + 16);

  y += 28;

  function addSection(title: string, bodyText: string) {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 78, 59);
    doc.text(title, 10, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const splitLines = doc.splitTextToSize(bodyText, pageWidth - 20);
    doc.text(splitLines, 10, y);
    y += splitLines.length * 4.2 + 5;
  }

  function addBullets(title: string, items: string[]) {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 78, 59);
    doc.text(title, 10, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    items.forEach((item) => {
      const splitLines = doc.splitTextToSize(`• ${item}`, pageWidth - 24);
      if (y + splitLines.length * 4 > 275) {
        doc.addPage();
        y = 16;
      }
      doc.text(splitLines, 14, y);
      y += splitLines.length * 4.2;
    });
    y += 4;
  }

  addSection('1. RINGKASAN EKSEKUTIF', analysis.summary);
  addBullets('2. WAWASAN PENJUALAN & PERGERAKAN STOK', analysis.stockInsights);
  addBullets('3. DETEKSI ANOMALI & PERUBAHAN TIDAK BIASA', analysis.anomalies);
  
  if (analysis.lowStockAlerts && analysis.lowStockAlerts.length > 0) {
    addBullets(
      '4. PERINGATAN STOK MENIPIS / KRITIS',
      analysis.lowStockAlerts.map((l) => `[${l.item}] Sisa ST: ${l.currentSt} - Rekomendasi: ${l.recommendation}`)
    );
  }

  addSection('5. ANALISIS KEUANGAN & OMSET', analysis.financialAnalysis);

  if (analysis.branchComparison) {
    addSection('6. PERBANDINGAN PERFORMA ANTARCABANG', analysis.branchComparison);
  }

  addBullets('7. REKOMENDASI PENGELOLAAN STOK & EFISIENSI', analysis.recommendations);

  doc.save(`Analisis_AI_TehKota_${branchName.replace(/\s+/g, '_')}.pdf`);
}
