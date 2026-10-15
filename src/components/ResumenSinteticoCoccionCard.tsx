import React from "react";
import { ResultadoCoccionExterno } from "../types";
import { 
  Flame, 
  Package, 
  Droplets, 
  Clock, 
  Sparkles, 
  Scale, 
  CheckCircle2, 
  Gauge, 
  Layers,
  ThermometerSnowflake,
  ShieldCheck,
  Award
} from "lucide-react";

interface ResumenSinteticoCoccionCardProps {
  coccion?: Partial<ResultadoCoccionExterno> | null;
  className?: string;
  variant?: "dark" | "light" | "print";
  onEdit?: () => void;
  showTitle?: boolean;
}

export const ResumenSinteticoCoccionCard: React.FC<ResumenSinteticoCoccionCardProps> = ({
  coccion,
  className = "",
  variant = "dark",
  onEdit,
  showTitle = true
}) => {
  // Valores con defaults oficiales de la operación
  const tazasArroz = coccion?.tazasArroz ?? 3;
  const tazasAgua = coccion?.tazasAgua ?? "3 1/2";
  const tiempoCoccionMin = coccion?.tiempoCoccionMin ?? 30;

  const sabor = coccion?.sabor || coccion?.saborDescarga || "Neutro Característico";
  const desplazamientoSeg = coccion?.desplazamientoSeg ?? coccion?.desplazamientoDescarga ?? "15 seg";
  const granoQuebradoPct = coccion?.granoQuebradoOllaPct ?? coccion?.quebradoOllaDescarga ?? 18.0;
  const granoHinchadoPct = coccion?.granoHinchadoPct ?? coccion?.hinchadoDescarga ?? 8.6;
  const granoAbiertoPct = coccion?.granoAbiertoPct ?? coccion?.abiertoDescarga ?? 1.3;
  const texturaFrio = coccion?.texturaFrio || coccion?.texturaFrioDescarga || "Suave";

  // Envase Proyectado (se evalúa en cocción)
  const envaseProyectado = coccion?.envaseProyectado || 
    (Number(coccion?.puntajeCoccion ?? 95) >= 95 
      ? "Saco 50 kg Don Julio Extra Selección" 
      : "Saco 50 kg Don Julio Superior");

  const isDark = variant === "dark";
  const isPrint = variant === "print";

  if (isPrint) {
    return (
      <div className={`space-y-3 font-sans ${className}`}>
        {showTitle && (
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1">
            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
              Resumen Sintético de Variables de Cocción
            </h4>
            <span className="text-[10px] font-bold text-slate-600">
              Evaluación Culinaria en Olla
            </span>
          </div>
        )}

        {/* 1. DOSIFICACIÓN */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-black uppercase">
            Dosificación Estándar
          </div>
          <div className="p-2 grid grid-cols-3 gap-2 text-center text-xs bg-slate-50">
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Tazas Arroz:</span>
              <span className="text-sm font-black text-slate-900">{tazasArroz} tz</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Tazas Agua:</span>
              <span className="text-sm font-black text-slate-900">{tazasAgua} tz</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Tiempo Cocción (min):</span>
              <span className="text-sm font-black text-slate-900">{tiempoCoccionMin} min</span>
            </div>
          </div>
        </div>

        {/* 2. EVALUACIÓN DE GRANO COCIDO */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-2.5 py-1 text-[10px] font-black uppercase">
            Evaluación de Grano Cocido
          </div>
          <div className="p-2 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs bg-slate-50">
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Sabor:</span>
              <span className="text-xs font-bold text-slate-800 block truncate">{sabor}</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Desplazamiento (seg):</span>
              <span className="text-xs font-black text-slate-900 block">{desplazamientoSeg}</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">% G. Quebrado:</span>
              <span className="text-xs font-black text-slate-900 block">{granoQuebradoPct}%</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">% G. Hinchado:</span>
              <span className="text-xs font-black text-slate-900 block">{granoHinchadoPct}%</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">% G. Abierto:</span>
              <span className="text-xs font-black text-slate-900 block">{granoAbiertoPct}%</span>
            </div>
            <div className="bg-white p-1.5 rounded border border-slate-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Textura al Frío:</span>
              <span className="text-xs font-bold text-emerald-700 block">{texturaFrio}</span>
            </div>
          </div>
        </div>

        {/* 3. ENVASE PROYECTADO (SE EVALÚA EN COCCIÓN) */}
        <div className="border-2 border-slate-800 bg-amber-50/60 rounded-lg p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black uppercase text-amber-900 tracking-wider block">
              Envase Proyectado (Evaluado en Cocción):
            </span>
            <span className="text-sm font-black text-slate-900 block">
              📦 {envaseProyectado}
            </span>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
            Apto para Envasado
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-2xl border transition-all ${
        isDark 
          ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl" 
          : "bg-white border-slate-200 text-slate-900 shadow-md"
      } p-4 sm:p-5 ${className}`}
    >
      {/* HEADER */}
      {showTitle && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/60 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Resumen Sintético de Variables de Cocción</span>
                <span className="text-[10px] font-normal lowercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  olla & sensorial
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Parámetros oficiales del sistema para determinación de calidad culinaria y envasado final
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors"
              >
                Editar Parámetros
              </button>
            )}
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Score: {coccion?.puntajeCoccion ?? 95} pts
            </span>
          </div>
        </div>
      )}

      {/* 1. DOSIFICACIÓN */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" />
            1. Dosificación
          </span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tazas Arroz */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Tazas Arroz</span>
              <span className="text-lg font-black text-white">{tazasArroz}</span>
              <span className="text-[10px] text-slate-400 block">Porción de prueba</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Scale className="w-4 h-4" />
            </div>
          </div>

          {/* Tazas Agua */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Tazas Agua</span>
              <span className="text-lg font-black text-cyan-400">{tazasAgua}</span>
              <span className="text-[10px] text-slate-400 block">Hidratación estándar</span>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Droplets className="w-4 h-4" />
            </div>
          </div>

          {/* Tiempo de Cocción */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Tiempo de Cocción</span>
              <span className="text-lg font-black text-amber-400">{tiempoCoccionMin} min</span>
              <span className="text-[10px] text-slate-400 block">Cocción homogénea</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. EVALUACIÓN DE GRANO COCIDO */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            2. Evaluación de Grano Cocido
          </span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Sabor */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400">Sabor</span>
            <div className="my-1">
              <span className="text-xs font-black text-white block leading-tight truncate" title={sabor}>
                {sabor}
              </span>
            </div>
            <span className="text-[9px] text-emerald-400 font-bold">Sin regusto</span>
          </div>

          {/* Desplazamiento (seg) */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400">Desplazamiento</span>
            <div className="my-1">
              <span className="text-sm font-black text-cyan-400 block">
                {desplazamientoSeg}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Fluidez / soltura</span>
          </div>

          {/* % Grano Quebrado */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400">% G. Quebrado</span>
            <div className="my-1">
              <span className={`text-sm font-black block ${
                Number(granoQuebradoPct) <= 15 ? "text-emerald-400" : "text-amber-400"
              }`}>
                {granoQuebradoPct}%
              </span>
            </div>
            <span className="text-[9px] text-slate-400">En olla</span>
          </div>

          {/* % Grano Hinchado */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400">% G. Hinchado</span>
            <div className="my-1">
              <span className="text-sm font-black text-purple-400 block">
                {granoHinchadoPct}%
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Absorción uniforme</span>
          </div>

          {/* % Grano Abierto */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400">% G. Abierto</span>
            <div className="my-1">
              <span className={`text-sm font-black block ${
                Number(granoAbiertoPct) <= 2.0 ? "text-emerald-400" : "text-rose-400"
              }`}>
                {granoAbiertoPct}%
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Apertura transversal</span>
          </div>

          {/* Textura al Frío */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? "bg-slate-850/80 border-slate-750" : "bg-slate-50 border-slate-200"
          }`}>
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <ThermometerSnowflake className="w-3 h-3 text-cyan-300" />
              Textura al Frío
            </span>
            <div className="my-1">
              <span className="text-xs font-black text-emerald-400 block truncate" title={texturaFrio}>
                {texturaFrio}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">Sin endurecimiento</span>
          </div>
        </div>
      </div>

      {/* 3. ENVASE PROYECTADO .... ESO SE EVALUA EN COCCIÓN */}
      <div className="mt-4 p-4 rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-amber-500/10 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shadow-md flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  ENVASE PROYECTADO
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  ★ DETERMINADO EN COCCIÓN
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-black text-white tracking-wide mt-0.5">
                {envaseProyectado}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Calificación y destino de empaque validado según desempeño en olla, textura al frío ({texturaFrio}) y quebrado ({granoQuebradoPct}%).
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Dictamen Comercial:</span>
            <span className="text-xs font-black text-emerald-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              APROBADO PARA ENVASADO
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
