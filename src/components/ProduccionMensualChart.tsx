import React, { useState, useMemo } from "react";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  BarChart,
  Bar, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell,
  ReferenceLine 
} from "recharts";
import { 
  BatchVaporizado, 
  Lote, 
  ControlVaporizado, 
  Equipo, 
  BatchLote 
} from "../types";
import { 
  BarChart3, 
  Filter, 
  Layers, 
  TrendingUp, 
  Calendar, 
  Package, 
  Factory, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight,
  Flame,
  ArrowUpRight,
  Info,
  FileSpreadsheet,
  Lock
} from "lucide-react";

interface ProduccionMensualChartProps {
  batches?: BatchVaporizado[];
  lotes?: Lote[];
  controles?: ControlVaporizado[];
  equipos?: Equipo[];
  batchLotes?: BatchLote[];
  onNavigate?: (tab: string, filterId?: string) => void;
  onOpenInformeMensual?: () => void;
  canExportInformeMensual?: boolean;
}

interface MonthlyDataPoint {
  mesKey: string; // "2026-01"
  mesLabel: string; // "Ene 2026"
  mesNombre: string; // "Enero"
  mesCorto: string; // "Ene"
  year: number;
  monthIndex: number; // 0-11
  totalTn: number;
  totalKg: number;
  totalSacos: number;
  totalBatches: number;
  totalLotes: number;
  humedadPromedio: number;
  equiposMap: Record<string, { tn: number; batches: number; sacos: number }>;
  batchesList: string[];
}

// Preset baseline equipment list in case no dynamic equipment is registered
const DEFAULT_EQUIPOS_LIST = [
  "APIT",
  "GINSAC"
];

