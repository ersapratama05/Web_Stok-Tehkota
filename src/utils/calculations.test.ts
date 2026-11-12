import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStokAkhir,
  calculateCupSO,
  calculateHabisGula,
  calculateTotalPengeluaran,
  calculateOmsetAkhir,
  calculateStokSelisih,
  formatNumberId,
  parseRupiahInput,
} from './calculations';

test('Rumus ST = SA + IN - OUT', () => {
  // SA: 100, IN: 50, OUT: 30 -> ST: 120
  assert.equal(calculateStokAkhir(100, 50, 30), 120);

  // SA: 0, IN: 200, OUT: 150 -> ST: 50
  assert.equal(calculateStokAkhir(0, 200, 150), 50);

  // Negative or edge cases
  assert.equal(calculateStokAkhir(50, 0, 10), 40);
  assert.equal(calculateStokAkhir(10, 0, 10), 0);
});

test('Rumus SO CUP: 1 slop = 50 pcs', () => {
  // 5 slop + 12 pcs = 5 * 50 + 12 = 262 pcs
  assert.equal(calculateCupSO(5, 12), 262);

  // 10 slop + 0 pcs = 500 pcs
  assert.equal(calculateCupSO(10, 0), 500);

  // 0 slop + 37 pcs = 37 pcs
  assert.equal(calculateCupSO(0, 37), 37);
});

test('Rumus Habis Gula = (Ambil + Kemarin) - Sisa Gula - Gula Cair', () => {
  // Ambil: 10, Kemarin: 5, Sisa: 3, Cair: 2 -> (10 + 5) - 3 - 2 = 10
  assert.equal(calculateHabisGula(10, 5, 3, 2), 10);

  // Ambil: 20, Kemarin: 0, Sisa: 5, Cair: 3 -> (20 + 0) - 5 - 3 = 12
  assert.equal(calculateHabisGula(20, 0, 5, 3), 12);

  // Decimal case: Ambil 12.5, Kemarin 2.5, Sisa 4, Cair 1 -> (15) - 5 = 10
  assert.equal(calculateHabisGula(12.5, 2.5, 4, 1), 10);

  // Zero / empty inputs
  assert.equal(calculateHabisGula(0, 0, 0, 0), 0);
  assert.equal(calculateHabisGula(null, undefined, '', 0), 0);
});

test('Total Pengeluaran otomatis dari seluruh baris', () => {
  const expenses = [
    { id: '1', name: 'Es Batu Kristal', amount: 35000 },
    { id: '2', name: 'Kresek Sampah', amount: 15000 },
    { id: '3', name: 'Air Galon', amount: 18000 },
  ];
  assert.equal(calculateTotalPengeluaran(expenses), 68000);

  // Empty list returns 0
  assert.equal(calculateTotalPengeluaran([]), 0);
});

test('Rumus OMSET AKHIR = TOTAL OMSET - TOTAL PENGELUARAN - QRIS', () => {
  const totalOmset = 1500000;
  const totalPengeluaran = 68000;
  const qris = 432000;
  // 1500000 - 68000 - 432000 = 1000000
  assert.equal(calculateOmsetAkhir(totalOmset, totalPengeluaran, qris), 1000000);

  // Zero values
  assert.equal(calculateOmsetAkhir(500000, 0, 0), 500000);
});

test('Selisih Stok SO - ST', () => {
  // ST Buku = 120, Fisik SO = 118 -> -2 (hilang 2)
  assert.equal(calculateStokSelisih(120, 118), -2);

  // ST Buku = 50, Fisik SO = 55 -> +5 (lebih 5)
  assert.equal(calculateStokSelisih(50, 55), 5);
});

test('Parsing dan format Rupiah dengan pemisah ribuan titik', () => {
  // Format pemisah titik
  assert.equal(formatNumberId(10000), '10.000');
  assert.equal(formatNumberId(1000000), '1.000.000');
  assert.equal(formatNumberId(50000), '50.000');
  assert.equal(formatNumberId(0), '0');

  // Parse input dengan atau tanpa titik
  assert.equal(parseRupiahInput('Rp 1.500.000'), 1500000);
  assert.equal(parseRupiahInput('75.000'), 75000);
  assert.equal(parseRupiahInput('10000'), 10000);
  assert.equal(parseRupiahInput('10.0000'), 100000);
  assert.equal(parseRupiahInput(''), 0);
});
