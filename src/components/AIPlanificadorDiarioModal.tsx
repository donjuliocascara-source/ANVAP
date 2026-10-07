import React, { useState } from "react";
import { PriorizacionLote, AIPlanProgramacionDia, Equipo } from "../types";
import { 
  BrainCircuit, 
  Sparkles, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Scale, 
  Sliders, 
  ArrowRight,
  ShieldAlert,
  Loader2,
  Calendar,
  Flame
} from "lucide-react";
import { localDB } from "../utils/localDB";

interface AIPlanificadorDiarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotesPriorizados: PriorizacionLote[];
  equipos: Equipo[];
  onApplyPlanToProgramacion?: (plan: AIPlanProgramacionDia) => void;
}

export const AIPlanificadorDiarioModal: React.FC<AIPlanificadorDiarioModalProps> = ({
  isOpen,
  onClose,
  lotesPriorizados,
  equipos,
  onApplyPlanToProgramacion
}) => {
  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState<AIPlanProgramacionDia | null>(null);
  const [capacidadObjetivo, setCapacidadObjetivo] = useState(55);
  const [turno, setTurno] = useState("Turno Mañana + Tarde (24h)");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConsultarIA = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const autoclaves = equipos.filter(e => e.PROCESO === "Vaporizado" && e.ESTADO === "OPERATIVO");
      const data = localDB.planProgramacionDia({
        lotesPriorizados: lotesPriorizados.map(l => ({
          lote_id: l.loteId,
          cliente: l.cliente,
          variedad: l.variedad,
          humedad: l.humedad,
          sacos: l.sacos,
          peso_kg: l.pesoKg,
          peso_tn: l.pesoTn,
          dias_transcurridos: l.diasTranscurridos,
          dias_resistencia: l.diasResistencia,
          dias_restantes: l.diasRestantes,
          puntuacion: l.puntuacionFinal,
          nivel_riesgo: l.nivelRiesgo,
          es_emergencia: l.esEmergencia,
          motivo_emergencia: l.motivoEmergencia,
          estado: l.estadoLote
        })),
        equiposDisponibles: autoclaves,
        fechaConsulta: new Date().toISOString().split("T")[0],
        turno,
        capacidadObjetivoTn: capacidadObjetivo
      });

      setPlanResult(data);
    } catch (err: any) {
      console.error("Error consultando plan IA", err);
      setErrorMsg("Ocurrió un error al generar la optimización con Inteligencia Artificial. Revise la conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">IA Asistente de Operaciones: ¿Qué Lotes Programar Hoy?</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Gemini Parboiling Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Optimización de programación según prioridad de riesgo, días de resistencia, capacidad de autoclaves y conformación de batches multi-lote.
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

        {/* Input Parameters Form (if no result yet or for regenerating) */}
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end flex-shrink-0">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Capacidad Objetivo Planta (TN):
            </label>
            <input
              type="number"
              value={capacidadObjetivo}
              onChange={(e) => setCapacidadObjetivo(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Turno / Horario:
            </label>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="Turno Mañana + Tarde (24h)">Día Completo (24 Horas)</option>
              <option value="Turno 1: 07:00 - 15:00">Turno 1 (07:00 - 15:00)</option>
              <option value="Turno 2: 15:00 - 23:00">Turno 2 (15:00 - 23:00)</option>
              <option value="Turno 3: 23:00 - 07:00">Turno 3 (23:00 - 07:00)</option>
            </select>
          </div>
          <div className="text-xs text-slate-400">
            <span className="block font-semibold text-slate-300">Lotes en Espera:</span>
            <span className="font-mono text-amber-400 font-bold">{lotesPriorizados.length} lotes</span> evaluados
          </div>
          <div>
            <button
              onClick={handleConsultarIA}
              disabled={loading}
              className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Calculando Plan...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  {planResult ? "Re-calcular Plan" : "Consultar a la IA"}
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!planResult && !loading && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-3">
              <BrainCircuit className="w-12 h-12 text-slate-600" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-300">¿Listo para optimizar la jornada de vaporizado?</h4>
                <p className="text-xs text-slate-500 max-w-md">
                  El motor de IA analizará la prioridad de cada lote por humedad y días de resistencia, el estado y capacidad de autoclaves, y agrupará lotes en batches con control de sacos y toneladas exactas.
                </p>
              </div>
              <button
                onClick={handleConsultarIA}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Ejecutar Diagnóstico y Planificación Diaria
              </button>
            </div>
          )}

          {loading && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Analizando matriz de riesgo y capacidad industrial...</h4>
                <p className="text-xs text-slate-400">
                  Evaluando {lotesPriorizados.length} lotes contra autoclaves Schule y Buhler...
                </p>
              </div>
            </div>
          )}

          {planResult && (
            <div className="space-y-5">
              {/* Executive Summary Card */}
              <div className="bg-gradient-to-r from-indigo-950/40 via-slate-850 to-purple-950/40 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Resumen Ejecutivo de la Jornada
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Fecha: {planResult.fecha}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {planResult.resumen_ejecutivo}
                </p>

                {/* Key KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Total Programado</span>
                    <span className="text-sm font-bold text-cyan-300 font-mono">
                      {planResult.toneladas_programadas_total} TN
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      ({planResult.sacos_programados_total} sacos)
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Capacidad Planta</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">
                      {planResult.capacidad_total_planta_tn} TN
                    </span>
                    <span className="text-[10px] text-emerald-400 block">
                      {Math.round((planResult.toneladas_programadas_total / (planResult.capacidad_total_planta_tn || 1)) * 100)}% Ocupación
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-rose-900/40">
                    <span className="text-[10px] text-rose-400 block">Lotes en Emergencia</span>
                    <span className="text-sm font-bold text-rose-300 font-mono">
                      {planResult.lotes_en_emergencia_count} Lotes
                    </span>
                    <span className="text-[10px] text-rose-400/80 block">Atención prioritaria</span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-amber-900/40">
                    <span className="text-[10px] text-amber-400 block">Lotes Alto Riesgo</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {planResult.lotes_alto_riesgo_count} Lotes
                    </span>
                    <span className="text-[10px] text-amber-400/80 block">Programados hoy</span>
                  </div>
                </div>
              </div>

              {/* Proposed Batches Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Batches Sugeridos para Vaporizado (Conformación Multi-Lote con Sacos y Peso)
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {planResult.batches_propuestos?.length || 0} Batches armados
                  </span>
                </div>

                <div className="space-y-4">
                  {planResult.batches_propuestos?.map((batch, bIdx) => (
                    <div
                      key={batch.batch_temp_id || bIdx}
                      className="bg-slate-850 border border-slate-750 rounded-xl overflow-hidden shadow"
                    >
                      {/* Batch Header */}
                      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-750 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 text-xs font-mono font-bold bg-amber-500 text-slate-950 rounded-lg">
                            {batch.batch_temp_id}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {batch.equipo_sugerido}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-slate-300">
                            Capacidad: <strong className="text-white">{batch.capacidad_equipo_tn} TN</strong>
                          </span>
                          <span className="text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            Carga: {batch.ton_totales_batch} TN ({batch.sacos_totales_batch} sacos)
                          </span>
                        </div>
                      </div>

                      {/* Batch Details & Lots Table */}
                      <div className="p-4 space-y-3">
                        <p className="text-xs text-slate-300 italic">
                          <strong className="text-amber-400 not-italic font-semibold">Justificación técnica:</strong> {batch.justificacion_tecnica}
                        </p>

                        {/* Constituent Lots Table */}
                        <div className="overflow-x-auto border border-slate-750 rounded-lg bg-slate-900/60">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-800 text-slate-300 font-semibold text-[11px] border-b border-slate-750">
                              <tr>
                                <th className="p-2">Lote ID</th>
                                <th className="p-2">Cliente</th>
                                <th className="p-2">Variedad</th>
                                <th className="p-2 text-right">Sacos</th>
                                <th className="p-2 text-right">Peso (KG)</th>
                                <th className="p-2 text-right">Peso (TN)</th>
                                <th className="p-2 text-center">Humedad</th>
                                <th className="p-2 text-center">Puntos</th>
                                <th className="p-2 text-center">Riesgo</th>
                                <th className="p-2">Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 font-mono">
                              {batch.lotes_incluidos?.map((lote, lIdx) => (
                                <tr key={lote.lote_id || lIdx} className="hover:bg-slate-800/40">
                                  <td className="p-2 font-bold text-amber-400">{lote.lote_id}</td>
                                  <td className="p-2 text-slate-300 font-sans text-[11px]">{lote.cliente}</td>
                                  <td className="p-2 text-slate-400 font-sans text-[11px]">{lote.variedad}</td>
                                  <td className="p-2 text-right font-bold text-white">{lote.sacos}</td>
                                  <td className="p-2 text-right text-slate-300">{lote.peso_kg?.toLocaleString()} kg</td>
                                  <td className="p-2 text-right font-bold text-cyan-300">{lote.peso_tn} TN</td>
                                  <td className="p-2 text-center text-amber-300 font-bold">{lote.humedad}%</td>
                                  <td className="p-2 text-center font-bold text-white">{lote.puntuacion} pts</td>
                                  <td className="p-2 text-center font-sans">
                                    <span
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                        lote.nivel_riesgo === "EMERGENCIA"
                                          ? "bg-rose-950 text-rose-300 border border-rose-800 animate-pulse"
                                          : lote.nivel_riesgo === "ALTO"
                                          ? "bg-orange-950 text-orange-300 border border-orange-800"
                                          : "bg-amber-950 text-amber-300 border border-amber-800"
                                      }`}
                                    >
                                      {lote.nivel_riesgo}
                                    </span>
                                  </td>
                                  <td className="p-2 text-[11px] font-sans text-slate-400">{lote.motivo_priorizacion}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Parboiling Parameters Suggested */}
                        {batch.parametros_sugeridos && (
                          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-orange-400" />
                              Parámetros de Vaporizado Recomendados para este Batch:
                            </span>
                            <div className="flex items-center gap-4 font-mono">
                              <span className="text-slate-300">
                                Presión: <strong className="text-cyan-300">{batch.parametros_sugeridos.presion_bar} bar</strong>
                              </span>
                              <span className="text-slate-300">
                                Tiempo Vapor: <strong className="text-amber-300">{batch.parametros_sugeridos.tiempo_vapor_min} min</strong>
                              </span>
                              <span className="text-slate-300">
                                Reposo Tolva: <strong className="text-emerald-400">{batch.parametros_sugeridos.tiempo_reposo_min} min</strong>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Postponed Lots & Preventive Actions */}
              {planResult.lotes_postergados && planResult.lotes_postergados.length > 0 && (
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Lotes Postergados para Siguientes Turnos (Plan Preventivo)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {planResult.lotes_postergados.map((post, pIdx) => (
                      <div key={post.lote_id || pIdx} className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-400">{post.lote_id}</span>
                          <span className="text-[10px] text-cyan-300 font-mono font-bold">
                            {post.dias_restantes} días de resistencia restantes
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{post.motivo_postergacion}</p>
                        <p className="text-emerald-400 text-[10px]">
                          <strong>Acción preventiva:</strong> {post.accion_preventiva_sugerida}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operational Warnings */}
              {planResult.advertencias_operativas && planResult.advertencias_operativas.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-xl space-y-1.5 text-xs text-amber-200">
                  <div className="font-bold flex items-center gap-1.5 text-amber-400">
                    <ShieldAlert className="w-4 h-4" />
                    Advertencias Operativas y Restricciones de Planta
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 pl-1">
                    {planResult.advertencias_operativas.map((adv, aIdx) => (
                      <li key={aIdx}>{adv}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 flex-shrink-0">
          <div className="text-xs text-slate-400">
            {planResult ? "Plan generado con éxito según algoritmo de optimización IA." : "Seleccione parámetros y consulte al asistente."}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Cerrar
            </button>
            {planResult && onApplyPlanToProgramacion && (
              <button
                onClick={() => {
                  onApplyPlanToProgramacion(planResult);
                  onClose();
                }}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                Transferir Plan a Programación APIT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