// Color palette for equipments
const EQUIPO_COLORS: Record<string, string> = {
  "APIT": "#f59e0b", // Amber
  "GINSAC": "#06b6d4", // Cyan
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

export const ProduccionMensualChart: React.FC<ProduccionMensualChartProps> = ({
  batches = [],
  lotes = [],
  controles = [],
  equipos = [],
  batchLotes = [],
  onNavigate,
  onOpenInformeMensual,
  canExportInformeMensual = false
}) => {
  // State for filters
  const [selectedEquipo, setSelectedEquipo] = useState<string>("TODOS");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [metricView, setMetricView] = useState<"TN" | "SACOS" | "LOTES">("TN");
  const [chartType, setChartType] = useState<"COMPOSED" | "BARS" | "AREA">("COMPOSED");
  const [showTableDetails, setShowTableDetails] = useState<boolean>(false);

  // Extract all unique equipment names (Strictly restricted to APIT and GINSAC)
  const availableEquipos = useMemo(() => {
    return ["APIT", "GINSAC"];
  }, []);

  // Robust date parser supporting DD/MM/YYYY, YYYY-MM-DD, timestamps, and ISO strings
  const parseDateRobust = (rawDate?: any): Date | null => {
    if (!rawDate) return null;
    if (typeof rawDate === "number") {
      if (rawDate > 1000000000000) return new Date(rawDate);
      if (rawDate > 30000 && rawDate < 60000) {
        return new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      }
    }
    const s = String(rawDate).trim();
    if (!s) return null;
    const latinMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (latinMatch) {
      const d = parseInt(latinMatch[1], 10);
      const m = parseInt(latinMatch[2], 10) - 1;
      const y = parseInt(latinMatch[3], 10);
      return new Date(y, m, d);
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Generate 12-month series for the selected year and aggregate strictly real data from lotes / batches / controles
  const monthlyData = useMemo(() => {
    const targetYear = parseInt(selectedYear, 10) || 2026;

    // Initialize 12 months array with ZERO data (no mock / baseline values)
    const months: MonthlyDataPoint[] = Array.from({ length: 12 }, (_, i) => {
      const monthKey = `${targetYear}-${String(i + 1).padStart(2, "0")}`;
      return {
        mesKey: monthKey,
        mesLabel: `${MONTH_SHORT[i]} ${targetYear}`,
        mesNombre: MONTH_NAMES[i],
        mesCorto: MONTH_SHORT[i],
        year: targetYear,
        monthIndex: i,
        totalTn: 0,
        totalKg: 0,
        totalSacos: 0,
        totalBatches: 0,
        totalLotes: 0,
        humedadPromedio: 0,
        equiposMap: {
          "APIT": { tn: 0, batches: 0, sacos: 0 },
          "GINSAC": { tn: 0, batches: 0, sacos: 0 }
        },
        batchesList: []
      };
    });

    let hasBatchData = false;

    // 1. Incorporate real active Batches from the application state
    batches.forEach((b) => {
      const rawDate = b.FECHA_PROGRAMADA || b.FECHA_INICIO || b.FECHA_FIN || b.FECHA_REGISTRO || "";
      const batchDate = parseDateRobust(rawDate);

      if (batchDate && batchDate.getFullYear() === targetYear) {
        const mIdx = batchDate.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          hasBatchData = true;
          const m = months[mIdx];
          const tn = b.TON_PROCESADAS || b.TON_PROGRAMADAS || (b.PESO_TOTAL_KG ? b.PESO_TOTAL_KG / 1000 : 0);
          const kg = b.PESO_TOTAL_KG || tn * 1000;
          const sacos = b.TOTAL_SACOS || Math.round(kg / 50);
          const rawEq = String(b.EQUIPO || b.EQUIPO_ASIGNADO || "");
          const eq = rawEq.includes("GINSAC") || rawEq.includes("02") || rawEq.toLowerCase().includes("buhler") ? "GINSAC" : "APIT";

          m.totalTn = Number((m.totalTn + tn).toFixed(2));
          m.totalKg += kg;
          m.totalSacos += sacos;
          m.totalBatches += 1;
          const lotesCount = (b.LOTES_UNION && b.LOTES_UNION.length > 0) ? b.LOTES_UNION.length : (b.LOTE_ID ? 1 : 0);
          m.totalLotes += lotesCount;
          if (b.BATCH_ID || b.CORRELATIVO) {
            m.batchesList.push(b.BATCH_ID || b.CORRELATIVO!);
          }

          if (!m.equiposMap[eq]) {
            m.equiposMap[eq] = { tn: 0, batches: 0, sacos: 0 };
          }
          m.equiposMap[eq].tn = Number((m.equiposMap[eq].tn + tn).toFixed(2));
          m.equiposMap[eq].batches += 1;
          m.equiposMap[eq].sacos += sacos;
        }
      }
    });

    // 2. Incorporate real active Controles from application state if batch wasn't already registered
    controles.forEach((c) => {
      const rawDate = c.FECHA_HORA_INICIO || c.FECHA_HORA_FIN || "";
      const d = parseDateRobust(rawDate);
      if (d && d.getFullYear() === targetYear) {
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          const m = months[mIdx];
          const tn = c.TON_PROCESADAS || c.carga?.cantidad_tn || 0;
          if (tn > 0 && !m.batchesList.includes(c.BATCH_ID)) {
            hasBatchData = true;
            m.totalTn = Number((m.totalTn + tn).toFixed(2));
            m.totalKg += tn * 1000;
            m.totalSacos += Math.round((tn * 1000) / 50);
            m.totalBatches += 1;
            m.batchesList.push(c.BATCH_ID);

            const rawEq = String(c.carga?.equipo || "");
            const eq = rawEq.includes("GINSAC") || rawEq.includes("02") || rawEq.toLowerCase().includes("buhler") ? "GINSAC" : "APIT";
            if (!m.equiposMap[eq]) {
              m.equiposMap[eq] = { tn: 0, batches: 0, sacos: 0 };
            }
            m.equiposMap[eq].tn = Number((m.equiposMap[eq].tn + tn).toFixed(2));
            m.equiposMap[eq].batches += 1;
            m.equiposMap[eq].sacos += Math.round((tn * 1000) / 50);
          }
        }
      }
    });

    // 3. If no batches or controles exist yet, but lotes HAVE been uploaded:
    // Aggregate uploaded lotes by intake month so volume reflects the real uploaded inventory
    if (!hasBatchData && lotes.length > 0) {
      lotes.forEach((l) => {
        const rawDate = l.FECHA_INGRESO || "";
        const loteDate = parseDateRobust(rawDate);
        if (loteDate && loteDate.getFullYear() === targetYear) {
          const mIdx = loteDate.getMonth();
          if (mIdx >= 0 && mIdx < 12) {
            const m = months[mIdx];
            const tn = l.PESO_KG ? l.PESO_KG / 1000 : (l.SACOS ? (l.SACOS * 50) / 1000 : 0);
            const kg = l.PESO_KG || (tn * 1000);
            const sacos = l.SACOS || Math.round(kg / 50);
            const eq = "APIT"; // Default línea autoclave

            m.totalTn = Number((m.totalTn + tn).toFixed(2));
            m.totalKg += kg;
            m.totalSacos += sacos;
            m.totalLotes += 1;

            if (!m.equiposMap[eq]) {
              m.equiposMap[eq] = { tn: 0, batches: 0, sacos: 0 };
            }
            m.equiposMap[eq].tn = Number((m.equiposMap[eq].tn + tn).toFixed(2));
            m.equiposMap[eq].sacos += sacos;
          }
        }
      });
    }

    return months;
  }, [batches, controles, lotes, selectedYear]);

  // Filter and transform data based on the selected Equipment
  const chartData = useMemo(() => {
    return monthlyData.map((m) => {
      let tnVal = m.totalTn;
      let sacosVal = m.totalSacos;
      let batchesVal = m.totalBatches;
      let lotesVal = m.totalLotes;

      if (selectedEquipo !== "TODOS") {
        const eqData = m.equiposMap[selectedEquipo] || { tn: 0, batches: 0, sacos: 0 };
        tnVal = eqData.tn;
        sacosVal = eqData.sacos;
        batchesVal = eqData.batches;
        lotesVal = eqData.batches;
      }

      return {
        mes: m.mesCorto,
        mesCompleto: m.mesNombre,
        mesLabel: m.mesLabel,
        volumenTn: Number(tnVal.toFixed(1)),
        sacos: sacosVal,
        batches: batchesVal,
        lotes: lotesVal,
        equiposActivos: Object.keys(m.equiposMap).length,
        // Individual equipment values for stacked view
        apit: m.equiposMap["APIT"]?.tn || 0,
        ginsac: m.equiposMap["GINSAC"]?.tn || 0,
      };
    });
  }, [monthlyData, selectedEquipo]);

  // Aggregate KPI Calculations for summary badges
  const kpis = useMemo(() => {
    const totalTn = chartData.reduce((acc, d) => acc + d.volumenTn, 0);
    const totalSacos = chartData.reduce((acc, d) => acc + d.sacos, 0);
    const totalBatches = chartData.reduce((acc, d) => acc + d.batches, 0);
    const totalLotes = chartData.reduce((acc, d) => acc + d.lotes, 0);
    
    // Average only over months with registered volume
    const monthsWithData = chartData.filter(d => d.volumenTn > 0);
    const avgMensualTn = monthsWithData.length > 0 ? totalTn / monthsWithData.length : 0;

    // Find peak month (only if real volume > 0)
    let maxMonth: (typeof chartData)[0] | null = null;
    if (totalTn > 0) {
      chartData.forEach((d) => {
        if (!maxMonth || d.volumenTn > maxMonth.volumenTn) {
          maxMonth = d;
        }
      });
    }

    return {
      totalTn: Number(totalTn.toFixed(1)),
      totalSacos,
      totalBatches,
      totalLotes,
      avgMensualTn: Number(avgMensualTn.toFixed(1)),
      mesPico: (maxMonth && maxMonth.volumenTn > 0) ? `${maxMonth.mesCompleto} (${maxMonth.volumenTn} TN)` : "Sin registros",
      eficienciaEstimada: totalTn > 0 ? "100%" : "-"
    };
  }, [chartData]);

  // Primary Color for current filter
  const activeColor = selectedEquipo === "TODOS" 
    ? "#f59e0b" 
    : EQUIPO_COLORS[selectedEquipo] || "#06b6d4";

  return (
    <div id="section-produccion-mensual-chart" className="bg-slate-850 border border-slate-750 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-750 pb-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Factory className="w-4 h-4 text-amber-400" />
            <span>Volumen de Producción Mensual • Vaporizado & Secado</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Rendimiento de Producción ({selectedYear})</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold border border-amber-500/30">
              {selectedEquipo === "TODOS" ? "Todo el Secado (Planta)" : selectedEquipo === "GINSAC" ? "Secado en GINSAC" : "Secado en APIT"}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Todo el vaporizado se realiza en autoclave <strong className="text-amber-300">APIT</strong>. El secado posterior se procesa entre las líneas de <strong className="text-amber-300">APIT</strong> y <strong className="text-cyan-300">GINSAC</strong>. Filtra por Secado en APIT o Secado en GINSAC para evaluar la carga de secado y volumen.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Equipment / Secado Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 rounded-xl px-2.5 py-1.5 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <label htmlFor="filter-equipo-planta" className="text-[11px] text-slate-400 font-bold uppercase">Secado:</label>
            <select
              id="filter-equipo-planta"
              aria-label="Filtrar producción por línea de secado"
              value={selectedEquipo}
              onChange={(e) => setSelectedEquipo(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer border-none pr-1"
            >
              <option value="TODOS" className="bg-slate-900 text-slate-100">🏭 Todo el Secado (Planta Completa)</option>
              <option value="APIT" className="bg-slate-900 text-slate-100">♨️ Secado en APIT</option>
              <option value="GINSAC" className="bg-slate-900 text-slate-100">♨️ Secado en GINSAC</option>
            </select>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-700">
            <button
              id="btn-metric-tn"
              onClick={() => setMetricView("TN")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                metricView === "TN" 
                  ? "bg-amber-500 text-slate-950 shadow" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Toneladas (TN)
            </button>
            <button
              id="btn-metric-sacos"
              onClick={() => setMetricView("SACOS")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                metricView === "SACOS" 
                  ? "bg-amber-500 text-slate-950 shadow" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sacos (50kg)
            </button>
            <button
              id="btn-metric-lotes"
              onClick={() => setMetricView("LOTES")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                metricView === "LOTES" 
                  ? "bg-amber-500 text-slate-950 shadow" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              N° Batches
            </button>
          </div>

          {/* Year Filter */}
          <select
            id="filter-year-chart"
            aria-label="Seleccionar año de producción"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="2026">Año 2026</option>
            <option value="2025">Año 2025</option>
          </select>

          {/* Chart Style Toggle */}
          <div className="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-700">
            <button
              id="btn-chart-composed"
              onClick={() => setChartType("COMPOSED")}
              title="Gráfico Mixto (Barras + Tendencia)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                chartType === "COMPOSED" ? "bg-slate-750 text-amber-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-chart-area"
              onClick={() => setChartType("AREA")}
              title="Gráfico de Área Suave"
              className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                chartType === "AREA" ? "bg-slate-750 text-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {onOpenInformeMensual && (
            <button
              id="btn-exportar-informe-mensual-chart"
              onClick={onOpenInformeMensual}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border shadow-md transition-all cursor-pointer ${
                canExportInformeMensual
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400"
                  : "bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40"
              }`}
              title="Exportar Informe Mensual Completo de Producción (Acceso exclusivo Jefe de Vaporizado)"
            >
              {canExportInformeMensual ? (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Exportar Informe Mensual</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Producido */}
        <div className="bg-slate-900/80 border border-slate-750 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Total Volumen ({selectedYear})</span>
            <Factory className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{kpis.totalTn.toLocaleString()}</span>
            <span className="text-xs font-bold text-amber-400">TN</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Equivalente a <strong className="text-slate-200">{kpis.totalSacos.toLocaleString()}</strong> sacos
          </div>
        </div>

        {/* Promedio Mensual */}
        <div className="bg-slate-900/80 border border-slate-750 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Promedio Mensual</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">{kpis.avgMensualTn.toLocaleString()}</span>
            <span className="text-xs font-bold text-cyan-400">TN/mes</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Ritmo promedio de molienda
          </div>
        </div>

        {/* Mes Pico */}
        <div className="bg-slate-900/80 border border-slate-750 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Mes Pico de Mayor Flujo</span>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </span>
          <div className="mt-1.5">
            <span className="text-base sm:text-lg font-black text-orange-400">{kpis.mesPico}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">
            {kpis.totalTn > 0 ? "✓ Capacidad plena alcanzada" : "En espera de datos de lotes"}
          </div>
        </div>

        {/* Total Batches / Lotes */}
        <div className="bg-slate-900/80 border border-slate-750 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Total Batches Procesados</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{kpis.totalBatches}</span>
            <span className="text-xs font-bold text-emerald-300">batches</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            ~{kpis.totalLotes} lotes vinculados
          </div>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="bg-slate-900/90 border border-slate-750 rounded-xl p-3 sm:p-4 pt-5">
        {kpis.totalTn === 0 && kpis.totalBatches === 0 && kpis.totalLotes === 0 ? (
          <div className="h-[320px] w-full flex flex-col items-center justify-center p-6 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-750">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <Factory className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">
              Sin datos de producción para el año {selectedYear}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Aún no se han subido lotes ni registrado batches de producción. Las barras y volúmenes mensuales se generarán automáticamente a partir de los lotes subidos al sistema.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate("lotes")}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition-colors shadow"
              >
                <Package className="w-4 h-4" />
                <span>Ir a Recepción de Lotes</span>
              </button>
            )}
          </div>
        ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "AREA" ? (
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolumenArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={activeColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} opacity={0.9} />
                <XAxis 
                  dataKey="mes" 
                  stroke="#475569" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickFormatter={(val) => metricView === "TN" ? `${val} TN` : metricView === "SACOS" ? `${val}` : `${val} B`}
                />
                <Tooltip content={<CustomTooltip metricView={metricView} selectedEquipo={selectedEquipo} />} />
                <Area 
                  type="monotone" 
                  dataKey={metricView === "TN" ? "volumenTn" : metricView === "SACOS" ? "sacos" : "batches"} 
                  name={metricView === "TN" ? "Volumen (TN)" : metricView === "SACOS" ? "Sacos (50kg)" : "Batches"}
                  stroke={activeColor} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVolumenArea)" 
                />
                <Line 
                  type="monotone" 
                  dataKey={metricView === "TN" ? "volumenTn" : metricView === "SACOS" ? "sacos" : "batches"} 
                  stroke={activeColor} 
                  strokeWidth={1.5}
                  dot={{ r: 4, fill: activeColor, stroke: "#ffffff", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "#ffffff", stroke: activeColor, strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeColor} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={activeColor} stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} opacity={0.9} />
                <XAxis 
                  dataKey="mes" 
                  stroke="#475569" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#475569" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickFormatter={(val) => metricView === "TN" ? `${val} TN` : metricView === "SACOS" ? `${val}` : `${val} B`}
                />
                {chartType === "COMPOSED" && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#0891b2" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: "#0891b2", opacity: 0.5 }}
                    tickFormatter={(val) => `${val} B`}
                  />
                )}
                <Tooltip content={<CustomTooltip metricView={metricView} selectedEquipo={selectedEquipo} />} />
                <Bar 
                  yAxisId="left"
                  dataKey={metricView === "TN" ? "volumenTn" : metricView === "SACOS" ? "sacos" : "batches"} 
                  name={metricView === "TN" ? "Volumen (TN)" : metricView === "SACOS" ? "Sacos" : "Batches"}
                  fill="url(#barGradientPrimary)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={45}
                >
                  {chartData.map((entry, index) => {
                    const isMax = entry.volumenTn === Math.max(...chartData.map(d => d.volumenTn));
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isMax ? "#ea580c" : activeColor} 
                        fillOpacity={isMax ? 1 : 0.88}
                      />
                    );
                  })}
                </Bar>
                {chartType === "COMPOSED" && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="batches" 
                    name="N° Batches"
                    stroke="#0891b2" 
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#0891b2", stroke: "#ffffff", strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: "#06b6d4", stroke: "#ffffff" }}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
        )}

        {/* Dynamic Legend / Footnote */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
              {metricView === "TN" ? "Volumen Procesado (TN)" : metricView === "SACOS" ? "Sacos Procesados (50kg)" : "Batches Totales"}
            </span>
            {chartType === "COMPOSED" && (
              <span className="flex items-center gap-1.5 font-medium text-cyan-400">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span>
                Curva de Frecuencia de Batches
              </span>
            )}
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span>
              Mes con Mayor Carga Operativa
            </span>
          </div>

          <button
            id="btn-toggle-monthly-table"
            onClick={() => setShowTableDetails(!showTableDetails)}
            className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>{showTableDetails ? "Ocultar Tabla de Detalle" : "Ver Desglose Mensual Detallado"}</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showTableDetails ? "rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      {/* Detailed Monthly Breakdown Table (Expandable) */}
      {showTableDetails && (
        <div className="bg-slate-900 border border-slate-750 rounded-xl overflow-hidden shadow-inner transition-all animate-fadeIn">
          <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-750 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Tabla de Producción Mensual • Año {selectedYear}
            </span>
            <span className="text-[11px] text-slate-400">
              Filtro: <strong className="text-amber-300">{selectedEquipo === "TODOS" ? "Todo el Secado (Planta Completa)" : selectedEquipo === "GINSAC" ? "Secado en GINSAC" : "Secado en APIT"}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Mes</th>
                  <th className="py-2.5 px-3 text-right">Volumen (TN)</th>
                  <th className="py-2.5 px-3 text-right">Sacos (50 kg)</th>
                  <th className="py-2.5 px-3 text-center">N° Batches</th>
                  <th className="py-2.5 px-3 text-center">N° Lotes</th>
                  <th className="py-2.5 px-3 text-right">% del Año</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                {chartData.map((row) => {
                  const pct = kpis.totalTn > 0 ? ((row.volumenTn / kpis.totalTn) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={row.mes} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-sans font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        {row.mesCompleto}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-300">
                        {row.volumenTn.toLocaleString()} TN
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {row.sacos.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold">
                          {row.batches} B
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        {row.lotes}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-[11px] text-slate-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate("batches")}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-amber-400 text-[10px] font-bold border border-slate-700 transition-colors cursor-pointer"
                          >
                            Ver Batches →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950 font-bold text-white border-t border-slate-700 font-mono">
                <tr>
                  <td className="py-3 px-3 font-sans">Total Anual</td>
                  <td className="py-3 px-3 text-right text-amber-400 font-black">{kpis.totalTn.toLocaleString()} TN</td>
                  <td className="py-3 px-3 text-right">{kpis.totalSacos.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center text-cyan-400">{kpis.totalBatches} B</td>
                  <td className="py-3 px-3 text-center">{kpis.totalLotes}</td>
                  <td className="py-3 px-3 text-right">100.0%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom Tooltip component with dark industrial aesthetic
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  metricView: "TN" | "SACOS" | "LOTES";
  selectedEquipo: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  metricView,
  selectedEquipo
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-[210px] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-white text-sm">{data.mesCompleto} {data.mesLabel?.split(" ")[1] || "2026"}</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
            {selectedEquipo === "TODOS" ? "Planta Completa" : (selectedEquipo === "GINSAC" ? "Secado GINSAC" : "Secado APIT")}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-slate-300">
            <span>Volumen Secado:</span>
            <strong className="text-amber-400 font-mono text-sm">{data.volumenTn.toLocaleString()} TN</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Sacos Equivalentes:</span>
            <strong className="text-slate-100 font-mono">{data.sacos.toLocaleString()} sacos</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Batches Ejecutados:</span>
            <strong className="text-cyan-400 font-mono">{data.batches} batches</strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Lotes Vinculados:</span>
            <strong className="text-emerald-400 font-mono">{data.lotes} lotes</strong>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5">
          <div>Vaporizado: <strong className="text-white">Autoclave APIT</strong></div>
          <div>Línea de Secado: <strong className="text-amber-300">{selectedEquipo === "TODOS" ? "Líneas APIT / GINSAC" : (selectedEquipo === "GINSAC" ? "Secado en GINSAC" : "Secado en APIT")}</strong></div>
        </div>
      </div>
    );
  }
  return null;
};
