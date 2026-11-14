import { jsPDF } from 'jspdf';
import { AiAnalysisResult, BranchTransfer, RekapRecord } from '../types';
import { formatDateIndo, formatRupiah, getTodayDateStr } from './calculations';

const OFFICIAL_LOGO_URL = '/assets/aistudio/image_764559de.png';
let cachedLogoImage: HTMLImageElement | null = null;
let cachedLogoDataUrl: string | null = null;

async function loadOfficialLogoImage(): Promise<HTMLImageElement | null> {
  if (cachedLogoImage && cachedLogoImage.complete) {
    return cachedLogoImage;
  }
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedLogoImage = img;
      try {
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth || 256;
        tmp.height = img.naturalHeight || 256;
        const tctx = tmp.getContext('2d');
        if (tctx) {
          tctx.drawImage(img, 0, 0);
          cachedLogoDataUrl = tmp.toDataURL('image/png');
        }
      } catch {}
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = OFFICIAL_LOGO_URL;
  });
}

function drawCircularLogo(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#34d399';
  ctx.stroke();
  ctx.clip();

  if (logoImg) {
    const aspect = (logoImg.naturalWidth || 1) / (logoImg.naturalHeight || 1);
    const size = radius * 2;
    let drawW = size;
    let drawH = size;
    if (aspect > 1) {
      drawH = size / aspect;
    } else {
      drawW = size * aspect;
    }
    ctx.drawImage(logoImg, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }
  ctx.restore();
}

/**
 * Unduh Rekapan sebagai File CSV
 */
export function exportRecordToCsv(record: RekapRecord): void {
  const lines: string[] = [];

  lines.push(`REKAPAN TEH KOTA - CABANG ${record.branch.toUpperCase()}`);
  lines.push(`Tanggal;${record.date}`);
  lines.push(`Waktu Rekap;${record.timeStr || '-'}`);
  lines.push(`Kasir / Pencatat;${record.createdBy}`);
  lines.push(`Status;${record.status.toUpperCase()}`);
  lines.push('');

  lines.push('RINGKASAN KEUANGAN OUTLET');
  lines.push(`Total Omset (Kotor);Rp ${record.totalOmset}`);
  lines.push(`Total Pengeluaran;Rp ${record.totalPengeluaran}`);
  lines.push(`QRIS (Non-Tunai);Rp ${record.qris}`);
  lines.push(`Omset Akhir (Bersih);Rp ${record.omsetAkhir}`);
  lines.push('');

  const gula = record.gulaDetail || {
    gulaAmbil: 0,
    gulaKemarin: 0,
    sisaGula: 0,
    gulaCair: 0,
    habisGula: 0,
  };
  lines.push('REKAP KEBUTUHAN GULA PASIR (KG)');
  lines.push(`Gula Ambil (Baru);${gula.gulaAmbil} KG`);
  lines.push(`Gula Kemarin;${gula.gulaKemarin} KG`);
  lines.push(`Sisa Gula (Fisik);${gula.sisaGula} KG`);
  lines.push(`Gula Cair;${gula.gulaCair} KG`);
  lines.push(`Habis Gula (Otomatis);${gula.habisGula} KG`);
  lines.push('Rumus;Habis Gula = (Ambil + Kemarin) - Sisa - Cair');
  lines.push('');

  lines.push('TABEL REKAP STOK');
  lines.push('Kategori;Nama Barang;Satuan;IN (Masuk);OUT (Keluar);SA (Stok Awal);ST (Stok Akhir);SO (Opname)');
  for (const item of record.stocks) {
    lines.push(
      `"${item.category}";"${item.name}";"${item.unit}";${item.inQty};${item.outQty};${item.sa};${item.st};${item.so}`
    );
  }
  lines.push('');

  const cup = record.stocks.find((s) => s.name === 'CUP');
  if (cup && cup.cupDetail) {
    lines.push('DETAIL STOK OPNAME CUP');
    lines.push(`Jumlah Slop;${cup.cupDetail.slop} slop`);
    lines.push(`Jumlah Pcs;${cup.cupDetail.pcs} pcs`);
    lines.push(`Total Fisik SO;${cup.cupDetail.calculatedSo} pcs`);
    lines.push(`CUP Rusak;${cup.cupDetail.rusakPcs} pcs`);
    lines.push('');
  }

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
 * Buat Lembar Rekapan 2 Kolom A4 Otomatis di HTML5 Canvas dengan Logo Resmi Teh Kota Indonesia
 * Meniru persis lembar kertas rekapitulasi fisik outlet Teh Kota
 */
export function renderRecordCanvas(
  record: RekapRecord,
  logoImg: HTMLImageElement | null = cachedLogoImage
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = 2; // High-res crisp print
  const width = 1200;

  const bahanPokok = record.stocks.filter((s) => s.category === 'Perlengkapan / Bahan Pokok');
  const yoghurtSeries = record.stocks.filter((s) => s.category === 'Yoghurt Series');
  const chocoSeries = record.stocks.filter((s) => s.category === 'Choco Series');
  const teaSeries = record.stocks.filter((s) => s.category === 'Tea Series');
  const coffeeSeries = record.stocks.filter((s) => s.category === 'Coffee Series');

  const expCount = Math.max(record.expenses ? record.expenses.length : 0, 1);

  const rowHeight = 22;
  const headerRowHeight = 24;
  const gap = 12;

  const bahanHeight = headerRowHeight + bahanPokok.length * rowHeight;
  const yoghurtHeight = headerRowHeight + yoghurtSeries.length * rowHeight;
  const chocoHeight = headerRowHeight + chocoSeries.length * rowHeight;
  const pengeluaranHeight = headerRowHeight + (expCount + 1) * rowHeight;
  const leftTotalHeight = bahanHeight + gap + yoghurtHeight + gap + chocoHeight + gap + pengeluaranHeight;

  const teaHeight = headerRowHeight + teaSeries.length * rowHeight;
  const coffeeHeight = headerRowHeight + coffeeSeries.length * rowHeight;
  const gulaHeight = headerRowHeight + 4 * rowHeight + 28;
  const financialHeight = headerRowHeight + 4 * 26;
  const noteExtra = record.notes ? 56 : 0;
  const rightTotalHeight =
    teaHeight + gap + coffeeHeight + gap + gulaHeight + gap + financialHeight + noteExtra;

  const topHeaderHeight = 104;
  const bottomFooterHeight = 44;
  const contentHeight = Math.max(leftTotalHeight, rightTotalHeight);
  const totalHeight = topHeaderHeight + contentHeight + bottomFooterHeight;

  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);

  // Paper White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer paper border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, width - 20, totalHeight - 20);

  // Header Banner - Deep Emerald
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(16, 16, width - 32, 80);

  // Gold accent strip
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(16, 93, width - 32, 3);

  // Official Teh Kota Logo inside Header
  drawCircularLogo(ctx, logoImg, 56, 56, 28);

  // Header Left Title (shifted cleanly beside logo)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('REKAPAN TEH KOTA INDONESIA', 98, 46);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`CABANG: ${record.branch.toUpperCase()}`, 98, 70);

  // Header Right Info
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`TANGGAL: ${formatDateIndo(record.date)} (${record.date})`, width - 32, 46);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Kasir: ${record.createdBy}  |  Waktu: ${record.timeStr || '-'} WIB  |  Status: ${record.status.toUpperCase()}${
      record.lastEditedBy ? `  |  Revisi: ${record.lastEditedBy}` : ''
    }`,
    width - 32,
    70
  );
  ctx.textAlign = 'left';

  // 2-Column Layout
  const colW = 560;
  const leftX = 24;
  const rightX = 616;
  let leftY = 110;
  let rightY = 110;

  function drawStockTable(
    c: CanvasRenderingContext2D,
    title: string,
    items: typeof record.stocks,
    startX: number,
    startY: number,
    titleBg = '#064e3b'
  ): number {
    let curY = startY;

    c.fillStyle = titleBg;
    c.fillRect(startX, curY, colW, headerRowHeight);

    c.fillStyle = '#ffffff';
    c.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    c.fillText(title, startX + 8, curY + 16);

    const cols = [
      { label: 'IN', x: startX + 240, w: 64 },
      { label: 'OUT', x: startX + 304, w: 64 },
      { label: 'SA', x: startX + 368, w: 64 },
      { label: 'ST', x: startX + 432, w: 64 },
      { label: 'SO', x: startX + 496, w: 64 },
    ];

    cols.forEach((col) => {
      c.textAlign = 'center';
      c.fillText(col.label, col.x + col.w / 2, curY + 16);
    });
    c.textAlign = 'left';

    curY += headerRowHeight;

    items.forEach((item, idx) => {
      c.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      c.fillRect(startX, curY, colW, rowHeight);

      c.fillStyle = '#ecfdf5';
      c.fillRect(startX + 432, curY, 64, rowHeight);
      c.fillStyle = '#f1f5f9';
      c.fillRect(startX + 496, curY, 64, rowHeight);

      c.strokeStyle = '#e2e8f0';
      c.lineWidth = 1;
      c.strokeRect(startX, curY, colW, rowHeight);

      cols.forEach((col) => {
        c.beginPath();
        c.moveTo(col.x, curY);
        c.lineTo(col.x, curY + rowHeight);
        c.stroke();
      });

      c.fillStyle = '#0f172a';
      c.font = '600 11px "Plus Jakarta Sans", sans-serif';
      let displayName = item.name;
      if (item.name === 'CUP' && item.cupDetail) {
        displayName = `CUP (${item.cupDetail.slop}S+${item.cupDetail.pcs}p${
          item.cupDetail.rusakPcs ? `, R:${item.cupDetail.rusakPcs}` : ''
        })`;
      }
      c.fillText(displayName, startX + 8, curY + 15);

      c.font = '500 11px "Plus Jakarta Sans", monospace';
      c.textAlign = 'center';

      c.fillStyle = item.inQty > 0 ? '#047857' : '#94a3b8';
      c.fillText(item.inQty > 0 ? String(item.inQty) : '-', cols[0].x + cols[0].w / 2, curY + 15);

      c.fillStyle = item.outQty > 0 ? '#dc2626' : '#94a3b8';
      c.fillText(item.outQty > 0 ? String(item.outQty) : '-', cols[1].x + cols[1].w / 2, curY + 15);

      c.fillStyle = '#334155';
      c.fillText(String(item.sa), cols[2].x + cols[2].w / 2, curY + 15);

      c.fillStyle = '#065f46';
      c.font = 'bold 11px "Plus Jakarta Sans", monospace';
      c.fillText(String(item.st), cols[3].x + cols[3].w / 2, curY + 15);

      c.fillStyle = '#0f172a';
      c.font = 'bold 11px "Plus Jakarta Sans", monospace';
      c.fillText(String(item.so), cols[4].x + cols[4].w / 2, curY + 15);

      c.textAlign = 'left';
      curY += rowHeight;
    });

    return curY;
  }

  // --- LEFT COLUMN ---
  leftY = drawStockTable(ctx, 'NAMA BARANG (BAHAN POKOK)', bahanPokok, leftX, leftY, '#064e3b');
  leftY += gap;

  leftY = drawStockTable(ctx, 'YOGHURT SERIES', yoghurtSeries, leftX, leftY, '#0f766e');
  leftY += gap;

  leftY = drawStockTable(ctx, 'CHOCO SERIES', chocoSeries, leftX, leftY, '#78350f');
  leftY += gap;

  // Pengeluaran
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(leftX, leftY, colW, headerRowHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PENGELUARAN OPERASIONAL', leftX + 8, leftY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('HARGA (RP)', leftX + colW - 12, leftY + 16);
  ctx.textAlign = 'left';
  leftY += headerRowHeight;

  if (record.expenses && record.expenses.length > 0) {
    record.expenses.forEach((exp, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(leftX, leftY, colW, rowHeight);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(leftX, leftY, colW, rowHeight);

      ctx.fillStyle = '#334155';
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${idx + 1}. ${exp.name}`, leftX + 8, leftY + 15);

      ctx.font = '600 11px "Plus Jakarta Sans", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(formatRupiah(exp.amount), leftX + colW - 12, leftY + 15);
      ctx.textAlign = 'left';

      leftY += rowHeight;
    });
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(leftX, leftY, colW, rowHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(leftX, leftY, colW, rowHeight);
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('- Tidak ada pengeluaran operasional -', leftX + 8, leftY + 15);
    leftY += rowHeight;
  }

  ctx.fillStyle = '#fef2f2';
  ctx.fillRect(leftX, leftY, colW, headerRowHeight);
  ctx.strokeStyle = '#fecaca';
  ctx.strokeRect(leftX, leftY, colW, headerRowHeight);
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TOTAL PENGELUARAN', leftX + 8, leftY + 16);
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px "Plus Jakarta Sans", monospace';
  ctx.fillText(formatRupiah(record.totalPengeluaran), leftX + colW - 12, leftY + 16);
  ctx.textAlign = 'left';
  leftY += headerRowHeight;

  // --- RIGHT COLUMN ---
  rightY = drawStockTable(ctx, 'TEA SERIES', teaSeries, rightX, rightY, '#047857');
  rightY += gap;

  rightY = drawStockTable(ctx, 'COFFEE SERIES', coffeeSeries, rightX, rightY, '#451a03');
  rightY += gap;

  // Rekap Gula Pasir
  const gula = record.gulaDetail || {
    gulaAmbil: 0,
    gulaKemarin: 0,
    sisaGula: 0,
    gulaCair: 0,
    habisGula: 0,
  };

  ctx.fillStyle = '#065f46';
  ctx.fillRect(rightX, rightY, colW, headerRowHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('REKAP KEBUTUHAN GULA PASIR (KG)', rightX + 8, rightY + 16);
  rightY += headerRowHeight;

  const gulaRows = [
    { label: 'Gula Ambil (Baru)', val: `${gula.gulaAmbil} KG` },
    { label: 'Gula Kemarin (Sisa Hari Sebelumnya)', val: `${gula.gulaKemarin} KG` },
    { label: 'Sisa Gula (Fisik Belum Cair)', val: `${gula.sisaGula} KG` },
    { label: 'Gula Cair', val: `${gula.gulaCair} KG` },
  ];

  gulaRows.forEach((gr, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(rightX, rightY, colW, rowHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(rightX, rightY, colW, rowHeight);

    ctx.fillStyle = '#334155';
    ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(gr.label, rightX + 8, rightY + 15);

    ctx.font = 'bold 11px "Plus Jakarta Sans", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(gr.val, rightX + colW - 12, rightY + 15);
    ctx.textAlign = 'left';

    rightY += rowHeight;
  });

  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect(rightX, rightY, colW, 28);
  ctx.strokeStyle = '#10b981';
  ctx.strokeRect(rightX, rightY, colW, 28);

  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('GULA HABIS (Otomatis):', rightX + 8, rightY + 18);

  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#047857';
  ctx.fillText(
    `(${gula.gulaAmbil} + ${gula.gulaKemarin}) - ${gula.sisaGula} - ${gula.gulaCair}`,
    rightX + 165,
    rightY + 18
  );

  ctx.textAlign = 'right';
  ctx.font = 'bold 13px "Plus Jakarta Sans", monospace';
  ctx.fillStyle = '#065f46';
  ctx.fillText(`${gula.habisGula} KG`, rightX + colW - 12, rightY + 18);
  ctx.textAlign = 'left';

  rightY += 28 + gap;

  // Ringkasan Keuangan Outlet
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(rightX, rightY, colW, headerRowHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('RINGKASAN KEUANGAN OUTLET', rightX + 8, rightY + 16);
  rightY += headerRowHeight;

  const finRows = [
    { label: 'TOTAL OMSET (KOTOR)', val: formatRupiah(record.totalOmset), color: '#0f172a', bg: '#ffffff' },
    { label: 'TOTAL PENGELUARAN', val: formatRupiah(record.totalPengeluaran), color: '#dc2626', bg: '#fef2f2' },
    { label: 'QRIS (NON-TUNAI)', val: formatRupiah(record.qris), color: '#0284c7', bg: '#f0f9ff' },
    { label: 'OMSET AKHIR (SETORAN BERSIH)', val: formatRupiah(record.omsetAkhir), color: '#047857', bg: '#ecfdf5' },
  ];

  finRows.forEach((fr) => {
    ctx.fillStyle = fr.bg;
    ctx.fillRect(rightX, rightY, colW, 26);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(rightX, rightY, colW, 26);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(fr.label, rightX + 8, rightY + 17);

    ctx.textAlign = 'right';
    ctx.font = 'bold 13px "Plus Jakarta Sans", monospace';
    ctx.fillStyle = fr.color;
    ctx.fillText(fr.val, rightX + colW - 12, rightY + 17);
    ctx.textAlign = 'left';

    rightY += 26;
  });

  if (record.notes) {
    rightY += gap;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(rightX, rightY, colW, 44);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(rightX, rightY, colW, 44);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CATATAN OPERASIONAL:', rightX + 8, rightY + 16);
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    const notePreview = record.notes.replace(/\n/g, ' • ').slice(0, 95);
    ctx.fillText(notePreview, rightX + 8, rightY + 33);
    rightY += 44;
  }

  // Footer
  const maxEndY = Math.max(leftY, rightY) + 22;
  ctx.fillStyle = '#64748b';
  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Dicetak otomatis oleh Sistem Rekapan Teh Kota v1.4.0 • Cabang ${record.branch} • Tanggal Cetak: ${getTodayDateStr()}`,
    24,
    maxEndY
  );

  return canvas;
}

/**
 * Unduh Rekapan sebagai File PDF A4 2-Kolom (dengan Logo Resmi Teh Kota)
 */
export async function exportRecordToPdf(record: RekapRecord): Promise<void> {
  const logoImg = await loadOfficialLogoImage();
  const canvas = renderRecordCanvas(record, logoImg);
  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm

  const margin = 7;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const ratio = canvas.height / canvas.width;

  let drawW = maxW;
  let drawH = drawW * ratio;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH / ratio;
  }
  const offsetX = margin + (maxW - drawW) / 2;

  doc.addImage(imgData, 'JPEG', offsetX, margin, drawW, drawH);
  doc.save(`Rekap_TehKota_${record.branch}_${record.date}.pdf`);
}

/**
 * Unduh Rekapan sebagai File Gambar (PNG / JPG) dengan Logo Resmi Teh Kota
 */
export async function exportRecordToImage(record: RekapRecord, format: 'png' | 'jpeg'): Promise<void> {
  const logoImg = await loadOfficialLogoImage();
  const canvas = renderRecordCanvas(record, logoImg);
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
 * Unduh Laporan Catatan Pengiriman Barang Antarcabang sebagai PDF A4 Resmi
 */
export async function exportTransfersToPdf(
  transfers: BranchTransfer[],
  filterLabel = 'Semua Cabang'
): Promise<void> {
  await loadOfficialLogoImage();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 12;

  // Header Banner
  doc.setFillColor(6, 78, 59);
  doc.rect(10, y, pageWidth - 20, 24, 'F');
  if (cachedLogoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.circle(22, y + 12, 8.5, 'F');
      doc.addImage(cachedLogoDataUrl, 'PNG', 14, y + 4, 16, 16);
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN PENGIRIMAN BARANG ANTARCABANG - TEH KOTA', 34, y + 10);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Cakupan: ${filterLabel}  |  Total Catatan: ${transfers.length}  |  Dicetak: ${getTodayDateStr()}`,
    34,
    y + 17
  );

  y += 30;

  if (transfers.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text('Tidak ada data catatan pengiriman barang pada filter yang dipilih.', 12, y);
  } else {
    for (const tr of transfers) {
      const estimatedHeight = 26 + tr.items.length * 6;
      if (y + estimatedHeight > 280) {
        doc.addPage();
        y = 14;
      }

      // Transfer Card Header
      doc.setFillColor(241, 245, 249);
      doc.rect(10, y, pageWidth - 20, 14, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(10, y, pageWidth - 20, 14, 'S');

      doc.setTextColor(6, 78, 59);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${tr.transferNumber}  •  ${tr.senderBranch} -> ${tr.receiverBranch}`, 13, y + 5.5);

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Tanggal: ${tr.date}  |  Pengirim: ${tr.senderName}  |  Penerima: ${tr.receiverName || '-'}`,
        13,
        y + 11
      );

      // Status Pill Text on Right
      doc.setFont('helvetica', 'bold');
      if (tr.status === 'Diterima') doc.setTextColor(4, 120, 87);
      else if (tr.status === 'Ada Selisih') doc.setTextColor(180, 83, 9);
      else if (tr.status === 'Dibatalkan') doc.setTextColor(190, 18, 60);
      else doc.setTextColor(29, 78, 216);
      doc.text(tr.status.toUpperCase(), pageWidth - 13, y + 6, { align: 'right' });

      y += 14;

      // Items List
      for (const item of tr.items) {
        doc.setDrawColor(226, 232, 240);
        doc.rect(10, y, pageWidth - 20, 6, 'S');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`- ${item.itemName} (${item.unit})`, 14, y + 4.2);

        const qtyInfo =
          item.actualQty !== undefined
            ? `Kirim: ${item.sentQty} | Terima: ${item.actualQty}${
                item.discrepancy ? ` (Selisih: ${item.discrepancy > 0 ? '+' : ''}${item.discrepancy})` : ''
              }`
            : `Kirim: ${item.sentQty} ${item.unit}`;
        doc.text(qtyInfo, pageWidth - 14, y + 4.2, { align: 'right' });
        y += 6;
      }

      if (tr.notes || tr.confirmationNote) {
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const noteLine = [tr.notes ? `Catatan Kirim: ${tr.notes}` : '', tr.confirmationNote ? `Catatan Terima: ${tr.confirmationNote}` : '']
          .filter(Boolean)
          .join(' | ');
        doc.text(noteLine.slice(0, 110), 13, y + 4.2);
        y += 6;
      }

      y += 5;
    }
  }

  doc.save(`Pengiriman_Barang_TehKota_${getTodayDateStr()}.pdf`);
}

