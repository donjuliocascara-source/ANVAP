import React, { useState, useMemo, useEffect } from "react";
import { 
  Lote, 
  AnalisisHumedo, 
  Presecado,
  PriorizacionMasterConfig, 
  PriorizacionLote, 
  NivelRiesgoLote, 
  Equipo,
  CambioOrdenAuditoria,
  AIPlanProgramacionDia,
  ProgramacionApit,
  BatchVaporizado,
  AIRecommendation,
  UserProfile
} from "../types";
import { 
  calcularPrioridadesLotes,
  ordenarLotesPorPrioridad,
  CONFIG_PRIORIZACION_DEFAULT
} from "../utils/priorizacionService";
import { 
  clasificarLotes, 
  esLotePendiente 
} from "../utils/loteClassification";
import { ConfigPriorizacionModal } from "./ConfigPriorizacionModal";
import { AIPlanificadorDiarioModal } from "./AIPlanificadorDiarioModal";
import { ProgramacionBatchOficialView } from "./ProgramacionBatchOficialView";
import { ViewErrorBoundary } from "./ViewErrorBoundary";
import { ConfigCriteriosUnionLotesModal } from "./ConfigCriteriosUnionLotesModal";
import { 
  CriteriosUnionLotesConfig,
  obtenerCriteriosUnionGuardados
} from "../utils/criteriosUnionLotes";
import { verificarAptitudProgramacionLote } from "../utils/evaluacionCalidad";
import { localDB } from "../utils/localDB";
import { 
  cargarProgramacionesOficiales, 
  obtenerInfoLoteEnBatches 
} from "../utils/programacionBatchOficialService";
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sliders, 
  BrainCircuit, 
  Sparkles, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Layers, 
  HelpCircle, 
  Calendar, 
  Flame, 
  History, 
  Info,
  ShieldAlert,
  Edit3,
  Check,
  X,
  Plus,
  CalendarCheck,
  Save,
  Loader2,
  Trash2,
  Scale,
  Gauge,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  CheckSquare,
  Square,
  Users,
  Lock
} from "lucide-react";

interface PriorizacionProgramacionViewProps {
  lotes: Lote[];
  analisisHumedos: AnalisisHumedo[];
  presecados?: Presecado[];
  programaciones?: ProgramacionApit[];
  batches?: BatchVaporizado[];
  batchLotes?: any[];
  equipos?: Equipo[];
  config: PriorizacionMasterConfig;
  initialLoteId?: string;
  currentUser?: UserProfile | { nombre: string; rol: string };
  onUpdateConfig: (newCfg: PriorizacionMasterConfig) => Promise<void> | void;
  onSelectLoteForFicha: (loteId: string) => void;
  onSaveProgramacion: (prog: Partial<ProgramacionApit>) => Promise<void>;
  onSaveBatch?: (batchData: Partial<BatchVaporizado>, assignedLotes: any[]) => Promise<void>;
  onDeleteBatch?: (batchId: string) => Promise<void>;
  onRefreshData?: () => void;
  onApplyPlanToProgramacion?: (plan: AIPlanProgramacionDia) => void;
  onRequestAIRecommendation?: (loteId: string) => Promise<AIRecommendation>;
  onNavigate?: (tab: string, filterId?: string) => void;
  parametros?: any;
  historialParametros?: any;
  onSaveParametros?: any;
}

