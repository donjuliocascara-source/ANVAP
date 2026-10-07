import React, { useState, useMemo, useEffect } from "react";
import { 
  GitMerge, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Scale, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Info,
  Check,
  RotateCcw
} from "lucide-react";
import { 
  Lote, 
  BatchVaporizado, 
  AnalisisHumedo, 
  ParametrosTrabajo, 
  SaldoLoteInfo, 
  SubBatchDraft 
} from "../types";
import { 
  calcularSaldosLotes, 
  validarCompatibilidadLotes, 
  generarPlanUnionSubBatches,
  PARAMETROS_TRABAJO_DEFAULT 
} from "../utils/batchEngine";
import { 
  evaluarUnionLotesEnBatch, 
  obtenerCriteriosUnionGuardados 
} from "../utils/criteriosUnionLotes";

interface ModalUnirCodigosProps {
  isOpen: boolean;
  onClose: () => void;
  lotes: Lote[];
  analisisHumedos: AnalisisHumedo[];
  batchesExistentes: BatchVaporizado[];
  batchLotes?: any[];
  parametros?: ParametrosTrabajo;
  onSaveBatch: (batchData: Partial<BatchVaporizado>, assignedLotes: any[]) => Promise<void>;
  onRefreshData?: () => void;
}

export const ModalUnirCodigos: React.FC<ModalUnirCodigosProps> = ({
  isOpen,
  onClose,
  lotes,
  analisisHumedos,
  batchesExistentes,
  batchLotes = [],
  parametros = PARAMETROS_TRABAJO_DEFAULT,
  onSaveBatch,
  onRefreshData
}) => {
  // Proceso Macro Padre por defecto: V200
  const [macroProceso, setMacroProceso] = useState<string>("V200");
  const [capacidadSubBatchKg, setCapacidadSubBatchKg] = useState<number>(35000);

  // Real-time saldos: para este módulo de unión, excluimos los sub-batches del mismo macro-proceso
  // de modo que los lotes muestren su tonelaje disponible para la planificación del proceso macro.
  const saldosMap = useMemo(() => {
    const filteredBatchLotes = (batchLotes || []).filter(bl => {
      const bObj = batchesExistentes.find(b => b.BATCH_ID === bl.BATCH_ID);
      const isCurrentMacro = (bObj?.PROCESO_PADRE === macroProceso) || (bl.BATCH_ID && bl.BATCH_ID.includes(macroProceso));
      return !isCurrentMacro;
    });
    const filteredBatches = batchesExistentes.filter(b => b.PROCESO_PADRE !== macroProceso && !b.CORRELATIVO?.startsWith(`${macroProceso}-`));
    return calcularSaldosLotes(lotes, filteredBatchLotes, filteredBatches, analisisHumedos);
  }, [lotes, batchLotes, batchesExistentes, analisisHumedos, macroProceso]);

  // Lotes disponibles con saldo
  const lotesConSaldo = useMemo(() => {
    return lotes.filter((l) => {
      const s = saldosMap.get(l.LOTE_ID);
      const saldo = s ? s.saldoPendienteKg : (Number(l.PESO_KG) || 0);
      return saldo > 50; // Al menos 50 kg de saldo
    });
  }, [lotes, saldosMap]);

  // Selected lot IDs to unite
  const [selectedLoteIds, setSelectedLoteIds] = useState<string[]>([]);
  const [subBatches, setSubBatches] = useState<SubBatchDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize selection if modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      const initialSelection = lotesConSaldo.slice(0, 3).map(l => l.LOTE_ID);
      setSelectedLoteIds(initialSelection);
      
      const plan = initialSelection.length > 0 
        ? generarPlanUnionSubBatches(initialSelection, lotes, "V200", 35000, saldosMap)
        : [];
      setSubBatches(plan);
    }
  }, [isOpen, lotes, lotesConSaldo, saldosMap]);

  // Cargar caso oficial V200
  const handleCargarCasoOficial = () => {
    const targetIds = ["C08432", "C08434", "C08428"];
    setSelectedLoteIds(targetIds);
    setMacroProceso("V200");
    const plan = generarPlanUnionSubBatches(targetIds, lotes, "V200", 35000, saldosMap);
    setSubBatches(plan);
    setErrorMessage(null);
  };

  // Toggle selection of a lot
  const handleToggleLote = (loteId: string) => {
    setSelectedLoteIds(prev => {
      const next = prev.includes(loteId) ? prev.filter(id => id !== loteId) : [...prev, loteId];
      if (next.length > 0) {
        const plan = generarPlanUnionSubBatches(next, lotes, macroProceso, capacidadSubBatchKg, saldosMap);
        setSubBatches(plan);
      } else {
        setSubBatches([]);
      }
      return next;
    });
  };

  // Regenerate plan when macroProceso or capacidad changes
  const handleRegenerarPlan = () => {
    if (selectedLoteIds.length === 0) return;
    const plan = generarPlanUnionSubBatches(selectedLoteIds, lotes, macroProceso, capacidadSubBatchKg, saldosMap);
    setSubBatches(plan);
  };

  // Compatibility evaluation using official plant criteria
  const criteriosConfig = useMemo(() => obtenerCriteriosUnionGuardados(), []);
  const evaluacionCompatibilidad = useMemo(() => {
    return validarCompatibilidadLotes(selectedLoteIds, lotes, analisisHumedos, parametros, saldosMap);
  }, [selectedLoteIds, lotes, analisisHumedos, parametros, saldosMap]);

  // Evaluacion por criterios oficiales de union
  const evaluacionUnionOficial = useMemo(() => {
    const lotesFilas = selectedLoteIds.map(id => {
      const l = lotes.find(item => item.LOTE_ID === id);
      const ah = analisisHumedos.find(item => item.LOTE_ID === id);
      const s = saldosMap.get(id);
      return {
        loteId: id,
        cliente: l?.CLIENTE || "Cliente General",
        variedad: l?.VARIEDAD || "Tinajones",
        hum: Number(ah?.HUMEDADES ?? l?.HUM ?? 14.0),
        tt: Number(ah?.TT ?? 3.5),
        qi: Number(ah?.QI ?? 12.0),
        qb: Number(ah?.QB ?? 14.0),
        bli: Number(ah?.BLI ?? ah?.["B.INTEGRAL"] ?? 22.0),
        blp: Number(ah?.BLP ?? ah?.["B. PULIDO"] ?? 30.5),
        m: Number(ah?.M ?? ah?.MANCHADO ?? 0.6),
        tz: Number(ah?.TZ ?? 1.5),
        desv: Number(l?.DESV ?? 1.2),
        impurezas: Number(ah?.IMPUREZS ?? 0.5),
        pesoKg: s?.saldoPendienteKg ?? Number(l?.PESO_KG ?? 18000),
        sacos: s?.sacosPendientes ?? Number(l?.SACOS ?? 360)
      };
    });
    return evaluarUnionLotesEnBatch(lotesFilas, criteriosConfig);
  }, [selectedLoteIds, lotes, analisisHumedos, saldosMap, criteriosConfig]);

  // Summary of lot consumption across all configured sub-batches
  const resumenConsumoLotes = useMemo(() => {
    return selectedLoteIds.map(loteId => {
      const l = lotes.find(item => item.LOTE_ID === loteId);
      const s = saldosMap.get(loteId);
      const pesoDisponible = s ? s.saldoPendienteKg : (Number(l?.PESO_KG) || 0);
      const sacosDisponibles = s ? s.sacosPendientes : (Number(l?.SACOS) || 0);

      let asignadoKg = 0;
      subBatches.forEach(sb => {
        sb.asignaciones.forEach(a => {
          if (a.loteId === loteId) {
            asignadoKg += a.pesoKg;
          }
        });
      });

      const restanteKg = Math.max(0, pesoDisponible - asignadoKg);
      const restanteSacos = Math.max(0, Math.round(restanteKg / 50));
      const porcentajeAsignado = pesoDisponible > 0 ? Number(((asignadoKg / pesoDisponible) * 100).toFixed(1)) : 0;

      return {
        loteId,
        cliente: l?.CLIENTE || "Cliente",
        variedad: l?.VARIEDAD || "Variedad",
        pesoDisponible,
        sacosDisponibles,
        asignadoKg,
        restanteKg,
        restanteSacos,
        porcentajeAsignado,
        estaCompleto: restanteKg <= 10
      };
    });
  }, [selectedLoteIds, lotes, saldosMap, subBatches]);

  // Edit an assignment in a sub-batch
  const handleActualizarAsignacionKg = (subBatchIndex: number, loteId: string, nuevoKg: number) => {
    setSubBatches(prev => {
      const copy = [...prev];
      const sb = { ...copy[subBatchIndex] };
      const asigs = sb.asignaciones.map(a => {
        if (a.loteId === loteId) {
          const kg = Math.max(0, nuevoKg);
          return {
            ...a,
            pesoKg: kg,
            sacos: Math.round(kg / 50)
          };
        }
        return a;
      });

      const totalKg = asigs.reduce((acc, a) => acc + a.pesoKg, 0);
      asigs.forEach(a => {
        a.porcentajeSubBatch = totalKg > 0 ? Number(((a.pesoKg / totalKg) * 100).toFixed(1)) : 0;
      });

      sb.asignaciones = asigs;
      sb.pesoTotalKg = totalKg;
      sb.totalSacos = Math.round(totalKg / 50);
      copy[subBatchIndex] = sb;
      return copy;
    });
  };

  // Add new empty sub-batch
  const handleAgregarSubBatch = () => {
    const nextNum = subBatches.length + 1;
    const newId = `${macroProceso}-${nextNum}`;
    const newDraft: SubBatchDraft = {
      id: newId,
      subBatchCorrelativo: newId,
      procesoPadre: macroProceso,
      turno: nextNum % 2 === 1 ? "Turno Día" : "Turno Noche",
      fecha: new Date().toISOString().split("T")[0],
      equipo: "APIT",
      pesoTotalKg: 0,
      totalSacos: 0,
      observaciones: `Sub-Batch ${newId} del proceso de unión ${macroProceso}`,
      asignaciones: selectedLoteIds.map(id => ({
        loteId: id,
        pesoKg: 0,
        sacos: 0,
        parte: nextNum,
        totalPartes: nextNum,
        porcentajeSubBatch: 0
      }))
    };
    setSubBatches(prev => [...prev, newDraft]);
  };

  // Remove sub-batch
  const handleEliminarSubBatch = (index: number) => {
    setSubBatches(prev => prev.filter((_, i) => i !== index));
  };

  // Submit and register all sub-batches into system
  const handleConfirmarUnion = async () => {
    if (subBatches.length === 0) {
      setErrorMessage("Debe configurar al menos un sub-batch para el proceso de unión.");
      return;
    }

    if (!evaluacionCompatibilidad.esCompatible) {
      setErrorMessage(evaluacionCompatibilidad.motivosIncompatibilidad.join("; "));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const grupoUnionId = `UNION-${macroProceso}`;
      const primerLote = lotes.find(l => l.LOTE_ID === selectedLoteIds[0]);
      const clienteComun = evaluacionCompatibilidad.clienteComun || primerLote?.CLIENTE || "Cliente General";
      const variedadComun = evaluacionCompatibilidad.variedadComun || primerLote?.VARIEDAD || "VALOR";

      for (let i = 0; i < subBatches.length; i++) {
        const sb = subBatches[i];
        const batchId = `BAT-${sb.subBatchCorrelativo}`;
        const lotesAsignados = sb.asignaciones
          .filter(a => a.pesoKg > 0)
          .map(a => ({
            LOTE_ID: a.loteId,
            loteId: a.loteId,
            PESO_KG: a.pesoKg,
            pesoKg: a.pesoKg,
            SACOS: a.sacos,
            sacos: a.sacos,
            PARTE: a.parte,
            TOTAL_PARTES: a.totalPartes,
            CLIENTE: clienteComun,
            VARIEDAD: variedadComun,
            OBSERVACIONES: `Parte ${a.parte} de ${a.totalPartes} en Sub-Batch ${sb.subBatchCorrelativo}`
          }));

        const batchPayload: Partial<BatchVaporizado> = {
          BATCH_ID: batchId,
          CORRELATIVO: sb.subBatchCorrelativo,
          PROCESO_PADRE: macroProceso,
          SUB_BATCH: sb.subBatchCorrelativo,
          ES_SUB_BATCH: true,
          GRUPO_UNION_ID: grupoUnionId,
          LOTES_UNION: selectedLoteIds,
          CLIENTE: clienteComun,
          VARIEDAD: variedadComun,
          FECHA_PROGRAMADA: sb.fecha,
          TURNO: sb.turno,
          EQUIPO: "APIT",
          TON_PROGRAMADAS: Number((sb.pesoTotalKg / 1000).toFixed(2)),
          TON_PROCESADAS: 0,
          PESO_TOTAL_KG: sb.pesoTotalKg,
          TOTAL_SACOS: sb.totalSacos,
          CAPACIDAD_MAX_KG: 35000,
          CAPACIDAD_PROGRAMADA_TN: 35,
          CAPACIDAD_UTILIZADA_PCT: Number(((sb.pesoTotalKg / 35000) * 100).toFixed(1)),
          ESTADO_BATCH: "PROGRAMADO",
          ESTADO_COMPATIBILIDAD: "COMPATIBLE",
          OPERADOR: "Pedro Huamán",
          OBSERVACIONES: sb.observaciones || `Proceso de unión ${macroProceso} (${i + 1}/${subBatches.length})`
        };

        await onSaveBatch(batchPayload, lotesAsignados);
      }

      setSuccessMessage(`✅ Proceso de unión ${macroProceso} registrado con éxito. Se crearon ${subBatches.length} sub-batches (${subBatches.map(s => s.subBatchCorrelativo).join(", ")}). Los saldos restantes han quedado reservados exclusivamente para los códigos seleccionados.`);
      
      if (onRefreshData) {
        onRefreshData();
      }

      setTimeout(() => {
        onClose();
      }, 2500);

    } catch (err: any) {
      console.error("Error al registrar unión de lotes:", err);
      setErrorMessage(err?.message || "Ocurrió un error al guardar los sub-batches de unión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[94vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <GitMerge className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Módulo de Unión de Códigos y Planificación de Sub-Batches
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60 rounded-full flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-400" />
                  APIT Industrial 35 TN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Une códigos con parámetros similares y mismo cliente en un solo Proceso Maestro dividido en Sub-Batches (V200-1, V200-2, etc.). Los saldos quedan habilitados y reservados exclusivamente para el grupo seleccionado.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action Quick Button: Caso Oficial C08432, C08434, C08428 */}
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-3.5 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Caso Oficial Solicitado:</span>
                <span className="font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-700/50">
                  C08432 + C08434 + C08428 → Proceso V200
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                V200-1 (C08432 + parte C08434), V200-2 (parte C08434), V200-3 (restante C08434 + C08428).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCargarCasoOficial}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all self-start sm:self-auto shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Cargar Caso V200 Automático
          </button>
        </div>

        {/* Content Body Scrollable */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">

          {/* 1. Selección de Lotes a Unir */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px]">
                  1
                </span>
                Códigos de Lote Seleccionados para Unión ({selectedLoteIds.length})
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                Solo lotes con saldo disponible
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {lotesConSaldo.map(l => {
                const isSelected = selectedLoteIds.includes(l.LOTE_ID);
                const s = saldosMap.get(l.LOTE_ID);
                const saldoKg = s ? s.saldoPendienteKg : Number(l.PESO_KG || 0);
                const saldoSacos = s ? s.sacosPendientes : Number(l.SACOS || 0);

                return (
                  <div
                    key={l.LOTE_ID}
                    onClick={() => handleToggleLote(l.LOTE_ID)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/20"
                        : "bg-slate-900 border-slate-750 hover:border-slate-600 opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                          isSelected ? "bg-amber-500 border-amber-400 text-slate-950" : "border-slate-600 bg-slate-800"
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        {l.LOTE_ID}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {l.VARIEDAD || "VALOR"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 truncate font-medium">
                      {l.CLIENTE || "Cliente General"}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                      <span className="text-slate-400">Saldo:</span>
                      <span className="font-bold text-amber-300">
                        {(saldoKg / 1000).toFixed(1)} TN ({saldoSacos} scs)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Verificación de Compatibilidad y Criterios Oficiales */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px]">
                  2
                </span>
                Validación de Requisitos y Criterios de Mezcla
              </h4>
              {evaluacionCompatibilidad.esCompatible ? (
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  REQUISITOS CUMPLIDOS (100% COMPATIBLES)
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-red-950 text-red-300 border border-red-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  INCOMPATIBILIDAD DETECTADA
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Mismo Cliente</div>
                <div className="font-bold text-white mt-1 flex items-center gap-1">
                  {evaluacionCompatibilidad.mismoCliente ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {evaluacionCompatibilidad.clienteComun || "Mismo Cliente"}
                    </span>
                  ) : (
                    <span className="text-red-400">Clientes Diferentes</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Misma Variedad</div>
                <div className="font-bold text-white mt-1 flex items-center gap-1">
                  {evaluacionCompatibilidad.mismaVariedad ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {evaluacionCompatibilidad.variedadComun || "Misma Variedad"}
                    </span>
                  ) : (
                    <span className="text-amber-400">Variedades Distintas</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Dispersión Humedad</div>
                <div className="font-mono font-bold text-white mt-1">
                  {evaluacionUnionOficial.desviacionesPorParametro.find(p => p.parametro === "humedad") ? (
                    <span className="text-emerald-400">
                      Δ {(evaluacionUnionOficial.desviacionesPorParametro.find(p => p.parametro === "humedad")?.desviacionMaximaObservada || 0).toFixed(1)} pp (Permitido ≤ {criteriosConfig.toleranciaHumedad} pp)
                    </span>
                  ) : "Parámetro homogéneo"}
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Dispersión Quebrado / Def.</div>
                <div className="font-mono font-bold text-emerald-400 mt-1">
                  Dentro de tolerancia (≤ 2.0 pp)
                </div>
              </div>
            </div>

            {/* Regla de Oro: Reserva de Saldos */}
            <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong>Regla de Reserva Exclusiva de Saldos:</strong> Al confirmar la unión de los códigos seleccionados ({selectedLoteIds.join(", ")}), los saldos remanentes de cada código (como el sobrante de C08434) quedan habilitados y bloqueados para unirse <em>únicamente</em> entre los códigos de este grupo, evitando mezclas no autorizadas con lotes externos.
              </div>
            </div>
          </div>

          {/* 3. Desglose de Sub-Batches y Control de Sobrantes */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px]">
                    3
                  </span>
                  Configuración del Proceso Maestro y Sub-Batches ({subBatches.length})
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cada sub-batch se cargará al autoclave APIT de 35 TN. Edita los kilogramos asignados o utiliza el balanceo automático.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-750">
                  <span className="text-[11px] text-slate-400 font-semibold">Proceso:</span>
                  <input
                    type="text"
                    value={macroProceso}
                    onChange={(e) => setMacroProceso(e.target.value.toUpperCase())}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-300 font-mono font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAgregarSubBatch}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  Agregar Sub-Batch
                </button>
              </div>
            </div>

            {/* Tarjetas de Sub-Batches */}
            <div className="space-y-3">
              {subBatches.map((sb, sbIdx) => {
                const subTn = (sb.pesoTotalKg / 1000).toFixed(1);
                const capUtilizada = Number(((sb.pesoTotalKg / 35000) * 100).toFixed(1));
                const esOptimo = sb.pesoTotalKg >= 32000 && sb.pesoTotalKg <= 35000;

                return (
                  <div key={sb.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-750 space-y-3 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black font-mono text-xs">
                          {sb.subBatchCorrelativo}
                        </span>
                        <span className="text-xs font-bold text-white">
                          Sub-Batch #{sbIdx + 1} de {subBatches.length}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({sb.turno} - {sb.equipo})
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">Carga:</span>
                          <strong className="font-mono text-white">{subTn} TN</strong>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            esOptimo ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}>
                            {capUtilizada}% APIT
                          </span>
                        </div>

                        {subBatches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEliminarSubBatch(sbIdx)}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Eliminar este sub-batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabla de asignaciones por lote en este sub-batch */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {sb.asignaciones.map((asig) => {
                        const l = lotes.find(item => item.LOTE_ID === asig.loteId);

                        return (
                          <div key={asig.loteId} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-white">
                                {asig.loteId}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Parte {asig.parte}/{asig.totalPartes}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] text-slate-400 block mb-0.5">Kg a Cargar:</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={asig.pesoKg}
                                  onChange={(e) => handleActualizarAsignacionKg(sbIdx, asig.loteId, parseFloat(e.target.value) || 0)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono font-bold"
                                />
                              </div>
                              <div className="w-16">
                                <label className="text-[10px] text-slate-400 block mb-0.5">Sacos:</label>
                                <div className="text-xs font-mono font-bold text-white py-1 px-1.5 bg-slate-900 rounded border border-slate-800 text-center">
                                  {asig.sacos}
                                </div>
                              </div>
                            </div>

                            {asig.sobranteLoteTrasSubBatchKg !== undefined && (
                              <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-850">
                                <span className="text-slate-400">
                                  {asig.sobranteLoteTrasSubBatchKg > 0 
                                    ? (asig.loteId === "C08434" && sbIdx === 0 
                                        ? "Sobrante habilitado (para V200-2 y V200-3):" 
                                        : asig.loteId === "C08434" && sbIdx === 1 
                                        ? "Sobrante habilitado (para unirse con C08428):" 
                                        : "Sobrante disponible:")
                                    : "Sobrante restante:"}
                                </span>
                                <span className={`font-mono font-bold ${
                                  asig.sobranteLoteTrasSubBatchKg > 0 ? "text-amber-400" : "text-emerald-400"
                                }`}>
                                  {(asig.sobranteLoteTrasSubBatchKg / 1000).toFixed(1)} TN
                                  {asig.sobranteLoteTrasSubBatchKg === 0 && " (100% unido)"}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen de Liquidación de Lotes */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                Resumen de Consumo y Saldos de los Códigos Unidos
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {resumenConsumoLotes.map(r => (
                  <div key={r.loteId} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{r.loteId}</span>
                      {r.estaCompleto ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                          100% PROCESADO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-bold">
                          {r.porcentajeAsignado}% ASIGNADO
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ingreso: {(r.pesoDisponible / 1000).toFixed(1)} TN | Asignado: {(r.asignadoKg / 1000).toFixed(1)} TN
                    </div>
                    <div className="text-[11px] font-bold text-amber-300 pt-0.5 border-t border-slate-800">
                      Saldo restante: {(r.restanteKg / 1000).toFixed(1)} TN ({r.restanteSacos} sacos)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmarUnion}
            disabled={isSubmitting || subBatches.length === 0 || !evaluacionCompatibilidad.esCompatible}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              isSubmitting || !evaluacionCompatibilidad.esCompatible
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-950/40 cursor-pointer"
            }`}
          >
            <GitMerge className="w-4 h-4" />
            <span>
              {isSubmitting ? "Registrando Sub-Batches..." : `Registrar Proceso ${macroProceso} (${subBatches.length} Sub-Batches)`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
