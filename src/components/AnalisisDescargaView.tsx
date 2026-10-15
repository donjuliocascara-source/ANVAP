import React, { useState, useMemo, useEffect } from "react";
import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  AnalisisVaporizado, 
  ControlVaporizado,
  AnalisisHumedo,
  Presecado,
  AnalisisSeco,
  UserProfile 
} from "../types";
import { compareLoteCodes } from "../utils/formatLoteCode";
import { cargarProgramacionesOficiales } from "../utils/programacionBatchOficialService";
import { 
  Microscope, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  ArrowRight, 
  Package, 
  Layers, 
  Filter, 
  Building2, 
  Sparkles,
  Droplets,
  Scale,
  RefreshCw,
  Eye,
  PlusCircle,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import { BoletaMolinoDonJulioModal } from "./BoletaMolinoDonJulioModal";
import { SacasDescargaModal } from "./SacasDescargaManager";
import {
  resolverDatosIngresoBatchParaDescarga,
  obtenerRegistroSacasDescargaBatch
} from "../utils/sacasDescargaService";

interface AnalisisDescargaViewProps {
  batches: BatchVaporizado[];
  batchLotes: BatchLote[];
  lotes: Lote[];
  analisisVapList: AnalisisVaporizado[];
  controles?: ControlVaporizado[];
  programaciones?: any[];
  analisisHumList?: AnalisisHumedo[];
  presecados?: Presecado[];
  analisisSecList?: AnalisisSeco[];
  currentUser?: UserProfile;
  onNavigate: (tab: string, filterId?: string, extraSubTab?: string) => void;
  onSaveAnalisisVap?: (rec: Partial<AnalisisVaporizado>) => Promise<void>;
  onOpenOCR?: () => void;
  onRefreshData?: () => void;
}

export const AnalisisDescargaView: React.FC<AnalisisDescargaViewProps> = ({
  batches = [],
  batchLotes = [],
  lotes = [],
  analisisVapList = [],
  controles = [],
  programaciones = [],
  analisisHumList = [],
  presecados = [],
  analisisSecList = [],
  currentUser,
  onNavigate,
  onSaveAnalisisVap,
  onOpenOCR,
  onRefreshData
}) => {
  const [activeFilter, setActiveFilter] = useState<"PENDIENTES" | "COMPLETADOS" | "TODOS">("PENDIENTES");
  const [searchQuery, setSearchQuery] = useState("");
  const [variedadFilter, setVariedadFilter] = useState("TODAS");
  
  // Modal de Boleta Don Julio rápida
  const [selectedBatchForBoleta, setSelectedBatchForBoleta] = useState<BatchVaporizado | null>(null);
  const [isBoletaModalOpen, setIsBoletaModalOpen] = useState(false);

  // Modal de Registro de Sacas de Descarga (Big Bags)
  const [selectedBatchForSacas, setSelectedBatchForSacas] = useState<BatchVaporizado | null>(null);
  const [isSacasModalOpen, setIsSacasModalOpen] = useState(false);
  const [sacasRefreshTick, setSacasRefreshTick] = useState(0);

  useEffect(() => {
    const handleSacasUpdate = () => setSacasRefreshTick((t) => t + 1);
    window.addEventListener("sacas-descarga-updated", handleSacasUpdate);
    return () => window.removeEventListener("sacas-descarga-updated", handleSacasUpdate);
  }, []);

  // Mapear cada batch con su estado de análisis de descarga y sacas de descarga
  const batchesConEstado = useMemo(() => {
    const progsOficiales = Array.isArray(programaciones) && programaciones.length > 0
      ? programaciones
      : cargarProgramacionesOficiales();

    const isGenericVar = (v?: string) => {
      if (!v) return true;
      const u = v.toString().trim().toUpperCase();
      return !u || u === "TINAJONES" || u === "IR-43 MEJORADO" || u === "ARROZ GENERAL" || u === "SIN VARIEDAD" || u === "VARIEDAD GENERAL" || u === "GENERAL";
    };

    const isBatchV350 = (code?: string) => {
      if (!code) return false;
      const u = code.toString().trim().toUpperCase();
      return u === "V350" || u === "BAT-V350" || u === "BATCH-V350" || u.startsWith("V350-");
    };

    return batches.map(batch => {
      const bId = (batch.BATCH_ID || "").toString().trim();
      const corr = (batch.CORRELATIVO || batch.BATCH_ID || "").toString().trim();
      const bIdUpper = bId.toUpperCase();
      const corrUpper = corr.toUpperCase();
      const esV350 = isBatchV350(bIdUpper) || isBatchV350(corrUpper);

      // Buscar muestras de calidad física de salida registradas
      const muestras = analisisVapList.filter(a => {
        const aB = (a.BATCH_ID || "").toString().trim().toUpperCase();
        return aB === bIdUpper || (corrUpper && aB === corrUpper);
      });

      // Buscar programación oficial y control de vaporizado asociados al batch
      const progMatch = (progsOficiales || []).find((p: any) => {
        const pB = (p?.batch || p?.id || "").toString().trim().toUpperCase();
        return pB === bIdUpper || (corrUpper && pB === corrUpper);
      });

      const ctrlMatch = (controles || []).find(c => {
        const cB = (c.BATCH_ID || "").toString().trim().toUpperCase();
        const cC = (c.CORRELATIVO || "").toString().trim().toUpperCase();
        const cCod = (c.datosIngreso?.codigo || "").toString().trim().toUpperCase();
        return cB === bIdUpper || (corrUpper && (cB === corrUpper || cC === corrUpper || cCod === corrUpper));
      });

      // Lotes que integran este batch (desde batchLotes, programación oficial o lotesAsignados)
      let bls = batchLotes.filter(bl => {
        const blB = (bl.BATCH_ID || "").toString().trim().toUpperCase();
        return blB === bIdUpper || (corrUpper && blB === corrUpper);
      });

      if (bls.length === 0 && progMatch && Array.isArray(progMatch.filasLote) && progMatch.filasLote.length > 0) {
        bls = progMatch.filasLote.map((f: any, idx: number) => ({
          BATCH_LOTE_ID: `BL-${bId}-${f.loteId || f.LOTE_ID || idx}`,
          BATCH_ID: bId,
          LOTE_ID: f.loteId || f.LOTE_ID || "",
          SACOS: Number(f.sacProg ?? f.sacos ?? 0),
          PESO_KG: Number(f.pesoProg ?? f.peso ?? 0),
          CLIENTE: f.cliente || progMatch.clientePrincipal,
          VARIEDAD: f.variedad || progMatch.variedadPrincipal
        }));
      } else if (bls.length === 0 && Array.isArray((batch as any).lotesAsignados) && (batch as any).lotesAsignados.length > 0) {
        bls = (batch as any).lotesAsignados.map((l: any, idx: number) => ({
          BATCH_LOTE_ID: `BL-${bId}-${idx}`,
          BATCH_ID: bId,
          LOTE_ID: typeof l === "string" ? l : (l.LOTE_ID || l.loteId || ""),
          SACOS: typeof l === "object" ? Number(l.SACOS ?? l.sacos ?? 0) : 0,
          PESO_KG: typeof l === "object" ? Number(l.PESO_KG ?? l.pesoKg ?? 0) : 0,
          CLIENTE: typeof l === "object" ? (l.CLIENTE || l.cliente) : batch.CLIENTE,
          VARIEDAD: typeof l === "object" ? (l.VARIEDAD || l.variedad) : batch.VARIEDAD
        }));
      }

      const lotesDetalle = bls.map(bl => {
        const lot = lotes.find(l => l.LOTE_ID === bl.LOTE_ID || compareLoteCodes(l.LOTE_ID, bl.LOTE_ID));
        const ah = analisisHumList.find(a => a.LOTE_ID === bl.LOTE_ID || compareLoteCodes(a.LOTE_ID, bl.LOTE_ID));
        const ps = presecados.find(p => p.LOTE_ID === bl.LOTE_ID || compareLoteCodes(p.LOTE_ID, bl.LOTE_ID));
        const progFila = Array.isArray(progMatch?.filasLote)
          ? progMatch.filasLote.find((f: any) => compareLoteCodes(f.loteId || f.LOTE_ID, bl.LOTE_ID))
          : undefined;

        const varCandidates = [
          lot?.VARIEDAD,
          (ah as any)?.VARIEDAD,
          (ps as any)?.VARIEDAD,
          bl.VARIEDAD,
          progFila?.variedad,
          batch.VARIEDAD,
          progMatch?.variedadPrincipal,
          ctrlMatch?.datosIngreso?.variedad,
          ctrlMatch?.VARIEDAD
        ].filter(Boolean) as string[];

        let resolvedLoteVar = varCandidates.find(v => !isGenericVar(v)) || varCandidates[0] || (esV350 ? "FERON" : "TINAJONES");
        if (esV350 && isGenericVar(resolvedLoteVar)) {
          resolvedLoteVar = "FERON";
        }

        const resolvedLoteCli =
          (lot?.CLIENTE && lot.CLIENTE !== "Sin Cliente" ? lot.CLIENTE : "") ||
          (bl.CLIENTE && bl.CLIENTE !== "Sin Cliente" ? bl.CLIENTE : "") ||
          progFila?.cliente ||
          batch.CLIENTE ||
          progMatch?.clientePrincipal ||
          ctrlMatch?.CLIENTE ||
          "MOLINO DON JULIO";

        return {
          loteId: lot?.LOTE_ID || bl.LOTE_ID,
          sacos: Number(bl.SACOS || progFila?.sacProg || progFila?.sacos || lot?.SACOS || 0),
          pesoKg: Number(bl.PESO_KG || progFila?.pesoProg || progFila?.peso || lot?.PESO_KG || 0),
          cliente: resolvedLoteCli,
          variedad: resolvedLoteVar.toString().trim().toUpperCase(),
          humedadIngreso: Number(lot?.HUM ?? ah?.HUMEDADES ?? progFila?.ph ?? 13.5)
        };
      });

      const batchVarCandidates = [
        ...lotesDetalle.map(l => l.variedad),
        batch.VARIEDAD,
        progMatch?.variedadPrincipal,
        ctrlMatch?.datosIngreso?.variedad,
        ctrlMatch?.VARIEDAD,
        muestras[0]?.VARIEDAD
      ].filter(Boolean) as string[];

      let variedadPredominante = batchVarCandidates.find(v => !isGenericVar(v)) || batchVarCandidates[0] || (esV350 ? "FERON" : "TINAJONES");
      if (esV350 && isGenericVar(variedadPredominante)) {
        variedadPredominante = "FERON";
      }
      variedadPredominante = variedadPredominante.toString().trim().toUpperCase();

      const clientePrincipal =
        lotesDetalle.find(l => l.cliente && l.cliente !== "MOLINO" && l.cliente !== "Sin Cliente")?.cliente ||
        (batch.CLIENTE && batch.CLIENTE !== "Sin Cliente" ? batch.CLIENTE : "") ||
        progMatch?.clientePrincipal ||
        ctrlMatch?.CLIENTE ||
        lotesDetalle[0]?.cliente ||
        "MOLINO DON JULIO";

      const sumSacosLotes = lotesDetalle.reduce((acc, l) => acc + (l.sacos || 0), 0);
      const totalSacos = sumSacosLotes > 0
        ? sumSacosLotes
        : Number(batch.TOTAL_SACOS || progMatch?.totalSacosProg || parseInt(String(ctrlMatch?.datosIngreso?.numSacos || "0"), 10) || 0);

      const sumKgLotes = lotesDetalle.reduce((acc, l) => acc + (l.pesoKg || 0), 0);
      const totalKg = sumKgLotes > 0
        ? sumKgLotes
        : Number(batch.TOTAL_PESO_KG || batch.PESO_TOTAL_KG || progMatch?.pesoTotalKg || ctrlMatch?.datosIngreso?.pesoKg || (batch.TON_PROGRAMADAS ? batch.TON_PROGRAMADAS * 1000 : 0));

      const tieneAnalisisDescarga = muestras.length > 0;

      const datosBaseDescarga = resolverDatosIngresoBatchParaDescarga({
        batchId: bId,
        correlativo: corr,
        batch,
        batchLotes,
        lotes,
        analisisHumList,
        presecados,
        controles,
        programaciones: progsOficiales
      });

      const registroSacas = obtenerRegistroSacasDescargaBatch(
        bId,
        corr,
        datosBaseDescarga,
        batch,
        ctrlMatch
      );

      return {
        batch: {
          ...batch,
          VARIEDAD: variedadPredominante,
          CLIENTE: clientePrincipal,
          TOTAL_SACOS: totalSacos || batch.TOTAL_SACOS,
          TOTAL_PESO_KG: totalKg || batch.TOTAL_PESO_KG
        },
        muestras,
        totalMuestras: muestras.length,
        lotesDetalle,
        variedadPredominante,
        clientePrincipal,
        totalSacos,
        totalKg,
        tieneAnalisisDescarga,
        ultimaMuestra: muestras[0] || null,
        datosBaseDescarga,
        registroSacas
      };
    });
  }, [batches, batchLotes, lotes, analisisVapList, controles, programaciones, analisisHumList, presecados, analisisSecList, sacasRefreshTick]);

  // Contadores clave
  const pendientesCount = useMemo(() => {
    return batchesConEstado.filter(b => !b.tieneAnalisisDescarga).length;
  }, [batchesConEstado]);

  const completadosCount = useMemo(() => {
    return batchesConEstado.filter(b => b.tieneAnalisisDescarga).length;
  }, [batchesConEstado]);

  // Obtener variedades únicas para el filtro
  const listaVariedades = useMemo(() => {
    const s = new Set<string>();
    batchesConEstado.forEach(b => {
      if (b.variedadPredominante) s.add(b.variedadPredominante);
    });
    return Array.from(s);
  }, [batchesConEstado]);

  // Filtrado final
  const batchesFiltrados = useMemo(() => {
    return batchesConEstado.filter(item => {
      // Filtro de estado
      if (activeFilter === "PENDIENTES" && item.tieneAnalisisDescarga) return false;
      if (activeFilter === "COMPLETADOS" && !item.tieneAnalisisDescarga) return false;

      // Filtro de variedad
      if (variedadFilter !== "TODAS" && item.variedadPredominante !== variedadFilter) {
        return false;
      }

      // Búsqueda libre
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
  }, [batchesConEstado, activeFilter, variedadFilter, searchQuery]);

  // Navegación directa a "1. Muestras de Calidad Física"
  const handleAccesoDirectoMuestras = (batchId: string) => {
    onNavigate("analisis-vaporizado", batchId, "calidad_salida");
  };

  const handleOpenBoletaRapida = (batch: BatchVaporizado) => {
    setSelectedBatchForBoleta(batch);
    setIsBoletaModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner de Cabecera con Contexto Operativo */}
      <div className="bg-slate-850 rounded-2xl border border-purple-500/30 p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                <Microscope className="w-3 h-3" />
                Muestras de Laboratorio de Descarga
              </span>
              <span className="text-xs text-slate-400">• Salida de Vaporizado</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Análisis de Descarga</span>
              {pendientesCount > 0 && (
                <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500 text-slate-950">
                  {pendientesCount} {pendientesCount === 1 ? "Batch Pendiente" : "Batches Pendientes"}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Bandeja operativa de batches en proceso que <strong className="text-amber-300">aún no tienen registradas sus muestras de calidad física de salida</strong> (humedad, quebrado, trizado, blancura). Al completar y guardar los datos en la boleta oficial, el batch <strong className="text-purple-300">desaparece automáticamente</strong> de esta lista.
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

            {onOpenOCR && (
              <button
                onClick={onOpenOCR}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all cursor-pointer"
                title="Escanear boleta física con OCR"
              >
                <Sparkles className="w-4 h-4" />
                <span>OCR Boleta Don Julio</span>
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
              <span>Pendientes Descarga</span>
            </div>
            <div className="text-lg font-black text-amber-300 mt-0.5">{pendientesCount}</div>
          </div>
          <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-800/40">
            <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Análisis Completados</span>
            </div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">{completadosCount}</div>
          </div>
          <div className="bg-purple-950/20 p-3 rounded-xl border border-purple-800/40">
            <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              <span>Muestras Físicas Registradas</span>
            </div>
            <div className="text-lg font-black text-purple-300 mt-0.5">{analisisVapList.length}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
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
            <span>Pendientes ({pendientesCount})</span>
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
            <span>Completados ({completadosCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("TODOS")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilter === "TODOS"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Todos ({batchesConEstado.length})
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
              className="w-full bg-slate-900 border border-slate-700 pl-8 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={variedadFilter}
            onChange={(e) => setVariedadFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
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
              ? "¡Excelente! No hay batches pendientes de análisis de descarga" 
              : "No se encontraron batches con los filtros seleccionados"}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
            {activeFilter === "PENDIENTES"
              ? "Todos los batches cuentan con sus muestras físicas de calidad registradas. Si se programa un nuevo batch o se procesa otro en autoclave, figurará aquí hasta cargar su análisis."
              : "Pruebe limpiando el texto de búsqueda o cambiando el selector de variedad."}
          </p>
          {activeFilter === "PENDIENTES" && completadosCount > 0 && (
            <button
              onClick={() => setActiveFilter("COMPLETADOS")}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              Ver {completadosCount} Batches Completados
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {batchesFiltrados.map((item) => {
            const b = item.batch;
            const corr = b.CORRELATIVO || b.BATCH_ID;
            const esPendiente = !item.tieneAnalisisDescarga;

            return (
              <div
                key={b.BATCH_ID}
                className={`bg-slate-850 rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden ${
                  esPendiente
                    ? "border-amber-500/40 hover:border-amber-400/80 ring-1 ring-amber-500/20"
                    : "border-slate-750 hover:border-slate-650"
                }`}
              >
                {/* Indicador superior de estado */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white tracking-tight">
                        Batch {corr}
                      </span>
                      {esPendiente ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          Pendiente Análisis
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {item.totalMuestras} {item.totalMuestras === 1 ? "Muestra" : "Muestras"}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      ID: {b.BATCH_ID}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {b.FECHA_PROGRAMADA || b.FECHA_REGISTRO || "Fecha n/d"}
                    </span>
                  </div>
                </div>

                {/* Detalles de Producción y Lotes */}
                <div className="space-y-2.5 my-2">
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Variedad</span>
                      <span className="font-black text-amber-400 truncate block">
                        {item.variedadPredominante}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Volumen</span>
                      <span className="font-bold text-slate-200 block">
                        {item.totalSacos} sacos ({((item.totalKg || 0) / 1000).toFixed(1)} Tn)
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Cliente Principal:</span>
                      <span className="text-[11px] font-bold text-slate-300 truncate max-w-[180px]">
                        {item.clientePrincipal}
                      </span>
                    </div>
                  </div>

                  {/* Lotes que componen este batch */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Lotes Asociados ({item.lotesDetalle.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.lotesDetalle.length > 0 ? (
                        item.lotesDetalle.map(l => (
                          <span
                            key={l.loteId}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                            title={`${l.cliente} - ${l.variedad} (${l.sacos} sacos)`}
                          >
                            {l.loteId} ({l.sacos} s.)
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Sin lotes asignados</span>
                      )}
                    </div>
                  </div>

                  {/* RESUMEN DE SACAS DE DESCARGA (BIG BAGS) & PESO PROYECTADO (± 500 KG) */}
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-2 ${
                      item.registroSacas.estadoComparacion === "CONFORME"
                        ? "bg-emerald-950/25 border-emerald-500/40"
                        : item.registroSacas.estadoComparacion === "FALTANTE" ||
                          item.registroSacas.estadoComparacion === "EXCESO"
                        ? "bg-rose-950/25 border-rose-500/40"
                        : "bg-slate-900/80 border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-amber-300 uppercase flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sacas de Descarga (Big Bag)</span>
                      </span>
                      {item.registroSacas.estadoComparacion === "CONFORME" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Conforme (±500 kg)
                        </span>
                      )}
                      {(item.registroSacas.estadoComparacion === "FALTANTE" ||
                        item.registroSacas.estadoComparacion === "EXCESO") && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Fuera de ±500 kg
                        </span>
                      )}
                      {item.registroSacas.estadoComparacion === "SIN_REGISTRO" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Pendiente Pesaje
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10.5px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">Peso Proyectado</span>
                        <span className="font-black text-amber-300">
                          {item.registroSacas.pesoProyectadoKg.toLocaleString("en-US", {
                            maximumFractionDigits: 1
                          })}{" "}
                          kg
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">
                          Peso Real ({item.registroSacas.sacas.length} Big Bag)
                        </span>
                        <span className="font-black text-white">
                          {item.registroSacas.pesoRealDescargaKg > 0
                            ? `${item.registroSacas.pesoRealDescargaKg.toLocaleString("en-US", {
                                maximumFractionDigits: 1
                              })} kg`
                            : "0 kg"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">Dif. (±500 kg)</span>
                        <span
                          className={`font-black ${
                            item.registroSacas.estadoComparacion === "CONFORME"
                              ? "text-emerald-400"
                              : item.registroSacas.estadoComparacion === "SIN_REGISTRO"
                              ? "text-slate-500"
                              : "text-rose-400"
                          }`}
                        >
                          {item.registroSacas.pesoRealDescargaKg > 0
                            ? `${item.registroSacas.diferenciaKg >= 0 ? "+" : ""}${item.registroSacas.diferenciaKg.toFixed(
                                1
                              )} kg`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatchForSacas(b);
                        setIsSacasModalOpen(true);
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {item.registroSacas.sacas.length > 0
                          ? `Ver / Editar Sacas Big Bag (${item.registroSacas.sacas.length} sacas)`
                          : "Subir Pesos de Sacas Big Bag (Balanza)"}
                      </span>
                    </button>
                  </div>

                  {/* Datos de la Muestra si ya existe */}
                  {item.ultimaMuestra && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                        <span>Muestra N° {item.ultimaMuestra.MUESTRA_NRO || 1}</span>
                        <span>Boleta: {item.ultimaMuestra.NUM_BOLETA || "S/N"}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 pt-1 text-[10px] font-mono text-slate-300">
                        <div>
                          <span className="text-slate-500 block">HUM</span>
                          <span className="font-bold text-white">{item.ultimaMuestra.HUMEDAD || "-"}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">QUEB</span>
                          <span className="font-bold text-white">{item.ultimaMuestra.QUEBRADO || item.ultimaMuestra.QI || "-"}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">ENT</span>
                          <span className="font-bold text-white">{item.ultimaMuestra.ENTERO || "-"}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">BL</span>
                          <span className="font-bold text-white">{item.ultimaMuestra.BL || item.ultimaMuestra.BLI || "-"}°</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTONES DE ACCIÓN: ACCESO DIRECTO A MUESTRAS DE CALIDAD FÍSICA */}
                <div className="pt-3 border-t border-slate-750 flex flex-col sm:flex-row items-center gap-2 mt-2">
                  <button
                    onClick={() => handleAccesoDirectoMuestras(b.BATCH_ID)}
                    className={`flex-1 w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                      esPendiente
                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25 ring-1 ring-purple-400"
                        : "bg-slate-800 hover:bg-slate-750 text-purple-300 border border-purple-800/50"
                    }`}
                    title="Acceso directo a la pestaña 1: Muestras de Calidad Física"
                  >
                    <Microscope className="w-4 h-4 shrink-0" />
                    <span>
                      {esPendiente ? "Cargar Muestra de Calidad Física" : "Ver / Agregar Muestras"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </button>

                  <button
                    onClick={() => handleOpenBoletaRapida(b)}
                    className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    title="Abrir boleta de laboratorio oficial en modal rápido"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Boleta</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Boleta Molino Don Julio Rápida */}
      {selectedBatchForBoleta && (
        <BoletaMolinoDonJulioModal
          isOpen={isBoletaModalOpen}
          onClose={() => {
            setIsBoletaModalOpen(false);
            setSelectedBatchForBoleta(null);
            if (onRefreshData) onRefreshData();
          }}
          batch={selectedBatchForBoleta}
          analisis={analisisVapList.find(a => a.BATCH_ID === selectedBatchForBoleta.BATCH_ID || a.BATCH_ID === selectedBatchForBoleta.CORRELATIVO) || null}
          batchCode={selectedBatchForBoleta.CORRELATIVO || selectedBatchForBoleta.BATCH_ID}
          clienteNombre={selectedBatchForBoleta.CLIENTE || "MOLINO DON JULIO"}
          variedad={selectedBatchForBoleta.VARIEDAD || "TINAJONES"}
        />
      )}

      {/* Modal de Registro de Sacas de Descarga (Big Bags) */}
      {selectedBatchForSacas && (
        <SacasDescargaModal
          isOpen={isSacasModalOpen}
          onClose={() => {
            setIsSacasModalOpen(false);
            setSelectedBatchForSacas(null);
            setSacasRefreshTick((t) => t + 1);
            if (onRefreshData) onRefreshData();
          }}
          batchId={selectedBatchForSacas.BATCH_ID}
          correlativo={selectedBatchForSacas.CORRELATIVO || selectedBatchForSacas.BATCH_ID}
          cliente={selectedBatchForSacas.CLIENTE}
          variedad={selectedBatchForSacas.VARIEDAD}
          batch={selectedBatchForSacas}
          batchLotes={batchLotes}
          lotes={lotes}
          analisisHumList={analisisHumList}
          presecados={presecados}
          controles={controles}
          programaciones={programaciones}
          currentUserNombre={currentUser?.nombre || "Operador Balanza"}
          onChangeRegistro={() => {
            setSacasRefreshTick((t) => t + 1);
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
};
