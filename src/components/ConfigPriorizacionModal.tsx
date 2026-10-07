import React, { useState } from "react";
import { PriorizacionMasterConfig, RangoHumedadPrioridad } from "../types";
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  X, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2,
  Info
} from "lucide-react";
import { CONFIG_PRIORIZACION_DEFAULT } from "../utils/priorizacionService";

interface ConfigPriorizacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PriorizacionMasterConfig;
  onSaveConfig: (newConfig: PriorizacionMasterConfig) => Promise<void> | void;
}

export const ConfigPriorizacionModal: React.FC<ConfigPriorizacionModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig
}) => {
  const [localConfig, setLocalConfig] = useState<PriorizacionMasterConfig>(JSON.parse(JSON.stringify(config)));
  const [activeSubTab, setActiveSubTab] = useState<"humedad" | "organolepticos" | "riesgo">("humedad");
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpdateRango = (index: number, field: keyof RangoHumedadPrioridad, value: any) => {
    const nextRangos = [...localConfig.rangosHumedad];
    nextRangos[index] = { ...nextRangos[index], [field]: value };
    setLocalConfig({ ...localConfig, rangosHumedad: nextRangos });
  };

  const handleAddRango = () => {
    const newId = `R-${localConfig.rangosHumedad.length + 1}`;
    const newRango: RangoHumedadPrioridad = {
      id: newId,
      etiqueta: "Nuevo Rango",
      minHum: 28.0,
      maxHum: 35.0,
      prioridadPct: 90,
      diasResistencia: 1,
      descripcion: "Rango personalizado"
    };
    setLocalConfig({
      ...localConfig,
      rangosHumedad: [...localConfig.rangosHumedad, newRango]
    });
  };

  const handleRemoveRango = (index: number) => {
    if (localConfig.rangosHumedad.length <= 1) return;
    const next = localConfig.rangosHumedad.filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, rangosHumedad: next });
  };

  const handleUpdateOrganoleptico = (
    param: keyof PriorizacionMasterConfig["organolepticos"],
    type: "poco" | "regularVarBast",
    value: number
  ) => {
    setLocalConfig({
      ...localConfig,
      organolepticos: {
        ...localConfig.organolepticos,
        [param]: {
          ...localConfig.organolepticos[param],
          [type]: value
        }
      }
    });
  };

  const handleResetDefaults = () => {
    if (window.confirm("¿Restablecer todos los parámetros de priorización a los valores oficiales de fábrica?")) {
      setLocalConfig(JSON.parse(JSON.stringify(CONFIG_PRIORIZACION_DEFAULT)));
    }
  };

  const handleSave = async () => {
    await onSaveConfig(localConfig);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configuración Maestra — Priorización de Lotes</h3>
              <p className="text-xs text-slate-400">
                Ajuste de rangos de humedad, días de resistencia, puntuación organoléptica y umbrales de riesgo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex space-x-2 border-b border-slate-800 pb-2 flex-shrink-0">
          <button
            onClick={() => setActiveSubTab("humedad")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "humedad"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            1. Tabla Humedad & Resistencia
          </button>
          <button
            onClick={() => setActiveSubTab("organolepticos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "organolepticos"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            2. Puntos Organolépticos
          </button>
          <button
            onClick={() => setActiveSubTab("riesgo")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "riesgo"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            3. Umbrales de Riesgo & Fórmula
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB 1: HUMEDAD */}
          {activeSubTab === "humedad" && (
            <div className="space-y-3">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750 flex items-start gap-2.5 text-xs text-slate-300">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Cada rango de humedad define la <strong>prioridad base (%)</strong> y los <strong>días máximos de resistencia</strong> permitidos en acopio antes de pasar a condición de <strong className="text-rose-400">EMERGENCIA</strong>.
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-850 text-slate-300 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Etiqueta</th>
                      <th className="p-2.5">Hum. Mín (%)</th>
                      <th className="p-2.5">Hum. Máx (%)</th>
                      <th className="p-2.5">Prioridad Base (%)</th>
                      <th className="p-2.5">Días Resistencia</th>
                      <th className="p-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {localConfig.rangosHumedad.map((rango, idx) => (
                      <tr key={rango.id || idx} className="hover:bg-slate-900/50">
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={rango.etiqueta}
                            onChange={(e) => handleUpdateRango(idx, "etiqueta", e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold w-32"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.1"
                            value={rango.minHum}
                            onChange={(e) => handleUpdateRango(idx, "minHum", parseFloat(e.target.value) || 0)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono w-20"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.1"
                            value={rango.maxHum}
                            onChange={(e) => handleUpdateRango(idx, "maxHum", parseFloat(e.target.value) || 0)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono w-20"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={rango.prioridadPct}
                            onChange={(e) => handleUpdateRango(idx, "prioridadPct", parseInt(e.target.value) || 0)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-bold font-mono w-20"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={rango.diasResistencia}
                              onChange={(e) => handleUpdateRango(idx, "diasResistencia", parseInt(e.target.value) || 0)}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold font-mono w-20"
                            />
                            <span className="text-slate-400 text-[11px]">días</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleRemoveRango(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Eliminar rango"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleAddRango}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Nuevo Rango de Humedad
              </button>
            </div>
          )}

          {/* TAB 2: ORGANOLÉPTICOS */}
          {activeSubTab === "organolepticos" && (
            <div className="space-y-4">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750 flex items-start gap-2.5 text-xs text-slate-300">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Los puntos de los parámetros organolépticos se suman a la prioridad base de humedad para obtener la puntuación total de riesgo.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { key: "palote", label: "PALOTE (PALT)", desc: "Presencia de palotes y residuos leñosos" },
                  { key: "vano", label: "VANO (VN)", desc: "Granos vanos / sin embrión" },
                  { key: "impureza", label: "IMPUREZA (IMP.)", desc: "Materia extraña e impurezas" },
                  { key: "plaga", label: "PLAGA (PLAG.)", desc: "Insectos vivos o perforación de grano" },
                  { key: "olor", label: "OLOR (OL)", desc: "Olor característico vs mohoso/ácido" },
                  { key: "falsoCarbon", label: "FALSO CARBÓN (F. CARB.)", desc: "Granos carbón / esporas" },
                  { key: "hongo", label: "HONGO (HON.)", desc: "Presencia de micelio o moho" }
                ].map((item) => {
                  const pConfig = localConfig.organolepticos[item.key as keyof PriorizacionMasterConfig["organolepticos"]];
                  return (
                    <div key={item.key} className="bg-slate-850 p-3.5 rounded-xl border border-slate-750 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-white">{item.label}</span>
                        <span className="text-[10px] text-slate-400">{item.desc}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] text-emerald-400 font-bold mb-1">
                            Poco (P)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={pConfig.poco}
                              onChange={(e) => handleUpdateOrganoleptico(item.key as any, "poco", parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-bold font-mono"
                            />
                            <span className="text-[10px] text-slate-400">pts</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-amber-400 font-bold mb-1">
                            Reg. / Var. / Bast. (R/V/B)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={pConfig.regularVarBast}
                              onChange={(e) => handleUpdateOrganoleptico(item.key as any, "regularVarBast", parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-bold font-mono"
                            />
                            <span className="text-[10px] text-slate-400">pts</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: UMBRALES DE RIESGO */}
          {activeSubTab === "riesgo" && (
            <div className="space-y-4">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750 flex items-start gap-2.5 text-xs text-slate-300">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Clasificación automática del nivel de riesgo según la puntuación final de prioridad calculada.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* BAJO */}
                <div className="bg-slate-850 p-4 rounded-xl border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Riesgo BAJO</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-300 rounded">Verde</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    Puntuación menor a:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={localConfig.rangosRiesgo.bajoMax}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        rangosRiesgo: { ...localConfig.rangosRiesgo, bajoMax: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-bold font-mono w-24"
                    />
                    <span className="text-xs text-slate-400 font-mono">pts (Ej. &lt; 84)</span>
                  </div>
                </div>

                {/* MEDIO */}
                <div className="bg-slate-850 p-4 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Riesgo MEDIO</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-950 text-amber-300 rounded">Amarillo</span>
                  </div>
                  <div className="text-xs text-slate-300">Rango de puntos:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={localConfig.rangosRiesgo.medioMin}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        rangosRiesgo: { ...localConfig.rangosRiesgo, medioMin: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold font-mono w-16"
                    />
                    <span className="text-slate-400">a</span>
                    <input
                      type="number"
                      value={localConfig.rangosRiesgo.medioMax}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        rangosRiesgo: { ...localConfig.rangosRiesgo, medioMax: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold font-mono w-16"
                    />
                    <span className="text-xs text-slate-400 font-mono">pts (Ej. 85–89)</span>
                  </div>
                </div>

                {/* ALTO */}
                <div className="bg-slate-850 p-4 rounded-xl border border-orange-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Riesgo ALTO</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-950 text-orange-300 rounded">Naranja</span>
                  </div>
                  <div className="text-xs text-slate-300">Rango de puntos:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={localConfig.rangosRiesgo.altoMin}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        rangosRiesgo: { ...localConfig.rangosRiesgo, altoMin: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold font-mono w-16"
                    />
                    <span className="text-slate-400">a</span>
                    <input
                      type="number"
                      value={localConfig.rangosRiesgo.altoMax}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        rangosRiesgo: { ...localConfig.rangosRiesgo, altoMax: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold font-mono w-16"
                    />
                    <span className="text-xs text-slate-400 font-mono">pts (Ej. 90–95)</span>
                  </div>
                </div>

                {/* EMERGENCIA */}
                <div className="bg-slate-850 p-4 rounded-xl border border-rose-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">EMERGENCIA</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-950 text-rose-300 rounded animate-pulse">Rojo</span>
                  </div>
                  <div className="text-xs text-slate-300">Puntuación igual o mayor a:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={localConfig.rangosRiesgo.emergenciaMin}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        rangosRiesgo: { ...localConfig.rangosRiesgo, emergenciaMin: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-rose-300 font-bold font-mono w-24"
                    />
                    <span className="text-xs text-slate-400 font-mono">pts o Límite de días vencido</span>
                  </div>
                </div>
              </div>

              {/* Formula */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750 space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">Fórmula de Cálculo Configurada:</label>
                <div className="text-xs font-mono text-cyan-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  Puntuación = Prioridad_Humedad (%) + Palote + Vano + Impureza + Plaga + Olor + Falso_Carbón + Hongo
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 flex-shrink-0">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restablecer Valores de Fábrica
          </button>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Guardado
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
