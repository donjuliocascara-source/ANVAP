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
  ShieldCheck,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  GitMerge,
  Filter,
  Check
} from "lucide-react";
import { 
  Lote, 
  BatchVaporizado, 
  AnalisisHumedo, 
  Presecado,
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
  obtenerInfoLoteEnBatches,
  extraerDatosCalidadLote,
  LoteProgramacionFila
} from "../utils/programacionBatchOficialService";
import { recomendarRecetaPorPerfilIngreso } from "../utils/sabanaBatchesService";
import {
  CriteriosUnionLotesConfig,
  CRITERIOS_UNION_DEFAULT,
  obtenerCriteriosUnionGuardados,
  guardarCriteriosUnion,
  evaluarCompatibilidadBatch,
  buscarLotesSemejantesMismoCliente,
  evaluarCandidatoParaBatch,
  recomendarUnionesGruposLotes,
  RecomendacionUnionGrupal,
  EvaluacionUnionBatchResult,
  DesviacionParametroBatch
} from "../utils/criteriosUnionLotes";
import { ConfigCriteriosUnionLotesModal } from "./ConfigCriteriosUnionLotesModal";

interface NuevoBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotes: Lote[];
  analisisHumedos: AnalisisHumedo[];
  presecados?: Presecado[];
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
  presecados = [],
  batchesExistentes,
  parametros = PARAMETROS_TRABAJO_DEFAULT,
  onSaveBatch,
  initialLoteId,
  batchToEdit
}) => {
  // Criterios de Unión de Lotes (tolerancias oficiales de planta)
  const [criteriosConfig, setCriteriosConfig] = useState<CriteriosUnionLotesConfig>(() => obtenerCriteriosUnionGuardados());
  const [isConfigCriteriosModalOpen, setIsConfigCriteriosModalOpen] = useState(false);
  const [mostrarDetalleCriterios, setMostrarDetalleCriterios] = useState(false);
  const [filtroSoloCompatibles, setFiltroSoloCompatibles] = useState(false);

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
      // Refresh criterios from localStorage if modal opens
      setCriteriosConfig(obtenerCriteriosUnionGuardados());

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
      // 0. REGLA ESTRICTA DE PLANTA: Si el lote tiene saldo pendiente (> 50 kg), está disponible para programar
      const s = saldosMap.get(l.LOTE_ID);
      const saldoKg = s ? s.saldoPendienteKg : (Number(l.PESO_KG) || 0);
      if (saldoKg <= 50) return false;

      const infoBatch = obtenerInfoLoteEnBatches(l.LOTE_ID, progsOficiales, otherBatches, null, null, null, null, lotes);
      if (infoBatch.estaProgramado && !infoBatch.esMismoBatch && (!s || s.saldoPendienteKg <= 50)) {
        return false;
      }
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

  // Real-time Compatibility Check (BatchEngine basic)
  const compatibilidad = useMemo(() => {
    const selectedIds = selectedLotes.map((sl) => sl.loteId);
    return validarCompatibilidadLotes(selectedIds, lotes, analisisHumedos, parametros, saldosMap);
  }, [selectedLotes, lotes, analisisHumedos, parametros, saldosMap]);

  // EVALUACIÓN OFICIAL SEGÚN LOS CRITERIOS PARA UNIR LOTES DE PLANTA (11 Parámetros y Tolerancias)
  const evaluacionCriteriosBatch = useMemo<EvaluacionUnionBatchResult | null>(() => {
    if (selectedLotes.length === 0) return null;
    const filas: LoteProgramacionFila[] = selectedLotes.map((sl) => {
      const lObj = lotes.find((l) => l.LOTE_ID === sl.loteId);
      const ahObj = analisisHumedos.find((a) => a.LOTE_ID === sl.loteId);
      const psObj = presecados.find((p) => p.LOTE_ID === sl.loteId);
      const qData = extraerDatosCalidadLote(lObj || ({} as any), ahObj, psObj);
      return {
        loteId: sl.loteId,
        cliente: (lObj?.CLIENTE || "").trim(),
        variedad: (lObj?.VARIEDAD || "TINAJONES").trim(),
        sacos: sl.sacos,
        peso: sl.pesoKg,
        sacProg: sl.sacos,
        pesoProg: sl.pesoKg,
        ph: Number(qData.ph ?? 14.0),
        desv: Number(qData.desv ?? 1.2),
        blInt: Number(qData.blInt ?? 21.5),
        blBlanco: Number(qData.blBlanco ?? 39.0),
        qi: Number(qData.qi ?? 7.5),
        qb: Number(qData.qb ?? 15.5),
        tt: Number(qData.tt ?? 1.5),
        tp: Number(qData.tp ?? 2.5),
        tpun: Number(qData.tpun ?? 4.5),
        m: Number(qData.m ?? 0.8),
        triz: Number(qData.triz ?? 1.8),
        condicion: qData.condicion || "APTO"
      };
    });
    return evaluarCompatibilidadBatch(filas, criteriosConfig);
  }, [selectedLotes, lotes, analisisHumedos, presecados, criteriosConfig]);

  // MOTOR DE RECOMENDACIÓN INTELIGENTE DE UNIÓN DE LOTES:
  // Caso 1: BATCH VACÍO -> Recomienda combinaciones completas de lotes del mismo cliente
  const recomendacionesGrupales = useMemo(() => {
    if (selectedLotes.length > 0) return [];
    return recomendarUnionesGruposLotes(
      lotesDisponibles,
      analisisHumedos,
      presecados,
      saldosMap,
      parametros.capacidadMaximaSecadoraKg,
      criteriosConfig
    );
  }, [selectedLotes.length, lotesDisponibles, analisisHumedos, presecados, saldosMap, parametros, criteriosConfig]);

  // Caso 2: BATCH CON 1 O MÁS LOTES -> Recomienda lotes compatibles del mismo cliente para unirse al batch actual
  const lotesRecomendadosParaUnir = useMemo(() => {
    if (selectedLotes.length === 0) return [];
    const primerLoteId = selectedLotes[0].loteId;
    const primerLote = lotes.find((l) => l.LOTE_ID === primerLoteId);
    if (!primerLote) return [];

    const ah = analisisHumedos.find((a) => a.LOTE_ID === primerLoteId);
    const ps = presecados.find((p) => p.LOTE_ID === primerLoteId);
    const qData = extraerDatosCalidadLote(primerLote, ah, ps);

    const filaRef: LoteProgramacionFila = {
      loteId: primerLoteId,
      cliente: (primerLote.CLIENTE || "").trim(),
      variedad: (primerLote.VARIEDAD || "TINAJONES").trim(),
      sacos: selectedLotes[0].sacos,
      peso: selectedLotes[0].pesoKg,
      sacProg: selectedLotes[0].sacos,
      pesoProg: selectedLotes[0].pesoKg,
      ph: Number(qData.ph || 14.0),
      desv: Number(qData.desv || 1.2),
      blInt: Number(qData.blInt || 21.5),
      blBlanco: Number(qData.blBlanco || 39.0),
      qi: Number(qData.qi || 7.5),
      qb: Number(qData.qb || 15.5),
      tt: Number(qData.tt || 1.5),
      tp: Number(qData.tp || 2.5),
      tpun: Number(qData.tpun || 4.5),
      m: Number(qData.m || 0.8),
      triz: Number(qData.triz || 1.8),
      condicion: qData.condicion || "APTO"
    };

    const yaEnBatch = selectedLotes.map((sl) => sl.loteId);

    // Buscar todos los semejantes del mismo cliente aplicando las tolerancias de criterios de unión
    return buscarLotesSemejantesMismoCliente(
      filaRef,
      lotesDisponibles,
      analisisHumedos,
      presecados,
      yaEnBatch,
      criteriosConfig
    );
  }, [selectedLotes, lotes, analisisHumedos, presecados, lotesDisponibles, criteriosConfig]);

  // Set con IDs de lotes compatibles para unión rápida en la tabla
  const idsCompatiblesUnion = useMemo(() => {
    if (selectedLotes.length === 0) {
      return new Set<string>();
    }
    const set = new Set<string>();
    lotesRecomendadosParaUnir.forEach((item) => {
      if (item.esCompatible) {
        set.add(item.lote.LOTE_ID);
      }
    });
    return set;
  }, [selectedLotes.length, lotesRecomendadosParaUnir]);

  // Filtrado de lotes en la tabla inferior
  const lotesDisponiblesMostrados = useMemo(() => {
    if (!filtroSoloCompatibles || selectedLotes.length === 0) {
      return lotesDisponibles;
    }
    const primerLote = lotes.find((l) => l.LOTE_ID === selectedLotes[0].loteId);
    const cliRef = (primerLote?.CLIENTE || "").trim().toLowerCase();
    return lotesDisponibles.filter((l) => {
      const cliLote = (l.CLIENTE || "").trim().toLowerCase();
      return cliLote === cliRef;
    });
  }, [lotesDisponibles, filtroSoloCompatibles, selectedLotes, lotes]);

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
    const primerLote = lotes.find((l) => l.LOTE_ID === selectedLotes[0].loteId);
    if (!primerLote) return null;

    const variedad = primerLote.VARIEDAD || "VALOR";
    const hum = primerLote.HUM || primerLote.HUMEDAD || 14.0;
    const ah = analisisHumedos.find((a) => a.LOTE_ID === primerLote.LOTE_ID);
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
    const otherBatches = batchToEdit ? batchesExistentes.filter((b) => b.BATCH_ID !== batchToEdit.BATCH_ID) : batchesExistentes;
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

    // Regla estricta de Criterios de Unión: Todos los lotes del batch deben pertenecer a un solo cliente
    if (selectedLotes.length > 0 && criteriosConfig.exigirMismoCliente) {
      const firstLoteObj = lotes.find((l) => l.LOTE_ID === selectedLotes[0].loteId);
      const clienteNuevo = (loteObj?.CLIENTE || "").trim();
      const clienteActual = (firstLoteObj?.CLIENTE || "").trim();
      if (clienteNuevo && clienteActual && clienteNuevo.toLowerCase() !== clienteActual.toLowerCase()) {
        setErrorMessage(
          `Criterio de Unión no cumplido (Cliente Único): No se puede unir el lote ${loteId} (Cliente: "${clienteNuevo}") con "${clienteActual}". Según los Criterios de Unión de Planta, todos los lotes deben pertenecer al mismo cliente.`
        );
        return;
      }

      // Regla estricta: Misma variedad salvo que esté descrita como MEZCLA
      if (criteriosConfig.exigirMismaVariedad) {
        const varNueva = (loteObj?.VARIEDAD || "").trim();
        const varActual = (firstLoteObj?.VARIEDAD || "").trim();
        const esMezclaNueva = varNueva.toLowerCase().includes("mezcla") || varNueva.toLowerCase().includes("mix");
        const esMezclaActual = varActual.toLowerCase().includes("mezcla") || varActual.toLowerCase().includes("mix");

        if (varNueva && varActual && varNueva.toLowerCase() !== varActual.toLowerCase() && !esMezclaNueva && !esMezclaActual) {
          setErrorMessage(
            `Criterio de Unión no cumplido (Variedad): No se puede unir el lote ${loteId} (Variedad: "${varNueva}") con "${varActual}". Solo se permite unir variedades distintas si la variedad está descrita como MEZCLA.`
          );
          return;
        }
      }
    }

    // Regla estricta: Reserva Exclusiva de Saldos de Unión
    const sInfo = saldosMap.get(loteId);
    if (sInfo?.esSaldoReservadoUnion && sInfo.lotesPermitidosUnion && sInfo.lotesPermitidosUnion.length > 0) {
      if (selectedLotes.length > 0) {
        const lotesAjenos = selectedLotes
          .map((sl) => sl.loteId)
          .filter((lid) => !sInfo.lotesPermitidosUnion!.includes(lid));
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

    // Si ya hay lotes en el batch, calcular la cantidad restante para no sobrecargar los 35 TN
    let pesoIngresado = Number(loteObj?.PESO_KG) || s.saldoPendienteKg;
    let sacosIngresados = Number(loteObj?.SACOS) || (s?.sacosPendientes ?? 0) || Math.round(pesoIngresado / 50);

    if (selectedLotes.length > 0) {
      const remCapKg = Math.max(0, parametros.capacidadMaximaSecadoraKg - pesoTotalKg);
      if (remCapKg > 0 && pesoIngresado > remCapKg) {
        pesoIngresado = Math.min(s.saldoPendienteKg, remCapKg);
        sacosIngresados = Math.round(pesoIngresado / 50);
      }
    }

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

  // Acción 1: Aplicar una recomendación grupal de unión (cuando el batch está en 0)
  const handleAplicarUnionGrupal = (rec: RecomendacionUnionGrupal) => {
    const newSelection = rec.lotes.map((l) => ({
      loteId: l.loteId,
      pesoKg: l.pesoPropuesto,
      sacos: l.sacosPropuestos,
      parte: 1,
      totalPartes: 1
    }));
    setSelectedLotes(newSelection);
    setErrorMessage(null);
  };

  // Acción 2: Unir un lote candidato recomendado al batch actual respetando la capacidad restante
  const handleUnirLoteCandidato = (candidatoLoteId: string) => {
    const s = saldosMap.get(candidatoLoteId);
    if (!s || s.saldoPendienteKg <= 0) return;

    const remCapKg = Math.max(100, parametros.capacidadMaximaSecadoraKg - pesoTotalKg);
    const pesoAsignar = Math.min(s.saldoPendienteKg, remCapKg);
    const sacosAsignar = Math.min(s.sacosPendientes, Math.round(pesoAsignar / 50));

    setSelectedLotes((prev) => [
      ...prev,
      {
        loteId: candidatoLoteId,
        pesoKg: pesoAsignar,
        sacos: sacosAsignar,
        parte: 1,
        totalPartes: 1
      }
    ]);
    setErrorMessage(null);
  };

  // Acción 3: Sugerencia inteligente de combinación por IA basada estrictamente en los Criterios de Unión
  const handleSugerirCombinacionIA = () => {
    // Si el batch está vacío, cargar la recomendación grupal #1
    if (selectedLotes.length === 0) {
      if (recomendacionesGrupales.length > 0) {
        handleAplicarUnionGrupal(recomendacionesGrupales[0]);
        return;
      }
    } else {
      // Si ya hay lotes en el batch, unir el candidato más semejante compatible
      const mejorCandidato = lotesRecomendadosParaUnir.find((c) => c.esCompatible);
      if (mejorCandidato) {
        handleUnirLoteCandidato(mejorCandidato.lote.LOTE_ID);
        return;
      }
    }

    // Fallback: agrupar por cliente y buscar combinación
    if (lotesDisponibles.length === 0) return;
    const groups: { [key: string]: SaldoLoteInfo[] } = {};
    lotesDisponibles.forEach((l) => {
      const s = saldosMap.get(l.LOTE_ID);
      if (!s) return;
      const key = `${s.cliente.trim().toLowerCase()}__${s.variedad.trim().toLowerCase()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    for (const key in groups) {
      const candidates = groups[key];
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
              parte: 1,
              totalPartes: 1
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

    if (evaluacionCriteriosBatch && !evaluacionCriteriosBatch.esCompatible) {
      setErrorMessage(`No se puede guardar el Batch según los Criterios para Unir Lotes: ${evaluacionCriteriosBatch.motivoBloqueo || "Existen desviaciones que superan la tolerancia permitida."}`);
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

  const clienteBatchActual = selectedLotes.length > 0 ? saldosMap.get(selectedLotes[0].loteId)?.cliente : undefined;
  const variedadBatchActual = selectedLotes.length > 0 ? saldosMap.get(selectedLotes[0].loteId)?.variedad : undefined;

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
              {correlativo || "BATCH"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Armar Nuevo Batch de Vaporizado
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 font-mono">
                    {correlativo}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Trazabilidad estricta: BATCH → LOTES → CANTIDAD UTILIZADA | Recomendación por Criterios de Unión
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfigCriteriosModalOpen(true)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ver o ajustar tolerancias de los Criterios para Unir Lotes"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Criterios de Unión</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
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
                placeholder="Correlativo"
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
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
                  style={{ left: `${(parametros.capacidadMinimaProcesoKg / parametros.capacidadExcepcionalMaximaKg) * 100}%` }}
                  title="Capacidad Mínima (22 TN)"
                />
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

          {/* SECTION 2.5: MOTOR DE RECOMENDACIÓN INTELIGENTE SEGÚN CRITERIOS PARA UNIR LOTES */}
          {selectedLotes.length === 0 ? (
            /* CASO A: BATCH VACÍO -> RECOMENDACIONES DE UNIÓN GRUPAL */
            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/30 border border-purple-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      Recomendación de Unión de Lotes (Criterios Oficiales de Planta)
                    </h3>
                    <p className="text-[11px] text-purple-200">
                      Combinaciones pre-calculadas que agrupan lotes de un <strong>mismo cliente</strong> con tolerancias de humedad, trizado y quebrado 100% conformes.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold shrink-0">
                  {recomendacionesGrupales.length} combinaciones detectadas
                </span>
              </div>

              {recomendacionesGrupales.length === 0 ? (
                <div className="p-3 bg-slate-950/60 rounded-lg text-xs text-slate-400 border border-slate-800">
                  ℹ️ No se detectaron clientes con 2 o más lotes pendientes que cumplan las tolerancias de unión simultáneamente. Agregue manualmente un lote inicial para evaluar compatibilidad directa.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {recomendacionesGrupales.slice(0, 4).map((rec, index) => (
                    <div 
                      key={rec.id}
                      className="bg-slate-950/80 border border-purple-500/30 hover:border-purple-400/60 rounded-xl p-3 flex flex-col justify-between transition-all space-y-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30 font-mono">
                            OPCIÓN #{index + 1} • {rec.scoreCompatibilidad}% COMPATIBLE
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {(rec.pesoTotalPropuestoKg / 1000).toFixed(1)} TN ({rec.sacosTotalesPropuestos} sacos)
                          </span>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-white truncate" title={rec.cliente}>
                            Cliente: {rec.cliente}
                          </div>
                          <div className="text-[11px] text-amber-300">
                            Variedad: {rec.variedad}
                          </div>
                        </div>

                        {/* Chips de los lotes unidos */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {rec.lotes.map((l) => (
                            <span 
                              key={l.loteId}
                              className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 font-mono flex items-center gap-1"
                            >
                              <strong>{l.loteId}</strong>
                              <span className="text-slate-400">({(l.pesoPropuesto / 1000).toFixed(1)} TN • {l.humedad}% H)</span>
                            </span>
                          ))}
                        </div>

                        <p className="text-[10px] text-slate-400 italic line-clamp-2">
                          {rec.motivoRecomendacion}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAplicarUnionGrupal(rec)}
                        className="w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Cargar Esta Unión al Batch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* CASO B: BATCH CON LOTES YA SELECCIONADOS -> RECOMENDAR COMPAÑEROS DE MEZCLA */
            <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                    <GitMerge className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      Lotes Recomendados para Unir a este Batch
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Lotes del mismo cliente (<strong className="text-amber-300">{clienteBatchActual}</strong>) que cumplen las tolerancias de mezcla (Humedad ±{criteriosConfig.toleranciaHumedad}%, T.T ±{criteriosConfig.toleranciaTotalTrizado}%, Q.I ±{criteriosConfig.toleranciaQuebradoInt}%).
                    </p>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-400 text-right">
                  <span>Capacidad Restante: </span>
                  <strong className="text-amber-400">
                    {Math.max(0, parametros.capacidadMaximaSecadoraKg - pesoTotalKg).toLocaleString()} kg
                  </strong>
                </div>
              </div>

              {lotesRecomendadosParaUnir.length === 0 ? (
                <div className="p-3 bg-slate-950/60 rounded-lg text-xs text-slate-400 border border-slate-800">
                  ℹ️ No hay otros lotes pendientes del cliente <strong className="text-slate-300">"{clienteBatchActual}"</strong> disponibles para unirse a este batch.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {lotesRecomendadosParaUnir.slice(0, 6).map((item) => {
                    const remCapKg = Math.max(0, parametros.capacidadMaximaSecadoraKg - pesoTotalKg);
                    const saldoLoteKg = saldosMap.get(item.lote.LOTE_ID)?.saldoPendienteKg || 0;
                    const pesoAportarKg = Math.min(saldoLoteKg, remCapKg > 0 ? remCapKg : saldoLoteKg);
                    const sacosAportar = Math.round(pesoAportarKg / 50);

                    return (
                      <div 
                        key={item.lote.LOTE_ID}
                        className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                          item.esCompatible 
                            ? "bg-slate-950/80 border-emerald-500/40 hover:border-emerald-400" 
                            : "bg-slate-950/60 border-slate-800 opacity-75"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-white text-xs">
                              {item.lote.LOTE_ID}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.esCompatible
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}>
                              {item.esCompatible ? `✓ ${item.porcentajeSimilitud}% Conforme` : `⚠️ Desviación`}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Variedad: <strong className="text-slate-200">{item.lote.VARIEDAD || "Tinajones"}</strong></span>
                            <span>Saldo: <strong className="text-emerald-400 font-mono">{saldoLoteKg.toLocaleString()} kg</strong></span>
                          </div>

                          {/* Comparativa de Parámetros */}
                          <div className="grid grid-cols-3 gap-1 py-1 text-[10px] font-mono bg-slate-900/80 px-2 rounded border border-slate-800 text-center">
                            <div>
                              <span className="text-slate-500 block">Δ HUM</span>
                              <span className={item.diferenciaHumedad <= criteriosConfig.toleranciaHumedad ? "text-emerald-300 font-bold" : "text-rose-400 font-bold"}>
                                {item.diferenciaHumedad}%
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Δ T.T</span>
                              <span className={item.diferenciaTotalTrizado <= criteriosConfig.toleranciaTotalTrizado ? "text-emerald-300 font-bold" : "text-rose-400 font-bold"}>
                                {item.diferenciaTotalTrizado}%
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Δ QUEBR</span>
                              <span className={item.diferenciaQuebrado <= criteriosConfig.toleranciaQuebradoInt ? "text-emerald-300 font-bold" : "text-rose-400 font-bold"}>
                                {item.diferenciaQuebrado}%
                              </span>
                            </div>
                          </div>

                          {item.parametrosDesviados.length > 0 && (
                            <p className="text-[10px] text-amber-300">
                              Excede: {item.parametrosDesviados.join(", ")}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnirLoteCandidato(item.lote.LOTE_ID)}
                          className={`w-full py-1 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                            item.esCompatible
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Unir {pesoAportarKg.toLocaleString()} kg ({sacosAportar}s)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: EVALUACIÓN Y VALIDACIÓN OFICIAL SEGÚN CRITERIOS PARA UNIR LOTES */}
          {selectedLotes.length > 1 && evaluacionCriteriosBatch && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              evaluacionCriteriosBatch.esCompatible
                ? "bg-emerald-950/25 border-emerald-600/50 text-emerald-200"
                : "bg-rose-950/30 border-rose-600/60 text-rose-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {evaluacionCriteriosBatch.esCompatible ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {evaluacionCriteriosBatch.esCompatible 
                        ? "Mezcla Conforme a Criterios Oficiales de Unión de Lotes" 
                        : "Alerta de Incumplimiento de Criterios de Unión de Lotes"}
                    </h4>
                    <p className="text-[11px] opacity-90">
                      {evaluacionCriteriosBatch.recomendacionOperativa}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarDetalleCriterios(!mostrarDetalleCriterios)}
                    className="px-2.5 py-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>{mostrarDetalleCriterios ? "Ocultar 11 Parámetros" : "Ver 11 Parámetros y Tolerancias"}</span>
                    {mostrarDetalleCriterios ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfigCriteriosModalOpen(true)}
                    className="p-1 text-slate-400 hover:text-white rounded"
                    title="Ajustar Criterios de Unión"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              </div>

              {/* Grid Desplegable con los 11 Parámetros Oficiales de Planta y sus Tolerancias */}
              {mostrarDetalleCriterios && (
                <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>EVALUACIÓN DE HOMOGENEIDAD RESPECTO AL PROMEDIO DEL BATCH</span>
                    <span>TOLERANCIA PLANTA</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {evaluacionCriteriosBatch.desviacionesPorParametro.map((dp) => (
                      <div 
                        key={dp.parametro}
                        className={`p-2 rounded-lg border text-xs font-mono ${
                          dp.cumple 
                            ? "bg-slate-900/80 border-slate-700 text-slate-200" 
                            : "bg-rose-950/60 border-rose-600 text-rose-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold truncate" title={dp.nombre}>{dp.nombre}</span>
                          <span>{dp.cumple ? "✓" : "⚠️"}</span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-[11px] font-bold text-white">
                            Prom: {dp.promedioBatch}{dp.unidad}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Tol: ±{dp.toleranciaPermitida}{dp.unidad}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
                          <span>Desv Máx:</span>
                          <strong className={dp.cumple ? "text-emerald-400" : "text-rose-400 font-black"}>
                            {dp.desviacionMaximaObservada}{dp.unidad}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  {evaluacionCriteriosBatch.alertas.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-rose-900/30 border border-rose-700/60 text-[11px] text-rose-200 space-y-0.5">
                      {evaluacionCriteriosBatch.alertas.map((a, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-rose-400 shrink-0">•</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSugerirCombinacionIA}
                  className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Sugerir automáticamente combinación de lotes óptima"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Sugerir Combinación Compatible (IA)
                </button>
              </div>
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
                No hay lotes agregados al Batch aún. Seleccione una de las <strong>Recomendaciones Inteligentes</strong> superiores o agregue lotes de la tabla disponible.
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Lotes Pendientes Disponibles con Saldo ({lotesDisponiblesMostrados.length})</span>
                </h3>
                <span className="text-[11px] text-amber-400 font-medium">
                  ⚡ Lista ordenada por Prioridad Oficial de Proceso (Emergencia &gt; Alto &gt; Medio &gt; Bajo)
                </span>
              </div>

              {selectedLotes.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltroSoloCompatibles(!filtroSoloCompatibles)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      filtroSoloCompatibles
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtrar solo cliente "{clienteBatchActual}"</span>
                  </button>
                </div>
              )}
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
                      <th className="px-2.5 py-2.5 text-center">Hum %</th>
                      <th className="px-2.5 py-2.5 text-center">% Entero</th>
                      <th className="px-2.5 py-2.5">Aptitud</th>
                      <th className="px-2.5 py-2.5">Compatibilidad Unión</th>
                      <th className="px-2.5 py-2.5">Saldo Disp.</th>
                      <th className="px-2.5 py-2.5">Estado</th>
                      <th className="px-2.5 py-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {lotesDisponiblesMostrados.map((lote, index) => {
                      const s = saldosMap.get(lote.LOTE_ID);
                      const ahObj = analisisHumedos.find((a) => a.LOTE_ID === lote.LOTE_ID);
                      const aptitud = verificarAptitudProgramacionLote(lote, ahObj);
                      const progsOficiales = cargarProgramacionesOficiales();
                      const otherBatches = batchToEdit ? batchesExistentes.filter((b) => b.BATCH_ID !== batchToEdit.BATCH_ID) : batchesExistentes;
                      const batchInfo = obtenerInfoLoteEnBatches(lote.LOTE_ID, progsOficiales, otherBatches);
                      const isAssignedElsewhere = batchInfo.estaProgramado;

                      const isAlreadySelected = selectedLotes.some((sl) => sl.loteId === lote.LOTE_ID);
                      const isPartiallyProcessed = s?.estadoSaldo === "PARCIALMENTE PROCESADO";
                      const canAdd = aptitud.esProgramable && !isAlreadySelected && !isAssignedElsewhere;

                      const pInfo = prioridadMap.get(lote.LOTE_ID.trim().toLowerCase());
                      const posPrio = pInfo?.posicion ?? (index + 1);
                      const esEmerg = pInfo?.esEmergencia || pInfo?.nivelRiesgo === "EMERGENCIA";

                      const rtoEntero = ahObj?.ENTERO !== undefined ? `${ahObj.ENTERO}%` : "-";

                      // Evaluación de compatibilidad de unión con la selección actual
                      const esMismoCliente = selectedLotes.length === 0 || (s?.cliente?.trim().toLowerCase() === clienteBatchActual?.trim().toLowerCase());
                      const esCompatibleUnion = idsCompatiblesUnion.has(lote.LOTE_ID);

                      return (
                        <tr 
                          key={lote.LOTE_ID} 
                          className={`hover:bg-slate-800/50 ${
                            isAlreadySelected || isAssignedElsewhere 
                              ? "bg-slate-800/30 opacity-60" 
                              : !aptitud.esProgramable 
                              ? "bg-rose-950/20" 
                              : esCompatibleUnion
                              ? "bg-emerald-950/20"
                              : esEmerg 
                              ? "bg-rose-950/15" 
                              : ""
                          }`}
                        >
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
                          <td className="px-2.5 py-2 text-center font-bold text-cyan-300">{lote.HUM}%</td>
                          <td className="px-2.5 py-2 text-center font-medium text-emerald-300">{rtoEntero}</td>
                          <td className="px-2.5 py-2 font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${aptitud.badgeClass}`} title={aptitud.motivoBloqueo || aptitud.detalles}>
                              {aptitud.estadoMacro === "APROBADO" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                              {aptitud.estadoMacro === "OBSERVADO" && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                              {aptitud.estadoMacro === "NO_APTO" && <AlertCircle className="w-3 h-3 text-rose-400" />}
                              <span>{aptitud.label}</span>
                            </span>
                          </td>
                          <td className="px-2.5 py-2 font-sans">
                            {selectedLotes.length === 0 ? (
                              <span className="text-[10px] text-slate-400">Disponible</span>
                            ) : isAlreadySelected ? (
                              <span className="text-[10px] text-slate-400">En batch</span>
                            ) : !esMismoCliente ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400" title="Cliente diferente al del batch actual">
                                Dif. Cliente
                              </span>
                            ) : esCompatibleUnion ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ✓ Recomendado
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                                Mismo Cliente
                              </span>
                            )}
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
                                  : esCompatibleUnion
                                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow"
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
              placeholder="Ej: Vaporizado a 1.85 bar, unión de lotes C1502 + C1505 conforme a tolerancias de planta..."
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
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-guardar-batch"
              disabled={isSubmitting || selectedLotes.length === 0 || !compatibilidad.esCompatible || saldoErrors.length > 0 || capacidadBalance.estadoCapacidad === "EXCESO_NO_PERMITIDO" || (evaluacionCriteriosBatch !== null && !evaluacionCriteriosBatch.esCompatible)}
              onClick={() => handleSave()}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? "Creando Batch..." : `Confirmar y Crear Batch ${correlativo}`}
            </button>
          </div>
        </div>

      </div>

      {/* Sub-Modal: Configuración de Criterios y Tolerancias para Unir Lotes */}
      <ConfigCriteriosUnionLotesModal
        isOpen={isConfigCriteriosModalOpen}
        onClose={() => setIsConfigCriteriosModalOpen(false)}
        configActual={criteriosConfig}
        onSaveConfig={(nuevaCfg) => {
          setCriteriosConfig(nuevaCfg);
          guardarCriteriosUnion(nuevaCfg);
        }}
        currentUser={{ nombre: operador, rol: "Jefatura de Planta / Control de Calidad" }}
      />
    </div>
  );
};
