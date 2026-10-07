import React, { useState, useMemo } from "react";
import { 
  Lote, 
  AnalisisHumedo, 
  PriorizacionMasterConfig, 
  PriorizacionLote, 
  NivelRiesgoLote, 
  Equipo,
  CambioOrdenAuditoria,
  AIPlanProgramacionDia
} from "../types";
import { 
  calcularPrioridadesLotes,
  ordenarLotesPorPrioridad,
  guardarConfiguracionPriorizacion
} from "../utils/priorizacionService";
import { 
  clasificarLotes, 
  esLotePendiente, 
  obtenerMetaCategoria 
} from "../utils/loteClassification";
import { ConfigPriorizacionModal } from "./ConfigPriorizacionModal";
import { AIPlanificadorDiarioModal } from "./AIPlanificadorDiarioModal";
import { localDB } from "../utils/localDB";
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
  Plus
} from "lucide-react";

interface PriorizacionLotesViewProps {
  lotes: Lote[];
  analisisHumedos: AnalisisHumedo[];
  equipos: Equipo[];
  config: PriorizacionMasterConfig;
  onUpdateConfig: (newCfg: PriorizacionMasterConfig) => Promise<void> | void;
  onSelectLoteForFicha: (loteId: string) => void;
  onProgramarLote: (loteId: string) => void;
  onApplyPlanToProgramacion?: (plan: AIPlanProgramacionDia) => void;
  currentUser?: { nombre: string; rol: string };
}

