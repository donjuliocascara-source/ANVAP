import React, { useState, useMemo, useEffect } from "react";
import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  ResultadoCoccionExterno,
  UserProfile,
  ControlVaporizado,
  AnalisisVaporizado,
  Presecado,
  AnalisisHumedo,
  AnalisisSeco
} from "../types";
import { 
  obtenerResultadosCoccionLocales, 
  buscarCoccionParaBatch, 
  guardarCoccionParaBatch 
} from "../utils/integracionCoccionService";
import { ResumenSinteticoCoccionCard } from "./ResumenSinteticoCoccionCard";
import { 
  Flame, 
  Clock, 
  Scale, 
  Layers, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Search, 
  Filter, 
  Zap, 
  Award, 
  ArrowRight, 
  Sparkles, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  Info,
  Droplets,
  Calendar,
  UserCheck
} from "lucide-react";

interface EvaluacionCoccionesViewProps {
  batches: BatchVaporizado[];
  batchLotes: BatchLote[];
  lotes: Lote[];
  controles?: ControlVaporizado[];
  analisisVapList?: AnalisisVaporizado[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecos?: AnalisisSeco[];
  analisisSecList?: AnalisisSeco[];
  currentUser?: UserProfile;
  onNavigate?: (tab: string, filterId?: string) => void;
  onRefreshData?: () => void;
}

interface BatchCoccionStatus {
  batch: BatchVaporizado;
  loteIds: string[];
  coccion: ResultadoCoccionExterno | null;
  estado: "SIN_DATOS" | "PARCIAL" | "COMPLETO";
  faltantes: {
    tiempoCoccion: boolean;
    dosificacion: boolean;
    granoCocido: boolean;
    defectosOlla: boolean;
    texturaPegoteo: boolean;
    puntajeCoccion: boolean;
    envaseProyectado: boolean;
  };
  totalFaltantes: number;
  esPendiente: boolean;
}

export const EvaluacionCoccionesView: React.FC<EvaluacionCoccionesViewProps> = ({
  batches = [],
  batchLotes = [],
  lotes = [],
  currentUser,
  onNavigate,
  onRefreshData
}) => {
  const [coccionUpdateKey, setCoccionUpdateKey] = useState<number>(0);
  const [resultadosCoccion, setResultadosCoccion] = useState<ResultadoCoccionExterno[]>(() => 
    obtenerResultadosCoccionLocales()
  );

  // Escuchar eventos de cocción actualizada
  useEffect(() => {
    const handleUpdate = () => {
      setResultadosCoccion(obtenerResultadosCoccionLocales());
      setCoccionUpdateKey(prev => prev + 1);
    };
    window.addEventListener("coccion_actualizada", handleUpdate);
    return () => window.removeEventListener("coccion_actualizada", handleUpdate);
  }, []);

  // Filter States: Default is "solo_pendientes" as requested by the user
  const [viewFilter, setViewFilter] = useState<"solo_pendientes" | "sin_datos" | "parciales" | "completados" | "todos">("solo_pendientes");
  const [missingFieldFilter, setMissingFieldFilter] = useState<string>("todos");
  const [selectedVariedad, setSelectedVariedad] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Expandable cards
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Modal de Carga Rápida de Cocción
  const [modalBatch, setModalBatch] = useState<BatchVaporizado | null>(null);
  const [modalFormData, setModalFormData] = useState<Partial<ResultadoCoccionExterno>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Computed Status of each Batch
  const batchStatuses = useMemo<BatchCoccionStatus[]>(() => {
    return batches.map(batch => {
      const loteIds = batchLotes
        .filter(bl => bl.BATCH_ID === batch.BATCH_ID)
        .map(bl => bl.LOTE_ID);

      const coccion = buscarCoccionParaBatch(
        batch.BATCH_ID,
        batch.CORRELATIVO,
        loteIds,
        resultadosCoccion
      );

      if (!coccion) {
        return {
          batch,
          loteIds,
          coccion: null,
          estado: "SIN_DATOS",
          faltantes: {
            tiempoCoccion: true,
            dosificacion: true,
            granoCocido: true,
            defectosOlla: true,
            texturaPegoteo: true,
            puntajeCoccion: true,
            envaseProyectado: true
          },
          totalFaltantes: 7,
          esPendiente: true
        };
      }

      const tiempoFalta = coccion.tiempoCoccionMin === undefined || 
                          coccion.tiempoCoccionMin === null || 
                          String(coccion.tiempoCoccionMin).trim() === "";

      const dosifFalta = !coccion.tazasArroz || 
                         !coccion.tazasAgua || 
                         String(coccion.tazasAgua).trim() === "";

      const granoCocidoFalta = !coccion.sabor || 
                               !coccion.desplazamientoSeg || 
                               String(coccion.desplazamientoSeg).trim() === "";

      const defectosFalta = coccion.granoQuebradoOllaPct === undefined && 
                            coccion.granoHinchadoPct === undefined && 
                            coccion.granoAbiertoPct === undefined;

      const texturaFalta = !coccion.texturaFrio && !coccion.texturaFrioDescarga;

      const puntajeFalta = coccion.puntajeCoccion === undefined || 
                           coccion.puntajeCoccion === null || 
                           coccion.puntajeCoccion <= 0;

      const envaseFalta = !coccion.envaseProyectado || 
                          coccion.envaseProyectado.trim() === "";

      const faltantes = {
        tiempoCoccion: Boolean(tiempoFalta),
        dosificacion: Boolean(dosifFalta),
        granoCocido: Boolean(granoCocidoFalta),
        defectosOlla: Boolean(defectosFalta),
        texturaPegoteo: Boolean(texturaFalta),
        puntajeCoccion: Boolean(puntajeFalta),
        envaseProyectado: Boolean(envaseFalta)
      };

      const totalFaltantes = Object.values(faltantes).filter(Boolean).length;
      const esPendiente = totalFaltantes > 0;
      const estado = totalFaltantes === 7 ? "SIN_DATOS" : esPendiente ? "PARCIAL" : "COMPLETO";

      return {
        batch,
        loteIds,
        coccion,
        estado,
        faltantes,
        totalFaltantes,
        esPendiente
      };
    });
  }, [batches, batchLotes, resultadosCoccion]);

  // Global counts
  const counts = useMemo(() => {
    const total = batchStatuses.length;
    const pendientes = batchStatuses.filter(s => s.esPendiente).length;
    const sinDatos = batchStatuses.filter(s => s.estado === "SIN_DATOS").length;
    const parciales = batchStatuses.filter(s => s.estado === "PARCIAL").length;
    const completados = batchStatuses.filter(s => s.estado === "COMPLETO").length;
    return { total, pendientes, sinDatos, parciales, completados };
  }, [batchStatuses]);

  // Available varieties
  const variedadesDisponibles = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => {
      if (b.VARIEDAD) set.add(b.VARIEDAD.trim());
    });
    return Array.from(set).sort();
  }, [batches]);

  // Filtered List based on user selection
  const filteredBatches = useMemo(() => {
    return batchStatuses.filter(item => {
      // 1. Primary Filter Mode
      if (viewFilter === "solo_pendientes" && !item.esPendiente) return false;
      if (viewFilter === "sin_datos" && item.estado !== "SIN_DATOS") return false;
      if (viewFilter === "parciales" && item.estado !== "PARCIAL") return false;
      if (viewFilter === "completados" && item.estado !== "COMPLETO") return false;

      // 2. Specific Missing Field Filter
      if (missingFieldFilter !== "todos") {
        if (!item.faltantes[missingFieldFilter as keyof typeof item.faltantes]) {
          return false;
        }
      }

      // 3. Variety Filter
      if (selectedVariedad !== "TODAS") {
        if (!item.batch.VARIEDAD?.toLowerCase().includes(selectedVariedad.toLowerCase())) {
          return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const corr = (item.batch.CORRELATIVO || "").toLowerCase();
        const bId = (item.batch.BATCH_ID || "").toLowerCase();
        const cli = (item.batch.CLIENTE || "").toLowerCase();
        const lotesStr = item.loteIds.join(" ").toLowerCase();
        if (!corr.includes(q) && !bId.includes(q) && !cli.includes(q) && !lotesStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [batchStatuses, viewFilter, missingFieldFilter, selectedVariedad, searchQuery]);

  // Open Modal for data loading
  const handleOpenCargaCoccion = (item: BatchCoccionStatus) => {
    const existing = item.coccion;
    setModalBatch(item.batch);
    setModalFormData({
      batchId: item.batch.BATCH_ID,
      correlativo: item.batch.CORRELATIVO || item.batch.BATCH_ID,
      loteId: item.loteIds.join(", "),
      variedad: item.batch.VARIEDAD || "Variedad General",
      cliente: item.batch.CLIENTE || "",
      // Punto 1: Dosificación estándar de laboratorio
      tazasArroz: existing?.tazasArroz ?? 3,
      tazasAgua: existing?.tazasAgua ?? "3 1/2",
      tiempoCoccionMin: existing?.tiempoCoccionMin ?? 30,
      // A partir del Punto 2: Aparecen vacíos para nuevo ingreso
      sabor: existing?.sabor || "",
      desplazamientoSeg: existing?.desplazamientoSeg || "",
      granoQuebradoOllaPct: existing?.granoQuebradoOllaPct,
      granoHinchadoPct: existing?.granoHinchadoPct,
      granoAbiertoPct: existing?.granoAbiertoPct,
      texturaFrio: existing?.texturaFrio || "",
      rendimientoMasaPct: existing?.rendimientoMasaPct,
      envaseProyectado: existing?.envaseProyectado || "",
      dictamenEnvasado: existing?.dictamenEnvasado || "",
      puntajeCoccion: existing?.puntajeCoccion,
      panelista: existing?.panelista || currentUser?.nombre || "",
      observaciones: existing?.observaciones || ""
    });
  };

  // 1-Click Quick Fill with Standard Lab Parameters
  const handleCargaRapidaEstandar = async (item: BatchCoccionStatus) => {
    try {
      setIsSaving(true);
      const res = await guardarCoccionParaBatch({
        batchId: item.batch.BATCH_ID,
        correlativo: item.batch.CORRELATIVO || item.batch.BATCH_ID,
        loteId: item.loteIds.join(", "),
        variedad: item.batch.VARIEDAD || "Santa Cruz",
        cliente: item.batch.CLIENTE || "Molino Don Julio",
        tazasArroz: 3,
        tazasAgua: "3 1/2",
        tiempoCoccionMin: 30,
        sabor: "Neutro Característico",
        desplazamientoSeg: "15 seg",
        granoQuebradoOllaPct: 18.0,
        granoHinchadoPct: 8.6,
        granoAbiertoPct: 1.3,
        texturaFrio: "Suave al frío",
        rendimientoMasaPct: 260,
        envaseProyectado: "Saco 50 kg Don Julio Extra Selección",
        dictamenEnvasado: "CONFORME PARA LÍNEA DE ENVASADO",
        puntajeCoccion: 96,
        panelista: currentUser?.nombre || "Laboratorio de Calidad",
        observaciones: `Datos de prueba estándar homologados para Batch ${item.batch.CORRELATIVO || item.batch.BATCH_ID}.`
      });

      setResultadosCoccion(obtenerResultadosCoccionLocales());
      setCoccionUpdateKey(prev => prev + 1);
      setToastMessage(`✅ Cocción cargada exitosamente para Batch ${item.batch.CORRELATIVO || item.batch.BATCH_ID}`);
      setTimeout(() => setToastMessage(null), 4000);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert("Error al cargar cocción estándar: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Submit modal form
  const handleGuardarCoccionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalBatch) return;

    try {
      setIsSaving(true);
      await guardarCoccionParaBatch({
        ...modalFormData,
        batchId: modalBatch.BATCH_ID,
        correlativo: modalBatch.CORRELATIVO || modalBatch.BATCH_ID,
        tiempoCoccionMin: Number(modalFormData.tiempoCoccionMin) || 30,
        tazasArroz: Number(modalFormData.tazasArroz) || 3,
        puntajeCoccion: Number(modalFormData.puntajeCoccion) || 95,
        granoQuebradoOllaPct: Number(modalFormData.granoQuebradoOllaPct) || 0,
        granoHinchadoPct: Number(modalFormData.granoHinchadoPct) || 0,
        granoAbiertoPct: Number(modalFormData.granoAbiertoPct) || 0,
        rendimientoMasaPct: Number(modalFormData.rendimientoMasaPct) || 260
      });

      setResultadosCoccion(obtenerResultadosCoccionLocales());
      setCoccionUpdateKey(prev => prev + 1);
      setModalBatch(null);
      setToastMessage(`✅ Datos de cocción registrados para Batch ${modalBatch.CORRELATIVO || modalBatch.BATCH_ID}`);
      setTimeout(() => setToastMessage(null), 4000);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert("Error al guardar: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notifier */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button 
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-slate-850 p-5 rounded-2xl border border-slate-750 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              EVALUACIÓN DE COCCIONES
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-bold">
              Control de Lotes & Batches Pendientes
            </span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            Carga y Control de Batches Pendientes de Cocción
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Esta sección muestra <strong>únicamente los lotes y batches que tienen pendiente el ingreso de sus datos de cocción</strong> (o al menos uno de ellos: tiempo de cocción, dosificación, prueba de olla, textura o envase proyectado).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Navegación a Evaluación de Batch */}
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate("evaluacion-batch") : null}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer active:scale-95 transition-all"
            title="Ir a Evaluación de Batch: Resultados por Variedades, Análisis y Propuestas"
          >
            <Award className="w-4 h-4 text-amber-300" />
            <span>Ir a Evaluación de Batch (Variedades & Propuestas)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards / Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => { setViewFilter("solo_pendientes"); setMissingFieldFilter("todos"); }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            viewFilter === "solo_pendientes"
              ? "bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-500/10 ring-2 ring-rose-500/40"
              : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-400">
            • Solo Pendientes
          </span>
          <span className="text-2xl font-black text-rose-400 mt-1 block">
            {counts.pendientes}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Falta 1 o más datos
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setViewFilter("sin_datos"); setMissingFieldFilter("todos"); }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            viewFilter === "sin_datos"
              ? "bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/40"
              : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-400">
            Sin Registro
          </span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">
            {counts.sinDatos}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Totalmente vacío
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setViewFilter("parciales"); setMissingFieldFilter("todos"); }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            viewFilter === "parciales"
              ? "bg-yellow-500/20 border-yellow-500 text-white shadow-lg shadow-yellow-500/10 ring-2 ring-yellow-500/40"
              : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block text-yellow-400">
            Datos Parciales
          </span>
          <span className="text-2xl font-black text-yellow-400 mt-1 block">
            {counts.parciales}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Faltan campos específicos
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setViewFilter("completados"); setMissingFieldFilter("todos"); }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            viewFilter === "completados"
              ? "bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/40"
              : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-400">
            Completos
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {counts.completados}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            100% de datos cargados
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setViewFilter("todos"); setMissingFieldFilter("todos"); }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            viewFilter === "todos"
              ? "bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/40"
              : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block text-purple-400">
            Total Batches
          </span>
          <span className="text-2xl font-black text-white mt-1 block">
            {counts.total}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Histórico registrado
          </span>
        </button>
      </div>

      {/* Control Bar: Filter by missing field, search, variety */}
      <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>Filtrar por dato pendiente:</span>
          </div>

          <select
            value={missingFieldFilter}
            onChange={(e) => setMissingFieldFilter(e.target.value)}
            className="bg-slate-900 border border-slate-750 text-amber-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:border-amber-500 focus:outline-none"
          >
            <option value="todos">Todos los campos pendientes</option>
            <option value="tiempoCoccion">⏱️ Falta Tiempo de Cocción (min)</option>
            <option value="dosificacion">🥣 Falta Dosificación (Arroz / Agua)</option>
            <option value="granoCocido">🍚 Falta Prueba en Olla (Sabor / Desplazamiento)</option>
            <option value="defectosOlla">⚠️ Falta Defectos en Olla (% Quebrado / Hinchado)</option>
            <option value="texturaPegoteo">❄️ Falta Textura al Frío / Pegoteo</option>
            <option value="puntajeCoccion">🏆 Falta Calificación / Score</option>
            <option value="envaseProyectado">📦 Falta Envase Proyectado</option>
          </select>

          {/* Variedad */}
          <select
            value={selectedVariedad}
            onChange={(e) => setSelectedVariedad(e.target.value)}
            className="bg-slate-900 border border-slate-750 text-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:border-amber-500 focus:outline-none"
          >
            <option value="TODAS">Variedad: Todas ({variedadesDisponibles.length})</option>
            {variedadesDisponibles.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Buscador */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar correlativo, batch, lote, cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-750 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
          />
        </div>
      </div>

      {/* Warning Notice Banner if in "solo_pendientes" */}
      {viewFilter === "solo_pendientes" && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Mostrando <strong>{filteredBatches.length} batches con datos de cocción pendientes</strong>. Ingrese los datos haciendo clic en <strong>"Cargar / Completar Datos"</strong> o use <strong>"Carga Estándar Rápida"</strong>.
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 font-bold shrink-0">
            Filtro Estricto Activo
          </span>
        </div>
      )}

      {/* Batches List */}
      {filteredBatches.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
          <h3 className="text-base font-bold text-white">
            {viewFilter === "solo_pendientes" 
              ? "¡Excelente! No hay batches pendientes de ingresar datos de cocción."
              : "No se encontraron batches con los filtros seleccionados."}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {viewFilter === "solo_pendientes"
              ? "Todos los batches registrados tienen sus variables de cocción en olla completas y homologadas."
              : "Intente cambiar el filtro de vista o el término de búsqueda."}
          </p>
          {viewFilter === "solo_pendientes" && (
            <button
              type="button"
              onClick={() => setViewFilter("todos")}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Ver todos los batches ({counts.total})
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBatches.map(item => {
            const b = item.batch;
            const c = item.coccion;
            const isExpanded = expandedBatchId === b.BATCH_ID;

            return (
              <div
                key={b.BATCH_ID}
                className={`bg-slate-850 rounded-2xl border transition-all shadow-md ${
                  item.estado === "SIN_DATOS"
                    ? "border-rose-500/50 hover:border-rose-400/80"
                    : item.estado === "PARCIAL"
                    ? "border-yellow-500/50 hover:border-yellow-400/80"
                    : "border-slate-750 hover:border-slate-700"
                }`}
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-white font-mono flex items-center gap-2">
                        BATCH {b.CORRELATIVO || b.BATCH_ID}
                      </span>

                      {/* State Badge */}
                      {item.estado === "SIN_DATOS" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          PENDIENTE TOTAL (Sin Datos)
                        </span>
                      )}
                      {item.estado === "PARCIAL" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-black flex items-center gap-1">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          DATOS PARCIALES ({item.totalFaltantes} campos pendientes)
                        </span>
                      )}
                      {item.estado === "COMPLETO" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          COCCIÓN COMPLETA (100%)
                        </span>
                      )}

                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                        {b.VARIEDAD || "Variedad General"}
                      </span>
                      {b.CLIENTE && (
                        <span className="text-xs text-slate-400">
                          • {b.CLIENTE}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>Lotes MP: <strong className="text-slate-200">{item.loteIds.length > 0 ? item.loteIds.join(", ") : "Sin asignar"}</strong></span>
                      <span>Sacos: <strong className="text-slate-200">{b.TOTAL_SACOS || "—"}</strong></span>
                      <span>Autoclave: <strong className="text-slate-200">{b.EQUIPO_ASIGNADO || "—"}</strong></span>
                      {b.FECHA_REGISTRO && <span>Fecha: <strong className="text-slate-300">{b.FECHA_REGISTRO}</strong></span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Botón Principal: Cargar / Completar */}
                    <button
                      type="button"
                      onClick={() => handleOpenCargaCoccion(item)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95 ${
                        item.esPendiente
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 ring-2 ring-amber-400/40"
                          : "bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-750"
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{item.estado === "SIN_DATOS" ? "Cargar Datos de Cocción" : "Completar / Editar"}</span>
                    </button>

                    {/* Carga Rápida Estándar en 1 Clic */}
                    {item.esPendiente && (
                      <button
                        type="button"
                        onClick={() => handleCargaRapidaEstandar(item)}
                        disabled={isSaving}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition active:scale-95"
                        title="Rellenar automáticamente con datos estándar de laboratorio (30 min, 3 tz arroz, 3.5 tz agua, etc.)"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
                        <span>Carga Estándar Rápida</span>
                      </button>
                    )}

                    {/* Ver Ficha Resumen Sintética */}
                    {c && (
                      <button
                        type="button"
                        onClick={() => setExpandedBatchId(isExpanded ? null : b.BATCH_ID)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-750 transition cursor-pointer"
                        title={isExpanded ? "Ocultar Resumen Sintético" : "Ver Resumen Sintético de Cocción"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Checklist Visual de Variables de Cocción */}
                <div className="px-4 sm:px-5 pb-4 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* 1. Tiempo de Cocción */}
                    <div className={`p-2.5 rounded-xl border text-xs transition ${
                      item.faltantes.tiempoCoccion 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Tiempo Cocción
                        </span>
                        {item.faltantes.tiempoCoccion ? (
                          <span className="text-[9px] font-black px-1 rounded bg-rose-500/30 text-rose-300">FALTA</span>
                        ) : (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                      <div className="font-mono font-black text-xs text-white">
                        {item.faltantes.tiempoCoccion ? "⚠️ No registrado" : `${c?.tiempoCoccionMin} min`}
                      </div>
                    </div>

                    {/* 2. Dosificación */}
                    <div className={`p-2.5 rounded-xl border text-xs transition ${
                      item.faltantes.dosificacion 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Scale className="w-3 h-3 text-cyan-400" />
                          Dosificación
                        </span>
                        {item.faltantes.dosificacion ? (
                          <span className="text-[9px] font-black px-1 rounded bg-rose-500/30 text-rose-300">FALTA</span>
                        ) : (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                      <div className="font-bold text-xs text-white truncate">
                        {item.faltantes.dosificacion ? "⚠️ No registrado" : `${c?.tazasArroz} tz / ${c?.tazasAgua}`}
                      </div>
                    </div>

                    {/* 3. Grano Cocido / Olla */}
                    <div className={`p-2.5 rounded-xl border text-xs transition ${
                      item.faltantes.granoCocido 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-purple-400" />
                          Prueba de Olla
                        </span>
                        {item.faltantes.granoCocido ? (
                          <span className="text-[9px] font-black px-1 rounded bg-rose-500/30 text-rose-300">FALTA</span>
                        ) : (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                      <div className="font-bold text-xs text-white truncate">
                        {item.faltantes.granoCocido ? "⚠️ No registrado" : `${c?.sabor || "Neutro"} • ${c?.desplazamientoSeg || "—"}`}
                      </div>
                    </div>

                    {/* 4. Textura / Pegoteo */}
                    <div className={`p-2.5 rounded-xl border text-xs transition ${
                      item.faltantes.texturaPegoteo 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-blue-400" />
                          Textura al Frío
                        </span>
                        {item.faltantes.texturaPegoteo ? (
                          <span className="text-[9px] font-black px-1 rounded bg-rose-500/30 text-rose-300">FALTA</span>
                        ) : (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                      <div className="font-bold text-xs text-white truncate">
                        {item.faltantes.texturaPegoteo ? "⚠️ No registrado" : (c?.texturaFrio || c?.texturaFrioDescarga || "Suave")}
                      </div>
                    </div>

                    {/* 5. Puntaje de Cocción */}
                    <div className={`p-2.5 rounded-xl border text-xs transition ${
                      item.faltantes.puntajeCoccion 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-400" />
                          Puntaje Olla
                        </span>
                        {item.faltantes.puntajeCoccion ? (
                          <span className="text-[9px] font-black px-1 rounded bg-rose-500/30 text-rose-300">FALTA</span>
                        ) : (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                      <div className="font-mono font-black text-xs text-amber-400">
                        {item.faltantes.puntajeCoccion ? "⚠️ Sin score" : `${c?.puntajeCoccion ?? 0} pts`}
                      </div>
                    </div>

                    {/* 6. Envase Proyectado */}
                    <div className={`p-2.5 rounded-xl border text-xs transition ${
                      item.faltantes.envaseProyectado 
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                        : "bg-slate-900/90 border-slate-800 text-slate-300"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Package className="w-3 h-3 text-amber-400" />
                          Envase Proyectado
                        </span>
                        {item.faltantes.envaseProyectado ? (
                          <span className="text-[9px] font-black px-1 rounded bg-rose-500/30 text-rose-300">FALTA</span>
                        ) : (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                      <div className="font-bold text-xs text-cyan-300 truncate" title={c?.envaseProyectado}>
                        {item.faltantes.envaseProyectado ? "⚠️ Sin envase" : (c?.envaseProyectado || "Don Julio Extra")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen Expandido Sintético Oficial */}
                {isExpanded && c && (
                  <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/80 rounded-b-2xl animate-in fade-in space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Ficha Oficial: Resumen Sintético de Variables de Cocción
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenCargaCoccion(item)}
                        className="text-xs text-amber-400 hover:text-white underline font-semibold cursor-pointer"
                      >
                        Editar estos valores
                      </button>
                    </div>
                    <ResumenSinteticoCoccionCard coccion={c} showTitle={false} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CARGA RÁPIDA DE COCCIÓN */}
      {modalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-850 p-4 border-b border-slate-750 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                  REGISTRO OPERATIVO DE COCCIÓN
                </span>
                <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                  <Flame className="w-5 h-5 text-amber-400" />
                  Cargar Datos de Cocción — Batch {modalBatch.CORRELATIVO || modalBatch.BATCH_ID}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalBatch(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGuardarCoccionModal} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Batch Info Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Variedad:</span>
                  <strong className="text-amber-300 font-bold">{modalBatch.VARIEDAD || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Cliente:</span>
                  <strong className="text-white font-bold truncate block">{modalBatch.CLIENTE || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Total Sacos:</span>
                  <strong className="text-white font-bold">{modalBatch.TOTAL_SACOS || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Autoclave:</span>
                  <strong className="text-white font-bold">{modalBatch.EQUIPO_ASIGNADO || "—"}</strong>
                </div>
              </div>

              {/* SECCIÓN 1: DOSIFICACIÓN & TIEMPO */}
              <div className="p-4 bg-slate-850 rounded-xl border border-slate-750 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-750 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    1. Dosificación Estándar & Tiempo
                  </span>
                  <span className="text-[10px] text-slate-400">Protocolo de Laboratorio</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Tazas Arroz
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={modalFormData.tazasArroz ?? 3}
                      onChange={(e) => setModalFormData(p => ({ ...p, tazasArroz: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold focus:border-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Tazas Agua
                    </label>
                    <input
                      type="text"
                      value={modalFormData.tazasAgua || "3 1/2"}
                      onChange={(e) => setModalFormData(p => ({ ...p, tazasAgua: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-bold focus:border-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Tiempo Cocción (min) <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={typeof modalFormData.tiempoCoccionMin === "number" ? modalFormData.tiempoCoccionMin : 30}
                      onChange={(e) => setModalFormData(p => ({ ...p, tiempoCoccionMin: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border-2 border-amber-500/60 rounded-lg px-3 py-2 text-xs text-amber-400 font-black focus:border-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: EVALUACIÓN DE GRANO COCIDO EN OLLA */}
              <div className="p-4 bg-slate-850 rounded-xl border border-slate-750 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-750 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    2. Evaluación de Grano Cocido en Olla
                  </span>
                  <span className="text-[10px] text-slate-400">Soltura y Textura</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Sabor en Olla
                    </label>
                    <input
                      type="text"
                      value={modalFormData.sabor || ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, sabor: e.target.value }))}
                      placeholder="Ej: Neutro Característico"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Desplazamiento (seg)
                    </label>
                    <input
                      type="text"
                      value={modalFormData.desplazamientoSeg || ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, desplazamientoSeg: e.target.value }))}
                      placeholder="Ej: 15 seg"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-semibold focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Textura al Frío
                    </label>
                    <input
                      type="text"
                      value={modalFormData.texturaFrio || ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, texturaFrio: e.target.value }))}
                      placeholder="Ej: Suave al frío"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-300 font-semibold focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      % Quebrado en Olla
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={modalFormData.granoQuebradoOllaPct ?? ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, granoQuebradoOllaPct: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      placeholder="0.0"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      % Grano Hinchado
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={modalFormData.granoHinchadoPct ?? ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, granoHinchadoPct: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      placeholder="0.0"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-purple-300 font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      % Grano Abierto
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={modalFormData.granoAbiertoPct ?? ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, granoAbiertoPct: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      placeholder="0.0"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-rose-300 font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: ENVASE PROYECTADO & PUNTAJE */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-slate-850 to-amber-500/10 rounded-xl border-2 border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    3. Envase Proyectado & Calificación de Calidad
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    ★ Certificación de Olla
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Presentación / Envase Proyectado Oficial
                    </label>
                    <input
                      type="text"
                      value={modalFormData.envaseProyectado || ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, envaseProyectado: e.target.value }))}
                      placeholder="Ej: Saco 50 kg Don Julio Extra Selección"
                      list="envases-sugeridos"
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-white font-black focus:border-amber-400 focus:outline-none"
                    />
                    <datalist id="envases-sugeridos">
                      <option value="Saco 50 kg Don Julio Extra Selección" />
                      <option value="Saco 50 kg Don Julio Superior" />
                      <option value="Bolsa 5 kg Don Julio Familiar" />
                      <option value="Bolsa 1 kg Don Julio Gourmet / Selección" />
                      <option value="Saco 25 kg Don Julio Especial" />
                      <option value="Saco 50 kg Corriente / Granel" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Puntaje / Calificación Global de Cocción (0 - 100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={modalFormData.puntajeCoccion ?? ""}
                      onChange={(e) => setModalFormData(p => ({ ...p, puntajeCoccion: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      placeholder="Ej: 95"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-black focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Observaciones / Panelista
                  </label>
                  <input
                    type="text"
                    value={modalFormData.observaciones || ""}
                    onChange={(e) => setModalFormData(p => ({ ...p, observaciones: e.target.value }))}
                    placeholder="Ej: Prueba satisfactoria, sin pegoteo, grano con excelente soltura."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalBatch(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
                >
                  {isSaving ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar Registro de Cocción</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
