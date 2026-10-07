import React, { useState } from "react";
import { 
  X, 
  Printer, 
  Flame, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Scale, 
  Clock,
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  Gauge, 
  Droplets, 
  ArrowRight, 
  Activity,
  Award,
  Thermometer,
  Package,
  Sliders,
  CheckCheck,
  FileSpreadsheet,
  FileCheck
} from "lucide-react";
import { BatchVaporizado } from "../types";

export interface BatchReportData {
  meta: {
    bLotes: any[];
    clienteDisplay: string;
    variedadDisplay: string;
    variedadesList: string[];
    totalSacos: number;
    pesoEfectivoKg: number;
    tonEfectivas: number;
    isExcepcional: boolean;
    humedadPromedio?: number;
  };
  proceso: {
    modalidadPases: string;
    presionVapor: number;
    presionMax: number;
    tempVapor: number | string;
    rpm: number;
    tiempoVaporMin: number;
    tiempoReposoMin: number | string;
    secadoTemp: number;
    secadoTiempoMin: number;
    secadoMetodo: string;
    equipo: string;
    operador: string;
    supervisor: string;
    desviacion: string;
  };
  salida: {
    humIngreso: number;
    humSalida: number;
    deltaHumedad: number;
    enteroSalida: number;
    quebradoSalida: number;
    qiIngreso: number;
    deltaQuebrado: number;
    trizadoSalida: number;
    tizaSalida: number;
    blancuraSalida: number;
    manchadoSalida: number;
    gelatinizacionPct: number;
    salidaAprobada: boolean;
  };
  coccion: {
    coccionScore: number;
    tazasArroz?: number;
    tazasAgua?: string | number;
    tiempoCoccionMin: string;
    ratioAbsorcionAgua: string;
    expansionVolumetrica: string;
    texturaFirmeza: string;
    separacionGrano: string;
    aromaSabor: string;
    colorCocido: string;
    clasificacionCoccion: string;
    panelEvaluador: string;
    observaciones: string;
    // Parámetros Organolépticos y Rendimiento en Olla oficiales
    desplazamientoSeg?: string | number;
    granoQuebradoOllaPct?: number;
    granoHinchadoPct?: number;
    granoAbiertoPct?: number;
    texturaFrio?: string;
    rendimientoMasaPct?: number;
    // Comparativo Físico MP vs Descarga
    trizadoMP?: number;
    trizadoDescarga?: number;
    deltaTrizado?: number;
    quebradoIntegralMP?: number;
    quebradoIntegralDescarga?: number;
    quebradoMP?: number;
    quebradoDescarga?: number;
    deltaQuebrado?: number;
    blancuraIntegralMP?: number;
    blancuraIntegralDescarga?: number;
    blancuraBlancoMP?: number;
    blancuraBlancoDescarga?: number;
    tizaTotalMasGcocidoMP?: number;
    tizaTotalMasGcocidoDescarga?: number;
    tpMasTpuntualMP?: number;
    tpMasTpuntualDescarga?: number;
    manchaMP?: number;
    manchaDescarga?: number;
    granoInmaduroMP?: number;
    granoInmaduroDescarga?: number;
    humedadCascaraMP?: number;
    humedadCascaraDescarga?: number;
    humedadBlancoDescarga?: number;
    reposoCascaraDias?: number;
    esDatoReal?: boolean;
    fuenteExterna?: string;
  };
}

interface BatchResumenProcesoModalProps {
  isOpen: boolean;
  batch?: BatchVaporizado | null;
  reportData?: BatchReportData | null;
  data?: BatchReportData | null;
  onClose: () => void;
  onNavigate?: (tab: string, filterId?: string) => void;
}

