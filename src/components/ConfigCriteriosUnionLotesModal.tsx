import React, { useState } from "react";
import { 
  Sliders, 
  X, 
  Check, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles,
  Layers,
  Users,
  Info
} from "lucide-react";
import { 
  CriteriosUnionLotesConfig, 
  CRITERIOS_UNION_DEFAULT, 
  guardarCriteriosUnion 
} from "../utils/criteriosUnionLotes";
import { safeNumVal, safeNumber } from "../utils/numberUtils";

interface ConfigCriteriosUnionLotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  configActual: CriteriosUnionLotesConfig;
  onSaveConfig: (nuevaConfig: CriteriosUnionLotesConfig) => void;
  currentUser?: { nombre: string; rol: string };
}

export const ConfigCriteriosUnionLotesModal: React.FC<ConfigCriteriosUnionLotesModalProps> = ({
  isOpen,
  onClose,
  configActual,
  onSaveConfig,
  currentUser
}) => {
  const [formData, setFormData] = useState<CriteriosUnionLotesConfig>({ ...configActual });
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChangeNumber = (campo: keyof CriteriosUnionLotesConfig, valor: string | number) => {
    const parsed = typeof valor === "number" ? valor : parseFloat(valor);
    const num = isNaN(parsed) ? 0.1 : Math.max(0.1, parsed);
    setFormData(prev => ({
      ...prev,
      [campo]: num
    }));
  };

  const handleAplicarPreset = (tipo: "estandar" | "estricto" | "flexible" | "fabrica") => {
    if (tipo === "fabrica") {
      setFormData({ ...CRITERIOS_UNION_DEFAULT });
      return;
    }

    if (tipo === "estricto") {
      setFormData(prev => ({
        ...prev,
        toleranciaHumedad: 1.0,
        toleranciaTotalTrizado: 1.5,
        toleranciaQuebradoInt: 1.5,
        toleranciaQuebradoBlanco: 2.0,
        toleranciaBlancuraInt: 1.5,
        toleranciaBlancuraBlanco: 2.0,
        toleranciaTrizadoParcial: 1.0,
        toleranciaTizaPuntilla: 1.5,
        toleranciaManchado: 0.8,
        toleranciaTrizado: 1.0,
        toleranciaDesvHumedad: 0.8,
        toleranciaImpurezas: 0.8,
        exigirMismoCliente: true,
        exigirMismaVariedad: true
      }));
    } else if (tipo === "estandar") {
      setFormData(prev => ({
        ...prev,
        toleranciaHumedad: 1.5,
        toleranciaTotalTrizado: 2.0,
        toleranciaQuebradoInt: 2.0,
        toleranciaQuebradoBlanco: 2.5,
        toleranciaBlancuraInt: 2.0,
        toleranciaBlancuraBlanco: 3.0,
        toleranciaTrizadoParcial: 1.5,
        toleranciaTizaPuntilla: 2.0,
        toleranciaManchado: 1.0,
        toleranciaTrizado: 1.5,
        toleranciaDesvHumedad: 1.0,
        toleranciaImpurezas: 1.0,
        exigirMismoCliente: true,
        exigirMismaVariedad: true
      }));
    } else if (tipo === "flexible") {
      setFormData(prev => ({
        ...prev,
        toleranciaHumedad: 2.0,
        toleranciaTotalTrizado: 3.0,
        toleranciaQuebradoInt: 3.0,
        toleranciaQuebradoBlanco: 3.5,
        toleranciaBlancuraInt: 3.0,
        toleranciaBlancuraBlanco: 4.0,
        toleranciaTrizadoParcial: 2.0,
        toleranciaTizaPuntilla: 3.0,
        toleranciaManchado: 1.5,
        toleranciaTrizado: 2.0,
        toleranciaDesvHumedad: 1.5,
        toleranciaImpurezas: 1.5,
        exigirMismoCliente: true,
        exigirMismaVariedad: false
      }));
    }
  };

  const handleGuardar = () => {
    const finalCfg: CriteriosUnionLotesConfig = {
      ...formData,
      ultimaActualizacion: new Date().toISOString().replace("T", " ").substring(0, 19),
      actualizadoPor: currentUser?.nombre || "Jefe de Planta"
    };

    guardarCriteriosUnion(finalCfg);
    onSaveConfig(finalCfg);
    setMensajeExito("Criterios de unión y tolerancias guardados exitosamente.");
    setTimeout(() => {
      setMensajeExito(null);
      onClose();
    }, 1200);
  };

  const camposCriterios = [
    {
      campo: "toleranciaHumedad" as keyof CriteriosUnionLotesConfig,
      label: "Humedad P(H)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 5.0,
      desc: "Desviación máxima respecto al promedio del batch (ej: ±1.5%)"
    },
    {
      campo: "toleranciaTotalTrizado" as keyof CriteriosUnionLotesConfig,
      label: "Total Trizado / Tizón (T.T)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 6.0,
      desc: "Desviación máxima permitida en trizado total (ej: ±2.0%)"
    },
    {
      campo: "toleranciaQuebradoInt" as keyof CriteriosUnionLotesConfig,
      label: "Quebrado Integral (Q.I)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 6.0,
      desc: "Diferencia máxima permitida en quebrado integral"
    },
    {
      campo: "toleranciaQuebradoBlanco" as keyof CriteriosUnionLotesConfig,
      label: "Quebrado Blanco (Q.B)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 6.0,
      desc: "Diferencia máxima permitida en quebrado blanco"
    },
    {
      campo: "toleranciaBlancuraInt" as keyof CriteriosUnionLotesConfig,
      label: "Blancura Integral (BL.INT)",
      unidad: "°",
      step: 0.5,
      min: 0.5,
      max: 8.0,
      desc: "Desviación máxima en grados de blancura integral"
    },
    {
      campo: "toleranciaBlancuraBlanco" as keyof CriteriosUnionLotesConfig,
      label: "Blancura Pulido (BL.BLANCO)",
      unidad: "°",
      step: 0.5,
      min: 0.5,
      max: 8.0,
      desc: "Desviación máxima en grados de blancura pulido"
    },
    {
      campo: "toleranciaTrizadoParcial" as keyof CriteriosUnionLotesConfig,
      label: "Trizado Parcial (T.P)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 5.0,
      desc: "Desviación máxima en trizado parcial"
    },
    {
      campo: "toleranciaTizaPuntilla" as keyof CriteriosUnionLotesConfig,
      label: "Tiza / Puntilla (T.PUN)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 5.0,
      desc: "Desviación máxima en tiza y puntilla"
    },
    {
      campo: "toleranciaManchado" as keyof CriteriosUnionLotesConfig,
      label: "Manchado (M)",
      unidad: "%",
      step: 0.1,
      min: 0.2,
      max: 4.0,
      desc: "Desviación máxima en granos manchados"
    },
    {
      campo: "toleranciaTrizado" as keyof CriteriosUnionLotesConfig,
      label: "Trizado (TRIZ)",
      unidad: "%",
      step: 0.1,
      min: 0.5,
      max: 5.0,
      desc: "Desviación máxima en trizado general"
    },
    {
      campo: "toleranciaDesvHumedad" as keyof CriteriosUnionLotesConfig,
      label: "Desviación de Humedad Interna (DESV)",
      unidad: "pp",
      step: 0.1,
      min: 0.2,
      max: 3.0,
      desc: "Desviación estándar permitida dentro de cada lote"
    },
    {
      campo: "toleranciaImpurezas" as keyof CriteriosUnionLotesConfig,
      label: "Impurezas",
      unidad: "%",
      step: 0.1,
      min: 0.2,
      max: 3.0,
      desc: "Diferencia máxima en impurezas"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Criterios de Tolerancia y Desviación para Unir Lotes
              </h2>
              <p className="text-xs text-slate-400">
                Reglas de compatibilidad y rangos máximos de desviación permitida respecto al promedio del batch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-slate-200">
          
          {mensajeExito && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* REGLA CRÍTICA: UN SOLO CLIENTE */}
          <div className="p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                    Regla Obligatoria: Todos los Lotes de un Solo Cliente
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Para la conformación de cada Batch oficial (V200), todos los lotes incluidos deben pertenecer estrictamente al <strong>mismo cliente</strong>. El sistema bloqueará la unión de lotes con dueños distintos para proteger la trazabilidad y la liquidación de maquila.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={formData.exigirMismoCliente}
                  onChange={(e) => setFormData(prev => ({ ...prev, exigirMismoCliente: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* PRESETS RÁPIDOS */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Presets de Tolerancia:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAplicarPreset("estandar")}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs font-medium text-amber-300 rounded-lg transition-colors border border-amber-500/20"
              >
                Estándar Planta (Humedad ±1.5, T.T ±2.0)
              </button>
              <button
                type="button"
                onClick={() => handleAplicarPreset("estricto")}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs font-medium text-emerald-300 rounded-lg transition-colors border border-emerald-500/20"
              >
                Estricto Alta Gama (Humedad ±1.0, T.T ±1.5)
              </button>
              <button
                type="button"
                onClick={() => handleAplicarPreset("flexible")}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs font-medium text-blue-300 rounded-lg transition-colors border border-blue-500/20"
              >
                Flexible (Humedad ±2.0, T.T ±3.0)
              </button>
              <button
                type="button"
                onClick={() => handleAplicarPreset("fabrica")}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors flex items-center gap-1"
                title="Restablecer valores predeterminados"
              >
                <RotateCcw className="w-3 h-3" />
                Predeterminado
              </button>
            </div>
          </div>

          {/* GRID DE PARÁMETROS Y DESVIACIONES PERMITIDAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                Desviación Máxima Permitida por Defecto / Parámetro respecto al Promedio:
              </h3>
              <span className="text-[11px] text-slate-500">
                Límite: | Valor Lote - Promedio Batch | ≤ Tolerancia
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {camposCriterios.map((c) => {
                const valorActual = safeNumber(formData[c.campo], c.min);
                return (
                  <div 
                    key={c.campo}
                    className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-xl hover:border-slate-600 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{c.label}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-amber-400 font-bold">±</span>
                        <input
                          type="number"
                          step={c.step}
                          min={c.min}
                          max={c.max}
                          value={safeNumVal(formData[c.campo], c.min)}
                          onChange={(e) => handleChangeNumber(c.campo, e.target.value)}
                          className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 focus:border-amber-400 rounded text-center text-xs font-bold text-amber-300 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">{c.unidad}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={c.min}
                        max={c.max}
                        step={c.step}
                        value={valorActual}
                        onChange={(e) => handleChangeNumber(c.campo, e.target.value)}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      {c.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* NOTA OPERATIVA */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <span>
              <strong>Comportamiento en Armador y Matriz:</strong> Al armar un Batch, si algún lote seleccionado presenta una desviación superior a estos rangos permitidos con respecto al promedio ponderado de los lotes unidos, el sistema emitirá una alerta visual de heterogeneidad detallando el defecto específico.
            </span>
          </div>

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Actualizado por: <span className="text-slate-300 font-semibold">{currentUser?.nombre || "Jefe de Planta"}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Guardar Criterios de Unión
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
