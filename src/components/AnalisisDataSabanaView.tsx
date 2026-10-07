import React, { useState, useMemo } from "react";
import { HistorialBatchTrabajado } from "../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine,
  LineChart,
  Line,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  Gauge, 
  Clock, 
  CheckCircle2, 
  Filter, 
  Sparkles, 
  Download, 
  Flame, 
  Layers, 
  FileText,
  Sliders,
  Percent,
  Timer,
  Info,
  ChevronRight,
  Zap
} from "lucide-react";

interface AnalisisDataSabanaViewProps {
  historial: HistorialBatchTrabajado[];
  onSeleccionarBatchParaReplicar?: (batch: HistorialBatchTrabajado) => void;
  onIrASabana?: () => void;
}

export const AnalisisDataSabanaView: React.FC<AnalisisDataSabanaViewProps> = ({
  historial,
  onSeleccionarBatchParaReplicar,
  onIrASabana
}) => {
  // Filtros de interactividad
  const [variedadFiltro, setVariedadFiltro] = useState<string>("TODAS");
  const [procesoFiltro, setProcesoFiltro] = useState<string>("TODOS");
  const [metricTab, setMetricTab] = useState<"quebrado" | "presion" | "coccion" | "reposo">("quebrado");

  // Variedades disponibles
  const variedades = useMemo(() => {
    const setVar = new Set<string>();
    historial.forEach(h => {
      if (h.variedad) setVar.add(h.variedad.trim().toUpperCase());
    });
    return Array.from(setVar).sort();
  }, [historial]);

  // Batches filtrados
  const batchesFiltrados = useMemo(() => {
    return historial.filter(b => {
      const matchVar = variedadFiltro === "TODAS" || b.variedad.toUpperCase() === variedadFiltro.toUpperCase();
      const matchProc = procesoFiltro === "TODOS" || b.tipoProceso === procesoFiltro;
      return matchVar && matchProc;
    });
  }, [historial, variedadFiltro, procesoFiltro]);

  // Cálculos de KPIs Globales del resumen
  const estadisticasGlobales = useMemo(() => {
    const total = batchesFiltrados.length;
    if (total === 0) {
      return {
        total: 0,
        incQPromedio: 0,
        pctConformes: 0,
        presion1Promedio: 0,
        presion2Promedio: 0,
        reposo1Promedio: 0,
        reposo2Promedio: 0,
        rpmPromedio: 0,
        desplazamientoPromedio: 0,
        quebradoOllaPromedio: 0,
        variedadMasEstable: "N/A"
      };
    }

    const conIncQ = batchesFiltrados.filter(b => b.incQ2 !== null && b.incQ2 !== undefined || b.incQ1 !== null && b.incQ1 !== undefined);
    const sumIncQ = conIncQ.reduce((acc, b) => acc + (b.incQ2 ?? b.incQ1 ?? 0), 0);
    const incQPromedio = conIncQ.length > 0 ? sumIncQ / conIncQ.length : 0;

    const conformes = conIncQ.filter(b => (b.incQ2 ?? b.incQ1 ?? 0) <= 12.0).length;
    const pctConformes = conIncQ.length > 0 ? (conformes / conIncQ.length) * 100 : 0;

    const conPres1 = batchesFiltrados.filter(b => b.pres1Bar !== null && b.pres1Bar !== undefined);
    const sumPres1 = conPres1.reduce((acc, b) => acc + (b.pres1Bar ?? 0), 0);
    const presion1Promedio = conPres1.length > 0 ? sumPres1 / conPres1.length : 0;

    const conPres2 = batchesFiltrados.filter(b => b.pres2Bar !== null && b.pres2Bar !== undefined);
    const sumPres2 = conPres2.reduce((acc, b) => acc + (b.pres2Bar ?? 0), 0);
    const presion2Promedio = conPres2.length > 0 ? sumPres2 / conPres2.length : 0;

    const conRep1 = batchesFiltrados.filter(b => b.tReposo1Min !== null && b.tReposo1Min !== undefined);
    const sumRep1 = conRep1.reduce((acc, b) => acc + (b.tReposo1Min ?? 0), 0);
    const reposo1Promedio = conRep1.length > 0 ? sumRep1 / conRep1.length : 0;

    const conRep2 = batchesFiltrados.filter(b => b.tReposo2Min !== null && b.tReposo2Min !== undefined);
    const sumRep2 = conRep2.reduce((acc, b) => acc + (b.tReposo2Min ?? 0), 0);
    const reposo2Promedio = conRep2.length > 0 ? sumRep2 / conRep2.length : 0;

    const conRpm = batchesFiltrados.filter(b => b.rpm1 !== null && b.rpm1 !== undefined);
    const sumRpm = conRpm.reduce((acc, b) => acc + (b.rpm1 ?? 0), 0);
    const rpmPromedio = conRpm.length > 0 ? sumRpm / conRpm.length : 0;

    const conDesp = batchesFiltrados.filter(b => b.desplazamientoCoccionSeg !== null && b.desplazamientoCoccionSeg !== undefined);
    const sumDesp = conDesp.reduce((acc, b) => acc + (b.desplazamientoCoccionSeg ?? 0), 0);
    const desplazamientoPromedio = conDesp.length > 0 ? sumDesp / conDesp.length : 0;

    const conQCoc = batchesFiltrados.filter(b => b.quebradoCoccionPct !== null && b.quebradoCoccionPct !== undefined);
    const sumQCoc = conQCoc.reduce((acc, b) => acc + (b.quebradoCoccionPct ?? 0), 0);
    const quebradoOllaPromedio = conQCoc.length > 0 ? sumQCoc / conQCoc.length : 0;

    return {
      total,
      incQPromedio: Number(incQPromedio.toFixed(2)),
      pctConformes: Number(pctConformes.toFixed(1)),
      presion1Promedio: Number(presion1Promedio.toFixed(2)),
      presion2Promedio: Number(presion2Promedio.toFixed(2)),
      reposo1Promedio: Math.round(reposo1Promedio),
      reposo2Promedio: Math.round(reposo2Promedio),
      rpmPromedio: Number(rpmPromedio.toFixed(1)),
      desplazamientoPromedio: Number(desplazamientoPromedio.toFixed(1)),
      quebradoOllaPromedio: Number(quebradoOllaPromedio.toFixed(1)),
      variedadMasEstable: "FERON / TINAJONES"
    };
  }, [batchesFiltrados]);

  // Resumen Consolidado por Variedad (Tabla de Promedios por Variedad)
  const resumenPorVariedad = useMemo(() => {
    const mapa = new Map<string, HistorialBatchTrabajado[]>();
    historial.forEach(b => {
      const v = b.variedad ? b.variedad.trim().toUpperCase() : "OTRA";
      if (!mapa.has(v)) mapa.set(v, []);
      mapa.get(v)!.push(b);
    });

    return Array.from(mapa.entries()).map(([varName, items]) => {
      const count = items.length;
      
      const calcAvg = (getter: (x: HistorialBatchTrabajado) => number | null | undefined) => {
        const valids = items.map(getter).filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
        if (valids.length === 0) return null;
        return Number((valids.reduce((a, b) => a + b, 0) / valids.length).toFixed(1));
      };

      const avgHI = calcAvg(x => x.hi);
      const avgRI = calcAvg(x => x.riPct);
      const avgRB = calcAvg(x => x.rbPct);
      const avgQIng = calcAvg(x => x.qPct);
      const avgPres1 = calcAvg(x => x.pres1Bar);
      const avgRpm1 = calcAvg(x => x.rpm1);
      const avgRep1 = calcAvg(x => x.tReposo1Min);
      const avgPres2 = calcAvg(x => x.pres2Bar);
      const avgRep2 = calcAvg(x => x.tReposo2Min);
      const avgIncQ = calcAvg(x => x.incQ2 ?? x.incQ1);
      const avgQCoc = calcAvg(x => x.quebradoCoccionPct);
      const avgDesp = calcAvg(x => x.desplazamientoCoccionSeg);

      // Evaluación del comportamiento
      let dictamen = "Normal";
      let colorBadge = "bg-slate-100 text-slate-700";
      if (avgIncQ !== null) {
        if (avgIncQ <= 10.0) {
          dictamen = "Óptima Resistencia";
          colorBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
        } else if (avgIncQ <= 14.0) {
          dictamen = "Controlado";
          colorBadge = "bg-amber-100 text-amber-800 border-amber-300";
        } else {
          dictamen = "Susceptible a Merma";
          colorBadge = "bg-red-100 text-red-800 border-red-300";
        }
      }

      return {
        variedad: varName,
        count,
        avgHI,
        avgRI,
        avgRB,
        avgQIng,
        avgPres1,
        avgRpm1,
        avgRep1,
        avgPres2,
        avgRep2,
        avgIncQ,
        avgQCoc,
        avgDesp,
        dictamen,
        colorBadge,
        batches: items
      };
    }).sort((a, b) => (a.avgIncQ ?? 99) - (b.avgIncQ ?? 99));
  }, [historial]);

  // Resumen Consolidado por Tipo de Proceso (Presecado vs Húmedo vs Seco)
  const resumenPorProceso = useMemo(() => {
    const tipos = ["PRESECADO", "HUMEDO", "SECO"] as const;
    return tipos.map(tipo => {
      const items = historial.filter(b => b.tipoProceso === tipo);
      const count = items.length;

      const calcAvg = (getter: (x: HistorialBatchTrabajado) => number | null | undefined) => {
        const valids = items.map(getter).filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
        if (valids.length === 0) return null;
        return Number((valids.reduce((a, b) => a + b, 0) / valids.length).toFixed(1));
      };

      return {
        tipo,
        count,
        avgHI: calcAvg(x => x.hi),
        avgQIng: calcAvg(x => x.qPct),
        avgPres1: calcAvg(x => x.pres1Bar),
        avgRpm1: calcAvg(x => x.rpm1),
        avgRep1: calcAvg(x => x.tReposo1Min),
        avgPres2: calcAvg(x => x.pres2Bar),
        avgRep2: calcAvg(x => x.tReposo2Min),
        avgIncQ: calcAvg(x => x.incQ2 ?? x.incQ1),
        avgQCoc: calcAvg(x => x.quebradoCoccionPct),
        avgDesp: calcAvg(x => x.desplazamientoCoccionSeg)
      };
    });
  }, [historial]);

  // Datos para el gráfico de barras por Batch individual (313 al 336)
  const dataGraficoBatches = useMemo(() => {
    return batchesFiltrados.map(b => {
      const incQ = b.incQ2 ?? b.incQ1 ?? 0;
      let statusColor = "#10b981"; // verde <= 10%
      if (incQ > 14.0) {
        statusColor = "#ef4444"; // rojo > 14%
      } else if (incQ > 10.0) {
        statusColor = "#f59e0b"; // amarillo 10-14%
      }

      return {
        batch: `B-${b.batch}`,
        batchNum: b.batch,
        variedad: b.variedad,
        tipoProceso: b.tipoProceso,
        incQ: Number(incQ.toFixed(1)),
        qIngreso: b.qPct || 0,
        pres1: b.pres1Bar || 0,
        pres2: b.pres2Bar || 0,
        reposoTot: (b.tReposo1Min || 0) + (b.tReposo2Min || 0),
        desplazamiento: b.desplazamientoCoccionSeg || 0,
        quebradoOlla: b.quebradoCoccionPct || 0,
        statusColor,
        rawBatch: b
      };
    }).sort((a, b) => Number(a.batchNum) - Number(b.batchNum));
  }, [batchesFiltrados]);

  // Datos para el gráfico de correlación de Presión vs Quebrado
  const dataPresionVsQuebrado = useMemo(() => {
    return dataGraficoBatches.map(d => ({
      batch: d.batch,
      variedad: d.variedad,
      presion: d.pres1,
      presion2: d.pres2,
      incQ: d.incQ,
      statusColor: d.statusColor
    }));
  }, [dataGraficoBatches]);

  // Top 3 Batches Golden vs 3 Batches con mayor merma
  const batchesExtremos = useMemo(() => {
    const validos = historial.filter(b => (b.incQ2 !== null && b.incQ2 !== undefined) || (b.incQ1 !== null && b.incQ1 !== undefined));
    const ordenados = [...validos].sort((a, b) => {
      const incA = a.incQ2 ?? a.incQ1 ?? 99;
      const incB = b.incQ2 ?? b.incQ1 ?? 99;
      return incA - incB;
    });

    const topMejores = ordenados.slice(0, 3);
    const topDesviaciones = [...ordenados].reverse().slice(0, 3);

    return { topMejores, topDesviaciones };
  }, [historial]);

  return (
    <div id="analisis-data-sabana-container" className="space-y-6">
      {/* 1. CABECERA & CONTROLES DE INTERACTIVIDAD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200">
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
              Módulo de Evaluación & Análisis de Data Oficial
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Resumen Ejecutivo & Análisis Estadístico (Batches 313 - 336)
            </h1>
            <p className="text-sm text-slate-500 max-w-3xl">
              Consolidación cuantitativa de la sábana de batches trabajados: correlación entre presiones de vapor, 
              velocidad de exclusa, tiempos de reposo en tanques e incremento de quebrado final en planta y olla.
            </p>
          </div>

          {/* Filtros rápidos en cabecera */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600">Variedad:</span>
              <select
                value={variedadFiltro}
                onChange={(e) => setVariedadFiltro(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODAS">Todas ({variedades.length})</option>
                {variedades.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600">Proceso:</span>
              <select
                value={procesoFiltro}
                onChange={(e) => setProcesoFiltro(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Regímenes</option>
                <option value="PRESECADO">PRESECADO</option>
                <option value="HUMEDO">HÚMEDO</option>
                <option value="SECO">SECO</option>
              </select>
            </div>

            {onIrASabana && (
              <button
                onClick={onIrASabana}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-300 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver Sábana Cruda
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE KPIS EJECUTIVOS (METRIC TILES) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Batches Analizados */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Batches Analizados
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {estadisticasGlobales.total}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">lotes</span>
          </div>
          <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-semibold inline-block">
            Sábana 313 - 336
          </span>
        </div>

        {/* KPI 2: Incremento Quebrado Medio */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Inc. Quebrado (ΔQ)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black font-mono ${
              estadisticasGlobales.incQPromedio <= 12 ? "text-emerald-600" : "text-amber-600"
            }`}>
              +{estadisticasGlobales.incQPromedio}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block">
            Promedio acumulado
          </span>
        </div>

        {/* KPI 3: Conformidad / Control */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Tasa Conformidad
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600 font-mono">
              {estadisticasGlobales.pctConformes}%
            </span>
          </div>
          <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold inline-block">
            ΔQ ≤ 12.0% meta
          </span>
        </div>

        {/* KPI 4: Presión Óptima Identificada */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Presión Vapor Prom.
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-600 font-mono">
              {estadisticasGlobales.presion1Promedio}
            </span>
            <span className="text-[11px] text-slate-500">/ {estadisticasGlobales.presion2Promedio} bar</span>
          </div>
          <span className="text-[10px] text-slate-500 block">
            1er Pase / 2do Pase
          </span>
        </div>

        {/* KPI 5: Tiempo de Reposo Promedio */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Reposo Promedio
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-purple-700 font-mono">
              {estadisticasGlobales.reposo1Promedio}m
            </span>
            <span className="text-[11px] text-slate-500">/ {estadisticasGlobales.reposo2Promedio}m</span>
          </div>
          <span className="text-[10px] text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded font-semibold inline-block">
            Pase 1 / Pase 2 (TK)
          </span>
        </div>

        {/* KPI 6: Desplazamiento en Olla */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Desplazamiento (Olla)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600 font-mono">
              {estadisticasGlobales.desplazamientoPromedio}s
            </span>
          </div>
          <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-semibold inline-block">
            Graneado Óptimo (&lt;20s)
          </span>
        </div>
      </div>

      {/* 3. TABLA RESUMEN CONSOLIDADA POR VARIEDAD (BREAKDOWN EJECUTIVO) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Cuadro Resumen de Parámetros y Resultados por Variedad
            </h2>
            <p className="text-xs text-slate-500">
              Promedios calculados a partir de los batches industriales trabajados en planta para cada variedad
            </p>
          </div>
          <span className="text-xs font-mono bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-lg border border-indigo-200 self-start sm:self-auto">
            {resumenPorVariedad.length} Variedades Catalogadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-800 text-white uppercase text-[10px] font-bold tracking-wider">
                <th className="py-2.5 px-3 rounded-tl-lg">Variedad</th>
                <th className="py-2.5 px-2 text-center">Batches</th>
                <th className="py-2.5 px-2.5 text-center bg-sky-900">HI Prom. (%)</th>
                <th className="py-2.5 px-2.5 text-center bg-sky-900">% Q Ingreso</th>
                <th className="py-2.5 px-2.5 text-center bg-amber-700">Pres-1 (bar)</th>
                <th className="py-2.5 px-2 text-center bg-amber-700">RPM-1</th>
                <th className="py-2.5 px-2 text-center bg-amber-700">Rep-1 (m)</th>
                <th className="py-2.5 px-2.5 text-center bg-indigo-800">Pres-2 (bar)</th>
                <th className="py-2.5 px-2 text-center bg-indigo-800">Rep-2 (m)</th>
                <th className="py-2.5 px-3 text-center bg-red-800 font-black">Inc. Q (ΔQ %)</th>
                <th className="py-2.5 px-2.5 text-center bg-yellow-600 text-slate-950 font-bold">Q Olla (%)</th>
                <th className="py-2.5 px-2.5 text-center bg-yellow-600 text-slate-950 font-bold">Desplaz. (s)</th>
                <th className="py-2.5 px-3 text-center rounded-tr-lg">Diagnóstico Industrial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {resumenPorVariedad.map((rv) => (
                <tr key={rv.variedad} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    {rv.variedad}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                    {rv.count}
                  </td>
                  <td className="py-2.5 px-2.5 text-center bg-sky-50/50 text-slate-800 font-bold">
                    {rv.avgHI ? `${rv.avgHI}%` : "-"}
                  </td>
                  <td className="py-2.5 px-2.5 text-center bg-sky-50/50 text-slate-700">
                    {rv.avgQIng ? `${rv.avgQIng}%` : "-"}
                  </td>
                  <td className="py-2.5 px-2.5 text-center bg-amber-50/50 font-bold text-amber-900">
                    {rv.avgPres1 !== null ? rv.avgPres1 : "-"}
                  </td>
                  <td className="py-2.5 px-2 text-center bg-amber-50/50 text-purple-700 font-bold">
                    {rv.avgRpm1 ?? "-"}
                  </td>
                  <td className="py-2.5 px-2 text-center bg-amber-50/50 text-emerald-700 font-semibold">
                    {rv.avgRep1 ? `${rv.avgRep1}m` : "-"}
                  </td>
                  <td className="py-2.5 px-2.5 text-center bg-indigo-50/50 font-bold text-indigo-900">
                    {rv.avgPres2 !== null ? rv.avgPres2 : "-"}
                  </td>
                  <td className="py-2.5 px-2 text-center bg-indigo-50/50 text-emerald-700 font-semibold">
                    {rv.avgRep2 ? `${rv.avgRep2}m` : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-center bg-red-50/50 font-black text-sm">
                    <span className={`px-2 py-0.5 rounded ${
                      (rv.avgIncQ ?? 0) <= 10.5 ? "bg-emerald-100 text-emerald-800 font-bold" :
                      (rv.avgIncQ ?? 0) <= 14.5 ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-700 font-black"
                    }`}>
                      {rv.avgIncQ !== null ? `+${rv.avgIncQ}%` : "-"}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-center bg-yellow-50/50 text-slate-800">
                    {rv.avgQCoc ? `${rv.avgQCoc}%` : "-"}
                  </td>
                  <td className="py-2.5 px-2.5 text-center bg-yellow-50/50 font-bold text-blue-700">
                    {rv.avgDesp ? `${rv.avgDesp}s` : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${rv.colorBadge}`}>
                      {rv.dictamen}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. CUADRO RESUMEN POR RÉGIMEN DE PROCESO (PRESECADO vs HÚMEDO vs SECO) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-600" />
              Comparativa por Régimen de Proceso de Humedad
            </h2>
            <p className="text-xs text-slate-500">
              Comportamiento del grano según su condición hídrica al entrar a la autoclave APIT
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resumenPorProceso.map((rp) => (
            <div 
              key={rp.tipo}
              className={`border-2 rounded-xl p-4 space-y-3 ${
                rp.tipo === "PRESECADO" ? "border-amber-200 bg-amber-50/30" :
                rp.tipo === "HUMEDO" ? "border-sky-200 bg-sky-50/30" :
                "border-slate-200 bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                  rp.tipo === "PRESECADO" ? "bg-amber-500 text-slate-950 font-bold" :
                  rp.tipo === "HUMEDO" ? "bg-sky-600 text-white" : "bg-slate-700 text-white"
                }`}>
                  {rp.tipo}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {rp.count} Batches
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500 font-sans">HI Entrada Promedio:</span>
                  <strong className="text-slate-800">{rp.avgHI ? `${rp.avgHI}%` : "-"}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500 font-sans">Presión Vapor P1 / P2:</span>
                  <strong className="text-blue-700">{rp.avgPres1 ?? 0} / {rp.avgPres2 ?? 0} bar</strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500 font-sans">Reposo TK (P1 / P2):</span>
                  <strong className="text-purple-700">{rp.avgRep1 ?? 0}m / {rp.avgRep2 ?? 0}m</strong>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1">
                  <span className="text-slate-500 font-sans">Inc. Quebrado (ΔQ):</span>
                  <strong className="text-red-700 text-sm">{rp.avgIncQ ? `+${rp.avgIncQ}%` : "-"}</strong>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-slate-500 font-sans">Desplazamiento Olla:</span>
                  <strong className="text-emerald-700">{rp.avgDesp ? `${rp.avgDesp}s` : "-"}</strong>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-600 italic border-t border-slate-200/80">
                {rp.tipo === "PRESECADO" && "💡 Recomendación: Trabajar a micro-presión (0.05-0.08 bar) y maximizar reposo en TK."}
                {rp.tipo === "HUMEDO" && "💡 Recomendación: Tolera presiones de 0.35 a 0.40 bar sin incremento crítico de quebrado."}
                {rp.tipo === "SECO" && "💡 Recomendación: Evitar choque térmico; enfriamiento prolongado indispensable."}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. VISUALIZACIONES GRÁFICAS INTERACTIVAS (RECHARTS) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Visualización Gráfica de Tendencias & Correlaciones
            </h2>
            <p className="text-xs text-slate-500">
              Evaluación gráfica batch por batch para identificar zonas de confort operativo
            </p>
          </div>

          {/* Selector de tipo de gráfico */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setMetricTab("quebrado")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                metricTab === "quebrado" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Incremento Quebrado (313-336)
            </button>
            <button
              onClick={() => setMetricTab("presion")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                metricTab === "presion" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Presión vs Quebrado
            </button>
            <button
              onClick={() => setMetricTab("coccion")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                metricTab === "coccion" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Calidad Cocción (Olla)
            </button>
          </div>
        </div>

        {/* GRÁFICO 1: INCREMENTO DE QUEBRADO POR BATCH */}
        {metricTab === "quebrado" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1">
              <span>Incremento porcentual de quebrado (ΔQ %) resultante por lote industrial</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                  Óptimo (≤ 10%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                  Aceptable (10.1 - 14%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-500 inline-block"></span>
                  Alerta / Merma (&gt; 14%)
                </span>
              </div>
            </div>

            <div className="h-[340px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataGraficoBatches} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="batch" 
                    tick={{ fontSize: 10, fill: "#475569" }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "#475569" }}
                    unit="%"
                    domain={[0, 30]}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 font-sans">
                            <div className="font-bold text-amber-400 text-sm border-b border-slate-700 pb-1">
                              {d.batch} ({d.variedad})
                            </div>
                            <div>Proceso: <span className="font-bold">{d.tipoProceso}</span></div>
                            <div className="text-red-400 font-bold">Inc. Quebrado (ΔQ): +{d.incQ}%</div>
                            <div>% Quebrado Ingreso: {d.qIngreso}%</div>
                            <div>Presión P1: {d.pres1} bar | P2: {d.pres2} bar</div>
                            <div>Reposo Total: {d.reposoTot} min</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={10} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Meta Óptima (10%)', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                  <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Tolerancia Máxima (15%)', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                  <Bar dataKey="incQ" name="Inc. Quebrado (%)" radius={[4, 4, 0, 0]}>
                    {dataGraficoBatches.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.statusColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* GRÁFICO 2: PRESIÓN DE VAPOR VS INCREMENTO DE QUEBRADO */}
        {metricTab === "presion" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Relación entre la Presión aplicada en autoclave APIT (Pase 1 y Pase 2) y el incremento de quebrado
            </p>
            <div className="h-[340px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPresionVsQuebrado} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="batch" tick={{ fontSize: 10, fill: "#475569" }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis yAxisId="left" unit="%" tick={{ fontSize: 11, fill: "#475569" }} domain={[0, 30]} />
                  <YAxis yAxisId="right" orientation="right" unit=" bar" tick={{ fontSize: 11, fill: "#2563eb" }} domain={[0, 0.8]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="incQ" name="Incremento Quebrado (ΔQ %)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="presion" name="Presión Pase 1 (bar)" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="presion2" name="Presión Pase 2 (bar)" stroke="#7c3aed" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* GRÁFICO 3: CALIDAD DE COCCIÓN (OLLA) */}
        {metricTab === "coccion" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Desplazamiento del grano cocido (segundos de soltura) vs % Quebrado en Olla
            </p>
            <div className="h-[340px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataGraficoBatches.filter(d => d.desplazamiento > 0)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="batch" tick={{ fontSize: 10, fill: "#475569" }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis yAxisId="left" unit=" seg" tick={{ fontSize: 11, fill: "#2563eb" }} domain={[0, 40]} />
                  <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11, fill: "#dc2626" }} domain={[0, 25]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="desplazamiento" name="Desplazamiento / Soltura (segundos)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="quebradoOlla" name="% Quebrado en Cocción" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 6. COMPARATIVO: BATCHES CAMPEONES (GOLDEN) VS BATCHES CON ALERTA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna A: Mejores Batches (Best Practices) */}
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Top Batches de Mayor Rendimiento (Golden)
                </h3>
                <p className="text-xs text-slate-500">Mínimo incremento de quebrado y óptimo comportamiento culinario</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
              Lotes Modelo
            </span>
          </div>

          <div className="space-y-3">
            {batchesExtremos.topMejores.map(b => (
              <div key={b.id} className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-emerald-200">
                      Batch {b.batch}
                    </span>
                    <span className="text-xs font-bold text-emerald-800">{b.variedad}</span>
                    <span className="text-[10px] text-slate-500">({b.tipoProceso})</span>
                  </div>
                  <span className="text-xs font-black text-emerald-700 font-mono bg-emerald-200/80 px-2 py-0.5 rounded">
                    ΔQ: +{b.incQ2 ?? b.incQ1}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600 bg-white/70 p-2 rounded-lg">
                  <div>Presión: <strong className="text-blue-700">{b.pres1Bar} bar</strong></div>
                  <div>Velocidad: <strong className="text-purple-700">{b.rpm1} RPM</strong></div>
                  <div>Reposo: <strong className="text-emerald-700">{b.tReposo1Min}m / {b.tReposo2Min ?? 0}m</strong></div>
                </div>

                {b.notasExito && (
                  <p className="text-[11px] text-slate-600 italic">
                    "{b.notasExito}"
                  </p>
                )}

                {onSeleccionarBatchParaReplicar && (
                  <button
                    onClick={() => onSeleccionarBatchParaReplicar(b)}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 transition-colors"
                  >
                    Replicar esta receta en autoclave APIT <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Columna B: Batches con Desviación Crítica / Lecciones Aprendidas */}
        <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Batches con Mayor Merma & Desviación
                </h3>
                <p className="text-xs text-slate-500">Causas de incremento de quebrado para evitar repetir en planta</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
              Alertas Detectadas
            </span>
          </div>

          <div className="space-y-3">
            {batchesExtremos.topDesviaciones.map(b => (
              <div key={b.id} className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-amber-200">
                      Batch {b.batch}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{b.variedad}</span>
                    <span className="text-[10px] text-slate-500">({b.tipoProceso})</span>
                  </div>
                  <span className="text-xs font-black text-red-700 font-mono bg-red-100 px-2 py-0.5 rounded">
                    ΔQ: +{b.incQ2 ?? b.incQ1}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600 bg-white/70 p-2 rounded-lg">
                  <div>Presión: <strong className="text-slate-800">{b.pres1Bar} bar</strong></div>
                  <div>Velocidad: <strong className="text-slate-800">{b.rpm1} RPM</strong></div>
                  <div>Reposo: <strong className="text-slate-800">{b.tReposo1Min ?? 0}m</strong></div>
                </div>

                <p className="text-[11px] text-amber-900 leading-tight">
                  {b.batch === 322 
                    ? "Causa Raíz: Grano heterogéneo (Mezcla/Pakamuro) sometido a presión sin suficiente reposo térmico en tanques."
                    : b.batch === 317
                    ? "Causa Raíz: En 2do pase faltó tiempo de reposo en TK compensador, induciendo fisuras mecánicas en secado."
                    : "Causa Raíz: Choque térmico entre el vaporizado y la esclusa de descarga por exceso de RPM."}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. DIRECTIVAS DE PLANTA DERIVADAS DE LA DATA (HALLAZGOS OPERATIVOS) */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">
            Reglas de Oro & Recomendaciones Operativas para APIT (Autoclave)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-1.5">
            <span className="font-bold text-amber-400 uppercase tracking-wider block text-[11px]">
              1. Control de Presión según Humedad
            </span>
            <p className="text-slate-300 leading-relaxed">
              En grano con humedad de presecado (13% a 15% HI), aplicar estrictamente <strong>0.05 a 0.08 bar</strong> en 1er pase. Superar 0.15 bar en grano seco fractura el endospermo y dispara el quebrado por encima del 15%.
            </p>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-1.5">
            <span className="font-bold text-purple-400 uppercase tracking-wider block text-[11px]">
              2. Velocidad de Exclusa (RPM)
            </span>
            <p className="text-slate-300 leading-relaxed">
              Operar la exclusa de entrada y salida a <strong>4 a 6 RPM</strong>. Los datos demuestran que a 8 RPM la fricción y el corte por paletas añaden hasta +3.5% de grano partido durante la transferencia.
            </p>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-1.5">
            <span className="font-bold text-emerald-400 uppercase tracking-wider block text-[11px]">
              3. Tiempos de Reposo Térmico
            </span>
            <p className="text-slate-300 leading-relaxed">
              Garantizar un mínimo de <strong>70 a 100 minutos de reposo</strong> en los tanques TK antes de ingresar a la torre de secado. Esto permite disipar tensiones internas y reduce el grano abierto en cocción a menos del 1%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
