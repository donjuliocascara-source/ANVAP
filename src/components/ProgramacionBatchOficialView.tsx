import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Lote, 
  AnalisisHumedo, 
  Presecado, 
  BatchVaporizado, 
  UserProfile,
  PriorizacionLote,
  ParametrosTrabajo,
  HistorialParametro
} from "../types";
import { 
  ProgramacionBatchOficial, 
  LoteProgramacionFila, 
  cargarProgramacionesOficiales, 
  guardarProgramacionesOficiales, 
  calcularPromediosPonderadosBatch, 
  recomendarParametrosOperativos, 
  extraerDatosCalidadLote, 
  generarSiguienteCorrelativoV,
  obtenerInfoLoteEnBatches,
  validarSacosYPesoLotesProgramacion,
  calcularSaldoDisponibleLoteParaBatch
} from "../utils/programacionBatchOficialService";
import {
  CriteriosUnionLotesConfig,
  CRITERIOS_UNION_DEFAULT,
  obtenerCriteriosUnionGuardados,
  guardarCriteriosUnion,
  evaluarCompatibilidadBatch,
  evaluarCandidatoParaBatch,
  buscarLotesSemejantesMismoCliente
} from "../utils/criteriosUnionLotes";
import { esLotePendiente } from "../utils/loteClassification";
import { verificarAptitudProgramacionLote } from "../utils/evaluacionCalidad";
import { calcularPrioridadesLotes } from "../utils/priorizacionService";
import { ConfigCriteriosUnionLotesModal } from "./ConfigCriteriosUnionLotesModal";
import { ParametrosTrabajoModal } from "./ParametrosTrabajoModal";
import { ResultadosDefectosCoccionView } from "./ResultadosDefectosCoccionView";
import { ExportarProgramacionModal } from "./ExportarProgramacionModal";
import { obtenerParametrosTrabajoGuardados, guardarParametrosTrabajoLocal } from "../utils/batchEngine";
import { localDB } from "../utils/localDB";
import { 
  CalendarCheck, 
  Plus, 
  Trash2, 
  Download, 
  Share2, 
  Printer, 
  Sparkles, 
  Award,
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Gauge, 
  Clock, 
  Flame, 
  Layers, 
  Edit3, 
  Save, 
  ArrowRight, 
  RefreshCw, 
  FileSpreadsheet, 
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Info,
  Sliders,
  Users,
  Lock,
  Search,
  Check,
  Play,
  ArrowUpRight,
  X,
  Droplets,
  Scale,
  Warehouse,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Tag,
  Filter,
  Settings
} from "lucide-react";

interface ProgramacionBatchOficialViewProps {
  lotes: Lote[];
  analisisHumedos: AnalisisHumedo[];
  presecados?: Presecado[];
  batches?: BatchVaporizado[];
  batchLotes?: any[];
  currentUser?: UserProfile | { nombre: string; rol: string };
  initialLoteIds?: string[];
  initialMode?: "resumen" | "armador" | "comparativa" | "resultados";
  onNavigateToVaporizado?: (batchId: string) => void;
  onSelectLoteForFicha?: (loteId: string) => void;
  onSaveBatch?: (batchData: Partial<BatchVaporizado>, assignedLotes: any[]) => Promise<void>;
  onDeleteBatch?: (batchId: string) => Promise<void>;
  onRefreshData?: () => void;
  onClearInitialLotes?: () => void;
  parametros?: ParametrosTrabajo;
  historialParametros?: HistorialParametro[];
  onSaveParametros?: (newParams: Partial<ParametrosTrabajo>, motivo?: string) => Promise<void>;
}

