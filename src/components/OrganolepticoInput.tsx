import React from "react";
import { OPCIONES_ORGANOLEPTICAS, CodigoOrganoleptico, parseOrganoleptico } from "../utils/evaluacionCalidad";

interface OrganolepticoInputProps {
  id?: string;
  label: string;
  abreviatura: string;
  condicionApto?: string;
  value: unknown;
  onChange: (val: string) => void;
  pesoPct?: number;
}

export const OrganolepticoInput: React.FC<OrganolepticoInputProps> = ({
  id,
  label,
  abreviatura,
  condicionApto,
  value,
  onChange,
  pesoPct
}) => {
  const parsed = parseOrganoleptico(value);
  const selectedCode = parsed.code !== "OTRO" ? parsed.code : (String(value || "N").toUpperCase() as CodigoOrganoleptico);

  return (
    <div id={id} className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-750 flex flex-col justify-between space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-white truncate" title={label}>{label}</span>
          <span className="text-[9px] font-mono font-black text-amber-400 bg-amber-950/70 border border-amber-800 px-1 py-0.5 rounded">
            {abreviatura}
          </span>
        </div>
        {condicionApto && (
          <div className="text-[9px] text-slate-400 font-mono truncate" title={`Apto: ${condicionApto}`}>
            Apto: <span className="text-emerald-400 font-semibold">{condicionApto}</span>
          </div>
        )}
      </div>

      {/* Button Group N, P, R, V, B */}
      <div className="grid grid-cols-5 gap-1">
        {OPCIONES_ORGANOLEPTICAS.map((opt) => {
          const isSelected = selectedCode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`py-1 px-0.5 rounded text-[11px] font-bold transition flex flex-col items-center justify-center cursor-pointer border ${
                isSelected
                  ? opt.value === "N"
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-sm font-black ring-1 ring-emerald-400"
                    : opt.value === "P"
                    ? "bg-teal-600 text-white border-teal-400 shadow-sm font-black ring-1 ring-teal-400"
                    : opt.value === "R"
                    ? "bg-amber-600 text-white border-amber-400 shadow-sm font-black ring-1 ring-amber-400"
                    : opt.value === "V"
                    ? "bg-orange-600 text-white border-orange-400 shadow-sm font-black ring-1 ring-orange-400"
                    : "bg-rose-600 text-white border-rose-400 shadow-sm font-black ring-1 ring-rose-400"
                  : "bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
              title={`${opt.value} - ${opt.nombreCompleto}`}
            >
              <span className="leading-none text-xs">{opt.value}</span>
              <span className="text-[8px] leading-tight opacity-80 uppercase tracking-tighter">
                {opt.value === "N" ? "NIN/NP" : opt.nombreCompleto.slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/80">
        <span className="text-slate-400">Selección:</span>
        <span className={`font-black font-mono text-[10px] ${
          selectedCode === "N" ? "text-emerald-400" :
          selectedCode === "P" ? "text-teal-400" :
          selectedCode === "R" ? "text-amber-400" :
          selectedCode === "V" ? "text-orange-400" : "text-rose-400"
        }`}>
          {selectedCode === "N" && "N (Ninguno / No Presenta - NP)"}
          {selectedCode === "P" && "P (Poco)"}
          {selectedCode === "R" && "R (Regular)"}
          {selectedCode === "V" && "V (Variado)"}
          {selectedCode === "B" && "B (Bastante)"}
        </span>
      </div>
    </div>
  );
};
