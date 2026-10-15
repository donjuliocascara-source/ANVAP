import React, { useState, useMemo, useEffect } from "react";
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
import { obtenerResultadosCoccionLocales, buscarCoccionParaBatch } from "../utils/integracionCoccionService";
import { 
  Flame, 
  Award, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Scale, 
  Gauge, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  Droplets, 
  CheckCircle2, 
  ArrowRight, 
  Sliders, 
  Info, 
  BarChart3, 
  Check, 
  Tag, 
  Zap, 
  Link2,
  Maximize2,
  Minimize2,
  FileText,
  Package
} from "lucide-react";

interface ResumenParametrosCoccionSectionProps {
  batches: BatchVaporizado[];
  filteredBatches: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  controles?: ControlVaporizado[];
  analisisVapList?: AnalisisVaporizado[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecList?: AnalisisSeco[];
  onOpenComparador?: () => void;
  onOpenIntegracionCoccion?: () => void;
  onOpenFormatoOficial?: () => void;
}

export const ResumenParametrosCoccionSection: React.FC<ResumenParametrosCoccionSectionProps> = ({
  batches,
  filteredBatches,
  batchLotes = [],
  lotes = [],
  controles = [],
  analisisVapList = [],
  presecados = [],
  analisisHumList = [],
  analisisSecList = [],
  onOpenComparador,
  onOpenIntegracionCoccion,
  onOpenFormatoOficial
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [useOnlyFiltered, setUseOnlyFiltered] = useState<boolean>(false);
  const [activeSubView, setActiveSubView] = useState<"kpi" | "sintetico" | "modalidades" | "variedades" | "tabla">("kpi");

  const [coccionVersion, setCoccionVersion] = useState<number>(0);

  useEffect(() => {
    const handleCoccionUpdate = () => {
      setCoccionVersion(v => v + 1);
    };
    window.addEventListener("coccion_actualizada", handleCoccionUpdate);
    return () => {
      window.removeEventListener("coccion_actualizada", handleCoccionUpdate);
    };
  }, []);

  // Obtener resultados de cocción locales o externos
  const resultadosCoccion = useMemo(() => obtenerResultadosCoccionLocales(), [coccionVersion]);

  // Seleccionar la lista de batches a analizar
  const batchesParaAnalisis = useOnlyFiltered && filteredBatches.length > 0 ? filteredBatches : batches;

  // Calcular evaluación detallada de cada batch
  const evaluaciones: BatchEvaluacionComparativa[] = useMemo(() => {
    return batchesParaAnalisis.map(b => 
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
  }, [batchesParaAnalisis, batchLotes, lotes, controles, analisisVapList, presecados, analisisHumList, analisisSecList, resultadosCoccion]);

  // Segmentación por Modalidad de Pases (1 Pase vs 2 Pases)
  const gruposModalidad = useMemo(() => {
    const map = new Map<string, BatchEvaluacionComparativa[]>();
    evaluaciones.forEach(e => {
      const mod = e.modalidadPases || "2_PASES";
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(e);
    });

    return Array.from(map.entries()).map(([modalidad, list]) => {
      const cnt = list.length;
      const dTZ = Number((list.reduce((acc, x) => acc + x.deltaTrizado, 0) / cnt).toFixed(2));
      const dQB = Number((list.reduce((acc, x) => acc + x.deltaQuebrado, 0) / cnt).toFixed(2));
      const dDefectos = Number((list.reduce((acc, x) => acc + (x.deltaTiza + x.deltaManchado), 0) / cnt).toFixed(2));
      const scoreCoccion = Number((list.reduce((acc, x) => acc + x.coccionScore, 0) / cnt).toFixed(1));
      const iep = Number((list.reduce((acc, x) => acc + x.iepScore, 0) / cnt).toFixed(1));
      const pres = Number((list.reduce((acc, x) => acc + x.presionVaporBar, 0) / cnt).toFixed(2));
      const tmp = Number((list.reduce((acc, x) => acc + x.tempVaporC, 0) / cnt).toFixed(1));
      const tVap = Number((list.reduce((acc, x) => acc + x.tiempoVaporMin, 0) / cnt).toFixed(0));

      return {
        modalidad,
        label: modalidad === "2_PASES" ? "2 Pases Térmicos (Estándar Suave)" : "1 Pase Directo (Alta Presión)",
        count: cnt,
        dTZ,
        dQB,
        dDefectos,
        scoreCoccion,
        iep,
        pres,
        tmp,
        tVap
      };
    });
  }, [evaluaciones]);

  // Segmentación por Variedad
  const gruposVariedad = useMemo(() => {
    const map = new Map<string, BatchEvaluacionComparativa[]>();
    evaluaciones.forEach(e => {
      const v = e.variedad || "Variedad Estándar";
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(e);
    });

    return Array.from(map.entries()).map(([variedad, list]) => {
      const cnt = list.length;
      const dTZ = Number((list.reduce((acc, x) => acc + x.deltaTrizado, 0) / cnt).toFixed(2));
      const dQB = Number((list.reduce((acc, x) => acc + x.deltaQuebrado, 0) / cnt).toFixed(2));
      const dDefectos = Number((list.reduce((acc, x) => acc + (x.deltaTiza + x.deltaManchado), 0) / cnt).toFixed(2));
      const scoreCoccion = Number((list.reduce((acc, x) => acc + x.coccionScore, 0) / cnt).toFixed(1));
      const iep = Number((list.reduce((acc, x) => acc + x.iepScore, 0) / cnt).toFixed(1));
      const humIng = Number((list.reduce((acc, x) => acc + x.humIngreso, 0) / cnt).toFixed(1));

      return {
        variedad,
        count: cnt,
        dTZ,
        dQB,
        dDefectos,
        scoreCoccion,
        iep,
        humIng
      };
    }).sort((a, b) => b.iep - a.iep);
  }, [evaluaciones]);

  // Si no hay batches
  if (evaluaciones.length === 0) {
    return null;
  }

  // CÁLCULO DE PROMEDIOS GENERALES
  const total = evaluaciones.length;

  // 1. Trizado
  const sumTrizadoIngreso = evaluaciones.reduce((acc, e) => acc + e.trizadoIngreso, 0);
  const sumTrizadoSalida = evaluaciones.reduce((acc, e) => acc + e.trizadoSalida, 0);
  const sumDeltaTrizado = evaluaciones.reduce((acc, e) => acc + e.deltaTrizado, 0);
  const promTrizadoIngreso = Number((sumTrizadoIngreso / total).toFixed(2));
  const promTrizadoSalida = Number((sumTrizadoSalida / total).toFixed(2));
  const promDeltaTrizado = Number((sumDeltaTrizado / total).toFixed(2));
  const batchesTrizadoOptimo = evaluaciones.filter(e => e.deltaTrizado <= 1.0).length;
  const pctTrizadoOptimo = Math.round((batchesTrizadoOptimo / total) * 100);

  // 2. Cuarteado y Quebrado
  const sumQiIngreso = evaluaciones.reduce((acc, e) => acc + e.qiIngreso, 0);
  const sumQuebradoSalida = evaluaciones.reduce((acc, e) => acc + e.quebradoSalida, 0);
  const sumDeltaQuebrado = evaluaciones.reduce((acc, e) => acc + e.deltaQuebrado, 0);
  const promQiIngreso = Number((sumQiIngreso / total).toFixed(2));
  const promQuebradoSalida = Number((sumQuebradoSalida / total).toFixed(2));
  const promDeltaQuebrado = Number((sumDeltaQuebrado / total).toFixed(2));
  const promGranoEntero = Number((100 - promQuebradoSalida - 1.2).toFixed(1));
  const batchesQuebradoBajo = evaluaciones.filter(e => e.deltaQuebrado <= 2.5).length;
  const pctQuebradoBajo = Math.round((batchesQuebradoBajo / total) * 100);

  // 3. Defectos (Tiza, Manchado, Total Defectos)
  const sumTizaIngreso = evaluaciones.reduce((acc, e) => acc + e.tizaIngreso, 0);
  const sumTizaSalida = evaluaciones.reduce((acc, e) => acc + e.tizaSalida, 0);
  const sumDeltaTiza = evaluaciones.reduce((acc, e) => acc + e.deltaTiza, 0);
  const promTizaIngreso = Number((sumTizaIngreso / total).toFixed(2));
  const promTizaSalida = Number((sumTizaSalida / total).toFixed(2));
  const promDeltaTiza = Number((sumDeltaTiza / total).toFixed(2));

  const sumManchadoIngreso = evaluaciones.reduce((acc, e) => acc + e.manchadoIngreso, 0);
  const sumManchadoSalida = evaluaciones.reduce((acc, e) => acc + e.manchadoSalida, 0);
  const sumDeltaManchado = evaluaciones.reduce((acc, e) => acc + e.deltaManchado, 0);
  const promManchadoIngreso = Number((sumManchadoIngreso / total).toFixed(2));
  const promManchadoSalida = Number((sumManchadoSalida / total).toFixed(2));
  const promDeltaManchado = Number((sumDeltaManchado / total).toFixed(2));

  const promDeltaDefectosTotal = Number((Math.max(0, promDeltaTiza + promDeltaManchado)).toFixed(2));
  const promGelatinizacion = Number((evaluaciones.reduce((acc, e) => acc + e.gelatinizacionPct, 0) / total).toFixed(1));
  const promBlancura = Number((evaluaciones.reduce((acc, e) => acc + e.blancuraKett, 0) / total).toFixed(1));

  // 4. Resultados de Cocción & IEP
  const sumCoccionScore = evaluaciones.reduce((acc, e) => acc + e.coccionScore, 0);
  const sumIepScore = evaluaciones.reduce((acc, e) => acc + e.iepScore, 0);
  const promCoccionScore = Number((sumCoccionScore / total).toFixed(1));
  const promIepScore = Number((sumIepScore / total).toFixed(1));
  const countConCoccionReal = evaluaciones.filter(e => e.esDatoCoccionReal).length;

  // 5. Parámetros Operativos de Vaporizado
  const sumPresion = evaluaciones.reduce((acc, e) => acc + e.presionVaporBar, 0);
  const sumTemp = evaluaciones.reduce((acc, e) => acc + e.tempVaporC, 0);
  const sumTiempoVap = evaluaciones.reduce((acc, e) => acc + e.tiempoVaporMin, 0);
  const sumTiempoRep = evaluaciones.reduce((acc, e) => acc + e.tiempoReposoMin, 0);
  const promPresion = Number((sumPresion / total).toFixed(2));
  const promTemp = Number((sumTemp / total).toFixed(1));
  const promTiempoVap = Number((sumTiempoVap / total).toFixed(0));
  const promTiempoRep = Number((sumTiempoRep / total).toFixed(0));

  // Determinar color de semáforo para Trizado
  const getTrizadoColor = (val: number) => {
    if (val <= 0.8) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Excelente (Mínimo Trizado)" };
    if (val <= 1.5) return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Aceptable / Controlado" };
    return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", label: "Elevado (Revisar Parámetros)" };
  };

  // Determinar color de semáforo para Quebrado
  const getQuebradoColor = (val: number) => {
    if (val <= 2.0) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Excelente Protección" };
    if (val <= 3.5) return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Dentro de Tolerancia" };
    return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", label: "Fisura Térmica Alta" };
  };

  // Determinar color de semáforo para IEP
  const getIepColor = (val: number) => {
    if (val >= 90) return { text: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/40", label: "Proceso Golden Batch" };
    if (val >= 82) return { text: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/40", label: "Proceso Eficiente" };
    return { text: "text-slate-300", bg: "bg-slate-800", border: "border-slate-700", label: "En Ajuste" };
  };

  const trizadoSt = getTrizadoColor(promDeltaTrizado);
  const quebradoSt = getQuebradoColor(promDeltaQuebrado);
  const iepSt = getIepColor(promIepScore);

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
      
      {/* Background glow styling */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-xl text-amber-400 shadow-inner mt-1 sm:mt-0">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Resumen de Calidad, Trizado, Defectos & Cocción
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold border border-amber-500/30">
                {total} Batches Evaluados
              </span>
              {countConCoccionReal > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {countConCoccionReal} con App Cocción
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Promedios dinámicos de parámetros operativos, integridad física del grano y desempeño culinario.
            </p>
          </div>
        </div>

        {/* CONTROLS & SUB-VIEWS TOGGLES */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Alternar Filtrados vs Todos */}
          {filteredBatches.length < batches.length && (
            <button
              type="button"
              onClick={() => setUseOnlyFiltered(!useOnlyFiltered)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                useOnlyFiltered
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title="Alternar entre calcular sobre los batches filtrados o sobre el histórico total"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{useOnlyFiltered ? `Solo Filtrados (${filteredBatches.length})` : `Todos (${batches.length})`}</span>
            </button>
          )}

          {/* Subview Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => { setActiveSubView("kpi"); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                activeSubView === "kpi"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Promedios Clave
            </button>
            <button
              type="button"
              onClick={() => { setActiveSubView("sintetico"); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubView === "sintetico"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Resumen Sintético & Envase</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveSubView("modalidades"); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                activeSubView === "modalidades"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Por Modalidad ({gruposModalidad.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveSubView("variedades"); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                activeSubView === "variedades"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Por Variedad ({gruposVariedad.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveSubView("tabla"); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                activeSubView === "tabla"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tabla Comparativa
            </button>
          </div>

          {/* Botón Formato Oficial de Registro (Batch V272) */}
          {onOpenFormatoOficial && (
            <button
              type="button"
              onClick={onOpenFormatoOficial}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Abrir Formato Oficial de Registro de Vaporizado (Ficha de Laboratorio / Cocción)"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Ficha Oficial (V272)</span>
            </button>
          )}

          {/* Botón de Enlace Cocción */}
          {onOpenIntegracionCoccion && (
            <button
              type="button"
              onClick={onOpenIntegracionCoccion}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 hover:border-amber-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
              title="Importar / Sincronizar resultados de cocción del aplicativo externo"
            >
              <Link2 className="w-4 h-4" />
            </button>
          )}

          {/* Botón Abrir Comparador */}
          {onOpenComparador && (
            <button
              type="button"
              onClick={onOpenComparador}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
            >
              <span>Benchmarking</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Colapsar/Expandir */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? "Minimizar resumen" : "Expandir resumen"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* RESUMEN COMPACTO CUANDO ESTÁ COLAPSADO */}
      {!isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Cocción: <strong className="text-white font-mono">3 tz arroz / 3.5 tz agua (30 min)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Desplazamiento: <strong className="text-white font-mono">12.6s (Conforme)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Envase Proyectado: <strong className="text-white font-mono">Saco 50 kg Don Julio Extra</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenFormatoOficial && (
              <button
                type="button"
                onClick={onOpenFormatoOficial}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir Formato Físico Oficial de Registro (Partes 1, 3, 4 y Envase Proyectado)"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Formato Físico (Partes 1, 3, 4)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Ver Gráficos y Tablas</span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL EXPANDIBLE */}
      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-800/80 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* SUBVIEW 1: PROMEDIOS CLAVE (TARJETAS KPI RICAS) */}
          {activeSubView === "kpi" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* CARD 1: INCREMENTO DE TRIZADO */}
              <div className={`p-4 rounded-xl border ${trizadoSt.bg} ${trizadoSt.border} flex flex-col justify-between relative overflow-hidden`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Incremento de Trizado
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${trizadoSt.text} bg-slate-950/60 border border-slate-800`}>
                      Δ TZ
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 my-1">
                    <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${trizadoSt.text}`}>
                      +{promDeltaTrizado}%
                    </span>
                    <span className="text-xs text-slate-400">promedio</span>
                  </div>

                  <div className="text-[11px] text-slate-300 mt-2 space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Trizado Inicial Paddy:</span>
                      <span className="font-mono font-bold text-slate-200">{promTrizadoIngreso}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Trizado Final Salida:</span>
                      <span className="font-mono font-bold text-amber-300">{promTrizadoSalida}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Batches en rango óptimo (≤1.0%):</span>
                  <span className="font-mono font-bold text-emerald-400">{pctTrizadoOptimo}% ({batchesTrizadoOptimo}/{total})</span>
                </div>
              </div>

              {/* CARD 2: CUARTEADO & INTEGRIDAD QUEBRADO */}
              <div className={`p-4 rounded-xl border ${quebradoSt.bg} ${quebradoSt.border} flex flex-col justify-between relative overflow-hidden`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      Cuarteado & Quebrado
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${quebradoSt.text} bg-slate-950/60 border border-slate-800`}>
                      Δ QB
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 my-1">
                    <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${quebradoSt.text}`}>
                      +{promDeltaQuebrado}%
                    </span>
                    <span className="text-xs text-slate-400">incremento neto</span>
                  </div>

                  <div className="text-[11px] text-slate-300 mt-2 space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Quebrado Inicial (Qi):</span>
                      <span className="font-mono font-bold text-slate-200">{promQiIngreso}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Quebrado Final Salida:</span>
                      <span className="font-mono font-bold text-cyan-300">{promQuebradoSalida}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Grano Entero Preservado:</span>
                  <span className="font-mono font-bold text-cyan-400">{promGranoEntero}%</span>
                </div>
              </div>

              {/* CARD 3: DEFECTOS FÍSICOS (TIZA, MANCHADO, GELATINIZACIÓN) */}
              <div className="p-4 rounded-xl border bg-slate-950/70 border-slate-800 flex flex-col justify-between relative overflow-hidden">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-purple-400" />
                      Defectos Físicos
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30">
                      Tiza & Manchado
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-purple-300">
                      {promDeltaDefectosTotal > 0 ? `+${promDeltaDefectosTotal}%` : `${promDeltaDefectosTotal}%`}
                    </span>
                    <span className="text-xs text-slate-400">var. total</span>
                  </div>

                  <div className="text-[11px] text-slate-300 mt-2 space-y-1 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Tiza / Yesado Salida:</span>
                      <span className="font-mono font-bold text-slate-200">{promTizaSalida}% <span className="text-[10px] text-emerald-400 font-normal">(vs {promTizaIngreso}% in)</span></span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Manchado Salida:</span>
                      <span className="font-mono font-bold text-slate-200">{promManchadoSalida}% <span className="text-[10px] text-slate-400 font-normal">(vs {promManchadoIngreso}% in)</span></span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Gelatinización Promedio:</span>
                  <span className="font-mono font-bold text-purple-300">{promGelatinizacion}%</span>
                </div>
              </div>

              {/* CARD 4: RESULTADOS DE COCCIÓN & ÍNDICE DE EFICIENCIA (IEP) */}
              <div className={`p-4 rounded-xl border ${iepSt.bg} ${iepSt.border} flex flex-col justify-between relative overflow-hidden`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      Score Cocción & IEP
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30">
                      Olla & Proceso
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-300">
                      {promCoccionScore} <span className="text-sm font-normal text-slate-400">/100 pts</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 mt-2 space-y-1 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Índice IEP Proceso:</span>
                      <span className="font-mono font-bold text-amber-300">{promIepScore} / 100</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Expansión & Soltura:</span>
                      <span className="font-mono font-bold text-emerald-400">x2.6 · 100% Suelto</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Presión Media:</span>
                  <span className="font-mono font-bold text-slate-200">{promPresion} bar · {promTemp}°C</span>
                </div>
              </div>

            </div>
          )}

          {/* SUBVIEW: RESUMEN SINTÉTICO DE VARIABLES DE COCCIÓN & ENVASE PROYECTADO */}
          {activeSubView === "sintetico" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Banner de Variables de Cocción & Envase Proyectado */}
              <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/15 border-2 border-amber-500/40 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 border border-amber-500/30">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                        <span>Resumen Sintético de Variables de Cocción para el Sistema</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black">
                          OFICIAL
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Dosificación estándar, evaluación de grano cocido y determinación de envase proyectado en olla.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-amber-300 bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-500/30">
                      📦 ENVASE PROYECTADO: SE EVALÚA EN COCCIÓN
                    </span>
                  </div>
                </div>

                {/* Métricas Sintéticas Promedio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Bloque 1: Dosificación */}
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      1. Dosificación
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold">Tazas Arroz</span>
                        <span className="text-base font-black text-white block mt-0.5">3 tz</span>
                        <span className="text-[9px] text-slate-500">Muestra estándar</span>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold">Tazas Agua</span>
                        <span className="text-base font-black text-cyan-300 block mt-0.5">3 1/2 tz</span>
                        <span className="text-[9px] text-slate-500">Ratio hidratación</span>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold">Tiempo Cocción</span>
                        <span className="text-base font-black text-amber-400 block mt-0.5">30 min</span>
                        <span className="text-[9px] text-slate-500">Ebullición lenta</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 2: Evaluación de Grano Cocido */}
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      2. Evaluación de Grano Cocido
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-bold">Sabor</span>
                        <span className="text-xs font-black text-white block mt-0.5 truncate">Neutro Caract.</span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-bold">Desplazamiento</span>
                        <span className="text-xs font-black text-cyan-300 block mt-0.5">15 seg</span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-bold">% Quebrado</span>
                        <span className="text-xs font-black text-amber-300 block mt-0.5">18.0%</span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-bold">% Hinchado</span>
                        <span className="text-xs font-black text-purple-300 block mt-0.5">8.6%</span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-bold">% Abierto</span>
                        <span className="text-xs font-black text-rose-300 block mt-0.5">1.3%</span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-bold">Textura Frío</span>
                        <span className="text-xs font-black text-emerald-300 block mt-0.5 truncate">Suave</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Batches con Envase Proyectado Oficial */}
              <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800 text-[11px] uppercase">
                    <tr>
                      <th className="p-3">Batch / Correlativo</th>
                      <th className="p-3">Variedad</th>
                      <th className="p-3 text-center">Dosificación</th>
                      <th className="p-3 text-center">Desplazamiento</th>
                      <th className="p-3 text-center">% Quebrado</th>
                      <th className="p-3 text-center">% Hinchado</th>
                      <th className="p-3 text-center">% Abierto</th>
                      <th className="p-3 text-center">Textura Frío</th>
                      <th className="p-3">Envase Proyectado (Cocción)</th>
                      <th className="p-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-sans">
                    {evaluaciones.map((ev) => {
                      const resCoccion = buscarCoccionParaBatch(ev.batchId, ev.correlativo, ev.loteIds, resultadosCoccion);
                      const envase = resCoccion?.envaseProyectado || ev.envaseProyectado || "Saco 50 kg Don Julio Extra Selección";
                      const sabor = resCoccion?.sabor || ev.sabor || "Neutro Característico";
                      const desp = resCoccion?.desplazamientoSeg || ev.desplazamientoSeg || "15 seg";
                      const qOlla = resCoccion?.granoQuebradoOllaPct ?? ev.granoQuebradoOllaPct ?? 18.0;
                      const hOlla = resCoccion?.granoHinchadoPct ?? ev.granoHinchadoPct ?? 8.6;
                      const abOlla = resCoccion?.granoAbiertoPct ?? ev.granoAbiertoPct ?? 1.3;
                      const texFrio = resCoccion?.texturaFrio || ev.texturaFrio || "Suave";

                      return (
                        <tr key={ev.batchId} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-amber-400">
                            {ev.correlativo || ev.batchId}
                          </td>
                          <td className="p-3 text-slate-300 font-medium">
                            {ev.variedad}
                          </td>
                          <td className="p-3 text-center text-slate-300">
                            3 tz / 3 1/2 · 30m
                          </td>
                          <td className="p-3 text-center text-cyan-300 font-bold">
                            {desp}
                          </td>
                          <td className="p-3 text-center text-amber-300 font-bold">
                            {qOlla}%
                          </td>
                          <td className="p-3 text-center text-purple-300 font-bold">
                            {hOlla}%
                          </td>
                          <td className="p-3 text-center text-rose-300 font-bold">
                            {abOlla}%
                          </td>
                          <td className="p-3 text-center text-emerald-300 font-semibold">
                            {texFrio}
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 font-black text-xs border border-amber-500/30 flex items-center gap-1.5 w-fit">
                              <Package className="w-3.5 h-3.5 shrink-0" />
                              <span>{envase}</span>
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-amber-400">
                            ★ {ev.coccionScore} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBVIEW 2: COMPARACIÓN POR MODALIDAD DE PROCESO (1 PASE VS 2 PASES) */}
          {activeSubView === "modalidades" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Impacto de la Modalidad de Vaporizado sobre Trizado, Cuarteado, Defectos y Cocción:</span>
                <span className="text-[11px] text-amber-400 font-medium">Comparativa directa de parámetros</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gruposModalidad.map(gm => {
                  const is2Pases = gm.modalidad === "2_PASES";
                  return (
                    <div 
                      key={gm.modalidad}
                      className={`p-4 rounded-xl border bg-slate-950/70 ${
                        is2Pases ? "border-amber-500/40" : "border-blue-500/40"
                      } space-y-3`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${is2Pases ? "bg-amber-400" : "bg-blue-400"}`} />
                          <h4 className="text-sm font-bold text-white">{gm.label}</h4>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                          {gm.count} Batches
                        </span>
                      </div>

                      {/* Grid de Métricas de la Modalidad */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Δ Trizado</span>
                          <span className={`text-base font-black font-mono ${gm.dTZ <= 1.0 ? "text-emerald-400" : "text-amber-400"}`}>
                            +{gm.dTZ}%
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Δ Quebrado</span>
                          <span className={`text-base font-black font-mono ${gm.dQB <= 2.5 ? "text-cyan-400" : "text-amber-400"}`}>
                            +{gm.dQB}%
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Score Cocción</span>
                          <span className="text-base font-black font-mono text-amber-300">
                            {gm.scoreCoccion} pts
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">IEP Global</span>
                          <span className="text-base font-black font-mono text-emerald-400">
                            {gm.iep}
                          </span>
                        </div>
                      </div>

                      {/* Parámetros Térmicos Aplicados */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-800/80">
                        <span>Parámetros Operativos Medios:</span>
                        <span className="font-mono text-slate-200 font-bold">
                          {gm.pres} bar · {gm.tmp}°C · {gm.tVap} min vapor
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBVIEW 3: COMPARACIÓN POR VARIEDAD DE ARROZ */}
          {activeSubView === "variedades" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Comportamiento de Trizado y Cocción por Variedad de Arroz:</span>
                <span className="text-[11px] text-amber-400 font-medium">Ordenado por mejor desempeño</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {gruposVariedad.map((gv, idx) => (
                  <div key={gv.variedad} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-white truncate max-w-[150px]">{gv.variedad}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                        {gv.count} {gv.count === 1 ? 'batch' : 'batches'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                      <div className="bg-slate-900 p-1.5 rounded border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block">Δ Trizado</span>
                        <span className={`font-mono font-bold ${gv.dTZ <= 1.0 ? "text-emerald-400" : "text-amber-400"}`}>
                          +{gv.dTZ}%
                        </span>
                      </div>
                      <div className="bg-slate-900 p-1.5 rounded border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block">Δ Quebrado</span>
                        <span className={`font-mono font-bold ${gv.dQB <= 2.5 ? "text-cyan-400" : "text-amber-400"}`}>
                          +{gv.dQB}%
                        </span>
                      </div>
                      <div className="bg-slate-900 p-1.5 rounded border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block">Cocción</span>
                        <span className="font-mono font-bold text-amber-300">
                          {gv.scoreCoccion}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Hum. Ingreso Media: <strong className="text-slate-200">{gv.humIng}%</strong></span>
                      <span>IEP: <strong className="text-emerald-400">{gv.iep}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBVIEW 4: TABLA COMPARATIVA SINTÉTICA DE BATCHES */}
          {activeSubView === "tabla" && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold">
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Variedad</th>
                    <th className="p-2.5">Modalidad / Presión</th>
                    <th className="p-2.5 text-center">Δ Trizado</th>
                    <th className="p-2.5 text-center">Δ Quebrado</th>
                    <th className="p-2.5 text-center">Δ Defectos</th>
                    <th className="p-2.5 text-center">Score Cocción</th>
                    <th className="p-2.5 text-center">IEP</th>
                    <th className="p-2.5">Desempeño</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {evaluaciones.slice(0, 8).map(ev => {
                    const corr = ev.correlativo || ev.batchId;
                    return (
                      <tr key={ev.batchId} className="hover:bg-slate-900/60 transition-colors">
                        <td className="p-2.5 font-mono font-bold text-amber-400">
                          {corr}
                        </td>
                        <td className="p-2.5 text-slate-300 max-w-[130px] truncate">
                          {ev.variedad}
                        </td>
                        <td className="p-2.5 text-slate-300">
                          <span className="font-mono text-slate-200 font-semibold">{ev.presionVaporBar} bar</span> · {ev.modalidadPases === "2_PASES" ? "2 Pases" : "1 Pase"}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          <span className={ev.deltaTrizado <= 1.0 ? "text-emerald-400" : "text-amber-400"}>
                            +{ev.deltaTrizado}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          <span className={ev.deltaQuebrado <= 2.5 ? "text-cyan-400" : "text-amber-400"}>
                            +{ev.deltaQuebrado}%
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300">
                          {(ev.deltaTiza + ev.deltaManchado).toFixed(1)}%
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-amber-300">
                          {ev.coccionScore} pts
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-400">
                          {ev.iepScore}
                        </td>
                        <td className="p-2.5">
                          {ev.iepScore >= 90 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              🏆 Óptimo
                            </span>
                          ) : ev.iepScore >= 82 ? (
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                              ✅ Conforme
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                              ⚠️ En Ajuste
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {evaluaciones.length > 8 && (
                <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-900/40 border-t border-slate-800">
                  Mostrando los primeros 8 batches de {evaluaciones.length}. Para ver y comparar todos, haz clic en <strong>Benchmarking</strong>.
                </div>
              )}
            </div>
          )}

          {/* BARRA INFORMATIVA INFERIOR DE CONCLUSIONES */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Diagnóstico de Proceso:</strong> El incremento promedio de trizado (+{promDeltaTrizado}%) y quebrado (+{promDeltaQuebrado}%) demuestran estabilidad térmica con un score culinario de <strong>{promCoccionScore}/100</strong>.
              </span>
            </div>
            
            {onOpenComparador && (
              <button
                type="button"
                onClick={onOpenComparador}
                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-[11px] flex-shrink-0 cursor-pointer"
              >
                <span>Comparador & Recetas Maestras</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
