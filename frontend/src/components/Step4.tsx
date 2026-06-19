import {
  COMPLEXITY_OPTIONS,
  PART_TYPES,
  REPAIR_PART_NAMES,
} from '@/constants/reference';
import { useStep4Logic } from '@/hooks/useStep4Logic';
import FieldLabel from '@/components/FieldLabel';
import Input from '@/components/Input';
import Button from '@/components/Button';

function Step4({ onValidationChange }: { onValidationChange: (isValid: boolean) => void }) {
  const {
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
  } = useStep4Logic({ onValidationChange });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{'\u0428\u0430\u0433 4: Tamirlash'}</h2>
        <p className="text-sm text-gray-600 mt-2">
          {'\u0420\u0435\u043c\u043e\u043d\u0442\u043d\u044b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b, \u043f\u043e\u043a\u0440\u0430\u0441\u043a\u0430, \u0437\u0430\u043f\u0447\u0430\u0441\u0442\u0438 \u0438 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b'}
        </p>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">4.1 {'\u2014'} {'\u041d\u043e\u0440\u043c\u043e-\u0447\u0430\u0441'}</h3>
        <Input
          type="number"
          id="hourlyRate"
          label={'\u041d\u043e\u0440\u043c\u043e-\u0447\u0430\u0441 (\u0441\u0443\u043c) / Usta haqqi'}
          value={hourlyRate}
          onChange={(e) => handleHourlyRateChange(parseFloat(e.target.value) || 0)}
          error={hourlyRate <= 0 ? '\u041d\u043e\u0440\u043c\u043e-\u0447\u0430\u0441 \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0' : undefined}
          required
        />
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.2 {'\u2014'} {'\u0420\u0435\u043c\u043e\u043d\u0442\u043d\u044b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b'}</h3>
          <Button onClick={addRepairWork} variant="primary" size="sm">+ {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}</Button>
        </div>

        {repairWorks.length === 0 && (
          <p className="text-gray-500 text-sm mb-4">{'\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043c\u0438\u043d\u0438\u043c\u0443\u043c \u043e\u0434\u043d\u0443 \u0440\u0435\u043c\u043e\u043d\u0442\u043d\u0443\u044e \u0440\u0430\u0431\u043e\u0442\u0443'}</p>
        )}

        {repairWorks.map((work, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <FieldLabel ru={'\u0414\u0435\u0442\u0430\u043b\u044c'} uz="Detal" />
                <input
                  list={`repair-parts-${index}`}
                  value={work.part_name}
                  onChange={(e) => updateRepairWork(index, 'part_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <datalist id={`repair-parts-${index}`}>
                  {REPAIR_PART_NAMES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <FieldLabel ru={'\u0422\u0438\u043f'} uz="Turi" />
                <select
                  value={work.type}
                  onChange={(e) => updateRepairWork(index, 'type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {PART_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel ru={'\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c'} uz="Murakkablik" />
                <select
                  value={work.complexity}
                  onChange={(e) => updateRepairWork(index, 'complexity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {COMPLEXITY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel ru={'\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c'} uz="Narxi" />
                <input type="number" value={work.price} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-100" />
              </div>
              <button type="button" onClick={() => removeRepairWork(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm">
                {'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.3 {'\u2014'} {'\u041f\u043e\u043a\u0440\u0430\u0441\u043e\u0447\u043d\u044b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b'}</h3>
          <Button onClick={addPaintWork} variant="primary" size="sm">+ {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}</Button>
        </div>
        {paintWorks.map((work, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Input label={'\u0414\u0435\u0442\u0430\u043b\u044c / Detal'} value={work.part_name} onChange={(e) => updatePaintWork(index, 'part_name', e.target.value)} />
              <Input type="number" label={"\u041f\u043e\u043a\u0440\u0430\u0441\u043a\u0430 / Bo'yoq"} value={work.paint_price || ''} onChange={(e) => updatePaintWork(index, 'paint_price', parseFloat(e.target.value) || 0)} min={0} />
              <Input type="number" label={'\u041f\u043e\u043b\u0438\u0440\u043e\u0432\u043a\u0430 / Politura'} value={work.polish_price || ''} onChange={(e) => updatePaintWork(index, 'polish_price', parseFloat(e.target.value) || 0)} min={0} />
              <button type="button" onClick={() => removePaintWork(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm">{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.4 {'\u2014'} {'\u0417\u0430\u043f\u0447\u0430\u0441\u0442\u0438 / Ehtiyot qismlar'}</h3>
          <Button onClick={addSparePart} variant="primary" size="sm">+ {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}</Button>
        </div>
        {spareParts.map((part, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Input label={'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 / Nom'} value={part.name} onChange={(e) => updateSparePart(index, 'name', e.target.value)} />
              <Input type="number" label={'\u041a\u043e\u043b-\u0432\u043e / Miqdor'} value={part.qty} onChange={(e) => updateSparePart(index, 'qty', parseInt(e.target.value) || 1)} min={1} />
              <Input type="number" label={'\u0426\u0435\u043d\u0430 / Narxi'} value={part.price || ''} onChange={(e) => updateSparePart(index, 'price', parseFloat(e.target.value) || 0)} min={0} />
              <button type="button" onClick={() => removeSparePart(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm">{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="text-lg font-semibold text-gray-800">4.5 {'\u2014'} {'\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b / Materiallar'}</h3>
          <Button onClick={addMaterial} variant="primary" size="sm">+ {'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}</Button>
        </div>
        {materials.map((mat, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <Input label={'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 / Nom'} value={mat.name} onChange={(e) => updateMaterial(index, 'name', e.target.value)} />
              <Input type="number" label={'\u041a\u043e\u043b-\u0432\u043e / Miqdor'} value={mat.qty} onChange={(e) => updateMaterial(index, 'qty', parseInt(e.target.value) || 1)} min={1} />
              <Input type="number" label={'\u0426\u0435\u043d\u0430 / Narxi'} value={mat.price || ''} onChange={(e) => updateMaterial(index, 'price', parseFloat(e.target.value) || 0)} min={0} />
              <button type="button" onClick={() => removeMaterial(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm">{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</button>
            </div>
          </div>
        ))}
      </section>

      {(repairWorks.length > 0 || paintWorks.length > 0 || spareParts.length > 0 || materials.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-600">{'\u0420\u0435\u043c\u043e\u043d\u0442:'}</span> <strong>{totals.totalRepair.toLocaleString('ru-RU')}</strong></div>
          <div><span className="text-gray-600">{'\u041f\u043e\u043a\u0440\u0430\u0441\u043a\u0430:'}</span> <strong>{totals.totalPaint.toLocaleString('ru-RU')}</strong></div>
          <div><span className="text-gray-600">{'\u0417\u0430\u043f\u0447\u0430\u0441\u0442\u0438:'}</span> <strong>{totals.totalSpare.toLocaleString('ru-RU')}</strong></div>
          <div><span className="text-gray-600">{'\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b:'}</span> <strong>{totals.totalMat.toLocaleString('ru-RU')}</strong></div>
        </div>
      )}
    </div>
  );
}

export default Step4;
