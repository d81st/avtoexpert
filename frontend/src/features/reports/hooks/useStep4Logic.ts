import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormStore } from "../model/useFormStore";
import type { Material, PaintWork, RepairWork, SparePart, Step4Data } from "../types";
import { calcRepairWorkPrice } from "../lib/calculations";
import { validateStep4 } from "../lib/validators";
import { useEditableList } from "./useEditableList";

interface UseStep4LogicParams {
  onValidationChange: (isValid: boolean) => void;
}

interface Step4Patch {
  hourly_rate?: number;
  repair_works?: RepairWork[];
  paint_works?: PaintWork[];
  spare_parts?: SparePart[];
  materials?: Material[];
}

export function useStep4Logic({ onValidationChange }: UseStep4LogicParams) {
  const { step4, setStep4 } = useFormStore();
  const [hourlyRate, setHourlyRate] = useState(50000);
  const {
    items: repairWorks,
    replaceItems: replaceRepairWorks,
    addItem: addRepairWorkItem,
    updateItem: updateRepairWorkItem,
    removeItem: removeRepairWorkItem,
  } = useEditableList<RepairWork>();
  const {
    items: paintWorks,
    replaceItems: replacePaintWorks,
    addItem: addPaintWorkItem,
    updateItem: updatePaintWorkItem,
    removeItem: removePaintWorkItem,
  } = useEditableList<PaintWork>();
  const {
    items: spareParts,
    replaceItems: replaceSpareParts,
    addItem: addSparePartItem,
    updateItem: updateSparePartItem,
    removeItem: removeSparePartItem,
  } = useEditableList<SparePart>();
  const {
    items: materials,
    replaceItems: replaceMaterials,
    addItem: addMaterialItem,
    updateItem: updateMaterialItem,
    removeItem: removeMaterialItem,
  } = useEditableList<Material>();

  const buildStep4Data = useCallback(
    (patch: Step4Patch = {}): Step4Data => ({
      hourly_rate: patch.hourly_rate ?? hourlyRate,
      repair_works: patch.repair_works ?? repairWorks,
      paint_works: patch.paint_works ?? paintWorks,
      spare_parts: patch.spare_parts ?? spareParts,
      materials: patch.materials ?? materials,
    }),
    [hourlyRate, repairWorks, paintWorks, spareParts, materials],
  );

  const save = useCallback(
    (patch: Step4Patch = {}) => {
      setStep4(buildStep4Data(patch));
    },
    [buildStep4Data, setStep4],
  );

  useEffect(() => {
    if (step4) {
      // Existing draft hydration copies persisted form data into editable local lists.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHourlyRate(step4.hourly_rate);
      replaceRepairWorks(step4.repair_works || []);
      replacePaintWorks(step4.paint_works || []);
      replaceSpareParts(step4.spare_parts || []);
      replaceMaterials(step4.materials || []);
    }
  }, [step4, replaceRepairWorks, replacePaintWorks, replaceSpareParts, replaceMaterials]);

  useEffect(() => {
    onValidationChange(validateStep4(buildStep4Data()));
  }, [buildStep4Data, onValidationChange]);

  const recalcRepairPrices = useCallback(
    (rate: number, works: RepairWork[]): RepairWork[] =>
      works.map((work) => ({
        ...work,
        price: calcRepairWorkPrice(rate, work.complexity),
      })),
    [],
  );

  const handleHourlyRateChange = (value: number) => {
    const updatedWorks = recalcRepairPrices(value, repairWorks);
    setHourlyRate(value);
    replaceRepairWorks(updatedWorks);
    save({ hourly_rate: value, repair_works: updatedWorks });
  };

  const addRepairWork = () => {
    const updated = addRepairWorkItem({
      part_name: "",
      type: "Bo'luvchi",
      complexity: "BT-1",
      price: calcRepairWorkPrice(hourlyRate, "BT-1"),
    });
    save({ repair_works: updated });
  };

  const updateRepairWork = (
    index: number,
    field: keyof RepairWork,
    value: RepairWork[keyof RepairWork],
  ) => {
    const patch: Partial<RepairWork> = { [field]: value };
    if (field === "complexity") {
      patch.price = calcRepairWorkPrice(hourlyRate, value as RepairWork["complexity"]);
    }
    const updated = updateRepairWorkItem(index, patch);
    save({ repair_works: updated });
  };

  const removeRepairWork = (index: number) => {
    const updated = removeRepairWorkItem(index);
    save({ repair_works: updated });
  };

  const addPaintWork = () => {
    const updated = addPaintWorkItem({
      part_name: "",
      paint_price: 0,
      polish_price: 0,
    });
    save({ paint_works: updated });
  };

  const updatePaintWork = (
    index: number,
    field: keyof PaintWork,
    value: PaintWork[keyof PaintWork],
  ) => {
    const updated = updatePaintWorkItem(index, { [field]: value });
    save({ paint_works: updated });
  };

  const removePaintWork = (index: number) => {
    const updated = removePaintWorkItem(index);
    save({ paint_works: updated });
  };

  const addSparePart = () => {
    const updated = addSparePartItem({ name: "", qty: 1, price: 0 });
    save({ spare_parts: updated });
  };

  const updateSparePart = (
    index: number,
    field: keyof SparePart,
    value: SparePart[keyof SparePart],
  ) => {
    const updated = updateSparePartItem(index, { [field]: value });
    save({ spare_parts: updated });
  };

  const removeSparePart = (index: number) => {
    const updated = removeSparePartItem(index);
    save({ spare_parts: updated });
  };

  const addMaterial = () => {
    const updated = addMaterialItem({ name: "", qty: 1, price: 0 });
    save({ materials: updated });
  };

  const updateMaterial = (
    index: number,
    field: keyof Material,
    value: Material[keyof Material],
  ) => {
    const updated = updateMaterialItem(index, { [field]: value });
    save({ materials: updated });
  };

  const removeMaterial = (index: number) => {
    const updated = removeMaterialItem(index);
    save({ materials: updated });
  };

  const totals = useMemo(
    () => ({
      totalRepair: repairWorks.reduce((sum, work) => sum + work.price, 0),
      totalPaint: paintWorks.reduce(
        (sum, work) => sum + work.paint_price + work.polish_price,
        0,
      ),
      totalSpare: spareParts.reduce(
        (sum, part) => sum + part.qty * part.price,
        0,
      ),
      totalMat: materials.reduce(
        (sum, material) => sum + material.qty * material.price,
        0,
      ),
    }),
    [repairWorks, paintWorks, spareParts, materials],
  );

  return {
    hourlyRate,
    repairWorks,
    paintWorks,
    spareParts,
    materials,
    totals,
    handleHourlyRateChange,
    addRepairWork,
    updateRepairWork,
    removeRepairWork,
    addPaintWork,
    updatePaintWork,
    removePaintWork,
    addSparePart,
    updateSparePart,
    removeSparePart,
    addMaterial,
    updateMaterial,
    removeMaterial,
  };
}