/**
 * Unduh Hasil Analisis AI sebagai TXT
 */
export function exportAiAnalysisToTxt(analysis: AiAnalysisResult, branchName: string): void {
  const stockInsights = analysis.stockInsights || [];
  const anomalies = analysis.anomalies || [];
  const lowStockAlerts = analysis.lowStockAlerts || [];
  const recommendations = analysis.recommendations || [];

  const lines: string[] = [
    '==================================================',
    `LAPORAN ANALISIS REKAPAN AI - TEH KOTA INDONESIA`,
    `Cabang: ${branchName}`,
    `Waktu Analisis: ${new Date(analysis.timestamp || Date.now()).toLocaleString('id-ID')}`,
    '==================================================\n',
    '1. RINGKASAN EKSEKUTIF:',
    analysis.summary || '-',
    '\n2. WAWASAN PERGERAKAN STOK & PENJUALAN:',
    ...stockInsights.map((s) => `• ${s}`),
    '\n3. DETEKSI ANOMALI & PERUBAHAN TIDAK BIASA:',
    ...anomalies.map((a) => `• ${a}`),
    '\n4. PERINGATAN STOK MENIPIS / KRITIS:',
    ...lowStockAlerts.map(
      (l) => `• [${l.item}] Sisa ST: ${l.currentSt} - Tindakan: ${l.recommendation}`
    ),
    '\n5. ANALISIS KEUANGAN & OMSET:',
    analysis.financialAnalysis || '-',
  ];

  if (analysis.branchComparison) {
    lines.push('\n6. PERBANDINGAN PERFORMA ANTARCABANG:');
    lines.push(analysis.branchComparison);
  }

  lines.push('\n7. REKOMENDASI PENGELOLAAN STOK & EFISIENSI:');
  lines.push(...recommendations.map((r) => `• ${r}`));

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
export async function exportAiAnalysisToPdf(analysis: AiAnalysisResult, branchName: string): Promise<void> {
  await loadOfficialLogoImage();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFillColor(6, 78, 59);
  doc.rect(10, y, pageWidth - 20, 24, 'F');
  if (cachedLogoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.circle(21, y + 12, 8, 'F');
      doc.addImage(cachedLogoDataUrl, 'PNG', 13.5, y + 4.5, 15, 15);
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13.5);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN ANALISIS REKAPAN AI - TEH KOTA', 33, y + 10);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Cabang: ${branchName} | Dibuat: ${new Date(analysis.timestamp || Date.now()).toLocaleString('id-ID')}`,
    33,
    y + 17
  );

  y += 30;

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
    const splitLines = doc.splitTextToSize(bodyText || '-', pageWidth - 20);
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
    if (!items || items.length === 0) {
      doc.text('• Tidak ada data khusus', 14, y);
      y += 4.2;
    } else {
      items.forEach((item) => {
        const splitLines = doc.splitTextToSize(`• ${item}`, pageWidth - 24);
        if (y + splitLines.length * 4 > 275) {
          doc.addPage();
          y = 16;
        }
        doc.text(splitLines, 14, y);
        y += splitLines.length * 4.2;
      });
    }
    y += 4;
  }

  addSection('1. RINGKASAN EKSEKUTIF', analysis.summary || 'Analisis operasional selesai.');
  addBullets('2. WAWASAN PENJUALAN & PERGERAKAN STOK', analysis.stockInsights || []);
  addBullets('3. DETEKSI ANOMALI & PERUBAHAN TIDAK BIASA', analysis.anomalies || []);

  if (analysis.lowStockAlerts && analysis.lowStockAlerts.length > 0) {
    addBullets(
      '4. PERINGATAN STOK MENIPIS / KRITIS',
      analysis.lowStockAlerts.map(
        (l) => `[${l.item}] Sisa ST: ${l.currentSt} - Rekomendasi: ${l.recommendation}`
      )
    );
  }

  addSection('5. ANALISIS KEUANGAN & OMSET', analysis.financialAnalysis || 'Pencatatan keuangan tertib.');

  if (analysis.branchComparison) {
    addSection('6. PERBANDINGAN PERFORMA ANTARCABANG', analysis.branchComparison);
  }

  addBullets('7. REKOMENDASI PENGELOLAAN STOK & EFISIENSI', analysis.recommendations || []);

  doc.save(`Analisis_AI_TehKota_${branchName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Unduh Hasil Analisis AI sebagai Gambar (JPG)
 */
export async function exportAiAnalysisToImage(analysis: AiAnalysisResult, branchName: string): Promise<void> {
  const logoImg = await loadOfficialLogoImage();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 1080;
  const stockInsights = analysis.stockInsights || [];
  const anomalies = analysis.anomalies || [];
  const lowStockAlerts = analysis.lowStockAlerts || [];
  const recommendations = analysis.recommendations || [];

  let estimatedHeight = 580;
  estimatedHeight += (analysis.summary || '').length * 0.45;
  estimatedHeight += stockInsights.length * 40;
  estimatedHeight += anomalies.length * 40;
  estimatedHeight += lowStockAlerts.length * 55;
  estimatedHeight += (analysis.financialAnalysis || '').length * 0.45;
  if (analysis.branchComparison) estimatedHeight += analysis.branchComparison.length * 0.45 + 50;
  estimatedHeight += recommendations.length * 40;

  const totalHeight = Math.max(1400, Math.ceil(estimatedHeight));
  canvas.width = width;
  canvas.height = totalHeight;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, totalHeight);

  const bannerHeight = 135;
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, 0, width, bannerHeight);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, bannerHeight - 6, width, 6);

  drawCircularLogo(ctx, logoImg, 78, 66, 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
  ctx.fillText('LAPORAN ANALISIS REKAPAN AI • TEH KOTA', 132, 54);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.fillText(
    `Cabang: ${branchName} | Dibuat: ${new Date(analysis.timestamp || Date.now()).toLocaleString('id-ID')} WIB`,
    132,
    86
  );

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.fillText('SISTEM OTOMASI AUDIT STOK & OMSET HARIAN', 132, 110);

  let currentY = bannerHeight + 35;
  const contentWidth = width - 80;

  function drawWrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    if (!ctx) return y;
    const words = text.split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
    return curY + lineHeight;
  }

  function drawSectionBox(
    title: string,
    bgColor: string,
    borderColor: string,
    titleColor: string,
    drawBody: (yStart: number) => number
  ) {
    if (!ctx) return;
    const startY = currentY;
    const padding = 20;

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;

    ctx.font = '15px "Trebuchet MS", sans-serif';
    const measuredEndY = drawBody(startY + 45);
    const boxHeight = measuredEndY - startY + 15;

    const r = 12;
    ctx.beginPath();
    ctx.moveTo(40 + r, startY);
    ctx.lineTo(40 + contentWidth - r, startY);
    ctx.quadraticCurveTo(40 + contentWidth, startY, 40 + contentWidth, startY + r);
    ctx.lineTo(40 + contentWidth, startY + boxHeight - r);
    ctx.quadraticCurveTo(40 + contentWidth, startY + boxHeight, 40 + contentWidth - r, startY + boxHeight);
    ctx.lineTo(40 + r, startY + boxHeight);
    ctx.quadraticCurveTo(40, startY + boxHeight, 40, startY + boxHeight - r);
    ctx.lineTo(40, startY + r);
    ctx.quadraticCurveTo(40, startY, 40 + r, startY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = titleColor;
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillText(title, 40 + padding, startY + 28);

    drawBody(startY + 54);
    currentY = startY + boxHeight + 20;
  }

  drawSectionBox('1. RINGKASAN EKSEKUTIF', '#ffffff', '#cbd5e1', '#064e3b', (yStart) => {
    ctx.fillStyle = '#1e293b';
    ctx.font = '15px "Trebuchet MS", sans-serif';
    return drawWrappedText(analysis.summary || '-', 60, yStart, contentWidth - 40, 24);
  });

  drawSectionBox('2. WAWASAN PENJUALAN & PERGERAKAN STOK', '#ffffff', '#cbd5e1', '#064e3b', (yStart) => {
    let y = yStart;
    ctx.font = '14px "Trebuchet MS", sans-serif';
    stockInsights.forEach((item) => {
      ctx.fillStyle = '#059669';
      ctx.fillText('•', 60, y);
      ctx.fillStyle = '#334155';
      y = drawWrappedText(item, 80, y, contentWidth - 60, 22) + 2;
    });
    return y;
  });

  if (anomalies.length > 0) {
    drawSectionBox('3. DETEKSI ANOMALI & PERUBAHAN STOK TIDAK BIASA', '#fffbeb', '#fcd34d', '#92400e', (yStart) => {
      let y = yStart;
      ctx.font = '14px "Trebuchet MS", sans-serif';
      anomalies.forEach((anom) => {
        ctx.fillStyle = '#d97706';
        ctx.fillText('!', 65, y);
        ctx.fillStyle = '#78350f';
        y = drawWrappedText(anom, 85, y, contentWidth - 65, 22) + 2;
      });
      return y;
    });
  }

  if (lowStockAlerts.length > 0) {
    drawSectionBox('4. PERINGATAN STOK KRITIS (PERLU RESTOCK SEGERA)', '#fff1f2', '#fecdd3', '#9f1239', (yStart) => {
      let y = yStart;
      ctx.font = '14px "Trebuchet MS", sans-serif';
      lowStockAlerts.forEach((alert) => {
        ctx.fillStyle = '#e11d48';
        ctx.fillText(`• [${alert.item}] Sisa ST: ${alert.currentSt}`, 60, y);
        y += 20;
        ctx.fillStyle = '#881337';
        y = drawWrappedText(`Tindakan: ${alert.recommendation}`, 80, y, contentWidth - 60, 20) + 4;
      });
      return y;
    });
  }

  drawSectionBox('5. ANALISIS KEUANGAN, QRIS, & MARGIN', '#ffffff', '#cbd5e1', '#064e3b', (yStart) => {
    ctx.fillStyle = '#1e293b';
    ctx.font = '15px "Trebuchet MS", sans-serif';
    return drawWrappedText(analysis.financialAnalysis || '-', 60, yStart, contentWidth - 40, 24);
  });

  if (analysis.branchComparison) {
    drawSectionBox('6. PERBANDINGAN PERFORMA ANTARCABANG', '#ecfdf5', '#a7f3d0', '#065f46', (yStart) => {
      ctx.fillStyle = '#064e3b';
      ctx.font = '15px "Trebuchet MS", sans-serif';
      return drawWrappedText(analysis.branchComparison || '-', 60, yStart, contentWidth - 40, 24);
    });
  }

  drawSectionBox('7. REKOMENDASI PENGELOLAAN STOK & EFISIENSI BIAYA', '#ffffff', '#cbd5e1', '#064e3b', (yStart) => {
    let y = yStart;
    ctx.font = '14px "Trebuchet MS", sans-serif';
    recommendations.forEach((rec) => {
      ctx.fillStyle = '#059669';
      ctx.fillText('✓', 60, y);
      ctx.fillStyle = '#1e293b';
      y = drawWrappedText(rec, 85, y, contentWidth - 65, 22) + 2;
    });
    return y;
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillText(
    `Aplikasi Rekapan & AI Teh Kota • Dokumen resmi dihasilkan otomatis untuk Cabang ${branchName}`,
    40,
    currentY + 15
  );

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Analisis_AI_TehKota_${branchName.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
