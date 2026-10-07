import React, { useState, useMemo } from "react";
import { 
  HistorialBatchTrabajado, 
  RecomendacionRecetaIngreso, 
  UserProfile 
} from "../types";
import { 
  obtenerHistorialBatches, 
  guardarBatchEnSabana, 
  recomendarRecetaPorPerfilIngreso 
} from "../utils/sabanaBatchesService";
import { 
  Sparkles, 
  Award, 
  Gauge, 
  Clock, 
  Sliders, 
  ArrowRight, 
  CheckCircle2, 
  Filter, 
  Search, 
  Plus, 
  Download, 
  Flame, 
  Layers, 
  FileSpreadsheet, 
  Info, 
  Zap, 
  Check, 
  RotateCcw,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  BarChart3
} from "lucide-react";
import { AnalisisDataSabanaView } from "./AnalisisDataSabanaView";

interface SabanaBatchesReplicadorViewProps {
  currentUser?: UserProfile;
  onNavigate?: (tab: string, filterId?: string) => void;
  onReplicarEnBatch?: (params: {
    variedad: string;
    equipo: string;
    presion1: number;
    rpm1: number;
    reposo1: number;
    presion2?: number;
    rpm2?: number;
    reposo2?: number;
    batchOrigen: string | number;
  }) => void;
  vistaInicial?: "asistente" | "sabana" | "golden" | "analisis";
}