export const PriorizacionLotesView: React.FC<PriorizacionLotesViewProps> = ({
  lotes,
  analisisHumedos,
  equipos,
  config,
  onUpdateConfig,
  onSelectLoteForFicha,
  onProgramarLote,
  onApplyPlanToProgramacion,
  currentUser = { nombre: "Ing. Carlos Mendoza", rol: "ADMIN" }
}) => {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRiesgo, setFilterRiesgo] = useState<string>("TODOS");
  const [filterVariedad, setFilterVariedad] = useState<string>("TODAS");
  const [filterEstado, setFilterEstado] = useState<string>("TODOS");
  
  // Date simulation state (allow stepping days to simulate aging in storage)
  const [diasSimulacionAdicionales, setDiasSimulacionAdicionales] = useState(0);

  // Modals
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedLoteForFormula, setSelectedLoteForFormula] = useState<PriorizacionLote | null>(null);
  const [selectedLoteForHistory, setSelectedLoteForHistory] = useState<PriorizacionLote | null>(null);

  // Manual reordering state
  const [reorderModalLote, setReorderModalLote] = useState<PriorizacionLote | null>(null);
  const [manualNewPosition, setManualNewPosition] = useState<number>(1);
  const [manualReorderReason, setManualReorderReason] = useState<string>("");
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<string, { pos: number; motivo: string; usuario: string; fecha: string }>>({});
  const [auditLog, setAuditLog] = useState<CambioOrdenAuditoria[]>([]);

  // Calculate simulated date if stepping days
  const fechaReferencia = useMemo(() => {
    const d = new Date();
    if (diasSimulacionAdicionales !== 0) {
      d.setDate(d.getDate() + diasSimulacionAdicionales);
    }
    return d.toISOString().split("T")[0];
  }, [diasSimulacionAdicionales]);

  // Summary classification of all lots across the plant
  const clasificacionGlobal = useMemo(() => clasificarLotes(lotes), [lotes]);

  // Compute calculated lots priority (EXCLUSIVELY FOR PENDING LOTS)
  const calculatedLots = useMemo(() => {
    // Only pending lots in hopper/silos waiting for process
    const prioritizados = calcularPrioridadesLotes(lotes, analisisHumedos, config, fechaReferencia, true);

    // Apply manual overrides if any
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

    // Sort by current posicion
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

  // Filtered lots for display
  const filteredLots = useMemo(() => {
    return calculatedLots.filter(l => {
      if (filterRiesgo !== "TODOS" && l.nivelRiesgo !== filterRiesgo) return false;
      if (filterVariedad !== "TODAS" && l.variedad !== filterVariedad) return false;
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
  }, [calculatedLots, filterRiesgo, filterVariedad, filterEstado, searchTerm]);

  // Varieties list for filter
  const uniqueVarieties = useMemo(() => {
    const set = new Set<string>();
    lotes.forEach(l => {
      if (l.VARIEDAD) set.add(l.VARIEDAD);
    });
    return Array.from(set);
  }, [lotes]);

  // Handle manual position change
  const handleSaveManualReorder = async () => {
    if (!reorderModalLote) return;
    setReorderError(null);
    if (!manualReorderReason.trim()) {
      setReorderError("Por favor ingrese el motivo del reordenamiento manual para auditoría.");
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

    // Record audit
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

    // Save to local audit
    try {
      localDB.addPriorizacionAudit(newAudit, currentUser.nombre);
    } catch (e) {
      console.warn("Error guardando log de auditoría local:", e);
    }

    setReorderModalLote(null);
    setManualReorderReason("");
    setReorderError(null);
  };

  const handleResetManualReorder = (loteId: string) => {
    setManualOverrides(prev => {
      const next = { ...prev };
      delete next[loteId];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-750 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Priorización Inteligente de Lotes
                {kpis.emergencias > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 rounded-full animate-pulse flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3" />
                    {kpis.emergencias} EN EMERGENCIA
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">
                Cálculo automático de prioridad basado en humedad, días de resistencia y matriz organoléptica.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAIModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <BrainCircuit className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>¿Qué Lotes Programar Hoy? (IA)</span>
          </button>

          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Parámetros Maestros</span>
          </button>
        </div>
      </div>

      {/* Plant Macro Status Bar & Scope Notice */}
      <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-750 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[11px]">
              🎯 REGLA DE ALCANCE OPERATIVO
            </span>
            <span className="text-slate-300 font-medium">
              La Priorización aplica <strong>exclusivamente a lotes pendientes de procesar</strong> en tolva/silo.
            </span>
          </div>
          <span className="text-slate-400 text-[11px]">
            Total en Planta: <strong>{clasificacionGlobal.total} lotes</strong>
          </span>
        </div>

        {/* 3 Macro Categories Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Category 1: Pendientes (Active in this view) */}
          <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl p-3 flex items-center justify-between relative overflow-hidden">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>1. Pendientes de Procesar</span>
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-black rounded uppercase">Activo Aquí</span>
              </div>
              <p className="text-[11px] text-slate-300">
                En tolva/silo esperando programación
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-amber-300 font-mono">
                {clasificacionGlobal.totales.pendientes.cantidad}
              </div>
              <div className="text-[10px] text-amber-400/90 font-mono font-bold">
                {clasificacionGlobal.totales.pendientes.tn} TN
              </div>
            </div>
          </div>

          {/* Category 2: En Proceso */}
          <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-3 flex items-center justify-between opacity-90 hover:opacity-100 transition-opacity">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-300">
                <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                <span>2. En Proceso</span>
              </div>
              <p className="text-[11px] text-slate-400">
                En autoclave, reposo o secadores
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-orange-300 font-mono">
                {clasificacionGlobal.totales.enProceso.cantidad}
              </div>
              <div className="text-[10px] text-orange-400/80 font-mono font-bold">
                {clasificacionGlobal.totales.enProceso.tn} TN
              </div>
            </div>
          </div>

          {/* Category 3: Procesados */}
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 flex items-center justify-between opacity-90 hover:opacity-100 transition-opacity">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>3. Lotes Procesados</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ciclo completado y evaluado
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-emerald-300 font-mono">
                {clasificacionGlobal.totales.procesados.cantidad}
              </div>
              <div className="text-[10px] text-emerald-400/80 font-mono font-bold">
                {clasificacionGlobal.totales.procesados.tn} TN
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Lotes */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 block">Lotes en Espera</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-white font-mono">{kpis.total}</span>
            <span className="text-[10px] text-cyan-400 font-mono font-bold">{kpis.totalPesoTn} TN</span>
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">{kpis.totalSacos?.toLocaleString()} sacos totales</span>
        </div>

        {/* EMERGENCIA */}
        <div 
          onClick={() => setFilterRiesgo(filterRiesgo === "EMERGENCIA" ? "TODOS" : "EMERGENCIA")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filterRiesgo === "EMERGENCIA" 
              ? "bg-rose-950/80 border-rose-500 shadow-lg shadow-rose-950/50" 
              : "bg-slate-900 border-rose-900/40 hover:border-rose-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
              Emergencia
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div className="text-xl font-extrabold text-rose-300 font-mono mt-1">{kpis.emergencias}</div>
          <span className="text-[10px] text-rose-400/80 block">Resistencia agotada</span>
        </div>

        {/* ALTO */}
        <div 
          onClick={() => setFilterRiesgo(filterRiesgo === "ALTO" ? "TODOS" : "ALTO")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filterRiesgo === "ALTO" 
              ? "bg-orange-950/80 border-orange-500 shadow-lg" 
              : "bg-slate-900 border-orange-900/40 hover:border-orange-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Alto Riesgo
            </span>
          </div>
          <div className="text-xl font-extrabold text-orange-300 font-mono mt-1">{kpis.altos}</div>
          <span className="text-[10px] text-orange-400/80 block">90 – 95 pts</span>
        </div>

        {/* MEDIO */}
        <div 
          onClick={() => setFilterRiesgo(filterRiesgo === "MEDIO" ? "TODOS" : "MEDIO")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filterRiesgo === "MEDIO" 
              ? "bg-amber-950/80 border-amber-500 shadow-lg" 
              : "bg-slate-900 border-amber-900/40 hover:border-amber-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Riesgo Medio
            </span>
          </div>
          <div className="text-xl font-extrabold text-amber-300 font-mono mt-1">{kpis.medios}</div>
          <span className="text-[10px] text-amber-400/80 block">85 – 89 pts</span>
        </div>

        {/* BAJO */}
        <div 
          onClick={() => setFilterRiesgo(filterRiesgo === "BAJO" ? "TODOS" : "BAJO")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filterRiesgo === "BAJO" 
              ? "bg-emerald-950/80 border-emerald-500 shadow-lg" 
              : "bg-slate-900 border-emerald-900/40 hover:border-emerald-700/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Riesgo Bajo
            </span>
          </div>
          <div className="text-xl font-extrabold text-emerald-300 font-mono mt-1">{kpis.bajos}</div>
          <span className="text-[10px] text-emerald-400/80 block">&lt; 84 pts</span>
        </div>

        {/* Simulador de Días */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              Simular Envejecimiento
            </span>
            {diasSimulacionAdicionales > 0 && (
              <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 text-[9px] font-mono rounded font-bold">
                +{diasSimulacionAdicionales}d
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDiasSimulacionAdicionales(Math.max(0, diasSimulacionAdicionales - 1))}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs rounded font-bold font-mono"
              title="Restar 1 día"
            >
              -1d
            </button>
            <button
              onClick={() => setDiasSimulacionAdicionales(0)}
              className={`flex-1 py-1 text-[10px] rounded font-bold text-center ${
                diasSimulacionAdicionales === 0 
                  ? "bg-slate-800 text-slate-400" 
                  : "bg-amber-500 text-slate-950"
              }`}
            >
              {diasSimulacionAdicionales === 0 ? "Hoy" : "Restablecer"}
            </button>
            <button
              onClick={() => setDiasSimulacionAdicionales(diasSimulacionAdicionales + 1)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-amber-300 text-xs rounded font-bold font-mono"
              title="Avanzar 1 día"
            >
              +1d
            </button>
          </div>
          <span className="text-[9px] text-slate-500 block truncate">
            Ref: {fechaReferencia}
          </span>
        </div>
      </div>

      {/* Active Emergencies Attention Banner */}
      {kpis.emergencias > 0 && (
        <div className="bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border-2 border-rose-600/80 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                ¡ATENCIÓN INMEDIATA: {kpis.emergencias} LOTE(S) EN CONDICIÓN DE EMERGENCIA!
              </h3>
              <p className="text-xs text-rose-200">
                Han agotado sus días de resistencia calculados por humedad o alcanzaron puntuación extrema. Riesgo severo de fermentación y trizado.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAIModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Programar Batches de Emergencia Ahora
          </button>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por lote, cliente, variedad o zona..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-750 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Nivel de Riesgo */}
          <select
            value={filterRiesgo}
            onChange={(e) => setFilterRiesgo(e.target.value)}
            className="bg-slate-950 border border-slate-750 rounded-xl px-3 py-1.5 text-slate-300 focus:border-amber-500 focus:outline-none"
          >
            <option value="TODOS">Todos los Riesgos</option>
            <option value="EMERGENCIA">🚨 Emergencia</option>
            <option value="ALTO">⚠️ Alto Riesgo</option>
            <option value="MEDIO">🟡 Riesgo Medio</option>
            <option value="BAJO">🟢 Riesgo Bajo</option>
          </select>

          {/* Variedad */}
          <select
            value={filterVariedad}
            onChange={(e) => setFilterVariedad(e.target.value)}
            className="bg-slate-950 border border-slate-750 rounded-xl px-3 py-1.5 text-slate-300 focus:border-amber-500 focus:outline-none"
          >
            <option value="TODAS">Todas las Variedades</option>
            {uniqueVarieties.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Reset Filters */}
          {(searchTerm || filterRiesgo !== "TODOS" || filterVariedad !== "TODAS") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterRiesgo("TODOS");
                setFilterVariedad("TODAS");
              }}
              className="px-2.5 py-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Main Prioritization Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-850 text-slate-300 font-bold border-b border-slate-750 select-none">
              <tr>
                <th className="p-3 text-center w-12"># Pos</th>
                <th className="p-3">Lote ID</th>
                <th className="p-3">Cliente / Procedencia</th>
                <th className="p-3">Variedad</th>
                <th className="p-3 text-right">Sacos / Peso</th>
                <th className="p-3 text-center">Humedad</th>
                <th className="p-3 text-center">Ingreso</th>
                <th className="p-3 text-center">Días Transc.</th>
                <th className="p-3 text-center">Resistencia</th>
                <th className="p-3 text-center">Días Rest.</th>
                
                {/* Organolépticos sub-headers */}
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Palote">PALT</th>
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Vano">VN</th>
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Impureza">IMP</th>
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Plaga">PLAG</th>
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Olor">OL</th>
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Falso Carbón">CARB</th>
                <th className="p-2 text-center bg-slate-800/80 text-[10px]" title="Hongo">HON</th>

                <th className="p-3 text-center">Puntos</th>
                <th className="p-3 text-center">Nivel Riesgo</th>
                <th className="p-3">Recomendación</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={21} className="p-8 text-center text-slate-500 font-sans">
                    No se encontraron lotes que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredLots.map((prio) => {
                  const isEmergencia = prio.nivelRiesgo === "EMERGENCIA";
                  const isAlto = prio.nivelRiesgo === "ALTO";
                  const isMedio = prio.nivelRiesgo === "MEDIO";

                  return (
                    <tr
                      key={prio.loteId}
                      className={`transition-colors ${
                        isEmergencia
                          ? "bg-rose-950/25 hover:bg-rose-950/40"
                          : isAlto
                          ? "bg-orange-950/15 hover:bg-orange-950/30"
                          : isMedio
                          ? "bg-amber-950/10 hover:bg-slate-850"
                          : "hover:bg-slate-850/60"
                      }`}
                    >
                      {/* Posición */}
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isEmergencia
                                ? "bg-rose-600 text-white shadow-md shadow-rose-900/50 animate-bounce"
                                : isAlto
                                ? "bg-orange-500 text-slate-950 font-black"
                                : isMedio
                                ? "bg-amber-500 text-slate-950 font-bold"
                                : "bg-slate-800 text-slate-300 font-bold"
                            }`}
                          >
                            {prio.posicion}
                          </span>
                          {prio.cambioManual && (
                            <span className="text-[9px] text-amber-400 font-sans block mt-0.5" title={`Orden manual por ${prio.cambioManual.usuario}: ${prio.cambioManual.motivo}`}>
                              Manual
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Lote ID */}
                      <td className="p-3">
                        <div className="space-y-0.5 font-sans">
                          <button
                            onClick={() => onSelectLoteForFicha(prio.loteId)}
                            className="font-mono font-bold text-amber-400 hover:text-amber-300 hover:underline text-xs flex items-center gap-1 cursor-pointer"
                          >
                            {prio.loteId}
                            <Eye className="w-3 h-3 text-slate-500" />
                          </button>
                          <span className="text-[10px] text-slate-400 block">{prio.estadoLote}</span>
                        </div>
                      </td>

                      {/* Cliente / Zona */}
                      <td className="p-3 font-sans">
                        <div className="text-slate-200 text-xs font-semibold leading-tight">{prio.cliente}</div>
                        <div className="text-[11px] text-slate-400">{prio.zona}</div>
                      </td>

                      {/* Variedad */}
                      <td className="p-3 font-sans">
                        <span className="text-xs text-slate-300 font-medium">{prio.variedad}</span>
                      </td>

                      {/* Sacos / Peso */}
                      <td className="p-3 text-right">
                        <div className="text-xs font-bold text-white">{prio.sacos?.toLocaleString()} sacos</div>
                        <div className="text-[11px] text-cyan-400 font-bold">{prio.pesoTn} TN</div>
                        <div className="text-[10px] text-slate-500">({prio.pesoKg?.toLocaleString()} kg)</div>
                      </td>

                      {/* Humedad */}
                      <td className="p-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                              prio.humedad >= 24
                                ? "bg-rose-950 text-rose-300 border border-rose-700"
                                : prio.humedad >= 19
                                ? "bg-orange-950 text-orange-300 border border-orange-700"
                                : prio.humedad >= 16
                                ? "bg-amber-950 text-amber-300 border border-amber-700"
                                : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                            }`}
                          >
                            {prio.humedad}%
                          </span>
                          <span className="text-[9px] text-slate-400 font-sans mt-0.5">
                            Base: {prio.prioridadBaseHumedad}%
                          </span>
                        </div>
                      </td>

                      {/* Fecha Ingreso */}
                      <td className="p-3 text-center text-slate-300 text-[11px]">
                        {prio.fechaIngreso}
                      </td>

                      {/* Días Transcurridos */}
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-200 text-xs font-bold">
                          {prio.diasTranscurridos} d
                        </span>
                      </td>

                      {/* Días Resistencia */}
                      <td className="p-3 text-center">
                        <span className="text-xs font-semibold text-slate-300">
                          {prio.diasResistencia} d
                        </span>
                      </td>

                      {/* Días Restantes */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-bold font-mono ${
                            prio.diasRestantes <= 0
                              ? "bg-rose-600 text-white shadow-md animate-pulse"
                              : prio.diasRestantes <= 2
                              ? "bg-orange-500 text-slate-950 font-extrabold"
                              : prio.diasRestantes <= 5
                              ? "bg-amber-500 text-slate-950 font-bold"
                              : "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60"
                          }`}
                        >
                          {prio.diasRestantes <= 0 ? "¡VENCIDO!" : `${prio.diasRestantes} d`}
                        </span>
                      </td>

                      {/* Organolépticos columns */}
                      <td className="p-2 text-center text-[11px]" title={`Palote: ${prio.palote.valorOriginal} (${prio.palote.puntos} pts)`}>
                        <span className={prio.palote.puntos > 1 ? "text-amber-400 font-bold" : "text-slate-400"}>
                          {prio.palote.valorOriginal}
                        </span>
                      </td>
                      <td className="p-2 text-center text-[11px]" title={`Vano: ${prio.vano.valorOriginal} (${prio.vano.puntos} pts)`}>
                        <span className={prio.vano.puntos > 1 ? "text-amber-400 font-bold" : "text-slate-400"}>
                          {prio.vano.valorOriginal}
                        </span>
                      </td>
                      <td className="p-2 text-center text-[11px]" title={`Impureza: ${prio.impureza.valorOriginal} (${prio.impureza.puntos} pts)`}>
                        <span className={prio.impureza.puntos > 1 ? "text-amber-400 font-bold" : "text-slate-400"}>
                          {prio.impureza.valorOriginal}
                        </span>
                      </td>
                      <td className="p-2 text-center text-[11px]" title={`Plaga: ${prio.plaga.valorOriginal} (${prio.plaga.puntos} pts)`}>
                        <span className="text-amber-300 font-bold">
                          +{prio.plaga.puntos}
                        </span>
                      </td>
                      <td className="p-2 text-center text-[11px]" title={`Olor: ${prio.palote.valorOriginal} (${prio.olor.puntos} pts)`}>
                        <span className="text-amber-300 font-bold">
                          +{prio.olor.puntos}
                        </span>
                      </td>
                      <td className="p-2 text-center text-[11px]" title={`Falso Carbón: ${prio.falsoCarbon.valorOriginal} (${prio.falsoCarbon.puntos} pts)`}>
                        <span className={prio.falsoCarbon.puntos > 2 ? "text-rose-400 font-bold" : "text-slate-400"}>
                          +{prio.falsoCarbon.puntos}
                        </span>
                      </td>
                      <td className="p-2 text-center text-[11px]" title={`Hongo: ${prio.hongo.valorOriginal} (${prio.hongo.puntos} pts)`}>
                        <span className={prio.hongo.puntos > 2 ? "text-rose-400 font-bold" : "text-slate-400"}>
                          +{prio.hongo.puntos}
                        </span>
                      </td>

                      {/* Puntuación Final */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedLoteForFormula(prio)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-white font-extrabold text-xs font-mono flex items-center justify-center gap-1 mx-auto border border-slate-700 transition-transform active:scale-95 cursor-pointer"
                          title="Click para ver desglose de fórmula"
                        >
                          <span>{prio.puntuacionFinal} pts</span>
                          <Info className="w-3 h-3 text-cyan-400" />
                        </button>
                      </td>

                      {/* Nivel de Riesgo */}
                      <td className="p-3 text-center font-sans">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide inline-block ${
                            isEmergencia
                              ? "bg-rose-600 text-white shadow-md shadow-rose-900/50 animate-pulse"
                              : isAlto
                              ? "bg-orange-500/20 text-orange-300 border border-orange-500/50"
                              : isMedio
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                          }`}
                        >
                          {prio.nivelRiesgo}
                        </span>
                      </td>

                      {/* Recomendación */}
                      <td className="p-3 font-sans max-w-xs">
                        <p className={`text-[11px] leading-snug line-clamp-2 ${
                          isEmergencia ? "text-rose-200 font-semibold" : "text-slate-300"
                        }`}>
                          {prio.recomendacion}
                        </p>
                      </td>

                      {/* Acciones */}
                      <td className="p-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setReorderModalLote(prio);
                              setManualNewPosition(prio.posicion);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Ajustar orden de programación manualmente"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onProgramarLote(prio.loteId)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer"
                            title="Programar para vaporizado"
                          >
                            <Layers className="w-3 h-3" />
                            Programar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Reorder Audit History Section */}
      {auditLog.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              Auditoría de Reordenamientos Manuales de Prioridad
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              {auditLog.length} registros
            </span>
          </div>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
            {auditLog.map((log) => (
              <div key={log.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-amber-400">{log.loteId}</span>
                  <span className="text-slate-300">
                    Posición modificada: <strong className="text-rose-400">#{log.posicionAnterior}</strong> &rarr; <strong className="text-emerald-400">#{log.posicionNueva}</strong>
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <strong>Motivo:</strong> {log.motivo} — <span className="text-slate-500">{log.usuario} ({log.fechaHora})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORMULA BREAKDOWN MODAL */}
      {selectedLoteForFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Desglose de Puntuación: {selectedLoteForFormula.loteId}</h3>
              </div>
              <button
                onClick={() => setSelectedLoteForFormula(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750 space-y-1">
                <div className="text-slate-400 font-semibold">Fórmula Oficial:</div>
                <div className="font-mono text-cyan-300">Puntuación = Prioridad Humedad (%) + Suma Puntos Organolépticos</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>1. Humedad ({selectedLoteForFormula.humedad}% - Rango {selectedLoteForFormula.rangoHumedadEtiqueta}):</span>
                  <span className="font-bold text-cyan-400">+{selectedLoteForFormula.prioridadBaseHumedad} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>2. Palote ({selectedLoteForFormula.palote.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.palote.puntos} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>3. Vano ({selectedLoteForFormula.vano.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.vano.puntos} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>4. Impureza ({selectedLoteForFormula.impureza.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.impureza.puntos} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>5. Plaga ({selectedLoteForFormula.plaga.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.plaga.puntos} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>6. Olor ({selectedLoteForFormula.olor.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.olor.puntos} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>7. Falso Carbón ({selectedLoteForFormula.falsoCarbon.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.falsoCarbon.puntos} pts</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>8. Hongo ({selectedLoteForFormula.hongo.valorOriginal}):</span>
                  <span className="text-white">+{selectedLoteForFormula.hongo.puntos} pts</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-bold text-amber-400">
                  <span>Puntuación Total Final:</span>
                  <span>{selectedLoteForFormula.puntuacionFinal} pts</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-750 text-slate-300">
                <strong>Clasificación:</strong>{" "}
                <span className="font-bold text-amber-400">{selectedLoteForFormula.nivelRiesgo}</span>
                {selectedLoteForFormula.esEmergencia && (
                  <p className="text-rose-300 text-[11px] mt-1 font-semibold">
                    {selectedLoteForFormula.motivoEmergencia}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLoteForFormula(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL REORDER MODAL */}
      {reorderModalLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Reordenamiento Manual: {reorderModalLote.loteId}</h3>
              </div>
              <button
                onClick={() => setReorderModalLote(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                El lote actualmente ocupa la posición <strong className="text-amber-400">#{reorderModalLote.posicion}</strong> calculada por el sistema.
              </p>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nueva Posición en la Fila de Programación:
                </label>
                <input
                  type="number"
                  min={1}
                  max={calculatedLots.length}
                  value={manualNewPosition}
                  onChange={(e) => setManualNewPosition(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Motivo del Cambio (Requerido para Auditoría):
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Requerimiento urgente de despacho comercial, lote acoplado en tolva de carga rápida..."
                  value={manualReorderReason}
                  onChange={(e) => {
                    setReorderError(null);
                    setManualReorderReason(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {reorderError && (
                <div className="p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{reorderError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              {manualOverrides[reorderModalLote.loteId] ? (
                <button
                  onClick={() => {
                    handleResetManualReorder(reorderModalLote.loteId);
                    setReorderModalLote(null);
                  }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Restablecer a orden automático
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReorderModalLote(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveManualReorder}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow"
                >
                  Guardar Cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MASTER CONFIG MODAL */}
      <ConfigPriorizacionModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSaveConfig={onUpdateConfig}
      />

      {/* AI DAILY SCHEDULING PLANNER MODAL */}
      <AIPlanificadorDiarioModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        lotesPriorizados={calculatedLots}
        equipos={equipos}
        onApplyPlanToProgramacion={onApplyPlanToProgramacion}
      />
    </div>
  );
};
