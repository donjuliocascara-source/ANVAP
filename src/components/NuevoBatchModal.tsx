import React, { useState, useMemo, useEffect } from "react";
import { 
  Layers, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Scale, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Sparkles, 
  Scissors, 
  ArrowRight,
  Info,
  ShieldCheck
} from "lucide-react";
import { 
  Lote, 
  BatchVaporizado, 
  AnalisisHumedo, 
  ParametrosTrabajo, 
  SaldoLoteInfo 
} from "../types";
import { 
  calcularSaldosLotes, 
  validarCompatibilidadLotes, 
  evaluarCapacidadBatch, 
  generarSiguienteCorrelativoBatch,
  PARAMETROS_TRABAJO_DEFAULT
} from "../utils/batchEngine";
import { verificarAptitudProgramacionLote } from "../utils/evaluacionCalidad";
import { calcularPrioridadesLotes } from "../utils/priorizacionService";
import { 
  cargarProgramacionesOficiales, 
  obtenerInfoLoteEnBatches 
} from "../utils/programacionBatchOficialService";
import { recomendarRecetaPorPerfilIngreso } from "../utils/sabanaBatchesService";

interface NuevoBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotes: Lote[];
  analisisHumedos: AnalisisHumedo[];
  batchesExistentes: BatchVaporizado[];
  parametros?: ParametrosTrabajo;
  onSaveBatch: (batchData: Partial<BatchVaporizado>, assignedLotes: any[]) => Promise<void>;
  initialLoteId?: string;
  batchToEdit?: BatchVaporizado | null;
}

