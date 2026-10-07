import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  History, 
  Save, 
  RotateCcw, 
  X,
  Layers,
  Scale,
  Gauge,
  Calendar,
  Check,
  AlertCircle
} from "lucide-react";
import { ParametrosTrabajo, HistorialParametro } from "../types";
import { guardarParametrosTrabajoLocal } from "../utils/batchEngine";
import { localDB } from "../utils/localDB";

interface ParametrosTrabajoModalProps {
  isOpen: boolean;
  onClose: () => void;
  parametros: ParametrosTrabajo;
  historial: HistorialParametro[];
  onSaveParametros: (newParams: Partial<ParametrosTrabajo>, motivo?: string) => Promise<void>;
  currentUser?: { nombre: string; rol: string };
}

export const ParametrosTrabajoModal: React.FC<ParametrosTrabajoModalProps> = ({
  isOpen,
  onClose,
  parametros,
  historial,
  onSaveParametros,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<"parametros" | "historial">("parametros");
  const [formData, setFormData] = useState<ParametrosTrabajo>({ ...parametros });
  const [motivoCambio, setMotivoCambio] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingIA, setIsRequestingIA] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sincronizar formData cuando los parámetros del prop cambien o se abra el modal
  useEffect(() => {
    if (parametros) {
      setFormData({ ...parametros });
    }
  }, [parametros, isOpen]);

  if (!isOpen) return null;

  const handleConsultarIA = async () => {
    setIsRequestingIA(true);
    try {
      const iaSuggestion = localDB.sugerirParametrosTrabajo();
      setFormData(prev => ({
        ...prev,
        sugeridoPorIA: iaSuggestion
      }));
    } catch (e) {
      console.error("Error consultando sugerencia local:", e);
    } finally {
      setIsRequestingIA(false);
    }
  };

  const handleAceptarPropuestaIA = () => {
    if (!formData.sugeridoPorIA) return;
    const ia = formData.sugeridoPorIA;
    setFormData(prev => ({
      ...prev,
      lotesObjetivoPorDia: ia.lotesObjetivoPorDia ?? prev.lotesObjetivoPorDia,
      maxLotesPorDia: ia.maxLotesPorDia ?? prev.maxLotesPorDia,
      capacidadMinimaProcesoKg: ia.capacidadMinimaProcesoKg ?? prev.capacidadMinimaProcesoKg,
      capacidadMaximaSecadoraKg: ia.capacidadMaximaSecadoraKg ?? prev.capacidadMaximaSecadoraKg,
      capacidadExcepcionalMaximaKg: ia.capacidadExcepcionalMaximaKg ?? prev.capacidadExcepcionalMaximaKg,
      toleranciaDefectosPp: ia.toleranciaDefectosPp ?? prev.toleranciaDefectosPp,
      toleranciaQuebradoPp: ia.toleranciaQuebradoPp ?? prev.toleranciaQuebradoPp,
      turnosDisponibles: ia.turnosDisponibles ?? prev.turnosDisponibles
    }));
    setMotivoCambio("Aceptación de valores sugeridos por Asistente de Ingeniería IA");
  };

  const handleRechazarPropuestaIA = () => {
    setFormData(prev => ({
      ...prev,
      sugeridoPorIA: undefined
    }));
  };

  const handleRestablecerValoresFabrica = () => {
    setFormData({
      lotesObjetivoPorDia: 2,
      maxLotesPorDia: 3,
      capacidadMinimaProcesoKg: 22000,
      capacidadMaximaSecadoraKg: 35000,
      capacidadExcepcionalMaximaKg: 37000,
      toleranciaDefectosPp: 2.0,
      toleranciaQuebradoPp: 2.0,
      turnosDisponibles: ["Turno Día", "Turno Noche"],
      ultimaModificacion: formData.ultimaModificacion,
      modificadoPor: formData.modificadoPor
    });
    setMotivoCambio("Restablecimiento a parámetros estándar de planta");
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      guardarParametrosTrabajoLocal(formData);
      await onSaveParametros(formData, motivoCambio || "Ajuste operativo de parámetros de trabajo");
      setSaveSuccessMessage("¡Parámetros de planta guardados! Actualizados en toda la programación y controles.");
      setTimeout(() => {
        setSaveSuccessMessage(null);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Error al guardar parámetros:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div 
        id="modal-parametros-trabajo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Parámetros de Trabajo de Planta
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Configurable
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Reglas de capacidad de secadora, tolerancias de mezcla y objetivos por día sin alterar el código
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          <button
            onClick={() => setActiveTab("parametros")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "parametros"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Gauge className="w-4 h-4" />
            Parámetros Oficiales del Usuario
          </button>
          <button
            onClick={() => setActiveTab("historial")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "historial"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Auditoría de Cambios ({historial.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {saveSuccessMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {saveSuccessMessage}
            </div>
          )}

          {activeTab === "parametros" ? (
            <form onSubmit={handleGuardar} className="space-y-6">
              
              {/* IA Assistant Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-800/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                        Asistente de Optimización de Procesos (IA)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        La IA analiza la carga de lotes y sugiere parámetros técnicos. La decisión oficial es siempre del usuario.
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleConsultarIA}
                    disabled={isRequestingIA}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isRequestingIA ? "Consultando..." : "Consultar Sugerencia IA"}
                  </button>
                </div>

                {formData.sugeridoPorIA && (
                  <div className="mt-2 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-300">
                        Propuesta IA ({formData.sugeridoPorIA.fechaSugerencia || "Reciente"}):
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAceptarPropuestaIA}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Aceptar Valores
                        </button>
                        <button
                          type="button"
                          onClick={handleRechazarPropuestaIA}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-semibold rounded"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                    {formData.sugeridoPorIA.justificacionIA && (
                      <p className="text-slate-300 text-[11px] italic">
                        "{formData.sugeridoPorIA.justificacionIA}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Grid de Parámetros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Lotes Objetivo y Máximo por Día */}
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      1. Objetivos de Programación Diaria
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Lotes Objetivo por Día
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-lotes-objetivo"
                          min={1}
                          max={6}
                          value={formData.lotesObjetivoPorDia}
                          onChange={(e) => setFormData({ ...formData, lotesObjetivoPorDia: parseInt(e.target.value) || 2 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">lotes/día</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Por defecto: 2 lotes/día (1 por turno)</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Máximo Recomendado por Día
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-max-lotes-dia"
                          min={1}
                          max={8}
                          value={formData.maxLotesPorDia}
                          onChange={(e) => setFormData({ ...formData, maxLotesPorDia: parseInt(e.target.value) || 3 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">lotes/día</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Por defecto: 3 lotes/día (límite operativo)</p>
                    </div>
                  </div>
                </div>

                {/* 2. Capacidad de Secadora */}
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      2. Capacidades de Secadora y Proceso
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Capacidad Mínima de Proceso (kg)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-cap-min"
                          step={1000}
                          min={10000}
                          max={30000}
                          value={formData.capacidadMinimaProcesoKg}
                          onChange={(e) => setFormData({ ...formData, capacidadMinimaProcesoKg: parseInt(e.target.value) || 22000 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">
                          {(formData.capacidadMinimaProcesoKg / 1000).toFixed(1)} TN
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Capacidad Máxima Normal (kg)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-cap-max"
                          step={1000}
                          min={20000}
                          max={40000}
                          value={formData.capacidadMaximaSecadoraKg}
                          onChange={(e) => setFormData({ ...formData, capacidadMaximaSecadoraKg: parseInt(e.target.value) || 35000 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">
                          {(formData.capacidadMaximaSecadoraKg / 1000).toFixed(1)} TN
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-amber-300 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Capacidad Excepcional Máxima (kg)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-cap-excepcional"
                          step={1000}
                          min={25000}
                          max={45000}
                          value={formData.capacidadExcepcionalMaximaKg}
                          onChange={(e) => setFormData({ ...formData, capacidadExcepcionalMaximaKg: parseInt(e.target.value) || 37000 })}
                          className="w-full bg-slate-900 border border-amber-700/50 rounded-lg px-3 py-2 text-sm text-amber-200 font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-amber-400 font-semibold">
                          {(formData.capacidadExcepcionalMaximaKg / 1000).toFixed(1)} TN
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-400/80 mt-1">
                        El excedente entre {(formData.capacidadMaximaSecadoraKg/1000).toFixed(0)} y {(formData.capacidadExcepcionalMaximaKg/1000).toFixed(0)} TN debe bajarse y secarse en pampa.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Tolerancias de Compatibilidad */}
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      3. Tolerancias para Unir Lotes
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Tolerancia Máx. Diferencia de Defectos (pp)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-tol-defectos"
                          step={0.5}
                          min={0.5}
                          max={5.0}
                          value={formData.toleranciaDefectosPp}
                          onChange={(e) => setFormData({ ...formData, toleranciaDefectosPp: parseFloat(e.target.value) || 2.0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">puntos %</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Por defecto: 2.0 puntos porcentuales</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Tolerancia Máx. Diferencia de Quebrado (pp)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="input-tol-quebrado"
                          step={0.5}
                          min={0.5}
                          max={5.0}
                          value={formData.toleranciaQuebradoPp}
                          onChange={(e) => setFormData({ ...formData, toleranciaQuebradoPp: parseFloat(e.target.value) || 2.0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">puntos %</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Por defecto: 2.0 puntos porcentuales</p>
                    </div>
                  </div>
                </div>

                {/* 4. Turnos de Operación */}
                <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      4. Turnos de Trabajo Habilitados
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-300 block mb-2 font-medium">
                      Turnos activos en planta:
                    </label>
                    {["Turno Día", "Turno Noche"].map((turno) => {
                      const isSelected = formData.turnosDisponibles?.includes(turno);
                      return (
                        <label 
                          key={turno} 
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-200" 
                              : "bg-slate-900/50 border-slate-700/50 text-slate-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const curr = formData.turnosDisponibles || [];
                              if (e.target.checked) {
                                setFormData({ ...formData, turnosDisponibles: [...curr, turno] });
                              } else {
                                if (curr.length > 1) {
                                  setFormData({ ...formData, turnosDisponibles: curr.filter(t => t !== turno) });
                                }
                              }
                            }}
                            className="rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                          />
                          <span className="text-xs font-bold">{turno}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Justificación del cambio para auditoría */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Motivo o Justificación del Cambio (Auditoría):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Calibración de secadora 01, aumento temporal de demanda..."
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Modificado por: <strong className="text-slate-200">{currentUser?.nombre || "Jefe de Planta"}</strong></span>
                  <span>Última modificación: {formData.ultimaModificacion || "Inicial"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleRestablecerValoresFabrica}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restablecer Estándar de Planta
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    id="btn-guardar-parametros"
                    disabled={isSaving}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Guardando..." : "Guardar Parámetros Oficiales"}
                  </button>
                </div>
              </div>

            </form>
          ) : (
            /* Tab: Historial de Auditoría */
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl flex items-center gap-3 text-xs text-slate-300">
                <History className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Registro cronológico inmutable de cambios en los parámetros de trabajo y capacidades de planta.
                </span>
              </div>

              {historial.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No hay registros de cambios en los parámetros aún.
                </div>
              ) : (
                <div className="border border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-700 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Fecha y Hora</th>
                          <th className="px-4 py-3">Usuario</th>
                          <th className="px-4 py-3">Parámetro</th>
                          <th className="px-4 py-3">Valor Anterior</th>
                          <th className="px-4 py-3">Nuevo Valor</th>
                          <th className="px-4 py-3">Sugerencia IA</th>
                          <th className="px-4 py-3">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {historial.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {entry.fecha}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-white">
                              {entry.usuario}
                            </td>
                            <td className="px-4 py-2.5 text-amber-300 font-medium">
                              {entry.parametro}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">
                              {typeof entry.valorAnterior === "object" ? JSON.stringify(entry.valorAnterior) : String(entry.valorAnterior)}
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">
                              {typeof entry.nuevoValor === "object" ? JSON.stringify(entry.nuevoValor) : String(entry.nuevoValor)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-purple-400 text-[11px]">
                              {entry.sugerenciaIA !== undefined ? String(entry.sugerenciaIA) : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 italic">
                              {entry.motivo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