export const SabanaBatchesReplicadorView: React.FC<SabanaBatchesReplicadorViewProps> = ({
  currentUser,
  onNavigate,
  onReplicarEnBatch,
  vistaInicial
}) => {
  // Lista de datos históricos de la sábana
  const [historial, setHistorial] = useState<HistorialBatchTrabajado[]>(() => obtenerHistorialBatches());

  // Modo de visualización: "analisis" | "asistente" | "sabana" | "golden"
  const [vistaActiva, setVistaActiva] = useState<"asistente" | "sabana" | "golden" | "analisis">(vistaInicial || "analisis");

  // Filtros de búsqueda en la sábana
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroProceso, setFiltroProceso] = useState<string>("TODOS");
  const [filtroVariedad, setFiltroVariedad] = useState<string>("TODAS");
  const [soloExitosos, setSoloExitosos] = useState(false);

  // Estados del Recomendador Interactivo
  const [variedadInput, setVariedadInput] = useState<string>("VALOR");
  const [humedadInput, setHumedadInput] = useState<number>(14.0);
  const [quebradoInput, setQuebradoInput] = useState<number>(12.0);
  const [tipoProcesoManual, setTipoProcesoManual] = useState<"AUTO" | "PRESECADO" | "HUMEDO" | "SECO">("AUTO");

  // Modal para agregar nuevo registro a la sábana
  const [isNuevoModalOpen, setIsNuevoModalOpen] = useState(false);
  const [nuevoBatchForm, setNuevoBatchForm] = useState<Partial<HistorialBatchTrabajado>>({
    batch: "",
    variedad: "VALOR",
    tipoProceso: "PRESECADO",
    hi: 14.0,
    qPct: 12.0,
    pres1Bar: 0.08,
    rpm1: 6,
    tReposo1Min: 35,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 70
  });

  // Notificación de éxito
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Variedades únicas presentes en la sábana
  const variedadesDisponibles = useMemo(() => {
    const setVar = new Set<string>();
    historial.forEach(h => {
      if (h.variedad) setVar.add(h.variedad.trim().toUpperCase());
    });
    return Array.from(setVar).sort();
  }, [historial]);

  // Cálculo en vivo de la recomendación inteligente
  const recomendacionActual: RecomendacionRecetaIngreso = useMemo(() => {
    const procesoParam = tipoProcesoManual === "AUTO" ? undefined : tipoProcesoManual;
    return recomendarRecetaPorPerfilIngreso(
      variedadInput,
      humedadInput,
      quebradoInput,
      procesoParam
    );
  }, [variedadInput, humedadInput, quebradoInput, tipoProcesoManual, historial]);

  // Lista filtrada para la tabla de la sábana
  const historialFiltrado = useMemo(() => {
    return historial.filter(item => {
      const matchTxt = !filtroTexto || 
        String(item.batch).toLowerCase().includes(filtroTexto.toLowerCase()) ||
        item.variedad.toLowerCase().includes(filtroTexto.toLowerCase());
      
      const matchProc = filtroProceso === "TODOS" || item.tipoProceso === filtroProceso;
      const matchVar = filtroVariedad === "TODAS" || item.variedad.toUpperCase() === filtroVariedad.toUpperCase();
      const matchExito = !soloExitosos || item.esMasExitoso || (item.puntajeExito && item.puntajeExito >= 88);

      return matchTxt && matchProc && matchVar && matchExito;
    });
  }, [historial, filtroTexto, filtroProceso, filtroVariedad, soloExitosos]);

  // Batches Golden agrupados por variedad
  const goldenPorVariedad = useMemo(() => {
    const mapa = new Map<string, HistorialBatchTrabajado[]>();
    historial.forEach(h => {
      const v = h.variedad.toUpperCase().trim();
      if (!mapa.has(v)) mapa.set(v, []);
      mapa.get(v)!.push(h);
    });

    return Array.from(mapa.entries()).map(([variedad, items]) => {
      // Ordenar por menor incQ2 (o incQ1), y mayor puntajeExito
      const ordenados = [...items].sort((a, b) => {
        const incA = a.incQ2 ?? a.incQ1 ?? 99;
        const incB = b.incQ2 ?? b.incQ1 ?? 99;
        if (incA !== incB) return incA - incB;
        return (b.puntajeExito || 0) - (a.puntajeExito || 0);
      });

      return {
        variedad,
        totalBatches: items.length,
        golden: ordenados[0],
        batches: items
      };
    });
  }, [historial]);

  const handleAplicarRecomendacion = () => {
    if (onReplicarEnBatch) {
      onReplicarEnBatch({
        variedad: recomendacionActual.variedadBuscada,
        equipo: "APIT",
        presion1: recomendacionActual.presionPase1Bar,
        rpm1: recomendacionActual.rpmExclusaPase1,
        reposo1: recomendacionActual.tiempoReposoPase1Min,
        presion2: recomendacionActual.presionPase2Bar,
        rpm2: recomendacionActual.rpmExclusaPase2,
        reposo2: recomendacionActual.tiempoReposoPase2Min,
        batchOrigen: recomendacionActual.batchReferencia.batch
      });
    }

    setMensajeExito(`Receta del Batch ${recomendacionActual.batchReferencia.batch} aplicada exitosamente a nuevo proceso APIT.`);
    setTimeout(() => setMensajeExito(null), 4500);

    if (onNavigate) {
      setTimeout(() => onNavigate("priorizacion-programacion"), 1200);
    }
  };

  const handleGuardarNuevoRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoBatchForm.batch) return;

    const updated = guardarBatchEnSabana(nuevoBatchForm);
    setHistorial(updated);
    setIsNuevoModalOpen(false);
    setMensajeExito(`Batch ${nuevoBatchForm.batch} guardado correctamente en la sábana histórica.`);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  const exportarCSV = () => {
    const headers = [
      "TIPO PROCESO", "BATCH", "VARIEDAD", "HI %", "% R.I.", "% R.B", "% Q", "% T.T.", "% TZ",
      "PRES-1", "RPM-1", "T.REPOSO-1", "INC.Q-1", "TRIZ-1",
      "PRES-2", "RPM-2", "T.REPOSO-2", "INC.Q-2", "TRIZ-2",
      "QUEBRADO COCCION", "ABIERTO COCCION", "HINCHADO COCCION", "DESPLAZAMIENTO"
    ];

    const rows = historial.map(b => [
      b.tipoProceso,
      b.batch,
      b.variedad,
      b.hi ?? "",
      b.riPct ?? "",
      b.rbPct ?? "",
      b.qPct ?? "",
      b.ttPct ?? "",
      b.tzPct ?? "",
      b.pres1Bar ?? "",
      b.rpm1 ?? "",
      b.tReposo1Min ?? "",
      b.incQ1 ?? "",
      b.triz1 ?? "",
      b.pres2Bar ?? "",
      b.rpm2 ?? "",
      b.tReposo2Min ?? "",
      b.incQ2 ?? "",
      b.triz2 ?? "",
      b.quebradoCoccionPct ?? "",
      b.abiertoCoccionPct ?? "",
      b.hinchadoCoccionPct ?? "",
      b.desplazamientoCoccionSeg ?? ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sabana_batches_apit_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="sabana-batches-container" className="space-y-6">
      {/* Mensaje de Confirmación Flotante */}
      {mensajeExito && (
        <div className="bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center justify-between border border-emerald-500 animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold text-sm">{mensajeExito}</span>
          </div>
          <button onClick={() => setMensajeExito(null)} className="text-white hover:text-emerald-100 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Base de Conocimiento Operativo & Replicador
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Sábana Histórica de Batches & Replicador de Recetas
            </h1>
            <p className="text-sm text-slate-500 max-w-3xl">
              Analiza los parámetros de ingreso (humedad, rendimientos, quebrado) y salida de los batches trabajados 
              para identificar el lote más exitoso por variedad y replicar con exactitud la presión de vapor, 
              velocidad de exclusa y tiempos de reposo en autoclave APIT.
            </p>
          </div>

          {/* Selector de Vistas de la Sábana */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              id="btn-vista-analisis"
              onClick={() => setVistaActiva("analisis")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                vistaActiva === "analisis"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-sky-600" />
              Análisis de Data & Resumen
            </button>
            <button
              id="btn-vista-asistente"
              onClick={() => setVistaActiva("asistente")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                vistaActiva === "asistente"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Replicador por Ingreso
            </button>
            <button
              id="btn-vista-sabana"
              onClick={() => setVistaActiva("sabana")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                vistaActiva === "sabana"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Sábana de Batches (313-336)
            </button>
            <button
              id="btn-vista-golden"
              onClick={() => setVistaActiva("golden")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                vistaActiva === "golden"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Award className="w-4 h-4 text-amber-600" />
              Batches Más Exitosos
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: REPLICADOR INTELIGENTE POR PARÁMETROS DE INGRESO */}
      {vistaActiva === "asistente" && (
        <div className="space-y-6">
          {/* Panel de Configuración de Nueva Variedad y Parámetros de Ingreso */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Configuración de Nuevo Lote para Replicación
                  </h2>
                  <p className="text-xs text-slate-300">
                    Indica la variedad y los parámetros de ingreso para consultar el lote más exitoso
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-400/30">
                Equipo APIT (35 TN)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              {/* Selector de Variedad */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Variedad a Procesar</span>
                  <span className="text-[10px] text-amber-400 font-normal">Existente o Nueva</span>
                </label>
                <div className="space-y-2">
                  <select
                    id="select-variedad-replicador"
                    value={variedadInput}
                    onChange={(e) => setVariedadInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    {variedadesDisponibles.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                    <option value="OTRA">OTRA (Nueva Variedad)...</option>
                  </select>

                  {variedadInput === "OTRA" && (
                    <input
                      type="text"
                      placeholder="Nombre de nueva variedad..."
                      onChange={(e) => setVariedadInput(e.target.value.toUpperCase())}
                      className="w-full bg-slate-800 border border-amber-500/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Humedad de Ingreso */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-300">Humedad de Ingreso (HI %)</label>
                  <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                    {humedadInput.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10.0"
                  max="24.0"
                  step="0.1"
                  value={humedadInput}
                  onChange={(e) => setHumedadInput(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Seco (&lt;12%)</span>
                  <span>Presecado (12-16%)</span>
                  <span>Húmedo (&gt;17%)</span>
                </div>
              </div>

              {/* Quebrado de Ingreso */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-300">% Quebrado Ingreso (% Q)</label>
                  <span className="font-mono text-slate-300">{quebradoInput.toFixed(1)}%</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="40"
                  value={quebradoInput}
                  onChange={(e) => setQuebradoInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-400 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400">Determina la fragilidad previa del grano</p>
              </div>

              {/* Modo de Proceso */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Régimen Estimado</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["AUTO", "PRESECADO", "HUMEDO", "SECO"] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTipoProcesoManual(p)}
                      className={`text-[11px] py-1.5 px-2 rounded-lg font-bold transition-all border ${
                        tipoProcesoManual === p
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {p === "AUTO" ? "Auto (Sábana)" : p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Resultado de la Recomendación y Replicación */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tarjeta del Batch Más Exitoso de Referencia */}
            <div className="bg-white border-2 border-amber-300/80 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-amber-400 text-white px-4 py-1 text-xs font-black uppercase tracking-wider rounded-bl-xl shadow-sm flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                Lote Más Exitoso
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Referencia Histórica en Planta
                </span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900">
                    Batch {recomendacionActual.batchReferencia.batch}
                  </h3>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {recomendacionActual.batchReferencia.variedad}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Tipo: <strong className="text-slate-800">{recomendacionActual.batchReferencia.tipoProceso}</strong> | 
                  HI Histórica: <strong className="text-slate-800">{recomendacionActual.batchReferencia.hi || 14}%</strong>
                </p>
              </div>

              {/* Récords Alcanzados por este Batch */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-900 font-medium">Incremento Quebrado (Salida):</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {recomendacionActual.batchReferencia.incQ2 !== null && recomendacionActual.batchReferencia.incQ2 !== undefined
                      ? `+${recomendacionActual.batchReferencia.incQ2}%`
                      : (recomendacionActual.batchReferencia.incQ1 ? `+${recomendacionActual.batchReferencia.incQ1}%` : "Controlado")}
                  </span>
                </div>
                {recomendacionActual.batchReferencia.quebradoCoccionPct !== null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-900 font-medium">Quebrado en Olla:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {recomendacionActual.batchReferencia.quebradoCoccionPct}%
                    </span>
                  </div>
                )}
                {recomendacionActual.batchReferencia.desplazamientoCoccionSeg !== null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-900 font-medium">Desplazamiento (Soltura):</span>
                    <span className="font-mono font-bold text-blue-700">
                      {recomendacionActual.batchReferencia.desplazamientoCoccionSeg} seg
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200">
                  <span className="text-amber-900 font-medium">Índice de Éxito de Receta:</span>
                  <span className="font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded text-xs">
                    {recomendacionActual.batchReferencia.puntajeExito || 95} / 100 pts
                  </span>
                </div>
              </div>

              {recomendacionActual.batchReferencia.notasExito && (
                <p className="text-xs italic text-slate-600 border-l-2 border-amber-400 pl-2.5">
                  "{recomendacionActual.batchReferencia.notasExito}"
                </p>
              )}

              <div className="pt-2">
                <button
                  id="btn-aplicar-receta-exitosa"
                  onClick={handleAplicarRecomendacion}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md hover:shadow transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Replicar esta Receta en Nuevo Batch
                </button>
              </div>
            </div>

            {/* Matriz de Parámetros Recomendados: Presión, Velocidad Exclusa y Reposo */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-blue-600" />
                    Parámetros Operativos a Replicar (Autoclave APIT)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Valores calibrados para minimizar el incremento de quebrado y lograr grano suelto
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  Coincidencia: {recomendacionActual.puntajeCoincidencia}%
                </span>
              </div>

              {/* Fichas de los 3 Parámetros Críticos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. PRESIÓN DE VAPOR */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-blue-600" />
                      Presión de Vapor
                    </span>
                    <span className="text-[10px] bg-blue-200/80 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                      bar
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-600 font-medium">Primer Pase (PRES-1):</span>
                      <span className="text-xl font-black text-blue-700 font-mono">
                        {recomendacionActual.presionPase1Bar.toFixed(2)} bar
                      </span>
                    </div>
                    {recomendacionActual.requiereSegundoPase && recomendacionActual.presionPase2Bar !== undefined && (
                      <div className="flex justify-between items-baseline pt-1 border-t border-blue-200">
                        <span className="text-xs text-slate-600 font-medium">Segundo Pase (PRES-2):</span>
                        <span className="text-lg font-bold text-blue-900 font-mono">
                          {recomendacionActual.presionPase2Bar.toFixed(2)} bar
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight pt-1">
                    {recomendacionActual.analisisPresion}
                  </p>
                </div>

                {/* 2. VELOCIDAD DE EXCLUSA */}
                <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-purple-600" />
                      Velocidad Exclusa
                    </span>
                    <span className="text-[10px] bg-purple-200/80 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                      RPM
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-600 font-medium">Primer Pase (RPM-1):</span>
                      <span className="text-xl font-black text-purple-700 font-mono">
                        {recomendacionActual.rpmExclusaPase1} RPM
                      </span>
                    </div>
                    {recomendacionActual.requiereSegundoPase && recomendacionActual.rpmExclusaPase2 !== undefined && (
                      <div className="flex justify-between items-baseline pt-1 border-t border-purple-200">
                        <span className="text-xs text-slate-600 font-medium">Segundo Pase (RPM-2):</span>
                        <span className="text-lg font-bold text-purple-900 font-mono">
                          {recomendacionActual.rpmExclusaPase2} RPM
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight pt-1">
                    {recomendacionActual.analisisVelocidadExclusa}
                  </p>
                </div>

                {/* 3. TIEMPO DE REPOSO */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Tiempo de Reposo
                    </span>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Minutos
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-600 font-medium">Reposo 1 (Pase 1):</span>
                      <span className="text-xl font-black text-emerald-700 font-mono">
                        {recomendacionActual.tiempoReposoPase1Min} min
                      </span>
                    </div>
                    {recomendacionActual.requiereSegundoPase && recomendacionActual.tiempoReposoPase2Min !== undefined && (
                      <div className="flex justify-between items-baseline pt-1 border-t border-emerald-200">
                        <span className="text-xs text-slate-600 font-medium">Reposo 2 (Pase 2):</span>
                        <span className="text-lg font-bold text-emerald-900 font-mono">
                          {recomendacionActual.tiempoReposoPase2Min} min
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight pt-1">
                    {recomendacionActual.analisisTiempoReposo}
                  </p>
                </div>
              </div>

              {/* Predicciones Técnicas y Consejos para Operador */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-700 block mb-0.5">📉 Impacto en Rendimiento:</span>
                    <p className="text-slate-600">{recomendacionActual.prediccionIncrementoQuebrado}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-700 block mb-0.5">🍲 Calidad Culinaria (Olla):</span>
                    <p className="text-slate-600">{recomendacionActual.prediccionCoccion}</p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    Pautas Clave de Operación para APIT:
                  </span>
                  <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                    {recomendacionActual.consejosOperador.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: SÁBANA COMPLETA DE BATCHES TRABAJADOS (MATRIZ OFICIAL IDÉNTICA A LA IMAGEN) */}
      {vistaActiva === "sabana" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Matriz Histórica de Batches Trabajados
              </h2>
              <p className="text-xs text-slate-500">
                Visualización detallada de Parámetros de Ingreso, Trabajo en 1er y 2do Pase, e Incrementos y Cocción
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportarCSV}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
              <button
                onClick={() => setIsNuevoModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Batch en Sábana
              </button>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Batch o Variedad..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                value={filtroProceso}
                onChange={(e) => setFiltroProceso(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="TODOS">Todos los Procesos</option>
                <option value="PRESECADO">PRESECADO</option>
                <option value="HUMEDO">HUMEDO</option>
                <option value="SECO">SECO</option>
              </select>
            </div>

            <div>
              <select
                value={filtroVariedad}
                onChange={(e) => setFiltroVariedad(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="TODAS">Todas las Variedades</option>
                {variedadesDisponibles.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={soloExitosos}
                  onChange={(e) => setSoloExitosos(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Solo Lotes Exitosos (Golden)
              </label>
            </div>
          </div>

          {/* Tabla de la Sábana con Cabeceras Idénticas a la Imagen */}
          <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-inner max-h-[620px]">
            <table className="w-full text-xs text-left border-collapse min-w-[1700px]">
              {/* Cabecera de Categorías Coloreadas */}
              <thead>
                <tr className="text-center font-black tracking-wider text-[11px] uppercase">
                  <th colSpan={3} className="bg-slate-800 text-white py-2.5 px-3 border-r border-slate-700">
                    Identificación Batch
                  </th>
                  <th colSpan={11} className="bg-sky-800 text-white py-2.5 px-3 border-r border-sky-700">
                    Parámetros de Ingreso (Materia Prima)
                  </th>
                  <th colSpan={7} className="bg-amber-600 text-white py-2.5 px-3 border-r border-amber-500">
                    Primer Pase (Vaporizado APIT)
                  </th>
                  <th colSpan={7} className="bg-indigo-700 text-white py-2.5 px-3 border-r border-indigo-600">
                    Segundo Pase (Vaporizado APIT)
                  </th>
                  <th colSpan={5} className="bg-yellow-400 text-slate-900 py-2.5 px-3 border-r border-yellow-500 font-black">
                    Resultado de Cocción (Olla)
                  </th>
                  <th className="bg-slate-700 text-white py-2.5 px-3">
                    Acción
                  </th>
                </tr>

                {/* Subcabecera de Columnas Específicas */}
                <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold border-b border-slate-300 whitespace-nowrap">
                  {/* Identificación */}
                  <th className="py-2 px-2.5 border-r border-slate-200">Tipo Proceso</th>
                  <th className="py-2 px-2.5 border-r border-slate-200">Batch</th>
                  <th className="py-2 px-2.5 border-r border-slate-300">Variedad</th>

                  {/* Ingreso */}
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">HI (%)</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% R.I.</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% R.B</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900 font-extrabold text-red-700">% Q</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% T.T.</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% P.</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% M.</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% TZ</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% G.I.</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-sky-50 text-sky-900">% G.VERDE</th>
                  <th className="py-2 px-2 border-r border-slate-300 bg-sky-50 text-sky-900">% BL. I</th>

                  {/* Primer Pase */}
                  <th className="py-2 px-2 border-r border-slate-200 bg-amber-50 text-amber-900 font-bold">PRES-1</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-amber-50 text-amber-900 font-bold">RPM-1</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-amber-50 text-amber-900 font-bold">T. REPOSO</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-amber-50 text-amber-900">TK1 (°C)</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-amber-50 text-amber-900">G.HUM</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-amber-50 text-amber-900 font-bold text-red-600">INC. Q</th>
                  <th className="py-2 px-2 border-r border-slate-300 bg-amber-50 text-amber-900">TRIZ</th>

                  {/* Segundo Pase */}
                  <th className="py-2 px-2 border-r border-slate-200 bg-indigo-50 text-indigo-900 font-bold">PRES-2</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-indigo-50 text-indigo-900 font-bold">RPM-2</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-indigo-50 text-indigo-900 font-bold">T. REPOSO</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-indigo-50 text-indigo-900">TK1 (°C)</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-indigo-50 text-indigo-900">G.HUM</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-indigo-50 text-indigo-900 font-extrabold text-red-600">INC. Q (TOT)</th>
                  <th className="py-2 px-2 border-r border-slate-300 bg-indigo-50 text-indigo-900">TRIZ</th>

                  {/* Cocción */}
                  <th className="py-2 px-2 border-r border-slate-200 bg-yellow-50 text-yellow-950 font-bold">PESO (g)</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-yellow-50 text-yellow-950 font-bold text-red-700">QUEBRADO</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-yellow-50 text-yellow-950 font-bold">ABIERTO</th>
                  <th className="py-2 px-2 border-r border-slate-200 bg-yellow-50 text-yellow-950 font-bold">HINCHADO</th>
                  <th className="py-2 px-2 border-r border-slate-300 bg-yellow-50 text-yellow-950 font-bold text-blue-800">DESPLAZ. (s)</th>

                  {/* Acción */}
                  <th className="py-2 px-2 text-center">Replicar</th>
                </tr>
              </thead>

              {/* Cuerpo de Datos */}
              <tbody className="divide-y divide-slate-200 font-mono">
                {historialFiltrado.map((b) => {
                  const esGolden = b.esMasExitoso;
                  return (
                    <tr 
                      key={b.id} 
                      className={`hover:bg-slate-50 transition-colors ${esGolden ? "bg-amber-50/40" : ""}`}
                    >
                      {/* Identificación */}
                      <td className="py-2 px-2.5 border-r border-slate-200 font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          b.tipoProceso === "PRESECADO" ? "bg-amber-100 text-amber-800" :
                          b.tipoProceso === "HUMEDO" ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-800"
                        }`}>
                          {b.tipoProceso}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 font-bold text-slate-900 flex items-center gap-1">
                        {b.batch}
                        {esGolden && (
                          <span title="Batch Dorado Exitoso" className="text-amber-500">★</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 font-sans font-semibold text-slate-800">
                        {b.variedad}
                      </td>

                      {/* Parámetros de Ingreso */}
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-800 font-bold">
                        {b.hi !== null && b.hi !== undefined ? `${b.hi}%` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.riPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.rbPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-red-700 font-semibold">{b.qPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.ttPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.pPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.mPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.tzPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.giPct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.gVerdePct ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-slate-600">{b.blIPct ?? "-"}</td>

                      {/* Primer Pase */}
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-amber-800">
                        {b.pres1Bar !== null && b.pres1Bar !== undefined ? b.pres1Bar : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-purple-700">
                        {b.rpm1 ?? "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-emerald-700">
                        {b.tReposo1Min !== null && b.tReposo1Min !== undefined ? `${b.tReposo1Min}m` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-[10px] text-slate-600">{b.tk1_1 ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.gHum1 ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-red-600">{b.incQ1 ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-slate-600">{b.triz1 ?? "-"}</td>

                      {/* Segundo Pase */}
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-indigo-800">
                        {b.pres2Bar !== null && b.pres2Bar !== undefined ? b.pres2Bar : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-purple-700">
                        {b.rpm2 ?? "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-emerald-700">
                        {b.tReposo2Min !== null && b.tReposo2Min !== undefined ? `${b.tReposo2Min}m` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-[10px] text-slate-600">{b.tk2_1 ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-600">{b.gHum2 ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 font-extrabold text-red-700">
                        {b.incQ2 !== null && b.incQ2 !== undefined ? `+${b.incQ2}%` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300 text-slate-600">{b.triz2 ?? "-"}</td>

                      {/* Cocción */}
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-700">{b.pesoCoccion ?? "-"}</td>
                      <td className="py-2 px-2 border-r border-slate-200 font-bold text-red-700">
                        {b.quebradoCoccionPct !== null && b.quebradoCoccionPct !== undefined ? `${b.quebradoCoccionPct}%` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-700">
                        {b.abiertoCoccionPct !== null && b.abiertoCoccionPct !== undefined ? `${b.abiertoCoccionPct}%` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-slate-700">
                        {b.hinchadoCoccionPct !== null && b.hinchadoCoccionPct !== undefined ? `${b.hinchadoCoccionPct}%` : "-"}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300 font-bold text-blue-700">
                        {b.desplazamientoCoccionSeg !== null && b.desplazamientoCoccionSeg !== undefined ? `${b.desplazamientoCoccionSeg}s` : "-"}
                      </td>

                      {/* Botón Replicar */}
                      <td className="py-2 px-2 text-center font-sans">
                        <button
                          onClick={() => {
                            setVariedadInput(b.variedad);
                            if (b.hi) setHumedadInput(b.hi);
                            if (b.qPct) setQuebradoInput(b.qPct);
                            setVistaActiva("asistente");
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300 transition-colors inline-flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3 text-amber-600" />
                          Replicar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: RANKING DE BATCHES MÁS EXITOSOS POR VARIEDAD */}
      {vistaActiva === "golden" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Recetas Maestras Recomendadas por Variedad
            </h2>
            <p className="text-xs text-slate-500">
              Batches con el menor incremento de quebrado y mejor desempeño en cocción registrados en planta
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goldenPorVariedad.map(({ variedad, golden, totalBatches }) => (
              <div 
                key={variedad}
                className="bg-white border-2 border-amber-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {totalBatches} {totalBatches === 1 ? "Batch evaluado" : "Batches evaluados"}
                    </span>
                    <h3 className="text-xl font-black text-slate-900">{variedad}</h3>
                  </div>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    Golden Batch {golden.batch}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Régimen:</span>
                    <strong className="text-slate-900">{golden.tipoProceso} (HI: {golden.hi ?? 14}%)</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Incremento Quebrado:</span>
                    <strong className="text-emerald-700 font-mono text-sm">
                      {golden.incQ2 !== null && golden.incQ2 !== undefined ? `+${golden.incQ2}%` : `+${golden.incQ1 || 5}%`}
                    </strong>
                  </div>
                  {golden.quebradoCoccionPct !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Quebrado en Olla:</span>
                      <strong className="text-slate-900 font-mono">{golden.quebradoCoccionPct}%</strong>
                    </div>
                  )}
                  {golden.desplazamientoCoccionSeg !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Desplazamiento:</span>
                      <strong className="text-blue-700 font-mono">{golden.desplazamientoCoccionSeg} seg</strong>
                    </div>
                  )}
                </div>

                {/* Receta Clave */}
                <div className="border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs bg-amber-50/30">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                    Receta Recomendada:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono text-[11px]">
                    <div>
                      Pase 1: <strong>{golden.pres1Bar ?? 0.08} bar</strong> / <strong>{golden.rpm1 ?? 6} RPM</strong>
                    </div>
                    <div>
                      Reposo 1: <strong>{golden.tReposo1Min ?? 35} min</strong>
                    </div>
                    {golden.pres2Bar !== null && (
                      <>
                        <div>
                          Pase 2: <strong>{golden.pres2Bar} bar</strong> / <strong>{golden.rpm2 ?? 6} RPM</strong>
                        </div>
                        <div>
                          Reposo 2: <strong>{golden.tReposo2Min ?? 70} min</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setVariedadInput(variedad);
                    if (golden.hi) setHumedadInput(golden.hi);
                    if (golden.qPct) setQuebradoInput(golden.qPct);
                    setVistaActiva("asistente");
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Cargar Parámetros en Replicador
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA 4: ANÁLISIS DE DATA Y RESUMEN ESTADÍSTICO DE RESULTADOS */}
      {vistaActiva === "analisis" && (
        <AnalisisDataSabanaView
          historial={historial}
          onSeleccionarBatchParaReplicar={(batch) => {
            setVariedadInput(batch.variedad);
            if (batch.hi) setHumedadInput(batch.hi);
            if (batch.qPct) setQuebradoInput(batch.qPct);
            setVistaActiva("asistente");
          }}
          onIrASabana={() => setVistaActiva("sabana")}
        />
      )}

      {/* MODAL REGISTRAR NUEVO BATCH EN LA SÁBANA */}
      {isNuevoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Registrar Nuevo Batch en la Sábana
              </h3>
              <button 
                onClick={() => setIsNuevoModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarNuevoRegistro} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Número de Batch *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: 337"
                    value={nuevoBatchForm.batch}
                    onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, batch: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Variedad *</label>
                  <input
                    type="text"
                    required
                    value={nuevoBatchForm.variedad}
                    onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, variedad: e.target.value.toUpperCase() }))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tipo Proceso</label>
                  <select
                    value={nuevoBatchForm.tipoProceso}
                    onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, tipoProceso: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="PRESECADO">PRESECADO</option>
                    <option value="HUMEDO">HUMEDO</option>
                    <option value="SECO">SECO</option>
                  </select>
                </div>
              </div>

              {/* Parámetros de Ingreso */}
              <div className="border border-sky-200 bg-sky-50/50 p-3 rounded-xl space-y-2">
                <span className="font-bold text-sky-900 block">Parámetros de Ingreso (Materia Prima)</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block">HI (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.hi || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, hi: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">% R.I.</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.riPct || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, riPct: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">% R.B</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.rbPct || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, rbPct: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">% Quebrado (Q)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.qPct || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, qPct: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Primer Pase */}
              <div className="border border-amber-200 bg-amber-50/50 p-3 rounded-xl space-y-2">
                <span className="font-bold text-amber-900 block">Primer Pase APIT</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block">Presión 1 (bar)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={nuevoBatchForm.pres1Bar || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, pres1Bar: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">RPM Exclusa 1</label>
                    <input
                      type="number"
                      value={nuevoBatchForm.rpm1 || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, rpm1: parseInt(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">T. Reposo 1 (min)</label>
                    <input
                      type="number"
                      value={nuevoBatchForm.tReposo1Min || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, tReposo1Min: parseInt(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Inc. Q Pase 1 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.incQ1 || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, incQ1: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Segundo Pase */}
              <div className="border border-indigo-200 bg-indigo-50/50 p-3 rounded-xl space-y-2">
                <span className="font-bold text-indigo-900 block">Segundo Pase APIT</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block">Presión 2 (bar)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={nuevoBatchForm.pres2Bar || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, pres2Bar: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">RPM Exclusa 2</label>
                    <input
                      type="number"
                      value={nuevoBatchForm.rpm2 || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, rpm2: parseInt(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">T. Reposo 2 (min)</label>
                    <input
                      type="number"
                      value={nuevoBatchForm.tReposo2Min || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, tReposo2Min: parseInt(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Inc. Q Tot (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.incQ2 || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, incQ2: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Cocción */}
              <div className="border border-yellow-300 bg-yellow-50/50 p-3 rounded-xl space-y-2">
                <span className="font-bold text-yellow-950 block">Resultado en Olla (Cocción)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block">% Quebrado Cocción</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.quebradoCoccionPct || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, quebradoCoccionPct: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">% Grano Abierto</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.abiertoCoccionPct || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, abiertoCoccionPct: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block">Desplazamiento (seg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={nuevoBatchForm.desplazamientoCoccionSeg || ""}
                      onChange={(e) => setNuevoBatchForm(prev => ({ ...prev, desplazamientoCoccionSeg: parseFloat(e.target.value) }))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNuevoModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  Guardar en Sábana
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
