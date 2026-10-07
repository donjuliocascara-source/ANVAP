import React, { useState, useMemo, useEffect } from "react";
import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  AnalisisVaporizado, 
  ResultadoCoccionExterno,
  UserProfile 
} from "../types";
import { 
  Flame, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Package, 
  Layers, 
  Filter, 
  Sparkles, 
  Droplets, 
  Scale, 
  RefreshCw, 
  FileText, 
  Award, 
  TrendingUp, 
  Plus, 
  X, 
  Check, 
  Edit3, 
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { 
  obtenerResultadosCoccionLocales, 
  buscarCoccionParaBatch, 
  guardarCoccionParaBatch 
} from "../utils/integracionCoccionService";
import { ResumenSinteticoCoccionCard } from "./ResumenSinteticoCoccionCard";
import { ResultadosDefectosCoccionView } from "./ResultadosDefectosCoccionView";
import { ProgramacionBatchOficial } from "../utils/programacionBatchOficialService";
import { AnalisisHumedo, AnalisisSeco, Presecado } from "../types";

interface ResultadosCoccionViewProps {
  batches: BatchVaporizado[];
  batchLotes: BatchLote[];
  lotes: Lote[];
  analisisVapList?: AnalisisVaporizado[];
  programaciones?: any[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecList?: AnalisisSeco[];
  currentUser?: UserProfile;
  onNavigate: (tab: string, filterId?: string, extraSubTab?: string) => void;
  onRefreshData?: () => void;
}

export const ResultadosCoccionView: React.FC<ResultadosCoccionViewProps> = ({
  batches = [],
  batchLotes = [],
  lotes = [],
  analisisVapList = [],
  programaciones = [],
  presecados = [],
  analisisHumList = [],
  analisisSecList = [],
  currentUser,
  onNavigate,
  onRefreshData
}) => {
  const [modoVista, setModoVista] = useState<"defectos_coccion" | "bandeja">("defectos_coccion");
  const [activeFilter, setActiveFilter] = useState<"PENDIENTES" | "COMPLETADOS" | "TODOS">("PENDIENTES");
  const [searchQuery, setSearchQuery] = useState("");
  const [variedadFilter, setVariedadFilter] = useState("TODAS");
  const [coccionRefreshKey, setCoccionRefreshKey] = useState(0);

  // Modal para Carga Rápida de Cocción In-Situ
  const [batchParaCoccionRapida, setBatchParaCoccionRapida] = useState<BatchVaporizado | null>(null);
  const [formDataCoccion, setFormDataCoccion] = useState({
    tiempoCoccionMin: 30,
    tazasArroz: 3,
    tazasAgua: "3 1/2",
    sabor: "",
    desplazamientoSeg: "",
    granoQuebradoOllaPct: "" as any,
    granoHinchadoPct: "" as any,
    granoAbiertoPct: "" as any,
    texturaFrio: "",
    envaseProyectado: "",
    puntajeCoccion: "" as any,
    observaciones: ""
  });
  const [isSavingCoccion, setIsSavingCoccion] = useState(false);

  // Mapear cada batch con su evaluación de cocción
  const batchesConCoccion = useMemo(() => {
    const locales = obtenerResultadosCoccionLocales();

    return batches.map(batch => {
      const bId = batch.BATCH_ID;
      const corr = batch.CORRELATIVO || batch.BATCH_ID;

      // Lotes que integran este batch
      const bls = batchLotes.filter(bl => bl.BATCH_ID === bId);
      const loteIds = bls.map(bl => bl.LOTE_ID);
      const lotesDetalle = bls.map(bl => {
        const lot = lotes.find(l => l.LOTE_ID === bl.LOTE_ID);
        return {
          loteId: bl.LOTE_ID,
          sacos: bl.SACOS,
          pesoKg: bl.PESO_KG,
          cliente: lot?.CLIENTE || "MOLINO",
          variedad: lot?.VARIEDAD || "TINAJONES"
        };
      });

      const variedadPredominante = lotesDetalle[0]?.variedad || "TINAJONES";
      const clientePrincipal = lotesDetalle[0]?.cliente || "MOLINO DON JULIO";
      const totalSacos = lotesDetalle.reduce((acc, l) => acc + (l.sacos || 0), 0);

      // Buscar si tiene muestra física de descarga registrada
      const muestrasDescarga = analisisVapList.filter(
        a => a.BATCH_ID === bId || a.BATCH_ID === corr
      );
      const tieneDescarga = muestrasDescarga.length > 0;

      // Buscar resultado de cocción
      const coccion = buscarCoccionParaBatch(bId, corr, loteIds, locales);
      
      // Se considera completado si existe y tiene al menos tiempo de cocción y dosificación registrada
      const tieneCoccionCompleta = Boolean(
        coccion && 
        coccion.tiempoCoccionMin && 
        (coccion.tazasArroz || coccion.tazasAgua)
      );

      return {
        batch,
        coccion,
        tieneCoccionCompleta,
        tieneDescarga,
        muestrasDescargaCount: muestrasDescarga.length,
        ultimaMuestraDescarga: muestrasDescarga[0] || null,
        lotesDetalle,
        variedadPredominante,
        clientePrincipal,
        totalSacos
      };
    });
  }, [batches, batchLotes, lotes, analisisVapList, coccionRefreshKey]);

  // Contadores
  const pendientesCount = useMemo(() => {
    return batchesConCoccion.filter(b => !b.tieneCoccionCompleta).length;
  }, [batchesConCoccion]);

  const completadosCount = useMemo(() => {
    return batchesConCoccion.filter(b => b.tieneCoccionCompleta).length;
  }, [batchesConCoccion]);

  // Lista de variedades
  const listaVariedades = useMemo(() => {
    const s = new Set<string>();
    batchesConCoccion.forEach(b => {
      if (b.variedadPredominante) s.add(b.variedadPredominante);
    });
    return Array.from(s);
  }, [batchesConCoccion]);

  // Filtrado final
  const batchesFiltrados = useMemo(() => {
    return batchesConCoccion.filter(item => {
      if (activeFilter === "PENDIENTES" && item.tieneCoccionCompleta) return false;
      if (activeFilter === "COMPLETADOS" && !item.tieneCoccionCompleta) return false;

      if (variedadFilter !== "TODAS" && item.variedadPredominante !== variedadFilter) {
        return false;
      }

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const corr = (item.batch.CORRELATIVO || "").toLowerCase();
        const id = (item.batch.BATCH_ID || "").toLowerCase();
        const cliente = item.clientePrincipal.toLowerCase();
        const varName = item.variedadPredominante.toLowerCase();
        const tieneLote = item.lotesDetalle.some(l => l.loteId.toLowerCase().includes(q));
        if (!corr.includes(q) && !id.includes(q) && !cliente.includes(q) && !varName.includes(q) && !tieneLote) {
          return false;
        }
      }

      return true;
    });
  }, [batchesConCoccion, activeFilter, variedadFilter, searchQuery]);

  // Acceso directo a "2. Evaluación de Cocción en Olla ★"
  const handleAccesoDirectoCoccion = (batchId: string) => {
    onNavigate("analisis-vaporizado", batchId, "coccion_batch");
  };

  // Abrir modal de carga rápida
  const handleOpenCargaRapida = (item: any) => {
    setBatchParaCoccionRapida(item.batch);
    if (item.coccion) {
      setFormDataCoccion({
        tiempoCoccionMin: item.coccion.tiempoCoccionMin || 30,
        tazasArroz: item.coccion.tazasArroz || 3,
        tazasAgua: item.coccion.tazasAgua || "3 1/2",
        sabor: item.coccion.sabor || "",
        desplazamientoSeg: item.coccion.desplazamientoSeg || "",
        granoQuebradoOllaPct: item.coccion.granoQuebradoOllaPct !== undefined && item.coccion.granoQuebradoOllaPct !== null ? item.coccion.granoQuebradoOllaPct : "",
        granoHinchadoPct: item.coccion.granoHinchadoPct !== undefined && item.coccion.granoHinchadoPct !== null ? item.coccion.granoHinchadoPct : "",
        granoAbiertoPct: item.coccion.granoAbiertoPct !== undefined && item.coccion.granoAbiertoPct !== null ? item.coccion.granoAbiertoPct : "",
        texturaFrio: item.coccion.texturaFrio || "",
        envaseProyectado: item.coccion.envaseProyectado || "",
        puntajeCoccion: item.coccion.puntajeCoccion !== undefined && item.coccion.puntajeCoccion !== null ? item.coccion.puntajeCoccion : "",
        observaciones: item.coccion.observaciones || ""
      });
    } else {
      setFormDataCoccion({
        tiempoCoccionMin: 30,
        tazasArroz: 3,
        tazasAgua: "3 1/2",
        sabor: "",
        desplazamientoSeg: "",
        granoQuebradoOllaPct: "",
        granoHinchadoPct: "",
        granoAbiertoPct: "",
        texturaFrio: "",
        envaseProyectado: "",
        puntajeCoccion: "",
        observaciones: ""
      });
    }
  };

  // Guardar cocción rápida
  const handleGuardarCoccionRapida = async () => {
    if (!batchParaCoccionRapida) return;
    setIsSavingCoccion(true);
    try {
      await guardarCoccionParaBatch({
        batchId: batchParaCoccionRapida.BATCH_ID,
        correlativo: batchParaCoccionRapida.CORRELATIVO,
        variedad: batchParaCoccionRapida.VARIEDAD,
        cliente: batchParaCoccionRapida.CLIENTE,
        tiempoCoccionMin: Number(formDataCoccion.tiempoCoccionMin) || 30,
        tazasArroz: Number(formDataCoccion.tazasArroz) || 3,
        tazasAgua: formDataCoccion.tazasAgua,
        sabor: formDataCoccion.sabor,
        desplazamientoSeg: formDataCoccion.desplazamientoSeg,
        granoQuebradoOllaPct: Number(formDataCoccion.granoQuebradoOllaPct) || 0,
        granoHinchadoPct: Number(formDataCoccion.granoHinchadoPct) || 0,
        granoAbiertoPct: Number(formDataCoccion.granoAbiertoPct) || 0,
        texturaFrio: formDataCoccion.texturaFrio,
        envaseProyectado: formDataCoccion.envaseProyectado,
        puntajeCoccion: Number(formDataCoccion.puntajeCoccion) || 95,
        observaciones: formDataCoccion.observaciones,
        fechaCoccion: new Date().toISOString().split("T")[0]
      });

      // Refrescar estado local para que el batch desaparezca de pendientes
      setCoccionRefreshKey(prev => prev + 1);
      setBatchParaCoccionRapida(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error al guardar cocción rápida:", err);
    } finally {
      setIsSavingCoccion(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Switcher Superior de Modo */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-750 p-1.5 rounded-2xl w-fit shadow-md">
        <button
          type="button"
          onClick={() => setModoVista("defectos_coccion")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            modoVista === "defectos_coccion"
              ? "bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300"
              : "text-slate-300 hover:text-white"
          }`}
        >
          <Award className="w-4 h-4 text-emerald-400" />
          <span>Matriz de Incrementos de Defectos & Cocción</span>
        </button>

        <button
          type="button"
          onClick={() => setModoVista("bandeja")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            modoVista === "bandeja"
              ? "bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300"
              : "text-slate-300 hover:text-white"
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Bandeja de Pruebas de Cocción ({pendientesCount} pend.)</span>
        </button>
      </div>

      {modoVista === "defectos_coccion" ? (
        <ResultadosDefectosCoccionView
          batches={batches}
          batchLotes={batchLotes}
          lotes={lotes}
          analisisVapList={analisisVapList}
          programaciones={programaciones}
          presecados={presecados}
          analisisHumList={analisisHumList}
          analisisSecList={analisisSecList}
          currentUser={currentUser}
          onNavigateToVaporizado={(batchId) => onNavigate("batches", batchId)}
          onSelectLoteForFicha={(loteId) => onNavigate("lotes", loteId)}
          onRefreshData={onRefreshData}
        />
      ) : (
        <>
          {/* Banner de Cabecera con Contexto Operativo */}
          <div className="bg-slate-850 rounded-2xl border border-amber-500/30 p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                <Flame className="w-3 h-3" />
                Evaluación Culinaria en Olla & Sensorial
              </span>
              <span className="text-xs text-slate-400">• Determinación de Envase Proyectado</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Resultados de Cocción</span>
              {pendientesCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500 text-slate-950">
                  {pendientesCount} {pendientesCount === 1 ? "Batch Pendiente" : "Batches Pendientes"}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Bandeja operativa de batches que <strong className="text-amber-300">tienen pendiente la evaluación de cocción en olla</strong> (dosificación de agua/arroz, tiempo de cocción, soltura y grano cocido). Una vez completados y guardados los resultados, el batch <strong className="text-emerald-300">desaparece automáticamente</strong> de esta lista.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefreshData && (
              <button
                onClick={onRefreshData}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Actualizar datos"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refrescar</span>
              </button>
            )}
          </div>
        </div>

        {/* Métricas Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-750/80">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400">Total Batches</div>
            <div className="text-lg font-black text-white mt-0.5">{batches.length}</div>
          </div>
          <div className="bg-amber-950/20 p-3 rounded-xl border border-amber-800/40">
            <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Pendientes de Cocción</span>
            </div>
            <div className="text-lg font-black text-amber-300 mt-0.5">{pendientesCount}</div>
          </div>
          <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-800/40">
            <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Cocciones Evaluadas</span>
            </div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">{completadosCount}</div>
          </div>
          <div className="bg-cyan-950/20 p-3 rounded-xl border border-cyan-800/40">
            <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
              <Award className="w-3 h-3" />
              <span>Con Análisis Descarga</span>
            </div>
            <div className="text-lg font-black text-cyan-300 mt-0.5">
              {batchesConCoccion.filter(b => b.tieneDescarga).length}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros de Pestaña y Buscador */}
      <div className="bg-slate-850 rounded-xl border border-slate-750 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Pestañas de Estado */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setActiveFilter("PENDIENTES")}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeFilter === "PENDIENTES"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes Cocción ({pendientesCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("COMPLETADOS")}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeFilter === "COMPLETADOS"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cocción Evaluada ({completadosCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("TODOS")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilter === "TODOS"
                ? "bg-amber-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Todos ({batchesConCoccion.length})
          </button>
        </div>

        {/* Buscador y Selector de Variedad */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar batch, lote, variedad..."
              className="w-full bg-slate-900 border border-slate-700 pl-8 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={variedadFilter}
            onChange={(e) => setVariedadFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="TODAS">Variedad: Todas</option>
            {listaVariedades.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTA DE BATCHES */}
      {batchesFiltrados.length === 0 ? (
        <div className="bg-slate-850 rounded-2xl border border-slate-750 p-12 text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-black text-white">
            {activeFilter === "PENDIENTES" 
              ? "¡Al día! No hay batches pendientes de evaluación de cocción" 
              : "No se encontraron batches con los filtros seleccionados"}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
            {activeFilter === "PENDIENTES"
              ? "Todos los batches vaporizados cuentan con sus variables de cocción en olla registradas y envase proyectado."
              : "Intente limpiar los filtros de búsqueda o cambiar la variedad seleccionada."}
          </p>
          {activeFilter === "PENDIENTES" && completadosCount > 0 && (
            <button
              onClick={() => setActiveFilter("COMPLETADOS")}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              Ver {completadosCount} Batches Evaluados
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {batchesFiltrados.map((item) => {
            const b = item.batch;
            const corr = b.CORRELATIVO || b.BATCH_ID;
            const esPendiente = !item.tieneCoccionCompleta;
            const cocc = item.coccion;

            return (
              <div
                key={b.BATCH_ID}
                className={`bg-slate-850 rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden ${
                  esPendiente
                    ? "border-amber-500/50 hover:border-amber-400 ring-1 ring-amber-500/20"
                    : "border-slate-750 hover:border-slate-650"
                }`}
              >
                {/* Cabecera del Card */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white tracking-tight">
                          Batch {corr}
                        </span>
                        {esPendiente ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Falta Cocción
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Cocción {cocc?.puntajeCoccion || 95} pts
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        ID: {b.BATCH_ID}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {b.FECHA_PROGRAMADA || b.FECHA_REGISTRO || "Fecha n/d"}
                    </span>
                  </div>

                  {/* Datos del Batch */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 mb-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Variedad</span>
                      <span className="font-black text-amber-400 truncate block">
                        {item.variedadPredominante}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Cliente Principal</span>
                      <span className="font-bold text-slate-200 truncate block">
                        {item.clientePrincipal}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Estado Análisis Descarga:</span>
                      {item.tieneDescarga ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Muestra Registrada
                        </span>
                      ) : (
                        <span className="text-amber-400/80 font-bold">
                          Pendiente Muestra Física
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lotes que componen este batch */}
                  <div className="mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Lotes del Batch ({item.lotesDetalle.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.lotesDetalle.length > 0 ? (
                        item.lotesDetalle.map(l => (
                          <span
                            key={l.loteId}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {l.loteId} ({l.sacos} s.)
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Sin lotes asignados</span>
                      )}
                    </div>
                  </div>

                  {/* Si ya tiene cocción completa, mostrar resumen de variables */}
                  {!esPendiente && cocc && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 p-2.5 rounded-xl text-xs space-y-1.5 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">
                          Variables de Cocción Registradas
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-500 text-slate-950">
                          {cocc.puntajeCoccion || 95} / 100
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-300 pt-1">
                        <div>
                          <span className="text-slate-500 block">Tiempo Olla</span>
                          <span className="font-bold text-white">{cocc.tiempoCoccionMin} min</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Dosificación</span>
                          <span className="font-bold text-white">{cocc.tazasArroz} / {cocc.tazasAgua}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Soltura</span>
                          <span className="font-bold text-white">{cocc.desplazamientoSeg || "15s"}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-300 pt-1 border-t border-emerald-800/40 truncate">
                        <span className="text-slate-500">Envase: </span>
                        <span className="font-bold text-emerald-300">{cocc.envaseProyectado || "Don Julio Extra"}</span>
                      </div>
                    </div>
                  )}

                  {/* Si está pendiente, aviso de variables faltantes */}
                  {esPendiente && (
                    <div className="bg-amber-950/20 border border-amber-800/40 p-2.5 rounded-xl text-xs space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                        Falta registrar en olla:
                      </span>
                      <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                        <li>Dosificación (Tazas arroz / agua)</li>
                        <li>Tiempo de cocción en minutos</li>
                        <li>Evaluación de grano cocido & soltura</li>
                        <li>Destino de Envase Proyectado</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* BOTONES DE ACCIÓN: ACCESO DIRECTO A EVALUACIÓN DE COCCIÓN EN OLLA */}
                <div className="pt-3 border-t border-slate-750 flex flex-col sm:flex-row items-center gap-2 mt-auto">
                  <button
                    onClick={() => handleAccesoDirectoCoccion(b.BATCH_ID)}
                    className={`flex-1 w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                      esPendiente
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 ring-1 ring-amber-300 font-black"
                        : "bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-800/50"
                    }`}
                    title="Acceso directo a la pestaña 2: Evaluación de Cocción en Olla ★"
                  >
                    <Flame className="w-4 h-4 shrink-0" />
                    <span>
                      {esPendiente ? "Evaluar Cocción en Olla" : "Ver / Editar Cocción"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </button>

                  <button
                    onClick={() => handleOpenCargaRapida(item)}
                    className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    title="Cargar rápidamente parámetros de cocción sin salir"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Rápido</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Carga Rápida de Cocción */}
      {batchParaCoccionRapida && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>Registro Rápido de Cocción en Olla</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Batch: <strong className="text-white">{batchParaCoccionRapida.CORRELATIVO || batchParaCoccionRapida.BATCH_ID}</strong> ({batchParaCoccionRapida.VARIEDAD || "Tinajones"})
                </p>
              </div>
              <button
                onClick={() => setBatchParaCoccionRapida(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario de variables de cocción */}
            <div className="space-y-3 text-xs">
              {/* 1. Dosificación y Tiempos */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  1. Dosificación y Tiempo en Olla
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tazas Arroz</label>
                    <input
                      type="number"
                      value={formDataCoccion.tazasArroz}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, tazasArroz: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tazas Agua</label>
                    <input
                      type="text"
                      value={formDataCoccion.tazasAgua}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, tazasAgua: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono"
                      placeholder="3 1/2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tiempo (min)</label>
                    <input
                      type="number"
                      value={formDataCoccion.tiempoCoccionMin}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, tiempoCoccionMin: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono font-bold text-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Grano Cocido y Soltura */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                  2. Evaluación de Grano Cocido & Textura
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Soltura (Desplazamiento)</label>
                    <input
                      type="text"
                      value={formDataCoccion.desplazamientoSeg}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, desplazamientoSeg: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white"
                      placeholder="Ej: 15 seg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Textura al Frío</label>
                    <select
                      value={formDataCoccion.texturaFrio}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, texturaFrio: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white"
                    >
                      <option value="">-- Seleccionar Textura --</option>
                      <option value="Suave">Suave al frío</option>
                      <option value="Firme">Firme al dente</option>
                      <option value="Semiduro">Semiduro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">% Quebrado Olla</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formDataCoccion.granoQuebradoOllaPct ?? ""}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, granoQuebradoOllaPct: e.target.value })}
                      placeholder="0.0"
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Sabor en Boca</label>
                    <input
                      type="text"
                      value={formDataCoccion.sabor}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, sabor: e.target.value })}
                      placeholder="Ej: Neutro Característico"
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Envase Proyectado y Score */}
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                  3. Destino de Envase Proyectado
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-1">Envase Proyectado</label>
                    <select
                      value={formDataCoccion.envaseProyectado}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, envaseProyectado: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-bold"
                    >
                      <option value="">-- Seleccionar Envase Proyectado --</option>
                      <option value="Saco 50 kg Don Julio Extra Selección">Saco 50 kg Don Julio Extra Selección (≥95 pts)</option>
                      <option value="Saco 50 kg Don Julio Superior">Saco 50 kg Don Julio Superior (90-94 pts)</option>
                      <option value="Saco 50 kg Corriente / Granel">Saco 50 kg Corriente / Granel (&lt;90 pts)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Puntaje Cocción</label>
                    <input
                      type="number"
                      value={formDataCoccion.puntajeCoccion ?? ""}
                      onChange={(e) => setFormDataCoccion({ ...formDataCoccion, puntajeCoccion: e.target.value })}
                      placeholder="Ej: 95"
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-white font-black text-amber-400 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBatchParaCoccionRapida(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarCoccionRapida}
                disabled={isSavingCoccion}
                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingCoccion ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar y Marcar Completado</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
