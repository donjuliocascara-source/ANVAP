import React, { useState, useMemo, useEffect } from "react";
import { ProgramacionApit, Lote, BatchVaporizado, AIRecommendation, UserProfile, PriorizacionMasterConfig } from "../types";
import { 
  CalendarCheck, 
  Sparkles, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Gauge, 
  Scale, 
  Info,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Flame,
  Layers,
  Plus,
  Trash2,
  AlertOctagon,
  Eye,
  Check
} from "lucide-react";
import { calcularPrioridadesLotes, CONFIG_PRIORIZACION_DEFAULT } from "../utils/priorizacionService";
import { calculateBatchPayloadSummary } from "../utils/batchCalculator";
import { BatchPayloadSummaryCard } from "./BatchPayloadSummaryCard";

interface ProgramacionApitViewProps {
  programaciones?: ProgramacionApit[];
  lotes?: Lote[];
  batches?: BatchVaporizado[];
  analisisHumedos?: any[];
  equipos?: any[];
  initialLoteId?: string;
  currentUser?: UserProfile;
  configPriorizacion?: PriorizacionMasterConfig;
  onSaveProgramacion: (prog: Partial<ProgramacionApit>) => Promise<void>;
  onRequestAIRecommendation?: (loteId: string) => Promise<AIRecommendation>;
  onNavigate?: (tab: string, filterId?: string) => void;
  onSelectLoteForFicha?: (loteId: string) => void;
}