export const NuevoBatchModal: React.FC<NuevoBatchModalProps> = ({
  isOpen,
  onClose,
  lotes,
  analisisHumedos,
  batchesExistentes,
  parametros = PARAMETROS_TRABAJO_DEFAULT,
  onSaveBatch,
  initialLoteId,
  batchToEdit
}) => {
  // Calculate real-time saldos
  const saldosMap = useMemo(() => {
    return calcularSaldosLotes(lotes, [], batchesExistentes, analisisHumedos);
  }, [lotes, batchesExistentes, analisisHumedos]);

  // Form State
  const [correlativo, setCorrelativo] = useState<string>("");
  const [fechaProgramada, setFechaProgramada] = useState<string>(new Date().toISOString().split("T")[0]);
  const [turno, setTurno] = useState<string>("Turno Día");
  const [equipo, setEquipo] = useState<string>("APIT");
  const [operador, setOperador] = useState<string>("Pedro Huamán");
  const [observaciones, setObservaciones] = useState<string>("");

  // Selected lots in this batch: { loteId, pesoKg, sacos, parte, totalPartes }
  const [selectedLotes, setSelectedLotes] = useState<{
    loteId: string;
    pesoKg: number;
    sacos: number;
    parte: number;
    totalPartes: number;
  }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (batchToEdit) {
        setCorrelativo(batchToEdit.CORRELATIVO || batchToEdit.BATCH_ID);
        setFechaProgramada(batchToEdit.FECHA_PROGRAMADA || new Date().toISOString().split("T")[0]);
        setTurno(batchToEdit.TURNO || "Turno Día");
        setEquipo("APIT");
        setOperador(batchToEdit.OPERADOR || "Pedro Huamán");
        setObservaciones(batchToEdit.OBSERVACIONES || "");
      } else {
        const nextCorr = generarSiguienteCorrelativoBatch(batchesExistentes);
        setCorrelativo(nextCorr);
        setFechaProgramada(new Date().toISOString().split("T")[0]);
        setTurno("Turno Día");
        setEquipo("APIT");
        setOperador("Pedro Huamán");
        setObservaciones("");

        if (initialLoteId) {
          const saldo = saldosMap.get(initialLoteId);
          const loteObj = lotes.find(l => l.LOTE_ID === initialLoteId);
          const sacosIngresados = Number(loteObj?.SACOS) || (saldo?.sacosPendientes ?? 0);
          const pesoIngresado = Number(loteObj?.PESO_KG) || (sacosIngresados * 50) || (saldo?.saldoPendienteKg ?? 0);

          setSelectedLotes([{
            loteId: initialLoteId,
            pesoKg: pesoIngresado,
            sacos: sacosIngresados,
            parte: 1,
            totalPartes: 1
          }]);
        } else {
          setSelectedLotes([]);
        }
      }
    }
  }, [isOpen, batchToEdit, initialLoteId, batchesExistentes, saldosMap, parametros]);

  // Prioridades calculadas
  const lotesPriorizados = useMemo(() => {
    return calcularPrioridadesLotes(lotes, analisisHumedos);
  }, [lotes, analisisHumedos]);

  const prioridadMap = useMemo(() => {
    const map = new Map<string, any>();
    lotesPriorizados.forEach(p => {
      map.set(p.loteId.trim().toLowerCase(), p);
    });
    return map;
  }, [lotesPriorizados]);

  // List of pending lots available for assignment (saldo > 0, aptos para programación y NO programados en otros batches)
  // ORDENADOS ESTRICTAMENTE POR SU PRIORIDAD DE PROCESO
  const lotesDisponibles = useMemo(() => {
    const progsOficiales = cargarProgramacionesOficiales();
    const otherBatches = batchToEdit ? batchesExistentes.filter(b => b.BATCH_ID !== batchToEdit.BATCH_ID) : batchesExistentes;

    const list = lotes.filter((l) => {
      // 0. REGLA ESTRICTA DE PLANTA: Lotes ya programados en otro batch no deben aparecer disponibles
      const infoBatch = obtenerInfoLoteEnBatches(l.LOTE_ID, progsOficiales, otherBatches);
      if (infoBatch.estaProgramado && !infoBatch.esMismoBatch) {
        return false;
      }
      const s = saldosMap.get(l.LOTE_ID);
      if (!s || s.saldoPendienteKg <= 0) return false;
      const ahObj = analisisHumedos.find(a => a.LOTE_ID === l.LOTE_ID);
      const aptitud = verificarAptitudProgramacionLote(l, ahObj);
      return aptitud.esProgramable;
    });

    return [...list].sort((a, b) => {
      const pA = prioridadMap.get(a.LOTE_ID.trim().toLowerCase());
      const pB = prioridadMap.get(b.LOTE_ID.trim().toLowerCase());
      const posA = pA ? pA.posicion : 9999;
      const posB = pB ? pB.posicion : 9999;
      return posA - posB;
    });
  }, [lotes, saldosMap, analisisHumedos, prioridadMap, batchesExistentes, batchToEdit]);

  // Real-time Compatibility Check
  const compatibilidad = useMemo(() => {
    const selectedIds = selectedLotes.map((sl) => sl.loteId);
    return validarCompatibilidadLotes(selectedIds, lotes, analisisHumedos, parametros, saldosMap);
  }, [selectedLotes, lotes, analisisHumedos, parametros, saldosMap]);

  // Total weight and capacity balance
  const pesoTotalKg = useMemo(() => {
    return selectedLotes.reduce((sum, item) => sum + (Number(item.pesoKg) || 0), 0);
  }, [selectedLotes]);

  const totalSacos = useMemo(() => {
    return selectedLotes.reduce((sum, item) => sum + (Number(item.sacos) || 0), 0);
  }, [selectedLotes]);

  const capacidadBalance = useMemo(() => {
    return evaluarCapacidadBatch(pesoTotalKg, parametros);
  }, [pesoTotalKg, parametros]);

  // Check if any lot exceeds its pending saldo or ingress sacks
  const saldoErrors = useMemo(() => {
    const errors: { loteId: string; msg: string }[] = [];
    selectedLotes.forEach((item) => {
      const s = saldosMap.get(item.loteId);
      const maxAllowedKg = s?.saldoPendienteKg ?? 0;
      const maxAllowedSacos = s?.sacosPendientes ?? (maxAllowedKg > 0 ? Math.round(maxAllowedKg / 50) : 0);

      if (item.pesoKg > maxAllowedKg + 0.1) {
        errors.push({
          loteId: item.loteId,
          msg: `Cantidad no válida. El peso programado (${item.pesoKg.toLocaleString()} kg) excede el saldo pendiente (${maxAllowedKg.toLocaleString()} kg) del lote ${item.loteId}.`
        });
      } else if (item.sacos > maxAllowedSacos) {
        errors.push({
          loteId: item.loteId,
          msg: `La cantidad de sacos programados (${item.sacos}) no puede exceder a la cantidad de sacos de ingreso (${maxAllowedSacos}) del lote ${item.loteId}.`
        });
      }
    });
    return errors;
  }, [selectedLotes, saldosMap]);

  // Receta Histórica Recomendada de la Sábana de Batches Trabajados
  const recetaHistoricaRecomendada = useMemo(() => {
    if (selectedLotes.length === 0) return null;
    const primerLote = lotes.find(l => l.LOTE_ID === selectedLotes[0].loteId);
    if (!primerLote) return null;

    const variedad = primerLote.VARIEDAD || "VALOR";
    const hum = primerLote.HUM || primerLote.HUMEDAD || 14.0;
    const ah = analisisHumedos.find(a => a.LOTE_ID === primerLote.LOTE_ID);
    const quebrado = ah?.QB ?? ah?.QI ?? 12.0;

    return recomendarRecetaPorPerfilIngreso(variedad, hum, quebrado);
  }, [selectedLotes, lotes, analisisHumedos]);

  // Handlers for lot selection
  const handleAddLote = (loteId: string) => {
    const s = saldosMap.get(loteId);
    if (!s || s.saldoPendienteKg <= 0) return;

    if (selectedLotes.some((sl) => sl.loteId.toLowerCase() === loteId.toLowerCase())) {
      setErrorMessage(`🚫 Lote ya seleccionado: El lote ${loteId} ya forma parte de este batch.`);
      return;
    }

    // 0. REGLA ESTRICTA DE PLANTA: NO REPETIR LOTES ENTRE BATCHES
    const progsOficiales = cargarProgramacionesOficiales();
    const otherBatches = batchToEdit ? batchesExistentes.filter(b => b.BATCH_ID !== batchToEdit.BATCH_ID) : batchesExistentes;
    const batchInfo = obtenerInfoLoteEnBatches(loteId, progsOficiales, otherBatches);
    if (batchInfo.estaProgramado) {
      setErrorMessage(
        `🚫 Lote ya programado: El lote ${loteId} ya se encuentra asignado al Batch ${batchInfo.batchCodigo} (${batchInfo.caso}). Los lotes no se pueden repetir.`
      );
      return;
    }

    // 1. REGLA ESTRICTA DE PLANTA: SOLO LOTES APROBADOS (APTOS) Y OBSERVADOS
    const loteObj = lotes.find((l) => l.LOTE_ID === loteId);
    const ahObj = analisisHumedos.find((a) => a.LOTE_ID === loteId);
    const aptitud = verificarAptitudProgramacionLote(loteObj, ahObj);
    if (!aptitud.esProgramable) {
      setErrorMessage(
        `🚫 Lote No Programable: Solo se pueden programar lotes APROBADOS (Aptos) u OBSERVADOS. El lote ${loteId} está catalogado como ${aptitud.label}. ${aptitud.motivoBloqueo || "No cumple las condiciones mínimas de calidad."}`
      );
      return;
    }

    // Regla estricta: Todos los lotes del batch deben pertenecer a un solo cliente
    if (selectedLotes.length > 0) {
      const firstLoteObj = lotes.find((l) => l.LOTE_ID === selectedLotes[0].loteId);
      const clienteNuevo = (loteObj?.CLIENTE || "").trim();
      const clienteActual = (firstLoteObj?.CLIENTE || "").trim();
      if (clienteNuevo && clienteActual && clienteNuevo.toLowerCase() !== clienteActual.toLowerCase()) {
        setErrorMessage(
          `Incompatibilidad de cliente: No se puede unir el lote ${loteId} (Cliente: "${clienteNuevo}") porque el batch ya contiene lotes del cliente "${clienteActual}". Todos los lotes deben pertenecer al mismo cliente.`
        );
        return;
      }

      // Regla estricta: Misma variedad salvo que esté descrita como MEZCLA
      const varNueva = (loteObj?.VARIEDAD || "").trim();
      const varActual = (firstLoteObj?.VARIEDAD || "").trim();
      const esMezclaNueva = varNueva.toLowerCase().includes("mezcla") || varNueva.toLowerCase().includes("mix");
      const esMezclaActual = varActual.toLowerCase().includes("mezcla") || varActual.toLowerCase().includes("mix");

      if (varNueva && varActual && varNueva.toLowerCase() !== varActual.toLowerCase() && !esMezclaNueva && !esMezclaActual) {
        setErrorMessage(
          `Incompatibilidad de variedad: No se puede unir el lote ${loteId} (Variedad: "${varNueva}") con la variedad "${varActual}". Solo se permite unir variedades distintas si la variedad está descrita como MEZCLA.`
        );
        return;
      }
    }

    // Regla estricta: Reserva Exclusiva de Saldos de Unión
    // "Los saldos de cada código solo debe unirse con los que se seleccionó que van a juntarse"
    const sInfo = saldosMap.get(loteId);
    if (sInfo?.esSaldoReservadoUnion && sInfo.lotesPermitidosUnion && sInfo.lotesPermitidosUnion.length > 0) {
      if (selectedLotes.length > 0) {
        const lotesAjenos = selectedLotes
          .map(sl => sl.loteId)
          .filter(lid => !sInfo.lotesPermitidosUnion!.includes(lid));
        if (lotesAjenos.length > 0) {
          setErrorMessage(
            `RESTRICCIÓN DE SALDO EXCLUSIVO: El saldo del código ${loteId} está reservado para el proceso ${sInfo.grupoUnionProceso || "de unión"} con los códigos [${sInfo.lotesPermitidosUnion.join(", ")}]. No se puede mezclar con códigos externos (${lotesAjenos.join(", ")}).`
          );
          return;
        }
      }
    }

    for (const sl of selectedLotes) {
      const slInfo = saldosMap.get(sl.loteId);
      if (slInfo?.esSaldoReservadoUnion && slInfo.lotesPermitidosUnion && !slInfo.lotesPermitidosUnion.includes(loteId)) {
        setErrorMessage(
          `RESTRICCIÓN DE SALDO EXCLUSIVO: El lote ${sl.loteId} tiene saldo reservado para unirse exclusivamente con [${slInfo.lotesPermitidosUnion.join(", ")}]. No se permite agregar el lote ajeno ${loteId}.`
        );
        return;
      }
    }

    setErrorMessage(null);

    // Como referencia inicial tomar la cantidad de sacos ingresados
    const sacosIngresados = Number(loteObj?.SACOS) || (s?.sacosPendientes ?? 0) || (s.saldoPendienteKg > 0 ? Math.round(s.saldoPendienteKg / 50) : 0);
    const pesoIngresado = Number(loteObj?.PESO_KG) || (sacosIngresados * 50) || s.saldoPendienteKg;

    setSelectedLotes((prev) => [
      ...prev,
      {
        loteId,
        pesoKg: pesoIngresado,
        sacos: sacosIngresados,
        parte: 1,
        totalPartes: 1
      }
    ]);
  };

  const handleRemoveLote = (loteId: string) => {
    setSelectedLotes((prev) => prev.filter((sl) => sl.loteId !== loteId));
  };

  const handleUpdateLotePeso = (loteId: string, pesoKg: number) => {
    const s = saldosMap.get(loteId);
    const maxAllowedKg = s?.saldoPendienteKg ?? 999999;
    const maxAllowedSacos = s?.sacosPendientes ?? (maxAllowedKg > 0 ? Math.round(maxAllowedKg / 50) : 999999);

    const safePeso = Math.min(Math.max(0, Number(pesoKg) || 0), maxAllowedKg);
    const sacos = Math.min(Math.round(safePeso / 50), maxAllowedSacos);

    if (pesoKg > maxAllowedKg) {
      setErrorMessage(`⚠️ El peso ingresado excede el saldo pendiente de ${maxAllowedKg.toLocaleString()} kg (${maxAllowedSacos} sacos) del lote ${loteId}. Se ajustó al máximo disponible.`);
    }

    setSelectedLotes((prev) =>
      prev.map((sl) => (sl.loteId === loteId ? { ...sl, pesoKg: safePeso, sacos } : sl))
    );
  };

  const handleSetMaxSaldo = (loteId: string) => {
    const s = saldosMap.get(loteId);
    if (!s) return;
    handleUpdateLotePeso(loteId, s.saldoPendienteKg);
  };

  const handleDividirLote = (loteId: string) => {
    const s = saldosMap.get(loteId);
    if (!s) return;
    const parte1Kg = Math.min(s.saldoPendienteKg, parametros.capacidadMaximaSecadoraKg);
    setSelectedLotes((prev) =>
      prev.map((sl) =>
        sl.loteId === loteId
          ? {
              ...sl,
              pesoKg: parte1Kg,
              sacos: Math.round(parte1Kg / 50),
              parte: 1,
              totalPartes: Math.ceil(s.saldoPendienteKg / parametros.capacidadMaximaSecadoraKg)
            }
          : sl
      )
    );
  };

  // AI smart combination suggestion
  const handleSugerirCombinacionIA = () => {
    // Find best candidate lots that are strictly compatible and maximize capacity
    if (lotesDisponibles.length === 0) return;

    // Group by Client + Variety
    const groups: { [key: string]: SaldoLoteInfo[] } = {};
    lotesDisponibles.forEach((l) => {
      const s = saldosMap.get(l.LOTE_ID);
      if (!s) return;
      const key = `${s.cliente.trim().toLowerCase()}__${s.variedad.trim().toLowerCase()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    // Find first group with valid defect & breakage tolerances
    for (const key in groups) {
      const candidates = groups[key];
      // Sort by higher moisture / priority
      candidates.sort((a, b) => b.humedad - a.humedad);

      const compatibleIds: string[] = [];
      let accumulatedKg = 0;

      for (const cand of candidates) {
        const testIds = [...compatibleIds, cand.loteId];
        const testComp = validarCompatibilidadLotes(testIds, lotes, analisisHumedos, parametros, saldosMap);
        if (testComp.esCompatible) {
          compatibleIds.push(cand.loteId);
          accumulatedKg += cand.saldoPendienteKg;
          if (accumulatedKg >= parametros.capacidadMaximaSecadoraKg) break;
        }
      }

      if (compatibleIds.length > 0) {
        const newSelection: typeof selectedLotes = [];
        let remCap = parametros.capacidadMaximaSecadoraKg;

        compatibleIds.forEach((id) => {
          const s = saldosMap.get(id)!;
          const assigned = Math.min(s.saldoPendienteKg, remCap);
          if (assigned > 0) {
            newSelection.push({
              loteId: id,
              pesoKg: assigned,
              sacos: Math.round(assigned / 50),
              parte: s.saldoPendienteKg > parametros.capacidadMaximaSecadoraKg ? 1 : 1,
              totalPartes: s.saldoPendienteKg > parametros.capacidadMaximaSecadoraKg ? 2 : 1
            });
            remCap -= assigned;
          }
        });

        setSelectedLotes(newSelection);
        setErrorMessage(null);
        return;
      }
    }
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setErrorMessage(null);

    if (selectedLotes.length === 0) {
      setErrorMessage("Debe seleccionar al menos un lote para conformar el Batch.");
      return;
    }

    if (!compatibilidad.esCompatible) {
      setErrorMessage(`No se puede guardar el Batch: ${compatibilidad.motivosIncompatibilidad.join(" ")}`);
      return;
    }

    if (saldoErrors.length > 0) {
      setErrorMessage(saldoErrors[0].msg);
      return;
    }

    if (capacidadBalance.estadoCapacidad === "EXCESO_NO_PERMITIDO") {
      setErrorMessage(capacidadBalance.alertaMensaje);
      return;
    }

    setIsSubmitting(true);
    try {
      const batchData: Partial<BatchVaporizado> = {
        CORRELATIVO: correlativo.toUpperCase(),
        FECHA_PROGRAMADA: fechaProgramada,
        FECHA_INICIO: fechaProgramada,
        TURNO: turno,
        EQUIPO: equipo,
        OPERADOR: operador,
        CAPACIDAD_PROGRAMADA_TN: Number((parametros.capacidadMaximaSecadoraKg / 1000).toFixed(1)),
        TON_PROGRAMADAS: Number((pesoTotalKg / 1000).toFixed(2)),
        PESO_TOTAL_KG: pesoTotalKg,
        CAPACIDAD_MAX_KG: parametros.capacidadMaximaSecadoraKg,
        CAPACIDAD_UTILIZADA_PCT: capacidadBalance.porcentajeUtilizado,
        CAPACIDAD_DISPONIBLE_KG: capacidadBalance.capacidadDisponibleKg,
        ES_EXCEPCIONAL_PAMPA: capacidadBalance.esExcepcionalPampa,
        ESTADO_COMPATIBILIDAD: "COMPATIBLE",
        ESTADO_BATCH: "PROGRAMADO",
        OBSERVACIONES: observaciones
      };

      const lotesPayload = selectedLotes.map((sl) => {
        const s = saldosMap.get(sl.loteId);
        return {
          LOTE_ID: sl.loteId,
          PESO_KG: sl.pesoKg,
          SACOS: sl.sacos,
          PARTE: sl.parte,
          TOTAL_PARTES: sl.totalPartes,
          CLIENTE: s?.cliente,
          VARIEDAD: s?.variedad,
          DEFECTOS_PCT: s?.defectosPct,
          QUEBRADO_PCT: s?.quebradoPct,
          OBSERVACIONES: `Parte ${sl.parte} asignada a ${correlativo}`
        };
      });

      await onSaveBatch(batchData, lotesPayload);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Error al guardar el Batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div 
        id="modal-nuevo-batch"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 font-mono font-bold text-lg">
              {correlativo || "V200"}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Conformación de Batch de Vaporizado
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 font-mono">
                  {correlativo}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Trazabilidad estricta: BATCH → LOTES → CANTIDAD UTILIZADA | Control de saldos y compatibilidad previa
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Batch Identification and Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Correlativo Único
              </label>
              <input
                type="text"
                id="input-batch-correlativo"
                value={correlativo}
                onChange={(e) => setCorrelativo(e.target.value.toUpperCase())}
                placeholder="Ej: V200"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Fecha Programada
              </label>
              <input
                type="date"
                id="input-batch-fecha"
                value={fechaProgramada}
                onChange={(e) => setFechaProgramada(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Turno de Trabajo
              </label>
              <select
                id="select-batch-turno"
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-semibold"
              >
                {(parametros.turnosDisponibles || ["Turno Día", "Turno Noche"]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Equipo</span>
                <span className="text-[10px] text-amber-400 font-semibold">35 TN Capacidad</span>
              </label>
              <select
                id="select-batch-equipo"
                value={equipo}
                onChange={(e) => setEquipo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-semibold cursor-pointer"
              >
                <option value="APIT">APIT</option>
              </select>
            </div>
          </div>

          {/* Section 2: Real-Time Dryer Capacity Gauge */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Balance de Capacidad de Secadora
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-400">
                  Total Batch: <strong className="text-white text-sm">{pesoTotalKg.toLocaleString()} kg</strong> ({capacidadBalance.pesoTotalTn} TN)
                </span>
                <span className="text-slate-400">
                  Sacos: <strong className="text-white">{totalSacos}</strong>
                </span>
                <span className="text-slate-400">
                  Máx Normal: <strong className="text-slate-300">{parametros.capacidadMaximaSecadoraKg.toLocaleString()} kg</strong>
                </span>
              </div>
            </div>

            {/* Visual Gauge Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
                {/* Min limit marker (22 TN) */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
                  style={{ left: `${(parametros.capacidadMinimaProcesoKg / parametros.capacidadExcepcionalMaximaKg) * 100}%` }}
                  title="Capacidad Mínima (22 TN)"
                />
                {/* Max normal marker (35 TN) */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                  style={{ left: `${(parametros.capacidadMaximaSecadoraKg / parametros.capacidadExcepcionalMaximaKg) * 100}%` }}
                  title="Capacidad Máxima Normal (35 TN)"
                />

                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    capacidadBalance.estadoCapacidad === "OPTIMO"
                      ? "bg-emerald-500"
                      : capacidadBalance.estadoCapacidad === "SOBRECARGA_EXCEPCIONAL_PAMPA"
                      ? "bg-amber-500"
                      : capacidadBalance.estadoCapacidad === "EXCESO_NO_PERMITIDO"
                      ? "bg-rose-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(100, (pesoTotalKg / parametros.capacidadExcepcionalMaximaKg) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>0 kg</span>
                <span>Mín: {(parametros.capacidadMinimaProcesoKg/1000).toFixed(0)} TN</span>
                <span>Máx Normal: {(parametros.capacidadMaximaSecadoraKg/1000).toFixed(0)} TN</span>
                <span>Excepcional: {(parametros.capacidadExcepcionalMaximaKg/1000).toFixed(0)} TN</span>
              </div>
            </div>

            {/* Capacity Status Alert */}
            <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              capacidadBalance.estadoCapacidad === "OPTIMO"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                : capacidadBalance.estadoCapacidad === "SOBRECARGA_EXCEPCIONAL_PAMPA"
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/40"
                : capacidadBalance.estadoCapacidad === "EXCESO_NO_PERMITIDO"
                ? "bg-rose-500/10 text-rose-300 border border-rose-500/40"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}>
              {capacidadBalance.estadoCapacidad === "OPTIMO" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {capacidadBalance.estadoCapacidad === "SOBRECARGA_EXCEPCIONAL_PAMPA" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              {capacidadBalance.estadoCapacidad === "EXCESO_NO_PERMITIDO" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {capacidadBalance.estadoCapacidad === "SUBUTILIZADO" && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
              {capacidadBalance.estadoCapacidad === "VACIO" && <Info className="w-4 h-4 text-slate-400 shrink-0" />}
              <span>{capacidadBalance.alertaMensaje}</span>
            </div>
          </div>

          {/* Section 3: Live Compatibility Validator Badge */}
          {selectedLotes.length > 1 && (
            <div className={`p-3.5 rounded-xl border ${
              compatibilidad.esCompatible
                ? "bg-emerald-950/30 border-emerald-600/40 text-emerald-200"
                : "bg-rose-950/40 border-rose-600/60 text-rose-200"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {compatibilidad.esCompatible ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {compatibilidad.esCompatible ? "Compatibilidad Validada: Lotes Aptos para Mezcla" : "Incompatibilidad Detectada: No se permite la mezcla"}
                  </h4>
                </div>
                <div className="text-[11px] font-mono font-semibold">
                  Dif Defectos: {compatibilidad.diferenciaDefectos} pp (Máx: {parametros.toleranciaDefectosPp} pp) | Dif Quebrado: {compatibilidad.diferenciaQuebrado} pp (Máx: {parametros.toleranciaQuebradoPp} pp)
                </div>
              </div>

              {!compatibilidad.esCompatible && (
                <div className="space-y-1 mt-2 text-xs bg-rose-900/30 p-2.5 rounded-lg border border-rose-700/50">
                  <p className="font-bold text-rose-300">Motivos de rechazo de mezcla:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-200 text-[11px]">
                    {compatibilidad.motivosIncompatibilidad.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Section 4: Lotes Asignados al Batch (Trazabilidad y Saldos) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Lotes Asignados al Batch ({selectedLotes.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={handleSugerirCombinacionIA}
                className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Sugerir Combinación Compatible (IA)
              </button>
            </div>

            {/* Banner de Receta Recomendada de la Sábana de Batches Trabajados */}
            {recetaHistoricaRecomendada && (
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded-md font-black text-[10px]">
                      RECETA HISTÓRICA RECOMENDADA
                    </span>
                    <span className="text-xs font-bold text-amber-300">
                      Lote Más Exitoso: Batch {recetaHistoricaRecomendada.batchReferencia.batch} ({recetaHistoricaRecomendada.batchReferencia.variedad})
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                    Coincidencia: {recetaHistoricaRecomendada.puntajeCoincidencia}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PRESIÓN DE VAPOR:</span>
                    <strong className="text-blue-400 text-sm">{recetaHistoricaRecomendada.presionPase1Bar} bar</strong>
                    {recetaHistoricaRecomendada.presionPase2Bar !== undefined && (
                      <span className="text-slate-400 text-[10px] ml-1">/ 2do: {recetaHistoricaRecomendada.presionPase2Bar} bar</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">VELOCIDAD EXCLUSA:</span>
                    <strong className="text-purple-400 text-sm">{recetaHistoricaRecomendada.rpmExclusaPase1} RPM</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">TIEMPO REPOSO:</span>
                    <strong className="text-emerald-400 text-sm">{recetaHistoricaRecomendada.tiempoReposoPase1Min} min</strong>
                    {recetaHistoricaRecomendada.tiempoReposoPase2Min !== undefined && (
                      <span className="text-slate-400 text-[10px] ml-1">/ 2do: {recetaHistoricaRecomendada.tiempoReposoPase2Min}m</span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-300">
                  💡 <strong className="text-amber-400">Guía de Parámetros:</strong> {recetaHistoricaRecomendada.analisisPresion} {recetaHistoricaRecomendada.analisisVelocidadExclusa}
                </p>
              </div>
            )}

            {selectedLotes.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-xl text-slate-400 text-xs">
                No hay lotes agregados al Batch aún. Seleccione lotes disponibles de la tabla inferior.
              </div>
            ) : (
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/60 divide-y divide-slate-800">
                {selectedLotes.map((sl, index) => {
                  const s = saldosMap.get(sl.loteId);
                  const isOverSaldo = s && sl.pesoKg > s.saldoPendienteKg + 0.1;
                  const isDivided = s && s.pesoOriginalKg > parametros.capacidadMaximaSecadoraKg;

                  return (
                    <div key={sl.loteId} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-white font-mono">{sl.loteId}</strong>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                              {s?.cliente || "Cliente"}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-medium">
                              {s?.variedad || "Variedad"}
                            </span>
                            {isDivided && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                                Parte {sl.parte}/{sl.totalPartes}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>Defectos: <strong>{s?.defectosPct}%</strong></span>
                            <span>Quebrado: <strong>{s?.quebradoPct}%</strong></span>
                            <span>Saldo Total Disponible: <strong className="text-emerald-400 font-mono">{s?.saldoPendienteKg.toLocaleString()} kg</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Weight Control & Quick Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700">
                          <label className="text-[11px] text-slate-400 font-medium">Kg a Procesar:</label>
                          <input
                            type="number"
                            min={100}
                            step={100}
                            max={s?.saldoPendienteKg || 50000}
                            value={sl.pesoKg}
                            onChange={(e) => handleUpdateLotePeso(sl.loteId, parseFloat(e.target.value) || 0)}
                            className={`w-28 bg-slate-900 border rounded px-2 py-1 text-xs font-mono font-bold focus:outline-none ${
                              isOverSaldo 
                                ? "border-rose-500 text-rose-400" 
                                : "border-slate-700 text-white focus:border-amber-500"
                            }`}
                          />
                          <span className="text-[11px] text-slate-400">({sl.sacos} sacos)</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSetMaxSaldo(sl.loteId)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded border border-slate-700"
                          title="Asignar el 100% del saldo pendiente"
                        >
                          100% Saldo
                        </button>

                        {isDivided && (
                          <button
                            type="button"
                            onClick={() => handleDividirLote(sl.loteId)}
                            className="px-2 py-1 bg-blue-900/40 hover:bg-blue-800 text-blue-300 text-[11px] font-semibold rounded border border-blue-700 flex items-center gap-1"
                            title="Dividir lote: Parte 1 (35 TN) en este Batch y saldo en el siguiente"
                          >
                            <Scissors className="w-3 h-3" />
                            Corte 35 TN
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveLote(sl.loteId)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {isOverSaldo && (
                        <div className="w-full text-[11px] text-rose-400 font-semibold mt-1">
                          ⚠️ Cantidad no válida. El saldo pendiente del lote es {s?.saldoPendienteKg.toLocaleString()} kg.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 5: Selector de Lotes Disponibles (Lotes Pendientes y Parcialmente Procesados) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Lotes Pendientes Disponibles con Saldo ({lotesDisponibles.length})</span>
                </h3>
                <span className="text-[11px] text-amber-400 font-medium">
                  ⚡ Lista ordenada por Prioridad Oficial de Proceso (Emergencia &gt; Alto &gt; Medio &gt; Bajo)
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Haga clic en "+ Agregar" para incorporar al Batch
              </span>
            </div>

            <div className="border border-slate-700 rounded-xl overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/90 text-slate-400 font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                    <tr>
                      <th className="px-2.5 py-2.5">Prioridad</th>
                      <th className="px-2.5 py-2.5">Lote ID</th>
                      <th className="px-2.5 py-2.5">Cliente</th>
                      <th className="px-2.5 py-2.5">Variedad</th>
                      <th className="px-2.5 py-2.5">Ubicación</th>
                      <th className="px-2.5 py-2.5 text-center">Hum %</th>
                      <th className="px-2.5 py-2.5 text-center">% Entero</th>
                      <th className="px-2.5 py-2.5 text-center">% Tiza</th>
                      <th className="px-2.5 py-2.5">Aptitud</th>
                      <th className="px-2.5 py-2.5">Saldo Disp.</th>
                      <th className="px-2.5 py-2.5">Estado</th>
                      <th className="px-2.5 py-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {lotesDisponibles.map((lote, index) => {
                      const s = saldosMap.get(lote.LOTE_ID);
                      const ahObj = analisisHumedos.find(a => a.LOTE_ID === lote.LOTE_ID);
                      const aptitud = verificarAptitudProgramacionLote(lote, ahObj);
                      const progsOficiales = cargarProgramacionesOficiales();
                      const otherBatches = batchToEdit ? batchesExistentes.filter(b => b.BATCH_ID !== batchToEdit.BATCH_ID) : batchesExistentes;
                      const batchInfo = obtenerInfoLoteEnBatches(lote.LOTE_ID, progsOficiales, otherBatches);
                      const isAssignedElsewhere = batchInfo.estaProgramado;

                      const isAlreadySelected = selectedLotes.some((sl) => sl.loteId === lote.LOTE_ID);
                      const isPartiallyProcessed = s?.estadoSaldo === "PARCIALMENTE PROCESADO";
                      const canAdd = aptitud.esProgramable && !isAlreadySelected && !isAssignedElsewhere;

                      const pInfo = prioridadMap.get(lote.LOTE_ID.trim().toLowerCase());
                      const posPrio = pInfo?.posicion ?? (index + 1);
                      const esEmerg = pInfo?.esEmergencia || pInfo?.nivelRiesgo === "EMERGENCIA";

                      const rtoEntero = ahObj?.ENTERO !== undefined ? `${ahObj.ENTERO}%` : "-";
                      const tizaTotal = ahObj?.TT !== undefined ? `${ahObj.TT}%` : "-";

                      return (
                        <tr key={lote.LOTE_ID} className={`hover:bg-slate-800/50 ${isAlreadySelected || isAssignedElsewhere ? "bg-slate-800/30 opacity-60" : !aptitud.esProgramable ? "bg-rose-950/20" : esEmerg ? "bg-rose-950/15" : ""}`}>
                          <td className="px-2.5 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black inline-flex items-center gap-1 ${
                              esEmerg
                                ? "bg-rose-600 text-white animate-pulse"
                                : pInfo?.nivelRiesgo === "ALTO"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : pInfo?.nivelRiesgo === "MEDIO"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            }`}>
                              {esEmerg && <span>🚨</span>}
                              <span>#{posPrio}</span>
                            </span>
                          </td>
                          <td className="px-2.5 py-2 font-bold text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{lote.LOTE_ID}</span>
                              {isAssignedElsewhere && (
                                <span className="text-[10px] text-amber-400 font-bold" title={`Asignado al Batch ${batchInfo.batchCodigo}`}>🔒</span>
                              )}
                              {!aptitud.esProgramable && (
                                <span className="text-[10px] text-rose-400 font-bold" title={aptitud.motivoBloqueo}>🚫</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2.5 py-2 font-sans font-medium text-slate-300 max-w-[140px] truncate" title={s?.cliente}>{s?.cliente}</td>
                          <td className="px-2.5 py-2 font-sans text-amber-300">{s?.variedad}</td>
                          <td className="px-2.5 py-2 font-sans text-slate-400">{lote.UBICACION || "-"}</td>
                          <td className="px-2.5 py-2 text-center font-bold text-cyan-300">{lote.HUM}%</td>
                          <td className="px-2.5 py-2 text-center font-medium text-emerald-300">{rtoEntero}</td>
                          <td className="px-2.5 py-2 text-center font-medium text-amber-200">{tizaTotal}</td>
                          <td className="px-2.5 py-2 font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${aptitud.badgeClass}`} title={aptitud.motivoBloqueo || aptitud.detalles}>
                              {aptitud.estadoMacro === "APROBADO" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                              {aptitud.estadoMacro === "OBSERVADO" && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                              {aptitud.estadoMacro === "NO_APTO" && <AlertCircle className="w-3 h-3 text-rose-400" />}
                              <span>{aptitud.label}</span>
                            </span>
                          </td>
                          <td className="px-2.5 py-2 font-bold text-emerald-400">
                            {s?.saldoPendienteKg.toLocaleString()} kg
                            <span className="text-[10px] text-slate-500 ml-1">({s?.sacosPendientes}s)</span>
                          </td>
                          <td className="px-2.5 py-2 font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isPartiallyProcessed 
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}>
                              {s?.estadoSaldo}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={!canAdd}
                              onClick={() => handleAddLote(lote.LOTE_ID)}
                              className={`px-2.5 py-1 font-bold rounded text-[11px] transition-colors inline-flex items-center gap-1 font-sans ${
                                isAssignedElsewhere
                                  ? "bg-slate-900 text-amber-400 border border-amber-900/60 cursor-not-allowed opacity-75"
                                  : !aptitud.esProgramable
                                  ? "bg-rose-950/60 text-rose-400 border border-rose-800 cursor-not-allowed opacity-60"
                                  : isAlreadySelected
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow"
                              }`}
                              title={
                                isAssignedElsewhere
                                  ? `Bloqueado: El lote ya está en el Batch ${batchInfo.batchCodigo}. Los lotes no se pueden repetir.`
                                  : !aptitud.esProgramable
                                  ? `Bloqueado: ${aptitud.motivoBloqueo}`
                                  : "Agregar al Batch"
                              }
                            >
                              {isAssignedElsewhere ? `🔒 En ${batchInfo.batchCodigo}` : isAlreadySelected ? "Asignado" : !aptitud.esProgramable ? "🚫 No Apto" : <><Plus className="w-3 h-3" /> Agregar</>}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 6: Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones Operativas del Batch:
            </label>
            <input
              type="text"
              id="input-batch-obs"
              placeholder="Ej: Vaporizado a 1.85 bar, primera parte de lote C1500..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span>Operador Responsable: <strong className="text-white">{operador}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-guardar-batch"
              disabled={isSubmitting || selectedLotes.length === 0 || !compatibilidad.esCompatible || saldoErrors.length > 0 || capacidadBalance.estadoCapacidad === "EXCESO_NO_PERMITIDO"}
              onClick={() => handleSave()}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? "Creando Batch..." : `Confirmar y Crear Batch ${correlativo}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
