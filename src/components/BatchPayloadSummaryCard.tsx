import React from "react";
import { BatchPayloadSummary } from "../utils/batchCalculator";
import { 
  Scale, 
  Package, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Droplet, 
  Gauge, 
  Users, 
  Wheat, 
  TrendingUp,
  ShieldCheck,
  AlertOctagon,
  Sparkles
} from "lucide-react";

interface BatchPayloadSummaryCardProps {
  summary: BatchPayloadSummary;
  title?: string;
  subtitle?: string;
  showBreakdown?: boolean;
  compact?: boolean;
  onAutoFillWeight?: () => void;
}

export const BatchPayloadSummaryCard: React.FC<BatchPayloadSummaryCardProps> = ({
  summary,
  title = "Resumen Dinámico de Carga Útil del Batch",
  subtitle = "Cálculo automático de masa total, ocupación de autoclave y balance de humedad",
  showBreakdown = true,
  compact = false,
  onAutoFillWeight
}) => {
  const {
    totalSacos,
    totalPesoKg,
    totalPesoTn,
    capacidadAutoclaveTn,
    porcentajeCarga,
    capacidadRemanenteTn,
    capacidadRemanenteKg,
    estadoCarga,
    humedadPromedioPonderada,
    variedades,
    clientes,
    lotesCount,
    esSobrecarga,
    recomendacionOperativa
  } = summary;

  // Percentage for progress bar (capped visually at 100% for the primary bar width)
  const barWidth = Math.min(porcentajeCarga, 100);

  // Status Styling
  const getStatusBadge = () => {
    switch (estadoCarga) {
      case "SOBRECARGA":
        return {
          bg: "bg-rose-950/90 text-rose-300 border-rose-700/80 shadow-rose-950/50",
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400 animate-pulse" />,
          label: "SOBRECARGA CRÍTICA (>100%)",
          color: "text-rose-400"
        };
      case "OPTIMO":
        return {
          bg: "bg-emerald-950/90 text-emerald-300 border-emerald-700/80 shadow-emerald-950/50",
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
          label: "CARGA ÓPTIMA (85% - 100%)",
          color: "text-emerald-400"
        };
      case "SUBUTILIZADO":
        return {
          bg: "bg-amber-950/90 text-amber-300 border-amber-700/80 shadow-amber-950/50",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
          label: "SUBUTILIZADO / CON HOLGURA (<85%)",
          color: "text-amber-400"
        };
      default:
        return {
          bg: "bg-slate-800 text-slate-400 border-slate-700",
          icon: <Scale className="w-3.5 h-3.5 text-slate-500" />,
          label: "SIN CARGA ASIGNADA",
          color: "text-slate-400"
        };
    }
  };

  const status = getStatusBadge();

  return (
    <div 
      id="batch-dynamic-payload-card"
      className={`rounded-xl border transition-all duration-300 ${
        esSobrecarga
          ? "bg-gradient-to-b from-slate-900 via-rose-950/20 to-slate-900 border-rose-500/60 shadow-lg shadow-rose-950/30"
          : estadoCarga === "OPTIMO"
          ? "bg-gradient-to-b from-slate-900 via-emerald-950/15 to-slate-900 border-emerald-500/40 shadow-md"
          : "bg-slate-900/95 border-slate-750 shadow-md"
      } ${compact ? "p-3.5 space-y-3" : "p-5 space-y-4"}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-750 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${
            esSobrecarga ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
          }`}>
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
              {title}
              <span className="text-[11px] font-normal text-slate-400 font-mono">
                ({lotesCount} {lotesCount === 1 ? "lote asignado" : "lotes asignados"})
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1.5 shadow-sm ${status.bg}`}>
            {status.icon}
            <span>{status.label}</span>
          </span>

          {onAutoFillWeight && (
            <button
              type="button"
              onClick={onAutoFillWeight}
              className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Sincronizar campo Toneladas con el cálculo automático"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              Sincronizar TN
            </button>
          )}
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Weight TN */}
        <div className="bg-slate-850/90 rounded-lg p-3 border border-slate-750/80 relative overflow-hidden">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Scale className="w-3 h-3 text-cyan-400" />
            Peso Total (TN)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-300 font-mono tracking-tight">
              {totalPesoTn.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-bold">TN</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {totalPesoKg.toLocaleString()} kg netos
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 pointer-events-none">
            <Scale className="w-16 h-16 text-cyan-400" />
          </div>
        </div>

        {/* Total Sacos */}
        <div className="bg-slate-850/90 rounded-lg p-3 border border-slate-750/80">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Package className="w-3 h-3 text-amber-400" />
            Total Sacos
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono tracking-tight">
              {totalSacos.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-bold">sacos</span>
          </div>
          <div className="text-[11px] text-amber-400/90 font-sans mt-0.5">
            {lotesCount > 0 ? `~${(totalPesoKg / (totalSacos || 1)).toFixed(1)} kg / saco` : "0 sacos"}
          </div>
        </div>

        {/* Capacidad & Utilización */}
        <div className="bg-slate-850/90 rounded-lg p-3 border border-slate-750/80">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            Ocupación Autoclave
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${
              esSobrecarga ? "text-rose-400" : estadoCarga === "OPTIMO" ? "text-emerald-300" : "text-amber-300"
            }`}>
              {porcentajeCarga}%
            </span>
            <span className="text-xs text-slate-400 font-bold font-mono">/ {capacidadAutoclaveTn} TN</span>
          </div>
          <div className="text-[11px] font-mono mt-0.5 font-semibold">
            {esSobrecarga ? (
              <span className="text-rose-400">⚠️ +{Math.abs(capacidadRemanenteTn)} TN exceso</span>
            ) : (
              <span className="text-slate-400">{capacidadRemanenteTn} TN disponibles</span>
            )}
          </div>
        </div>

        {/* Humedad Ponderada */}
        <div className="bg-slate-850/90 rounded-lg p-3 border border-slate-750/80">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Droplet className="w-3 h-3 text-blue-400" />
            Humedad Ponderada
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-300 font-mono tracking-tight">
              {humedadPromedioPonderada > 0 ? `${humedadPromedioPonderada}%` : "—"}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-sans mt-0.5 truncate">
            {humedadPromedioPonderada >= 20 ? "🚨 Humedad Crítica" : humedadPromedioPonderada >= 16 ? "⚠️ Humedad Alta" : "✓ Homogénea"}
          </div>
        </div>
      </div>

      {/* Dynamic Progress Bar: Payload vs Autoclave Capacity */}
      <div className="space-y-1.5 bg-slate-850 p-3 rounded-lg border border-slate-750">
        <div className="flex justify-between text-xs font-mono font-semibold">
          <span className="text-slate-300 flex items-center gap-1.5 font-sans">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            Nivel de Llenado de Carga Útil:
          </span>
          <span className={esSobrecarga ? "text-rose-400 font-bold" : "text-cyan-300 font-bold"}>
            {totalPesoTn.toFixed(2)} TN de {capacidadAutoclaveTn.toFixed(1)} TN ({porcentajeCarga}%)
          </span>
        </div>

        {/* Bar Container with 100% capacity reference marker */}
        <div className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              esSobrecarga
                ? "bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 animate-pulse"
                : estadoCarga === "OPTIMO"
                ? "bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-500"
                : "bg-gradient-to-r from-blue-500 to-amber-500"
            }`}
            style={{ width: `${Math.min(porcentajeCarga, 100)}%` }}
          />
        </div>

        {/* Helper Markers & Explanations */}
        <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
          <span>0 TN (0%)</span>
          <span className="text-amber-400/90 font-sans">Mínimo sugerido: 85% ({ (capacidadAutoclaveTn * 0.85).toFixed(1) } TN)</span>
          <span className="text-slate-200 font-bold">Nominal: 100% ({ capacidadAutoclaveTn } TN)</span>
        </div>
      </div>

      {/* Operational Recommendation Box */}
      <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
        esSobrecarga
          ? "bg-rose-950/40 border-rose-800/80 text-rose-200"
          : estadoCarga === "OPTIMO"
          ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
          : "bg-slate-850/80 border-slate-750 text-slate-300"
      }`}>
        {esSobrecarga ? (
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        ) : estadoCarga === "OPTIMO" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="leading-relaxed">
          <strong className="font-semibold mr-1">Criterio Técnico:</strong>
          {recomendacionOperativa}
        </div>
      </div>

      {/* Variedades and Clientes Breakdown (If requested and present) */}
      {showBreakdown && (variedades.length > 0 || clientes.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-800 text-xs">
          {/* Variedades Breakdown */}
          {variedades.length > 0 && (
            <div className="bg-slate-850/60 rounded-lg p-2.5 border border-slate-750/60 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Wheat className="w-3 h-3 text-amber-400" />
                Composición por Variedad
              </div>
              <div className="space-y-1.5">
                {variedades.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-200 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate">{v.variedad}</span>
                    </div>
                    <div className="font-mono text-slate-400 shrink-0 flex items-center gap-1.5">
                      <strong className="text-white font-bold">{v.pesoTn} TN</strong>
                      <span className="text-[10px] text-amber-300">({v.porcentaje}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clientes Breakdown */}
          {clientes.length > 0 && (
            <div className="bg-slate-850/60 rounded-lg p-2.5 border border-slate-750/60 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3 text-cyan-400" />
                Distribución por Cliente
              </div>
              <div className="space-y-1.5">
                {clientes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-200 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span className="truncate">{c.cliente}</span>
                    </div>
                    <div className="font-mono text-slate-400 shrink-0 flex items-center gap-1.5">
                      <strong className="text-white font-bold">{c.pesoTn} TN</strong>
                      <span className="text-[10px] text-cyan-300">({c.porcentaje}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
