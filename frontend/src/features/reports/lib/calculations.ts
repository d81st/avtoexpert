import type { RepairWork, SparePart, Material, PaintWork } from '@/features/reports/types';
export { formatSum } from '@/shared/lib/formatters';

export const BT_COEFFICIENTS: Record<string, number> = {
  'BT-1': 1.0,
  'BT-2': 1.5,
  'BT-3': 2.0,
};

export function calcRepairWorkPrice(hourlyRate: number, complexity: string): number {
  const coefficient = BT_COEFFICIENTS[complexity] ?? 1;
  return Math.round(hourlyRate * coefficient);
}

export function calcAverageAnalogPrice(prices: number[]): number | null {
  const valid = prices.filter((p) => p > 0);
  if (valid.length !== 3) return null;
  return Math.round(valid.reduce((sum, p) => sum + p, 0) / 3);
}

export function calcMarketPrice(averagePrice: number, depreciationPct: number): number {
  return Math.round(averagePrice * (1 - depreciationPct / 100));
}

export function calcRepairWorksTotal(repairWorks: RepairWork[]): number {
  return repairWorks.reduce((sum, work) => sum + (work.price > 0 ? work.price : 0), 0);
}

export function calcPaintWorksTotal(paintWorks: PaintWork[]): number {
  return paintWorks.reduce(
    (sum, work) => sum + (work.paint_price > 0 ? work.paint_price : 0) + (work.polish_price > 0 ? work.polish_price : 0),
    0
  );
}

export function calcSparePartsTotal(spareParts: SparePart[]): number {
  return spareParts.reduce(
    (sum, part) => sum + (part.qty > 0 && part.price >= 0 ? part.qty * part.price : 0),
    0
  );
}

export function calcSparePartsWithWear(total: number, depreciationPct: number): number {
  return Math.round(total * (1 - depreciationPct / 100));
}

export function calcMaterialsTotal(materials: Material[]): number {
  return materials.reduce(
    (sum, mat) => sum + (mat.qty > 0 && mat.price >= 0 ? mat.qty * mat.price : 0),
    0
  );
}

export function calcGrandTotal(params: {
  repairWorks: RepairWork[];
  paintWorks: PaintWork[];
  spareParts: SparePart[];
  materials: Material[];
  depreciationPct: number;
}): {
  totalWorks: number;
  totalSparePartsFull: number;
  totalSparePartsWithWear: number;
  totalMaterials: number;
  grandTotal: number;
} {
  const totalWorks = calcRepairWorksTotal(params.repairWorks) + calcPaintWorksTotal(params.paintWorks);
  const totalSparePartsFull = calcSparePartsTotal(params.spareParts);
  const totalSparePartsWithWear = calcSparePartsWithWear(totalSparePartsFull, params.depreciationPct);
  const totalMaterials = calcMaterialsTotal(params.materials);
  const grandTotal = totalWorks + totalSparePartsWithWear + totalMaterials;

  return {
    totalWorks,
    totalSparePartsFull,
    totalSparePartsWithWear,
    totalMaterials,
    grandTotal,
  };
}
