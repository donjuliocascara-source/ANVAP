import React from "react";
import { PerfilSecadoPlant } from "../types";
import { TrendingDown, Flame, Thermometer, Wind, CheckCircle } from "lucide-react";

interface GraficaSecadoMonitoreoProps {
  perfiles: PerfilSecadoPlant[];
  batchCorrelativo?: string;
  variedad?: string;
}

export const GraficaSecadoMonitoreo: React.FC<GraficaSecadoMonitoreoProps> = ({
  perfiles = [],
  batchCorrelativo = "425",
  variedad = "VALOR"
}) => {
  const validPerfiles = perfiles.filter(
    (p) => p.humedad !== undefined && p.humedad !== "" && p.humedad !== "FIN" && !isNaN(Number(p.humedad))
  );

  const dataPoints = validPerfiles.map((p) => ({
    perfil: p.perfilIndex,
    hora: p.horaInicio || `P${p.perfilIndex}`,
    humedad: Number(p.humedad),
    tempProgramada: p.tempProgramada || 0,
    tempReal: p.tempReal || 0,
    tempGrano: p.tempGrano || 0,
    a1: p.a1 || 0,
    a2: p.a2 || 0
  }));

  const initialMoisture = dataPoints.length > 0 ? dataPoints[0].humedad : 18.0;
  const currentMoisture = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].humedad : 12.0;
  const moistureDrop = (initialMoisture - currentMoisture).toFixed(1);

  // SVG Chart dimensions
  const width = 800;
  const height = 280;
  const padding = { top: 30, right: 40, bottom: 40, left: 50 };

  const minH = 10;
  const maxH = 22;

  const getX = (idx: number, total: number) => {
    if (total <= 1) return padding.left + (width - padding.left - padding.right) / 2;
    return padding.left + (idx / (total - 1)) * (width - padding.left - padding.right);
  };

  const getYMoisture = (val: number) => {
    const clamped = Math.max(minH, Math.min(maxH, val));
    return padding.top + ((maxH - clamped) / (maxH - minH)) * (height - padding.top - padding.bottom);
  };

  const pointsString = dataPoints
    .map((d, i) => `${getX(i, dataPoints.length)},${getYMoisture(d.humedad)}`)
    .join(" ");

  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 space-y-6 shadow-xl text-white">
      {/* Header Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Curva de Secado Dinámica & Monitoreo Térmico</h3>
          </div>
          <p className="text-xs text-slate-400">
            Batch {batchCorrelativo} ({variedad}) — Evolución de humedad por perfiles horarios y régimen térmico
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Humedad Inicial</span>
            <span className="text-base font-black text-amber-400">{initialMoisture}%</span>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Humedad Final</span>
            <span className="text-base font-black text-emerald-400">{currentMoisture}%</span>
          </div>

          <div className="bg-slate-800/90 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-emerald-300 block uppercase font-bold">Δ Descenso</span>
            <span className="text-base font-black text-cyan-300">-{moistureDrop}%</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Moisture Curve Chart */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
              Curva de Humedad Real (% H vs Perfil / Tiempo)
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-emerald-400 font-bold">Meta Objetivo: 12.0% - 12.5%</span>
              <span className="text-slate-400">Total Perfiles Registrados: {dataPoints.length}</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Grid horizontal lines */}
            {[12, 14, 16, 18, 20].map((h) => {
              const y = getYMoisture(h);
              const isTarget = h === 12;
              return (
                <g key={h}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={isTarget ? "#10b981" : "#334155"}
                    strokeDasharray={isTarget ? "4 4" : undefined}
                    strokeWidth={isTarget ? 1.5 : 1}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    fill={isTarget ? "#34d399" : "#94a3b8"}
                    fontSize="10"
                    textAnchor="end"
                    fontWeight={isTarget ? "bold" : "normal"}
                  >
                    {h}%
                  </text>
                </g>
              );
            })}

            {/* Target Area Fill */}
            <rect
              x={padding.left}
              y={getYMoisture(12.5)}
              width={width - padding.left - padding.right}
              height={getYMoisture(12.0) - getYMoisture(12.5)}
              fill="#10b981"
              opacity="0.1"
            />

            {/* Gradient Line & Fill under curve */}
            <defs>
              <linearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {dataPoints.length > 1 && (
              <>
                <polygon
                  points={`${pointsString} ${getX(dataPoints.length - 1, dataPoints.length)},${height - padding.bottom} ${padding.left},${height - padding.bottom}`}
                  fill="url(#moistureGradient)"
                />
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  points={pointsString}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Data Point Nodes */}
            {dataPoints.map((d, i) => {
              const cx = getX(i, dataPoints.length);
              const cy = getYMoisture(d.humedad);
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="5" fill="#047857" stroke="#34d399" strokeWidth="2" />
                  <text
                    x={cx}
                    y={cy - 10}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {d.humedad}%
                  </text>
                  <text
                    x={cx}
                    y={height - padding.bottom + 16}
                    fill="#94a3b8"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    P{d.perfil}
                  </text>
                  {d.hora && (
                    <text
                      x={cx}
                      y={height - padding.bottom + 28}
                      fill="#64748b"
                      fontSize="8"
                      textAnchor="middle"
                    >
                      {d.hora}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Temperature & Burner Profile Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Thermal Balance */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
            <Flame className="w-4 h-4" />
            <span>Régimen de Quemadores (A1 / A2) & T° Programada</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-400">T° Entrada Inicial (Perfiles 0-4):</span>
              <span className="font-bold text-rose-300">75°C - 81°C (A1: 65° / A2: 75°-81°)</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-400">T° Meseta Media (Perfiles 5-8):</span>
              <span className="font-bold text-amber-300">79°C - 75°C (A1: 65° / A2: 75°)</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-400">T° Enfriamiento / Acabado (Perfiles 9-12):</span>
              <span className="font-bold text-emerald-300">73°C - 69°C (A1: 59° / A2: 69°)</span>
            </div>
          </div>
        </div>

        {/* Paddy Grain Equilibrium */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
            <Thermometer className="w-4 h-4" />
            <span>T° del Grano & T° Real en Cámara de Secado</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-400">T° Promedio Grano:</span>
              <span className="font-bold text-cyan-300">31.2°C (Gradiente seguro &lt; 35°C)</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-400">T° Real en Cámara:</span>
              <span className="font-bold text-white">28.4°C - 32.0°C</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
              <span className="text-slate-400">Prevención de Tizado / Trizado:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Control de estrés térmico óptimo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
