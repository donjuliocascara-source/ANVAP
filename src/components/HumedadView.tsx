import React, { useState, useEffect } from "react";
import { RegistroHumedad, Lote, UserProfile } from "../types";
import { 
  Droplet, 
  Plus, 
  Calculator, 
  Save, 
  Calendar, 
  Camera, 
  CheckCircle2, 
  Info, 
  TrendingUp,
  FileSpreadsheet,
  RotateCcw,
  AlertCircle
} from "lucide-react";

interface HumedadViewProps {
  humedades?: RegistroHumedad[];
  lotes?: Lote[];
  initialLoteId?: string;
  currentUser?: UserProfile;
  onSaveHumedad: (rec: Partial<RegistroHumedad>) => Promise<void>;
  onOpenOCR?: () => void;
}

const getEmptySamples = (): { [key: string]: string } => {
  const s: { [key: string]: string } = {};
  for (let i = 1; i <= 19; i++) s[`M${i}`] = "";
  return s;
};

export const HumedadView: React.FC<HumedadViewProps> = ({
  humedades = [],
  lotes = [],
  initialLoteId,
  currentUser,
  onSaveHumedad,
  onOpenOCR
}) => {
  const [selectedLoteId, setSelectedLoteId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");
  const [fechaAnalisis, setFechaAnalisis] = useState<string>(new Date().toISOString().split("T")[0]);
  const [observaciones, setObservaciones] = useState<string>("");

  // 19 Caladas / Muestras initialized empty without dummy data
  const [samples, setSamples] = useState<{ [key: string]: string }>(getEmptySamples());

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLoteId) {
      setSelectedLoteId(initialLoteId);
      loadLoteHumedad(initialLoteId);
    } else if (!selectedLoteId && lotes.length > 0) {
      setSelectedLoteId(lotes[0].LOTE_ID);
      loadLoteHumedad(lotes[0].LOTE_ID);
    }
  }, [initialLoteId, lotes]);

  const loadLoteHumedad = (loteId: string) => {
    const existing = humedades.find((h) => h.LOTE_ID === loteId);
    const matchLote: any = lotes.find((l) => l.LOTE_ID === loteId);
    const loaded: { [key: string]: string } = {};
    let hasAny = false;
    for (let i = 1; i <= 19; i++) {
      const key = `M${i}` as keyof RegistroHumedad;
      const valHum = existing ? existing[key] : undefined;
      const valLote = matchLote ? matchLote[key] : undefined;
      const val = (valHum !== undefined && valHum !== null && Number(valHum) > 0)
        ? valHum
        : ((valLote !== undefined && valLote !== null && Number(valLote) > 0) ? valLote : undefined);
      if (val !== undefined) {
        loaded[`M${i}`] = String(val);
        hasAny = true;
      } else {
        loaded[`M${i}`] = "";
      }
    }
    setSamples(hasAny ? loaded : getEmptySamples());
    setFechaAnalisis(existing?.FECHA_ANALISIS || matchLote?.FECHA_INGRESO || new Date().toISOString().split("T")[0]);
    setObservaciones(existing?.OBSERVACIONES || "");
  };

  const handleSelectLote = (loteId: string) => {
    setValidationError(null);
    setSelectedLoteId(loteId);
    loadLoteHumedad(loteId);
  };

  // Live Auto Calculations
  const numericValues = Object.values(samples)
    .map((v) => parseFloat(String(v)))
    .filter((v) => !isNaN(v) && v > 0);

  const count = numericValues.length;
  const promedio = count > 0 ? numericValues.reduce((a, b) => a + b, 0) / count : 0;
  const min = count > 0 ? Math.min(...numericValues) : 0;
  const max = count > 0 ? Math.max(...numericValues) : 0;
  const desv = count > 1
    ? Math.sqrt(numericValues.reduce((acc, val) => acc + Math.pow(val - promedio, 2), 0) / (count - 1))
    : 0;

  // Medidas menores a 17% y su porcentaje
  const caladasMenores17 = numericValues.filter((v) => v < 17);
  const countMenores17 = caladasMenores17.length;
  const pctMenores17 = count > 0 ? (countMenores17 / count) * 100 : 0;

  const handleSampleChange = (key: string, val: string) => {
    setSamples((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetSamples = () => {
    setSamples(getEmptySamples());
    setObservaciones("");
    setFechaAnalisis(new Date().toISOString().split("T")[0]);
  };

  const handleFillUniform = (baseVal: number) => {
    const newSamples: { [key: string]: string } = {};
    for (let i = 1; i <= 19; i++) {
      const jitter = (Math.random() * 0.4 - 0.2).toFixed(1);
      newSamples[`M${i}`] = (baseVal + parseFloat(jitter)).toFixed(1);
    }
    setSamples(newSamples);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId) {
      setValidationError("Por favor seleccione un lote de arroz antes de guardar el registro de humedad.");
      return;
    }
    setValidationError(null);

    setIsSaving(true);
    try {
      const caladasRecord: Record<string, number> = {};
      for (let i = 1; i <= 19; i++) {
        const v = parseFloat(samples[`M${i}`]);
        if (!isNaN(v) && v > 0) {
          caladasRecord[`M${i}`] = Number(v.toFixed(2));
        }
      }

      const payload: Partial<RegistroHumedad> = {
        LOTE_ID: selectedLoteId,
        FECHA_ANALISIS: fechaAnalisis || new Date().toISOString().split("T")[0],
        ...caladasRecord,
        "PROM. GENERAL": Number(promedio.toFixed(2)),
        "H. PROMEDIO": Number(promedio.toFixed(2)),
        DESVIACION: Number(desv.toFixed(2)),
        "DESV.": Number(desv.toFixed(2)),
        "H.MIN.": Number(min.toFixed(2)),
        "H.MAX": Number(max.toFixed(2)),
        HUM_MAX: Number(max.toFixed(2)),
        HUM_MIN: Number(min.toFixed(2)),
        OBSERVACIONES: observaciones
      };

      await onSaveHumedad(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setValidationError(err.message || "Error al guardar el registro de humedad.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Droplet className="w-5 h-5 text-cyan-400" />
            Registro de Humedad de Ingreso (REGIS. HUM.)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Muestreo de hasta 19 caladas (M1 - M19) con cálculo automático de Promedio, Desviación Estándar, Mínimo y Máximo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetSamples}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Limpiar caladas y vaciar campos"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Vaciar Caladas
          </button>

          <button
            id="btn-ocr-humedad"
            onClick={onOpenOCR}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            Escanear Pantalla de Higrómetro (OCR)
          </button>
        </div>
      </div>

      {validationError && (
        <div className="p-3 bg-rose-950/90 border border-rose-500 rounded-xl flex items-center gap-2.5 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-500 rounded-xl flex items-center gap-2.5 text-emerald-200 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>¡Registro de caladas de humedad guardado con éxito para el lote <strong>{selectedLoteId}</strong>!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Caladas */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Lote & Fecha Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lote de Arroz <span className="text-amber-400">*</span>
                </label>
                <select
                  id="select-humedad-lote"
                  aria-label="Seleccionar lote de arroz"
                  value={selectedLoteId}
                  onChange={(e) => handleSelectLote(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">Seleccione un Lote</option>
                  {lotes.map((l) => (
                    <option key={l.LOTE_ID} value={l.LOTE_ID}>
                      {l.LOTE_ID} - {l.VARIEDAD || "Sin variedad"} ({l.CLIENTE || "Sin cliente"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fecha de Análisis (Automática / Hoy)
                </label>
                <input
                  id="input-humedad-fecha"
                  type="date"
                  value={fechaAnalisis}
                  onChange={(e) => setFechaAnalisis(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                  required
                />
              </div>
            </div>

            {/* Quick Presets / Caladas Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Caladas de Muestreo (M1 a M14 en %):
                </label>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Plantillas rápidas:</span>
                  <button
                    type="button"
                    onClick={() => handleFillUniform(14.2)}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
                  >
                    14.2%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillUniform(15.5)}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
                  >
                    15.5%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillUniform(16.0)}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
                  >
                    16.0%
                  </button>
                </div>
              </div>

              {/* 19 Caladas Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-10 gap-2">
                {Array.from({ length: 19 }).map((_, i) => {
                  const key = `M${i + 1}`;
                  return (
                    <div key={key} className="bg-slate-900/90 rounded-lg p-2 border border-slate-750 text-center">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">{key}</label>
                      <input
                        id={`input-sample-${key}`}
                        type="number"
                        step="0.1"
                        min="5"
                        max="35"
                        placeholder="0.0"
                        value={samples[key] || ""}
                        onChange={(e) => handleSampleChange(key, e.target.value)}
                        className="w-full text-center bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 mt-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observaciones del Muestreo
              </label>
              <textarea
                id="textarea-humedad-obs"
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Condiciones de tolva, calado profundo, homogeneidad..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-2">
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Registro de humedad guardado. Formulario vaciado para nuevo ingreso.
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetSamples}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Vaciar
                </button>
                <button
                  id="btn-save-humedad"
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Guardando..." : "Guardar Análisis de Humedad"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Live Automatic Calculation Card */}
        <div className="space-y-4">
          <div className="bg-gradient-to-b from-slate-800 to-slate-855 rounded-xl border border-cyan-500/30 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-3">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Cálculos Estadísticos en Vivo
            </h3>

            <div className="mt-4 space-y-3.5">
              {/* Promedio */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-cyan-500/20">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Humedad Promedio (H. PROMEDIO)
                </div>
                <div className="text-3xl font-black text-cyan-400 mt-1">
                  {count > 0 ? `${promedio.toFixed(2)} %` : "--- %"}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Basado en {count} de 14 caladas registradas
                </div>
              </div>

              {/* Grid Desv / Min / Max / <17% */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase">Desviación (DESV.)</div>
                  <div className="font-bold text-white text-sm mt-1">
                    {count > 1 ? `±${desv.toFixed(2)}` : "±0.00"}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase">Mínima (H.MIN)</div>
                  <div className="font-bold text-emerald-400 text-sm mt-1">
                    {count > 0 ? `${min.toFixed(1)}%` : "0.0%"}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase">Máxima (H.MAX)</div>
                  <div className="font-bold text-amber-400 text-sm mt-1">
                    {count > 0 ? `${max.toFixed(1)}%` : "0.0%"}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-lg p-2.5 border border-amber-500/40 bg-amber-950/20">
                  <div className="text-[10px] text-amber-300 font-bold uppercase">&lt; 17% (Bajas)</div>
                  <div className="font-black text-amber-400 text-sm mt-1">
                    {countMenores17}/{count}
                  </div>
                  <div className="text-[9px] text-amber-300 font-semibold mt-0.5">
                    {pctMenores17.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Quality Tolerance Diagnosis */}
              {count > 0 ? (
                <div className={`p-3 rounded-lg text-xs ${
                  desv > 0.8 ? "bg-rose-950/40 text-rose-300 border border-rose-800/60" :
                  promedio > 16 ? "bg-amber-950/40 text-amber-300 border border-amber-800/60" :
                  "bg-emerald-950/40 text-emerald-300 border border-emerald-800/60"
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    {desv > 0.8 ? "Alerta de Dispersión Térmica" :
                     promedio > 16 ? "Humedad Alta - Requiere Presecado" :
                     "Uniformidad Óptima para Vaporizado"}
                  </div>
                  <div className="text-[11px] mt-1 text-slate-300">
                    {desv > 0.8
                      ? "Diferencia >0.8% entre caladas. Se recomienda homogeneizar el lote en tolva antes de entrar al autoclave."
                      : promedio > 16
                      ? "El lote requerirá un paso previo por la pre-secadora rotativa o rampa lenta de inyección."
                      : "El lote tiene homogeneidad estándar apta para programación directa."}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg text-xs bg-slate-900/60 text-slate-400 border border-slate-750 text-center">
                  Ingrese las caladas del higrómetro para calcular estadísticas en tiempo real.
                </div>
              )}
            </div>
          </div>

          {/* Historical Moisture Log preview */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              Últimos Muestreos Guardados
            </h4>
            <div className="space-y-2 text-xs divide-y divide-slate-750">
              {humedades.slice(0, 3).map((h) => (
                <div key={h["ID ANALISIS"]} className="pt-2 first:pt-0 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white">{h.LOTE_ID}</span>
                    <span className="text-[10px] text-slate-400 ml-2">({h.FECHA_ANALISIS})</span>
                  </div>
                  <div className="text-cyan-400 font-bold font-mono">
                    {h["H. PROMEDIO"]}% <span className="text-[10px] text-slate-400 font-normal">±{h["DESV."]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
