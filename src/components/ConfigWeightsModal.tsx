import React, { useState } from "react";
import { SuccessWeights, Equipo, EstadoLote } from "../types";
import { X, Sliders, Save, CheckCircle2, Factory, Layers } from "lucide-react";

interface ConfigWeightsModalProps {
  isOpen: boolean;
  weights?: SuccessWeights;
  equipos?: Equipo[];
  estados?: EstadoLote[];
  onSaveWeights: (newWeights: SuccessWeights) => void;
  onClose: () => void;
}

export const ConfigWeightsModal: React.FC<ConfigWeightsModalProps> = ({
  isOpen,
  weights = {
    incrementoQuebrado: 30,
    controlDefectos: 25,
    resultadoCoccion: 20,
    blancura: 15,
    cumplimientoProceso: 10,
    targetQuebradoMaxInc: 3.5,
    targetBlancuraMin: 38,
    targetHumedadFinal: 13.0
  },
  equipos = [],
  estados = [],
  onSaveWeights,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<"weights" | "equipos" | "estados">("weights");
  const [formWeights, setFormWeights] = useState<SuccessWeights>(weights);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const totalPercentage = 
    formWeights.incrementoQuebrado +
    formWeights.controlDefectos +
    formWeights.resultadoCoccion +
    formWeights.blancura +
    formWeights.cumplimientoProceso;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPercentage !== 100) {
      return;
    }
    onSaveWeights(formWeights);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
              <Sliders className="w-5 h-5" />
              <span>Configuración de Parámetros y Ponderaciones del Molino</span>
            </div>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-Tabs */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mt-4">
            <button
              onClick={() => setActiveTab("weights")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold ${
                activeTab === "weights" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Fórmula Lote Exitoso (100%)
            </button>
            <button
              onClick={() => setActiveTab("equipos")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold ${
                activeTab === "equipos" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Catálogo de Equipos ({equipos.length})
            </button>
            <button
              onClick={() => setActiveTab("estados")}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold ${
                activeTab === "estados" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Estados de Lote ({estados.length})
            </button>
          </div>

          {/* TAB 1: WEIGHTS FORMULA */}
          {activeTab === "weights" && (
            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-400 text-xs">
                Ajuste los pesos porcentuales utilizados para calificar si un lote es <strong>EXITOSO, CONFORME u OBSERVADO</strong>:
              </p>

              <div className="space-y-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
                {/* 1. Incremento Quebrado */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">1. Incremento de Quebrado (%)</div>
                    <div className="text-[11px] text-slate-400">Castigo por quebrado generado durante el proceso</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="input-weight-quebrado"
                      type="number"
                      min="0"
                      max="100"
                      value={formWeights.incrementoQuebrado}
                      onChange={(e) => setFormWeights((p) => ({ ...p, incrementoQuebrado: parseInt(e.target.value) || 0 }))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-300"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* 2. Control Defectos */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">2. Control de Defectos Físicos (%)</div>
                    <div className="text-[11px] text-slate-400">Sellado de trizado, tiza y manchado</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="input-weight-defectos"
                      type="number"
                      min="0"
                      max="100"
                      value={formWeights.controlDefectos}
                      onChange={(e) => setFormWeights((p) => ({ ...p, controlDefectos: parseInt(e.target.value) || 0 }))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-300"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* 3. Coccion */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">3. Resultado de Cocción (%)</div>
                    <div className="text-[11px] text-slate-400">Textura de grano suelto y no pegajoso</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="input-weight-coccion"
                      type="number"
                      min="0"
                      max="100"
                      value={formWeights.resultadoCoccion}
                      onChange={(e) => setFormWeights((p) => ({ ...p, resultadoCoccion: parseInt(e.target.value) || 0 }))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-300"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* 4. Blancura */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">4. Blancura Kett (%)</div>
                    <div className="text-[11px] text-slate-400">Color y apariencia comercial</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="input-weight-blancura"
                      type="number"
                      min="0"
                      max="100"
                      value={formWeights.blancura}
                      onChange={(e) => setFormWeights((p) => ({ ...p, blancura: parseInt(e.target.value) || 0 }))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-300"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* 5. Cumplimiento */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">5. Cumplimiento Operativo (%)</div>
                    <div className="text-[11px] text-slate-400">Estabilidad de presión y tiempos programados</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="input-weight-cumplimiento"
                      type="number"
                      min="0"
                      max="100"
                      value={formWeights.cumplimientoProceso}
                      onChange={(e) => setFormWeights((p) => ({ ...p, cumplimientoProceso: parseInt(e.target.value) || 0 }))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-300"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Total Check */}
              <div className={`p-3 rounded-lg flex items-center justify-between font-bold ${
                totalPercentage === 100 ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800" : "bg-rose-950/60 text-rose-300 border border-rose-800"
              }`}>
                <span>Suma Total:</span>
                <span>{totalPercentage}% {totalPercentage === 100 ? "✓ (Correcto)" : "✗ (Debe sumar 100%)"}</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="btn-save-weights-submit"
                  type="submit"
                  disabled={totalPercentage !== 100}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Guardar Ponderaciones
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: EQUIPOS */}
          {activeTab === "equipos" && (
            <div className="mt-4 space-y-3 text-xs">
              <div className="bg-slate-850 rounded-xl border border-slate-750 divide-y divide-slate-800 overflow-hidden">
                {equipos.map((eq) => (
                  <div key={eq.EQUIPO_ID} className="p-3 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white">{eq.EQUIPO}</span>
                      <span className="text-[11px] text-slate-400 ml-2">({eq.PROCESO})</span>
                      <div className="text-[10px] text-slate-500">Capacidad: {eq.CAPACIDAD_TN} TN</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {eq.ESTADO}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ESTADOS */}
          {activeTab === "estados" && (
            <div className="mt-4 space-y-3 text-xs">
              <div className="bg-slate-850 rounded-xl border border-slate-750 divide-y divide-slate-800 overflow-hidden">
                {estados.map((est) => (
                  <div key={est.ESTADO_ID} className="p-3 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white">#{est.ORDEN} {est.ESTADO}</span>
                      <div className="text-[10px] text-slate-400">{est.DESCRIPCION}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
