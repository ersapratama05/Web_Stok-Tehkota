import { ItemCategory, StockItemRow } from '../types';

export interface BaseItemConfig {
  name: string;
  category: ItemCategory;
  unit: string;
  defaultSa: number;
}

export const TEH_KOTA_ITEMS: BaseItemConfig[] = [
  // A. Perlengkapan / Bahan Pokok
  { name: 'CUP', category: 'Perlengkapan / Bahan Pokok', unit: 'pcs', defaultSa: 0 },
  { name: 'SEALER', category: 'Perlengkapan / Bahan Pokok', unit: 'roll', defaultSa: 0 },
  { name: 'SEDOTAN KECIL', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'TUTUP CUP', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'PLASTIK SATUAN', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'PLASTIK 15', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'PLASTIK 21', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'PLASTIK 28', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'PLASTIK JUMBO', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'PLASTIK SAMPAH', category: 'Perlengkapan / Bahan Pokok', unit: 'pack', defaultSa: 0 },
  { name: 'SUSU UHT', category: 'Perlengkapan / Bahan Pokok', unit: 'kotak', defaultSa: 0 },
  { name: 'SUSU CARNATION', category: 'Perlengkapan / Bahan Pokok', unit: 'kaleng', defaultSa: 0 },
  { name: 'GULA PASIR', category: 'Perlengkapan / Bahan Pokok', unit: 'kg', defaultSa: 0 },

  // B. Yoghurt Series
  { name: 'Yoghurt Lemon', category: 'Yoghurt Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Yoghurt Leci', category: 'Yoghurt Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Yoghurt Mango', category: 'Yoghurt Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Yoghurt Blueberry', category: 'Yoghurt Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Yoghurt Strawberry', category: 'Yoghurt Series', unit: 'porsi', defaultSa: 0 },

  // C. Choco Series
  { name: 'Choco Vanilla', category: 'Choco Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Choco Matcha', category: 'Choco Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Choco Banana', category: 'Choco Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Choco Klepon', category: 'Choco Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Choco Avocado', category: 'Choco Series', unit: 'porsi', defaultSa: 0 },

  // D. Tea Series
  { name: 'DAUN TEH', category: 'Tea Series', unit: 'pack', defaultSa: 0 },
  { name: 'LEMON', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'LECI', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'PASSION', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'MELON', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'APEL', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'MANGGA', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Thai Tea', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'GRAPE', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'MATCHA', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'SILVERQUEN', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'REDVELVET', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'TARO', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Royal Choco', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },
  { name: 'TIRAMISU', category: 'Tea Series', unit: 'porsi', defaultSa: 0 },

  // E. Coffee Series
  { name: 'VIETNAM COFFEE', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
  { name: 'VANILLA LATE', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
  { name: 'AVOCADO COFFEE', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
  { name: 'BROWN SUGAR', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
  { name: 'CREAMY MACHIATO', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
  { name: 'COOKIES AND CREAM', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
  { name: 'Espresso Latte', category: 'Coffee Series', unit: 'porsi', defaultSa: 0 },
];

export const CATEGORIES_ORDER: ItemCategory[] = [
  'Perlengkapan / Bahan Pokok',
  'Yoghurt Series',
  'Choco Series',
  'Tea Series',
  'Coffee Series',
];

export function createInitialStockRows(previousStMap?: Record<string, number>): StockItemRow[] {
  return TEH_KOTA_ITEMS.map((item) => {
    const sa = previousStMap && previousStMap[item.name] !== undefined 
      ? previousStMap[item.name] 
      : item.defaultSa;
    
    const row: StockItemRow = {
      name: item.name,
      category: item.category,
      unit: item.unit,
      sa,
      inQty: 0,
      outQty: 0,
      st: sa, // SA + 0 - 0 = sa
      so: sa,
    };

    if (item.name === 'CUP') {
      const positiveSa = Math.max(0, sa);
      const slops = Math.floor(positiveSa / 50);
      const remainingPcs = positiveSa % 50;
      row.cupDetail = {
        slop: slops,
        pcs: remainingPcs,
        rusakPcs: 0,
        calculatedSo: positiveSa,
      };
    }

    return row;
  });
}
