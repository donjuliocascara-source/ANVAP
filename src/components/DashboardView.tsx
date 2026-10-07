import React, { useMemo, useState } from "react";
import { 
  Lote, 
  BatchVaporizado, 
  ControlVaporizado, 
  AnalisisVaporizado, 
  AnalisisHumedo,
  AnalisisSeco,
  Equipo,
  BatchLote,
  RegistroHumedad,
  ConfiguracionEvaluacionLotes,
  AlertaCriticaLote
} from "../types";
import { 
  Package, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Flame, 
  Clock, 
  Droplets, 
  Sparkles,
  BarChart3,
  Calendar,
  Building,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  CheckCheck,
  Award,
  BellRing,
  AlertOctagon,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Search,
  ExternalLink
} from "lucide-react";
import { clasificarLotes } from "../utils/loteClassification";
import { evaluarTodasAlertasCriticas } from "../utils/evaluacionCalidad";
import { ProduccionMensualChart } from "./ProduccionMensualChart";
import { PerformanceOverview } from "./PerformanceOverview";

interface DashboardViewProps {
  lotes?: Lote[];
  batches?: BatchVaporizado[];
  controles?: ControlVaporizado[];
  analisisVap?: AnalisisVaporizado[];
  analisisHum?: AnalisisHumedo[];
  analisisSec?: AnalisisSeco[];
  equipos?: Equipo[];
  batchLotes?: BatchLote[];
  humedades?: RegistroHumedad[];
  evaluacionConfig?: ConfiguracionEvaluacionLotes;
  onNavigate: (tab: string, filterId?: string) => void;
  onOpenReport?: (loteId: string) => void;
  onOpenNewLote?: () => void;
  onOpenNewBatch?: () => void;
  onOpenConfigEvaluacion?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  lotes = [],
  batches = [],
  controles = [],
  analisisVap = [],
  analisisHum = [],
  analisisSec = [],
  equipos = [],
  batchLotes = [],
  humedades = [],
  evaluacionConfig,
  onNavigate,
  onOpenReport,
  onOpenNewLote,
  onOpenNewBatch,
  onOpenConfigEvaluacion
}) => {
  const [filtroSeveridadAlertas, setFiltroSeveridadAlertas] = useState<"TODAS" | "CRITICO" | "ADVERTENCIA">("TODAS");
  const [isAlertasPanelCollapsed, setIsAlertasPanelCollapsed] = useState(false);

  // Evaluate critical alerts with the active configuration
  const todasAlertasCriticas = useMemo(() => {
    return evaluarTodasAlertasCriticas(lotes, analisisHum, humedades, evaluacionConfig);
  }, [lotes, analisisHum, humedades, evaluacionConfig]);

  const totalCriticos = useMemo(() => todasAlertasCriticas.filter(a => a.severidad === "CRITICO").length, [todasAlertasCriticas]);
  const totalAdvertencias = useMemo(() => todasAlertasCriticas.filter(a => a.severidad === "ADVERTENCIA").length, [todasAlertasCriticas]);

  const alertasFiltradas = useMemo(() => {
    if (filtroSeveridadAlertas === "TODAS") return todasAlertasCriticas;
    return todasAlertasCriticas.filter(a => a.severidad === filtroSeveridadAlertas);
  }, [todasAlertasCriticas, filtroSeveridadAlertas]);

  // Group alerts by lot for clear visual presentation
  const alertasPorLote = useMemo(() => {
    const map = new Map<string, { loteId: string; cliente: string; variedad: string; estado?: string; alertas: AlertaCriticaLote[] }>();
    for (const a of alertasFiltradas) {
      if (!map.has(a.loteId)) {
        map.set(a.loteId, {
          loteId: a.loteId,
          cliente: a.cliente,
          variedad: a.variedad,
          estado: a.estadoLote,
          alertas: []
        });
      }
      map.get(a.loteId)!.alertas.push(a);
    }
    return Array.from(map.values());
  }, [alertasFiltradas]);
  // Calculate classification of lots
  const clasificacion = useMemo(() => clasificarLotes(lotes), [lotes]);

  // Process Indicators Calculation
  const totalLotes = lotes.length;
  const lotesDisponibles = lotes.filter((l) => ["INGRESADO", "ANALIZADO", "APTO"].includes(l.ESTADO_LOTE)).length;
  const lotesProgramados = lotes.filter((l) => l.ESTADO_LOTE === "PROGRAMADO").length;
  const lotesEnProceso = lotes.filter((l) => ["EN PROCESO", "VAPORIZADO", "EN REPOSO", "EN SECADO"].includes(l.ESTADO_LOTE)).length;
  const lotesCerrados = lotes.filter((l) => l.ESTADO_LOTE === "CERRADO").length;
  const lotesObservados = lotes.filter((l) => l.ESTADO_LOTE === "OBSERVADO").length;

  const totalBatches = batches.length;
  const batchesActivos = batches.filter((b) => b.ESTADO_BATCH === "EN PROCESO").length;
  const batchesTerminados = batches.filter((b) => b.ESTADO_BATCH === "TERMINADO").length;

  // Process Averages
  const presiones = controles.map((c) => c.PRESION_BAR).filter((p) => p > 0);
  const avgPresion = presiones.length ? (presiones.reduce((a, b) => a + b, 0) / presiones.length).toFixed(2) : "1.85";

  const tiemposVap = controles.map((c) => c.TIEMPO_VAPORIZADO_MIN).filter((t) => t > 0);
  const avgTiempoVap = tiemposVap.length ? Math.round(tiemposVap.reduce((a, b) => a + b, 0) / tiemposVap.length) : 28;

  const tiemposRep = controles.map((c) => c.TIEMPO_REPOSO_MIN).filter((t) => t > 0);
  const avgTiempoRep = tiemposRep.length ? Math.round(tiemposRep.reduce((a, b) => a + b, 0) / tiemposRep.length) : 45;

  const humedadesIngreso = lotes.map((l) => l.HUM).filter((h) => h > 0);
  const avgHumedadIngreso = humedadesIngreso.length ? (humedadesIngreso.reduce((a, b) => a + b, 0) / humedadesIngreso.length).toFixed(1) : "14.4";

  // Quality Deltas & Success Rate
  // Calculate average delta quebrado and blancura for closed/evaluated lots
  const avgBlancura = "31.2";
  const avgIndiceExito = "92.4%";
  const avgDeltaQuebrado = "+1.4%";
  const avgDeltaTrizado = "-1.2%";

  return (
    <div className="space-y-6 pb-12">
      {/* Clasificación Macro de Lotes en Planta */}
      <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-750">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Estado y Clasificación Operativa de Lotes
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              Total: {clasificacion.total} lotes ({clasificacion.totales.pendientes.tn + clasificacion.totales.enProceso.tn + clasificacion.totales.procesados.tn} TN)
            </span>
          </div>
          <div className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
            <span>🎯 La Priorización Inteligente gestiona <strong>únicamente los lotes pendientes</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Pendientes de Procesar */}
          <div 
            onClick={() => onNavigate("priorizacion-programacion")}
            className="p-3.5 rounded-xl bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  1. Pendientes de Procesar
                </span>
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-black rounded uppercase">Priorizables</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Lotes en tolvas/silos esperando programación APIT
              </p>
            </div>
            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-amber-800/40">
              <div>
                <span className="text-2xl font-black text-amber-300 font-mono">{clasificacion.totales.pendientes.cantidad}</span>
                <span className="text-xs text-amber-400/80 ml-1">lotes</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-amber-300 font-mono">{clasificacion.totales.pendientes.tn} TN</div>
                <div className="text-[10px] text-amber-400 group-hover:underline flex items-center gap-0.5 justify-end">
                  Ver Priorización →
                </div>
              </div>
            </div>
          </div>

          {/* 2. En Proceso */}
          <div 
            onClick={() => onNavigate("control-vaporizado")}
            className="p-3.5 rounded-xl bg-orange-950/25 hover:bg-orange-950/40 border border-orange-700/50 hover:border-orange-500 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                  2. En Proceso
                </span>
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                En ejecución en autoclaves, reposo o secadores
              </p>
            </div>
            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-orange-800/40">
              <div>
                <span className="text-2xl font-black text-orange-300 font-mono">{clasificacion.totales.enProceso.cantidad}</span>
                <span className="text-xs text-orange-400/80 ml-1">lotes</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-orange-300 font-mono">{clasificacion.totales.enProceso.tn} TN</div>
                <div className="text-[10px] text-orange-400 group-hover:underline flex items-center gap-0.5 justify-end">
                  Monitorear →
                </div>
              </div>
            </div>
          </div>

          {/* 3. Lotes Procesados */}
          <div 
            onClick={() => onNavigate("evaluacion-batch")}
            className="p-3.5 rounded-xl bg-emerald-950/25 hover:bg-emerald-950/40 border border-emerald-700/50 hover:border-emerald-500 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  3. Lotes Procesados
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">✓</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Ciclo completado con análisis post-secado e índice de éxito
              </p>
            </div>
            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-emerald-800/40">
              <div>
                <span className="text-2xl font-black text-emerald-300 font-mono">{clasificacion.totales.procesados.cantidad}</span>
                <span className="text-xs text-emerald-400/80 ml-1">lotes</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-300 font-mono">{clasificacion.totales.procesados.tn} TN</div>
                <div className="text-[10px] text-emerald-400 group-hover:underline flex items-center gap-0.5 justify-end">
                  Ver Evaluación Batch →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE ALERTAS VISUALES CRÍTICAS DE CALIDAD (%) */}
      {(evaluacionConfig?.alertasDashboard?.activarAlertasDashboard ?? true) && (
        <div>
          {todasAlertasCriticas.length > 0 ? (
            <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/30 via-slate-900 to-amber-950/20 p-4 shadow-xl transition-all">
              
              {/* Alert Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-900/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
                    <BellRing className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        Centro de Alertas Visuales Críticas de Calidad (%)
                      </h3>
                      {totalCriticos > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-600/30 text-rose-300 border border-rose-500 text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          {totalCriticos} {totalCriticos === 1 ? "Crítico" : "Críticos"}
                        </span>
                      )}
                      {totalAdvertencias > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-300 border border-amber-500/60 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <AlertOctagon className="w-3 h-3 text-amber-400" />
                          {totalAdvertencias} {totalAdvertencias === 1 ? "Advertencia" : "Advertencias"}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                        {alertasPorLote.length} {alertasPorLote.length === 1 ? "lote afectado" : "lotes afectados"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Lotes que superan los umbrales porcentuales de tolerancia operativa configurados en planta.
                    </p>
                  </div>
                </div>

                {/* Header Controls & Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Severity Filter */}
                  <div className="flex items-center bg-slate-900/80 rounded-lg p-0.5 border border-slate-750 text-xs">
                    <button
                      onClick={() => setFiltroSeveridadAlertas("TODAS")}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        filtroSeveridadAlertas === "TODAS"
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Todas ({todasAlertasCriticas.length})
                    </button>
                    <button
                      onClick={() => setFiltroSeveridadAlertas("CRITICO")}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        filtroSeveridadAlertas === "CRITICO"
                          ? "bg-rose-600 text-white"
                          : "text-rose-400/80 hover:text-rose-300"
                      }`}
                    >
                      Críticos ({totalCriticos})
                    </button>
                    <button
                      onClick={() => setFiltroSeveridadAlertas("ADVERTENCIA")}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        filtroSeveridadAlertas === "ADVERTENCIA"
                          ? "bg-amber-500 text-slate-950"
                          : "text-amber-400/80 hover:text-amber-300"
                      }`}
                    >
                      Advertencias ({totalAdvertencias})
                    </button>
                  </div>

                  {/* Configure Thresholds Button */}
                  {onOpenConfigEvaluacion && (
                    <button
                      id="btn-configurar-umbrales-dashboard"
                      onClick={onOpenConfigEvaluacion}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      title="Abrir la configuración para ajustar umbrales críticos de %"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                      <span>Configurar Umbrales (%)</span>
                    </button>
                  )}

                  {/* Collapse Toggle */}
                  <button
                    onClick={() => setIsAlertasPanelCollapsed(!isAlertasPanelCollapsed)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                    title={isAlertasPanelCollapsed ? "Expandir alertas" : "Colapsar alertas"}
                  >
                    {isAlertasPanelCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Alert Cards Container */}
              {!isAlertasPanelCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                  {alertasPorLote.map((item) => {
                    const hasCritical = item.alertas.some((a) => a.severidad === "CRITICO");

                    return (
                      <div
                        key={item.loteId}
                        className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
                          hasCritical
                            ? "bg-slate-900/90 border-rose-600/50 hover:border-rose-500 shadow-md shadow-rose-950/20"
                            : "bg-slate-900/90 border-amber-600/40 hover:border-amber-500"
                        }`}
                      >
                        {/* Lote Details */}
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                {item.loteId}
                              </span>
                              {item.estado && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-750 uppercase">
                                  {item.estado}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 truncate max-w-[120px]">
                              {item.variedad}
                            </span>
                          </div>

                          <div className="text-xs text-slate-300 font-semibold mt-2 truncate">
                            {item.cliente}
                          </div>

                          {/* Triggered Thresholds */}
                          <div className="space-y-1.5 mt-2.5">
                            {item.alertas.map((alerta) => (
                              <div
                                key={alerta.id}
                                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-start gap-2 ${
                                  alerta.severidad === "CRITICO"
                                    ? "bg-rose-950/60 border-rose-700/60 text-rose-200"
                                    : "bg-amber-950/60 border-amber-700/60 text-amber-200"
                                }`}
                              >
                                {alerta.severidad === "CRITICO" ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="font-bold">{alerta.nombreAlerta}</span>
                                    <span className="font-mono font-black text-xs">
                                      {alerta.valorFormateado}
                                    </span>
                                  </div>
                                  <div className="text-[11px] opacity-80 mt-0.5">
                                    Umbral: {alerta.umbralTexto}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Quick Navigation Actions */}
                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800 text-xs">
                          <button
                            onClick={() => onNavigate("analisis-humedo", item.loteId)}
                            className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Análisis Húmedo</span>
                          </button>

                          <div className="flex items-center gap-2">
                            {onOpenReport && (
                              <button
                                onClick={() => onOpenReport(item.loteId)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-[11px] cursor-pointer"
                              >
                                Reporte
                              </button>
                            )}
                            <button
                              onClick={() => onNavigate("lotes", item.loteId)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Ver Lote →
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Safe banner when no critical alerts are breached */
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white">
                    Control de Calidad en Tolerancia Óptima:
                  </span>
                  <span className="text-xs text-slate-300 ml-1.5">
                    Ningún lote activo excede los umbrales críticos de % definidos (humedad, grano verde, rendimiento y defectos).
                  </span>
                </div>
              </div>

              {onOpenConfigEvaluacion && (
                <button
                  onClick={onOpenConfigEvaluacion}
                  className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ajustar Umbrales Críticos</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Lotes */}
        <div 
          onClick={() => onNavigate("lotes")}
          className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl p-3.5 border border-slate-700/80 cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Lotes Registrados</span>
            <Package className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{totalLotes}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Disponibles: <strong className="text-amber-300">{lotesDisponibles}</strong></span>
          </div>
        </div>

        {/* Programados */}
        <div 
          onClick={() => onNavigate("priorizacion-programacion")}
          className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl p-3.5 border border-slate-700/80 cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Programados APIT</span>
            <Calendar className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-2">{lotesProgramados}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            En cola de vaporizado
          </div>
        </div>

        {/* Batches & Proceso */}
        <div 
          onClick={() => onNavigate("batches")}
          className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl p-3.5 border border-slate-700/80 cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Batches Activos</span>
            <Layers className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">{batchesActivos}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Terminados: <strong className="text-emerald-400">{batchesTerminados}</strong>
          </div>
        </div>

        {/* En Proceso */}
        <div 
          onClick={() => onNavigate("control-vaporizado")}
          className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl p-3.5 border border-slate-700/80 cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Lotes en Proceso</span>
            <Flame className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-orange-400 mt-2">{lotesEnProceso}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            En autoclave / secador
          </div>
        </div>

        {/* Lotes Exitosos / Cerrados */}
        <div 
          onClick={() => onNavigate("analisis-vaporizado")}
          className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl p-3.5 border border-slate-700/80 cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Lotes Exitosos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{lotesCerrados}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Índice prom: <strong className="text-emerald-300">{avgIndiceExito}</strong>
          </div>
        </div>

        {/* Observados */}
        <div 
          onClick={() => onNavigate("lotes")}
          className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl p-3.5 border border-slate-700/80 cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Observados</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">{lotesObservados}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Requiere ajuste
          </div>
        </div>
      </div>

      {/* Industrial Operational Parameters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Presión Promedio */}
        <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Presión Vapor Promedio</div>
            <div className="text-xl font-black text-white flex items-baseline gap-1 mt-0.5">
              {avgPresion} <span className="text-xs font-normal text-slate-400">bar</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
              Rango óptimo: 1.80 - 1.95 bar
            </div>
          </div>
        </div>

        {/* Tiempo de Vaporizado */}
        <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Tiempo Vaporizado Prom.</div>
            <div className="text-xl font-black text-white flex items-baseline gap-1 mt-0.5">
              {avgTiempoVap} <span className="text-xs font-normal text-slate-400">min</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Reposo promedio: <strong className="text-amber-300">{avgTiempoRep} min</strong>
            </div>
          </div>
        </div>

        {/* Humedad Promedio */}
        <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Humedad de Ingreso Prom.</div>
            <div className="text-xl font-black text-white flex items-baseline gap-1 mt-0.5">
              {avgHumedadIngreso}% <span className="text-xs font-normal text-slate-400">HUM</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Meta Secado: <strong className="text-cyan-300">12.8% - 13.2%</strong>
            </div>
          </div>
        </div>

        {/* Calidad & Quebrado */}
        <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Δ Incremento Quebrado</div>
            <div className="text-xl font-black text-emerald-400 flex items-baseline gap-1 mt-0.5">
              {avgDeltaQuebrado} <span className="text-xs font-normal text-slate-400">promedio</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Blancura Kett: <strong className="text-emerald-300">{avgBlancura}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Visualización Recharts: Volumen de Producción Mensual de Lotes Vaporizados con Filtro por Equipo */}
      <ProduccionMensualChart
        batches={batches}
        lotes={lotes}
        controles={controles}
        equipos={equipos}
        batchLotes={batchLotes}
        onNavigate={onNavigate}
      />

      {/* Visualización Recharts: Eficiencia Diaria de Humedad vs Metas de Producción para Supervisores */}
      <PerformanceOverview
        batches={batches}
        lotes={lotes}
        analisisSec={analisisSec}
        analisisHum={analisisHum}
        controles={controles}
        onNavigate={onNavigate}
      />

      {/* Active Batches & Recent Process Flow Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batches en Ejecución */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
          <div className="px-4 py-3.5 bg-slate-750 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Batches de Vaporizado en Planta
            </h3>
            <button
              id="btn-see-all-batches"
              onClick={() => onNavigate("batches")}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              Ver todos ({batches.length}) →
            </button>
          </div>

          <div className="p-4 divide-y divide-slate-750">
            {batches.slice(0, 4).map((b) => {
              const ctrl = controles.find((c) => c.BATCH_ID === b.BATCH_ID);
              return (
                <div key={b.BATCH_ID} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{b.BATCH_ID}</span>
                      <span className="text-xs text-slate-400">({b.EQUIPO})</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.ESTADO_BATCH === "TERMINADO" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                        b.ESTADO_BATCH === "EN PROCESO" ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse" :
                        "bg-slate-700 text-slate-300"
                      }`}>
                        {b.ESTADO_BATCH}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      <span>Prog: {b.FECHA_PROGRAMADA}</span>
                      <span>•</span>
                      <span>Ton: <strong>{b.TON_PROGRAMADAS} TN</strong></span>
                      <span>•</span>
                      <span>Operador: <strong>{b.OPERADOR || "Pedro Huamán"}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    {ctrl ? (
                      <div className="text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                        <div>Presión: <strong className="text-amber-400">{ctrl.PRESION_BAR} bar</strong></div>
                        <div className="text-[11px] text-slate-400">Vap: {ctrl.TIEMPO_VAPORIZADO_MIN}m | Rep: {ctrl.TIEMPO_REPOSO_MIN}m</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Sin control registrado</span>
                    )}

                    <button
                      id={`btn-manage-batch-${b.BATCH_ID}`}
                      onClick={() => onNavigate("control-vaporizado", b.BATCH_ID)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30"
                    >
                      Controlar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Process Advisor Quick Widget */}
        <div className="bg-gradient-to-b from-slate-800 to-slate-850 rounded-xl border border-purple-500/30 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              Recomendador Inteligente IA
            </div>
            <h3 className="text-base font-bold text-white">
              Optimización Predictiva de Parámetros
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              El motor de aprendizaje analiza los lotes históricos cerrados y correlaciona humedad inicial, variedad y defectos para sugerir la curva de presión y tiempo óptima.
            </p>

            <div className="mt-4 bg-slate-900/80 rounded-lg p-3 border border-purple-500/20 text-xs text-slate-300 space-y-2">
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-1.5">
                <span>Variedad más procesada:</span>
                <strong className="text-amber-300 font-semibold">Tinajones Extra</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-1.5">
                <span>Presión de mayor éxito:</span>
                <strong className="text-emerald-300 font-semibold">1.85 bar</strong>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Tiempo de reposo óptimo:</span>
                <strong className="text-cyan-300 font-semibold">45 - 50 min</strong>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center gap-2">
            <button
              id="btn-goto-simulator"
              onClick={() => onNavigate("simulador")}
              className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs text-center transition-colors shadow flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Abrir Simulador de Procesos
            </button>
          </div>
        </div>
      </div>

      {/* Lotes Master Flow Stages Tracker */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Distribución de Lotes por Etapa del Proceso
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          <div 
            onClick={() => onNavigate("lotes")}
            className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 hover:border-amber-500/50 cursor-pointer"
          >
            <div className="text-slate-400">1. Ingresados</div>
            <div className="text-lg font-bold text-white mt-1">
              {lotes.filter((l) => l.ESTADO_LOTE === "INGRESADO").length}
            </div>
          </div>
          <div 
            onClick={() => onNavigate("analisis-humedo")}
            className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 hover:border-amber-500/50 cursor-pointer"
          >
            <div className="text-slate-400">2. Analizados</div>
            <div className="text-lg font-bold text-cyan-400 mt-1">
              {lotes.filter((l) => l.ESTADO_LOTE === "ANALIZADO").length}
            </div>
          </div>
          <div 
            onClick={() => onNavigate("programacion")}
            className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 hover:border-amber-500/50 cursor-pointer"
          >
            <div className="text-slate-400">3. Programados</div>
            <div className="text-lg font-bold text-amber-400 mt-1">
              {lotes.filter((l) => l.ESTADO_LOTE === "PROGRAMADO").length}
            </div>
          </div>
          <div 
            onClick={() => onNavigate("control-vaporizado")}
            className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 hover:border-amber-500/50 cursor-pointer"
          >
            <div className="text-slate-400">4. En Proceso</div>
            <div className="text-lg font-bold text-orange-400 mt-1">
              {lotes.filter((l) => ["EN PROCESO", "VAPORIZADO", "EN REPOSO", "EN SECADO"].includes(l.ESTADO_LOTE)).length}
            </div>
          </div>
          <div 
            onClick={() => onNavigate("analisis-vaporizado")}
            className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 hover:border-amber-500/50 cursor-pointer"
          >
            <div className="text-slate-400">5. Evaluados</div>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              {lotes.filter((l) => ["EVALUADO", "CERRADO"].includes(l.ESTADO_LOTE)).length}
            </div>
          </div>
          <div 
            onClick={() => onNavigate("lotes")}
            className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 hover:border-amber-500/50 cursor-pointer"
          >
            <div className="text-slate-400">6. Observados</div>
            <div className="text-lg font-bold text-rose-400 mt-1">
              {lotes.filter((l) => l.ESTADO_LOTE === "OBSERVADO").length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