export const ProgramacionApitView: React.FC<ProgramacionApitViewProps> = ({
  programaciones = [],
  lotes = [],
  batches = [],
  analisisHumedos = [],
  equipos = [],
  initialLoteId,
  currentUser,
  configPriorizacion = CONFIG_PRIORIZACION_DEFAULT,
  onSaveProgramacion,
  onRequestAIRecommendation,
  onNavigate,
  onSelectLoteForFicha
}) => {
  const [selectedLoteId, setSelectedLoteId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.BATCH_ID || "BATCH-2026-01");
  
  // Multi-lot selection for batch
  const [selectedBatchLotes, setSelectedBatchLotes] = useState<
    { loteId: string; sacos: number; pesoKg: number; pesoTn: number; variedad: string; cliente: string; humedad: number; prioridad: number; riesgo: string }[]
  >([]);

  // Calculated prioritization list
  const prioritizedLotes = useMemo(() => {
    return calcularPrioridadesLotes(lotes, analisisHumedos, configPriorizacion);
  }, [lotes, analisisHumedos, configPriorizacion]);

  const selectedLote = lotes.find((l) => l.LOTE_ID === selectedLoteId);
  const selectedLotePrio = prioritizedLotes.find((p) => p.loteId === selectedLoteId);

  // Form State
  const [formData, setFormData] = useState<Partial<ProgramacionApit>>({
    PROGRAMACION_ID: "",
    BATCH_ID: batches[0]?.BATCH_ID || "BATCH-2026-01",
    LOTE_ID: initialLoteId || lotes[0]?.LOTE_ID || "",
    FECHA_PROGRAMACION: new Date().toISOString().split("T")[0],
    PRIORIDAD: "ALTA",
    SACOS_PROGRAMADOS: selectedLote?.SACOS || 450,
    PESO_PROGRAMADO_KG: selectedLote?.PESO_KG || 22500,
    HUMEDAD_REFERENCIA: selectedLote?.HUM || 14.2,
    ESTADO_PROGRAMACION: "PROGRAMADO",
    APTO_APIT: "SI",
    MOTIVO_RECHAZO: "",
    OBSERVACIONES: ""
  });

  // AI Recommendation State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRec, setAiRec] = useState<AIRecommendation | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto-sync selected lot if current one is programmed and leaves the pending list
  useEffect(() => {
    if (initialLoteId && lotes.some(l => l.LOTE_ID === initialLoteId)) {
      handleLoteChange(initialLoteId);
    } else if (prioritizedLotes.length > 0) {
      if (!selectedLoteId || !prioritizedLotes.some(p => p.loteId === selectedLoteId)) {
        const nextId = prioritizedLotes[0].loteId;
        handleLoteChange(nextId);
      }
    } else if (prioritizedLotes.length === 0) {
      setSelectedLoteId("");
    }
  }, [initialLoteId, prioritizedLotes]);

  const handleLoteChange = (loteId: string) => {
    setSelectedLoteId(loteId);
    const l = lotes.find((item) => item.LOTE_ID === loteId);
    const p = prioritizedLotes.find((item) => item.loteId === loteId);
    if (l) {
      const sacos = l.SACOS || Math.round((l.PESO_KG || 25000) / 50);
      const pesoKg = l.PESO_KG || sacos * 50;
      setFormData((prev) => ({
        ...prev,
        LOTE_ID: loteId,
        SACOS_PROGRAMADOS: sacos,
        PESO_PROGRAMADO_KG: pesoKg,
        HUMEDAD_REFERENCIA: l.HUM,
        PRIORIDAD: p?.nivelRiesgo === "EMERGENCIA" || p?.nivelRiesgo === "ALTO" ? "ALTA" : "MEDIA"
      }));
    }
    setAiRec(null);
  };

  const handleAddLoteToBatchComposition = (loteIdToAdd: string) => {
    if (!loteIdToAdd) return;
    if (selectedBatchLotes.some(item => item.loteId === loteIdToAdd)) return;

    const loteObj = lotes.find(l => l.LOTE_ID === loteIdToAdd);
    const prioObj = prioritizedLotes.find(p => p.loteId === loteIdToAdd);
    if (!loteObj) return;

    const sacos = loteObj.SACOS || Math.round((loteObj.PESO_KG || 25000) / 50);
    const pesoKg = loteObj.PESO_KG || sacos * 50;
    const pesoTn = Number((pesoKg / 1000).toFixed(2));

    setSelectedBatchLotes(prev => [
      ...prev,
      {
        loteId: loteIdToAdd,
        sacos,
        pesoKg,
        pesoTn,
        variedad: loteObj.VARIEDAD || "Sin Variedad",
        cliente: loteObj.CLIENTE || "Sin Cliente",
        humedad: Number(loteObj.HUM || 14.0),
        prioridad: prioObj?.puntuacionFinal || 65,
        riesgo: prioObj?.nivelRiesgo || "BAJO"
      }
    ]);
  };

  const handleRemoveLoteFromBatchComposition = (loteIdToRemove: string) => {
    setSelectedBatchLotes(prev => prev.filter(item => item.loteId !== loteIdToRemove));
  };

  // Dynamic Batch Payload Summary Calculation
  const selectedBatchObj = batches.find(b => b.BATCH_ID === selectedBatchId);
  const autoclaveCapacityTn = selectedBatchObj?.CAPACIDAD_PROGRAMADA_TN || 25.0;

  const batchPayloadSummary = useMemo(() => {
    return calculateBatchPayloadSummary(
      selectedBatchLotes.map(l => ({
        loteId: l.loteId,
        sacos: l.sacos,
        pesoKg: l.pesoKg,
        variedad: l.variedad,
        cliente: l.cliente,
        humedad: l.humedad
      })),
      autoclaveCapacityTn
    );
  }, [selectedBatchLotes, autoclaveCapacityTn]);

  // Totals of multi-lot composition
  const batchCompositionTotals = useMemo(() => {
    const totalSacos = batchPayloadSummary.totalSacos;
    const totalKg = batchPayloadSummary.totalPesoKg;
    const totalTn = batchPayloadSummary.totalPesoTn;
    return { totalSacos, totalKg, totalTn };
  }, [batchPayloadSummary]);

  const handleConsultAI = async () => {
    if (!selectedLoteId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      if (onRequestAIRecommendation) {
        const rec = await onRequestAIRecommendation(selectedLoteId);
        setAiRec(rec);
      }
    } catch (err: any) {
      setAiError(err.message || "Error al obtener recomendación IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId) return;
    setIsSaving(true);
    try {
      await onSaveProgramacion({
        ...formData,
        LOTE_ID: selectedLoteId,
        BATCH_ID: selectedBatchId
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-cyan-400" />
            Programación de Proceso APIT (PROGRAMACION_APIT)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Criterio de aptitud técnica, asignación de prioridad, cubicaje por lote (Sacos y Peso) y conformación de Batches multi-código.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate("priorizacion")}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              Ver Tablero de Priorización
            </button>
          )}

          <button
            id="btn-trigger-ai-rec"
            onClick={handleConsultAI}
            disabled={aiLoading || !selectedLoteId}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-purple-200" />
            )}
            {aiLoading ? "Consultando IA..." : "Recomendar Parámetros con IA"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Programación & Conformación de Batches */}
        <div className="lg:col-span-2 space-y-5">
          {/* Main Programacion Form */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700 pb-2">
              <CalendarCheck className="w-4 h-4 text-cyan-400" />
              1. Registro de Programación de Lote Individual
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lote */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lote a Programar <span className="text-amber-400">*</span>
                  </label>
                  <select
                    id="select-prog-lote"
                    aria-label="Seleccionar lote disponible para programación"
                    value={selectedLoteId}
                    onChange={(e) => handleLoteChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                    required
                  >
                    <option value="">Seleccione un Lote</option>
                    {prioritizedLotes.map((p) => (
                      <option key={p.loteId} value={p.loteId}>
                        #{p.posicion} - {p.loteId} | {p.variedad} ({p.sacos} sacos, {p.pesoTn} TN, {p.humedad}%) - [{p.nivelRiesgo}]
                      </option>
                    ))}
                  </select>

                  {/* Lote Quick Info Tag */}
                  {selectedLotePrio && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-750 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedLotePrio.nivelRiesgo === "EMERGENCIA"
                            ? "bg-rose-950 text-rose-300 border border-rose-800 animate-pulse"
                            : selectedLotePrio.nivelRiesgo === "ALTO"
                            ? "bg-orange-950 text-orange-300 border border-orange-800"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        }`}>
                          {selectedLotePrio.nivelRiesgo} ({selectedLotePrio.puntuacionFinal} pts)
                        </span>
                        <span className="text-slate-300 font-mono">
                          {selectedLotePrio.diasRestantes <= 0 ? "¡Resistencia Vencida!" : `${selectedLotePrio.diasRestantes} días restantes`}
                        </span>
                      </div>
                      <div className="font-mono text-cyan-300 font-bold">
                        {selectedLotePrio.sacos} Sacos / {selectedLotePrio.pesoTn} TN
                      </div>
                    </div>
                  )}
                </div>

                {/* Batch Asignado */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Batch Destino <span className="text-amber-400">*</span>
                  </label>
                  <select
                    id="select-prog-batch"
                    aria-label="Seleccionar batch de destino"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                    required
                  >
                    {batches.map((b) => (
                      <option key={b.BATCH_ID} value={b.BATCH_ID}>
                        {b.BATCH_ID} - {b.EQUIPO} ({b.CAPACIDAD_PROGRAMADA_TN || 25} TN)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sacos y Peso Columns */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Cantidad de Sacos <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="input-prog-sacos"
                    type="number"
                    value={formData.SACOS_PROGRAMADOS || ""}
                    onChange={(e) => {
                      const sacosVal = parseInt(e.target.value) || 0;
                      setFormData((p) => ({
                        ...p,
                        SACOS_PROGRAMADOS: sacosVal,
                        PESO_PROGRAMADO_KG: sacosVal * 50
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Peso Total (KG) <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="input-prog-peso"
                    type="number"
                    value={formData.PESO_PROGRAMADO_KG || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, PESO_PROGRAMADO_KG: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-cyan-300 font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Peso Equivalente (TN)
                  </label>
                  <div className="w-full bg-slate-900/60 border border-slate-700/60 rounded px-2.5 py-1.5 text-xs text-cyan-400 font-mono font-extrabold">
                    {((formData.PESO_PROGRAMADO_KG || 0) / 1000).toFixed(2)} TN
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Prioridad</label>
                  <select
                    id="select-prog-prioridad"
                    aria-label="Seleccionar prioridad del lote"
                    value={formData.PRIORIDAD || "ALTA"}
                    onChange={(e) => setFormData((p) => ({ ...p, PRIORIDAD: e.target.value as any }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-amber-300 font-bold"
                  >
                    <option value="ALTA">ALTA (Emergencia)</option>
                    <option value="MEDIA">MEDIA</option>
                    <option value="BAJA">BAJA</option>
                  </select>
                </div>
              </div>

              {/* Apto APIT & Observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Apto APIT</label>
                  <select
                    id="select-prog-apto"
                    aria-label="Seleccionar estado de aptitud APIT"
                    value={formData.APTO_APIT || "SI"}
                    onChange={(e) => setFormData((p) => ({ ...p, APTO_APIT: e.target.value as any }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-bold"
                  >
                    <option value="SI">SI - Conforme</option>
                    <option value="OBSERVADO">OBSERVADO</option>
                    <option value="NO">NO - Rechazado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Observaciones</label>
                  <input
                    type="text"
                    placeholder="Instrucciones operativas..."
                    value={formData.OBSERVACIONES || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, OBSERVACIONES: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Programación guardada exitosamente
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow-md transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Guardando..." : "Guardar Programación de Lote"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Multi-lot Batch Composition Section */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  2. Conformación de Batch Multi-Lote (1 a Más Códigos con Sacos y Peso)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Agrupe múltiples lotes en un solo Batch de vaporizado verificando balance de masa vs capacidad de autoclave.
                </p>
              </div>

              {/* Quick Add Selector */}
              <div className="flex items-center gap-1.5">
                <select
                  id="select-add-lote-batch"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddLoteToBatchComposition(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-sans"
                  defaultValue=""
                >
                  <option value="" disabled>+ Agregar lote al Batch...</option>
                  {prioritizedLotes.map(p => (
                    <option key={p.loteId} value={p.loteId}>
                      {p.loteId} - {p.variedad} ({p.sacos} sacos, {p.pesoTn} TN)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batch Lots Table */}
            {selectedBatchLotes.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-750 rounded-xl text-xs text-slate-500 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p>No ha agregado lotes a la conformación de este batch.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLoteId) handleAddLoteToBatchComposition(selectedLoteId);
                  }}
                  className="px-3 py-1.5 bg-slate-750 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                >
                  + Agregar lote actual ({selectedLoteId || "C02020"})
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-slate-750 rounded-xl bg-slate-900/60">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-850 text-slate-300 text-[11px] font-semibold border-b border-slate-750">
                      <tr>
                        <th className="p-2.5">Código Lote</th>
                        <th className="p-2.5 font-sans">Cliente</th>
                        <th className="p-2.5 font-sans">Variedad</th>
                        <th className="p-2.5 text-center">Humedad</th>
                        <th className="p-2.5 text-right">Cantidad Sacos</th>
                        <th className="p-2.5 text-right">Peso (KG)</th>
                        <th className="p-2.5 text-right">Peso (TN)</th>
                        <th className="p-2.5 text-center">Riesgo</th>
                        <th className="p-2.5 text-right font-sans">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {selectedBatchLotes.map((item) => (
                        <tr key={item.loteId} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-amber-400">{item.loteId}</td>
                          <td className="p-2.5 font-sans text-slate-300 text-[11px]">{item.cliente}</td>
                          <td className="p-2.5 font-sans text-slate-400 text-[11px]">{item.variedad}</td>
                          <td className="p-2.5 text-center text-amber-300">{item.humedad}%</td>
                          <td className="p-2.5 text-right font-bold text-white">{item.sacos} sacos</td>
                          <td className="p-2.5 text-right text-slate-300">{item.pesoKg?.toLocaleString()} kg</td>
                          <td className="p-2.5 text-right font-bold text-cyan-300">{item.pesoTn} TN</td>
                          <td className="p-2.5 text-center font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.riesgo === "EMERGENCIA"
                                ? "bg-rose-950 text-rose-300"
                                : item.riesgo === "ALTO"
                                ? "bg-orange-950 text-orange-300"
                                : "bg-emerald-950 text-emerald-300"
                            }`}>
                              {item.riesgo}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-sans">
                            <button
                              onClick={() => handleRemoveLoteFromBatchComposition(item.loteId)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Quitar lote de este batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-850 font-bold border-t border-slate-700 text-xs">
                      <tr>
                        <td colSpan={4} className="p-2.5 font-sans text-slate-300">
                          TOTAL BATCH ({selectedBatchLotes.length} Códigos de Lote):
                        </td>
                        <td className="p-2.5 text-right text-white font-mono">
                          {batchCompositionTotals.totalSacos} sacos
                        </td>
                        <td className="p-2.5 text-right text-slate-300 font-mono">
                          {batchCompositionTotals.totalKg?.toLocaleString()} kg
                        </td>
                        <td className="p-2.5 text-right text-cyan-300 font-mono font-extrabold">
                          {batchCompositionTotals.totalTn} TN
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Dynamic Payload Summary Card */}
                <BatchPayloadSummaryCard
                  summary={batchPayloadSummary}
                  title={`Resumen Dinámico de Carga Útil - Batch ${selectedBatchId}`}
                  subtitle={`Equipo: ${selectedBatchObj?.EQUIPO || "Autoclave"} (Capacidad nominal: ${autoclaveCapacityTn} TN)`}
                  showBreakdown={true}
                  compact={false}
                  onAutoFillWeight={() => {
                    setFormData(prev => ({
                      ...prev,
                      TON_VAPORIZAR: batchPayloadSummary.totalPesoTn
                    }));
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendation Output Card */}
        <div className="space-y-4">
          <div className="bg-gradient-to-b from-slate-800 to-slate-850 rounded-xl border border-purple-500/40 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Diagnóstico & Recomendación IA
              </div>
              {aiRec && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700">
                  Confianza: {aiRec.nivel_confianza_general}
                </span>
              )}
            </div>

            {aiLoading && (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                <p className="text-xs text-purple-300 font-medium">
                  Analizando correlaciones históricas, prioridad por humedad y matriz organoléptica...
                </p>
              </div>
            )}

            {!aiLoading && !aiRec && (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-purple-400/40 mx-auto" />
                <p className="text-xs">
                  Haga clic en <strong>"Recomendar Parámetros con IA"</strong> para que Gemini analice los lotes históricos similares y sugiera la receta óptima.
                </p>
              </div>
            )}

            {!aiLoading && aiRec && (
              <div className="space-y-4 text-xs">
                {/* Diagnóstico */}
                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-750">
                  <div className="text-[10px] text-purple-300 uppercase font-bold mb-1">Resumen del Lote</div>
                  <p className="text-slate-200 text-xs leading-relaxed">{aiRec.resumen_diagnostico}</p>
                </div>

                {/* Parámetros Recomendados */}
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Parámetros Operativos Sugeridos:</div>
                  {aiRec.parametros.map((param, idx) => (
                    <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-750 flex flex-col gap-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-white">{param.parametro}</span>
                        <span className="font-mono text-purple-300 font-bold text-sm">
                          {param.recomendado} {param.unidad}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">{param.justificacion}</div>
                    </div>
                  ))}
                </div>

                {/* Riesgos */}
                {aiRec.riesgos_identificados?.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 text-[11px] space-y-1">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Riesgos Detectados:
                    </div>
                    <ul className="list-disc pl-4 text-amber-200/90 space-y-0.5">
                      {aiRec.riesgos_identificados.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
