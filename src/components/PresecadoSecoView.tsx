import React, { useState, useEffect } from "react";
import { Presecado, AnalisisSeco, AnalisisHumedo, Lote, UserProfile } from "../types";
import { 
  Wind, 
  Sun, 
  Save, 
  CheckCircle2, 
  ArrowRight, 
  TrendingDown, 
  TrendingUp, 
  Percent, 
  Layers, 
  Scale,
  RotateCcw,
  AlertCircle,
  Sparkles
} from "lucide-react";

interface PresecadoSecoViewProps {
  presecados?: Presecado[];
  analisisSecos?: AnalisisSeco[];
  analisisHumedos?: AnalisisHumedo[];
  lotes?: Lote[];
  initialLoteId?: string;
  currentUser?: UserProfile;
  onSavePresecado: (rec: Partial<Presecado>) => Promise<void>;
  onSaveAnalisisSeco: (rec: Partial<AnalisisSeco>) => Promise<void>;
}

const getEmptyPreForm = (loteId: string = ""): Partial<Presecado> => ({
  PRESECADO_ID: "",
  LOTE_ID: loteId,
  FECHA_ANALISIS: new Date().toISOString().split("T")[0],
  Humedad: 0,
  Impurezas: 0,
  RI: 0,
  RB: 0,
  RM: 0,
  QI: 0,
  QB: 0,
  Entero: 0,
  "B.INTEGRAL": 0,
  "Mezcla de variedades": 0,
  TT: 0,
  TP: 0,
  "T. PUNT.": 0,
  M: 0,
  TZ: 0,
  GR: 0,
  GI: 0,
  "B. PULIDO": 0,
  VANO: 0,
  PALOTE: 0,
  MANCHADO: 0,
  OLOR: "N",
  CASCADO: 0,
  "F. CARBON": 0,
  "PLAGAS-INSEC.": 0,
  OTROS: 0,
  OBSERVACIONES: ""
});

const getEmptySecoForm = (loteId: string = ""): Partial<AnalisisSeco> => ({
  ANALISIS_SECO_ID: "",
  LOTE_ID: loteId,
  FECHA_ANALISIS: new Date().toISOString().split("T")[0],
  Humedad_Final: 0,
  QI_Final: 0,
  QB_Final: 0,
  Entero_Final: 0,
  Blancura_Final: 0,
  Trizado_Final: 0,
  Tiza_Final: 0,
  Manchado_Final: 0,
  Coccion_Score: 0,
  OBSERVACIONES: ""
});

