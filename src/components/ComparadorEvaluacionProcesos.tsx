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
  RecetaVaporizadoMaestra,
  UserProfile
} from "../types";
import { 
  evaluarYRankearBatches, 
  obtenerRecetasMaestras, 
  guardarRecetasMaestras, 
  crearRecetaDesdeBatch 
} from "../utils/evaluacionProcesosService";
import { obtenerResultadosCoccionLocales, buscarCoccionParaBatch } from "../utils/integracionCoccionService";
import { IntegracionCoccionModal } from "./IntegracionCoccionModal";
import { SabanaBatchesReplicadorView } from "./SabanaBatchesReplicadorView";
import { 
  Flame, 
  Award, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Scale, 
  Gauge, 
  Clock, 
  TrendingUp, 
  Copy, 
  BookOpen, 
  Check, 
  Sliders, 
  Filter, 
  Search, 
  ArrowRight, 
  X, 
  Printer, 
  BarChart2, 
  Play, 
  Plus, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Link2
} from "lucide-react";

interface ComparadorEvaluacionProcesosProps {
  batches?: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  controles?: ControlVaporizado[];
  analisisVapList?: AnalisisVaporizado[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecList?: AnalisisSeco[];
  currentUser?: UserProfile;
  onNavigate?: (tab: string, filterId?: string) => void;
  onProgramarConReceta?: (receta: RecetaVaporizadoMaestra, loteIds: string[]) => void;
}

export const ComparadorEvaluacionProcesos: React.FC<ComparadorEvaluacionProcesosProps> = ({
  batches = [],
  batchLotes = [],
  lotes = [],
  controles = [],
  analisisVapList = [],
  presecados = [],
  analisisHumList = [],
  analisisSecList = [],
  currentUser,
  onNavigate,
  onProgramarConReceta
}) => {
  // Cooking Integration State
  const [isCoccionModalOpen, setIsCoccionModalOpen] = useState<boolean>(false);
  const [coccionUpdateKey, setCoccionUpdateKey] = useState<number>(0);
  const resultadosCoccion = useMemo(() => obtenerResultadosCoccionLocales(), [coccionUpdateKey]);

  // Evaluation calculation
  const evaluacionesCompletas = useMemo(() => {
    return evaluarYRankearBatches(
      batches,
      batchLotes,
      lotes,
      controles,
      analisisVapList,
      presecados,
      analisisHumList,
      analisisSecList,
      resultadosCoccion
    );
  }, [batches, batchLotes, lotes, controles, analisisVapList, presecados, analisisHumList, analisisSecList, resultadosCoccion]);

  // Master Recipes
  const [recetasMaestras, setRecetasMaestras] = useState<RecetaVaporizadoMaestra[]>(() => obtenerRecetasMaestras());

  // Filter States
  const [selectedVariedad, setSelectedVariedad] = useState<string>("TODAS");
  const [selectedAutoclave, setSelectedAutoclave] = useState<string>("TODOS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"sabana" | "variedades" | "frente_a_frente" | "ranking" | "recetas">("sabana");

  // Selected Batches for Side-by-Side comparison (IDs)
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(() => {
    // Default select top 2-3 batches
    return evaluacionesCompletas.slice(0, 3).map(e => e.batchId);
  });

  // Modal State for Replication
  const [isReplicarModalOpen, setIsReplicarModalOpen] = useState<boolean>(false);
  const [recetaParaReplicar, setRecetaParaReplicar] = useState<RecetaVaporizadoMaestra | null>(null);
  const [lotesSeleccionadosReplicar, setLotesSeleccionadosReplicar] = useState<string[]>([]);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  // Estadísticas Agrupadas por Variedad de Arroz
  const estadisticasPorVariedad = useMemo(() => {
    const mapa = new Map<string, BatchEvaluacionComparativa[]>();
    evaluacionesCompletas.forEach(ev => {
      const v = (ev.variedad || "Variedad General").trim();
      if (!mapa.has(v)) mapa.set(v, []);
      mapa.get(v)!.push(ev);
    });

    return Array.from(mapa.entries()).map(([variedad, items]) => {
      const totalBatches = items.length;
      const sortedByIep = [...items].sort((a, b) => b.iepScore - a.iepScore);
      const golden = sortedByIep[0];

      const sumIep = items.reduce((acc, it) => acc + it.iepScore, 0);
      const itemsConCoccion = items.filter(it => it.resultadoCoccion && it.resultadoCoccion.puntajeCoccion);
      const sumCoccion = itemsConCoccion.reduce((acc, it) => acc + (it.resultadoCoccion?.puntajeCoccion || 0), 0);
      const promCoccion = itemsConCoccion.length > 0 
        ? Math.round(sumCoccion / itemsConCoccion.length) 
        : 90;

      const sumTiempoCoccion = itemsConCoccion.reduce((acc, it) => acc + (Number(it.resultadoCoccion?.tiempoCoccionMin) || 30), 0);
      const promTiempoCoccion = itemsConCoccion.length > 0 
        ? Math.round((sumTiempoCoccion / itemsConCoccion.length) * 10) / 10 
        : 30;

      const sumDeltaTrizado = items.reduce((acc, it) => acc + (it.deltaTrizado || 0), 0);
      const promDeltaTrizado = Math.round((sumDeltaTrizado / totalBatches) * 10) / 10;

      const sumDeltaQuebrado = items.reduce((acc, it) => acc + (it.deltaQuebrado || 0), 0);
      const promDeltaQuebrado = Math.round((sumDeltaQuebrado / totalBatches) * 10) / 10;

      const sumQuebradoOlla = itemsConCoccion.reduce((acc, it) => acc + (it.resultadoCoccion?.granoQuebradoOllaPct || 18), 0);
      const promQuebradoOlla = itemsConCoccion.length > 0 
        ? Math.round((sumQuebradoOlla / itemsConCoccion.length) * 10) / 10 
        : 18;

      // Envase comercial proyectado más frecuente
      const envasesContados: Record<string, number> = {};
      items.forEach(it => {
        const env = it.resultadoCoccion?.envaseProyectado;
        if (env) {
          envasesContados[env] = (envasesContados[env] || 0) + 1;
        }
      });
      const envaseMasFrecuente = Object.entries(envasesContados).sort((a, b) => b[1] - a[1])[0]?.[0] || "Saco 50 kg Don Julio Extra Selección";

      // Diagnóstico de comportamiento térmico y propuesta técnica
      let comportamientoTecnico = "";
      let propuestaOptimizacion = "";

      if (promDeltaTrizado > 14) {
        comportamientoTecnico = `Variedad con alta sensibilidad al choque térmico del vaporizado. Registra incremento de trizado de +${promDeltaTrizado}%. Requiere inyección gradual de vapor y reducción de temperatura de secado.`;
        propuestaOptimizacion = `Vaporizar a 1.25 - 1.30 bar con secado en cascada a máx 42°C y reposo térmico de 4 horas antes del pulido.`;
      } else if (promDeltaTrizado < 9) {
        comportamientoTecnico = `Excelente comportamiento y resistencia al vaporizado. Estabilidad de grano sobresaliente (+${promDeltaTrizado}% trizado) con soltura óptima en olla (${promCoccion} pts).`;
        propuestaOptimizacion = `Mantener inyección estándar de 1.40 bar por 22 min para maximizar brillo, grano suelto y rendimiento en masa.`;
      } else {
        comportamientoTecnico = `Comportamiento equilibrado bajo vaporizado (+${promDeltaTrizado}% trizado, +${promDeltaQuebrado}% quebrado). Óptima absorción de agua y textura suave al frío.`;
        propuestaOptimizacion = `Parámetros estándar recomendados: 1.35 bar en autoclave, secado intermedio a 44°C y embolsado en ${envaseMasFrecuente}.`;
      }

      return {
        variedad,
        totalBatches,
        promedioIep: Math.round(sumIep / totalBatches),
        promedioCoccionScore: promCoccion,
        promedioTiempoCoccion: promTiempoCoccion,
        promedioDeltaTrizado: promDeltaTrizado,
        promedioDeltaQuebrado: promDeltaQuebrado,
        promedioQuebradoOlla: promQuebradoOlla,
        envaseMasFrecuente,
        goldenBatch: golden,
        comportamientoTecnico,
        propuestaOptimizacion,
        batches: items
      };
    }).sort((a, b) => b.promedioIep - a.promedioIep);
  }, [evaluacionesCompletas]);

  // List of unique varieties in evaluated batches
  const variedadesDisponibles = useMemo(() => {
    const s = new Set<string>();
    evaluacionesCompletas.forEach(e => {
      if (e.variedad) s.add(e.variedad);
    });
    return Array.from(s).sort();
  }, [evaluacionesCompletas]);

  // Filtered evaluations
  const evaluacionesFiltradas = useMemo(() => {
    return evaluacionesCompletas.filter(e => {
      const matchVar = selectedVariedad === "TODAS" || e.variedad.toLowerCase().includes(selectedVariedad.toLowerCase());
      const matchEq = selectedAutoclave === "TODOS" || 
        e.equipo === selectedAutoclave ||
        (selectedAutoclave === "GINSAC" && (e.equipo.includes("02") || e.equipo.includes("GINSAC"))) ||
        (selectedAutoclave === "APIT" && !e.equipo.includes("02") && !e.equipo.includes("GINSAC"));
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        e.correlativo.toLowerCase().includes(q) || 
        e.batchId.toLowerCase().includes(q) || 
        e.cliente.toLowerCase().includes(q) || 
        e.variedad.toLowerCase().includes(q);

      return matchVar && matchEq && matchSearch;
    });
  }, [evaluacionesCompletas, selectedVariedad, selectedAutoclave, searchQuery]);

  // Golden batch (Best overall or best for selected variety)
  const goldenBatch = useMemo(() => {
    if (evaluacionesFiltradas.length === 0) return evaluacionesCompletas[0];
    return evaluacionesFiltradas[0]; // already sorted by iepScore desc
  }, [evaluacionesFiltradas, evaluacionesCompletas]);

  // Batches currently selected for side-by-side comparison
  const batchesParaComparar = useMemo(() => {
    const map = new Map(evaluacionesCompletas.map(e => [e.batchId, e]));
    return selectedBatchIds.map(id => map.get(id)).filter(Boolean) as BatchEvaluacionComparativa[];
  }, [selectedBatchIds, evaluacionesCompletas]);

  // Toggle selection for comparison
  const handleToggleSelectBatch = (batchId: string) => {
    setSelectedBatchIds(prev => {
      if (prev.includes(batchId)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter(id => id !== batchId);
      } else {
        if (prev.length >= 5) {
          return [...prev.slice(1), batchId]; // max 5
        }
        return [...prev, batchId];
      }
    });
  };

  // Open replication modal for a specific batch / recipe
  const handleAbrirReplicar = (evaluacion: BatchEvaluacionComparativa) => {
    // Generate or find recipe
    const receta = crearRecetaDesdeBatch(evaluacion, undefined, currentUser?.nombre || "Jefe de Planta");
    setRecetasMaestras(obtenerRecetasMaestras());
    setRecetaParaReplicar(receta);

    // Auto-select pending lots of the same variety
    const lotesMismaVariedad = lotes
      .filter(l => (l.ESTADO_LOTE === "APTO" || l.ESTADO_LOTE === "ANALIZADO") && 
                   l.VARIEDAD?.toLowerCase().includes(evaluacion.variedad.toLowerCase()))
      .map(l => l.LOTE_ID);

    setLotesSeleccionadosReplicar(lotesMismaVariedad.slice(0, 2));
    setIsReplicarModalOpen(true);
  };

  // Handle replication confirmation
  const handleConfirmarReplicacion = () => {
    if (!recetaParaReplicar) return;

    if (onProgramarConReceta && lotesSeleccionadosReplicar.length > 0) {
      onProgramarConReceta(recetaParaReplicar, lotesSeleccionadosReplicar);
    } else if (onNavigate) {
      onNavigate("priorizacion-programacion");
    }

    setIsReplicarModalOpen(false);
    setNotifMessage(`✅ Receta "${recetaParaReplicar.nombreReceta}" lista para aplicarse en los lotes seleccionados.`);
    setTimeout(() => setNotifMessage(null), 5000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notifMessage && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notifMessage}</span>
          </div>
          <button 
            type="button"
            onClick={() => setNotifMessage(null)}
            className="text-emerald-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold">
              EVALUACIÓN DE BATCH
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Variedades, Análisis y Propuestas
            </span>
          </div>
          <h2 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" />
            Evaluación de Batch — Variedades, Análisis y Propuestas
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Evaluación analítica y benchmarking de batches. Analiza el <strong>desempeño por variedades de arroz</strong>, comparativa de calidad física y en olla, y <strong>propuestas maestras de optimización térmica</strong> para nuevos lotes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Direct link to Resultados de Coccion */}
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate("resultados-coccion") : null}
            className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-2 border border-amber-500/30 cursor-pointer shadow transition-all active:scale-95"
            title="Ir a la pantalla de Resultados de Cocción: solo batches con datos pendientes de cargar"
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Batches Pendientes de Cocción</span>
          </button>

          {/* View mode buttons */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-750 text-xs font-semibold flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setViewMode("sabana")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "sabana"
                  ? "bg-amber-500 text-slate-950 font-black shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Sábana & Replicador</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("variedades")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "variedades"
                  ? "bg-amber-500 text-slate-950 font-black shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Variedades ({estadisticasPorVariedad.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("frente_a_frente")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "frente_a_frente"
                  ? "bg-amber-500 text-slate-950 font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Comparador ({selectedBatchIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ranking")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "ranking"
                  ? "bg-amber-500 text-slate-950 font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Ranking IEP</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("recetas")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "recetas"
                  ? "bg-amber-500 text-slate-950 font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Propuestas ({recetasMaestras.length})</span>
            </button>
          </div>

          {/* Botón de Enlace de Aplicativo de Cocción */}
          <button
            type="button"
            onClick={() => setIsCoccionModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-2 border border-amber-500/40 cursor-pointer shadow transition-all active:scale-95"
            title="Enlazar resultados de cocción del aplicativo externo (Filtro automático de solo Vaporizado)"
          >
            <Link2 className="w-4 h-4 text-amber-400" />
            <span>Enlazar Cocción ({resultadosCoccion.length})</span>
          </button>

          {goldenBatch && (
            <button
              type="button"
              onClick={() => handleAbrirReplicar(goldenBatch)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
              title="Replicar parámetros del mejor proceso en nuevos lotes"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Replicar Mejor Proceso</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER DESTACADO: PROCESO CAMPEÓN / GOLDEN BATCH */}
      {goldenBatch && (
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 rounded-2xl border border-amber-500/30 p-5 shadow-2xl">
          <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
            <Award className="w-64 h-64 text-amber-400" />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md shadow-amber-500/30">
                  <Award className="w-3.5 h-3.5 fill-current text-slate-950" />
                  PROCESO CAMPEÓN • GOLDEN BATCH
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm px-2 py-0.5 bg-slate-950 rounded border border-amber-500/30">
                  BATCH {goldenBatch.correlativo}
                </span>
                <span className="text-xs text-slate-300 font-semibold">
                  {goldenBatch.variedad} ({goldenBatch.cliente})
                </span>
              </div>

              <div className="text-xs text-slate-300 font-medium max-w-3xl leading-relaxed">
                Este batch alcanzó el <strong>Índice de Eficiencia de Proceso (IEP) más alto ({goldenBatch.iepScore}/100 pts)</strong>. Logró minimizar el incremento de trizado a solo <strong>+{goldenBatch.deltaTrizado}%</strong> y el quebrado a <strong>+{goldenBatch.deltaQuebrado}%</strong>, obteniendo una calificación en olla de <strong>{goldenBatch.coccionScore} pts (100% Grano Suelto y Al Dente)</strong>.
              </div>

              {/* Recipe highlights */}
              <div className="flex items-center gap-3 text-xs font-mono pt-1 flex-wrap">
                <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300">
                  ⚡ Vapor: <strong>{goldenBatch.presionVaporBar} bar</strong> ({goldenBatch.tempVaporC}°C)
                </span>
                <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-amber-300">
                  ⏱️ Tiempos: <strong>{goldenBatch.tiempoVaporMin} min inyección</strong> / {goldenBatch.tiempoReposoMin} min reposo
                </span>
                <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-300">
                  🌾 Secado: <strong>{goldenBatch.secadoMetodo}</strong> ({goldenBatch.tempSecadoC}°C)
                </span>
              </div>
            </div>

            <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-3 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-5">
              <div className="text-right">
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {goldenBatch.iepScore} <span className="text-xs text-slate-400 font-sans font-normal">IEP Score</span>
                </div>
                <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 justify-end">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Calidad de Olla 98%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAbrirReplicar(goldenBatch)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Replicar esta Receta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SELECTOR TOOLBAR */}
      <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-slate-400 font-bold">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>Filtrar por:</span>
          </div>

          {/* Variedad filter */}
          <select
            value={selectedVariedad}
            onChange={(e) => setSelectedVariedad(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
          >
            <option value="TODAS">Todas las Variedades</option>
            {variedadesDisponibles.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Filtro Secado */}
          <select
            value={selectedAutoclave}
            onChange={(e) => setSelectedAutoclave(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="TODOS">Todo el Secado</option>
            <option value="APIT">Secado en APIT</option>
            <option value="GINSAC">Secado en GINSAC</option>
          </select>

          {/* Quick search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar batch, cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 w-44"
            />
          </div>
        </div>

        {/* Batch Selection for Comparison Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium">Comparar:</span>
          {evaluacionesFiltradas.slice(0, 6).map(e => {
            const isSelected = selectedBatchIds.includes(e.batchId);
            return (
              <button
                key={e.batchId}
                type="button"
                onClick={() => handleToggleSelectBatch(e.batchId)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                    : "bg-slate-900 text-slate-400 border-slate-750 hover:text-white"
                }`}
              >
                {isSelected && "✓ "}BATCH {e.correlativo}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW SÁBANA HISTÓRICA & REPLICADOR INTELIGENTE                            */}
      {/* ========================================================================= */}
      {viewMode === "sabana" && (
        <SabanaBatchesReplicadorView
          currentUser={currentUser}
          onNavigate={onNavigate}
          onReplicarEnBatch={(params) => {
            const recetaCreada = {
              id: `REC-${params.batchOrigen}-${Date.now().toString().slice(-4)}`,
              nombreReceta: `Receta Replicada Batch ${params.batchOrigen} (${params.variedad})`,
              variedad: params.variedad,
              rangoHumedad: "12% - 16%",
              batchOrigenId: String(params.batchOrigen),
              correlativoOrigen: String(params.batchOrigen),
              iepScore: 96,
              coccionScore: 94,
              deltaTrizado: 3.2,
              deltaQuebrado: 3.8,
              parametros: {
                modalidadPases: (params.presion2 ? "2_PASES" : "1_PASE") as any,
                presionVaporBar: params.presion1,
                tempVaporC: 118,
                tiempoVaporMin: 28,
                tiempoReposoMin: params.reposo1,
                rpm: params.rpm1,
                secadoMetodo: "Torre Industrial de Secado APIT",
                tempSecadoC: 50,
                tiempoSecadoMin: 45
              },
              recomendacionesUso: `Pase 1: ${params.presion1} bar / ${params.rpm1} RPM / Reposo: ${params.reposo1}m. ${params.presion2 ? `Pase 2: ${params.presion2} bar / ${params.rpm2} RPM / Reposo: ${params.reposo2}m` : ""}`,
              fechaCreacion: new Date().toISOString().split("T")[0],
              creadoPor: currentUser?.nombre || "Jefe de Planta APIT"
            };

            if (onProgramarConReceta) {
              onProgramarConReceta(recetaCreada, []);
            } else if (onNavigate) {
              onNavigate("priorizacion-programacion");
            }

            setNotifMessage(`✅ Receta replicada del Batch ${params.batchOrigen} cargada para programación en APIT.`);
            setTimeout(() => setNotifMessage(null), 5000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW 0: RESULTADOS POR VARIEDADES                                         */}
      {/* ========================================================================= */}
      {viewMode === "variedades" && (
        <div className="space-y-6">
          {/* Header of Varieties View */}
          <div className="bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  MÓDULO DE VARIEDADES
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {estadisticasPorVariedad.length} Variedades con Registro Histórico
                </span>
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Evaluación Técnica de Resultados por Variedades de Arroz
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                Comportamiento específico de cada variedad frente al <strong>choque térmico del vaporizado</strong>, estabilidad de grano, soltura en olla y formulación de parámetros óptimos recomendados.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("frente_a_frente")}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Ver Comparador Frente a Frente</span>
              </button>
            </div>
          </div>

          {/* Variety Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {estadisticasPorVariedad.map(est => {
              return (
                <div
                  key={est.variedad}
                  className="bg-slate-850 rounded-2xl border border-slate-750 hover:border-amber-500/50 transition-all p-5 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header: Variety Title & Badges */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-750 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-white tracking-wide">
                            {est.variedad}
                          </h4>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                            {est.totalBatches} {est.totalBatches === 1 ? "Batch evaluado" : "Batches evaluados"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Envase proyectado líder: <strong className="text-cyan-300 font-medium">{est.envaseMasFrecuente}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">IEP Promedio</span>
                          <span className="text-lg font-black text-amber-400 font-mono">
                            {est.promedioIep} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Pillars of Variety Performance */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Cocción
                        </span>
                        <span className="text-sm font-black text-white font-mono mt-0.5 block">
                          {est.promedioTiempoCoccion} min
                        </span>
                        <span className="text-[9px] text-emerald-400 font-semibold">
                          Score: {est.promedioCoccionScore} pts
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block flex items-center justify-center gap-1">
                          <TrendingUp className="w-3 h-3 text-rose-400" />
                          Δ Trizado
                        </span>
                        <span className={`text-sm font-black font-mono mt-0.5 block ${
                          est.promedioDeltaTrizado > 14 ? "text-rose-400" : "text-emerald-400"
                        }`}>
                          +{est.promedioDeltaTrizado}%
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Choque térmico
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block flex items-center justify-center gap-1">
                          <Scale className="w-3 h-3 text-cyan-400" />
                          Δ Quebrado
                        </span>
                        <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block">
                          +{est.promedioDeltaQuebrado}%
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Salida autoclave
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block flex items-center justify-center gap-1">
                          <Flame className="w-3 h-3 text-purple-400" />
                          Grano Olla
                        </span>
                        <span className="text-sm font-black text-purple-300 font-mono mt-0.5 block">
                          {est.promedioQuebradoOlla}%
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Quebrado en olla
                        </span>
                      </div>
                    </div>

                    {/* Comportamiento Técnico & Diagnóstico */}
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1 text-xs">
                      <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        <span>Diagnóstico de Comportamiento Térmico:</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {est.comportamientoTecnico}
                      </p>
                    </div>

                    {/* Propuesta de Optimización Recomendada */}
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-1 text-xs">
                      <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Propuesta de Optimización para {est.variedad}:</span>
                      </div>
                      <p className="text-amber-200/90 font-medium leading-relaxed">
                        {est.propuestaOptimizacion}
                      </p>
                    </div>

                    {/* Golden Batch de esta variedad */}
                    {est.goldenBatch && (
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            Proceso Campeón (Golden Batch):
                          </span>
                          <strong className="text-white font-mono font-bold">
                            BATCH {est.goldenBatch.correlativo}
                          </strong>
                          <span className="text-slate-400 text-[11px] ml-2">
                            ({est.goldenBatch.presionVaporBar} bar • {est.goldenBatch.tiempoVaporMin} min iny. • {est.goldenBatch.tempSecadoC}°C sec.)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAbrirReplicar(est.goldenBatch)}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0"
                          title="Replicar parámetros óptimos de esta variedad en nuevos lotes"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Replicar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabla Comparativa de Variedades */}
          <div className="bg-slate-850 rounded-2xl border border-slate-750 overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-900/90 border-b border-slate-750 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white text-sm">
                  Matriz Comparativa de Variedades de Arroz
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                Ordenado por Índice de Eficiencia de Proceso (IEP)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-bold uppercase tracking-wider">Variedad</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">Batches</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">IEP Score</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">Score Cocción</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">Tiempo Cocción</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">Δ Trizado</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">Δ Quebrado</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-center">% Olla Quebrado</th>
                    <th className="p-3 font-bold uppercase tracking-wider">Envase Comercial</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {estadisticasPorVariedad.map((est, idx) => (
                    <tr key={est.variedad} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span>{est.variedad}</span>
                      </td>
                      <td className="p-3 text-center text-slate-300 font-mono">{est.totalBatches}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black font-mono">
                          {est.promedioIep}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-300 font-bold">{est.promedioCoccionScore} pts</td>
                      <td className="p-3 text-center font-mono text-white">{est.promedioTiempoCoccion} min</td>
                      <td className={`p-3 text-center font-mono font-bold ${
                        est.promedioDeltaTrizado > 14 ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        +{est.promedioDeltaTrizado}%
                      </td>
                      <td className="p-3 text-center font-mono text-cyan-300">+{est.promedioDeltaQuebrado}%</td>
                      <td className="p-3 text-center font-mono text-purple-300">{est.promedioQuebradoOlla}%</td>
                      <td className="p-3 text-slate-300 truncate max-w-[180px]" title={est.envaseMasFrecuente}>
                        {est.envaseMasFrecuente}
                      </td>
                      <td className="p-3 text-right">
                        {est.goldenBatch && (
                          <button
                            type="button"
                            onClick={() => handleAbrirReplicar(est.goldenBatch)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Replicar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: COMPARADOR FRENTE A FRENTE (SIDE-BY-SIDE MATRIX)                  */}
      {/* ========================================================================= */}
      {viewMode === "frente_a_frente" && (
        <div className="space-y-4">
          <div className="bg-slate-850 rounded-2xl border border-slate-750 overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-900/90 border-b border-slate-750 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Matriz Comparativa de Procesos Térmicos, Defectos y Desempeño en Olla
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  ({batchesParaComparar.length} batches seleccionados)
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Lote con borde dorado = <strong className="text-amber-400">Golden Batch (#1)</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3.5 w-64 min-w-[200px] font-bold text-slate-300 uppercase tracking-wider text-[11px] sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                      Parámetro / Métrica
                    </th>
                    {batchesParaComparar.map(b => (
                      <th 
                        key={b.batchId} 
                        className={`p-3.5 min-w-[220px] text-center border-r border-slate-800 ${
                          b.esGoldenBatch ? "bg-amber-950/30 border-t-2 border-t-amber-400" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          {b.esGoldenBatch && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-0.5">
                              <Award className="w-3 h-3 fill-current" />
                              CAMPEÓN
                            </span>
                          )}
                          <span className="font-mono font-black text-sm text-amber-400">
                            BATCH {b.correlativo}
                          </span>
                          <span className="text-[11px] text-slate-300 font-bold truncate max-w-[190px]">
                            {b.variedad}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {b.fecha} • {b.turno}
                          </span>
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                              IEP {b.iepScore} pts
                            </span>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 font-mono text-xs">
                  
                  {/* SECCIÓN 1: MATERIA PRIMA & INGRESO */}
                  <tr className="bg-slate-900/60 font-sans font-bold text-slate-300">
                    <td colSpan={batchesParaComparar.length + 1} className="px-3.5 py-2 text-[11px] uppercase tracking-wider text-cyan-400 bg-cyan-950/20 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> 1. Materia Prima & Calidad de Ingreso
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Cliente Principal
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 font-sans text-slate-200 text-center border-r border-slate-800 truncate max-w-[200px]" title={b.cliente}>
                        {b.cliente}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Humedad de Ingreso (%)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center font-bold text-cyan-300 border-r border-slate-800">
                        {b.humIngreso}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Trizado / Cuarteado Ingreso (%)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-300 border-r border-slate-800">
                        {b.trizadoIngreso}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Quebrado Ingreso (QI %)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-300 border-r border-slate-800">
                        {b.qiIngreso}%
                      </td>
                    ))}
                  </tr>

                  {/* SECCIÓN 2: PARÁMETROS DE PROCESO TÉRMICO */}
                  <tr className="bg-slate-900/60 font-sans font-bold text-slate-300">
                    <td colSpan={batchesParaComparar.length + 1} className="px-3.5 py-2 text-[11px] uppercase tracking-wider text-amber-400 bg-amber-950/20 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" /> 2. Parámetros de Vaporizado & Secado Aplicados
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Presión de Vapor (bar)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center font-bold text-amber-300 border-r border-slate-800">
                        <span className={`px-2 py-0.5 rounded ${b.esGoldenBatch ? "bg-amber-500/20 text-amber-300 font-black border border-amber-500/40" : ""}`}>
                          {b.presionVaporBar} bar
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Temperatura de Vapor (°C)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-200 border-r border-slate-800">
                        {b.tempVaporC} °C
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Tiempo de Inyección / Vapor (min)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-200 border-r border-slate-800">
                        {b.tiempoVaporMin} min
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Tiempo de Reposo Térmico (min)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center font-bold text-emerald-400 border-r border-slate-800">
                        {b.tiempoReposoMin} min
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Modalidad de Pases & RPM
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-400 border-r border-slate-800 text-[11px]">
                        {b.modalidadPases === "2_PASES" ? "2 Pases" : "1 Pase"} • {b.rpm} RPM
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Sistema de Secado Final
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 font-sans text-center text-slate-300 border-r border-slate-800 text-[11px]">
                        {b.secadoMetodo} ({b.tempSecadoC}°C)
                      </td>
                    ))}
                  </tr>

                  {/* SECCIÓN 3: IMPACTO FÍSICO Y CALIDAD (INCREMENTOS DE TRIZADO Y QUEBRADO) */}
                  <tr className="bg-slate-900/60 font-sans font-bold text-slate-300">
                    <td colSpan={batchesParaComparar.length + 1} className="px-3.5 py-2 text-[11px] uppercase tracking-wider text-rose-400 bg-rose-950/20 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> 3. Evaluación de Incrementos (Trizado, Quebrado y Defectos)
                    </td>
                  </tr>
                  
                  {/* DELTA TRIZADO / CUARTEADO (CRUCIAL) */}
                  <tr className="bg-slate-950/30">
                    <td className="px-3.5 py-3 font-sans font-black text-white sticky left-0 bg-slate-900 z-10 border-r border-slate-800 flex flex-col">
                      <span>Δ Incremento de Trizado / Cuarteado</span>
                      <span className="text-[10px] text-slate-400 font-normal">Objetivo: Δ ≤ 0.8%</span>
                    </td>
                    {batchesParaComparar.map(b => {
                      const isGood = b.deltaTrizado <= 0.6;
                      const isMed = b.deltaTrizado > 0.6 && b.deltaTrizado <= 1.2;
                      return (
                        <td key={b.batchId} className="px-3.5 py-3 text-center border-r border-slate-800">
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-black border ${
                              isGood
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : isMed
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}>
                              +{b.deltaTrizado}%
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1">
                              ({b.trizadoIngreso}% → {b.trizadoSalida}%)
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* DELTA QUEBRADO */}
                  <tr className="bg-slate-950/30">
                    <td className="px-3.5 py-3 font-sans font-black text-white sticky left-0 bg-slate-900 z-10 border-r border-slate-800 flex flex-col">
                      <span>Δ Incremento de Quebrado</span>
                      <span className="text-[10px] text-slate-400 font-normal">Objetivo: Δ ≤ 2.5%</span>
                    </td>
                    {batchesParaComparar.map(b => {
                      const isGood = b.deltaQuebrado <= 2.0;
                      return (
                        <td key={b.batchId} className="px-3.5 py-3 text-center border-r border-slate-800">
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-black border ${
                              isGood
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            }`}>
                              +{b.deltaQuebrado}%
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1">
                              ({b.qiIngreso}% → {b.quebradoSalida}%)
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Blancura & Gelatinización */}
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Blancura Kett & % Gelatinización
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-200 border-r border-slate-800">
                        <strong className="text-white">{b.blancuraKett}° Kett</strong> • <span className="text-cyan-300">{b.gelatinizacionPct}% Gelat.</span>
                      </td>
                    ))}
                  </tr>

                  {/* SECCIÓN 4: RESULTADOS DE COCCIÓN (OLLA & SENSORIAL) */}
                  <tr className="bg-slate-900/60 font-sans font-bold text-slate-300">
                    <td colSpan={batchesParaComparar.length + 1} className="px-3.5 py-2 text-[11px] uppercase tracking-wider text-emerald-400 bg-emerald-950/20 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> 4. Resultados Sensoriales & Desempeño en Olla (Cocción)
                    </td>
                  </tr>

                  {/* SCORE DE COCCIÓN */}
                  <tr className="bg-amber-950/10">
                    <td className="px-3.5 py-3 font-sans font-black text-amber-300 sticky left-0 bg-slate-900 z-10 border-r border-slate-800 flex flex-col">
                      <span>Puntaje de Cocción (Olla)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Escala 0 - 100 pts</span>
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-3 text-center border-r border-slate-800">
                        <div className="inline-flex flex-col items-center">
                          <span className="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-sm shadow flex items-center gap-1">
                            <Award className="w-4 h-4 fill-current text-slate-950" />
                            <span>{b.coccionScore} pts</span>
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold mt-1 font-sans">
                            {b.solturaGrano}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Tiempo de Cocción
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 font-sans text-center text-slate-200 border-r border-slate-800">
                        {b.tiempoCoccionMin}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Ratio Absorción de Agua
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 font-sans text-center text-cyan-300 border-r border-slate-800">
                        {b.ratioAbsorcionAgua}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Expansión Volumétrica & Textura
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 font-sans text-center text-slate-300 border-r border-slate-800 text-[11px]">
                        <div>{b.expansionVolumetrica}</div>
                        <div className="text-slate-400 italic text-[10px] mt-0.5">{b.texturaFirmeza}</div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      Desplazamiento & Fluidez (seg)
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-amber-300 font-bold border-r border-slate-800 text-xs font-mono">
                        {b.desplazamientoSeg || "15 seg"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-300 sticky left-0 bg-slate-850 z-10 border-r border-slate-800">
                      % G. Hinchado / % G. Abierto
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-2.5 text-center text-slate-300 border-r border-slate-800 text-[11px] font-mono">
                        <span className="text-emerald-400 font-bold">{b.granoHinchadoPct ?? 8.6}% Hinch.</span> • <span className="text-amber-400">{b.granoAbiertoPct ?? 1.3}% Abierto</span>
                      </td>
                    ))}
                  </tr>

                  {/* SECCIÓN 5: ÍNDICE DE EFICIENCIA GLOBAL Y REPLICABILIDAD */}
                  <tr className="bg-slate-950 font-sans font-bold">
                    <td className="px-3.5 py-4 font-sans font-black text-amber-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800 flex flex-col">
                      <span className="text-sm">CALIFICACIÓN GLOBAL (IEP)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Índice Eficiencia Proceso</span>
                    </td>
                    {batchesParaComparar.map(b => (
                      <td key={b.batchId} className="px-3.5 py-4 text-center border-r border-slate-800 bg-slate-950">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xl font-black text-amber-400 font-mono">
                            {b.iepScore} / 100
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            Ranking #{b.ranking}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate("analisis-vaporizado", b.batchId)}
                                className="px-2 py-1 bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Ver / Editar Calidad y Cocción de este Batch"
                              >
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                <span>Calidad</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAbrirReplicar(b)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] flex items-center gap-1 shadow cursor-pointer active:scale-95 transition-all"
                              title="Replicar este proceso en nuevos lotes"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Replicar</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>

                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: RANKING GENERAL DE PROCESOS (TABLA DE TODOS LOS BATCHES)          */}
      {/* ========================================================================= */}
      {viewMode === "ranking" && (
        <div className="bg-slate-850 rounded-2xl border border-slate-750 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-750 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-sm">
                Ranking de Eficiencia de Procesos de Vaporizado (Todos los Batches)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total evaluados: {evaluacionesFiltradas.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-bold">
                <tr>
                  <th className="p-3 text-center w-14">Rank</th>
                  <th className="p-3">Batch / Secado</th>
                  <th className="p-3">Variedad & Cliente</th>
                  <th className="p-3 text-center">Presión Vapor</th>
                  <th className="p-3 text-center">Tiempos Vap/Rep</th>
                  <th className="p-3 text-center">Δ Trizado</th>
                  <th className="p-3 text-center">Δ Quebrado</th>
                  <th className="p-3 text-center">Cocción Olla</th>
                  <th className="p-3 text-right">Score IEP</th>
                  <th className="p-3 text-right">Acción Replicar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {evaluacionesFiltradas.map((e) => (
                  <tr 
                    key={e.batchId}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      e.esGoldenBatch ? "bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="p-3 text-center font-bold">
                      {e.ranking === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow">
                          1
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">#{e.ranking}</span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-mono font-bold text-amber-400 text-xs">
                        BATCH {e.correlativo}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        Secado en {e.equipo.includes("GINSAC") ? "GINSAC" : "APIT"} • {e.fecha}
                      </div>
                    </td>

                    <td className="p-3 font-sans">
                      <div className="font-semibold text-slate-200 text-xs">
                        {e.variedad}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                        {e.cliente}
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs">
                        {e.presionVaporBar} bar
                      </span>
                    </td>

                    <td className="p-3 text-center text-slate-300 text-xs">
                      {e.tiempoVaporMin} min / {e.tiempoReposoMin} min
                    </td>

                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        e.deltaTrizado <= 0.6 ? "text-emerald-400 bg-emerald-950/60" : "text-amber-300 bg-amber-950/60"
                      }`}>
                        +{e.deltaTrizado}%
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        e.deltaQuebrado <= 2.0 ? "text-emerald-400 bg-emerald-950/60" : "text-amber-300 bg-amber-950/60"
                      }`}>
                        +{e.deltaQuebrado}%
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>{e.coccionScore} pts</span>
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <span className="text-base font-black text-amber-400">
                        {e.iepScore}
                      </span>
                    </td>

                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate("analisis-vaporizado", e.batchId)}
                            className="p-1.5 bg-purple-950/60 hover:bg-purple-900 text-purple-300 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-purple-800/60 cursor-pointer"
                            title="Ver / Registrar Calidad y Cocción de este Batch"
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Calidad</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAbrirReplicar(e)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                          title="Replicar esta receta en otros lotes"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Replicar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: RECETARIO MAESTRO DE VAPORIZADO (RECETAS DORADAS GUARDADAS)       */}
      {/* ========================================================================= */}
      {viewMode === "recetas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              Recetario Maestro de Vaporizado (Parámetros Validados para Replicar)
            </h3>
            <span className="text-xs text-slate-400">
              Estas recetas se aplican automáticamente al programar lotes de la misma variedad
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recetasMaestras.map(rec => (
              <div 
                key={rec.id}
                className="bg-slate-850 rounded-2xl border border-slate-750 p-4 space-y-3 shadow-xl hover:border-amber-500/50 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold border border-amber-500/30">
                      {rec.variedad}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                      IEP {rec.iepScore} pts
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-xs leading-snug">
                    {rec.nombreReceta}
                  </h4>

                  <p className="text-[11px] text-slate-400 leading-relaxed italic">
                    "{rec.recomendacionesUso}"
                  </p>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-750 text-xs font-mono space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Presión / Temp:</span>
                      <strong className="text-amber-300">{rec.parametros.presionVaporBar} bar / {rec.parametros.tempVaporC}°C</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vapor / Reposo:</span>
                      <strong className="text-white">{rec.parametros.tiempoVaporMin} min / {rec.parametros.tiempoReposoMin} min</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Δ Trizado Prom.:</span>
                      <strong className="text-emerald-400">+{rec.deltaTrizado}% (Mínimo)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cocción Olla:</span>
                      <strong className="text-amber-400">★ {rec.coccionScore} pts</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-750 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    Origen: Batch {rec.correlativoOrigen}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecetaParaReplicar(rec);
                      setIsReplicarModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all shadow active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Aplicar en Lotes</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE REPLICACIÓN DE PROCESO EN LOTES PENDIENTES                       */}
      {/* ========================================================================= */}
      {isReplicarModalOpen && recetaParaReplicar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Replicar Proceso Térmico y Resultados de Cocción
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aplica la receta dorada en lotes pendientes de procesamiento
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsReplicarModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receta Seleccionada Resumen */}
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Receta Maestra Seleccionada
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                  IEP {recetaParaReplicar.iepScore} pts • Cocción {recetaParaReplicar.coccionScore} pts
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {recetaParaReplicar.nombreReceta}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono text-slate-300">
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">PRESIÓN VAPOR:</span>
                  <strong className="text-amber-300">{recetaParaReplicar.parametros.presionVaporBar} bar</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">TIEMPO VAPOR:</span>
                  <strong className="text-white">{recetaParaReplicar.parametros.tiempoVaporMin} min</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">REPOSO TÉRMICO:</span>
                  <strong className="text-emerald-400">{recetaParaReplicar.parametros.tiempoReposoMin} min</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">SECADO TORRE:</span>
                  <strong className="text-cyan-300">{recetaParaReplicar.parametros.tempSecadoC}°C</strong>
                </div>
              </div>
            </div>

            {/* Selector de Lotes Aptos a Procesar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Seleccionar Lote(s) donde se replicará esta receta:
                </label>
                <span className="text-[11px] text-slate-400">
                  {lotesSeleccionadosReplicar.length} seleccionado(s)
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                {lotes
                  .filter(l => l.ESTADO_LOTE === "APTO" || l.ESTADO_LOTE === "ANALIZADO" || l.ESTADO_LOTE === "PROGRAMADO")
                  .map(l => {
                    const isSelected = lotesSeleccionadosReplicar.includes(l.LOTE_ID);
                    const isMismaVar = l.VARIEDAD?.toLowerCase().includes(recetaParaReplicar.variedad.toLowerCase());

                    return (
                      <div
                        key={l.LOTE_ID}
                        onClick={() => {
                          setLotesSeleccionadosReplicar(prev => 
                            prev.includes(l.LOTE_ID) 
                              ? prev.filter(id => id !== l.LOTE_ID) 
                              : [...prev, l.LOTE_ID]
                          );
                        }}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-500/50 text-white"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => {}} 
                            className="rounded border-slate-750 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="font-mono font-bold text-cyan-300">{l.LOTE_ID}</span>
                          <span className="font-semibold text-white">{l.VARIEDAD}</span>
                          <span className="text-slate-400">({l.CLIENTE || "Sin cliente"})</span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          {isMismaVar && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold">
                              Misma Variedad
                            </span>
                          )}
                          <span className="text-slate-400">{l.HUM || l.HUMEDAD}% H</span>
                          <span className="text-emerald-400 font-bold">{((l.PESO_KG || 0) / 1000).toFixed(1)} TN</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReplicarModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarReplicacion}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Aplicar Receta en Programación ({lotesSeleccionadosReplicar.length} Lotes)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Integración de Cocción Externa */}
      <IntegracionCoccionModal
        isOpen={isCoccionModalOpen}
        onClose={() => setIsCoccionModalOpen(false)}
        currentUser={currentUser}
        onDatosActualizados={() => {
          setCoccionUpdateKey(k => k + 1);
          setNotifMessage("✅ Datos de cocción de Vaporizado sincronizados y actualizados.");
          setTimeout(() => setNotifMessage(null), 4000);
        }}
      />

    </div>
  );
};