export const PriorizacionProgramacionView: React.FC<PriorizacionProgramacionViewProps> = ({
  lotes = [],
  analisisHumedos = [],
  presecados = [],
  programaciones = [],
  batches = [],
  batchLotes = [],
  equipos = [],
  config = CONFIG_PRIORIZACION_DEFAULT,
  initialLoteId,
  currentUser = { nombre: "Ing. Carlos Mendoza", rol: "JEFE_PLANTA" },
  onUpdateConfig,
  onSelectLoteForFicha,
  onSaveProgramacion,
  onSaveBatch,
  onDeleteBatch,
  onRefreshData,
  onApplyPlanToProgramacion,
  onRequestAIRecommendation,
  onNavigate
}) => {
  // Main Sub-Tab: "programacion_oficial" (Default) | "matriz"
  const [activeSubTab, setActiveSubTab] = useState<"programacion_oficial" | "matriz">("programacion_oficial");

  // Selection of lot IDs for building an official batch
  const [lotesForBatchOficial, setLotesForBatchOficial] = useState<string[]>(
    initialLoteId && initialLoteId !== "nuevo-batch" && initialLoteId !== "crear-batch" && initialLoteId !== "armador"
      ? [initialLoteId]
      : initialLoteId
      ? ["nuevo-batch"]
      : []
  );

  // Sync incoming navigation with official batch builder
  useEffect(() => {
    if (initialLoteId) {
      setActiveSubTab("programacion_oficial");
      if (initialLoteId === "nuevo-batch" || initialLoteId === "crear-batch" || initialLoteId === "armador") {
        setLotesForBatchOficial(["nuevo-batch"]);
      } else {
        setLotesForBatchOficial([initialLoteId]);
      }
    }
  }, [initialLoteId]);

  // Multi-lot selection checkboxes in Matriz view
  const [selectedLoteIdsInMatrix, setSelectedLoteIdsInMatrix] = useState<string[]>([]);

  // Filters & Search in Matriz
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRiesgo, setFilterRiesgo] = useState<string>("TODOS");
  const [filterVariedad, setFilterVariedad] = useState<string>("TODAS");
  const [filterCalidad, setFilterCalidad] = useState<string>("TODOS");
  const [filterEstado, setFilterEstado] = useState<string>("TODOS");
  
  // Date simulation state (simulate aging in storage)
  const [diasSimulacionAdicionales, setDiasSimulacionAdicionales] = useState(0);

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isCriteriosUnionModalOpen, setIsCriteriosUnionModalOpen] = useState(false);
  const [criteriosUnion, setCriteriosUnion] = useState<CriteriosUnionLotesConfig>(() => obtenerCriteriosUnionGuardados());
  const [selectedLoteForFormula, setSelectedLoteForFormula] = useState<PriorizacionLote | null>(null);

  // Manual reordering state
  const [reorderModalLote, setReorderModalLote] = useState<PriorizacionLote | null>(null);
  const [manualNewPosition, setManualNewPosition] = useState<number>(1);
  const [manualReorderReason, setManualReorderReason] = useState<string>("");
  const [manualOverrides, setManualOverrides] = useState<Record<string, { pos: number; motivo: string; usuario: string; fecha: string }>>({});
  const [auditLog, setAuditLog] = useState<CambioOrdenAuditoria[]>([]);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string; type?: "warning" | "error" | "info" } | null>(null);

  // Calculate simulated date if stepping days
  const fechaReferencia = useMemo(() => {
    const d = new Date();
    if (diasSimulacionAdicionales !== 0) {
      d.setDate(d.getDate() + diasSimulacionAdicionales);
    }
    return d.toISOString().split("T")[0];
  }, [diasSimulacionAdicionales]);

  // Compute calculated lots priority (EXCLUSIVELY FOR PENDING LOTS)
  const calculatedLots = useMemo(() => {
    const prioritizados = calcularPrioridadesLotes(lotes, analisisHumedos, config, fechaReferencia, true);

    if (Object.keys(manualOverrides).length === 0) {
      return prioritizados;
    }

    const items = prioritizados.map(item => {
      const override = manualOverrides[item.loteId];
      if (override) {
        return {
          ...item,
          posicion: override.pos,
          cambioManual: {
            ordenOriginal: item.posicionOriginal,
            ordenManual: override.pos,
            usuario: override.usuario,
            fechaHora: override.fecha,
            motivo: override.motivo
          }
        };
      }
      return item;
    });

    return items.sort((a, b) => a.posicion - b.posicion);
  }, [lotes, analisisHumedos, config, fechaReferencia, manualOverrides]);

  // KPIs
  const kpis = useMemo(() => {
    const emergencias = calculatedLots.filter(l => l.nivelRiesgo === "EMERGENCIA");
    const altos = calculatedLots.filter(l => l.nivelRiesgo === "ALTO");
    const medios = calculatedLots.filter(l => l.nivelRiesgo === "MEDIO");
    const bajos = calculatedLots.filter(l => l.nivelRiesgo === "BAJO");
    const totalSacos = calculatedLots.reduce((acc, l) => acc + (l.sacos || 0), 0);
    const totalPesoTn = calculatedLots.reduce((acc, l) => acc + (l.pesoTn || 0), 0);

    return {
      total: calculatedLots.length,
      emergencias: emergencias.length,
      altos: altos.length,
      medios: medios.length,
      bajos: bajos.length,
      totalSacos,
      totalPesoTn: Number(totalPesoTn.toFixed(1))
    };
  }, [calculatedLots]);

  // Filtered lots for display in Matriz
  const filteredLots = useMemo(() => {
    return calculatedLots.filter(l => {
      if (filterRiesgo !== "TODOS" && l.nivelRiesgo !== filterRiesgo) return false;
      if (filterVariedad !== "TODAS" && l.variedad !== filterVariedad) return false;
      if (filterCalidad !== "TODOS" && l.estadoCalidad !== filterCalidad) return false;
      if (filterEstado !== "TODOS" && l.estadoLote !== filterEstado) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          l.loteId.toLowerCase().includes(q) ||
          l.cliente.toLowerCase().includes(q) ||
          l.variedad.toLowerCase().includes(q) ||
          l.zona.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [calculatedLots, filterRiesgo, filterVariedad, filterCalidad, filterEstado, searchTerm]);

  // Unique varieties for filter
  const uniqueVarieties = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach(l => {
      if (l.VARIEDAD) set.add(l.VARIEDAD);
    });
    return Array.from(set);
  }, [lotes]);

  // Calculations for selected lots in Matriz
  const selectedLotesData = useMemo(() => {
    return calculatedLots.filter(l => selectedLoteIdsInMatrix.includes(l.loteId));
  }, [calculatedLots, selectedLoteIdsInMatrix]);

  const totalSacosSel = useMemo(() => {
    return selectedLotesData.reduce((sum, l) => sum + (l.sacos || 0), 0);
  }, [selectedLotesData]);

  const totalKgSel = useMemo(() => {
    const lotesMap = new Map<string, Lote>();
    for (const item of lotes) {
      if (item.LOTE_ID) lotesMap.set(item.LOTE_ID, item);
    }
    return selectedLotesData.reduce((sum, l) => {
      const loteObj = lotesMap.get(l.loteId);
      const kg = loteObj?.PESO_KG || (l.sacos || 0) * 50;
      return sum + kg;
    }, 0);
  }, [selectedLotesData, lotes]);

  const totalTnSel = totalKgSel / 1000;
  const capacidadNominalKg = 35000; // 35 TN tope operativo
  const pctCargaAutoclave = Math.min(100, (totalKgSel / capacidadNominalKg) * 100);

  const humPromSel = useMemo(() => {
    if (selectedLotesData.length === 0 || totalSacosSel === 0) return 0;
    const weightedHum = selectedLotesData.reduce((sum, l) => sum + (l.humedad * (l.sacos || 1)), 0);
    return Number((weightedHum / totalSacosSel).toFixed(1));
  }, [selectedLotesData, totalSacosSel]);

  // Clientes de los lotes actualmente seleccionados
  const clientesSeleccionados = useMemo(() => {
    const setCli = new Set<string>();
    for (const l of selectedLotesData) {
      if (l.cliente) setCli.add(l.cliente.trim());
    }
    return Array.from(setCli);
  }, [selectedLotesData]);

  const esUnicoClienteSeleccionado = clientesSeleccionados.length <= 1;

  // Toggle selection of a lot
  const handleToggleSelectLote = (loteId: string) => {
    const loteObj = lotes.find(l => l.LOTE_ID === loteId);
    const ahObj = analisisHumedos.find(a => a.LOTE_ID === loteId);
    const aptitud = verificarAptitudProgramacionLote(loteObj, ahObj);

    const progsOficiales = cargarProgramacionesOficiales();
    const batchInfo = obtenerInfoLoteEnBatches(loteId, progsOficiales, batches);

    if (!selectedLoteIdsInMatrix.includes(loteId)) {
      if (batchInfo.estaProgramado) {
        setNoticeModal({
          title: "Lote Ya Programado (No Repetible)",
          message: `El lote ${loteId} ya se encuentra asignado al Batch ${batchInfo.batchCodigo} (${batchInfo.caso}). Por normativa de planta, los lotes no se pueden repetir ni programar en más de un batch.`,
          type: "warning"
        });
        return;
      }

      if (!aptitud.esProgramable) {
        setNoticeModal({
          title: "Lote Bloqueado por Calidad",
          message: `Solo se pueden programar lotes APROBADOS (Aptos) u OBSERVADOS.\n\nLote: ${loteId} — Estado: ${aptitud.label}\nMotivo: ${aptitud.motivoBloqueo || "No cumple con las tolerancias de calidad requeridas."}`,
          type: "error"
        });
        return;
      }
    }

    const clienteLote = (loteObj?.CLIENTE || "").trim();

    setSelectedLoteIdsInMatrix(prev => {
      if (prev.includes(loteId)) {
        return prev.filter(id => id !== loteId);
      } else {
        // Warning if selecting a different client when criteria is active
        if (criteriosUnion.exigirMismoCliente && prev.length > 0) {
          const primerLote = lotes.find(l => l.LOTE_ID === prev[0]);
          const primerCliente = (primerLote?.CLIENTE || "").trim();
          if (primerCliente && clienteLote && primerCliente.toLowerCase() !== clienteLote.toLowerCase()) {
            setNoticeModal({
              title: "Regla de Planta: Cliente Único",
              message: `El lote ${loteId} pertenece a "${clienteLote}", pero ya tiene seleccionado(s) lote(s) de "${primerCliente}". Todos los lotes del Batch deben pertenecer al mismo cliente.`,
              type: "warning"
            });
            return prev;
          }

          // Variedad distinta sin ser mezcla
          const variedadNueva = (loteObj?.VARIEDAD || "").trim();
          const primerVariedad = (primerLote?.VARIEDAD || "").trim();
          const esMezclaNueva = variedadNueva.toLowerCase().includes("mezcla") || variedadNueva.toLowerCase().includes("mix");
          const esMezclaPrimera = primerVariedad.toLowerCase().includes("mezcla") || primerVariedad.toLowerCase().includes("mix");

          if (variedadNueva && primerVariedad && variedadNueva.toLowerCase() !== primerVariedad.toLowerCase() && !esMezclaNueva && !esMezclaPrimera) {
            setNoticeModal({
              title: "Regla de Variedad",
              message: `El lote ${loteId} es variedad "${variedadNueva}", distinta a "${primerVariedad}". Solo se permite unir variedades distintas si la variedad está descrita como MEZCLA.`,
              type: "warning"
            });
            return prev;
          }
        }
        return [...prev, loteId];
      }
    });
  };

  // Toggle select all filtered lots
  const handleToggleSelectAllFiltered = () => {
    if (selectedLoteIdsInMatrix.length === filteredLots.length && filteredLots.length > 0) {
      setSelectedLoteIdsInMatrix([]);
    } else {
      const progsOficiales = cargarProgramacionesOficiales();
      const lotesMap = new Map(lotes.map(item => [item.LOTE_ID, item]));
      const ahMap = new Map(analisisHumedos.map(a => [a.LOTE_ID, a]));
      // Filtrar solo los lotes que sean aptos u observados Y que no estén ya programados en otro batch
      const programables = filteredLots.filter(l => {
        const loteObj = lotesMap.get(l.loteId);
        const ahObj = ahMap.get(l.loteId);
        const aptitud = verificarAptitudProgramacionLote(loteObj, ahObj);
        const batchInfo = obtenerInfoLoteEnBatches(l.loteId, progsOficiales, batches);
        return aptitud.esProgramable && !batchInfo.estaProgramado;
      });
      setSelectedLoteIdsInMatrix(programables.map(l => l.loteId));
    }
  };

  // Trigger building official batch with selected lots
  const handleProgramarEnOficialBatch = (loteIds: string[]) => {
    if (!loteIds || loteIds.length === 0) return;
    const progsOficiales = cargarProgramacionesOficiales();

    // 0. Validar lotes ya programados (Regla: no repetir)
    const yaProgramados = loteIds.filter(lid => {
      const batchInfo = obtenerInfoLoteEnBatches(lid, progsOficiales, batches);
      return batchInfo.estaProgramado;
    });

    if (yaProgramados.length > 0) {
      setNoticeModal({
        title: "Acción Denegada: Lotes ya Programados",
        message: `Los siguientes lotes ya están comprometidos en batches existentes y no se pueden repetir:\n${yaProgramados.join(", ")}\n\nPor normativa de planta, los lotes no se pueden repetir.`,
        type: "warning"
      });
      return;
    }

    // 1. Validar aptitud
    const invalidos = loteIds.filter(lid => {
      const loteObj = lotes.find(item => item.LOTE_ID === lid);
      const ahObj = analisisHumedos.find(a => a.LOTE_ID === lid);
      return !verificarAptitudProgramacionLote(loteObj, ahObj).esProgramable;
    });

    if (invalidos.length > 0) {
      setNoticeModal({
        title: "Acción Denegada: Lotes no Aptos",
        message: `Los siguientes lotes no son programables (Rechazados / No Aptos):\n${invalidos.join(", ")}\n\nSolo se permite programar lotes APROBADOS (Aptos) u OBSERVADOS.`,
        type: "error"
      });
      return;
    }

    setLotesForBatchOficial(loteIds);
    setActiveSubTab("programacion_oficial");
  };

  // Manual Reordering Submit
  const handleSaveManualReorder = async () => {
    if (!reorderModalLote) return;
    if (!manualReorderReason.trim()) {
      setNoticeModal({
        title: "Motivo Requerido",
        message: "Por favor ingrese el motivo del reordenamiento manual para registro de auditoría.",
        type: "info"
      });
      return;
    }

    const posNueva = Math.max(1, Math.min(calculatedLots.length, manualNewPosition));
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const overrideRecord = {
      pos: posNueva,
      motivo: manualReorderReason,
      usuario: currentUser.nombre,
      fecha: nowStr
    };

    setManualOverrides(prev => ({
      ...prev,
      [reorderModalLote.loteId]: overrideRecord
    }));

    const newAudit: CambioOrdenAuditoria = {
      id: `AUD-${Date.now()}`,
      loteId: reorderModalLote.loteId,
      posicionAnterior: reorderModalLote.posicion,
      posicionNueva: posNueva,
      usuario: currentUser.nombre,
      fechaHora: nowStr,
      motivo: manualReorderReason
    };

    setAuditLog(prev => [newAudit, ...prev]);

    try {
      localDB.addPriorizacionAudit(newAudit, currentUser.nombre);
    } catch (e) {
      console.warn("Error guardando log de auditoría local:", e);
    }

    setReorderModalLote(null);
    setManualReorderReason("");
  };

  const handleResetManualReorder = (loteId: string) => {
    setManualOverrides(prev => {
      const next = { ...prev };
      delete next[loteId];
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-750 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Priorización y Programación Oficial APIT</span>
                {kpis.emergencias > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/40 flex items-center gap-1 animate-pulse">
                    <AlertOctagon className="w-3.5 h-3.5" />
                    {kpis.emergencias} Emergencias
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">
                Programación técnica de Batches de 35 TN, cálculo analítico ponderado y matriz de priorización por riesgo de almacenamiento.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-ai-plan-dia"
            onClick={() => setIsAIModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <BrainCircuit className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Planificador Diario con IA</span>
          </button>

          <button
            id="btn-criterios-union"
            onClick={() => setIsCriteriosUnionModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Criterios para Unir Lotes</span>
          </button>

          <button
            id="btn-config-priorizacion"
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Criterios & Pesos</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row - Compacto */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div className="bg-slate-800/80 border border-slate-700/70 px-2.5 py-1.5 rounded-lg flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lotes Pendientes</div>
          <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
            <div className="text-base font-black text-white">{kpis.total}</div>
            <div className="text-[10px] font-medium text-slate-400">{kpis.totalSacos} sacos ({kpis.totalPesoTn} TN)</div>
          </div>
        </div>

        <div className="bg-rose-950/20 border border-rose-800/40 px-2.5 py-1.5 rounded-lg flex flex-col justify-between">
          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-rose-400 shrink-0" />
            <span>Emergencia</span>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
            <div className="text-base font-black text-rose-300">{kpis.emergencias}</div>
            <div className="text-[10px] text-rose-400/80">Score &ge; 96 pts / Crítico</div>
          </div>
        </div>

        <div className="bg-amber-950/20 border border-amber-800/40 px-2.5 py-1.5 rounded-lg flex flex-col justify-between">
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Riesgo Alto</span>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
            <div className="text-base font-black text-amber-300">{kpis.altos}</div>
            <div className="text-[10px] text-amber-400/80">Score 90 - 95 pts</div>
          </div>
        </div>

        <div className="bg-blue-950/20 border border-blue-800/40 px-2.5 py-1.5 rounded-lg flex flex-col justify-between">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400 shrink-0" />
            <span>Riesgo Medio</span>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
            <div className="text-base font-black text-blue-300">{kpis.medios}</div>
            <div className="text-[10px] text-blue-400/80">Score 85 - 89 pts</div>
          </div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-800/40 px-2.5 py-1.5 rounded-lg flex flex-col justify-between">
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Riesgo Bajo</span>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
            <div className="text-base font-black text-emerald-300">{kpis.bajos}</div>
            <div className="text-[10px] text-emerald-400/80">Score &le; 84 pts</div>
          </div>
        </div>
      </div>

      {/* PROGRAMACIÓN DE BATCH OFICIAL (FORMATO OFICIAL PLANTA & RESUMEN) */}
      {activeSubTab === "programacion_oficial" && (
        <ViewErrorBoundary viewName="Programación de Batch Oficial">
          <ProgramacionBatchOficialView
            lotes={lotes}
            analisisHumedos={analisisHumedos}
            presecados={presecados}
            batches={batches}
            batchLotes={batchLotes}
            currentUser={currentUser}
            initialLoteIds={lotesForBatchOficial}
            onClearInitialLotes={() => setLotesForBatchOficial([])}
            onNavigateToVaporizado={(batchId) => {
              if (onNavigate) onNavigate("control-vaporizado", batchId);
            }}
            onSelectLoteForFicha={onSelectLoteForFicha}
            onSaveBatch={onSaveBatch}
            onDeleteBatch={onDeleteBatch}
            onRefreshData={onRefreshData}
          />
        </ViewErrorBoundary>
      )}

      {/* SUB-VIEW 2: MATRIZ COMPLETA DE PRIORIZACIÓN CON SELECCIÓN DIRECTA A BATCH V200 */}
      {activeSubTab === "matriz" && (
        <div className="space-y-4">
          {/* FLOATING / STICKY BATCH PREPARATION BAR (WHEN LOTS ARE SELECTED) */}
          {selectedLoteIdsInMatrix.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 p-4 rounded-2xl shadow-2xl border-2 border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-lg shadow-inner">
                  {selectedLoteIdsInMatrix.length}
                </div>
                <div>
                  <div className="font-black text-sm text-slate-950 uppercase tracking-wide flex items-center gap-2">
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Lotes Seleccionados para Batch Oficial</span>
                  </div>
                  <div className="text-xs text-slate-900 font-semibold mt-0.5 flex flex-wrap items-center gap-3 font-mono">
                    <span><strong>Sacos:</strong> {totalSacosSel} sacos</span>
                    <span>•</span>
                    <span><strong>Peso:</strong> {totalKgSel.toLocaleString()} kg ({(Number(totalTnSel) || 0).toFixed(2)} TN)</span>
                    <span>•</span>
                    <span><strong>P(H) Estimada:</strong> {humPromSel}%</span>
                  </div>
                </div>
              </div>

              {/* Autoclave Load Progress (35 TN Limit) */}
              <div className="flex-1 max-w-xs bg-slate-950/20 p-2.5 rounded-xl border border-slate-950/20">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-950 mb-1">
                  <span>Capacidad Autoclave (35 TN):</span>
                  <span>{totalKgSel.toLocaleString()} / 35,000 kg</span>
                </div>
                <div className="w-full bg-slate-950/30 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      totalKgSel > 35000 ? "bg-rose-900" : "bg-slate-950"
                    }`}
                    style={{ width: `${pctCargaAutoclave}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-900 font-bold mt-0.5 text-right">
                  {totalKgSel <= 35000 ? (
                    `Quedan ${(35000 - totalKgSel).toLocaleString()} kg disponibles`
                  ) : (
                    `⚠️ Excede 35 TN (Se ajustará automáticamente)`
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-limpiar-seleccion-matriz"
                  onClick={() => setSelectedLoteIdsInMatrix([])}
                  className="px-3 py-2 bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Deseleccionar ({selectedLoteIdsInMatrix.length})
                </button>
                <button
                  id="btn-programar-batch-seleccionados"
                  onClick={() => handleProgramarEnOficialBatch(selectedLoteIdsInMatrix)}
                  className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-400 hover:text-amber-300 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer ring-2 ring-slate-950"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>⚡ Programar en Batch Oficial</span>
                </button>
              </div>
            </div>
          )}

          {/* MATRIZ TABLE CONTAINER */}
          <div className="bg-slate-850 p-5 rounded-2xl border border-slate-750 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-750 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Matriz Completa de Priorización y Evaluación Organoléptica
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seleccione uno o varios lotes para conformar un <strong>Batch Oficial de 35 TN</strong> con cálculo analítico ponderado.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar por lote, cliente, variedad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-48 sm:w-64"
                  />
                </div>

                {/* Quality / Aptitude Filter */}
                <select
                  value={filterCalidad}
                  onChange={(e) => setFilterCalidad(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  title="Filtrar por Aptitud de Calidad"
                >
                  <option value="TODOS">Toda Aptitud (Aprob/Obs/Exp)</option>
                  <option value="APROBADO">✓ Solo Aprobados (Aptos)</option>
                  <option value="OBSERVADO">⚠️ Solo Observados</option>
                  <option value="EXPERIMENTAL">🧪 Solo Experimentales</option>
                </select>

                {/* Risk Filter */}
                <select
                  value={filterRiesgo}
                  onChange={(e) => setFilterRiesgo(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="TODOS">Todos los Riesgos</option>
                  <option value="EMERGENCIA">🚨 Emergencia</option>
                  <option value="ALTO">⚠️ Alto</option>
                  <option value="MEDIO">Medio</option>
                  <option value="BAJO">Bajo</option>
                </select>

                {/* Variety Filter */}
                <select
                  value={filterVariedad}
                  onChange={(e) => setFilterVariedad(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="TODAS">Todas las Variedades</option>
                  {uniqueVarieties.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-750 font-bold">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        onClick={handleToggleSelectAllFiltered}
                        title="Seleccionar / Deseleccionar todos"
                        className="text-slate-400 hover:text-amber-400 cursor-pointer"
                      >
                        {selectedLoteIdsInMatrix.length === filteredLots.length && filteredLots.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3"># Pos</th>
                    <th className="py-2.5 px-3">Lote ID</th>
                    <th className="py-2.5 px-3">Variedad / Cliente</th>
                    <th className="py-2.5 px-3">Sacos / TN</th>
                    <th className="py-2.5 px-3 text-center">Humedad</th>
                    <th className="py-2.5 px-3 text-center">Días Silo</th>
                    <th className="py-2.5 px-3 text-center">Pts Hum.</th>
                    <th className="py-2.5 px-3 text-center">Pts Tiempo</th>
                    <th className="py-2.5 px-3 text-center">Pts Org.</th>
                    <th className="py-2.5 px-3 text-center">Score Total</th>
                    <th className="py-2.5 px-3 text-center">Nivel Riesgo</th>
                    <th className="py-2.5 px-3 text-right">Acciones de Programación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLots.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-500 text-xs">
                        No se encontraron lotes que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (() => {
                    // Pre-computar mapas e información de batches una sola vez fuera del loop de filas
                    const progsOficiales = cargarProgramacionesOficiales();
                    const lotesMap = new Map(lotes.map(item => [item.LOTE_ID, item]));
                    const ahMap = new Map(analisisHumedos.map(a => [a.LOTE_ID, a]));

                    return filteredLots.map((lote) => {
                      const isSelected = selectedLoteIdsInMatrix.includes(lote.loteId);
                      const loteObj = lotesMap.get(lote.loteId);
                      const ahObj = ahMap.get(lote.loteId);
                      const aptitud = verificarAptitudProgramacionLote(loteObj, ahObj);
                      const batchInfo = obtenerInfoLoteEnBatches(lote.loteId, progsOficiales, batches);
                      const yaAsignadoEnBatch = batchInfo.estaProgramado;

                      const badgeStyle = 
                        lote.nivelRiesgo === "EMERGENCIA" 
                          ? "bg-rose-950 text-rose-300 border-rose-800 font-black animate-pulse"
                          : lote.nivelRiesgo === "ALTO"
                          ? "bg-amber-950 text-amber-300 border-amber-800 font-bold"
                          : lote.nivelRiesgo === "MEDIO"
                          ? "bg-blue-950 text-blue-300 border-blue-800"
                          : "bg-emerald-950 text-emerald-300 border-emerald-800";

                      return (
                        <tr 
                          key={lote.loteId} 
                          className={`transition-colors ${
                            yaAsignadoEnBatch
                              ? "bg-slate-900/50 opacity-75"
                              : !aptitud.esProgramable
                              ? "bg-rose-950/20 opacity-85"
                              : isSelected 
                              ? "bg-amber-500/10 border-l-2 border-amber-500" 
                              : "hover:bg-slate-800/60"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!aptitud.esProgramable || yaAsignadoEnBatch}
                              onChange={() => handleToggleSelectLote(lote.loteId)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={
                                yaAsignadoEnBatch
                                  ? `Bloqueado: El lote ya está asignado al Batch ${batchInfo.batchCodigo}. Los lotes no se pueden repetir.`
                                  : !aptitud.esProgramable
                                  ? `Bloqueado: ${aptitud.motivoBloqueo}`
                                  : "Seleccionar para Batch"
                              }
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            #{lote.posicion}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{lote.loteId}</span>
                              {yaAsignadoEnBatch ? (
                                <span className="px-1.5 py-0.2 text-[9px] rounded font-bold bg-amber-950/90 text-amber-300 border border-amber-700/80 flex items-center gap-0.5" title={`Lote ya asignado a ${batchInfo.batchCodigo} (${batchInfo.caso})`}>
                                  🔒 {batchInfo.batchCodigo}
                                </span>
                              ) : (
                                <span className={`px-1.5 py-0.2 text-[9px] rounded font-bold ${aptitud.badgeClass}`} title={aptitud.motivoBloqueo || aptitud.detalles}>
                                  {aptitud.label}
                                </span>
                              )}
                              {lote.cambioManual && (
                                <span className="px-1 py-0.2 bg-purple-950 text-purple-300 text-[9px] rounded border border-purple-800">
                                  Manual
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-200">{lote.variedad}</div>
                            <div className="text-[10px] text-slate-400">{lote.cliente} • {lote.zona}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div>{lote.sacos} sacos</div>
                            <div className="text-[10px] text-slate-400">{lote.pesoTn} TN</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            <span className={lote.humedad > 15 ? "text-rose-400" : "text-slate-200"}>
                              {lote.humedad}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <div>{lote.diasTranscurridos}d</div>
                            <div className="text-[10px] text-slate-400">({lote.diasRestantes}d rest.)</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                            {lote.prioridadBaseHumedad}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                            {lote.diasRestantes}d
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                            +{lote.puntosOrganolepticos}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-amber-400 text-sm">
                            {lote.puntuacionFinal}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${badgeStyle}`}>
                              {lote.nivelRiesgo}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Direct Button: Programar en Batch Oficial */}
                              {yaAsignadoEnBatch ? (
                                <button
                                  disabled
                                  className="px-2.5 py-1 bg-slate-900 text-amber-400 border border-amber-900/60 font-bold rounded-lg text-[10px] cursor-not-allowed opacity-80 flex items-center gap-1"
                                  title={`El lote ya está programado en ${batchInfo.batchCodigo}. Los lotes no se pueden repetir.`}
                                >
                                  <Lock className="w-3 h-3 text-amber-400" />
                                  <span>En {batchInfo.batchCodigo}</span>
                                </button>
                              ) : aptitud.esProgramable ? (
                                <button
                                  onClick={() => handleProgramarEnOficialBatch([lote.loteId])}
                                  className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-lg text-[10px] shadow flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                                  title="Programar este lote en el Batch Oficial"
                                >
                                  <FileSpreadsheet className="w-3 h-3 text-slate-950" />
                                  <span>⚡ Programar Batch</span>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="px-2 py-1 bg-rose-950/60 text-rose-400 border border-rose-800/80 font-bold rounded-lg text-[10px] cursor-not-allowed opacity-75 flex items-center gap-1"
                                  title={`Bloqueado por Control de Calidad: ${aptitud.motivoBloqueo}`}
                                >
                                  <span>🚫 No Apto</span>
                                </button>
                              )}

                              {/* Toggle Selection for Multi-Lot Batch */}
                              {!yaAsignadoEnBatch && aptitud.esProgramable && (
                                <button
                                  onClick={() => handleToggleSelectLote(lote.loteId)}
                                  className={`px-2 py-1 rounded font-bold text-[10px] border transition-colors cursor-pointer ${
                                    isSelected
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                                  }`}
                                >
                                  {isSelected ? "Deseleccionar" : "+ Agregar"}
                                </button>
                              )}

                              {/* Reorder Button */}
                              <button
                                onClick={() => {
                                  setReorderModalLote(lote);
                                  setManualNewPosition(lote.posicion);
                                  setManualReorderReason(lote.cambioManual?.motivo || "");
                                }}
                                title="Mover Posición Manual"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                              </button>

                              {/* Formula Breakdown */}
                              <button
                                onClick={() => setSelectedLoteForFormula(lote)}
                                title="Ver Desglose de Cálculo"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Eye Button for Lote Detail */}
                              <button
                                onClick={() => onSelectLoteForFicha(lote.loteId)}
                                title="Ver Ficha Técnica"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Desglose de Fórmula */}
      {selectedLoteForFormula && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Desglose de Cálculo: {selectedLoteForFormula.loteId}
              </h3>
              <button
                onClick={() => setSelectedLoteForFormula(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center font-mono">
                <span>Puntos Base por Humedad ({selectedLoteForFormula.humedad}%):</span>
                <span className="font-bold text-amber-300 text-sm">{selectedLoteForFormula.prioridadBaseHumedad} pts</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center font-mono">
                <span>Días de Almacenamiento ({selectedLoteForFormula.diasTranscurridos}d transcurridos / {selectedLoteForFormula.diasResistencia}d resistencia):</span>
                <span className="font-bold text-amber-300 text-sm">{selectedLoteForFormula.diasRestantes}d restantes</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex justify-between items-center font-mono">
                <span>Puntos por Defectos Organolépticos:</span>
                <span className="font-bold text-amber-300 text-sm">+{selectedLoteForFormula.puntosOrganolepticos} pts</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center font-mono text-amber-300">
                <span className="font-bold text-white">Score Total de Prioridad:</span>
                <span className="font-black text-lg">{selectedLoteForFormula.puntuacionFinal} pts ({selectedLoteForFormula.nivelRiesgo})</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLoteForFormula(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reordenamiento Manual */}
      {reorderModalLote && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-purple-400" />
                Mover Posición: {reorderModalLote.loteId}
              </h3>
              <button
                onClick={() => setReorderModalLote(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nueva Posición en Cola (1 a {calculatedLots.length}):
                </label>
                <input
                  type="number"
                  min={1}
                  max={calculatedLots.length}
                  value={manualNewPosition}
                  onChange={(e) => setManualNewPosition(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo del Cambio (Requerido para Auditoría):
                </label>
                <textarea
                  rows={3}
                  value={manualReorderReason}
                  onChange={(e) => setManualReorderReason(e.target.value)}
                  placeholder="Ej. Solicitud urgente de cliente para despacho en 24h, tolva especial asignada..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {reorderModalLote.cambioManual ? (
                <button
                  type="button"
                  onClick={() => {
                    handleResetManualReorder(reorderModalLote.loteId);
                    setReorderModalLote(null);
                  }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Restaurar Orden Automático
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  onClick={() => setReorderModalLote(null)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveManualReorder}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow"
                >
                  Confirmar Cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals for Priorizacion & AI Daily Planner */}
      <ConfigPriorizacionModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSaveConfig={onUpdateConfig}
      />

      <AIPlanificadorDiarioModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        lotesPriorizados={calculatedLots}
        equipos={equipos}
        onApplyPlanToProgramacion={(plan) => {
          if (onApplyPlanToProgramacion) {
            onApplyPlanToProgramacion(plan);
          }
          setIsAIModalOpen(false);
        }}
      />

      <ConfigCriteriosUnionLotesModal
        isOpen={isCriteriosUnionModalOpen}
        onClose={() => setIsCriteriosUnionModalOpen(false)}
        configActual={criteriosUnion}
        onSaveConfig={(nuevos) => {
          setCriteriosUnion(nuevos);
        }}
      />

      {/* In-App Notice Dialog */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                noticeModal.type === "error" 
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                  : noticeModal.type === "warning"
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                  : "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
              }`}>
                {noticeModal.type === "error" ? (
                  <AlertOctagon className="w-5 h-5" />
                ) : noticeModal.type === "warning" ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{noticeModal.title}</h3>
                <p className="text-xs text-slate-400">Notificación del Sistema de Priorización</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {noticeModal.message}
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setNoticeModal(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow cursor-pointer transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