export const PresecadoSecoView: React.FC<PresecadoSecoViewProps> = ({
  presecados = [],
  analisisSecos = [],
  analisisHumedos = [],
  lotes = [],
  initialLoteId,
  currentUser,
  onSavePresecado,
  onSaveAnalisisSeco
}) => {
  const [activeTab, setActiveTab] = useState<"presecado" | "seco">("seco");
  const [selectedLoteId, setSelectedLoteId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");

  const selectedLote = lotes.find((l) => l.LOTE_ID === selectedLoteId);
  const initialAh = analisisHumedos.find((a) => a.LOTE_ID === selectedLoteId);

  // Form Presecado State
  const [preForm, setPreForm] = useState<Partial<Presecado>>(getEmptyPreForm(initialLoteId || lotes[0]?.LOTE_ID || ""));

  // Form Analisis Seco State
  const [secoForm, setSecoForm] = useState<Partial<AnalisisSeco>>(getEmptySecoForm(initialLoteId || lotes[0]?.LOTE_ID || ""));

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLoteId && lotes.length > 0) {
      setSelectedLoteId(lotes[0].LOTE_ID);
    }
  }, [lotes, selectedLoteId]);

  useEffect(() => {
    if (selectedLoteId) {
      const existingPre = presecados.find((p) => p.LOTE_ID === selectedLoteId);
      if (existingPre) {
        setPreForm(existingPre);
      } else {
        setPreForm(getEmptyPreForm(selectedLoteId));
      }

      const existingSeco = analisisSecos.find((s) => s.LOTE_ID === selectedLoteId);
      if (existingSeco) {
        setSecoForm(existingSeco);
      } else {
        setSecoForm(getEmptySecoForm(selectedLoteId));
      }
    }
  }, [selectedLoteId, presecados, analisisSecos]);

  const handleFillSecoReference = () => {
    setValidationError(null);
    setSecoForm((p) => ({
      ...p,
      Humedad_Final: 13.0,
      QI_Final: 7.2,
      Entero_Final: 54.0,
      Blancura_Final: 32.0,
      Trizado_Final: 1.2
    }));
  };

  const handleSavePre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId) {
      setValidationError("Por favor seleccione un lote antes de guardar el presecado.");
      return;
    }
    setValidationError(null);
    setIsSaving(true);
    try {
      const dataToSave = { 
        ...preForm, 
        LOTE_ID: selectedLoteId,
        FECHA_ANALISIS: preForm.FECHA_ANALISIS || new Date().toISOString().split("T")[0]
      };
      await onSavePresecado(dataToSave);
      setSaveSuccess(true);
      setPreForm(dataToSave);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setValidationError(err.message || "Error al guardar el registro de presecado.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSeco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId) {
      setValidationError("Por favor seleccione un lote antes de guardar el análisis seco.");
      return;
    }
    setValidationError(null);
    setIsSaving(true);
    try {
      const dataToSave = { 
        ...secoForm, 
        LOTE_ID: selectedLoteId,
        FECHA_ANALISIS: secoForm.FECHA_ANALISIS || new Date().toISOString().split("T")[0]
      };
      await onSaveAnalisisSeco(dataToSave);
      setSaveSuccess(true);
      setSecoForm(dataToSave);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setValidationError(err.message || "Error al guardar el análisis seco.");
    } finally {
      setIsSaving(false);
    }
  };

  // Deltas Antes vs Después Secado
  const baselineHum = initialAh?.HUMEDADES ?? selectedLote?.HUM ?? 14.0;
  const baselineQI = initialAh?.QI ?? 8.5;
  const baselineTZ = initialAh?.TZ ?? 2.0;
  const baselineBL = initialAh?.["B. PULIDO"] ?? 30.0;
  const baselineEntero = initialAh?.ENTERO ?? 52.0;

  const deltaHumedad = secoForm.Humedad_Final !== undefined ? Number((secoForm.Humedad_Final - baselineHum).toFixed(2)) : null;
  const deltaQuebrado = secoForm.QI_Final !== undefined ? Number((secoForm.QI_Final - baselineQI).toFixed(2)) : null;
  const deltaTrizado = secoForm.Trizado_Final !== undefined ? Number((secoForm.Trizado_Final - baselineTZ).toFixed(2)) : null;
  const deltaBlancura = secoForm.Blancura_Final !== undefined ? Number((secoForm.Blancura_Final - baselineBL).toFixed(2)) : null;
  const deltaEntero = secoForm.Entero_Final !== undefined ? Number((secoForm.Entero_Final - baselineEntero).toFixed(2)) : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Sub-Tabs */}
      <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wind className="w-5 h-5 text-amber-400" />
            Etapas de Presecado & Análisis Seco Final
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro de muestras post-presecado y comparación rigurosa Antes vs Después del Secado.
          </p>
        </div>

        {/* Sub-Tabs Switch */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab("seco")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === "seco" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Análisis Seco (Antes vs Después)
          </button>
          <button
            onClick={() => setActiveTab("presecado")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === "presecado" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Ficha de Presecado
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
          <span>¡Datos guardados con éxito para el lote <strong>{selectedLoteId}</strong>!</span>
        </div>
      )}

      {/* Lote Selector */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Seleccionar Lote <span className="text-amber-400">*</span>
        </label>
        <select
          id="select-presecado-lote"
          aria-label="Seleccionar lote para presecado o seco"
          value={selectedLoteId}
          onChange={(e) => setSelectedLoteId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
        >
          <option value="">-- Seleccionar Lote --</option>
          {lotes.map((l) => (
            <option key={l.LOTE_ID} value={l.LOTE_ID}>
              {l.LOTE_ID} - {l.VARIEDAD} ({l.CLIENTE}) | Humedad: {l.HUM}%
            </option>
          ))}
        </select>
      </div>

      {/* TAB 1: ANÁLISIS SECO (ANTES VS DESPUÉS) */}
      {activeTab === "seco" && (
        <div className="space-y-6">
          {/* Comparison Matrix: ANTES VS DESPUÉS */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
              <Scale className="w-4 h-4 text-amber-400" />
              Comparativa de Secado: ANTES DEL SECADO vs. DESPUÉS DEL SECADO
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
              {/* Humedad */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Humedad (%)</div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-slate-400 text-xs">{initialAh?.HUMEDADES || selectedLote?.HUM || 14.2}%</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-cyan-400 text-base font-black">
                    {secoForm.Humedad_Final !== undefined ? `${secoForm.Humedad_Final}%` : "---"}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-cyan-400 mt-1">
                  {deltaHumedad !== null ? `Δ ${deltaHumedad}% (Evaporación)` : "Pendiente"}
                </div>
              </div>

              {/* Quebrado Inicial vs Final */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Quebrado QI (%)</div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-slate-400 text-xs">{initialAh?.QI || 8.5}%</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-amber-400 text-base font-black">
                    {secoForm.QI_Final !== undefined ? `${secoForm.QI_Final}%` : "---"}
                  </span>
                </div>
                <div className={`text-[11px] font-bold mt-1 ${deltaQuebrado !== null && deltaQuebrado <= 2.0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {deltaQuebrado !== null ? `Δ ${deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}%` : "Pendiente"}
                </div>
              </div>

              {/* Grano Entero */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Grano Entero (%)</div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-slate-400 text-xs">{initialAh?.ENTERO || 52.6}%</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-emerald-400 text-base font-black">
                    {secoForm.Entero_Final !== undefined ? `${secoForm.Entero_Final}%` : "---"}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-emerald-400 mt-1">
                  {deltaEntero !== null ? `Δ ${deltaEntero > 0 ? `+${deltaEntero}` : deltaEntero}%` : "Pendiente"}
                </div>
              </div>

              {/* Trizado */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Trizado TZ (%)</div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-slate-400 text-xs">{initialAh?.TZ || 2.1}%</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-rose-300 text-base font-black">
                    {secoForm.Trizado_Final !== undefined ? `${secoForm.Trizado_Final}%` : "---"}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-300 mt-1">
                  {deltaTrizado !== null ? `Δ ${deltaTrizado > 0 ? `+${deltaTrizado}` : deltaTrizado}%` : "Pendiente"}
                </div>
              </div>

              {/* Blancura Final */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Blancura (BL)</div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-slate-400 text-xs">{initialAh?.["B. PULIDO"] || 30.5}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-white text-base font-black">
                    {secoForm.Blancura_Final !== undefined ? secoForm.Blancura_Final : "---"}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-300 mt-1">
                  {deltaBlancura !== null ? `Δ ${deltaBlancura > 0 ? `+${deltaBlancura}` : deltaBlancura}` : "Pendiente"}
                </div>
              </div>
            </div>
          </div>

          {/* Form Analisis Seco */}
          <form onSubmit={handleSaveSeco} className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Registrar Análisis Seco Post-Secado
              </h3>
              <button
                type="button"
                onClick={handleFillSecoReference}
                className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-colors"
                title="Rellenar valores estándar post-secado para agilizar pruebas"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Valores de Referencia Seco</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-cyan-300 mb-1">Humedad Final (%)</label>
                <input
                  id="input-as-humedad"
                  type="number"
                  step="0.1"
                  value={secoForm.Humedad_Final || ""}
                  onChange={(e) => setSecoForm((p) => ({ ...p, Humedad_Final: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-cyan-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-300 mb-1">QI Final (%)</label>
                <input
                  id="input-as-qi"
                  type="number"
                  step="0.1"
                  value={secoForm.QI_Final || ""}
                  onChange={(e) => setSecoForm((p) => ({ ...p, QI_Final: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-amber-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-300 mb-1">Entero Final (%)</label>
                <input
                  id="input-as-entero"
                  type="number"
                  step="0.1"
                  value={secoForm.Entero_Final || ""}
                  onChange={(e) => setSecoForm((p) => ({ ...p, Entero_Final: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-emerald-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white mb-1">Blancura Kett Final</label>
                <input
                  id="input-as-blancura"
                  type="number"
                  step="0.1"
                  value={secoForm.Blancura_Final || ""}
                  onChange={(e) => setSecoForm((p) => ({ ...p, Blancura_Final: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-300 mb-1">Score Cocción (0-100)</label>
                <input
                  id="input-as-coccion"
                  type="number"
                  value={secoForm.Coccion_Score || 90}
                  onChange={(e) => setSecoForm((p) => ({ ...p, Coccion_Score: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-purple-300 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones</label>
              <textarea
                id="textarea-as-obs"
                rows={2}
                value={secoForm.OBSERVACIONES || ""}
                onChange={(e) => setSecoForm((p) => ({ ...p, OBSERVACIONES: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                placeholder="Grano traslúcido, comportamiento en columna de secado..."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Análisis seco guardado. Formulario vaciado para nuevo registro.
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSecoForm(getEmptySecoForm(selectedLoteId))}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Vaciar
                </button>
                <button
                  id="btn-save-analisis-seco"
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Guardar Análisis Seco
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PRESECADO */}
      {activeTab === "presecado" && (
        <form onSubmit={handleSavePre} className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Ficha de Análisis Post-Presecado (PRESECADO)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Humedad</label>
              <input
                id="input-pre-humedad"
                type="number"
                step="0.1"
                value={preForm.Humedad || ""}
                onChange={(e) => setPreForm((p) => ({ ...p, Humedad: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Impurezas</label>
              <input
                id="input-pre-impurezas"
                type="number"
                step="0.1"
                value={preForm.Impurezas || ""}
                onChange={(e) => setPreForm((p) => ({ ...p, Impurezas: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">RI</label>
              <input
                id="input-pre-ri"
                type="number"
                step="0.1"
                value={preForm.RI || ""}
                onChange={(e) => setPreForm((p) => ({ ...p, RI: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">QI</label>
              <input
                id="input-pre-qi"
                type="number"
                step="0.1"
                value={preForm.QI || ""}
                onChange={(e) => setPreForm((p) => ({ ...p, QI: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Entero</label>
              <input
                id="input-pre-entero"
                type="number"
                step="0.1"
                value={preForm.Entero || ""}
                onChange={(e) => setPreForm((p) => ({ ...p, Entero: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Trizado (TZ)</label>
              <input
                id="input-pre-tz"
                type="number"
                step="0.1"
                value={preForm.TZ || ""}
                onChange={(e) => setPreForm((p) => ({ ...p, TZ: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-rose-300 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones</label>
            <textarea
              id="textarea-pre-obs"
              rows={2}
              value={preForm.OBSERVACIONES || ""}
              onChange={(e) => setPreForm((p) => ({ ...p, OBSERVACIONES: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              placeholder="Resultado post-presecado..."
            />
          </div>

          <div className="flex items-center justify-between">
            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Ficha de presecado guardada. Formulario vaciado para nuevo ingreso.
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreForm(getEmptyPreForm(selectedLoteId))}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Vaciar
              </button>
              <button
                id="btn-save-presecado"
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Guardar Ficha de Presecado
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