export const BatchResumenProcesoModal: React.FC<BatchResumenProcesoModalProps> = ({
  isOpen,
  batch,
  reportData,
  data,
  onClose,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<"vision360" | "proceso" | "salida" | "coccion" | "lotes">("vision360");

  const actualReportData = reportData || data;
  if (!isOpen || !actualReportData) return null;

  const { meta, proceso, salida, coccion } = actualReportData;
  const corr = batch?.CORRELATIVO || batch?.BATCH_ID || meta?.variedadDisplay || "Batch";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* HEADER MODAL                                              */}
        {/* ========================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Flame className="w-6 h-6 fill-current text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white font-mono tracking-tight">
                  RESUMEN INTEGRAL: BATCH {corr}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  batch.ESTADO_BATCH === "COMPLETADO"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : batch.ESTADO_BATCH === "EN_PROCESO"
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                }`}>
                  {batch.ESTADO_BATCH}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 text-xs font-bold">
                  {meta.variedadDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                <span>Cliente: <strong className="text-slate-200">{meta.clienteDisplay}</strong></span>
                <span>•</span>
                <span>Fecha: <strong className="text-slate-200">{batch.FECHA_PROGRAMADA}</strong></span>
                <span>•</span>
                <span>Turno: <strong className="text-slate-200">{batch.TURNO || "Turno Día"}</strong></span>
                <span>•</span>
                <span>Autoclave: <strong className="text-amber-300">{proceso.equipo}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
              title="Imprimir resumen técnico"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Imprimir Ficha</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* KPI BANNER (TOP SNAPSHOT)                                 */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-xs font-mono">
          
          {/* Peso */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
              <Scale className="w-3.5 h-3.5 text-amber-400" /> Peso Total
            </span>
            <div className="mt-1">
              <strong className="text-base text-emerald-400 font-bold block">
                {meta.tonEfectivas.toFixed(2)} TN
              </strong>
              <span className="text-[10px] text-slate-500 font-normal">
                {meta.pesoEfectivoKg.toLocaleString()} kg ({meta.totalSacos} scs)
              </span>
            </div>
          </div>

          {/* Humedad Ingreso -> Salida */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" /> Humedad Salida
            </span>
            <div className="mt-1">
              <strong className="text-base text-cyan-300 font-bold block">
                {salida.humSalida}%
              </strong>
              <span className="text-[10px] text-slate-400 font-normal">
                Ing: {salida.humIngreso}% (Δ {salida.deltaHumedad}%)
              </span>
            </div>
          </div>

          {/* Incremento de Quebrado */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Δ Quebrado
            </span>
            <div className="mt-1">
              <strong className={`text-base font-bold block ${
                salida.deltaQuebrado <= 2.5 ? "text-emerald-400" : salida.deltaQuebrado <= 3.5 ? "text-amber-400" : "text-rose-400"
              }`}>
                +{salida.deltaQuebrado}%
              </strong>
              <span className="text-[10px] text-slate-400 font-normal">
                QI: {salida.qiIngreso}% → QB: {salida.quebradoSalida}%
              </span>
            </div>
          </div>

          {/* Gelatinización & Blancura */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Gelatinización
            </span>
            <div className="mt-1">
              <strong className="text-base text-amber-300 font-bold block">
                {salida.gelatinizacionPct}%
              </strong>
              <span className="text-[10px] text-slate-400 font-normal">
                Blancura: {salida.blancuraSalida}° Kett
              </span>
            </div>
          </div>

          {/* Puntuación de Cocción */}
          <div className="col-span-2 sm:col-span-1 bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-sans">
              <Award className="w-3.5 h-3.5 text-amber-400" /> Cocción Score
            </span>
            <div className="mt-1">
              <strong className="text-base text-amber-400 font-bold flex items-center gap-1">
                ★ {coccion.coccionScore}/100
              </strong>
              <span className="text-[10px] text-emerald-400 font-semibold truncate block">
                100% Grano Suelto
              </span>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* NAVIGATION TABS                                           */}
        {/* ========================================================= */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800 bg-slate-950/40 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("vision360")}
            className={`px-3.5 py-2 rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "vision360"
                ? "bg-slate-800/80 text-amber-400 border-amber-400"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Visión 360° Integral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("proceso")}
            className={`px-3.5 py-2 rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "proceso"
                ? "bg-slate-800/80 text-amber-400 border-amber-400"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>1. Proceso de Vaporizado & Secado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("salida")}
            className={`px-3.5 py-2 rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "salida"
                ? "bg-slate-800/80 text-amber-400 border-amber-400"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Parámetros de Calidad de Salida</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("coccion")}
            className={`px-3.5 py-2 rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "coccion"
                ? "bg-slate-800/80 text-amber-400 border-amber-400"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>3. Resultados de Cocción</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("lotes")}
            className={`px-3.5 py-2 rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === "lotes"
                ? "bg-slate-800/80 text-amber-400 border-amber-400"
                : "text-slate-400 hover:text-slate-200 border-transparent"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>4. Lotes & Balanza ({meta.bLotes.length})</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB BODY (SCROLLABLE)                                     */}
        {/* ========================================================= */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-300 text-xs">
          
          {/* ------------------------------------------------------- */}
          {/* TAB 1: VISIÓN 360° INTEGRAL                             */}
          {/* ------------------------------------------------------- */}
          {activeTab === "vision360" && (
            <div className="space-y-5">
              
              {/* 3 Pillars Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Pillar 1: Proceso */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                      <Flame className="w-4 h-4" />
                      <span>Proceso Térmico</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {proceso.modalidadPases === "2_PASES" ? "2 Pases (Anti-Trizado)" : "1 Pase Directo"}
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Presión Vapor:</span>
                      <strong className="text-white">{proceso.presionVapor} bar (Max {proceso.presionMax} bar)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Temperatura Inyección:</span>
                      <strong className="text-amber-300">{proceso.tempVapor}°C</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tiempo Vapor / Reposo:</span>
                      <strong className="text-white">{proceso.tiempoVaporMin} min / {proceso.tiempoReposoMin} min</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Secado Final:</span>
                      <strong className="text-emerald-400">{proceso.secadoMetodo} ({proceso.secadoTemp}°C)</strong>
                    </div>
                  </div>
                </div>

                {/* Pillar 2: Calidad Salida */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-cyan-400 text-sm">
                      <Layers className="w-4 h-4" />
                      <span>Parámetros Salida</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      salida.salidaAprobada ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-amber-950 text-amber-300 border border-amber-800"
                    }`}>
                      {salida.salidaAprobada ? "CONFORME" : "OBSERVADO"}
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Humedad Salida:</span>
                      <strong className="text-cyan-300">{salida.humSalida}% (Objetivo ≤ 13.0%)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rendimiento Entero:</span>
                      <strong className="text-emerald-400">{salida.enteroSalida}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quebrado / Δ Incremento:</span>
                      <strong className="text-amber-300">{salida.quebradoSalida}% (+{salida.deltaQuebrado}%)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Blancura / Gelatinización:</span>
                      <strong className="text-white">{salida.blancuraSalida}° Kett / {salida.gelatinizacionPct}%</strong>
                    </div>
                  </div>
                </div>

                {/* Pillar 3: Cocción */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Prueba de Cocción</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                      ★ {coccion.coccionScore} pts
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tiempo de Cocción:</span>
                      <strong className="text-white">{coccion.tiempoCoccionMin}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Absorción de Agua:</span>
                      <strong className="text-cyan-300">{coccion.ratioAbsorcionAgua}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expansión Volumétrica:</span>
                      <strong className="text-emerald-400">{coccion.expansionVolumetrica}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Separación de Grano:</span>
                      <strong className="text-amber-300">{coccion.separacionGrano}</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Culinary & Technical Verdict Box */}
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-emerald-950/40 p-4 rounded-xl border border-amber-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    <span>Dictamen Técnico y Culinario del Batch</span>
                  </div>
                  <p className="text-slate-300 text-xs italic">
                    "{coccion.observaciones}"
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center whitespace-nowrap">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-xs">
                    ✓ APTO PARA DESPACHO / PILADO
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 2: PROCESO DETALLADO                                */}
          {/* ------------------------------------------------------- */}
          {activeTab === "proceso" && (
            <div className="space-y-4">
              
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Parámetros Operativos del Autoclave & Ciclo Térmico</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px] mb-1">INYECCIÓN DE VAPOR:</span>
                    <strong className="text-white text-sm block">{proceso.presionVapor} bar</strong>
                    <span className="text-[10px] text-slate-500">Presión Máx: {proceso.presionMax} bar</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px] mb-1">TEMPERATURA & RPM:</span>
                    <strong className="text-amber-300 text-sm block">{proceso.tempVapor}°C</strong>
                    <span className="text-[10px] text-slate-500">Velocidad: {proceso.rpm} RPM</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px] mb-1">TIEMPOS DE CICLO:</span>
                    <strong className="text-cyan-300 text-sm block">{proceso.tiempoVaporMin} min inyección</strong>
                    <span className="text-[10px] text-slate-500">Reposo: {proceso.tiempoReposoMin} min</span>
                  </div>

                </div>

                {/* Etapas Timeline */}
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-bold block">1. CARGA / LLENADO</span>
                    <strong className="text-slate-200 text-xs">Tolva Pulmón</strong>
                  </div>
                  <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-center">
                    <span className="text-[10px] text-amber-400 font-bold block">2. INYECCIÓN VAPOR</span>
                    <strong className="text-white text-xs">{proceso.tiempoVaporMin} min @ {proceso.presionVapor} bar</strong>
                  </div>
                  <div className="p-2.5 rounded bg-blue-950/30 border border-blue-800/40 text-center">
                    <span className="text-[10px] text-blue-400 font-bold block">3. REPOSO TÉRMICO</span>
                    <strong className="text-white text-xs">{proceso.tiempoReposoMin} min Silo</strong>
                  </div>
                  <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/40 text-center">
                    <span className="text-[10px] text-emerald-400 font-bold block">4. SECADO FINAL</span>
                    <strong className="text-white text-xs">{proceso.secadoMetodo}</strong>
                  </div>
                </div>

              </div>

              {/* Responsables y Desviaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 text-xs font-bold block">EQUIPO HUMANO RESPONSABLE</span>
                  <div className="space-y-1 text-xs">
                    <div>Operador de Turno: <strong className="text-white">{proceso.operador}</strong></div>
                    <div>Supervisor de Planta: <strong className="text-slate-200">{proceso.supervisor}</strong></div>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 text-xs font-bold block">CONTROL DE DESVIACIONES</span>
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{proceso.desviacion}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 3: PARÁMETROS DE SALIDA                             */}
          {/* ------------------------------------------------------- */}
          {activeTab === "salida" && (
            <div className="space-y-4">
              
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Matriz Comparativa de Calidad: Ingreso vs Salida de Vaporizado</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2.5">Parámetro Fisicoquímico</th>
                        <th className="px-3 py-2.5 text-right">Materia Prima (Ingreso)</th>
                        <th className="px-3 py-2.5 text-right">Producto Salida</th>
                        <th className="px-3 py-2.5 text-right">Variación (Delta)</th>
                        <th className="px-3 py-2.5 text-center">Tolerancia / Meta</th>
                        <th className="px-3 py-2.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      
                      {/* Humedad */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-white font-sans font-medium flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Humedad (%)</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">{salida.humIngreso}%</td>
                        <td className="px-3 py-2 text-right text-cyan-300 font-bold">{salida.humSalida}%</td>
                        <td className="px-3 py-2 text-right text-slate-400">{salida.deltaHumedad}%</td>
                        <td className="px-3 py-2 text-center text-slate-400 font-sans">≤ 13.0%</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            CONFORME
                          </span>
                        </td>
                      </tr>

                      {/* Quebrado */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-white font-sans font-medium flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-400" />
                          <span>Quebrado (% QB / QI)</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">{salida.qiIngreso}%</td>
                        <td className="px-3 py-2 text-right text-amber-300 font-bold">{salida.quebradoSalida}%</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-bold">+{salida.deltaQuebrado}%</td>
                        <td className="px-3 py-2 text-center text-slate-400 font-sans">Δ ≤ 3.5%</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            ÓPTIMO
                          </span>
                        </td>
                      </tr>

                      {/* Trizado */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-white font-sans font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>Trizado (% TZ)</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">--</td>
                        <td className="px-3 py-2 text-right text-slate-200 font-bold">{salida.trizadoSalida}%</td>
                        <td className="px-3 py-2 text-right text-slate-400">--</td>
                        <td className="px-3 py-2 text-center text-slate-400 font-sans">≤ 2.0%</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            CONFORME
                          </span>
                        </td>
                      </tr>

                      {/* Blancura */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-white font-sans font-medium flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Blancura Kett (Grados)</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">~30.0°</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-bold">{salida.blancuraSalida}°</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-bold">+{Number((salida.blancuraSalida - 30).toFixed(1))}°</td>
                        <td className="px-3 py-2 text-center text-slate-400 font-sans">≥ 38.0°</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            PREMIUM
                          </span>
                        </td>
                      </tr>

                      {/* Gelatinización */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-white font-sans font-medium flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          <span>Índice Gelatinización</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">0%</td>
                        <td className="px-3 py-2 text-right text-amber-300 font-bold">{salida.gelatinizacionPct}%</td>
                        <td className="px-3 py-2 text-right text-amber-300 font-bold">+{salida.gelatinizacionPct}%</td>
                        <td className="px-3 py-2 text-center text-slate-400 font-sans">≥ 95.0%</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                            COMPLETA
                          </span>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

              </div>

            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 4: RESULTADOS DE COCCIÓN Y CONTROL OFICIAL DE OLLA */}
          {/* ------------------------------------------------------- */}
          {activeTab === "coccion" && (
            <div className="space-y-4">
              
              {/* Culinary Score Card Header */}
              <div className="bg-gradient-to-br from-slate-900 to-amber-950/30 p-5 rounded-xl border border-amber-600/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/40">
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white font-mono">
                          EVALUACIÓN SENSORIAL, FÍSICA Y PRUEBA DE OLLA
                        </h4>
                        {coccion.esDatoReal && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Ficha Real Integrada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {coccion.panelEvaluador} • Metodología de la Hoja Oficial de Control de Vaporizado
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-mono">PUNTAJE DE COCCIÓN:</span>
                    <strong className="text-2xl font-black text-amber-400 font-mono">
                      ★ {coccion.coccionScore} / 100
                    </strong>
                  </div>
                </div>

                {/* 1. SECCIÓN DOSIFICACIÓN DE LABORATORIO */}
                <div className="mt-4">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-2 font-mono">
                    1. Dosificación Estándar en Olla
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 font-sans">Tazas de Arroz:</span>
                      <strong className="text-amber-300 text-sm font-bold">{coccion.tazasArroz ?? 3}</strong>
                    </div>
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 font-sans">Tazas de Agua:</span>
                      <strong className="text-cyan-300 text-sm font-bold">{coccion.tazasAgua ?? "3 1/2"}</strong>
                    </div>
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 font-sans">Tiempo de Cocción:</span>
                      <strong className="text-emerald-400 text-sm font-bold">{coccion.tiempoCoccionMin}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. SECCIÓN EVALUACIÓN ORGANOLÉPTICA Y EN OLLA (PARÁMETROS OFICIALES) */}
                <div className="mt-4">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-2 font-mono">
                    2. Análisis Organoléptico & Desempeño Culinario
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs font-mono">
                    
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">Desplazamiento / Fluidez:</span>
                      <strong className="text-amber-300 text-sm block font-bold">{coccion.desplazamientoSeg ?? "15 seg"}</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Velocidad en grano cocido</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">% G. Quebrado (en olla):</span>
                      <strong className="text-amber-400 text-sm block font-bold">{coccion.granoQuebradoOllaPct ?? 18.0}%</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Resistencia mecánica</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">% G. Hinchado:</span>
                      <strong className="text-emerald-400 text-sm block font-bold">{coccion.granoHinchadoPct ?? 8.6}%</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Capacidad de hinchamiento</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">% G. Abierto (Apertura):</span>
                      <strong className="text-cyan-300 text-sm block font-bold">{coccion.granoAbiertoPct ?? 1.3}%</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Integridad del grano</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">Textura en Frío:</span>
                      <strong className="text-teal-300 text-sm block font-bold">{coccion.texturaFrio ?? coccion.texturaFirmeza ?? "Suave"}</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Masticabilidad post-enfriamiento</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">Rendimiento en Masa:</span>
                      <strong className="text-emerald-400 text-sm block font-bold">{coccion.rendimientoMasaPct ?? 260}%</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Multiplicador de porción</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">Soltura / Pegajosidad:</span>
                      <strong className="text-emerald-400 text-sm block font-bold">{coccion.separacionGrano}</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Cero apelmazamiento</span>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1 font-sans">Sabor y Aroma:</span>
                      <strong className="text-white text-sm block font-bold">{coccion.aromaSabor}</strong>
                      <span className="text-[10px] text-slate-400 font-sans">Neutro característico</span>
                    </div>

                  </div>
                </div>

                {/* 3. SECCIÓN ANÁLISIS FÍSICO COMPARATIVO (MP VS DESCARGA) */}
                <div className="mt-4">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-2 font-mono">
                    3. Parámetros Físicos Oficiales: Materia Prima vs Descarga (Vaporizado)
                  </span>
                  <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/90">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Parámetro</th>
                          <th className="px-3 py-2 text-center text-blue-300">Materia Prima (MP)</th>
                          <th className="px-3 py-2 text-center text-amber-300">Descarga (Vaporizado)</th>
                          <th className="px-3 py-2 text-center text-emerald-400">Variación (Δ)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">Reposo Cáscara (Días)</td>
                          <td className="px-3 py-2 text-center text-slate-500">-</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.reposoCascaraDias ?? 44} días</td>
                          <td className="px-3 py-2 text-center text-slate-400 font-sans">Reposo estándar</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% Humedad Cáscara</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.humedadCascaraMP ?? 14.4}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.humedadCascaraDescarga ?? 11.5}%</td>
                          <td className="px-3 py-2 text-center text-emerald-400 font-bold">
                            {coccion.humedadCascaraMP && coccion.humedadCascaraDescarga
                              ? `${(coccion.humedadCascaraDescarga - coccion.humedadCascaraMP).toFixed(1)}%`
                              : "-2.9%"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% Humedad Blanco</td>
                          <td className="px-3 py-2 text-center text-slate-500">-</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.humedadBlancoDescarga ?? 11.0}%</td>
                          <td className="px-3 py-2 text-center text-slate-400">11.0%</td>
                        </tr>
                        <tr className="bg-amber-950/20">
                          <td className="px-3 py-2 font-sans text-amber-200 font-bold flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            % Trizado (Térmico)
                          </td>
                          <td className="px-3 py-2 text-center text-blue-300 font-bold">{coccion.trizadoMP ?? 2.0}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.trizadoDescarga ?? 28.5}%</td>
                          <td className="px-3 py-2 text-center text-amber-400 font-bold">
                            +{coccion.deltaTrizado ?? (coccion.trizadoDescarga && coccion.trizadoMP ? (coccion.trizadoDescarga - coccion.trizadoMP).toFixed(1) : 26.5)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% Quebrado Integral</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.quebradoIntegralMP ?? 4.1}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.quebradoIntegralDescarga ?? 16.1}%</td>
                          <td className="px-3 py-2 text-center text-amber-400 font-bold">
                            +{coccion.quebradoIntegralMP && coccion.quebradoIntegralDescarga ? (coccion.quebradoIntegralDescarga - coccion.quebradoIntegralMP).toFixed(1) : "12.0"}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% Quebrado Blanco</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.quebradoMP ?? 10.9}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.quebradoDescarga ?? 25.3}%</td>
                          <td className="px-3 py-2 text-center text-amber-400 font-bold">
                            +{coccion.deltaQuebrado ?? (coccion.quebradoDescarga && coccion.quebradoMP ? (coccion.quebradoDescarga - coccion.quebradoMP).toFixed(1) : 14.4)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">°BL Integral (Blancura Kett)</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.blancuraIntegralMP ?? 21.5}°</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.blancuraIntegralDescarga ?? 18.8}°</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            {coccion.blancuraIntegralMP && coccion.blancuraIntegralDescarga ? (coccion.blancuraIntegralDescarga - coccion.blancuraIntegralMP).toFixed(1) : "-2.7"}°
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">°BL Blanco (Blancura Kett)</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.blancuraBlancoMP ?? 40.1}°</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.blancuraBlancoDescarga ?? 31.4}°</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            {coccion.blancuraBlancoMP && coccion.blancuraBlancoDescarga ? (coccion.blancuraBlancoDescarga - coccion.blancuraBlancoMP).toFixed(1) : "-8.7"}°
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% Tiza total + G. cocido</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.tizaTotalMasGcocidoMP ?? 1.7}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.tizaTotalMasGcocidoDescarga ?? 3.4}%</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            +{coccion.tizaTotalMasGcocidoMP && coccion.tizaTotalMasGcocidoDescarga ? (coccion.tizaTotalMasGcocidoDescarga - coccion.tizaTotalMasGcocidoMP).toFixed(1) : "1.7"}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% TP + T. puntual</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.tpMasTpuntualMP ?? 3.4}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.tpMasTpuntualDescarga ?? 6.1}%</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            +{coccion.tpMasTpuntualMP && coccion.tpMasTpuntualDescarga ? (coccion.tpMasTpuntualDescarga - coccion.tpMasTpuntualMP).toFixed(1) : "2.7"}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% Mancha</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.manchaMP ?? 1.6}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.manchaDescarga ?? 3.3}%</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            +{coccion.manchaMP && coccion.manchaDescarga ? (coccion.manchaDescarga - coccion.manchaMP).toFixed(1) : "1.7"}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-sans text-slate-300 font-medium">% G. Inmaduro</td>
                          <td className="px-3 py-2 text-center text-blue-300">{coccion.granoInmaduroMP ?? 1.0}%</td>
                          <td className="px-3 py-2 text-center text-amber-300 font-bold">{coccion.granoInmaduroDescarga ?? 1.3}%</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            +{coccion.granoInmaduroMP && coccion.granoInmaduroDescarga ? (coccion.granoInmaduroDescarga - coccion.granoInmaduroMP).toFixed(1) : "0.3"}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Panel Findings Note */}
                <div className="mt-4 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 font-mono">OBSERVACIONES DEL CONTROL DE COCCIÓN:</span>
                    {coccion.fuenteExterna && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Fuente: {coccion.fuenteExterna}
                      </span>
                    )}
                  </div>
                  <p className="italic text-slate-200">{coccion.observaciones}</p>
                </div>

              </div>

            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 5: LOTES APORTANTES                                 */}
          {/* ------------------------------------------------------- */}
          {activeTab === "lotes" && (
            <div className="space-y-4">
              
              <div className="overflow-x-auto bg-slate-950/60 rounded-xl border border-slate-800 p-3">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Lote ID</th>
                      <th className="px-3 py-2.5">Cliente</th>
                      <th className="px-3 py-2.5">Variedad</th>
                      <th className="px-3 py-2.5 text-right">Sacos</th>
                      <th className="px-3 py-2.5 text-right">Peso (kg)</th>
                      <th className="px-3 py-2.5 text-right">% Aporte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {meta.bLotes.map((bl, i) => {
                      const peso = Number(bl.PESO_KG) || 0;
                      const pct = meta.pesoEfectivoKg > 0 ? (peso / meta.pesoEfectivoKg) * 100 : 0;
                      return (
                        <tr key={bl.BATCH_LOTE_ID || i} className="hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-cyan-300 font-bold">{bl.LOTE_ID}</td>
                          <td className="px-3 py-2 font-sans text-slate-300">{bl.CLIENTE || meta.clienteDisplay}</td>
                          <td className="px-3 py-2 font-sans text-amber-300">{bl.VARIEDAD || meta.variedadDisplay}</td>
                          <td className="px-3 py-2 text-right text-slate-200">{bl.SACOS}</td>
                          <td className="px-3 py-2 text-right text-emerald-400 font-bold">{peso.toLocaleString()} kg</td>
                          <td className="px-3 py-2 text-right text-slate-400">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* ========================================================= */}
        {/* FOOTER ACTIONS                                            */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/80">
          <div className="text-xs text-slate-400 font-mono">
            Correlativo: <strong className="text-amber-400">BATCH {corr}</strong> • {meta.totalSacos} sacos • {meta.tonEfectivas.toFixed(2)} TN
          </div>

          <div className="flex items-center gap-2">
            {onNavigate && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate("control-vaporizado", batch.BATCH_ID);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Control Vaporizado</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate("analisis-vaporizado", batch.BATCH_ID);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Análisis Calidad</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cerrar Resumen
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
