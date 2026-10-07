import React, { useState, useEffect } from "react";
import { AnalisisHumedo, Lote, UserProfile } from "../types";
import { 
  FlaskConical, 
  Save, 
  Camera, 
  CheckCircle2, 
  Scale, 
  Sparkles, 
  RotateCcw,
  Eye,
  Info,
  FileText,
  ShieldCheck,
  Lock,
  AlertCircle
} from "lucide-react";
import { calcularEvaluacionLote } from "../utils/evaluacionCalidad";
import { FichaUnificadaModal } from "./FichaUnificadaModal";
import { OrganolepticoInput } from "./OrganolepticoInput";

interface AnalisisHumedoViewProps {
  analisisList?: AnalisisHumedo[];
  lotes?: Lote[];
  initialLoteId?: string;
  currentUser?: UserProfile;
  onSaveAnalisis?: (analisis: Partial<AnalisisHumedo>) => Promise<void>;
  onSaveAnalisisHum?: (analisis: Partial<AnalisisHumedo>) => Promise<void>;
  onOpenOCR?: () => void;
}

export const AnalisisHumedoView: React.FC<AnalisisHumedoViewProps> = ({
  analisisList = [],
  lotes = [],
  initialLoteId,
  currentUser,
  onSaveAnalisis,
  onSaveAnalisisHum,
  onOpenOCR
}) => {
  const saveHandler = onSaveAnalisisHum || onSaveAnalisis || (async () => {});
  const [selectedLoteId, setSelectedLoteId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");
  const selectedLote = lotes.find((l) => l.LOTE_ID === selectedLoteId);
  const [modalFichaOpen, setModalFichaOpen] = useState(false);

  // Template to generate clean initial state with today's date and all standard parameters starting at 0
  const getInitialAnalisisState = (loteId?: string, variedad?: string): Partial<AnalisisHumedo> => ({
    ANALISIS_HUMEDO_ID: "",
    LOTE_ID: loteId || "",
    FECHA_ANALISIS: new Date().toISOString().split("T")[0],
    VARIEDAD: variedad || "",
    // 16 Parámetros de Calidad y Rendimientos - Valor inicial 0
    RI: 0,
    RB: 0,
    RM: 0,
    QI: 0,
    QB: 0,
    ENTERO: 0,
    TT: 0,
    TP: 0,
    "T. PUNT.": 0,
    M: 0,
    MANCHADO: 0,
    TZ: 0,
    GR: 0,
    GI: 0,
    GV: 0,
    "B.INTEGRAL": 0,
    "B. PULIDO": 0,
    // 6 Parámetros Organolépticos (N = Ninguno / No Presenta / 0%)
    PALOTE: "N",
    VANO: "N",
    IMPUREZS: "N",
    OLOR: "N",
    "F. CARBON": "N",
    HONGO: "N",
    // Otros
    "MEZCLA VAR.": 0,
    CASCADO: 0,
    "PLAGAS-NSEC.": 0,
    OTROS: 0,
    OBSERVACIONES: ""
  });

  // Form State
  const [formData, setFormData] = useState<Partial<AnalisisHumedo>>(() => 
    getInitialAnalisisState(initialLoteId || lotes[0]?.LOTE_ID || "", lotes[0]?.VARIEDAD || "")
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const buildLoadedAnalisisState = (loteId: string, matchLote?: Lote, existing?: AnalisisHumedo): Partial<AnalisisHumedo> => {
    const src: any = existing || matchLote || {};
    const hasData = existing || (matchLote && ((matchLote as any).RI !== undefined || (matchLote as any).RB !== undefined || (matchLote as any).QB !== undefined));
    if (!hasData) {
      return getInitialAnalisisState(loteId, matchLote?.VARIEDAD);
    }
    return {
      ...getInitialAnalisisState(loteId, matchLote?.VARIEDAD),
      ...src,
      LOTE_ID: loteId,
      VARIEDAD: src.VARIEDAD || matchLote?.VARIEDAD || "",
      FECHA_ANALISIS: existing?.FECHA_ANALISIS || matchLote?.FECHA_INGRESO || new Date().toISOString().split("T")[0],
      RI: src.RI ?? src["R.I (%)"] ?? 0,
      RB: src.RB ?? src["R.B (%)"] ?? 0,
      RM: src.RM ?? src["% Remoción"] ?? 0,
      QI: src.QI ?? src["Q.I (%)"] ?? 0,
      QB: src.QB ?? src["Q.B (%)"] ?? 0,
      ENTERO: src.ENTERO ?? src["Entero (%)"] ?? 0,
      TT: src.TT ?? src["Tiza Total (%)"] ?? 0,
      TP: src.TP ?? src["Tiza Parcial (%)"] ?? 0,
      "T. PUNT.": src["T. PUNT."] ?? src.TPUN ?? src["Tiza Puntual (%)"] ?? 0,
      M: src.M ?? src.MANCHADO ?? src["Mancha (%)"] ?? 0,
      MANCHADO: src.MANCHADO ?? src.M ?? src["Mancha (%)"] ?? 0,
      TZ: src.TZ ?? src["Trizado (%)"] ?? 0,
      GR: src.GR ?? src.ROJO ?? src["Grano Rojo (%)"] ?? 0,
      GI: src.GI ?? src["Grano Inmaduro (%)"] ?? 0,
      GV: src.GV ?? src.VERDE ?? src["Grano Verde (%)"] ?? 0,
      "B.INTEGRAL": src["B.INTEGRAL"] ?? src.BL_INT ?? src["Blancura Int."] ?? 0,
      "B. PULIDO": src["B. PULIDO"] ?? src.BL_BLANCO ?? src["Blancura Pul."] ?? 0,
      PALOTE: src.PALOTE ?? src["Palote"] ?? "N",
      VANO: src.VANO ?? src["Vano"] ?? "N",
      IMPUREZS: src.IMPUREZS ?? src.IMPUREZAS ?? src["Impurezas (%)"] ?? "N",
      OLOR: src.OLOR ?? src["Olor"] ?? "N",
      "F. CARBON": src["F. CARBON"] ?? src.CARBON ?? src["Falso Carbón"] ?? "N",
      HONGO: src.HONGO ?? src["Hongo"] ?? "N",
      "MEZCLA VAR.": src["MEZCLA VAR."] ?? src.MEZCLA ?? src["Mezcla de variedades"] ?? src["Mezcla Var. (%)"] ?? 0,
      CASCADO: src.CASCADO ?? src["Cascado (%)"] ?? 0,
      "PLAGAS-NSEC.": src["PLAGAS-NSEC."] ?? src["PLAGAS-INSEC."] ?? src.PLAGAS ?? src["Plagas / Insec."] ?? 0
    };
  };

  useEffect(() => {
    if (initialLoteId) {
      setSelectedLoteId(initialLoteId);
      const matchLote = lotes.find((l) => l.LOTE_ID === initialLoteId);
      const existing = analisisList.find((a) => a.LOTE_ID === initialLoteId);
      setFormData(buildLoadedAnalisisState(initialLoteId, matchLote, existing));
    } else if (!selectedLoteId && lotes.length > 0) {
      const firstId = lotes[0].LOTE_ID;
      setSelectedLoteId(firstId);
      const matchLote = lotes[0];
      const existing = analisisList.find((a) => a.LOTE_ID === firstId);
      setFormData(buildLoadedAnalisisState(firstId, matchLote, existing));
    }
  }, [initialLoteId, lotes]);

  const handleSelectLote = (loteId: string) => {
    setValidationError(null);
    setSelectedLoteId(loteId);
    const matchLote = lotes.find((l) => l.LOTE_ID === loteId);
    const existing = analisisList.find((a) => a.LOTE_ID === loteId);
    setFormData(buildLoadedAnalisisState(loteId, matchLote, existing));
  };

  const handleFillReference = () => {
    setValidationError(null);
    setFormData((prev) => ({
      ...prev,
      RI: 78.5,
      RB: 68.2,
      QI: 8.5,
      QB: 14.2,
      TT: 2.1,
      TP: 2.3,
      TPUN: 4.2,
      M: 0.8,
      MANCHADO: 0.8,
      TZ: 1.5,
      BL_INT: 22.0,
      BL_BLANCO: 39.0,
      AM: 0.5,
      ROJO: 0.3,
      D_TOTAL: 4.8
    }));
  };

  const handleChange = (field: keyof AnalisisHumedo, val: any) => {
    setValidationError(null);
    setFormData((prev) => {
      const updated = { ...prev, [field]: val };
      // If setting M, sync MANCHADO
      if (field === "M") {
        updated.MANCHADO = val;
      } else if (field === "MANCHADO") {
        updated.M = val;
      }
      return updated;
    });
  };

  const handleResetForm = () => {
    setValidationError(null);
    setFormData(getInitialAnalisisState(selectedLoteId, selectedLote?.VARIEDAD));
  };

  // Auto calculate Remoción (% REM = RI - RB)
  const autoRemocion = (formData.RI !== undefined && formData.RB !== undefined)
    ? Number((Number(formData.RI) - Number(formData.RB)).toFixed(2))
    : undefined;

  // Auto calculate Grano Entero (% ENTERO = RB - % Quebrado)
  const quebradoBlanco = formData.QB !== undefined
    ? Number(formData.QB)
    : (formData.QI !== undefined ? Number(formData.QI) : undefined);

  const autoEntero = (formData.RB !== undefined && quebradoBlanco !== undefined)
    ? Number((Number(formData.RB) - quebradoBlanco).toFixed(2))
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId) {
      setValidationError("Por favor seleccione un lote de la lista antes de guardar el análisis.");
      return;
    }
    setValidationError(null);

    setIsSaving(true);
    try {
      const toSave: Partial<AnalisisHumedo> = {
        ...formData,
        RM: autoRemocion,
        ENTERO: autoEntero,
        LOTE_ID: selectedLoteId,
        VARIEDAD: selectedLote?.VARIEDAD || formData.VARIEDAD,
        FECHA_ANALISIS: formData.FECHA_ANALISIS || new Date().toISOString().split("T")[0]
      };
      await saveHandler(toSave);
      setFormData(toSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setValidationError(err.message || "Error al guardar el análisis.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-400" />
            Módulo de Análisis de Calidad y Rendimientos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro oficial de parámetros físicos, rendimientos de pilado y defectos organolépticos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleFillReference}
            className="px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            title="Rellenar campos con valores típicos estándar de laboratorio para pruebas o agilidad"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Valores de Referencia</span>
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Limpiar campos a valores vacíos"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpiar Campos
          </button>

          <button
            id="btn-ocr-analisis-humedo"
            type="button"
            onClick={onOpenOCR}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            Escanear Hoja con IA
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
          <span>¡Análisis de calidad guardado correctamente en el sistema para el lote <strong>{selectedLoteId}</strong>!</span>
        </div>
      )}

      {/* Lot Selector */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Seleccionar Lote a Analizar <span className="text-amber-400">*</span>
            </label>
            <select
              id="select-analisis-lote"
              aria-label="Seleccionar lote a analizar"
              value={selectedLoteId}
              onChange={(e) => handleSelectLote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
            >
              <option value="">-- Seleccionar Lote --</option>
              {lotes.map((l) => (
                <option key={l.LOTE_ID} value={l.LOTE_ID}>
                  {l.LOTE_ID} - {l.VARIEDAD || "Sin variedad"} ({l.CLIENTE || "Sin cliente"}) | Ubicación: {l.UBICACION || l.ZONA || "Sin ubicación"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Fecha de Análisis (Automática / Hoy)
            </label>
            <input
              id="input-analisis-fecha"
              type="date"
              value={formData.FECHA_ANALISIS || new Date().toISOString().split("T")[0]}
              onChange={(e) => handleChange("FECHA_ANALISIS", e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Live Approval Score Banner (24 parameters / 100% total) */}
      {(() => {
        const liveEval = calcularEvaluacionLote(formData, selectedLote, selectedLote?.HUMEDAD, selectedLote?.DESV);
        return (
          <div className={`p-4 rounded-xl border ${liveEval.colorEstado} flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-slate-950 border-2 border-current font-black shrink-0">
                <span className="text-base leading-none">{liveEval.porcentajeAprobacion}%</span>
                <span className="text-[8px] uppercase tracking-tight opacity-75">Aprob.</span>
              </div>
              <div>
                <div className="font-black text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Dictamen Oficial de Aprobación: LOTE {liveEval.estadoAprobacion}</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {liveEval.items.filter(i => i.cumple).length} de 24 parámetros cumplidos ({liveEval.puntajeTotal}/100 pts)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalFichaOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Ver Ficha Unificada & Matriz</span>
            </button>
          </div>
        );
      })()}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECCIÓN 1: RENDIMIENTOS Y DEFECTOS DE CALIDAD (16 PARÁMETROS) */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Scale className="w-4 h-4" />
              <span>1. Rendimientos y Defectos de Calidad (16 Parámetros)</span>
            </div>
            <span className="text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-750">
              NOMBRE Y ABREVIATURA OFICIAL
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3.5">
            {/* 1. R. INTEGRAL (R. I) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">R. INTEGRAL</span>
                <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  R. I
                </span>
              </div>
              <input
                id="input-ah-ri"
                type="number"
                step="0.01"
                placeholder="Ej. 78.5"
                value={formData.RI !== undefined ? formData.RI : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("RI", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* 2. R. BLANCO (R. B) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">R. BLANCO</span>
                <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  R. B
                </span>
              </div>
              <input
                id="input-ah-rb"
                type="number"
                step="0.01"
                placeholder="Ej. 68.2"
                value={formData.RB !== undefined ? formData.RB : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("RB", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* 3. %REMOCION (% REM.) - Cálculo Automático */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-cyan-800/40 bg-cyan-950/10">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-white">%REMOCION</span>
                  <span title="Cálculo automático bloqueado"><Lock className="w-2.5 h-2.5 text-cyan-400" /></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-cyan-400 bg-cyan-950 border border-cyan-800/60 px-1 py-0.2 rounded uppercase">Auto</span>
                  <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                    % REM.
                  </span>
                </div>
              </div>
              <input
                id="input-ah-rm"
                type="text"
                readOnly
                tabIndex={-1}
                value={autoRemocion !== undefined ? `${autoRemocion}%` : "— (Ingrese R.I y R.B)"}
                className="w-full bg-slate-950/90 border border-cyan-800/50 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono font-bold cursor-not-allowed select-none shadow-inner"
              />
              <div className="flex items-center justify-between mt-1 text-[9px] text-cyan-400/80 font-medium">
                <span>Fórmula: R.I - R.B</span>
                {autoRemocion !== undefined && (
                  <span className="font-mono">{formData.RI ?? "?"} - {formData.RB ?? "?"}</span>
                )}
              </div>
            </div>

            {/* 4. QUEBRADO INTEGRAL (%Q. INT.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">QUEBRADO INTEGRAL</span>
                <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  %Q. INT.
                </span>
              </div>
              <input
                id="input-ah-qi"
                type="number"
                step="0.01"
                placeholder="Ej. 12.5"
                value={formData.QI !== undefined ? formData.QI : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("QI", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 5. QUEBRADO BLANCO (% Q. BL.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">QUEBRADO BLANCO</span>
                <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  % Q. BL.
                </span>
              </div>
              <input
                id="input-ah-qb"
                type="number"
                step="0.01"
                placeholder="Ej. 14.8"
                value={formData.QB !== undefined ? formData.QB : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("QB", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 6. % DE GRANO ENTERO (% ENTERO) - Cálculo Automático */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-emerald-800/40 bg-emerald-950/10">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-white">% DE GRANO ENTERO</span>
                  <span title="Cálculo automático bloqueado"><Lock className="w-2.5 h-2.5 text-emerald-400" /></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800/60 px-1 py-0.2 rounded uppercase">Auto</span>
                  <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                    % ENTERO
                  </span>
                </div>
              </div>
              <input
                id="input-ah-entero"
                type="text"
                readOnly
                tabIndex={-1}
                value={autoEntero !== undefined ? `${autoEntero}%` : "— (Ingrese R.B y Quebrado)"}
                className="w-full bg-slate-950/90 border border-emerald-800/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold cursor-not-allowed select-none shadow-inner"
              />
              <div className="flex items-center justify-between mt-1 text-[9px] text-emerald-400/80 font-medium">
                <span>Fórmula: R.B - % Quebrado</span>
                {autoEntero !== undefined && (
                  <span className="font-mono">{formData.RB ?? "?"} - {quebradoBlanco ?? "?"}</span>
                )}
              </div>
            </div>

            {/* 7. TIZA TOTAL (% T. TOT.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">TIZA TOTAL</span>
                <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  % T. TOT.
                </span>
              </div>
              <input
                id="input-ah-tt"
                type="number"
                step="0.01"
                placeholder="Ej. 4.5"
                value={formData.TT !== undefined ? formData.TT : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("TT", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 8. TIZA PARCIAL (%T. PARC.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">TIZA PARCIAL</span>
                <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  %T. PARC.
                </span>
              </div>
              <input
                id="input-ah-tp"
                type="number"
                step="0.01"
                placeholder="Ej. 2.1"
                value={formData.TP !== undefined ? formData.TP : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("TP", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 9. TIZA PUNTUAL (%T. PUNT.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">TIZA PUNTUAL</span>
                <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  %T. PUNT.
                </span>
              </div>
              <input
                id="input-ah-tpunt"
                type="number"
                step="0.01"
                placeholder="Ej. 1.3"
                value={formData["T. PUNT."] !== undefined ? formData["T. PUNT."] : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("T. PUNT.", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 10. MANCHA (% M) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">MANCHA</span>
                <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  % M
                </span>
              </div>
              <input
                id="input-ah-m"
                type="number"
                step="0.01"
                placeholder="Ej. 0.8"
                value={formData.M !== undefined ? formData.M : (formData.MANCHADO !== undefined ? formData.MANCHADO : "")}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("M", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 11. TRIZADO (% TZ) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-rose-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">TRIZADO</span>
                <span className="text-[10px] font-mono font-black text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded">
                  % TZ
                </span>
              </div>
              <input
                id="input-ah-tz"
                type="number"
                step="0.01"
                placeholder="Ej. 2.4"
                value={formData.TZ !== undefined ? formData.TZ : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("TZ", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 font-mono font-bold focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* 12. GRANO ROJO (% G. R) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">GRANO ROJO</span>
                <span className="text-[10px] font-mono font-black text-rose-300 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded">
                  % G. R
                </span>
              </div>
              <input
                id="input-ah-gr"
                type="number"
                step="0.01"
                placeholder="Ej. 0.5"
                value={formData.GR !== undefined ? formData.GR : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("GR", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 13. GRANO INMADURO (% G. INM.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">GRANO INMADURO</span>
                <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  % G. INM.
                </span>
              </div>
              <input
                id="input-ah-gi"
                type="number"
                step="0.01"
                placeholder="Ej. 1.2"
                value={formData.GI !== undefined ? formData.GI : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("GI", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 14. GRANO VERDE (% G. V) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">GRANO VERDE</span>
                <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  % G. V
                </span>
              </div>
              <input
                id="input-ah-gv"
                type="number"
                step="0.01"
                placeholder="Ej. 0.6"
                value={formData.GV !== undefined ? formData.GV : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("GV", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* 15. BLANCURA INTEGRAL (BL. INT.) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-cyan-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">BLANCURA INTEGRAL</span>
                <span className="text-[10px] font-mono font-black text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                  BL. INT.
                </span>
              </div>
              <input
                id="input-ah-bintegral"
                type="number"
                step="0.01"
                placeholder="Ej. 22.0"
                value={formData["B.INTEGRAL"] !== undefined ? formData["B.INTEGRAL"] : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("B.INTEGRAL", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* 16. BLANCURA DE PULIDO (B. PULIDO) */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-750 hover:border-cyan-500/50 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-white">BLANCURA DE PULIDO</span>
                <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                  B. PULIDO
                </span>
              </div>
              <input
                id="input-ah-bpulido"
                type="number"
                step="0.01"
                placeholder="Ej. 30.5"
                value={formData["B. PULIDO"] !== undefined ? formData["B. PULIDO"] : ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleChange("B. PULIDO", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: PARÁMETROS ORGANOLÉPTICOS (6 PARÁMETROS) */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              <span>2. Parámetros Organolépticos</span>
            </div>
            <span className="text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-750">
              PALOTE, VANO, IMPUREZA, OLOR, FALSO CARBÓN, HONGO
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
            {/* 17. PALOTE (PALT) */}
            <OrganolepticoInput
              id="input-ah-palote"
              label="PALOTE"
              abreviatura="PALT"
              condicionApto="P o R"
              value={formData.PALOTE !== undefined ? formData.PALOTE : "P"}
              onChange={(val) => handleChange("PALOTE", val)}
              pesoPct={1}
            />

            {/* 18. VANO (VN) */}
            <OrganolepticoInput
              id="input-ah-vano"
              label="VANO"
              abreviatura="VN"
              condicionApto="P o R"
              value={formData.VANO !== undefined ? formData.VANO : "P"}
              onChange={(val) => handleChange("VANO", val)}
              pesoPct={5}
            />

            {/* 19. IMPUREZA (IMP.) */}
            <OrganolepticoInput
              id="input-ah-impurezs"
              label="IMPUREZA"
              abreviatura="IMP."
              condicionApto="P o R"
              value={formData.IMPUREZS !== undefined ? formData.IMPUREZS : "P"}
              onChange={(val) => handleChange("IMPUREZS", val)}
              pesoPct={1}
            />

            {/* 20. OLOR (OL) */}
            <OrganolepticoInput
              id="input-ah-olor"
              label="OLOR"
              abreviatura="OL"
              condicionApto="P (Poco)"
              value={formData.OLOR !== undefined ? formData.OLOR : "P"}
              onChange={(val) => handleChange("OLOR", val)}
              pesoPct={10}
            />

            {/* 21. FALSO CARBON (F. CARB.) */}
            <OrganolepticoInput
              id="input-ah-fcarbon"
              label="FALSO CARBÓN"
              abreviatura="F. CARB."
              condicionApto="P (Poco)"
              value={formData["F. CARBON"] !== undefined ? formData["F. CARBON"] : "P"}
              onChange={(val) => handleChange("F. CARBON", val)}
              pesoPct={5}
            />

            {/* 22. HONGO (HON.) */}
            <OrganolepticoInput
              id="input-ah-hongo"
              label="HONGO"
              abreviatura="HON."
              condicionApto="P (Poco)"
              value={formData.HONGO !== undefined ? formData.HONGO : "P"}
              onChange={(val) => handleChange("HONGO", val)}
              pesoPct={4}
            />
          </div>

          {/* Observaciones de Laboratorio */}
          <div className="mt-4 pt-3 border-t border-slate-750">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones de Laboratorio / Dictamen
            </label>
            <textarea
              id="textarea-ah-obs"
              rows={2}
              value={formData.OBSERVACIONES || ""}
              onChange={(e) => handleChange("OBSERVACIONES", e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
              placeholder="Detalles sobre uniformidad del grano, dictamen de calidad, recomendaciones..."
            />
          </div>
        </div>

        {/* Submit Action Bar */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              Análisis físico registrado exitosamente. Formulario preparado para nuevo registro.
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar Campos
            </button>
            <button
              id="btn-save-analisis-humedo"
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Guardando..." : "Guardar Ficha de Análisis Físico"}
            </button>
          </div>
        </div>
      </form>

      {/* Modal Ficha Unificada & Matriz */}
      {modalFichaOpen && selectedLoteId && (
        <FichaUnificadaModal
          isOpen={modalFichaOpen}
          loteId={selectedLoteId}
          lotes={lotes}
          analisisHumedos={analisisList}
          onClose={() => setModalFichaOpen(false)}
        />
      )}
    </div>
  );
};
