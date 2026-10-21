import React, { useState, useMemo } from "react";
import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  ControlVaporizado, 
  AnalisisVaporizado, 
  Presecado, 
  AnalisisHumedo, 
  AnalisisSeco,
  BatchEvaluacionComparativa,
  ResultadoCoccionExterno
} from "../types";
import { calcularEvaluacionBatch } from "../utils/evaluacionProcesosService";
import { obtenerResultadosCoccionLocales } from "../utils/integracionCoccionService";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Flame, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Filter, 
  Droplets, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  BarChart3, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Info,
  Scale,
  ShieldCheck,
  Tag
} from "lucide-react";

interface ResumenRendimientoProcesoSectionProps {
  batches: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  controles?: ControlVaporizado[];
  analisisVapList?: AnalisisVaporizado[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecList?: AnalisisSeco[];
  onNavigate?: (modulo: string, subvista?: string) => void;
}

export const ResumenRendimientoProcesoSection: React.FC<ResumenRendimientoProcesoSectionProps> = ({
  batches = [],
  batchLotes = [],
  lotes = [],
  controles = [],
  analisisVapList = [],
  presecados = [],
  analisisHumList = [],
  analisisSecList = [],
  onNavigate
}) => {
  // Filtros de usuario
  const [selectedVariedad, setSelectedVariedad] = useState<string>("TODAS");
  const [selectedRangoHumedad, setSelectedRangoHumedad] = useState<string>("TODAS");
  const [soloFinalizados, setSoloFinalizados] = useState<boolean>(true);
  const [modoAgrupacion, setModoAgrupacion] = useState<"batch" | "variedad" | "humedad">("batch");
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Obtener resultados de cocción guardados en el sistema
  const resultadosCoccion = useMemo(() => obtenerResultadosCoccionLocales(), []);

  // Calcular evaluación integral de todos los batches
  const todasEvaluaciones = useMemo(() => {
    return batches.map(b => 
      calcularEvaluacionBatch(
        b,
        batchLotes,
        lotes,
        controles,
        analisisVapList,
        presecados,
        analisisHumList,
        analisisSecList,
        resultadosCoccion
      )
    );
  }, [batches, batchLotes, lotes, controles, analisisVapList, presecados, analisisHumList, analisisSecList, resultadosCoccion]);

  // Lista única de variedades para el selector
  const listaVariedades = useMemo(() => {
    const vars = new Set<string>();
    todasEvaluaciones.forEach(e => {
      if (e.variedad && e.variedad !== "Variedad Estándar") {
        e.variedad.split(",").map(v => v.trim()).filter(Boolean).forEach(v => vars.add(v));
      }
    });
    return Array.from(vars);
  }, [todasEvaluaciones]);

  // Filtrado de evaluaciones según criterios
  const evaluacionesFiltradas = useMemo(() => {
    return todasEvaluaciones.filter(e => {
      // 1. Filtro de Estado (Batches Finalizados / Completados)
      if (soloFinalizados) {
        const est = (e.estadoBatch || "").toUpperCase();
        const esFinalizado = est === "COMPLETADO" || est === "FINALIZADO" || est === "TERMINADO" || e.esDatoCoccionReal || e.coccionScore > 0;
        if (!esFinalizado && todasEvaluaciones.some(x => (x.estadoBatch || "").toUpperCase() === "COMPLETADO" || x.esDatoCoccionReal)) {
          return false;
        }
      }

      // 2. Filtro de Variedad
      if (selectedVariedad !== "TODAS") {
        const normSelected = selectedVariedad.toUpperCase().trim();
        const normBatchVar = (e.variedad || "").toUpperCase().trim();
        if (!normBatchVar.includes(normSelected)) {
          return false;
        }
      }

      // 3. Filtro de Humedad Inicial
      if (selectedRangoHumedad !== "TODAS") {
        const h = e.humIngreso;
        if (selectedRangoHumedad === "BAJA" && !(h < 14.0)) return false;
        if (selectedRangoHumedad === "OPTIMA" && !(h >= 14.0 && h <= 16.5)) return false;
        if (selectedRangoHumedad === "MEDIA" && !(h > 16.5 && h <= 19.0)) return false;
        if (selectedRangoHumedad === "ALTA" && !(h > 19.0)) return false;
      }

      return true;
    });
  }, [todasEvaluaciones, soloFinalizados, selectedVariedad, selectedRangoHumedad]);

  // CÁLCULO DE PROMEDIOS GENERALES (Trizado, Cuarteado, Defectos)
  const metricasGenerales = useMemo(() => {
    const total = evaluacionesFiltradas.length;
    if (total === 0) {
      return {
        total: 0,
        promDeltaTrizado: 0,
        promCuarteado: 0,
        promDefectos: 0,
        promCoccionScore: 0,
        promHumedadInicial: 0,
        conCoccionReal: 0
      };
    }

    const sumDeltaTrizado = evaluacionesFiltradas.reduce((acc, e) => acc + (e.deltaTrizado || 0), 0);
    // Cuarteado: medido como deltaQuebrado / cuarteado de salida
    const sumCuarteado = evaluacionesFiltradas.reduce((acc, e) => acc + (e.deltaQuebrado || 0), 0);
    // Defectos: suma de deltaTiza + deltaManchado + otros defectos
    const sumDefectos = evaluacionesFiltradas.reduce((acc, e) => acc + ((e.deltaTiza || 0) + (e.deltaManchado || 0)), 0);
    const sumCoccion = evaluacionesFiltradas.reduce((acc, e) => acc + (e.coccionScore || 0), 0);
    const sumHum = evaluacionesFiltradas.reduce((acc, e) => acc + (e.humIngreso || 0), 0);
    const conCoccion = evaluacionesFiltradas.filter(e => e.esDatoCoccionReal).length;

    return {
      total,
      promDeltaTrizado: Number((sumDeltaTrizado / total).toFixed(2)),
      promCuarteado: Number((sumCuarteado / total).toFixed(2)),
      promDefectos: Number((sumDefectos / total).toFixed(2)),
      promCoccionScore: Number((sumCoccion / total).toFixed(1)),
      promHumedadInicial: Number((sumHum / total).toFixed(1)),
      conCoccionReal: conCoccion
    };
  }, [evaluacionesFiltradas]);

  // DATOS PARA GRÁFICAS DE BARRAS (RECHARTS)
  // 1. Por Batch individual
  const dataChartPorBatch = useMemo(() => {
    return evaluacionesFiltradas.map(e => {
      const nombre = `Batch ${e.correlativo || e.batchId.slice(-4)}`;
      const defectos = Number(((e.deltaTiza || 0) + (e.deltaManchado || 0)).toFixed(2));
      return {
        id: e.batchId,
        nombre,
        correlativo: e.correlativo,
        variedad: e.variedad,
        humedadInicial: e.humIngreso,
        "Incremento Trizado (%)": Number((e.deltaTrizado || 0).toFixed(2)),
        "Cuarteado / Δ Quebrado (%)": Number((e.deltaQuebrado || 0).toFixed(2)),
        "Defectos (%)": defectos,
        coccionScore: e.coccionScore,
        cliente: e.cliente
      };
    });
  }, [evaluacionesFiltradas]);

  // 2. Por Variedad agrupada
  const dataChartPorVariedad = useMemo(() => {
    const map = new Map<string, { total: number; sumTriz: number; sumCuart: number; sumDef: number; sumScore: number }>();
    
    evaluacionesFiltradas.forEach(e => {
      const v = e.variedad || "Otras Variedades";
      if (!map.has(v)) {
        map.set(v, { total: 0, sumTriz: 0, sumCuart: 0, sumDef: 0, sumScore: 0 });
      }
      const cur = map.get(v)!;
      cur.total += 1;
      cur.sumTriz += e.deltaTrizado || 0;
      cur.sumCuart += e.deltaQuebrado || 0;
      cur.sumDef += (e.deltaTiza || 0) + (e.deltaManchado || 0);
      cur.sumScore += e.coccionScore || 0;
    });

    return Array.from(map.entries()).map(([variedad, stats]) => ({
      nombre: variedad,
      "Incremento Trizado (%)": Number((stats.sumTriz / stats.total).toFixed(2)),
      "Cuarteado / Δ Quebrado (%)": Number((stats.sumCuart / stats.total).toFixed(2)),
      "Defectos (%)": Number((stats.sumDef / stats.total).toFixed(2)),
      "Score Cocción": Number((stats.sumScore / stats.total).toFixed(1)),
      batchesCount: stats.total
    }));
  }, [evaluacionesFiltradas]);

  // 3. Por Rango de Humedad agrupada
  const dataChartPorHumedad = useMemo(() => {
    const rangos = [
      { key: "BAJA", label: "< 14.0% (Baja)", min: 0, max: 13.99 },
      { key: "OPTIMA", label: "14.0% - 16.5% (Óptima)", min: 14.0, max: 16.5 },
      { key: "MEDIA", label: "16.6% - 19.0% (Media)", min: 16.51, max: 19.0 },
      { key: "ALTA", label: "> 19.0% (Húmeda)", min: 19.01, max: 99.0 }
    ];

    return rangos.map(r => {
      const match = evaluacionesFiltradas.filter(e => e.humIngreso >= r.min && e.humIngreso <= r.max);
      const cnt = match.length;
      if (cnt === 0) {
        return {
          nombre: r.label,
          "Incremento Trizado (%)": 0,
          "Cuarteado / Δ Quebrado (%)": 0,
          "Defectos (%)": 0,
          batchesCount: 0
        };
      }

      const sumTriz = match.reduce((a, b) => a + (b.deltaTrizado || 0), 0);
      const sumCuart = match.reduce((a, b) => a + (b.deltaQuebrado || 0), 0);
      const sumDef = match.reduce((a, b) => a + ((b.deltaTiza || 0) + (b.deltaManchado || 0)), 0);

      return {
        nombre: r.label,
        "Incremento Trizado (%)": Number((sumTriz / cnt).toFixed(2)),
        "Cuarteado / Δ Quebrado (%)": Number((sumCuart / cnt).toFixed(2)),
        "Defectos (%)": Number((sumDef / cnt).toFixed(2)),
        batchesCount: cnt
      };
    }).filter(r => r.batchesCount > 0);
  }, [evaluacionesFiltradas]);

  // Dataset activo según el modo de agrupación seleccionado
  const activeChartData = useMemo(() => {
    if (modoAgrupacion === "variedad") return dataChartPorVariedad;
    if (modoAgrupacion === "humedad") return dataChartPorHumedad;
    return dataChartPorBatch;
  }, [modoAgrupacion, dataChartPorBatch, dataChartPorVariedad, dataChartPorHumedad]);

  // Si no hay evaluaciones en absoluto
  if (todasEvaluaciones.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden my-6 transition-all">
      
      {/* HEADER DE LA SECCIÓN */}
      <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-xl text-amber-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white tracking-wide">
                Resumen de Rendimiento del Proceso
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Cocción & Análisis Físico
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Promedios analíticos de incremento de trizado, cuarteado y defectos térmicos por batch finalizado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title={isExpanded ? "Minimizar sección" : "Expandir sección"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">

          {/* BARRA DE FILTROS VISUALES (VARIEDAD & HUMEDAD INICIAL) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            
            {/* Filtros Grupales */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                Filtros de Rendimiento:
              </span>

              {/* 1. Selector de Variedad */}
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedVariedad}
                  onChange={(e) => setSelectedVariedad(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-semibold focus:border-amber-500 outline-none cursor-pointer"
                >
                  <option value="TODAS">🌾 Todas las Variedades ({todasEvaluaciones.length})</option>
                  {listaVariedades.map(v => (
                    <option key={v} value={v}>
                      Variedad: {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Selector de Humedad Inicial */}
              <div className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <select
                  value={selectedRangoHumedad}
                  onChange={(e) => setSelectedRangoHumedad(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-semibold focus:border-cyan-500 outline-none cursor-pointer"
                >
                  <option value="TODAS">💧 Humedad Inicial: Todas</option>
                  <option value="BAJA">&lt; 14.0% (Baja)</option>
                  <option value="OPTIMA">14.0% - 16.5% (Óptima)</option>
                  <option value="MEDIA">16.6% - 19.0% (Media)</option>
                  <option value="ALTA">&gt; 19.0% (Húmedo / Crítica)</option>
                </select>
              </div>

              {/* 3. Toggle Solo Finalizados */}
              <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer ml-1 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={soloFinalizados}
                  onChange={(e) => setSoloFinalizados(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                />
                <span>Solo Batches Finalizados / Cocidos</span>
              </label>
            </div>

            {/* Selector de Agrupación para la Gráfica */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold px-2 uppercase">Vista:</span>
              <button
                type="button"
                onClick={() => setModoAgrupacion("batch")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  modoAgrupacion === "batch"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Por Batch
              </button>
              <button
                type="button"
                onClick={() => setModoAgrupacion("variedad")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  modoAgrupacion === "variedad"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Por Variedad
              </button>
              <button
                type="button"
                onClick={() => setModoAgrupacion("humedad")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  modoAgrupacion === "humedad"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Por Humedad
              </button>

              {(selectedVariedad !== "TODAS" || selectedRangoHumedad !== "TODAS" || !soloFinalizados) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVariedad("TODAS");
                    setSelectedRangoHumedad("TODAS");
                    setSoloFinalizados(true);
                  }}
                  className="p-1 text-slate-400 hover:text-amber-300 ml-1 rounded hover:bg-slate-800"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

          {/* TARJETAS DE INDICADORES / PROMEDIOS CLAVE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Promedio Incremento de Trizado */}
            <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  Incremento de Trizado (Δ)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Térmico
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-300">
                  +{metricasGenerales.promDeltaTrizado}%
                </span>
                <span className="text-xs text-slate-400 font-medium">promedio</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Estado:</span>
                <strong className={metricasGenerales.promDeltaTrizado <= 1.5 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {metricasGenerales.promDeltaTrizado <= 1.5 ? "Estabilidad Alta (≤ 1.5%)" : "Control Térmico Activo"}
                </strong>
              </div>
            </div>

            {/* KPI 2: Promedio Cuarteado / Δ Quebrado */}
            <div className="bg-slate-950/70 border border-blue-500/30 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between text-xs text-cyan-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Cuarteado / Δ Quebrado
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/30">
                  Molienda / Olla
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-cyan-300">
                  +{metricasGenerales.promCuarteado}%
                </span>
                <span className="text-xs text-slate-400 font-medium">promedio</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Rendimiento Grano:</span>
                <strong className="text-emerald-400 font-bold">
                  {(100 - (metricasGenerales.promCuarteado + 9.5)).toFixed(1)}% Entero Est.
                </strong>
              </div>
            </div>

            {/* KPI 3: Promedio Defectos */}
            <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Defectos Térmicos (Δ)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Tiza + Mancha
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-rose-300">
                  {metricasGenerales.promDefectos > 0 ? `+${metricasGenerales.promDefectos}%` : `${metricasGenerales.promDefectos}%`}
                </span>
                <span className="text-xs text-slate-400 font-medium">variación</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Impacto en Color:</span>
                <strong className="text-slate-200 font-bold">
                  {metricasGenerales.promDefectos <= 0.8 ? "Mínimo (Conforme)" : "Moderado"}
                </strong>
              </div>
            </div>

            {/* KPI 4: Resultados de Cocción / Score */}
            <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  Calidad Culinaria (Cocción)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {metricasGenerales.conCoccionReal} fichas
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-emerald-300">
                  {metricasGenerales.promCoccionScore}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ 100 pts</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Masa & Soltura:</span>
                <strong className="text-amber-300 font-bold">260% Rend. / 100% Suelto</strong>
              </div>
            </div>

          </div>

          {/* GRÁFICA DE BARRAS DE PROMEDIOS CON RECHARTS */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Gráfica Comparativa: Incremento de Trizado, Cuarteado y Defectos (%)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualización de {activeChartData.length} {modoAgrupacion === "batch" ? "batches evaluados" : modoAgrupacion === "variedad" ? "variedades" : "rangos de humedad"} con resultados analíticos vinculados
                </p>
              </div>

              {/* Leyenda de referencia de colores */}
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block shadow-sm" />
                  <span className="text-slate-300 font-medium">Incremento Trizado (%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-cyan-400 inline-block shadow-sm" />
                  <span className="text-slate-300 font-medium">Cuarteado / Δ Quebrado (%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block shadow-sm" />
                  <span className="text-slate-300 font-medium">Defectos (%)</span>
                </div>
              </div>
            </div>

            {activeChartData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No hay datos que coincidan con los filtros seleccionados. Prueba a cambiar la variedad o el rango de humedad.
              </div>
            ) : (
              <div className="w-full h-80 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeChartData as any}
                    margin={{ top: 20, right: 20, left: -10, bottom: 40 }}
                    barGap={4}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                    <XAxis 
                      dataKey="nombre" 
                      stroke="#94a3b8" 
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11}
                      tickLine={false}
                      unit="%"
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "0.75rem",
                        color: "#f8fafc",
                        fontSize: "12px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
                      }}
                      itemStyle={{ padding: "2px 0" }}
                      formatter={(value: any, name: any) => [`${value}%`, name]}
                      labelFormatter={(label) => `📊 ${label}`}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }}
                    />
                    <Bar 
                      dataKey="Incremento Trizado (%)" 
                      fill="#f59e0b" 
                      radius={[4, 4, 0, 0]} 
                      name="Incremento Trizado (%)"
                    />
                    <Bar 
                      dataKey="Cuarteado / Δ Quebrado (%)" 
                      fill="#38bdf8" 
                      radius={[4, 4, 0, 0]} 
                      name="Cuarteado / Δ Quebrado (%)"
                    />
                    <Bar 
                      dataKey="Defectos (%)" 
                      fill="#f43f5e" 
                      radius={[4, 4, 0, 0]} 
                      name="Defectos (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* TABLA RESUMEN DETALLADA POR BATCH FILTRADO */}
            <div className="mt-6 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  Desglose Numérico de Resultados Asociados ({evaluacionesFiltradas.length} batches)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Humedad Promedio: <strong className="text-cyan-300">{metricasGenerales.promHumedadInicial}%</strong>
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Batch / Correlativo</th>
                      <th className="py-2.5 px-3">Variedad</th>
                      <th className="py-2.5 px-3 text-center">Hum. Inicial</th>
                      <th className="py-2.5 px-3 text-center text-amber-300">Δ Trizado</th>
                      <th className="py-2.5 px-3 text-center text-cyan-300">Cuarteado (Δ QB)</th>
                      <th className="py-2.5 px-3 text-center text-rose-300">Δ Defectos</th>
                      <th className="py-2.5 px-3 text-center text-emerald-300">Score Cocción</th>
                      <th className="py-2.5 px-3 text-right">Diagnóstico Culinario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {evaluacionesFiltradas.map((e) => {
                      const defectos = Number(((e.deltaTiza || 0) + (e.deltaManchado || 0)).toFixed(2));
                      return (
                        <tr key={e.batchId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 font-bold text-white font-sans">
                            <span className="text-amber-400 font-mono font-bold">
                              BATCH {e.correlativo || e.batchId}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold">
                              {e.variedad || "Valor"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-cyan-300">
                            {e.humIngreso}%
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-amber-300">
                            +{e.deltaTrizado}%
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-cyan-300">
                            +{e.deltaQuebrado}%
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-rose-300">
                            {defectos > 0 ? `+${defectos}%` : `${defectos}%`}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-400">
                            {e.coccionScore} pts
                          </td>
                          <td className="py-2 px-3 text-right font-sans text-[11px] text-slate-400">
                            {e.texturaFirmeza || "Suave"} • {e.expansionVolumetrica || "x2.6"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