export const ProgramacionBatchOficialView: React.FC<ProgramacionBatchOficialViewProps> = ({
  lotes = [],
  analisisHumedos = [],
  presecados = [],
  batches = [],
  batchLotes = [],
  currentUser = { nombre: "Ing. Carlos Mendoza", rol: "JEFE_PLANTA" },
  initialLoteIds,
  initialMode,
  onNavigateToVaporizado,
  onSelectLoteForFicha,
  onSaveBatch,
  onDeleteBatch,
  onRefreshData,
  onClearInitialLotes,
  parametros,
  historialParametros,
  onSaveParametros
}) => {
  // Parámetros de Trabajo de Planta Dinámicos (Sincronización Total con Configuración)
  const [localParametros, setLocalParametros] = useState<ParametrosTrabajo>(() => parametros || obtenerParametrosTrabajoGuardados());
  const [isParametrosModalOpen, setIsParametrosModalOpen] = useState(false);

  useEffect(() => {
    if (parametros) {
      setLocalParametros(parametros);
    }
  }, [parametros]);

  useEffect(() => {
    const handleParamsUpdated = (e: CustomEvent<ParametrosTrabajo>) => {
      if (e.detail && e.detail.capacidadMaximaSecadoraKg) {
        setLocalParametros(e.detail);
      }
    };
    window.addEventListener("parametros-trabajo-updated" as any, handleParamsUpdated);
    return () => {
      window.removeEventListener("parametros-trabajo-updated" as any, handleParamsUpdated);
    };
  }, []);

  const capacidadMaximaKg = Number(localParametros.capacidadMaximaSecadoraKg) || 35000;
  const capacidadExcepcionalKg = Number(localParametros.capacidadExcepcionalMaximaKg) || 37000;
  const capacidadMinimaKg = Number(localParametros.capacidadMinimaProcesoKg) || 22000;
  const capacidadMaximaTn = Math.round((capacidadMaximaKg / 1000) * 10) / 10;

  // Mode: "resumen" (Sábana Excel Oficial) | "armador" (Nuevo/Editar Caso) | "comparativa" (IA vs Real) | "resultados" (Incrementos Defectos & Cocción)
  const [viewMode, setViewMode] = useState<"resumen" | "armador" | "comparativa" | "resultados">(initialMode || "resumen");

  useEffect(() => {
    if (initialMode) {
      setViewMode(initialMode);
    }
  }, [initialMode]);

  // Master schedule state
  const [programaciones, setProgramaciones] = useState<ProgramacionBatchOficial[]>(() => cargarProgramacionesOficiales());

  // Filter & search for master schedule
  const [filtroTurno, setFiltroTurno] = useState<"TODOS" | "DIA" | "NOCHE">("TODOS");
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [busquedaLote, setBusquedaLote] = useState<string>("");

  // Modal Exportación PDF / Imagen
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [batchParaExportar, setBatchParaExportar] = useState<ProgramacionBatchOficial | null>(null);

  const handleAbrirExportacion = (batch?: ProgramacionBatchOficial | null) => {
    setBatchParaExportar(batch || null);
    setIsExportModalOpen(true);
  };

  // Criterios de Tolerancia y Desviación para Unir Lotes
  const [criteriosUnion, setCriteriosUnion] = useState<CriteriosUnionLotesConfig>(() => obtenerCriteriosUnionGuardados());
  const [isModalCriteriosOpen, setIsModalCriteriosOpen] = useState(false);
  const [isModalSugerenciasOpen, setIsModalSugerenciasOpen] = useState(false);
  const [soloMismoClienteFiltro, setSoloMismoClienteFiltro] = useState(true);

  // Builder Form State
  const [editingProgId, setEditingProgId] = useState<string | null>(null);
  const [casoNombre, setCasoNombre] = useState<string>("");
  const [fechaProg, setFechaProg] = useState<string>(new Date().toISOString().split("T")[0]);
  const [turnoProg, setTurnoProg] = useState<"DIA" | "NOCHE">("DIA");
  const [batchCorrelativo, setBatchCorrelativo] = useState<string>("V200");
  const [filasLote, setFilasLote] = useState<LoteProgramacionFila[]>([]);
  const [observacionProg, setObservacionProg] = useState<string>("");

  // Manual determined parameters
  const [presionDet, setPresionDet] = useState<number>(0.35);
  const [velExclDet, setVelExclDet] = useState<number>(4);
  const [tiempoReposoDet, setTiempoReposoDet] = useState<number>(60);
  const [tempSecadoDet, setTempSecadoDet] = useState<number>(75);

  // Soporte Oficial para Modalidad 1 Pase / 2 Pases en la Programación
  const [modalidadPasesDet, setModalidadPasesDet] = useState<"1_PASE" | "2_PASES">("1_PASE");
  const [presionPase1Det, setPresionPase1Det] = useState<number>(0.35);
  const [presionPase2Det, setPresionPase2Det] = useState<number>(0.40);
  const [tiempoReposoPase1Det, setTiempoReposoPase1Det] = useState<number>(10);
  const [tiempoReposoPase2Det, setTiempoReposoPase2Det] = useState<number>(60);
  const [velExclPase1Det, setVelExclPase1Det] = useState<number>(4);
  const [velExclPase2Det, setVelExclPase2Det] = useState<number>(4);

  // Success alert & Workflow Prompt for Process transition
  const [notifMensaje, setNotifMensaje] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [filtroTipoLotes, setFiltroTipoLotes] = useState<"PENDIENTES" | "TODOS">("PENDIENTES");

  // Estados para el selector enriquecido de lotes en armador de batch (Matriz Completa de Priorización)
  const [busquedaSelectorLotes, setBusquedaSelectorLotes] = useState<string>("");
  const [filtroVariedadSelector, setFiltroVariedadSelector] = useState<string>("TODAS");
  const [filtroRiesgoSelector, setFiltroRiesgoSelector] = useState<string>("TODOS");
  const [filtroCalidadSelector, setFiltroCalidadSelector] = useState<string>("TODOS");
  const [vistaSelectorModo, setVistaSelectorModo] = useState<"TABLA" | "TARJETAS" | "COMPACTO">("TABLA");
  const [ordenSelectorLotes, setOrdenSelectorLotes] = useState<"PRIORIDAD" | "HUMEDAD_ASC" | "HUMEDAD_DESC" | "ENTERO_DESC" | "SACOS_DESC">("PRIORIDAD");
  const [selectedLoteIdsInArmador, setSelectedLoteIdsInArmador] = useState<string[]>([]);

  // Custom Interactive Dialog Modal (Replacing native alert/confirm to prevent UI blocking)
  const [dialogModal, setDialogModal] = useState<{
    isOpen: boolean;
    tipo: "info" | "warning" | "error" | "confirm-deviation" | "confirm-weight" | "confirm-variety" | "confirm-client";
    titulo: string;
    mensaje: string;
    detalles?: string[];
    textoBotonPrincipal: string;
    textoBotonSecundario?: string;
    onConfirmar?: () => void | Promise<void>;
    onSecundario?: () => void;
  } | null>(null);

  const [batchCreadoPrompt, setBatchCreadoPrompt] = useState<{
    batch: string;
    caso: string;
    kg: number;
    sacos: number;
    lotesCount: number;
  } | null>(null);

  // Modal States for Delete and Quick Edit (Without blocking browser window.confirm)
  const [batchToDelete, setBatchToDelete] = useState<ProgramacionBatchOficial | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [batchToQuickEdit, setBatchToQuickEdit] = useState<ProgramacionBatchOficial | null>(null);
  const [quickEditData, setQuickEditData] = useState<{
    caso: string;
    fecha: string;
    turno: "DIA" | "NOCHE";
    modalidadPases: "1_PASE" | "2_PASES";
    presionBar: number;
    velExclusa: number;
    tiempoReposoMin: number;
    tempSecadoC: number;
    presionPase1: number;
    presionPase2: number;
    tiempoReposoPase1: number;
    tiempoReposoPase2: number;
    velExclusaPase1: number;
    velExclusaPase2: number;
    observacion: string;
  }>({
    caso: "",
    fecha: "",
    turno: "DIA",
    modalidadPases: "1_PASE",
    presionBar: 0.35,
    velExclusa: 4,
    tiempoReposoMin: 60,
    tempSecadoC: 75,
    presionPase1: 0.35,
    presionPase2: 0.40,
    tiempoReposoPase1: 10,
    tiempoReposoPase2: 60,
    velExclusaPase1: 4,
    velExclusaPase2: 4,
    observacion: ""
  });

  // Fetch master schedule from local database
  const recargarProgramaciones = useCallback(async () => {
    try {
      const data = localDB.getProgramacionesOficiales();
      if (Array.isArray(data)) {
        const sinMock = data.filter(p => {
          const id = (p?.id || "").trim();
          return id !== "PROG-BATCH-200" && id !== "PROG-BATCH-201";
        });
        setProgramaciones(sinMock);
        guardarProgramacionesOficiales(sinMock);
      }
    } catch (err) {
      console.warn("Error cargando programaciones oficiales:", err);
    }
  }, []);

  useEffect(() => {
    recargarProgramaciones();
  }, [recargarProgramaciones, batches?.length]);

  // 1. Matriz de Priorización calculada para todos los lotes pendientes y aptos
  // (Orden: 1. Emergencia, 2. Alto, 3. Medio, 4. Bajo -> Score descendente)
  const lotesPriorizados = useMemo(() => {
    return calcularPrioridadesLotes(lotes, analisisHumedos);
  }, [lotes, analisisHumedos]);

  // Mapa rápido de metadatos de priorización por ID de lote
  const prioridadMap = useMemo(() => {
    const map = new Map<string, PriorizacionLote>();
    lotesPriorizados.forEach(p => {
      map.set((p.loteId || "").trim().toLowerCase(), p);
    });
    return map;
  }, [lotesPriorizados]);

  // Available lots strictly pending, apt (APROBADOS, OBSERVADOS, EXPERIMENTALES)
  // Y NO PROGRAMADOS (LOS LOTES YA PROGRAMADOS EN OTRO BATCH NO DEBEN APARECER DISPONIBLES)
  // ORDENADOS ESTRICTAMENTE POR SU POSICIÓN DE PRIORIDAD DE PROCESO (#1, #2, #3, ...)
  const lotesDisponibles = useMemo(() => {
    const lotMap = new Map((lotes || []).map(l => [(l.LOTE_ID || "").trim().toLowerCase(), l]));
    const result: (Lote & { prioridadInfo?: PriorizacionLote })[] = [];

    // Helper: verifica si el lote está pendiente y NO está programado en otro batch con saldo agotado
    const esDisponibleParaProgramar = (loteObj: Lote) => {
      if (!esLotePendiente(loteObj)) return false;
      const infoBatch = obtenerInfoLoteEnBatches(
        loteObj.LOTE_ID,
        programaciones,
        batches,
        editingProgId,
        batchCorrelativo
      );
      // REGLA ESTRICTA DE PLANTA: Lotes ya programados en otro batch no deben aparecer disponibles
      if (infoBatch.estaProgramado && !infoBatch.esMismoBatch) {
        return false;
      }
      // REGLA CRÍTICA DE PLANTA: Si el lote ya agotó el 100% de sus sacos en otros batches, no está disponible
      const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
        loteObj.LOTE_ID,
        lotes,
        programaciones,
        batches,
        batchLotes,
        editingProgId,
        batchCorrelativo
      );
      if (saldoInfo.sacosDisponibles <= 0) {
        return false;
      }
      return true;
    };

    // 1. Primero incorporar los lotes priorizados en su orden estricto de prelación
    for (const p of lotesPriorizados) {
      const cleanId = (p.loteId || "").trim().toLowerCase();
      const loteObj = lotMap.get(cleanId);
      if (loteObj && esDisponibleParaProgramar(loteObj)) {
        result.push({
          ...loteObj,
          prioridadInfo: p
        });
      }
    }

    // 2. Por seguridad, anexar cualquier otro lote pendiente apto que no estuviese en el cálculo principal
    for (const l of lotes || []) {
      const cleanId = (l.LOTE_ID || "").trim().toLowerCase();
      if (esDisponibleParaProgramar(l) && !result.some(r => (r.LOTE_ID || "").trim().toLowerCase() === cleanId)) {
        const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").trim().toLowerCase() === cleanId);
        const aptitud = verificarAptitudProgramacionLote(l, ah);
        if (aptitud.esProgramable) {
          result.push(l);
        }
      }
    }

    return result;
  }, [lotes, lotesPriorizados, analisisHumedos, programaciones, batches, editingProgId, batchCorrelativo]);

  // Auto-save master schedule to localStorage
  useEffect(() => {
    guardarProgramacionesOficiales(programaciones);
  }, [programaciones]);

  // Handle incoming lots from Matriz Completa de Priorizacion or navigation actions
  useEffect(() => {
    if (initialLoteIds && initialLoteIds.length > 0) {
      const existentes = [
        ...(programaciones || []).map(p => p.batch),
        ...(batches || []).map(b => b.CORRELATIVO || b.BATCH_ID)
      ];
      const nextV = generarSiguienteCorrelativoV(existentes);

      // Caso 1: Solicitud explícita de Auto-Llenado (botón especial capacidad máxima)
      if (initialLoteIds.includes("AUTO_LLENAR")) {
        const nuevasFilas: LoteProgramacionFila[] = [];
        let pesoAcumulado = 0;
        const targetLotsToProcess = (lotesDisponibles || []).map(l => l.LOTE_ID);

        for (const loteId of targetLotsToProcess) {
          if (pesoAcumulado >= capacidadMaximaKg) break;
          const cleanId = (loteId || "").trim().toLowerCase();
          const loteObj = (lotes || []).find(l => {
            const lid = (l.LOTE_ID || (l as any).loteId || (l as any).id || "").trim().toLowerCase();
            return lid === cleanId;
          });
          if (!loteObj) continue;

          const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").toLowerCase() === cleanId);
          const ps = (presecados || []).find(p => (p.LOTE_ID || "").toLowerCase() === cleanId);
          const defaults = extraerDatosCalidadLote(loteObj, ah, ps);

          const aptitud = verificarAptitudProgramacionLote(loteObj, ah);
          if (!aptitud.esProgramable) continue;

          // Como referencia inicial toma el saldo disponible real descontando otros batches
          const lid = defaults.loteId || loteObj.LOTE_ID || loteId;
          const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
            lid,
            lotes,
            programaciones,
            batches,
            batchLotes,
            editingProgId,
            batchCorrelativo
          );
          const sacosOriginal = saldoInfo.sacosDisponibles;
          const pesoOriginal = saldoInfo.pesoDisponibleKg;
          if (sacosOriginal <= 0) continue;

          const sacProg = sacosOriginal;
          const pesoProg = pesoOriginal;
          pesoAcumulado += pesoProg;

          nuevasFilas.push({
            loteId: defaults.loteId || loteObj.LOTE_ID || loteId,
            cliente: defaults.cliente || loteObj.CLIENTE || "Cliente",
            variedad: defaults.variedad || loteObj.VARIEDAD || "TINAJONES",
            sacos: sacosOriginal,
            peso: pesoOriginal,
            sacProg,
            pesoProg,
            ph: defaults.ph || 14.0,
            desv: defaults.desv || 1.2,
            blInt: defaults.blInt || 21.5,
            blBlanco: defaults.blBlanco || 39.0,
            qi: defaults.qi || 7.5,
            qb: defaults.qb || 15.5,
            tt: defaults.tt || 1.5,
            tp: defaults.tp || 2.5,
            tpun: defaults.tpun || 4.5,
            m: defaults.m || 0.8,
            triz: defaults.triz || 1.8,
            condicion: defaults.condicion || "APTO"
          });
        }

        setEditingProgId(null);
        setCasoNombre(`Batch ${nextV}`);
        setFechaProg(new Date().toISOString().split("T")[0]);
        setTurnoProg("DIA");
        setBatchCorrelativo(nextV);
        setFilasLote(nuevasFilas);
        setSelectedLoteIdsInArmador([]);
        setObservacionProg("");
        setPresionDet(0.40);
        setVelExclDet(6);
        setTiempoReposoDet(40);
        setTempSecadoDet(80);
        setModalidadPasesDet("1_PASE");
        setPresionPase1Det(0.35);
        setPresionPase2Det(0.40);
        setTiempoReposoPase1Det(10);
        setTiempoReposoPase2Det(40);
        setVelExclPase1Det(6);
        setVelExclPase2Det(6);
        setViewMode("armador");
        setNotifMensaje(`⚡ Batch auto-llenado con ${nuevasFilas.length} lote(s) (${(pesoAcumulado / 1000).toFixed(1)} TN).`);
        setTimeout(() => setNotifMensaje(null), 4000);
      } else if (initialLoteIds.includes("nuevo-batch") || initialLoteIds.includes("crear-batch") || initialLoteIds.includes("armador")) {
        // Creación de Nuevo Batch -> Espacios vacíos sin lotes predeterminados
        setEditingProgId(null);
        setCasoNombre(`Batch ${nextV}`);
        setFechaProg(new Date().toISOString().split("T")[0]);
        setTurnoProg("DIA");
        setBatchCorrelativo(nextV);
        setFilasLote([]); // Espacios vacíos
        setSelectedLoteIdsInArmador([]);
        setObservacionProg("");
        setPresionDet(0.35);
        setVelExclDet(4);
        setTiempoReposoDet(60);
        setTempSecadoDet(75);
        setModalidadPasesDet("1_PASE");
        setPresionPase1Det(0.35);
        setPresionPase2Det(0.40);
        setTiempoReposoPase1Det(10);
        setTiempoReposoPase2Det(60);
        setVelExclPase1Det(4);
        setVelExclPase2Det(4);
        setViewMode("armador");
        setNotifMensaje(`✨ Armador Oficial V200 listo para nuevo Batch ${nextV} (Espacios vacíos).`);
        setTimeout(() => setNotifMensaje(null), 3500);
      } else {
        // Caso 3: Lotes específicos seleccionados por el usuario
        const nuevasFilas: LoteProgramacionFila[] = [];
        let pesoAcumulado = 0;

        for (const loteId of initialLoteIds) {
          const cleanId = (loteId || "").trim().toLowerCase();
          const loteObj = (lotes || []).find(l => {
            const lid = (l.LOTE_ID || (l as any).loteId || (l as any).id || "").trim().toLowerCase();
            return lid === cleanId;
          });
          if (!loteObj) continue;

          const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").toLowerCase() === cleanId);
          const ps = (presecados || []).find(p => (p.LOTE_ID || "").toLowerCase() === cleanId);
          const defaults = extraerDatosCalidadLote(loteObj, ah, ps);

          // Como referencia inicial toma el saldo disponible real descontando otros batches
          const lid = defaults.loteId || loteObj.LOTE_ID || loteId;
          const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
            lid,
            lotes,
            programaciones,
            batches,
            batchLotes,
            editingProgId,
            batchCorrelativo
          );
          const sacosOriginal = saldoInfo.sacosDisponibles;
          const pesoOriginal = saldoInfo.pesoDisponibleKg;
          if (sacosOriginal <= 0) continue;

          const sacProg = sacosOriginal;
          const pesoProg = pesoOriginal;
          pesoAcumulado += pesoProg;

          nuevasFilas.push({
            loteId: defaults.loteId || loteObj.LOTE_ID || loteId,
            cliente: defaults.cliente || loteObj.CLIENTE || "Cliente",
            variedad: defaults.variedad || loteObj.VARIEDAD || "TINAJONES",
            sacos: sacosOriginal,
            peso: pesoOriginal,
            sacProg,
            pesoProg,
            ph: defaults.ph || 14.0,
            desv: defaults.desv || 1.2,
            blInt: defaults.blInt || 21.5,
            blBlanco: defaults.blBlanco || 39.0,
            qi: defaults.qi || 7.5,
            qb: defaults.qb || 15.5,
            tt: defaults.tt || 1.5,
            tp: defaults.tp || 2.5,
            tpun: defaults.tpun || 4.5,
            m: defaults.m || 0.8,
            triz: defaults.triz || 1.8,
            condicion: defaults.condicion || "APTO"
          });
        }

        setEditingProgId(null);
        setCasoNombre(`Batch ${nextV}`);
        setFechaProg(new Date().toISOString().split("T")[0]);
        setTurnoProg("DIA");
        setBatchCorrelativo(nextV);
        setFilasLote(nuevasFilas);
        setSelectedLoteIdsInArmador([]);
        setObservacionProg("");
        setPresionDet(0.35);
        setVelExclDet(4);
        setTiempoReposoDet(60);
        setTempSecadoDet(75);
        setModalidadPasesDet("1_PASE");
        setPresionPase1Det(0.35);
        setPresionPase2Det(0.40);
        setTiempoReposoPase1Det(10);
        setTiempoReposoPase2Det(60);
        setVelExclPase1Det(4);
        setVelExclPase2Det(4);
        setViewMode("armador");
        setNotifMensaje(`✨ ${nuevasFilas.length} lote(s) cargado(s) al Batch ${nextV}.`);
        setTimeout(() => setNotifMensaje(null), 3500);
      }

      if (onClearInitialLotes) {
        onClearInitialLotes();
      }
    }
  }, [initialLoteIds, lotes, analisisHumedos, presecados, lotesDisponibles, programaciones]);

  // Handler expreso para pasar un Batch a Proceso en Control de Vaporizado
  const handleProcesarBatch = async (prog: ProgramacionBatchOficial | { batch: string; id?: string }) => {
    const batchCode = prog.batch || (prog as any).id || "V200";
    try {
      localDB.iniciarProcesoBatch(batchCode, currentUser?.nombre || "Operador");
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.warn("Error iniciando proceso en localDB", e);
    }
    if (onNavigateToVaporizado) {
      onNavigateToVaporizado(batchCode);
    }
  };

  // Calculate live weighted averages for the current builder
  const liveCalculos = useMemo(() => {
    return calcularPromediosPonderadosBatch(filasLote);
  }, [filasLote]);

  // Primary variety of current batch
  const variedadPrincipal = useMemo(() => {
    if (filasLote.length === 0) return "TINAJONES";
    const map = new Map<string, number>();
    for (const f of filasLote) {
      map.set(f.variedad, (map.get(f.variedad) || 0) + f.pesoProg);
    }
    let topVar = "TINAJONES";
    let maxP = -1;
    map.forEach((p, v) => {
      if (p > maxP) {
        maxP = p;
        topVar = v;
      }
    });
    return topVar;
  }, [filasLote]);

  // Primary client of current batch
  const clientePrincipal = useMemo(() => {
    if (filasLote.length === 0) return "Sin Cliente";
    return filasLote[0].cliente || "Sin Cliente";
  }, [filasLote]);

  // Evaluacion en tiempo real de compatibilidad, homogeneidad y desviaciones del Batch
  const evaluacionMezcla = useMemo(() => {
    return evaluarCompatibilidadBatch(filasLote, criteriosUnion);
  }, [filasLote, criteriosUnion]);

  // Lotes sugeridos semejantes del mismo cliente
  const sugerenciasLotesSemejantes = useMemo(() => {
    if (filasLote.length === 0) return [];
    return buscarLotesSemejantesMismoCliente(
      filasLote[0],
      lotesDisponibles,
      analisisHumedos,
      presecados,
      filasLote.map(f => f.loteId),
      criteriosUnion
    );
  }, [filasLote, lotesDisponibles, analisisHumedos, presecados, criteriosUnion]);

  // Variedades disponibles para filtro en selector
  const variedadesDisponiblesSelector = useMemo(() => {
    const setVar = new Set<string>();
    (lotesDisponibles || []).forEach(l => {
      if (l.VARIEDAD && l.VARIEDAD.trim()) {
        setVar.add(l.VARIEDAD.trim().toUpperCase());
      }
    });
    return Array.from(setVar).sort();
  }, [lotesDisponibles]);

  // Promedio ponderado de humedad actual de los lotes en el batch para calcular delta de humedad
  const promedioHumedadBatchActual = useMemo(() => {
    if (filasLote.length === 0) return null;
    const pesoTot = filasLote.reduce((acc, f) => acc + (f.pesoProg || 0), 0);
    if (pesoTot <= 0) return null;
    const humPond = filasLote.reduce((acc, f) => acc + ((f.ph || 14) * (f.pesoProg || 0)), 0) / pesoTot;
    return humPond;
  }, [filasLote]);

  // Lotes filtrados y ordenados para el selector de armador (Matriz Completa de Priorización)
  const lotesSelectorFiltrados = useMemo(() => {
    let list = (lotesDisponibles || []).filter(l => {
      // 1. Filtro mismo cliente
      if (soloMismoClienteFiltro && filasLote.length > 0 && clientePrincipal !== "Sin Cliente") {
        const cli = (l.CLIENTE || "").trim().toLowerCase();
        if (cli !== clientePrincipal.trim().toLowerCase()) return false;
      }
      // 2. Filtro variedad
      if (filtroVariedadSelector !== "TODAS") {
        const varLote = (l.VARIEDAD || "").trim().toUpperCase();
        if (varLote !== filtroVariedadSelector.toUpperCase()) return false;
      }
      // 3. Filtro por Nivel de Riesgo
      if (filtroRiesgoSelector !== "TODOS") {
        const pInfo = (l as any).prioridadInfo || prioridadMap.get((l.LOTE_ID || "").trim().toLowerCase());
        const nivel = pInfo?.nivelRiesgo || "BAJO";
        if (filtroRiesgoSelector === "EMERGENCIA" && !pInfo?.esEmergencia && nivel !== "EMERGENCIA") return false;
        if (filtroRiesgoSelector !== "EMERGENCIA" && nivel !== filtroRiesgoSelector) return false;
      }
      // 4. Filtro por Calidad / Aptitud
      if (filtroCalidadSelector !== "TODOS") {
        const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").toLowerCase() === (l.LOTE_ID || "").toLowerCase());
        const aptitud = verificarAptitudProgramacionLote(l, ah);
        if (filtroCalidadSelector === "APROBADO" && aptitud.estadoMacro !== "APROBADO") return false;
        if (filtroCalidadSelector === "OBSERVADO" && aptitud.estadoMacro !== "OBSERVADO") return false;
        if (filtroCalidadSelector === "EXPERIMENTAL" && aptitud.estadoMacro !== "EXPERIMENTAL") return false;
      }
      // 5. Búsqueda por texto (Lote ID, Cliente, Variedad, Ubicación)
      if (busquedaSelectorLotes.trim()) {
        const q = busquedaSelectorLotes.trim().toLowerCase();
        const lid = (l.LOTE_ID || "").toLowerCase();
        const cli = (l.CLIENTE || "").toLowerCase();
        const varLote = (l.VARIEDAD || "").toLowerCase();
        const ubi = (l.UBICACION || "").toLowerCase();
        if (!lid.includes(q) && !cli.includes(q) && !varLote.includes(q) && !ubi.includes(q)) {
          return false;
        }
      }
      return true;
    });

    if (ordenSelectorLotes === "PRIORIDAD") {
      return list; // Preserva orden estricto de prelación oficial #1, #2...
    }

    return [...list].sort((a, b) => {
      const ahA = (analisisHumedos || []).find(x => x.LOTE_ID === a.LOTE_ID);
      const ahB = (analisisHumedos || []).find(x => x.LOTE_ID === b.LOTE_ID);
      const humA = ahA?.HUMEDADES ?? a.HUM ?? a.HUMEDAD ?? 14;
      const humB = ahB?.HUMEDADES ?? b.HUM ?? b.HUMEDAD ?? 14;
      const entA = ahA?.ENTERO ?? 50;
      const entB = ahB?.ENTERO ?? 50;
      const sacosA = a.SACOS ?? 0;
      const sacosB = b.SACOS ?? 0;

      if (ordenSelectorLotes === "HUMEDAD_ASC") return humA - humB;
      if (ordenSelectorLotes === "HUMEDAD_DESC") return humB - humA;
      if (ordenSelectorLotes === "ENTERO_DESC") return entB - entA;
      if (ordenSelectorLotes === "SACOS_DESC") return sacosB - sacosA;
      return 0;
    });
  }, [lotesDisponibles, soloMismoClienteFiltro, filasLote, clientePrincipal, filtroVariedadSelector, filtroRiesgoSelector, filtroCalidadSelector, busquedaSelectorLotes, ordenSelectorLotes, analisisHumedos, prioridadMap]);

  // Estadísticas acumuladas de los lotes seleccionados con checkboxes en la Matriz
  const statsSeleccionArmador = useMemo(() => {
    if (selectedLoteIdsInArmador.length === 0) return null;
    const lots = (lotes || []).filter(l => selectedLoteIdsInArmador.includes(l.LOTE_ID));
    const totalSacos = lots.reduce((acc, l) => acc + (l.SACOS || 0), 0);
    const totalKg = lots.reduce((acc, l) => acc + (l.PESO_KG || (l.SACOS || 0) * 50), 0);
    const totalTn = totalKg / 1000;
    let sumHumPond = 0;
    lots.forEach(l => {
      const ah = (analisisHumedos || []).find(a => a.LOTE_ID === l.LOTE_ID);
      const hum = ah?.HUMEDADES ?? l.HUM ?? l.HUMEDAD ?? 14.0;
      const kg = l.PESO_KG || (l.SACOS || 0) * 50;
      sumHumPond += hum * kg;
    });
    const humProm = totalKg > 0 ? (sumHumPond / totalKg).toFixed(1) : "14.0";
    const pctCarga = Math.min(100, (totalKg / capacidadMaximaKg) * 100);
    return {
      count: lots.length,
      totalSacos,
      totalKg,
      totalTn,
      humProm,
      pctCarga
    };
  }, [selectedLoteIdsInArmador, lotes, analisisHumedos]);

  // Handlers para selección masiva en la Matriz del Armador
  const handleToggleSelectLoteArmador = (loteId: string) => {
    setSelectedLoteIdsInArmador(prev =>
      prev.includes(loteId) ? prev.filter(id => id !== loteId) : [...prev, loteId]
    );
  };

  const handleToggleSelectAllArmador = () => {
    const lotesSeleccionables = lotesSelectorFiltrados.filter(l => {
      const yaAgregadoEnEste = filasLote.some(f => f.loteId.trim().toLowerCase() === l.LOTE_ID.trim().toLowerCase());
      const infoBatch = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);
      const yaEnOtroBatch = infoBatch.estaProgramado && !infoBatch.esMismoBatch;
      const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").toLowerCase() === (l.LOTE_ID || "").toLowerCase());
      const aptitud = verificarAptitudProgramacionLote(l, ah);
      return !yaAgregadoEnEste && !yaEnOtroBatch && aptitud.esProgramable;
    });

    if (selectedLoteIdsInArmador.length === lotesSeleccionables.length && lotesSeleccionables.length > 0) {
      setSelectedLoteIdsInArmador([]);
    } else {
      setSelectedLoteIdsInArmador(lotesSeleccionables.map(l => l.LOTE_ID));
    }
  };

  const handleCargarSeleccionadosAlBatchArmador = () => {
    if (selectedLoteIdsInArmador.length === 0) return;
    let agregadosCount = 0;
    for (const lid of selectedLoteIdsInArmador) {
      if (!filasLote.some(f => f.loteId.trim().toLowerCase() === lid.trim().toLowerCase())) {
        handleAgregarLoteAlBatch(lid);
        agregadosCount++;
      }
    }
    setSelectedLoteIdsInArmador([]);
    setNotifMensaje(`✨ ${agregadosCount} lote(s) agregados a la formulación del Batch.`);
    setTimeout(() => setNotifMensaje(null), 3500);
  };

  // Recommended parameters from IA / Rules
  const parametrosRecomendados = useMemo(() => {
    return recomendarParametrosOperativos(liveCalculos.promedios, variedadPrincipal);
  }, [liveCalculos.promedios, variedadPrincipal]);

  // Update determined parameters when recommended changes (unless user explicitly edited)
  const aplicarRecomendacionIA = () => {
    setPresionDet(parametrosRecomendados.presionBar);
    setVelExclDet(parametrosRecomendados.velExclusa);
    setTiempoReposoDet(parametrosRecomendados.tiempoReposoMin);
    setTempSecadoDet(parametrosRecomendados.tempSecadoC);

    if (parametrosRecomendados.modalidadPases) {
      setModalidadPasesDet(parametrosRecomendados.modalidadPases);
    }
    setPresionPase1Det(parametrosRecomendados.presionPase1 ?? (parametrosRecomendados.presionBar <= 0.35 ? parametrosRecomendados.presionBar : Number((parametrosRecomendados.presionBar - 0.05).toFixed(2))));
    setPresionPase2Det(parametrosRecomendados.presionPase2 ?? parametrosRecomendados.presionBar);
    setTiempoReposoPase1Det(parametrosRecomendados.tiempoReposoPase1 ?? 10);
    setTiempoReposoPase2Det(parametrosRecomendados.tiempoReposoPase2 ?? parametrosRecomendados.tiempoReposoMin);
    setVelExclPase1Det(parametrosRecomendados.velExclusaPase1 ?? parametrosRecomendados.velExclusa);
    setVelExclPase2Det(parametrosRecomendados.velExclusaPase2 ?? parametrosRecomendados.velExclusa);

    setNotifMensaje(`⚡ Parámetros sugeridos por la IA (${parametrosRecomendados.modalidadPases || "1_PASE"}) aplicados a la determinación de trabajo.`);
    setTimeout(() => setNotifMensaje(null), 3500);
  };

  // Open builder for a brand new batch - Espacios Vacíos
  const handleIniciarNuevoBatch = () => {
    const existentes = [
      ...(programaciones || []).map(p => p.batch),
      ...(batches || []).map(b => b.CORRELATIVO || b.BATCH_ID)
    ];
    const nextV = generarSiguienteCorrelativoV(existentes);

    setEditingProgId(null);
    setCasoNombre(`Batch ${nextV}`);
    setFechaProg(new Date().toISOString().split("T")[0]);
    setTurnoProg("DIA");
    setBatchCorrelativo(nextV);
    setFilasLote([]); // Espacios vacíos: no precargar con uno predeterminado
    setSelectedLoteIdsInArmador([]);
    setObservacionProg("");
    setPresionDet(0.35);
    setVelExclDet(4);
    setTiempoReposoDet(60);
    setTempSecadoDet(75);
    setModalidadPasesDet("1_PASE");
    setPresionPase1Det(0.35);
    setPresionPase2Det(0.40);
    setTiempoReposoPase1Det(10);
    setTiempoReposoPase2Det(60);
    setVelExclPase1Det(4);
    setVelExclPase2Det(4);
    setViewMode("armador");

    setNotifMensaje(`✨ Armador Oficial V200 listo para nuevo Batch ${nextV} (Espacios vacíos).`);
    setTimeout(() => setNotifMensaje(null), 3500);
  };

  // Add lot to current builder with interactive validations (Single client + deviation tolerances + NO REPETICIÓN)
  const handleAgregarLoteAlBatch = (loteId: string) => {
    // 0.1 REGLA ESTRICTA: NO REPETIR DENTRO DEL MISMO BATCH
    if (filasLote.some(f => f.loteId.trim().toLowerCase() === (loteId || "").trim().toLowerCase())) {
      setDialogModal({
        isOpen: true,
        tipo: "info",
        titulo: "🚫 Lote Ya Incluido en este Batch",
        mensaje: `El lote ${loteId} ya se encuentra asignado a la mezcla de este Batch. Los lotes no se pueden repetir dentro de un mismo batch.`,
        textoBotonPrincipal: "Entendido",
        onConfirmar: () => setDialogModal(null)
      });
      return;
    }

    // 0.2 REGLA ESTRICTA: NO REPETIR EN OTROS BATCHES (UN LOTE NO SE PUEDE REPETIR)
    const currentMacro = batchCorrelativo ? batchCorrelativo.split("-")[0] : null;
    const infoEnOtros = obtenerInfoLoteEnBatches(loteId, programaciones, batches, editingProgId, batchCorrelativo, currentMacro);
    if (infoEnOtros.estaProgramado && !infoEnOtros.esMismoBatch) {
      setDialogModal({
        isOpen: true,
        tipo: "error",
        titulo: "🚫 Lote Ya Programado (No se puede repetir)",
        mensaje: `El lote ${loteId} ya se encuentra comprometido en el Batch ${infoEnOtros.batchCodigo} (${infoEnOtros.caso}).`,
        detalles: [
          `Por normativa estricta de planta, los lotes NO se pueden repetir en distintos batches ni programar por duplicado.`,
          `Fecha de programación original: ${infoEnOtros.fecha || "No especificada"}`
        ],
        textoBotonPrincipal: "Entendido",
        onConfirmar: () => setDialogModal(null)
      });
      return;
    }

    // 0.3 REGLA ESTRICTA: RESERVA EXCLUSIVA DE SALDOS DE UNIÓN
    // "Los saldos de cada código solo debe unirse con los que se seleccionó que van a juntarse"
    const bObjUnion = batches.find(b => Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.includes(loteId));
    if (bObjUnion && Array.isArray(bObjUnion.LOTES_UNION) && bObjUnion.LOTES_UNION.length > 0) {
      const lotesPermitidos = bObjUnion.LOTES_UNION;
      const macroNombre = bObjUnion.PROCESO_PADRE || (bObjUnion.CORRELATIVO ? bObjUnion.CORRELATIVO.split("-")[0] : "V200");
      
      const lotesAjenosEnBatch = filasLote
        .map(f => f.loteId)
        .filter(lid => !lotesPermitidos.includes(lid));

      if (lotesAjenosEnBatch.length > 0) {
        setDialogModal({
          isOpen: true,
          tipo: "error",
          titulo: "🚫 Restricción Exclusiva de Saldo de Unión",
          mensaje: `El código ${loteId} pertenece al proceso de unión ${macroNombre} y su saldo restante está reservado EXCLUSIVAMENTE para combinarse con los códigos [${lotesPermitidos.join(", ")}].`,
          detalles: [
            `El batch actual contiene códigos no autorizados para esta unión: ${lotesAjenosEnBatch.join(", ")}.`,
            `Norma estricta de planta: Los saldos de cada código solo deben unirse con los que se seleccionó que van a juntarse.`
          ],
          textoBotonPrincipal: "Entendido",
          onConfirmar: () => setDialogModal(null)
        });
        return;
      }
    }

    for (const f of filasLote) {
      const bUnion = batches.find(b => Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.includes(f.loteId));
      if (bUnion && Array.isArray(bUnion.LOTES_UNION) && !bUnion.LOTES_UNION.includes(loteId)) {
        setDialogModal({
          isOpen: true,
          tipo: "error",
          titulo: "🚫 Restricción Exclusiva de Saldo de Unión",
          mensaje: `No se puede agregar el lote ${loteId}. El batch contiene el lote ${f.loteId} cuyo saldo está reservado EXCLUSIVAMENTE para combinarse con [${bUnion.LOTES_UNION.join(", ")}].`,
          detalles: [
            `Norma estricta de planta: Los saldos de cada código solo deben unirse con los que se seleccionó que van a juntarse.`
          ],
          textoBotonPrincipal: "Entendido",
          onConfirmar: () => setDialogModal(null)
        });
        return;
      }
    }

    const cleanId = (loteId || "").trim().toLowerCase();
    const loteObj = lotes.find(l => {
      const lid = (l.LOTE_ID || (l as any).loteId || (l as any).id || "").trim().toLowerCase();
      return lid === cleanId;
    }) || {
      LOTE_ID: loteId,
      CLIENTE: "MOLINO CENTRAL NORTE",
      VARIEDAD: "TINAJONES",
      SACOS: 320,
      PESO_KG: 16000,
      HUM: 14.0
    } as any;

    const ah = analisisHumedos.find(a => (a.LOTE_ID || "").toLowerCase() === cleanId);
    const ps = presecados.find(p => (p.LOTE_ID || "").toLowerCase() === cleanId);
    const defaults = extraerDatosCalidadLote(loteObj, ah, ps);
    const clienteLote = defaults.cliente || loteObj.CLIENTE || "Cliente";

    // 0. REGLA ESTRICTA DE PLANTA: SOLO LOTES APROBADOS (APTOS) Y OBSERVADOS
    const aptitud = verificarAptitudProgramacionLote(loteObj, ah);
    if (!aptitud.esProgramable) {
      setDialogModal({
        isOpen: true,
        tipo: "error",
        titulo: "🚫 Lote Bloqueado por Calidad (No Programable)",
        mensaje: `Por normativa de control de calidad, SOLO se pueden programar lotes APROBADOS (Aptos) u OBSERVADOS.`,
        detalles: [
          `Lote: ${loteId} — Estado: ${aptitud.label}`,
          aptitud.motivoBloqueo || "El lote se encuentra rechazado o con parámetros fuera de los límites técnicos admisibles."
        ],
        textoBotonPrincipal: "Entendido",
        onConfirmar: () => setDialogModal(null)
      });
      return;
    }

    // 1. REGLA ESTRICTA DE UN SOLO CLIENTE
    if (filasLote.length > 0 && criteriosUnion.exigirMismoCliente) {
      const cliBatch = clientePrincipal.trim().toLowerCase();
      const cliNuevo = clienteLote.trim().toLowerCase();

      if (cliBatch !== "sin cliente" && cliNuevo !== cliBatch) {
        setDialogModal({
          isOpen: true,
          tipo: "error",
          titulo: "Incompatibilidad de Cliente",
          mensaje: `Todos los lotes de un Batch deben pertenecer a UN SOLO CLIENTE.`,
          detalles: [
            `Cliente asignado al Batch: "${clientePrincipal}"`,
            `Cliente del lote seleccionado (${loteId}): "${clienteLote}"`
          ],
          textoBotonPrincipal: "Entendido",
          onConfirmar: () => setDialogModal(null)
        });
        return;
      }
    }

    // 1.1 REGLA DE MISMA VARIEDAD (Salvo que esté catalogada como MEZCLA)
    if (filasLote.length > 0 && criteriosUnion.exigirMismaVariedad) {
      const varBatch = (variedadPrincipal || "").trim().toLowerCase();
      const varNuevo = (defaults.variedad || loteObj.VARIEDAD || "").trim().toLowerCase();
      const esMezclaBatch = varBatch.includes("mezcla") || varBatch.includes("mix");
      const esMezclaNuevo = varNuevo.includes("mezcla") || varNuevo.includes("mix");

      if (varBatch && varNuevo && varBatch !== varNuevo && !esMezclaBatch && !esMezclaNuevo) {
        setDialogModal({
          isOpen: true,
          tipo: "warning",
          titulo: "Incompatibilidad de Variedad",
          mensaje: `No se permite mezclar variedades distintas en un mismo Batch salvo que la variedad esté descrita como MEZCLA.`,
          detalles: [
            `Variedad predominante del Batch: "${variedadPrincipal}"`,
            `Variedad del lote seleccionado (${loteId}): "${defaults.variedad || loteObj.VARIEDAD}"`
          ],
          textoBotonPrincipal: "Marcar como MEZCLA y Agregar",
          textoBotonSecundario: "Cancelar",
          onConfirmar: () => {
            setDialogModal(null);
            insertarFilaLote(loteId, loteObj, ah, ps, defaults, clienteLote, "MEZCLA");
          },
          onSecundario: () => setDialogModal(null)
        });
        return;
      }
    }

    // 2. VALIDACIÓN DE DESVIACIONES CON RESPECTO AL PROMEDIO
    if (filasLote.length > 0) {
      const evalCandidato = evaluarCandidatoParaBatch(loteObj, ah, ps, filasLote, criteriosUnion);
      if (!evalCandidato.esApto && evalCandidato.parametrosCriticosExcedidos.length > 0) {
        setDialogModal({
          isOpen: true,
          tipo: "confirm-deviation",
          titulo: "⚠️ Alerta de Tolerancia de Mezcla",
          mensaje: `Al unir el lote ${loteId} (${clienteLote}), se superan los límites permitidos de desviación respecto al promedio del batch:`,
          detalles: evalCandidato.parametrosCriticosExcedidos,
          textoBotonPrincipal: "Agregar Bajo Aprobación Técnica",
          textoBotonSecundario: "Cancelar",
          onConfirmar: () => {
            setDialogModal(null);
            insertarFilaLote(loteId, loteObj, ah, ps, defaults, clienteLote);
          },
          onSecundario: () => setDialogModal(null)
        });
        return;
      }
    }

    insertarFilaLote(loteId, loteObj, ah, ps, defaults, clienteLote);
  };

  const insertarFilaLote = (
    loteId: string, 
    loteObj: Lote, 
    ah?: AnalisisHumedo, 
    ps?: Presecado, 
    defaults?: any, 
    clienteLote?: string,
    variedadOverride?: string
  ) => {
    // Como referencia inicial toma el saldo disponible real descontando otros batches
    const cleanLoteId = defaults?.loteId || loteId;
    const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
      cleanLoteId,
      lotes,
      programaciones,
      batches,
      batchLotes,
      editingProgId,
      batchCorrelativo
    );
    const sacosDisponibles = saldoInfo.sacosDisponibles;
    const pesoDisponibleKg = saldoInfo.pesoDisponibleKg;

    const sacosOriginal = sacosDisponibles;
    const pesoOriginal = pesoDisponibleKg;

    const sacProg = defaults?.sacProg !== undefined ? Math.min(Number(defaults.sacProg), sacosDisponibles) : sacosDisponibles;
    const pesoProg = defaults?.pesoProg !== undefined ? Math.min(Number(defaults.pesoProg), pesoDisponibleKg) : pesoDisponibleKg;

    const nuevaFila: LoteProgramacionFila = {
      loteId: defaults?.loteId || loteId,
      cliente: clienteLote || defaults?.cliente || "Cliente",
      variedad: variedadOverride || defaults?.variedad || "TINAJONES",
      sacos: sacosOriginal,
      peso: pesoOriginal,
      sacProg,
      pesoProg,
      ph: defaults?.ph || 14.0,
      desv: defaults?.desv || 1.2,
      blInt: defaults?.blInt || 21.5,
      blBlanco: defaults?.blBlanco || 39.0,
      qi: defaults?.qi || 7.5,
      qb: defaults?.qb || 15.5,
      tt: defaults?.tt || 1.5,
      tp: defaults?.tp || 2.5,
      tpun: defaults?.tpun || 4.5,
      m: defaults?.m || 0.8,
      triz: defaults?.triz || 1.8,
      condicion: defaults?.condicion || "APTO"
    };

    setFilasLote(prev => [...prev, nuevaFila]);
  };

  // Remove lot from builder
  const handleQuitarFilaLote = (loteId: string) => {
    setFilasLote(prev => prev.filter(f => f.loteId !== loteId));
  };

  // Update lot row values in builder with strict validation: sacProg <= saldoDisponibleSacos, pesoProg <= saldoDisponibleKg
  const handleActualizarFilaLote = (loteId: string, updates: Partial<LoteProgramacionFila>) => {
    setFilasLote(prev => prev.map(f => {
      if (f.loteId === loteId) {
        const next = { ...f, ...updates };
        const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
          f.loteId,
          lotes,
          programaciones,
          batches,
          batchLotes,
          editingProgId,
          batchCorrelativo
        );
        const maxSacos = saldoInfo.sacosDisponibles;
        const maxPeso = saldoInfo.pesoDisponibleKg;

        if (updates.sacProg !== undefined && updates.pesoProg === undefined) {
          let sVal = Math.max(0, updates.sacProg);
          if (sVal > maxSacos) {
            sVal = maxSacos;
            const detalleStr = saldoInfo.detalleUso.length > 0
              ? ` (ya se registraron ${saldoInfo.detalleUso.map(u => `${u.sacos} en ${u.batch}`).join(", ")})`
              : "";
            setNotifMensaje(`⚠️ Solo quedan ${maxSacos} sacos disponibles para el lote ${f.loteId}${detalleStr}. No se puede colocar ${updates.sacProg} sacos.`);
            setTimeout(() => setNotifMensaje(null), 5000);
          }
          next.sacProg = sVal;
          const ratio = (f.peso > 0 && f.sacos > 0) ? (f.peso / f.sacos) : 50;
          next.pesoProg = Math.min(Math.round(sVal * ratio), maxPeso);
        } else if (updates.pesoProg !== undefined && updates.sacProg === undefined) {
          let pVal = Math.max(0, updates.pesoProg);
          if (pVal > maxPeso) {
            pVal = maxPeso;
            const detalleStr = saldoInfo.detalleUso.length > 0
              ? ` (ya se registraron ${saldoInfo.detalleUso.map(u => `${u.sacos} en ${u.batch}`).join(", ")})`
              : "";
            setNotifMensaje(`⚠️ El peso programado (${updates.pesoProg.toLocaleString()} kg) excede el saldo disponible de ${maxPeso.toLocaleString()} kg para el lote ${f.loteId}${detalleStr}.`);
            setTimeout(() => setNotifMensaje(null), 5000);
          }
          next.pesoProg = pVal;
          const ratio = (f.peso > 0 && f.sacos > 0) ? (f.peso / f.sacos) : 50;
          next.sacProg = Math.min(Math.round(pVal / ratio), maxSacos);
        }
        return next;
      }
      return f;
    }));
  };

  // Auto-fill batch to exactly 35,000 kg with matching lots in priority order without exceeding ingress limits
  const handleAutoLlenar35TN = () => {
    if (lotesDisponibles.length === 0) {
      setNotifMensaje("No hay lotes disponibles en el sistema.");
      setTimeout(() => setNotifMensaje(null), 3000);
      return;
    }

    let clienteObjetivo = filasLote.length > 0 && clientePrincipal !== "Sin Cliente" 
      ? clientePrincipal 
      : (lotesDisponibles[0].CLIENTE || "MOLINO CENTRAL");

    let lotesCandidatos = lotesDisponibles.filter(l => {
      const cli = (l.CLIENTE || "").trim().toLowerCase();
      const ah = analisisHumedos.find(a => a.LOTE_ID === l.LOTE_ID);
      const aptitud = verificarAptitudProgramacionLote(l, ah);
      const batchInfo = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);

      return (
        aptitud.esProgramable &&
        cli === clienteObjetivo.trim().toLowerCase() &&
        !filasLote.some(f => f.loteId === l.LOTE_ID) &&
        (!batchInfo.estaProgramado || batchInfo.esMismoBatch)
      );
    });

    if (lotesCandidatos.length === 0 && filasLote.length === 0) {
      // Find first client with available lots in priority order
      const primerLote = lotesDisponibles.find(l => {
        const ah = analisisHumedos.find(a => a.LOTE_ID === l.LOTE_ID);
        const aptitud = verificarAptitudProgramacionLote(l, ah);
        const batchInfo = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);
        return (
          aptitud.esProgramable &&
          !filasLote.some(f => f.loteId === l.LOTE_ID) &&
          (!batchInfo.estaProgramado || batchInfo.esMismoBatch)
        );
      });

      if (primerLote) {
        clienteObjetivo = primerLote.CLIENTE || "MOLINO CENTRAL";
        lotesCandidatos = lotesDisponibles.filter(l => {
          const cli = (l.CLIENTE || "").trim().toLowerCase();
          const ah = analisisHumedos.find(a => a.LOTE_ID === l.LOTE_ID);
          const aptitud = verificarAptitudProgramacionLote(l, ah);
          const batchInfo = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);
          return (
            aptitud.esProgramable &&
            cli === clienteObjetivo.trim().toLowerCase() &&
            !filasLote.some(f => f.loteId === l.LOTE_ID) &&
            (!batchInfo.estaProgramado || batchInfo.esMismoBatch)
          );
        });
      }
    }

    if (lotesCandidatos.length === 0) {
      setNotifMensaje(`No se encontraron lotes adicionales disponibles para el cliente ${clienteObjetivo}.`);
      setTimeout(() => setNotifMensaje(null), 3000);
      return;
    }

    let pesoAcumulado = filasLote.reduce((s, f) => s + f.pesoProg, 0);
    const nuevasFilas: LoteProgramacionFila[] = [...filasLote];

    for (const loteObj of lotesCandidatos) {
      if (pesoAcumulado >= capacidadMaximaKg) break;
      const ah = analisisHumedos.find(a => a.LOTE_ID === loteObj.LOTE_ID);
      const ps = presecados.find(p => p.LOTE_ID === loteObj.LOTE_ID);
      const defaults = extraerDatosCalidadLote(loteObj, ah, ps);

      const sacosOriginal = loteObj.SACOS || 320;
      const pesoOriginal = loteObj.PESO_KG || sacosOriginal * 50;
      const espacioDisponible = Math.max(0, capacidadMaximaKg - pesoAcumulado);

      // Nunca exceder los sacos o peso de ingreso del lote
      const pesoProg = Math.min(pesoOriginal, espacioDisponible > 0 ? espacioDisponible : pesoOriginal);
      const sacProg = Math.min(Math.round(pesoProg / (pesoOriginal / sacosOriginal || 50)), sacosOriginal);
      pesoAcumulado += pesoProg;

      nuevasFilas.push({
        loteId: defaults.loteId || loteObj.LOTE_ID,
        cliente: defaults.cliente || loteObj.CLIENTE || clienteObjetivo,
        variedad: defaults.variedad || loteObj.VARIEDAD || "TINAJONES",
        sacos: sacosOriginal,
        peso: pesoOriginal,
        sacProg,
        pesoProg,
        ph: defaults.ph || 14.0,
        desv: defaults.desv || 1.2,
        blInt: defaults.blInt || 21.5,
        blBlanco: defaults.blBlanco || 39.0,
        qi: defaults.qi || 7.5,
        qb: defaults.qb || 15.5,
        tt: defaults.tt || 1.5,
        tp: defaults.tp || 2.5,
        tpun: defaults.tpun || 4.5,
        m: defaults.m || 0.8,
        triz: defaults.triz || 1.8,
        condicion: defaults.condicion || "APTO"
      });
    }

    // Adjust rows to hit capacidadMaximaKg if needed, without ever exceeding lot capacity
    if (nuevasFilas.length > 0) {
      let totalActual = nuevasFilas.reduce((s, f) => s + f.pesoProg, 0);
      for (const fila of nuevasFilas) {
        if (totalActual >= capacidadMaximaKg) break;
        const margenPeso = Math.max(0, fila.peso - fila.pesoProg);
        if (margenPeso > 0) {
          const incremento = Math.min(margenPeso, capacidadMaximaKg - totalActual);
          fila.pesoProg += incremento;
          const ratio = (fila.peso > 0 && fila.sacos > 0) ? (fila.peso / fila.sacos) : 50;
          fila.sacProg = Math.min(Math.round(fila.pesoProg / ratio), fila.sacos);
          totalActual += incremento;
        }
      }
    }

    setFilasLote(nuevasFilas);
    setNotifMensaje(`✅ Batch auto-completado con ${nuevasFilas.length} lote(s) para un total de ${nuevasFilas.reduce((s, f) => s + f.pesoProg, 0).toLocaleString()} kg.`);
    setTimeout(() => setNotifMensaje(null), 4000);
  };

  // Reset lots to ANALIZADO state for continuous testing
  const handleResetLotesPruebas = async () => {
    try {
      localDB.bulkUpdateLotesStatus(lotes.map(l => l.LOTE_ID), "ANALIZADO");
      setNotifMensaje("🔄 Todos los lotes han sido restablecidos a estado ANALIZADO (Disponibles).");
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.warn("Error restableciendo lotes:", e);
    }
  };

  // Save batch programming into master list and transition lots to EN PROCESO
  const handleGuardarProgramacion = async (permitirDesviacionForzadaArg?: boolean | any) => {
    const forzar = typeof permitirDesviacionForzadaArg === "boolean" ? permitirDesviacionForzadaArg : false;

    if (filasLote.length === 0) {
      setDialogModal({
        isOpen: true,
        tipo: "warning",
        titulo: "Batch Vacío",
        mensaje: "Debe incluir al menos 1 lote en la mezcla para programar el Batch.",
        textoBotonPrincipal: "Entendido",
        onConfirmar: () => setDialogModal(null)
      });
      return;
    }

    // 0. REGLA ESTRICTA: LOS LOTES NO SE PUEDEN REPETIR
    // 0.1 Duplicados en este mismo batch
    const lotesEnBatch = filasLote.map(f => (f.loteId || "").trim().toLowerCase());
    const duplicados = lotesEnBatch.filter((id, idx) => lotesEnBatch.indexOf(id) !== idx);
    if (duplicados.length > 0) {
      setDialogModal({
        isOpen: true,
        tipo: "error",
        titulo: "🚫 Lotes Repetidos en el Batch",
        mensaje: `No se permite repetir lotes dentro de la misma mezcla. Se detectaron registros duplicados para el lote: ${Array.from(new Set(duplicados)).join(", ")}.`,
        textoBotonPrincipal: "Entendido",
        onConfirmar: () => setDialogModal(null)
      });
      return;
    }

    // 0.2 Asignados previamente a otros batches
    const lotesEnOtrosBatches: string[] = [];
    for (const f of filasLote) {
      const info = obtenerInfoLoteEnBatches(f.loteId, programaciones, batches, editingProgId, batchCorrelativo);
      if (info.estaProgramado && !info.esMismoBatch) {
        lotesEnOtrosBatches.push(`• Lote ${f.loteId}: asignado a Batch ${info.batchCodigo} (${info.caso})`);
      }
    }
    if (lotesEnOtrosBatches.length > 0) {
      setDialogModal({
        isOpen: true,
        tipo: "error",
        titulo: "🚫 Lotes Ya Programados (No se pueden repetir)",
        mensaje: `Los siguientes lotes ya se encuentran asignados a otros batches activos y no se pueden repetir:`,
        detalles: lotesEnOtrosBatches,
        textoBotonPrincipal: "Entendido",
        onConfirmar: () => setDialogModal(null)
      });
      return;
    }

    // 1. Validar regla de Un Solo Cliente
    if (!evaluacionMezcla.mismoCliente) {
      const clientesEncontrados = Array.from(new Set(filasLote.map(f => f.cliente)));
      setDialogModal({
        isOpen: true,
        tipo: "error",
        titulo: "Incompatibilidad de Clientes",
        mensaje: `Todos los lotes del batch deben pertenecer al mismo cliente. Se detectaron ${clientesEncontrados.length} clientes distintos.`,
        detalles: clientesEncontrados.map(c => `• Cliente: ${c}`),
        textoBotonPrincipal: `Dejar Solo Lotes de ${clientePrincipal}`,
        textoBotonSecundario: "Cancelar",
        onConfirmar: () => {
          setFilasLote(prev => prev.filter(f => f.cliente.trim().toLowerCase() === clientePrincipal.trim().toLowerCase()));
          setDialogModal(null);
        },
        onSecundario: () => setDialogModal(null)
      });
      return;
    }

    // 2. Validar regla de Misma Variedad (Salvo que esté explícitamente catalogada como MEZCLA)
    if (!evaluacionMezcla.variedadValida) {
      const variedades: string[] = Array.from(new Set(filasLote.map(f => (f.variedad || "").trim())));
      setDialogModal({
        isOpen: true,
        tipo: "warning",
        titulo: "Incompatibilidad de Variedades",
        mensaje: `No se permite mezclar variedades distintas (${variedades.join(", ")}), a menos que la variedad esté explícitamente marcada como MEZCLA.`,
        detalles: [
          `Variedades detectadas: ${variedades.join(", ")}`,
          `Para permitir la unión, se puede catalogar la variedad de este batch como "MEZCLA".`
        ],
        textoBotonPrincipal: "Marcar como MEZCLA y Guardar",
        textoBotonSecundario: "Cancelar",
        onConfirmar: () => {
          setFilasLote(prev => prev.map(f => ({ ...f, variedad: "MEZCLA" })));
          setDialogModal(null);
          // Re-trigger save with MEZCLA
          setTimeout(() => handleGuardarProgramacion(forzar), 100);
        },
        onSecundario: () => setDialogModal(null)
      });
      return;
    }

    // 3. Validar Uniformidad de Parámetros según Desviaciones Permitidas
    if (!forzar && (evaluacionMezcla.bloqueadoPorDesviaciones || evaluacionMezcla.resumenParametros.some(r => !r.cumple))) {
      const paramsIncumplidos = evaluacionMezcla.resumenParametros
        .filter(r => !r.cumple)
        .map(r => `${r.label}: Desv. = ${r.maxDesviacion}${r.unidad} (Tolerancia: ±${r.tolerancia}${r.unidad}) - Promedio: ${r.promedio}${r.unidad}`);

      setDialogModal({
        isOpen: true,
        tipo: "confirm-deviation",
        titulo: "⚠️ Aprobación de Desviaciones de Planta",
        mensaje: "Los siguientes parámetros superan las tolerancias estándar de homogeneidad con respecto al promedio del batch:",
        detalles: paramsIncumplidos,
        textoBotonPrincipal: "⚡ Guardar con Aprobación Técnica (Estado OBSERVADO)",
        textoBotonSecundario: "Cancelar y Ajustar",
        onConfirmar: () => {
          setDialogModal(null);
          handleGuardarProgramacion(true);
        },
        onSecundario: () => setDialogModal(null)
      });
      return;
    }

    // REGLA CRÍTICA DE PLANTA: Los sacos programados no pueden exceder los sacos disponibles (saldo restante)
    const validacionSacos = validarSacosYPesoLotesProgramacion(
      filasLote,
      lotes,
      programaciones,
      batches,
      batchLotes,
      editingProgId,
      batchCorrelativo
    );
    if (!validacionSacos.valido) {
      setNotifMensaje(`🚫 ${validacionSacos.errores[0].mensaje}`);
      setTimeout(() => setNotifMensaje(null), 6000);
      return;
    }

    const { totalSacosProg, pesoTotalKg, promedios } = liveCalculos;

    if (!forzar && pesoTotalKg > capacidadExcepcionalKg) {
      setDialogModal({
        isOpen: true,
        tipo: "confirm-weight",
        titulo: "Carga Superior a Capacidad Máxima Excepcional",
        mensaje: `El peso total (${pesoTotalKg.toLocaleString()} kg) excede la capacidad máxima excepcional de la planta (${capacidadExcepcionalKg.toLocaleString()} kg). La capacidad nominal estándar es de ${capacidadMaximaKg.toLocaleString()} kg. ¿Desea forzar el guardado como carga fuera de rango operativo?`,
        textoBotonPrincipal: "Sí, Guardar como Excepcional",
        textoBotonSecundario: "Cancelar y Ajustar",
        onConfirmar: () => {
          setDialogModal(null);
          handleGuardarProgramacion(true);
        },
        onSecundario: () => setDialogModal(null)
      });
      return;
    }

    if (!forzar && pesoTotalKg < capacidadMinimaKg && pesoTotalKg > 0) {
      setDialogModal({
        isOpen: true,
        tipo: "confirm-weight",
        titulo: "Carga Inferior al Mínimo Operativo",
        mensaje: `El peso total (${pesoTotalKg.toLocaleString()} kg) es menor a la capacidad mínima operativa de secado (${capacidadMinimaKg.toLocaleString()} kg). ¿Desea guardar el batch con carga reducida?`,
        textoBotonPrincipal: "Sí, Guardar Carga Reducida",
        textoBotonSecundario: "Cancelar y Ajustar",
        onConfirmar: () => {
          setDialogModal(null);
          handleGuardarProgramacion(true);
        },
        onSecundario: () => setDialogModal(null)
      });
      return;
    }

    setIsSaving(true);

    const progObj: ProgramacionBatchOficial = {
      id: editingProgId || `PROG-BATCH-${Date.now()}`,
      caso: casoNombre.trim() || batchCorrelativo || "Batch",
      fecha: fechaProg,
      turno: turnoProg,
      batch: batchCorrelativo,
      filasLote: filasLote.map(f => ({ ...f })),
      clientePrincipal,
      variedadPrincipal,
      totalSacosProg,
      pesoTotalKg,
      promedios,
      parametrosRecomendadosIA: { ...parametrosRecomendados },
      parametrosDeterminados: {
        modalidadPases: modalidadPasesDet,
        presionBar: modalidadPasesDet === "2_PASES" ? presionPase2Det : presionDet,
        velExclusa: modalidadPasesDet === "2_PASES" ? velExclPase2Det : velExclDet,
        tiempoReposoMin: modalidadPasesDet === "2_PASES" ? tiempoReposoPase2Det : tiempoReposoDet,
        tempSecadoC: tempSecadoDet,
        presionPase1: presionPase1Det,
        presionPase2: presionPase2Det,
        tiempoReposoPase1: tiempoReposoPase1Det,
        tiempoReposoPase2: tiempoReposoPase2Det,
        velExclusaPase1: velExclPase1Det,
        velExclusaPase2: velExclPase2Det
      },
      observacion: observacionProg || (promedios.ph < 14.5 ? "LOTE CN HUMEDAD BAJA" : ""),
      estado: forzar ? "OBSERVADO" : "PROGRAMADO"
    };

    setProgramaciones(prev => {
      const idx = prev.findIndex(p => p.id === progObj.id || p.batch === progObj.batch);
      let next: ProgramacionBatchOficial[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = progObj;
      } else {
        next = [...prev, progObj];
      }
      guardarProgramacionesOficiales(next);
      return next;
    });

    const loteIdsProg = filasLote.map(f => f.loteId);

    try {
      // 1. Guardar en BD Local de Programaciones Oficiales
      localDB.saveProgramacionOficial(progObj);

      // 2. Guardar o actualizar en el backend de Batches
      if (onSaveBatch) {
        await onSaveBatch(
          {
            BATCH_ID: progObj.batch,
            CORRELATIVO: progObj.batch,
            FECHA_PROGRAMADA: progObj.fecha,
            EQUIPO: "APIT",
            TURNO: progObj.turno === "DIA" ? "Turno Día" : "Turno Noche",
            TON_PROGRAMADAS: Number((progObj.pesoTotalKg / 1000).toFixed(2)),
            PESO_TOTAL_KG: progObj.pesoTotalKg,
            ESTADO_BATCH: progObj.estado,
            OPERADOR: currentUser?.nombre || "Pedro Huamán",
            OBSERVACIONES: progObj.observacion,
            permitirDesviacion: forzar || progObj.estado === "OBSERVADO",
            forzarGuardado: forzar
          } as any,
          filasLote.map(f => ({
            LOTE_ID: f.loteId,
            SACOS: f.sacProg,
            PESO_KG: f.pesoProg,
            ESTADO: "PROGRAMADO"
          }))
        );
      } else {
        localDB.saveBatch(
          {
            BATCH_ID: progObj.batch,
            CORRELATIVO: progObj.batch,
            FECHA_PROGRAMADA: progObj.fecha,
            EQUIPO: "APIT",
            TURNO: progObj.turno === "DIA" ? "Turno Día" : "Turno Noche",
            TON_PROGRAMADAS: Number((progObj.pesoTotalKg / 1000).toFixed(2)),
            PESO_TOTAL_KG: progObj.pesoTotalKg,
            ESTADO_BATCH: progObj.estado,
            OPERADOR: currentUser?.nombre || "Pedro Huamán",
            OBSERVACIONES: progObj.observacion
          },
          filasLote.map(f => ({
            LOTE_ID: f.loteId,
            SACOS: f.sacProg,
            PESO_KG: f.pesoProg,
            ESTADO: "PROGRAMADO"
          })),
          forzar,
          currentUser?.nombre || "Operador"
        );
      }

      // 3. Asegurar que todos los lotes asignados pasen inmediatamente a estado "EN PROCESO"
      localDB.bulkUpdateLotesStatus(loteIdsProg, "EN PROCESO");

      await recargarProgramaciones();

      if (onRefreshData) {
        onRefreshData();
      }

      setNotifMensaje(`✅ Batch ${batchCorrelativo} (${casoNombre}) guardado exitosamente. ${loteIdsProg.length} lote(s) programados.`);
      setTimeout(() => setNotifMensaje(null), 4500);

      // Activar prompt modal para pasar inmediatamente a procesar si el usuario lo desea
      setBatchCreadoPrompt({
        batch: progObj.batch,
        caso: progObj.caso,
        kg: progObj.pesoTotalKg,
        sacos: progObj.totalSacosProg,
        lotesCount: loteIdsProg.length
      });

      setViewMode("resumen");
    } catch (e: any) {
      console.error("Error al sincronizar batch con backend:", e);
      const errMsg = e?.message || String(e);
      setDialogModal({
        isOpen: true,
        tipo: "error",
        titulo: "Error al Guardar Batch",
        mensaje: `No se pudo registrar el batch en el servidor: ${errMsg}`,
        textoBotonPrincipal: errMsg.toLowerCase().includes("uniformidad") || errMsg.toLowerCase().includes("desviaci") 
          ? "Forzar Guardado con Aprobación Técnica" 
          : "Cerrar",
        textoBotonSecundario: errMsg.toLowerCase().includes("uniformidad") || errMsg.toLowerCase().includes("desviaci")
          ? "Cancelar"
          : undefined,
        onConfirmar: () => {
          setDialogModal(null);
          if (errMsg.toLowerCase().includes("uniformidad") || errMsg.toLowerCase().includes("desviaci")) {
            handleGuardarProgramacion(true);
          }
        },
        onSecundario: () => setDialogModal(null)
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportarDesdeArmador = () => {
    if (filasLote.length === 0) {
      setNotifMensaje("⚠️ Agregue al menos un lote al batch para exportar la ficha.");
      return;
    }

    const { totalSacosProg, pesoTotalKg, promedios } = calcularPromediosPonderadosBatch(filasLote);
    const clientePrincipal = filasLote[0]?.cliente || "CLIENTE";
    const variedadPrincipal = filasLote[0]?.variedad || "VARIEDAD";

    const batchArmado: ProgramacionBatchOficial = {
      id: editingProgId || `TEMP-${Date.now()}`,
      caso: casoNombre.trim() || batchCorrelativo || "Batch",
      fecha: fechaProg,
      turno: turnoProg,
      batch: batchCorrelativo,
      filasLote: filasLote.map(f => ({ ...f })),
      clientePrincipal,
      variedadPrincipal,
      totalSacosProg,
      pesoTotalKg,
      promedios,
      parametrosRecomendadosIA: { ...parametrosRecomendados },
      parametrosDeterminados: {
        modalidadPases: modalidadPasesDet,
        presionBar: modalidadPasesDet === "2_PASES" ? presionPase2Det : presionDet,
        velExclusa: modalidadPasesDet === "2_PASES" ? velExclPase2Det : velExclDet,
        tiempoReposoMin: modalidadPasesDet === "2_PASES" ? tiempoReposoPase2Det : tiempoReposoDet,
        tempSecadoC: tempSecadoDet,
        presionPase1: presionPase1Det,
        presionPase2: presionPase2Det,
        tiempoReposoPase1: tiempoReposoPase1Det,
        tiempoReposoPase2: tiempoReposoPase2Det,
        velExclusaPase1: velExclPase1Det,
        velExclusaPase2: velExclPase2Det
      },
      observacion: observacionProg || (promedios.ph < 14.5 ? "LOTE CN HUMEDAD BAJA" : ""),
      estado: "PROGRAMADO"
    };

    handleAbrirExportacion(batchArmado);
  };

  // Edit existing batch
  const handleEditarBatch = (prog: ProgramacionBatchOficial) => {
    setEditingProgId(prog.id);
    setCasoNombre(prog.caso);
    setFechaProg(prog.fecha);
    setTurnoProg(prog.turno);
    setBatchCorrelativo(prog.batch);
    setFilasLote(prog.filasLote ? prog.filasLote.map(f => ({ ...f })) : []);
    setObservacionProg(prog.observacion || "");
    setPresionDet(prog.parametrosDeterminados?.presionBar ?? 0.35);
    setVelExclDet(prog.parametrosDeterminados?.velExclusa ?? 4);
    setTiempoReposoDet(prog.parametrosDeterminados?.tiempoReposoMin ?? 60);
    setTempSecadoDet(prog.parametrosDeterminados?.tempSecadoC ?? 75);

    // Cargar parámetros de 1° y 2° Pase
    const pDet = prog.parametrosDeterminados;
    setModalidadPasesDet(pDet?.modalidadPases || "1_PASE");
    setPresionPase1Det(pDet?.presionPase1 ?? (pDet?.presionBar && pDet.presionBar <= 0.35 ? pDet.presionBar : Number(((pDet?.presionBar ?? 0.40) - 0.05).toFixed(2))));
    setPresionPase2Det(pDet?.presionPase2 ?? (pDet?.presionBar ?? 0.40));
    setTiempoReposoPase1Det(pDet?.tiempoReposoPase1 ?? 10);
    setTiempoReposoPase2Det(pDet?.tiempoReposoPase2 ?? (pDet?.tiempoReposoMin ?? 60));
    setVelExclPase1Det(pDet?.velExclusaPase1 ?? (pDet?.velExclusa ?? 4));
    setVelExclPase2Det(pDet?.velExclusaPase2 ?? (pDet?.velExclusa ?? 4));

    setViewMode("armador");
    setNotifMensaje(`✏️ Modo de Edición activado para Batch ${prog.batch} (${prog.caso}). Realice los ajustes necesarios y presione "Guardar en Resumen Maestro".`);
    setTimeout(() => setNotifMensaje(null), 5000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Duplicate batch for next shift (e.g. V202-1 -> V202-2)
  const handleDuplicarParaSiguienteTurno = (prog: ProgramacionBatchOficial) => {
    const nextTurno: "DIA" | "NOCHE" = prog.turno === "DIA" ? "NOCHE" : "DIA";
    let nextBatch = `${prog.batch}-2`;
    if (prog.batch.includes("-1")) {
      nextBatch = prog.batch.replace("-1", "-2");
    } else if (prog.batch.includes("-2")) {
      nextBatch = prog.batch.replace("-2", "-3");
    }

    setEditingProgId(null);
    setCasoNombre(`${prog.caso} (PARTE 2)`);
    setFechaProg(prog.fecha);
    setTurnoProg(nextTurno);
    setBatchCorrelativo(nextBatch);
    setFilasLote(prog.filasLote.map(f => ({ ...f })));
    setObservacionProg(`Continuación Turno ${nextTurno}`);
    setPresionDet(prog.parametrosDeterminados?.presionBar ?? 0.40);
    setVelExclDet(prog.parametrosDeterminados?.velExclusa ?? 6);
    setTiempoReposoDet(prog.parametrosDeterminados?.tiempoReposoMin ?? 40);
    setTempSecadoDet(prog.parametrosDeterminados?.tempSecadoC ?? 80);

    const pDet = prog.parametrosDeterminados;
    setModalidadPasesDet(pDet?.modalidadPases || "1_PASE");
    setPresionPase1Det(pDet?.presionPase1 ?? (pDet?.presionBar && pDet.presionBar <= 0.35 ? pDet.presionBar : Number(((pDet?.presionBar ?? 0.40) - 0.05).toFixed(2))));
    setPresionPase2Det(pDet?.presionPase2 ?? (pDet?.presionBar ?? 0.40));
    setTiempoReposoPase1Det(pDet?.tiempoReposoPase1 ?? 10);
    setTiempoReposoPase2Det(pDet?.tiempoReposoPase2 ?? (pDet?.tiempoReposoMin ?? 40));
    setVelExclPase1Det(pDet?.velExclusaPase1 ?? (pDet?.velExclusa ?? 6));
    setVelExclPase2Det(pDet?.velExclusaPase2 ?? (pDet?.velExclusa ?? 6));

    setViewMode("armador");
    setNotifMensaje(`📑 Batch duplicado como ${nextBatch} (${prog.caso} PARTE 2) para el turno ${nextTurno}.`);
    setTimeout(() => setNotifMensaje(null), 4000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Quick edit modal handlers
  const handleAbrirEdicionRapida = (prog: ProgramacionBatchOficial) => {
    setBatchToQuickEdit(prog);
    const pDet = prog.parametrosDeterminados;
    setQuickEditData({
      caso: prog.caso,
      fecha: prog.fecha,
      turno: prog.turno,
      modalidadPases: pDet?.modalidadPases || "1_PASE",
      presionBar: pDet?.presionBar ?? 0.35,
      velExclusa: pDet?.velExclusa ?? 4,
      tiempoReposoMin: pDet?.tiempoReposoMin ?? 60,
      tempSecadoC: pDet?.tempSecadoC ?? 75,
      presionPase1: pDet?.presionPase1 ?? (pDet?.presionBar && pDet.presionBar <= 0.35 ? pDet.presionBar : Number(((pDet?.presionBar ?? 0.35) - 0.05).toFixed(2))),
      presionPase2: pDet?.presionPase2 ?? (pDet?.presionBar ?? 0.40),
      tiempoReposoPase1: pDet?.tiempoReposoPase1 ?? 10,
      tiempoReposoPase2: pDet?.tiempoReposoPase2 ?? (pDet?.tiempoReposoMin ?? 60),
      velExclusaPase1: pDet?.velExclusaPase1 ?? (pDet?.velExclusa ?? 4),
      velExclusaPase2: pDet?.velExclusaPase2 ?? (pDet?.velExclusa ?? 4),
      observacion: prog.observacion || ""
    });
  };

  const handleGuardarEdicionRapida = async () => {
    if (!batchToQuickEdit) return;

    const progActualizado: ProgramacionBatchOficial = {
      ...batchToQuickEdit,
      caso: quickEditData.caso,
      fecha: quickEditData.fecha,
      turno: quickEditData.turno,
      parametrosDeterminados: {
        modalidadPases: quickEditData.modalidadPases,
        presionBar: quickEditData.modalidadPases === "2_PASES" ? quickEditData.presionPase2 : quickEditData.presionBar,
        velExclusa: quickEditData.modalidadPases === "2_PASES" ? quickEditData.velExclusaPase2 : quickEditData.velExclusa,
        tiempoReposoMin: quickEditData.modalidadPases === "2_PASES" ? quickEditData.tiempoReposoPase2 : quickEditData.tiempoReposoMin,
        tempSecadoC: quickEditData.tempSecadoC,
        presionPase1: quickEditData.presionPase1,
        presionPase2: quickEditData.presionPase2,
        tiempoReposoPase1: quickEditData.tiempoReposoPase1,
        tiempoReposoPase2: quickEditData.tiempoReposoPase2,
        velExclusaPase1: quickEditData.velExclusaPase1,
        velExclusaPase2: quickEditData.velExclusaPase2
      },
      observacion: quickEditData.observacion
    };

    setProgramaciones(prev => {
      const idx = prev.findIndex(p => p.id === progActualizado.id || p.batch === progActualizado.batch);
      let next: ProgramacionBatchOficial[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = progActualizado;
      } else {
        next = [...prev, progActualizado];
      }
      guardarProgramacionesOficiales(next);
      return next;
    });

    try {
      localDB.updateBatch(progActualizado.batch, {
        FECHA_PROGRAMADA: progActualizado.fecha,
        TURNO: progActualizado.turno === "DIA" ? "Turno Día" : "Turno Noche",
        OBSERVACIONES: progActualizado.observacion
      }, currentUser?.nombre);
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (e) {
      console.warn("Error actualizando batch en localDB:", e);
    }

    setBatchToQuickEdit(null);
    setNotifMensaje(`✅ Batch ${progActualizado.batch} (${progActualizado.caso}) actualizado correctamente.`);
    setTimeout(() => setNotifMensaje(null), 4000);
  };

  // Delete batch (Modal trigger)
  const handleSolicitarEliminarBatch = (prog: ProgramacionBatchOficial) => {
    setBatchToDelete(prog);
  };

  // Execute deletion from modal
  const handleConfirmarEliminarBatch = async () => {
    if (!batchToDelete) return;
    const id = batchToDelete.id;
    const batchCode = batchToDelete.batch;
    const casoName = batchToDelete.caso || "Registro";
    const lotesInBatch = batchToDelete.filasLote?.map(f => f.loteId) || [];

    setIsDeleting(true);

    try {
      if (onDeleteBatch) {
        await onDeleteBatch(batchCode);
        if (id && id !== batchCode) {
          await onDeleteBatch(id);
        }
      } else {
        localDB.deleteBatch(batchCode);
        if (id && id !== batchCode) {
          localDB.deleteBatch(id);
        }
      }

      // 1. Remove from local state & localStorage only after successful validation
      setProgramaciones(prev => {
        const next = prev.filter(p => p.id !== id && p.batch !== id && p.batch !== batchCode);
        guardarProgramacionesOficiales(next);
        return next;
      });

      if (lotesInBatch.length > 0) {
        localDB.bulkUpdateLotesStatus(lotesInBatch, "ANALIZADO");
      }

      await recargarProgramaciones();

      if (onRefreshData) {
        onRefreshData();
      }

      setNotifMensaje(`🗑️ Batch ${batchCode} (${casoName}) eliminado exitosamente. ${lotesInBatch.length} lote(s) liberado(s) y disponibles en pendientes.`);
      setTimeout(() => setNotifMensaje(null), 5000);
      setBatchToDelete(null);
    } catch (e: any) {
      console.error("Error eliminando batch:", e);
      setNotifMensaje(`⚠️ ${e?.message || e}`);
      setTimeout(() => setNotifMensaje(null), 6000);
      setBatchToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV / Excel format
  const handleExportarExcelCSV = () => {
    const headers = [
      "FECHA", "TURNO", "BACHT", "LOTES", "CLIENTE", "VARIEDAD", 
      "SAC. PROG", "T.S. PROG", "PESO TOTAL", 
      "P(H)", "DESV. PROM", "BL.INT", "B. PULIDO", 
      "Q.I", "Q.B", "T.T", "T.P", "T.PUN", "M", "TRIZ", "CONDICION", 
      "DE.", "V. EXCL.", "T. REPOSO", "TEMP. SECADO", "OBSERVACION"
    ];

    const rows: string[][] = [];

    for (const prog of programaciones) {
      const lotesStr = prog.filasLote.map(f => f.loteId).join(" / ");
      const sacosStr = prog.filasLote.map(f => `${f.sacProg}`).join(" / ");

      rows.push([
        prog.fecha,
        prog.turno,
        prog.batch,
        `"${lotesStr}"`,
        `"${prog.clientePrincipal}"`,
        `"${prog.variedadPrincipal}"`,
        `"${sacosStr}"`,
        `${prog.totalSacosProg}`,
        `${prog.pesoTotalKg}`,
        `${prog.promedios.ph}`,
        `${prog.promedios.desv}`,
        `${prog.promedios.blInt}`,
        `${prog.promedios.blBlanco}`,
        `${prog.promedios.qi}`,
        `${prog.promedios.qb}`,
        `${prog.promedios.tt}`,
        `${prog.promedios.tp}`,
        `${prog.promedios.tpun}`,
        `${prog.promedios.m}`,
        `${prog.promedios.triz}`,
        prog.promedios.condicion,
        `${prog.parametrosDeterminados.presionBar}`,
        `${prog.parametrosDeterminados.velExclusa}`,
        `${prog.parametrosDeterminados.tiempoReposoMin} MIN`,
        `${prog.parametrosDeterminados.tempSecadoC}`,
        `"${prog.observacion || ""}"`
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "RESUMEN DE PROGRAMACION DE BATCH - FORMATO OFICIAL DE PLANTA\n\n"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Resumen_Programacion_Batches_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered master schedule
  const programacionesFiltradas = useMemo(() => {
    return programaciones.filter(p => {
      if (filtroTurno !== "TODOS" && p.turno !== filtroTurno) return false;
      if (filtroFecha && p.fecha !== filtroFecha) return false;
      if (busquedaLote) {
        const q = busquedaLote.toUpperCase();
        const coincideBatch = p.batch.toUpperCase().includes(q);
        const coincideCliente = p.clientePrincipal.toUpperCase().includes(q);
        const coincideLotes = p.filasLote.some(f => f.loteId.toUpperCase().includes(q));
        if (!coincideBatch && !coincideCliente && !coincideLotes) return false;
      }
      return true;
    });
  }, [programaciones, filtroTurno, filtroFecha, busquedaLote]);

  // Statistics for IA vs Real accuracy
  const metricasAcierto = useMemo(() => {
    let totalBatches = programaciones.length;
    let coincidenPresion = 0;
    let coincidenEsclusa = 0;
    let coincidenReposo = 0;
    let coincidenTemp = 0;

    for (const p of programaciones) {
      if (Math.abs(p.parametrosRecomendadosIA.presionBar - p.parametrosDeterminados.presionBar) < 0.05) coincidenPresion++;
      if (p.parametrosRecomendadosIA.velExclusa === p.parametrosDeterminados.velExclusa) coincidenEsclusa++;
      if (Math.abs(p.parametrosRecomendadosIA.tiempoReposoMin - p.parametrosDeterminados.tiempoReposoMin) <= 5) coincidenReposo++;
      if (Math.abs(p.parametrosRecomendadosIA.tempSecadoC - p.parametrosDeterminados.tempSecadoC) <= 2) coincidenTemp++;
    }

    const pctPresion = totalBatches > 0 ? Math.round((coincidenPresion / totalBatches) * 100) : 100;
    const pctEsclusa = totalBatches > 0 ? Math.round((coincidenEsclusa / totalBatches) * 100) : 100;
    const pctReposo = totalBatches > 0 ? Math.round((coincidenReposo / totalBatches) * 100) : 100;
    const pctTemp = totalBatches > 0 ? Math.round((coincidenTemp / totalBatches) * 100) : 100;
    const pctGlobal = Math.round((pctPresion + pctEsclusa + pctReposo + pctTemp) / 4);

    return {
      totalBatches,
      pctPresion,
      pctEsclusa,
      pctReposo,
      pctTemp,
      pctGlobal
    };
  }, [programaciones]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notifMensaje && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notifMensaje}</span>
          </div>
          <button onClick={() => setNotifMensaje(null)} className="text-emerald-400 hover:text-white text-sm">×</button>
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-750 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("resumen")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === "resumen"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Resumen Maestro de Programación (Sábana Oficial)</span>
          </button>

          <button
            id="btn-tab-armar-nuevo-batch"
            onClick={() => {
              if (editingProgId) {
                setViewMode("armador");
              } else {
                handleIniciarNuevoBatch();
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === "armador"
                ? "bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-300"
                : "bg-slate-800 text-slate-200 hover:bg-slate-750 hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>{editingProgId ? "Editar Batch en Curso" : "➕ Armar Nuevo Batch"}</span>
          </button>

          <button
            onClick={() => setViewMode("comparativa")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === "comparativa"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Calibración & Acierto IA vs Real ({metricasAcierto.pctGlobal}%)</span>
          </button>

          <button
            id="btn-tab-resultados-defectos-coccion"
            onClick={() => setViewMode("resultados")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === "resultados"
                ? "bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-300"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
            }`}
          >
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Resultados: Incrementos de Defectos & Cocción</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsParametrosModalOpen(true)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title={`Parámetros de Planta: Capacidad Máxima Nominal: ${(capacidadMaximaKg / 1000).toFixed(0)} TN. Haga clic para ajustar.`}
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>Parámetros Planta ({(capacidadMaximaKg / 1000).toFixed(0)} TN)</span>
          </button>

          {viewMode === "resumen" && (
            <>
              <button
                id="btn-exportar-compartir-programacion"
                type="button"
                onClick={() => handleAbrirExportacion(null)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
                title="Exportar como Imagen PNG o Documento PDF para Compartir por WhatsApp o Imprimir"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Exportar Imagen / PDF</span>
              </button>
              <button
                onClick={handleExportarExcelCSV}
                className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Ficha</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: RESUMEN MAESTRO CONSOLIDADO (SÁBANA OFICIAL - IMAGEN 2)         */}
      {/* ========================================================================= */}
      {viewMode === "resumen" && (
        <div className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtros:</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                {(["TODOS", "DIA", "NOCHE"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFiltroTurno(t)}
                    className={`px-3 py-1 text-xs font-bold ${
                      filtroTurno === t ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {t === "TODOS" ? "Todos los Turnos" : `Turno ${t}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por lote, batch (V200) o cliente..."
                value={busquedaLote}
                onChange={e => setBusquedaLote(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 w-64 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Master Table Container */}
          <div className="bg-slate-900 rounded-2xl border border-slate-750 overflow-hidden shadow-2xl">
            {/* Sheet Title Bar matching User's Image 2 */}
            <div className="bg-yellow-400 text-slate-950 py-2 px-4 font-black text-sm uppercase tracking-widest text-center shadow-inner">
              RESUMEN DE PROGRAMACION DE BATCH - VAPORIZADO APIT
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse text-slate-200">
                <thead>
                  {/* Super Header for Quality Averages */}
                  <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 font-bold">
                    <th colSpan={6} className="py-1 px-2 text-left border-r border-slate-700 uppercase tracking-wider text-[10px]">
                      Identificación & Programación de Carga
                    </th>
                    <th colSpan={3} className="py-1 px-2 text-center border-r border-slate-700 uppercase tracking-wider text-[10px] bg-slate-850">
                      Cubicaje (Cap. Máx {capacidadMaximaTn} TN)
                    </th>
                    <th colSpan={12} className="py-1 px-2 text-center border-r border-slate-700 uppercase tracking-wider text-[10px] bg-cyan-950/40 text-cyan-300">
                      PROMEDIO PONDERADO DE LOTES
                    </th>
                    <th colSpan={4} className="py-1 px-2 text-center border-r border-slate-700 uppercase tracking-wider text-[10px] bg-amber-950/40 text-amber-300">
                      PARÁMETROS OPERATIVOS DE PLANTA
                    </th>
                    <th colSpan={2} className="py-1 px-2 text-center uppercase tracking-wider text-[10px]">
                      Acciones
                    </th>
                  </tr>

                  {/* Individual Column Headers matching Image 2 */}
                  <tr className="bg-slate-850 border-b border-slate-700 text-slate-300 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 whitespace-nowrap">FECHA</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 whitespace-nowrap">TURNO</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 whitespace-nowrap bg-amber-500/10 text-amber-400">BACHT</th>
                    <th className="py-2.5 px-2 text-left border-r border-slate-750 whitespace-nowrap">LOTES</th>
                    <th className="py-2.5 px-2 text-left border-r border-slate-750 min-w-[130px]">CLIENTE</th>
                    <th className="py-2.5 px-2 text-left border-r border-slate-750 min-w-[100px]">VARIEDAD</th>
                    
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 whitespace-nowrap bg-slate-800">SAC. PROG</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 whitespace-nowrap bg-slate-800 font-black text-white">T.S. PROG</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 whitespace-nowrap bg-slate-800 font-black text-amber-300">PESO TOTAL</th>

                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 font-black text-cyan-300 whitespace-nowrap">P(H)</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">DESV. PROM</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">BL. INT</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">BL. PULIDO</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">Q.I</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">Q.B</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">T.T</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">T.P</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">T.PUN</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">M</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">TRIZ</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 whitespace-nowrap">CONDICION</th>

                    <th className="py-2.5 px-2 text-center border-r border-slate-750 bg-amber-950/30 text-amber-300 font-black whitespace-nowrap">DE. (BAR)</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 bg-amber-950/30 text-amber-300 font-black whitespace-nowrap">V. EXCL.</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 bg-amber-950/30 text-amber-300 font-black whitespace-nowrap">T. REPOSO</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 bg-amber-950/30 text-amber-300 font-black whitespace-nowrap">TEMP. SEC</th>

                    <th className="py-2.5 px-2 text-left min-w-[120px] border-r border-slate-750">OBSERVACION</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">GESTIÓN</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {programacionesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={26} className="py-12 text-center text-slate-400">
                        No hay programaciones registradas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    programacionesFiltradas.map((prog, idx) => {
                      const filas = Array.isArray(prog.filasLote) && prog.filasLote.length > 0
                        ? prog.filasLote
                        : [{
                            loteId: prog.batch || "V200",
                            cliente: prog.clientePrincipal || "Cliente",
                            variedad: prog.variedadPrincipal || "TINAJONES",
                            sacos: prog.totalSacosProg || Math.round(capacidadMaximaKg / 50),
                            peso: prog.pesoTotalKg || capacidadMaximaKg,
                            sacProg: prog.totalSacosProg || Math.round(capacidadMaximaKg / 50),
                            pesoProg: prog.pesoTotalKg || capacidadMaximaKg,
                            ph: prog.promedios?.ph ?? 14.0,
                            desv: prog.promedios?.desv ?? 1.2,
                            blInt: prog.promedios?.blInt ?? 21.5,
                            blBlanco: prog.promedios?.blBlanco ?? 39.0,
                            qi: prog.promedios?.qi ?? 7.5,
                            qb: prog.promedios?.qb ?? 15.5,
                            tt: prog.promedios?.tt ?? 1.5,
                            tp: prog.promedios?.tp ?? 2.5,
                            tpun: prog.promedios?.tpun ?? 4.5,
                            m: prog.promedios?.m ?? 0.8,
                            triz: prog.promedios?.triz ?? 1.8,
                            condicion: "APTO" as const
                          }];

                      const numFilas = filas.length;
                      const promedios = prog.promedios || {
                        ph: 14.0, desv: 1.2, blInt: 21.5, blBlanco: 39.0, qi: 7.5, qb: 15.5, tt: 1.5, tp: 2.5, tpun: 4.5, m: 0.8, triz: 1.8, condicion: "APTO" as const
                      };
                      const paramsDet = prog.parametrosDeterminados || {
                        presionBar: 0.40, velExclusa: 6, tiempoReposoMin: 40, tempSecadoC: 80
                      };

                      return (
                        <React.Fragment key={prog.id || idx}>
                          {/* If single lot or first row of multi lot */}
                          {filas.map((fila, fIdx) => (
                            <tr 
                              key={`${prog.id}-${fila.loteId}-${fIdx}`}
                              className={`hover:bg-slate-800/60 transition-colors font-mono ${
                                fIdx === 0 ? "border-t-2 border-slate-700" : "bg-slate-900/40"
                              }`}
                            >
                              {/* Common fields (only rendered on first sub-row with rowSpan) */}
                              {fIdx === 0 && (
                                <>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-sans font-medium text-slate-300 align-middle">
                                    {prog.fecha}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-sans font-bold align-middle">
                                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                                      prog.turno === "DIA" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-indigo-950 text-indigo-300 border border-indigo-700"
                                    }`}>
                                      {prog.turno}
                                    </span>
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-amber-400 bg-amber-500/5 align-middle text-xs">
                                    {prog.batch}
                                  </td>
                                </>
                              )}

                              {/* Lote sub-row details */}
                              <td className="py-2 px-2 text-left border-r border-slate-800 font-black text-cyan-400">
                                {fila.loteId}
                              </td>
                              <td className="py-2 px-2 text-left border-r border-slate-800 font-sans text-slate-300 truncate max-w-[140px]">
                                {fila.cliente || prog.clientePrincipal}
                              </td>
                              <td className="py-2 px-2 text-left border-r border-slate-800 font-sans text-slate-300">
                                {fila.variedad || prog.variedadPrincipal}
                              </td>
                              <td className="py-2 px-2 text-center border-r border-slate-800 text-slate-300 font-bold bg-slate-850/50">
                                {fila.sacProg}
                              </td>

                              {/* Common Cubicaje Sums (rendered on first sub-row with rowSpan) */}
                              {fIdx === 0 && (
                                <>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-white bg-slate-850 align-middle">
                                    {prog.totalSacosProg}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-amber-300 bg-slate-850 align-middle">
                                    {(prog.pesoTotalKg || 0).toLocaleString()}
                                  </td>

                                  {/* Weighted Averages */}
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 font-black text-cyan-300 bg-cyan-950/20 align-middle">
                                    {promedios.ph}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.desv}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.blInt}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.blBlanco > 0 ? promedios.blBlanco : "-"}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.qi}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.qb}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.tt}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.tp}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.tpun}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.m}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 text-slate-300 align-middle">
                                    {promedios.triz}%
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-1.5 text-center border-r border-slate-800 font-bold align-middle">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                      promedios.condicion === "APTO"
                                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                                        : "bg-rose-950 text-rose-300 border border-rose-700"
                                    }`}>
                                      {promedios.condicion}
                                    </span>
                                  </td>

                                  {/* Parámetros Operativos de Planta */}
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-amber-300 bg-amber-950/20 align-middle">
                                    {paramsDet.presionBar}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-amber-300 bg-amber-950/20 align-middle">
                                    {paramsDet.velExclusa}
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-amber-300 bg-amber-950/20 align-middle whitespace-nowrap">
                                    {paramsDet.tiempoReposoMin} MIN
                                  </td>
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center border-r border-slate-800 font-black text-amber-300 bg-amber-950/20 align-middle">
                                    {paramsDet.tempSecadoC}°
                                  </td>

                                  {/* Observaciones */}
                                  <td rowSpan={numFilas} className="py-2 px-2 text-left font-sans text-[10px] text-slate-300 border-r border-slate-800 align-middle">
                                    {prog.observacion || "-"}
                                  </td>

                                  {/* Acciones */}
                                  <td rowSpan={numFilas} className="py-2 px-2 text-center align-middle">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => handleProcesarBatch(prog)}
                                        title="Procesar Batch (Ir a Control de Vaporizado en Planta)"
                                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>Procesar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditarBatch(prog)}
                                        title="Editar Batch Completo (Cargar en Armador Oficial)"
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 hover:border-amber-400 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Editar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAbrirExportacion(prog)}
                                        title="Exportar Ficha Oficial del Batch (Imagen PNG o PDF para Compartir por WhatsApp)"
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                        <span>Exportar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAbrirEdicionRapida(prog)}
                                        title="Edición Rápida (Parámetros y Observaciones)"
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors cursor-pointer"
                                      >
                                        <Sliders className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicarParaSiguienteTurno(prog)}
                                        title="Duplicar para Turno Siguiente (ej. V202-2)"
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition-colors cursor-pointer"
                                      >
                                        <Layers className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSolicitarEliminarBatch(prog)}
                                        title="Eliminar Batch y liberar lotes"
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-300 border border-rose-800/60 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Eliminar</span>
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: ARMADOR INTERACTIVO DE BATCH (FORMATO EXCEL OFICIAL - IMAGEN 1)  */}
      {/* ========================================================================= */}
      {viewMode === "armador" && (
        <div className="space-y-6">
          {/* Top Actions & Navigation Bar */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-750 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>PROGRAMACIÓN Y FORMULACIÓN DE BATCH</span>
                  {editingProgId && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono">
                      Editando {batchCorrelativo} ({casoNombre})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  Seleccione primero los lotes pendientes en orden de prioridad y formule el balance de autoclave de {capacidadMaximaTn} TN.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalCriteriosOpen(true)}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
                title="Configurar tolerancias máximas permitidas de desviación y reglas de unión"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Criterios de Tolerancia
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProgId(null);
                  setViewMode("resumen");
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {editingProgId ? "Cancelar / Volver" : "Volver al Resumen"}
              </button>
              <button
                type="button"
                onClick={() => handleGuardarProgramacion(false)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow active:scale-95 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                {editingProgId ? "Actualizar Batch Maestro" : "Guardar Batch Oficial"}
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN 1 (PRIMERA PARTE): MATRIZ COMPLETA DE PRIORIZACIÓN DE LOTES PENDIENTES */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-750 space-y-4 shadow-xl">
            {/* Header & Description */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                    PARTE 1
                  </span>
                  <span className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    MATRIZ COMPLETA DE PRIORIZACIÓN (LOTES PENDIENTES)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Revise los lotes pendientes en orden estricto de prelación oficial (<strong>#1 a #{lotesDisponibles.length}</strong>). Seleccione con checkbox o agregue directamente para armar la mezcla de 35 TN.
                </p>
              </div>

              {/* View Switcher & Quick Suggestions */}
              <div className="flex flex-wrap items-center gap-2">
                {filasLote.length > 0 && clientePrincipal !== "Sin Cliente" && (
                  <label className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-950/70 px-2.5 py-1.5 rounded-lg border border-cyan-800/80 cursor-pointer shadow-sm hover:bg-cyan-900/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={soloMismoClienteFiltro}
                      onChange={e => setSoloMismoClienteFiltro(e.target.checked)}
                      className="rounded accent-cyan-500 cursor-pointer"
                    />
                    <span>Solo <strong>{clientePrincipal}</strong></span>
                  </label>
                )}

                {sugerenciasLotesSemejantes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsModalSugerenciasOpen(!isModalSugerenciasOpen)}
                    className="px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    {sugerenciasLotesSemejantes.length} Semejantes
                  </button>
                )}

                {/* View Switcher: Tabla vs Tarjetas vs Chips */}
                <div className="inline-flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setVistaSelectorModo("TABLA")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      vistaSelectorModo === "TABLA"
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Vista de Tabla Analítica Completa (Recomendada)"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Tabla Completa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVistaSelectorModo("TARJETAS")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      vistaSelectorModo === "TARJETAS"
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Vista de Tarjetas con datos analíticos"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVistaSelectorModo("COMPACTO")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      vistaSelectorModo === "COMPACTO"
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Vista de Chips Compactos"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Chips</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busquedaSelectorLotes}
                  onChange={e => setBusquedaSelectorLotes(e.target.value)}
                  placeholder="Buscar lote, cliente, silo..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {busquedaSelectorLotes && (
                  <button
                    type="button"
                    onClick={() => setBusquedaSelectorLotes("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Nivel de Riesgo Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400 text-[11px] font-bold shrink-0">Riesgo:</span>
                <select
                  value={filtroRiesgoSelector}
                  onChange={e => setFiltroRiesgoSelector(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer font-medium"
                >
                  <option value="TODOS" className="bg-slate-900 text-white">Todos los Riesgos</option>
                  <option value="EMERGENCIA" className="bg-slate-900 text-rose-400 font-bold">🚨 Emergencia</option>
                  <option value="ALTO" className="bg-slate-900 text-red-400">🔴 Alto Riesgo</option>
                  <option value="MEDIO" className="bg-slate-900 text-amber-400">🟡 Medio Riesgo</option>
                  <option value="BAJO" className="bg-slate-900 text-emerald-400">🟢 Bajo Riesgo</option>
                </select>
              </div>

              {/* Calidad / Aptitud Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400 text-[11px] font-bold shrink-0">Aptitud:</span>
                <select
                  value={filtroCalidadSelector}
                  onChange={e => setFiltroCalidadSelector(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer font-medium"
                >
                  <option value="TODOS" className="bg-slate-900 text-white">Todas las Aptitudes</option>
                  <option value="APROBADO" className="bg-slate-900 text-emerald-400">✓ Aprobados</option>
                  <option value="OBSERVADO" className="bg-slate-900 text-amber-400">⚠️ Observados</option>
                  <option value="EXPERIMENTAL" className="bg-slate-900 text-cyan-400">🧪 Experimentales</option>
                </select>
              </div>

              {/* Variety Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400 text-[11px] font-bold shrink-0">Variedad:</span>
                <select
                  value={filtroVariedadSelector}
                  onChange={e => setFiltroVariedadSelector(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer font-medium"
                >
                  <option value="TODAS" className="bg-slate-900 text-white">Todas las Variedades</option>
                  {variedadesDisponiblesSelector.map(v => (
                    <option key={v} value={v} className="bg-slate-900 text-white">{v}</option>
                  ))}
                </select>
              </div>

              {/* Sort Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <SlidersHorizontal className="w-3 h-3 text-slate-400 shrink-0" />
                <select
                  value={ordenSelectorLotes}
                  onChange={e => setOrdenSelectorLotes(e.target.value as any)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer font-medium"
                >
                  <option value="PRIORIDAD" className="bg-slate-900 text-white">⚡ Orden: Prioridad Oficial</option>
                  <option value="HUMEDAD_ASC" className="bg-slate-900 text-white">💧 Humedad: Menor a Mayor</option>
                  <option value="HUMEDAD_DESC" className="bg-slate-900 text-white">💧 Humedad: Mayor a Menor</option>
                  <option value="ENTERO_DESC" className="bg-slate-900 text-white">🌾 % Entero: Mayor a Menor</option>
                  <option value="SACOS_DESC" className="bg-slate-900 text-white">📦 Mayor Volumen (Sacos)</option>
                </select>
              </div>
            </div>

            {/* Selection & Autoclave Load Summary Bar */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleToggleSelectAllArmador}
                  className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedLoteIdsInArmador.length > 0 && selectedLoteIdsInArmador.length === lotesSelectorFiltrados.length}
                    className="accent-amber-500 rounded"
                  />
                  <span>
                    {selectedLoteIdsInArmador.length > 0 && selectedLoteIdsInArmador.length === lotesSelectorFiltrados.length
                      ? "Deseleccionar Todos"
                      : "Seleccionar Visibles"}
                  </span>
                </button>

                {statsSeleccionArmador ? (
                  <div className="flex items-center gap-2 font-mono text-[11px] bg-amber-500/10 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/30">
                    <span className="font-black">{statsSeleccionArmador.count} lote(s) seleccionados:</span>
                    <span>{statsSeleccionArmador.totalSacos.toLocaleString()} sacos</span>
                    <span>•</span>
                    <span>{(Number(statsSeleccionArmador.totalTn) || 0).toFixed(2)} TN ({statsSeleccionArmador.totalKg.toLocaleString()} kg)</span>
                    <span>•</span>
                    <span>P(H) est: {statsSeleccionArmador.humProm}%</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">
                    Mostrando <strong>{lotesSelectorFiltrados.length}</strong> de <strong>{lotesDisponibles.length}</strong> lotes pendientes. Marque los checkboxes para carga masiva.
                  </span>
                )}
              </div>

              {/* Action Buttons for Selection */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedLoteIdsInArmador.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedLoteIdsInArmador([])}
                      className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Limpiar Selección ({selectedLoteIdsInArmador.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleCargarSeleccionadosAlBatchArmador}
                      className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>⚡ Cargar {selectedLoteIdsInArmador.length} Seleccionados al Batch</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleAutoLlenar35TN}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                    title="Seleccionar y calcular automáticamente lotes en orden de prioridad hasta completar 35,000 kg"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>⚡ Auto-Llenar Batch (35 TN)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Matrix Data Views */}
            {lotesSelectorFiltrados.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-slate-500 space-y-1">
                <p className="text-sm font-bold text-slate-400">No se encontraron lotes pendientes con los filtros aplicados.</p>
                <p className="text-xs">Pruebe cambiando la búsqueda o restableciendo los filtros de riesgo y variedad.</p>
              </div>
            ) : vistaSelectorModo === "TABLA" ? (
              /* ================= MODE 1: FULL ANALYTICAL TABLE VIEW ================= */
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-850 text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-750 text-[11px]">
                    <tr>
                      <th className="p-2 text-center w-8">
                        <input
                          type="checkbox"
                          checked={selectedLoteIdsInArmador.length > 0 && selectedLoteIdsInArmador.length === lotesSelectorFiltrados.length}
                          onChange={handleToggleSelectAllArmador}
                          className="accent-amber-500 rounded cursor-pointer"
                        />
                      </th>
                      <th className="p-2 text-center w-16">Prio</th>
                      <th className="p-2 text-center w-14">Score</th>
                      <th className="p-2">Lote ID</th>
                      <th className="p-2">Cliente / Molino</th>
                      <th className="p-2">Variedad</th>
                      <th className="p-2">Ubicación</th>
                      <th className="p-2 text-right">Sacos</th>
                      <th className="p-2 text-right">Peso (TN)</th>
                      <th className="p-2 text-right">Humedad</th>
                      <th className="p-2 text-right">% Entero</th>
                      <th className="p-2 text-right">% Tiza (TT)</th>
                      <th className="p-2 text-right">% Mancha</th>
                      <th className="p-2 text-right">Días Alm.</th>
                      <th className="p-2 text-center">Aptitud</th>
                      <th className="p-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                    {lotesSelectorFiltrados.map((l, index) => {
                      const yaAgregadoEnEste = filasLote.some(f => f.loteId.trim().toLowerCase() === l.LOTE_ID.trim().toLowerCase());
                      const infoBatch = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);
                      const yaEnOtroBatch = infoBatch.estaProgramado && !infoBatch.esMismoBatch;
                      const cli = l.CLIENTE || "Cliente";
                      const sacos = l.SACOS || 0;
                      const pesoTn = (Number(l.PESO_KG) || (sacos * 50)) / 1000;
                      
                      const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").trim().toLowerCase() === l.LOTE_ID.trim().toLowerCase());
                      const humLote = Number(ah?.HUMEDADES ?? l.HUM ?? l.HUMEDAD ?? 14.0) || 14.0;
                      const pctEntero = typeof ah?.ENTERO === "number" ? ah.ENTERO : (ah?.ENTERO !== undefined && ah?.ENTERO !== null && !isNaN(Number(ah.ENTERO)) ? Number(ah.ENTERO) : null);
                      const pctTiza = typeof ah?.TT === "number" ? ah.TT : (ah?.TT !== undefined && ah?.TT !== null && !isNaN(Number(ah.TT)) ? Number(ah.TT) : null);
                      const pctMancha = typeof ah?.M === "number" 
                        ? ah.M 
                        : (ah?.M !== undefined && ah?.M !== null && !isNaN(Number(ah.M)) 
                          ? Number(ah.M) 
                          : ((ah as any)?.MANCHADO !== undefined && (ah as any)?.MANCHADO !== null && !isNaN(Number((ah as any).MANCHADO)) 
                            ? Number((ah as any).MANCHADO) 
                            : null));

                      const aptitud = verificarAptitudProgramacionLote(l, ah);
                      const estaDeshabilitado = yaAgregadoEnEste || yaEnOtroBatch || !aptitud.esProgramable;

                      const pInfo = (l as any).prioridadInfo || prioridadMap.get((l.LOTE_ID || "").trim().toLowerCase());
                      const posPrio = pInfo?.posicion ?? (index + 1);
                      const esEmerg = pInfo?.esEmergencia || pInfo?.nivelRiesgo === "EMERGENCIA";
                      const scorePrio = Number(pInfo?.puntuacionFinal) || 0;
                      const diasAlm = pInfo?.diasAlmacenamiento ?? 0;
                      const isSelected = selectedLoteIdsInArmador.includes(l.LOTE_ID);

                      return (
                        <tr
                          key={l.LOTE_ID}
                          className={`hover:bg-slate-850/60 transition-colors ${
                            isSelected
                              ? "bg-amber-500/15 text-amber-100"
                              : yaAgregadoEnEste
                              ? "bg-cyan-950/25 text-cyan-200"
                              : yaEnOtroBatch
                              ? "opacity-50 line-through bg-slate-950/30"
                              : esEmerg
                              ? "bg-rose-950/25"
                              : ""
                          }`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={estaDeshabilitado}
                              onChange={() => handleToggleSelectLoteArmador(l.LOTE_ID)}
                              className="accent-amber-500 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono inline-block ${
                              esEmerg
                                ? "bg-rose-600 text-white animate-pulse"
                                : pInfo?.nivelRiesgo === "ALTO"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : pInfo?.nivelRiesgo === "MEDIO"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}>
                              #{posPrio}
                            </span>
                          </td>
                          <td className="p-2 text-center font-mono text-[11px] text-slate-400">
                            {typeof scorePrio === "number" && !isNaN(scorePrio) && scorePrio > 0 ? `${scorePrio.toFixed(0)}p` : "-"}
                          </td>
                          <td className="p-2 font-mono font-bold text-cyan-300">
                            <button
                              type="button"
                              onClick={() => onSelectLoteForFicha && onSelectLoteForFicha(l.LOTE_ID)}
                              className="hover:underline text-left cursor-pointer flex items-center gap-1"
                              title="Ver Ficha Técnica"
                            >
                              <span>{l.LOTE_ID}</span>
                              <FileSpreadsheet className="w-3 h-3 text-cyan-500 opacity-60 hover:opacity-100" />
                            </button>
                          </td>
                          <td className="p-2 max-w-[150px] truncate" title={cli}>
                            {cli}
                          </td>
                          <td className="p-2 text-amber-300 font-medium">
                            {l.VARIEDAD || "TINAJONES"}
                          </td>
                          <td className="p-2 font-mono text-slate-300">
                            {l.UBICACION || "PLANTA"}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-amber-400">
                            {sacos.toLocaleString()}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-300">
                            {(Number(pesoTn) || 0).toFixed(1)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-cyan-300">
                            {(Number(humLote) || 14.0).toFixed(1)}%
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-400">
                            {typeof pctEntero === "number" && !isNaN(pctEntero) ? `${pctEntero.toFixed(1)}%` : "-"}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-300">
                            {typeof pctTiza === "number" && !isNaN(pctTiza) ? `${pctTiza.toFixed(1)}%` : "-"}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-300">
                            {typeof pctMancha === "number" && !isNaN(pctMancha) ? `${pctMancha.toFixed(1)}%` : "-"}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-400">
                            {diasAlm > 0 ? `${diasAlm}d` : "-"}
                          </td>
                          <td className="p-2 text-center">
                            {aptitud.esProgramable ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                                {aptitud.label}
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700">
                                No Apto
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {yaAgregadoEnEste ? (
                              <span className="text-[11px] text-cyan-400 font-bold flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> En Batch
                              </span>
                            ) : yaEnOtroBatch ? (
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                                {infoBatch.batchCodigo}
                              </span>
                            ) : !aptitud.esProgramable ? (
                              <span className="text-[10px] text-rose-400 font-bold">Bloqueado</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAgregarLoteAlBatch(l.LOTE_ID)}
                                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm mx-auto cursor-pointer transition-all active:scale-95"
                              >
                                <Plus className="w-3 h-3" /> Agregar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : vistaSelectorModo === "TARJETAS" ? (
              /* ================= MODE 2: RICH CARDS VIEW ================= */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto p-1 pr-2">
                {lotesSelectorFiltrados.map((l, index) => {
                  const yaAgregadoEnEste = filasLote.some(f => f.loteId.trim().toLowerCase() === l.LOTE_ID.trim().toLowerCase());
                  const infoBatch = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);
                  const yaEnOtroBatch = infoBatch.estaProgramado && !infoBatch.esMismoBatch;
                  const cli = l.CLIENTE || "Cliente";
                  const variedadLote = l.VARIEDAD || "TINAJONES";
                  const ubicacion = l.UBICACION || "PLANTA";
                  const sacos = l.SACOS || 0;
                  const pesoTn = (Number(l.PESO_KG) || (sacos * 50)) / 1000;
                  
                  const ah = (analisisHumedos || []).find(a => (a.LOTE_ID || "").trim().toLowerCase() === l.LOTE_ID.trim().toLowerCase());
                  const humLote = Number(ah?.HUMEDADES ?? l.HUM ?? l.HUMEDAD ?? 14.0) || 14.0;
                  const pctEntero = typeof ah?.ENTERO === "number" ? ah.ENTERO : (ah?.ENTERO !== undefined && ah?.ENTERO !== null && !isNaN(Number(ah.ENTERO)) ? Number(ah.ENTERO) : null);
                  const pctTiza = typeof ah?.TT === "number" ? ah.TT : (ah?.TT !== undefined && ah?.TT !== null && !isNaN(Number(ah.TT)) ? Number(ah.TT) : null);
                  const pctMancha = typeof ah?.M === "number" 
                    ? ah.M 
                    : (ah?.M !== undefined && ah?.M !== null && !isNaN(Number(ah.M)) 
                      ? Number(ah.M) 
                      : ((ah as any)?.MANCHADO !== undefined && (ah as any)?.MANCHADO !== null && !isNaN(Number((ah as any).MANCHADO)) 
                        ? Number((ah as any).MANCHADO) 
                        : null));
                  const pctImpurezas = typeof ah?.IMPUREZS === "number" 
                    ? ah.IMPUREZS 
                    : (ah?.IMPUREZS !== undefined && ah?.IMPUREZS !== null && !isNaN(Number(ah.IMPUREZS)) 
                      ? Number(ah.IMPUREZS) 
                      : ((ah as any)?.IMPUREZAS !== undefined && (ah as any)?.IMPUREZAS !== null && !isNaN(Number((ah as any).IMPUREZAS)) 
                        ? Number((ah as any).IMPUREZAS) 
                        : null));

                  const aptitud = verificarAptitudProgramacionLote(l, ah);
                  const estaDeshabilitado = yaAgregadoEnEste || yaEnOtroBatch || !aptitud.esProgramable;

                  // Metadatos de priorización
                  const pInfo = (l as any).prioridadInfo || prioridadMap.get((l.LOTE_ID || "").trim().toLowerCase());
                  const posPrio = pInfo?.posicion ?? (index + 1);
                  const esEmerg = pInfo?.esEmergencia || pInfo?.nivelRiesgo === "EMERGENCIA";
                  const scorePrio = Number(pInfo?.puntuacionFinal) || 0;
                  const diasAlm = pInfo?.diasAlmacenamiento ?? 0;
                  const isSelected = selectedLoteIdsInArmador.includes(l.LOTE_ID);

                  // Diferencia de humedad con el batch actual
                  const diffHum = (promedioHumedadBatchActual !== null && promedioHumedadBatchActual !== undefined && !isNaN(promedioHumedadBatchActual)) 
                    ? (humLote - promedioHumedadBatchActual) 
                    : null;

                  return (
                    <div
                      key={l.LOTE_ID}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-400 ring-1 ring-amber-400"
                          : yaAgregadoEnEste
                          ? "bg-slate-900/90 border-cyan-700/60 shadow-lg shadow-cyan-950/30"
                          : yaEnOtroBatch
                          ? "bg-slate-950/70 border-slate-800 opacity-60"
                          : !aptitud.esProgramable
                          ? "bg-rose-950/20 border-rose-900/50 opacity-75"
                          : esEmerg
                          ? "bg-gradient-to-b from-rose-950/40 to-slate-900 border-rose-600/80 shadow-md ring-1 ring-rose-500/40"
                          : pInfo?.nivelRiesgo === "ALTO"
                          ? "bg-gradient-to-b from-red-950/30 to-slate-900 border-red-700/60"
                          : "bg-slate-850 hover:bg-slate-800/90 border-slate-750 hover:border-cyan-500/40 shadow-sm"
                      }`}
                    >
                      {/* Top Bar: Checkbox + Priority Badge + Score + Ubicación */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={estaDeshabilitado}
                            onChange={() => handleToggleSelectLoteArmador(l.LOTE_ID)}
                            className="accent-amber-500 rounded cursor-pointer disabled:opacity-40"
                          />
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black font-mono tracking-tight flex items-center gap-1 ${
                            esEmerg
                              ? "bg-rose-600 text-white animate-pulse shadow-sm"
                              : pInfo?.nivelRiesgo === "ALTO"
                              ? "bg-red-600/30 text-red-300 border border-red-500/50"
                              : pInfo?.nivelRiesgo === "MEDIO"
                              ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}>
                            <span>#{posPrio}</span>
                            <span>{esEmerg ? "🚨 EMERG" : pInfo?.nivelRiesgo || "NORMAL"}</span>
                          </span>
                          {typeof scorePrio === "number" && !isNaN(scorePrio) && scorePrio > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono" title="Puntuación de Priorización">
                              {scorePrio.toFixed(0)}p
                            </span>
                          )}
                        </div>

                        {/* Ubicación en Planta */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-755 flex items-center gap-1 font-mono font-medium">
                          <Warehouse className="w-2.5 h-2.5 text-cyan-400" />
                          <span className="truncate max-w-[80px]">{ubicacion}</span>
                        </span>
                      </div>

                      {/* Header: Lote ID + Cliente + Variedad */}
                      <div>
                        <div className="flex items-baseline justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectLoteForFicha && onSelectLoteForFicha(l.LOTE_ID)}
                            className="font-mono font-black text-sm text-cyan-300 tracking-wide hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>{l.LOTE_ID}</span>
                          </button>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-900/80 text-amber-300 rounded border border-amber-500/30">
                            {variedadLote}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium truncate mt-0.5" title={cli}>
                          {cli}
                        </p>
                      </div>

                      {/* Technical Parameters Matrix Grid (Humedad, % Entero, % Tiza, % Mancha) */}
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-[11px]">
                        {/* Humedad */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                            <Droplets className="w-2.5 h-2.5 text-cyan-400" /> Humedad
                          </span>
                          <div className="flex items-baseline gap-1 font-mono font-bold text-slate-100">
                            <span className={humLote > 15 ? "text-amber-400" : "text-cyan-300"}>
                              {(Number(humLote) || 14.0).toFixed(1)}%
                            </span>
                            {typeof diffHum === "number" && !isNaN(diffHum) && (
                              <span className={`text-[9px] font-medium ${
                                Math.abs(diffHum) > 1.5 ? "text-amber-400 font-bold" : "text-slate-400"
                              }`} title="Diferencia con el promedio de humedad del batch actual">
                                ({diffHum >= 0 ? `+${diffHum.toFixed(1)}` : diffHum.toFixed(1)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* % Entero */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                            🌾 % Entero
                          </span>
                          <span className={`font-mono font-bold ${
                            typeof pctEntero !== "number" || isNaN(pctEntero)
                              ? "text-slate-500"
                              : pctEntero >= 55
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}>
                            {typeof pctEntero === "number" && !isNaN(pctEntero) ? `${pctEntero.toFixed(1)}%` : "N/D"}
                          </span>
                        </div>

                        {/* % Tiza */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            ⚪ % Tiza (TT)
                          </span>
                          <span className={`font-mono font-bold ${
                            typeof pctTiza !== "number" || isNaN(pctTiza)
                              ? "text-slate-500"
                              : pctTiza > 4
                              ? "text-rose-400"
                              : "text-slate-200"
                          }`}>
                            {typeof pctTiza === "number" && !isNaN(pctTiza) ? `${pctTiza.toFixed(1)}%` : "N/D"}
                          </span>
                        </div>

                        {/* % Mancha / Impurezas */}
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            🔴 % Mancha
                          </span>
                          <span className={`font-mono font-bold ${
                            typeof pctMancha !== "number" || isNaN(pctMancha)
                              ? "text-slate-500"
                              : pctMancha > 2
                              ? "text-rose-400"
                              : "text-slate-200"
                          }`}>
                            {typeof pctMancha === "number" && !isNaN(pctMancha) 
                              ? `${pctMancha.toFixed(1)}%` 
                              : (typeof pctImpurezas === "number" && !isNaN(pctImpurezas) ? `${pctImpurezas.toFixed(1)}% Imp` : "0.0%")}
                          </span>
                        </div>
                      </div>

                      {/* Footer: Volume (Sacos / TN) & Action Button */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                        <div className="text-[11px] font-mono font-bold text-slate-300">
                          <span className="text-amber-400">{sacos.toLocaleString()}s</span>
                          <span className="text-slate-500 text-[10px] ml-1">({(Number(pesoTn) || 0).toFixed(1)} TN)</span>
                          {diasAlm > 0 && (
                            <span className="text-[10px] text-slate-400 font-sans ml-1.5">
                              • {diasAlm}d alm.
                            </span>
                          )}
                        </div>

                        {/* Action Control */}
                        {yaAgregadoEnEste ? (
                          <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                            En Batch
                          </span>
                        ) : yaEnOtroBatch ? (
                          <span className="px-2 py-1 bg-slate-900 text-amber-400 border border-amber-800/60 rounded-lg text-[11px] font-bold flex items-center gap-1 font-mono" title={`Asignado al Batch ${infoBatch.batchCodigo}`}>
                            <Lock className="w-3 h-3" />
                            {infoBatch.batchCodigo}
                          </span>
                        ) : !aptitud.esProgramable ? (
                          <span className="px-2 py-1 bg-rose-950/50 text-rose-400 border border-rose-800/80 rounded-lg text-[11px] font-bold flex items-center gap-1" title={aptitud.label}>
                            <AlertOctagon className="w-3 h-3" />
                            No Apto
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAgregarLoteAlBatch(l.LOTE_ID)}
                            className="px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ================= MODE 3: COMPACT CHIPS VIEW ================= */
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {lotesSelectorFiltrados.map((l, index) => {
                  const yaAgregadoEnEste = filasLote.some(f => f.loteId.trim().toLowerCase() === l.LOTE_ID.trim().toLowerCase());
                  const infoBatch = obtenerInfoLoteEnBatches(l.LOTE_ID, programaciones, batches, editingProgId, batchCorrelativo);
                  const yaEnOtroBatch = infoBatch.estaProgramado && !infoBatch.esMismoBatch;
                  const cli = l.CLIENTE || "Cliente";
                  const ah = (analisisHumedos || []).find(a => a.LOTE_ID === l.LOTE_ID);
                  const humLote = ah?.HUMEDADES ?? l.HUM ?? l.HUMEDAD ?? 14.0;
                  const pctEntero = ah?.ENTERO;
                  const aptitud = verificarAptitudProgramacionLote(l, ah);
                  const estaDeshabilitado = yaAgregadoEnEste || yaEnOtroBatch || !aptitud.esProgramable;

                  const pInfo = (l as any).prioridadInfo || prioridadMap.get((l.LOTE_ID || "").trim().toLowerCase());
                  const posPrio = pInfo?.posicion ?? (index + 1);
                  const esEmerg = pInfo?.esEmergencia || pInfo?.nivelRiesgo === "EMERGENCIA";

                  return (
                    <button
                      key={l.LOTE_ID}
                      onClick={() => handleAgregarLoteAlBatch(l.LOTE_ID)}
                      disabled={estaDeshabilitado}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                        yaAgregadoEnEste
                          ? "bg-slate-800/60 text-cyan-400 border border-cyan-800/40 cursor-not-allowed opacity-80"
                          : yaEnOtroBatch
                          ? "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60 line-through"
                          : !aptitud.esProgramable
                          ? "bg-rose-950/40 text-rose-400 border border-rose-800/80 cursor-not-allowed opacity-70"
                          : esEmerg
                          ? "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-600/80 cursor-pointer shadow-md ring-1 ring-rose-500/50"
                          : "bg-slate-850 hover:bg-slate-750 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 cursor-pointer shadow"
                      }`}
                      title={`Prioridad #${posPrio} | ${l.LOTE_ID} - ${cli} | Hum: ${humLote}% | % Entero: ${pctEntero ?? '-'}% | Sacos: ${l.SACOS || 0}s | Ubic: ${l.UBICACION || 'N/A'}`}
                    >
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-black leading-tight ${
                        esEmerg
                          ? "bg-rose-600 text-white animate-pulse"
                          : pInfo?.nivelRiesgo === "ALTO"
                          ? "bg-red-500/20 text-red-300 border border-red-500/40"
                          : pInfo?.nivelRiesgo === "MEDIO"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}>
                        #{posPrio}
                      </span>

                      <span className="flex items-center gap-1">
                        {yaEnOtroBatch ? (
                          <span className="text-[10px] text-amber-500 font-bold">🔒</span>
                        ) : !aptitud.esProgramable ? (
                          <span className="text-[10px] text-rose-400 font-bold">🚫</span>
                        ) : esEmerg ? (
                          <span className="text-[10px] text-rose-400 font-bold">🚨</span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-bold">✓</span>
                        )}
                        <span>{l.LOTE_ID}</span>
                      </span>

                      {yaEnOtroBatch ? (
                        <span className="text-[9px] px-1 py-0.2 bg-amber-950/80 text-amber-300 rounded border border-amber-800/60">
                          {infoBatch.batchCodigo}
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] text-slate-400">({cli.length > 8 ? cli.substring(0, 8) + ".." : cli})</span>
                          <span className="text-[10px] text-cyan-300 font-sans">{(Number(humLote) || 14.0).toFixed(1)}%H</span>
                          <span className="text-[10px] text-amber-400 font-sans">{l.SACOS || 100}s</span>
                        </>
                      )}

                      {yaAgregadoEnEste ? (
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                      ) : yaEnOtroBatch ? (
                        <Lock className="w-3 h-3 text-slate-500" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Panel Desplegable de Lotes Semejantes */}
            {isModalSugerenciasOpen && sugerenciasLotesSemejantes.length > 0 && (
              <div className="mt-3 p-3 bg-purple-950/30 rounded-xl border border-purple-800/50 space-y-2">
                <div className="flex items-center justify-between text-xs text-purple-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Lotes recomendados con menor desviación respecto a la mezcla ({clientePrincipal}):
                  </span>
                  <button
                    onClick={() => setIsModalSugerenciasOpen(false)}
                    className="text-[11px] text-purple-400 hover:text-purple-200"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {sugerenciasLotesSemejantes.slice(0, 6).map(s => {
                    const sHum = Number(s.humedad ?? s.analisisH?.HUMEDADES ?? s.lote.HUM ?? 14.0) || 14.0;
                    const sDifHum = Number(s.diferenciaHumedad) || 0;
                    const sTT = Number(s.tt ?? s.analisisH?.TT ?? 1.5) || 1.5;
                    const sSim = s.porcentajeSimilitud ?? s.scoreSimilitud ?? 100;
                    return (
                      <div
                        key={s.lote.LOTE_ID}
                        className="p-2 bg-slate-900/90 rounded-lg border border-purple-700/40 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono font-bold text-white flex items-center gap-1.5">
                            <span>{s.lote.LOTE_ID}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded border border-emerald-700">
                              {sSim}% similar
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Hum: {sHum.toFixed(1)}% (Δ {sDifHum.toFixed(1)}%) | TT: {sTT.toFixed(1)}% | Ubic: {s.lote.UBICACION || "PLANTA"}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleAgregarLoteAlBatch(s.lote.LOTE_ID);
                          }}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Unir
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN 2: FORMULACIÓN & PROGRAMACIÓN DE BATCH OFICIAL (FORMATO V200 - 35 TN) */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-750 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                  PARTE 2
                </span>
                <span className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  FORMULACIÓN & BALANCE PONDERADO DEL BATCH
                </span>
              </div>

              {/* Quick Actions & Model Cases Bar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoLlenar35TN}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                  title="Seleccionar y calcular automáticamente lotes del cliente hasta completar 35,000 kg"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Auto-Llenar (35 TN)</span>
                </button>
                {filasLote.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilasLote([])}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Vaciar Formulario
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetLotesPruebas}
                  className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-cyan-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Restablecer todos los lotes a estado ANALIZADO para continuar creando pruebas"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Habilitar Lotes</span>
                </button>
              </div>
            </div>

            {/* Client & Rules Info Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Cliente Exclusivo del Batch</span>
                  <span className="font-mono font-black text-cyan-300 text-sm">
                    {clientePrincipal}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Regla de Mezcla</span>
                  <span className="text-slate-200 font-semibold">
                    {criteriosUnion.exigirMismoCliente ? "Un solo cliente por Batch (Estricto)" : "Multicliente permitido"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                  evaluacionMezcla.esCompatible && evaluacionMezcla.mismoCliente
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                    : "bg-rose-950/80 text-rose-300 border-rose-700/60"
                }`}>
                  {evaluacionMezcla.esCompatible && evaluacionMezcla.mismoCliente ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Homogeneidad Conforme (±{criteriosUnion.toleranciaHumedad}% Hum / ±{criteriosUnion.toleranciaTotalTrizado}% TT)
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Desviaciones Excedidas en la Mezcla
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Header Inputs Form */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">AGRUPACIÓN / IDENTIFICADOR</label>
                <input
                  type="text"
                  value={casoNombre}
                  onChange={e => setCasoNombre(e.target.value)}
                  placeholder="ej. Batch Principal"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">FECHA</label>
                <input
                  type="date"
                  value={fechaProg}
                  onChange={e => setFechaProg(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">TURNO</label>
                <select
                  value={turnoProg}
                  onChange={e => setTurnoProg(e.target.value as "DIA" | "NOCHE")}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-bold text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="DIA">DÍA</option>
                  <option value="NOCHE">NOCHE</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">BATCH CORRELATIVO (V)</label>
                <input
                  type="text"
                  value={batchCorrelativo}
                  onChange={e => setBatchCorrelativo(e.target.value.toUpperCase())}
                  placeholder="V200"
                  className="w-full bg-amber-500/10 border border-amber-500/40 rounded-lg p-2 font-mono font-black text-amber-400 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">OBSERVACIÓN DE PLANTA</label>
                <input
                  type="text"
                  value={observacionProg}
                  onChange={e => setObservacionProg(e.target.value)}
                  placeholder="ej. LOTE CN HUMEDAD BAJA"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Detailed Batch Matrix Table (Exact Replica of User's Image 1) */}
          <div className="bg-slate-900 rounded-2xl border border-slate-750 overflow-hidden shadow-xl">
            <div className="p-3 bg-slate-850 border-b border-slate-750 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black text-xs rounded">
                  {casoNombre}
                </span>
                <span className="text-xs font-bold text-white">
                  Matriz Analítica & Balance Ponderado de Lotes
                </span>
              </div>
              <div className="text-xs font-mono font-bold">
                <span className="text-slate-400">Capacidad Autoclave: </span>
                <span className={`font-black ${(liveCalculos?.pesoTotalKg || 0) > capacidadMaximaKg ? "text-amber-400" : "text-emerald-400"}`}>
                  {(liveCalculos?.pesoTotalKg || 0).toLocaleString()} / {capacidadMaximaKg.toLocaleString()} kg ({((((liveCalculos?.pesoTotalKg || 0) / capacidadMaximaKg) * 100) || 0).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 text-[11px] font-bold border-b border-slate-700 uppercase">
                    <th className="py-2.5 px-2 text-center border-r border-slate-750">LOTES</th>
                    <th className="py-2.5 px-2 text-left border-r border-slate-750 min-w-[130px]">CLIENTE</th>
                    <th className="py-2.5 px-2 text-left border-r border-slate-750 min-w-[100px]">VARIEDAD</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750">N° SACOS</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750">PESO (KG)</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 bg-amber-500/10 text-amber-300">SAC. PROG</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750 bg-amber-500/10 text-amber-300">PESO PROG</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750 text-cyan-300">P(H)</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">DESV. (HUM.)</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">BL. INT</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">B. PULIDO</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">Q.I</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">Q.B</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">T.T</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">T.P</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">T.PUN</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">M</th>
                    <th className="py-2.5 px-1.5 text-center border-r border-slate-750">TRIZ</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-750">CONDICION</th>
                    <th className="py-2.5 px-2 text-center">ACCIÓN</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {filasLote.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="py-12 px-4 text-center text-slate-400 bg-slate-900/60">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
                          <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-amber-400 shadow-inner">
                            <Layers className="w-6 h-6" />
                          </div>
                          <div className="text-sm font-bold text-white">
                            Espacios vacíos listos para nuevo Batch {batchCorrelativo} ({casoNombre})
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            No hay lotes precargados. Seleccione los lotes de la <strong className="text-amber-300 font-semibold">Matriz de Priorización de Lotes Pendientes</strong> arriba o use el botón <span className="text-cyan-400 font-semibold">"Unir"</span> para cargarlos a este Batch.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filasLote.map((fila, idx) => (
                      <tr key={fila.loteId} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2 px-2 text-center font-black text-cyan-400 border-r border-slate-800">
                          {fila.loteId}
                        </td>
                        <td className="py-2 px-2 text-left font-sans text-slate-300 border-r border-slate-800">
                          {fila.cliente}
                        </td>
                        <td className="py-2 px-2 text-left font-sans text-slate-300 border-r border-slate-800">
                          {fila.variedad}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-400 border-r border-slate-800">
                          {fila.sacos}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-400 border-r border-slate-800">
                          {fila.peso.toLocaleString()}
                        </td>

                        {/* Editable Sacos Programados */}
                        <td className="py-1.5 px-1 text-center border-r border-slate-800 bg-amber-500/5">
                          {(() => {
                            const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
                              fila.loteId,
                              lotes,
                              programaciones,
                              batches,
                              batchLotes,
                              editingProgId,
                              batchCorrelativo
                            );
                            const maxSacosDisp = saldoInfo.sacosDisponibles;
                            const tieneExceso = fila.sacProg > maxSacosDisp;
                            const detalleStr = saldoInfo.detalleUso.length > 0
                              ? ` (ya asignados: ${saldoInfo.detalleUso.map(u => `${u.sacos} en ${u.batch}`).join(", ")})`
                              : "";

                            return (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxSacosDisp}
                                  value={fila.sacProg}
                                  onChange={e => handleActualizarFilaLote(fila.loteId, { sacProg: Number(e.target.value) || 0 })}
                                  className={`w-16 bg-slate-800 border ${tieneExceso ? "border-red-500 text-red-400 bg-red-950/30" : "border-slate-700 text-amber-300"} rounded text-center p-1 font-bold focus:outline-none focus:border-amber-500`}
                                  title={`Saldo disponible: ${maxSacosDisp} sacos${detalleStr}. Total lote: ${saldoInfo.originalSacos} sacos.`}
                                />
                                <span className={`text-[9px] mt-0.5 font-mono ${tieneExceso ? "text-red-400 font-bold" : "text-emerald-400 font-semibold"}`}>
                                  Máx: {maxSacosDisp}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Editable Peso Programado */}
                        <td className="py-1.5 px-1 text-center border-r border-slate-800 bg-amber-500/5">
                          {(() => {
                            const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
                              fila.loteId,
                              lotes,
                              programaciones,
                              batches,
                              batchLotes,
                              editingProgId,
                              batchCorrelativo
                            );
                            const maxPesoDisp = saldoInfo.pesoDisponibleKg;
                            const tieneExceso = fila.pesoProg > maxPesoDisp + 0.1;

                            return (
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxPesoDisp}
                                  value={fila.pesoProg}
                                  onChange={e => handleActualizarFilaLote(fila.loteId, { pesoProg: Number(e.target.value) || 0 })}
                                  className={`w-20 bg-slate-800 border ${tieneExceso ? "border-red-500 text-red-400 bg-red-950/30" : "border-slate-700 text-amber-300"} rounded text-center p-1 font-bold focus:outline-none focus:border-amber-500`}
                                  title={`Peso disponible: ${maxPesoDisp.toLocaleString()} kg. Total lote: ${saldoInfo.originalPesoKg.toLocaleString()} kg.`}
                                />
                                <span className={`text-[9px] mt-0.5 font-mono ${tieneExceso ? "text-red-400 font-bold" : "text-emerald-400 font-semibold"}`}>
                                  Máx: {(maxPesoDisp / 1000).toFixed(1)} TN
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Quality Variables Inputs / Readouts */}
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.ph}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { ph: Number(e.target.value) || 0 })}
                            className="w-14 bg-slate-800 border border-slate-700 rounded text-center p-1 font-black text-cyan-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.desv}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { desv: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.blInt}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { blInt: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.blBlanco}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { blBlanco: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.qi}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { qi: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.qb}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { qb: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.tt}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { tt: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.tp}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { tp: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.tpun}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { tpun: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.m}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { m: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <input
                            type="number"
                            step="0.1"
                            value={fila.triz}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { triz: Number(e.target.value) || 0 })}
                            className="w-12 bg-slate-800 border border-slate-700 rounded text-center p-1 text-slate-300"
                          />
                        </td>
                        <td className="py-1.5 px-1 text-center border-r border-slate-800">
                          <select
                            value={fila.condicion}
                            onChange={e => handleActualizarFilaLote(fila.loteId, { condicion: e.target.value as any })}
                            className="bg-slate-800 border border-slate-700 rounded text-[10px] p-1 font-bold text-slate-200"
                          >
                            <option value="APTO">APTO</option>
                            <option value="OBSERVADO">OBSERVADO</option>
                            <option value="NO APTO">NO APTO</option>
                          </select>
                        </td>

                        <td className="py-1.5 px-2 text-center">
                          <button
                            onClick={() => handleQuitarFilaLote(fila.loteId)}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-rose-400 border border-slate-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* FILA DE SUMA EXACTA (Como en la Imagen 1) */}
                  {filasLote.length > 0 && (
                    <tr className="bg-slate-850/90 font-mono font-bold text-white border-t-2 border-slate-700">
                      <td colSpan={5} className="py-2.5 px-4 text-right uppercase tracking-wider text-slate-300">
                        SUMA:
                      </td>
                      <td className="py-2.5 px-2 text-center text-amber-300 font-black">
                        {liveCalculos.totalSacosProg}
                      </td>
                      <td className="py-2.5 px-2 text-center text-amber-300 font-black">
                        {liveCalculos.pesoTotalKg.toLocaleString()}
                      </td>
                      <td colSpan={13} className="py-2.5 px-2 text-slate-400 text-right text-[10px] font-sans">
                        Ponderación ponderada automática por peso programado
                      </td>
                    </tr>
                  )}

                  {/* FILA DE PROMEDIO EXACTA (Como en la Imagen 1 con fondo amarillo) */}
                  {filasLote.length > 0 && (
                    <tr className="bg-amber-500/15 border-t border-amber-500/40 font-mono font-black text-amber-300 text-xs">
                      <td colSpan={5} className="py-2.5 px-4 text-right uppercase tracking-widest">
                        <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 rounded font-black">
                          PROMEDIO:
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-white font-black">
                        {liveCalculos.totalSacosProg} sacos
                      </td>
                      <td className="py-2.5 px-2 text-center text-white font-black">
                        {liveCalculos.pesoTotalKg.toLocaleString()} kg
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-cyan-300 font-black text-sm bg-cyan-950/40">
                        {liveCalculos.promedios.ph}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.desv}
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.blInt}
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.blBlanco > 0 ? liveCalculos.promedios.blBlanco : "-"}
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.qi}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.qb}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.tt}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.tp}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.tpun}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.m}%
                      </td>
                      <td className="py-2.5 px-1.5 text-center text-slate-200">
                        {liveCalculos.promedios.triz}%
                      </td>
                      <td className="py-2.5 px-2 text-center font-black">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          liveCalculos.promedios.condicion === "APTO"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                            : "bg-rose-950 text-rose-300 border border-rose-700"
                        }`}>
                          {liveCalculos.promedios.condicion}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PANEL DE HOMOGENEIDAD & DESVIACIONES DEL BATCH (CONTROL DE TOLERANCIAS Y CALIDAD) */}
          <div className="bg-slate-900 rounded-2xl border border-slate-750 p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    Control de Homogeneidad & Desviaciones del Batch
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      evaluacionMezcla.esCompatible && evaluacionMezcla.mismoCliente
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                        : "bg-rose-950 text-rose-300 border border-rose-700"
                    }`}>
                      {evaluacionMezcla.esCompatible && evaluacionMezcla.mismoCliente ? "Mezcla Homogénea Conforme" : "Desviaciones Críticas Detectadas"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprobación de desviación máxima de cada lote respecto al promedio ponderado del batch (Tolerancia Humedad: ±{criteriosUnion.toleranciaHumedad}%, T.T: ±{criteriosUnion.toleranciaTotalTrizado}%, Q.I: ±{criteriosUnion.toleranciaQuebradoInt}%, Q.B: ±{criteriosUnion.toleranciaQuebradoBlanco}%).
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalCriteriosOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Ajustar Tolerancias de Planta
              </button>
            </div>

            {/* Matrix of Tolerances & Max Deviations by Parameter */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(evaluacionMezcla?.desviacionesPorParametro || []).map(p => {
                const desvMax = p.desviacionMaximaObservada ?? 0;
                const tol = p.toleranciaPermitida ?? 1.5;
                const isExceeded = desvMax > tol;
                return (
                  <div
                    key={p.parametro}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isExceeded
                        ? "bg-rose-950/30 border-rose-700/60 text-rose-200"
                        : "bg-slate-800/80 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-200">{p.nombre}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        isExceeded ? "bg-rose-900 text-rose-200" : "bg-emerald-950 text-emerald-300"
                      }`}>
                        Max: ±{tol}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Promedio:</span>
                        <span className="font-bold text-white text-sm">{(Number(p.promedioBatch) || 0).toFixed(1)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Desv. Máx:</span>
                        <span className={`font-black text-sm ${isExceeded ? "text-rose-400" : "text-emerald-400"}`}>
                          ±{(Number(desvMax) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {isExceeded && (
                      <div className="mt-1.5 pt-1.5 border-t border-rose-850 text-[10px] text-rose-300 font-medium">
                        ⚠️ Excede por +{Math.max(0, (Number(desvMax) || 0) - (Number(tol) || 0)).toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detailed Warnings Box if any */}
            {(evaluacionMezcla?.alertas || []).length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-400 uppercase text-[11px]">
                  <AlertTriangle className="w-4 h-4" />
                  Alertas de Calidad & Homogeneidad en la Mezcla:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                  {(evaluacionMezcla?.alertas || []).map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Technical Operating Parameters Determination Card (Matches Image 1 Text Rules) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: System & AI Technical Recommendation based on Image 1 rules */}
            <div className="bg-slate-900 rounded-2xl border border-slate-750 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Recomendación Técnica del Sistema (IA & Matriz)
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        parametrosRecomendados.modalidadPases === "2_PASES"
                          ? "bg-cyan-950 text-cyan-300 border-cyan-700"
                          : "bg-amber-950 text-amber-300 border-amber-700"
                      }`}>
                        {parametrosRecomendados.modalidadPases === "2_PASES" ? "2 PASES (ANTI-TRIZADO)" : "1 PASE (DIRECTO)"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Cálculo en base a los promedios de los lotes según reglas oficiales de planta
                    </p>
                  </div>
                </div>

                <button
                  onClick={aplicarRecomendacionIA}
                  className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition-colors active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Aplicar al Trabajo
                </button>
              </div>

              {/* Recommended KPI Values */}
              {parametrosRecomendados.modalidadPases === "2_PASES" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tarjeta 1° Pase IA */}
                    <div className="p-3 rounded-xl bg-slate-850 border border-amber-500/40 relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" /> 1° Pase (Acondicionamiento)
                        </span>
                        <span className="text-[9px] font-bold text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded">Pre-calentamiento</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Presión</div>
                          <div className="text-base font-black text-amber-300 font-mono mt-0.5">{parametrosRecomendados.presionPase1} <span className="text-[10px] font-normal">bar</span></div>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Reposo</div>
                          <div className="text-base font-black text-amber-300 font-mono mt-0.5">{parametrosRecomendados.tiempoReposoPase1} <span className="text-[10px] font-normal">min</span></div>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Esclusa</div>
                          <div className="text-base font-black text-amber-300 font-mono mt-0.5">V.{parametrosRecomendados.velExclusaPase1}</div>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 2° Pase IA */}
                    <div className="p-3 rounded-xl bg-slate-850 border border-cyan-500/40 relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" /> 2° Pase (Gelatinización)
                        </span>
                        <span className="text-[9px] font-bold text-cyan-300/80 bg-cyan-500/10 px-1.5 py-0.5 rounded">Cocción Principal</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Presión</div>
                          <div className="text-base font-black text-cyan-300 font-mono mt-0.5">{parametrosRecomendados.presionPase2} <span className="text-[10px] font-normal">bar</span></div>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Reposo</div>
                          <div className="text-base font-black text-cyan-300 font-mono mt-0.5">{parametrosRecomendados.tiempoReposoPase2} <span className="text-[10px] font-normal">min</span></div>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-750">
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Esclusa</div>
                          <div className="text-base font-black text-cyan-300 font-mono mt-0.5">V.{parametrosRecomendados.velExclusaPase2}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Temp Secado IA */}
                  <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 flex items-center justify-between px-4">
                    <div className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Temperatura del Cilindro de Secado Recomendada:</span>
                    </div>
                    <div className="text-base font-black text-amber-400 font-mono">{parametrosRecomendados.tempSecadoC} °C</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presión (DE.)</div>
                    <div className="text-xl font-black text-amber-400 mt-1 font-mono">{parametrosRecomendados.presionBar} bar</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Por Variedad y Humedad</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vel. Esclusa</div>
                    <div className="text-xl font-black text-amber-400 mt-1 font-mono">{parametrosRecomendados.velExclusa}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">A mayor presión, mayor vel.</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">T. Reposo</div>
                    <div className="text-xl font-black text-amber-400 mt-1 font-mono">{parametrosRecomendados.tiempoReposoMin} MIN</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Por Blancura y Silos</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temp. Secado</div>
                    <div className="text-xl font-black text-amber-400 mt-1 font-mono">{parametrosRecomendados.tempSecadoC} °C</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Cilindro de Secado</div>
                  </div>
                </div>
              )}

              {/* Plant Technical Rules Text Box (Quoting Image 1) */}
              <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-750 text-xs space-y-2 text-slate-300">
                <div className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5" />
                  Reglas Técnicas Oficiales de la Planta:
                </div>
                <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
                  <li><strong>Presión:</strong> Se toma en cuenta la variedad y la humedad promedio P(H).</li>
                  <li><strong>Velocidad de Esclusa:</strong> Se toma en cuenta la presión (a mayor presión, mayor velocidad de esclusa).</li>
                  <li><strong>Tiempo en Reposo:</strong> Se toma en cuenta Blancura Integral, Blancura de Pulido, Humedad, Temp. inicial y Añejamiento de Silos.</li>
                  <li><strong>Modalidad 2 Pases:</strong> Recomendada automáticamente para lotes con humedad crítica (&lt;14.5%) o trizado elevado (&gt;1.5%) para salvaguardar el grano entero.</li>
                </ul>
                <div className="pt-2 border-t border-slate-750 text-[11px] text-purple-300 font-medium italic">
                  💡 {parametrosRecomendados.justificacion}
                </div>
              </div>
            </div>

            {/* Right: Supervisor Final Determination */}
            <div className="bg-slate-900 rounded-2xl border border-slate-750 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Parámetros Determinados por el Supervisor
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Valores oficiales que se aplicarán en el autoclave y secadoras
                    </p>
                  </div>
                </div>

                {/* Selector de Modalidad: 1 Pase vs 2 Pases */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalidadPasesDet("1_PASE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modalidadPasesDet === "1_PASE"
                        ? "bg-amber-500 text-slate-950 font-black shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    1 Pase
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalidadPasesDet("2_PASES")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      modalidadPasesDet === "2_PASES"
                        ? "bg-cyan-500 text-slate-950 font-black shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>2 Pases</span>
                  </button>
                </div>
              </div>

              {/* Formulario según Modalidad de Pases */}
              {modalidadPasesDet === "2_PASES" ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Panel 1° Pase Supervisor */}
                    <div className="p-3.5 rounded-xl bg-slate-850/80 border-2 border-amber-500/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-amber-400" />
                          1° Pase (Acondicionamiento)
                        </span>
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                          Pase 1
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Presión 1° Pase (bar)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.05"
                            value={presionPase1Det}
                            onChange={e => setPresionPase1Det(Number(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 font-mono font-bold text-amber-400 text-sm focus:outline-none focus:border-amber-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">bar</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Sugerido: {parametrosRecomendados.presionPase1} bar</div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Tiempo Reposo 1° Pase (min)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            value={tiempoReposoPase1Det}
                            onChange={e => setTiempoReposoPase1Det(Number(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 font-mono font-bold text-amber-400 text-sm focus:outline-none focus:border-amber-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">MIN</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Sugerido: {parametrosRecomendados.tiempoReposoPase1} MIN</div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Vel. Esclusa 1° Pase
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={velExclPase1Det}
                          onChange={e => setVelExclPase1Det(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 font-mono font-bold text-amber-400 text-sm focus:outline-none focus:border-amber-500"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">Sugerido: {parametrosRecomendados.velExclusaPase1}</div>
                      </div>
                    </div>

                    {/* Panel 2° Pase Supervisor */}
                    <div className="p-3.5 rounded-xl bg-slate-850/80 border-2 border-cyan-500/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                        <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-cyan-400" />
                          2° Pase (Cocción Principal)
                        </span>
                        <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                          Pase 2
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Presión 2° Pase (bar)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.05"
                            value={presionPase2Det}
                            onChange={e => setPresionPase2Det(Number(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 font-mono font-bold text-cyan-300 text-sm focus:outline-none focus:border-cyan-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">bar</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Sugerido: {parametrosRecomendados.presionPase2} bar</div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Tiempo Reposo 2° Pase (min)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            value={tiempoReposoPase2Det}
                            onChange={e => setTiempoReposoPase2Det(Number(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 font-mono font-bold text-cyan-300 text-sm focus:outline-none focus:border-cyan-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">MIN</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Sugerido: {parametrosRecomendados.tiempoReposoPase2} MIN</div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Vel. Esclusa 2° Pase
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={velExclPase2Det}
                          onChange={e => setVelExclPase2Det(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 font-mono font-bold text-cyan-300 text-sm focus:outline-none focus:border-cyan-500"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">Sugerido: {parametrosRecomendados.velExclusaPase2}</div>
                      </div>
                    </div>
                  </div>

                  {/* Temp Secado para 2 Pases */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Temperatura de Secado Posterior (TEMP. SECADO)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tempSecadoDet}
                        onChange={e => setTempSecadoDet(Number(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-mono font-bold text-amber-400 text-base focus:outline-none focus:border-amber-500"
                      />
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold">°C</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Sugerido: {parametrosRecomendados.tempSecadoC} °C</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Presión en Bar (DE.)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        value={presionDet}
                        onChange={e => setPresionDet(Number(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-mono font-bold text-amber-400 text-base focus:outline-none focus:border-amber-500"
                      />
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold">bar</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Sugerido: {parametrosRecomendados.presionBar} bar</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Velocidad de Esclusa (V. EXCL.)
                    </label>
                    <input
                      type="number"
                      value={velExclDet}
                      onChange={e => setVelExclDet(Number(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-mono font-bold text-amber-400 text-base focus:outline-none focus:border-amber-500"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Sugerido: {parametrosRecomendados.velExclusa}</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Tiempo de Reposo (T. REPOSO)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tiempoReposoDet}
                        onChange={e => setTiempoReposoDet(Number(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-mono font-bold text-amber-400 text-base focus:outline-none focus:border-amber-500"
                      />
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold">MIN</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Sugerido: {parametrosRecomendados.tiempoReposoMin} MIN</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Temperatura de Secado (TEMP. SECADO)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tempSecadoDet}
                        onChange={e => setTempSecadoDet(Number(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 font-mono font-bold text-amber-400 text-base focus:outline-none focus:border-amber-500"
                      />
                      <span className="absolute right-3 top-3 text-xs text-slate-500 font-bold">°C</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Sugerido: {parametrosRecomendados.tempSecadoC} °C</div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  {!evaluacionMezcla.mismoCliente ? (
                    <span className="px-3 py-1 bg-rose-950/80 border border-rose-600 text-rose-300 font-bold rounded-lg flex items-center gap-1.5 shadow">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Bloqueado: Clientes distintos en el batch
                    </span>
                  ) : !evaluacionMezcla.variedadValida ? (
                    <span className="px-3 py-1 bg-rose-950/80 border border-rose-600 text-rose-300 font-bold rounded-lg flex items-center gap-1.5 shadow">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Bloqueado: Variedades distintas (requiere MEZCLA)
                    </span>
                  ) : evaluacionMezcla.bloqueadoPorDesviaciones || evaluacionMezcla.resumenParametros.some(r => !r.cumple) ? (
                    <span className="px-3 py-1 bg-amber-950/80 border border-amber-600 text-amber-300 font-bold rounded-lg flex items-center gap-1.5 shadow">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Bloqueado: Desviación de parámetros fuera de tolerancia
                    </span>
                  ) : filasLote.length > 0 ? (
                    <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-bold rounded-lg flex items-center gap-1.5 shadow">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Validación de Homogeneidad y Variedad Conforme
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Seleccione lotes para validar compatibilidad
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportarDesdeArmador}
                    disabled={filasLote.length === 0}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Exportar como Imagen PNG o Documento PDF para compartir por WhatsApp"
                  >
                    <Share2 className="w-4 h-4 text-amber-400" />
                    <span>Exportar / Compartir Ficha</span>
                  </button>

                  <button
                    onClick={() => setViewMode("resumen")}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleGuardarProgramacion(false)}
                    className={`px-5 py-2 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all ${
                      filasLote.length === 0 || !evaluacionMezcla.esCompatible || !evaluacionMezcla.mismoCliente || !evaluacionMezcla.variedadValida
                        ? "bg-amber-500/60 hover:bg-amber-500 text-slate-950 cursor-pointer"
                        : "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    Guardar en Programación Oficial
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: AUDITORÍA Y COMPARATIVA IA vs REAL                              */}
      {/* ========================================================================= */}
      {viewMode === "comparativa" && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-750 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Comparativa de Acierto: Recomendaciones del Sistema vs Parámetros Determinados
                </h2>
                <p className="text-xs text-slate-400">
                  Evaluación estadística de concordancia para calibrar la precisión de las fórmulas de planta y la IA.
                </p>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acierto Global</div>
                <div className="text-3xl font-black text-amber-400 mt-1 font-mono">{metricasAcierto.pctGlobal}%</div>
                <div className="text-[10px] text-emerald-400 mt-1">Concordancia Alta</div>
              </div>

              <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presión (DE.)</div>
                <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">{metricasAcierto.pctPresion}%</div>
                <div className="text-[10px] text-slate-400 mt-1">Margen $\pm$0.05 bar</div>
              </div>

              <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vel. Esclusa</div>
                <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">{metricasAcierto.pctEsclusa}%</div>
                <div className="text-[10px] text-slate-400 mt-1">Concordancia Exacta</div>
              </div>

              <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">T. Reposo</div>
                <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">{metricasAcierto.pctReposo}%</div>
                <div className="text-[10px] text-slate-400 mt-1">Margen $\pm$5 min</div>
              </div>

              <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temp. Secado</div>
                <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">{metricasAcierto.pctTemp}%</div>
                <div className="text-[10px] text-slate-400 mt-1">Margen $\pm$2 °C</div>
              </div>
            </div>

            {/* Detailed Batch Comparison List */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-200">
                <thead className="bg-slate-850 text-slate-400 text-[10px] uppercase font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Batch</th>
                    <th className="py-2.5 px-3">Fecha & Turno</th>
                    <th className="py-2.5 px-3">Lotes</th>
                    <th className="py-2.5 px-3 text-center">Presión (IA vs Det)</th>
                    <th className="py-2.5 px-3 text-center">Esclusa (IA vs Det)</th>
                    <th className="py-2.5 px-3 text-center">Reposo (IA vs Det)</th>
                    <th className="py-2.5 px-3 text-center">Secado (IA vs Det)</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {(programaciones || []).map(prog => {
                    const ia = prog.parametrosRecomendadosIA || { presionBar: 0.40, velExclusa: 6, tiempoReposoMin: 40, tempSecadoC: 80 };
                    const det = prog.parametrosDeterminados || { presionBar: 0.40, velExclusa: 6, tiempoReposoMin: 40, tempSecadoC: 80 };
                    const pSame = Math.abs(ia.presionBar - det.presionBar) < 0.05;
                    const vSame = ia.velExclusa === det.velExclusa;
                    const rSame = Math.abs(ia.tiempoReposoMin - det.tiempoReposoMin) <= 5;
                    const tSame = Math.abs(ia.tempSecadoC - det.tempSecadoC) <= 2;
                    const filas = Array.isArray(prog.filasLote) ? prog.filasLote : [];
                    const lotesStr = filas.map(f => f.loteId).join(", ") || prog.batch || "V200";

                    return (
                      <tr key={prog.id} className="hover:bg-slate-850/50">
                        <td className="py-2.5 px-3 font-black text-amber-400">{prog.batch}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{prog.fecha} ({prog.turno})</td>
                        <td className="py-2.5 px-3 text-cyan-400">{lotesStr}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={pSame ? "text-emerald-400" : "text-amber-400 font-bold"}>
                            {ia.presionBar} / {det.presionBar} bar
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={vSame ? "text-emerald-400" : "text-amber-400 font-bold"}>
                            {ia.velExclusa} / {det.velExclusa}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={rSame ? "text-emerald-400" : "text-amber-400 font-bold"}>
                            {ia.tiempoReposoMin}m / {det.tiempoReposoMin}m
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={tSame ? "text-emerald-400" : "text-amber-400 font-bold"}>
                            {ia.tempSecadoC}° / {det.tempSecadoC}°
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans font-bold">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700">
                            CALIBRADO
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 4: RESULTADOS - INCREMENTOS DE DEFECTOS & COCCIÓN EN OLLA */}
      {viewMode === "resultados" && (
        <ResultadosDefectosCoccionView
          programaciones={programaciones}
          batches={batches}
          lotes={lotes}
          analisisHumList={analisisHumedos}
          presecados={presecados}
          currentUser={currentUser}
          onNavigateToVaporizado={onNavigateToVaporizado}
          onSelectLoteForFicha={onSelectLoteForFicha}
          onRefreshData={onRefreshData}
        />
      )}

      {/* MODAL DE CONFIGURACIÓN DE CRITERIOS Y TOLERANCIAS PARA UNIR LOTES */}
      <ConfigCriteriosUnionLotesModal
        isOpen={isModalCriteriosOpen}
        onClose={() => setIsModalCriteriosOpen(false)}
        configActual={criteriosUnion}
        onSaveConfig={(nuevos) => {
          setCriteriosUnion(nuevos);
          setNotifMensaje("Criterios de unión y tolerancias de planta actualizados correctamente.");
          setTimeout(() => setNotifMensaje(null), 3000);
        }}
      />

      {/* MODAL PROMPT POST-CREACIÓN: PROCESAR BATCH INMEDIATAMENTE */}
      {batchCreadoPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                ¡Batch {batchCreadoPrompt.batch} Programado con Éxito!
              </h3>
              <p className="text-xs text-slate-300">
                Se programó {batchCreadoPrompt.caso} con {batchCreadoPrompt.kg.toLocaleString()} kg ({batchCreadoPrompt.sacos} sacos) distribuidos en {batchCreadoPrompt.lotesCount} lote(s).
              </p>
            </div>

            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-750 text-left space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Salida Automática de Programación</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Los lotes asignados han pasado a estado <span className="font-bold text-amber-300">"EN PROCESO"</span> y han salido automáticamente de la lista de lotes pendientes por programar.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                id="btn-modal-iniciar-proceso"
                onClick={() => {
                  const b = batchCreadoPrompt;
                  setBatchCreadoPrompt(null);
                  handleProcesarBatch({ batch: b.batch, id: b.batch });
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>PROCESAR BATCH AHORA (Ir a Control de Vaporizado)</span>
              </button>

              <button
                id="btn-modal-ver-resumen"
                onClick={() => setBatchCreadoPrompt(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Ver Sábana de Programación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE BATCH */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                  <Trash2 className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">¿Confirmar Eliminación del Batch?</h3>
                  <p className="text-xs text-slate-400">Esta acción liberará los lotes asignados</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-400">Batch Correlativo:</span>
                <span className="font-black text-amber-300 text-sm">{batchToDelete.batch} ({batchToDelete.caso})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Fecha & Turno:</span>
                <span className="font-semibold text-slate-200">{batchToDelete.fecha} ({batchToDelete.turno})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cliente:</span>
                <span className="font-semibold text-cyan-300">{batchToDelete.clientePrincipal || "Cliente"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Variedad:</span>
                <span className="font-semibold text-slate-200">{batchToDelete.variedadPrincipal || "Variedad"}</span>
              </div>
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-400">Carga Total:</span>
                <span className="font-bold text-emerald-400">{batchToDelete.pesoTotalKg?.toLocaleString()} kg ({batchToDelete.totalSacosProg} sacos)</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 block mb-1.5 font-bold text-amber-300">
                  Lotes que volverán a estar Disponibles / Pendientes ({batchToDelete.filasLote?.length || 0}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {batchToDelete.filasLote?.map((f, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-950/90 text-blue-200 border border-blue-700/60 text-[11px] font-mono font-bold flex items-center gap-1">
                      <span>{f.loteId}</span>
                      <span className="text-blue-400 font-normal">({f.pesoProg?.toLocaleString()} kg)</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-[11px] text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>Al confirmar, el registro saldrá de la Sábana Oficial y los lotes volverán inmediatamente al estado ANALIZADO para ser incluidos en una nueva programación.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBatchToDelete(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmarEliminarBatch}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? "Eliminando..." : "Sí, Eliminar Batch y Liberar Lotes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN RÁPIDA (PARÁMETROS Y OBSERVACIONES) */}
      {batchToQuickEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3 text-cyan-400">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <Sliders className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edición Rápida de Parámetros</h3>
                  <p className="text-xs text-slate-400">Batch {batchToQuickEdit.batch} ({batchToQuickEdit.caso})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchToQuickEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Nombre del Caso / Identificador</label>
                  <input
                    type="text"
                    value={quickEditData.caso}
                    onChange={(e) => setQuickEditData(prev => ({ ...prev, caso: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Turno</label>
                  <select
                    value={quickEditData.turno}
                    onChange={(e) => setQuickEditData(prev => ({ ...prev, turno: e.target.value as "DIA" | "NOCHE" }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="DIA">Turno Día</option>
                    <option value="NOCHE">Turno Noche</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                    Parámetros Operativos de Planta
                  </div>
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setQuickEditData(prev => ({ ...prev, modalidadPases: "1_PASE" }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                        quickEditData.modalidadPases === "1_PASE"
                          ? "bg-amber-500 text-slate-950 font-black"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      1 Pase
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickEditData(prev => ({ ...prev, modalidadPases: "2_PASES" }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                        quickEditData.modalidadPases === "2_PASES"
                          ? "bg-cyan-500 text-slate-950 font-black"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      2 Pases
                    </button>
                  </div>
                </div>

                {quickEditData.modalidadPases === "2_PASES" ? (
                  <div className="space-y-3">
                    {/* 1° Pase */}
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/40">
                      <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> 1° Pase (Acondicionamiento)
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Presión (bar)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={quickEditData.presionPase1}
                            onChange={(e) => setQuickEditData(prev => ({ ...prev, presionPase1: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono font-bold text-center text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Reposo (min)</label>
                          <input
                            type="number"
                            step="1"
                            value={quickEditData.tiempoReposoPase1}
                            onChange={(e) => setQuickEditData(prev => ({ ...prev, tiempoReposoPase1: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono font-bold text-center text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Vel. Esclusa</label>
                          <input
                            type="number"
                            step="1"
                            value={quickEditData.velExclusaPase1}
                            onChange={(e) => setQuickEditData(prev => ({ ...prev, velExclusaPase1: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono font-bold text-center text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2° Pase */}
                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/40">
                      <div className="text-[10px] font-black text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> 2° Pase (Cocción Principal)
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Presión (bar)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={quickEditData.presionPase2}
                            onChange={(e) => setQuickEditData(prev => ({ ...prev, presionPase2: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono font-bold text-center text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Reposo (min)</label>
                          <input
                            type="number"
                            step="1"
                            value={quickEditData.tiempoReposoPase2}
                            onChange={(e) => setQuickEditData(prev => ({ ...prev, tiempoReposoPase2: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono font-bold text-center text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 block mb-0.5">Vel. Esclusa</label>
                          <input
                            type="number"
                            step="1"
                            value={quickEditData.velExclusaPase2}
                            onChange={(e) => setQuickEditData(prev => ({ ...prev, velExclusaPase2: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono font-bold text-center text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Temp Secado */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Temperatura de Secado (°C)</label>
                      <input
                        type="number"
                        step="1"
                        value={quickEditData.tempSecadoC}
                        onChange={(e) => setQuickEditData(prev => ({ ...prev, tempSecadoC: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Presión (bar)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={quickEditData.presionBar}
                        onChange={(e) => setQuickEditData(prev => ({ ...prev, presionBar: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Vel. Esclusa</label>
                      <input
                        type="number"
                        step="1"
                        value={quickEditData.velExclusa}
                        onChange={(e) => setQuickEditData(prev => ({ ...prev, velExclusa: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">T. Reposo (min)</label>
                      <input
                        type="number"
                        step="5"
                        value={quickEditData.tiempoReposoMin}
                        onChange={(e) => setQuickEditData(prev => ({ ...prev, tiempoReposoMin: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">T. Secado (°C)</label>
                      <input
                        type="number"
                        step="1"
                        value={quickEditData.tempSecadoC}
                        onChange={(e) => setQuickEditData(prev => ({ ...prev, tempSecadoC: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Observaciones / Notas de Turno</label>
                <textarea
                  rows={2}
                  value={quickEditData.observacion}
                  onChange={(e) => setQuickEditData(prev => ({ ...prev, observacion: e.target.value }))}
                  placeholder="Observaciones de calidad, acondicionamiento o contingencia..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const p = batchToQuickEdit;
                  setBatchToQuickEdit(null);
                  handleEditarBatch(p);
                }}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ir al Armador Completo (Modificar Lotes)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBatchToQuickEdit(null)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarEdicionRapida}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-600/30 transition-all active:scale-95 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Parámetros</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERACTIVO DE VALIDACIÓN & APROBACIÓN TÉCNICA (Evita alert/confirm nativo) */}
      {dialogModal && dialogModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={`bg-slate-900 border-2 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 ${
            dialogModal.tipo === "error" 
              ? "border-rose-500/60 shadow-rose-950/40" 
              : dialogModal.tipo === "confirm-deviation" || dialogModal.tipo === "confirm-weight" || dialogModal.tipo === "warning"
              ? "border-amber-500/60 shadow-amber-950/40"
              : "border-cyan-500/60 shadow-cyan-950/40"
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  dialogModal.tipo === "error"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : dialogModal.tipo === "confirm-deviation" || dialogModal.tipo === "confirm-weight" || dialogModal.tipo === "warning"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                }`}>
                  {dialogModal.tipo === "error" ? (
                    <AlertOctagon className="w-6 h-6" />
                  ) : dialogModal.tipo === "confirm-deviation" || dialogModal.tipo === "confirm-weight" || dialogModal.tipo === "warning" ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <Info className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{dialogModal.titulo}</h3>
                  <p className="text-xs text-slate-400">Validación de Reglas de Programación y Calidad</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (dialogModal.onSecundario) dialogModal.onSecundario();
                  setDialogModal(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-200 leading-relaxed font-medium">
                {dialogModal.mensaje}
              </p>

              {dialogModal.detalles && dialogModal.detalles.length > 0 && (
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px]">
                  {dialogModal.detalles.map((det, i) => (
                    <div key={i} className="text-amber-300/90 flex items-start gap-1.5">
                      <span className="text-amber-500">•</span>
                      <span>{det}</span>
                    </div>
                  ))}
                </div>
              )}

              {dialogModal.tipo === "confirm-deviation" && (
                <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-xl text-[11px] text-amber-200/90 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Al confirmar la <strong>Aprobación Técnica</strong>, el Batch se guardará registrado en estado <strong>OBSERVADO</strong> permitiendo su avance sin bloquear la operación de planta.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              {dialogModal.textoBotonSecundario && (
                <button
                  type="button"
                  onClick={() => {
                    if (dialogModal.onSecundario) dialogModal.onSecundario();
                    setDialogModal(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {dialogModal.textoBotonSecundario}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (dialogModal.onConfirmar) {
                    dialogModal.onConfirmar();
                  } else {
                    setDialogModal(null);
                  }
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
                  dialogModal.tipo === "error"
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                    : dialogModal.tipo === "confirm-deviation"
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 font-black"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30"
                }`}
              >
                {dialogModal.tipo === "confirm-deviation" && <Zap className="w-4 h-4 fill-current" />}
                <span>{dialogModal.textoBotonPrincipal}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportación de Programación (Imagen PNG / PDF / Compartir WhatsApp) */}
      <ExportarProgramacionModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        programacionSeleccionada={batchParaExportar}
        todasLasProgramaciones={programacionesFiltradas.length > 0 ? programacionesFiltradas : programaciones}
        capacidadMaximaKg={capacidadMaximaKg}
        filtroTurno={filtroTurno}
        filtroFecha={filtroFecha}
      />
    </div>
  );
};
