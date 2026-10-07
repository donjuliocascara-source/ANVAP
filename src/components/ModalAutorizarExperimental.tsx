import React, { useState, useEffect } from "react";
import { 
  X, 
  FlaskConical, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Info, 
  RotateCcw,
  Calendar,
  UserCheck,
  Scale,
  Package,
  Droplet
} from "lucide-react";
import { Lote, UserProfile } from "../types";
import { ResultadoEvaluacionLote } from "../utils/evaluacionCalidad";
import { puedeAutorizarLoteExperimental } from "../utils/permisosService";
import { localDB } from "../utils/localDB";

interface ModalAutorizarExperimentalProps {
  isOpen: boolean;
  lote: Lote | null;
  evalResult?: ResultadoEvaluacionLote | null;
  currentUser?: UserProfile;
  onClose: () => void;
  onSuccess: (updatedLote: Lote) => void;
  onRevertSuccess?: (updatedLote: Lote) => void;
}

const CONDICIONES_USO = [
  "Mezcla Controlada (Máximo 15% en formulación de batch)",
  "Mezcla Controlada (Máximo 25% en formulación de batch)",
  "Batch Piloto Exclusivo (100% lote en prueba unitaria controlada)",
  "Secado Diferenciado y Monitoreo Estricto de Descarga"
];

export const ModalAutorizarExperimental: React.FC<ModalAutorizarExperimentalProps> = ({
  isOpen,
  lote,
  evalResult,
  currentUser,
  onClose,
  onSuccess,
  onRevertSuccess
}) => {
  const [sustento, setSustento] = useState("");
  const [condicionUso, setCondicionUso] = useState(CONDICIONES_USO[0]);
  const [declaracionAceptada, setDeclaracionAceptada] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);

  const esAutorizado = puedeAutorizarLoteExperimental(currentUser?.rol);
  const yaEsExperimental = Boolean(
    lote?.ES_EXPERIMENTAL || 
    lote?.AUTORIZACION_EXPERIMENTAL || 
    lote?.ESTADO_LOTE === "APTO EXPERIMENTAL"
  );

  useEffect(() => {
    if (lote) {
      if (yaEsExperimental && lote.AUTORIZACION_EXPERIMENTAL) {
        setSustento(lote.AUTORIZACION_EXPERIMENTAL.sustento || lote.SUSTENTO_EXPERIMENTAL || "");
        setCondicionUso(lote.AUTORIZACION_EXPERIMENTAL.condicionUso || CONDICIONES_USO[0]);
        setDeclaracionAceptada(true);
        setModoEdicion(false);
      } else {
        setSustento("");
        setCondicionUso(CONDICIONES_USO[0]);
        setDeclaracionAceptada(false);
        setModoEdicion(true);
      }
      setErrorMsg(null);
    }
  }, [lote, isOpen, yaEsExperimental]);

  if (!isOpen || !lote) return null;

  const minChars = 10;
  const sustentoValido = sustento.trim().length >= minChars;

  const plantillasRapidas = [
    "Mezcla controlada con lote conforme (máx. 15% en tolva de vaporizado).",
    "Compensación técnica mediante curva de vaporizado controlada y temperatura ajustada.",
    "Lote asignado a prueba piloto industrial bajo monitoreo continuo de calidad.",
    "Autorización excepcional validada por Jefatura de Planta para optimización de molienda."
  ];

  const handleSubmit = async () => {
    if (!sustento.trim()) {
      setErrorMsg("⚠️ Ingrese el sustento técnico de aprobación (puede seleccionar una de las plantillas rápidas de arriba).");
      return;
    }

    if (!sustentoValido) {
      setErrorMsg(`⚠️ El sustento técnico debe contener al menos ${minChars} caracteres explicativos.`);
      return;
    }

    if (!declaracionAceptada) {
      setDeclaracionAceptada(true);
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        sustento: sustento.trim(),
        condicionUso,
        user: currentUser?.nombre || "Jefe de Área / Programador",
        rol: currentUser?.rol || "JEFE_PLANTA"
      };

      const updatedLote = localDB.autorizarLoteExperimental(lote.LOTE_ID, payload, currentUser?.nombre);
      onSuccess(updatedLote);
      onClose();
    } catch (err: any) {
      console.error("Error al autorizar lote experimental:", err);
      setErrorMsg(err.message || "Error al procesar la autorización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevertir = async () => {
    if (!esAutorizado) {
      setErrorMsg("Solo el Jefe de Área o el Programador pueden revertir la autorización.");
      return;
    }

    const confirmar = window.confirm(
      `¿Está seguro de revertir el lote ${lote.LOTE_ID} a estado DESAPROBADO? Perderá la condición experimental y no podrá ser programado.`
    );
    if (!confirmar) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updatedLote = localDB.revertirDesaprobado(lote.LOTE_ID, currentUser?.nombre);
      if (onRevertSuccess) {
        onRevertSuccess(updatedLote);
      } else {
        onSuccess(updatedLote);
      }
      onClose();
    } catch (err: any) {
      console.error("Error al revertir autorización:", err);
      setErrorMsg(err.message || "Error al revertir a estado desaprobado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div 
        id="modal-autorizar-experimental"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-orange-950/70 via-slate-900 to-slate-900 border-b border-orange-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-600/20 text-orange-400 border border-orange-500/30 rounded-xl">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{yaEsExperimental ? "Autorización Experimental del Lote" : "Pasar Lote Desaprobado a Experimental"}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  {lote.LOTE_ID}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Procedimiento formal de reclasificación técnica para lotes con dictamen no conforme
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* LOTE SUMMARY CARD */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Cliente / Proveedor</span>
              <span className="font-semibold text-white truncate block">{lote.CLIENTE || "Sin especificar"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Variedad</span>
              <span className="font-semibold text-emerald-400 truncate block">{lote.VARIEDAD || "Sin variedad"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Sacos / Peso</span>
              <span className="font-semibold text-slate-200">
                {lote.SACOS?.toLocaleString() || 0} sacos ({((lote.PESO_KG || 0) / 1000).toFixed(1)} TN)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Humedad Base</span>
              <span className="font-semibold text-cyan-400">
                {lote.HUM || lote.HUMEDAD || 0}%
              </span>
            </div>
          </div>

          {/* EVALUATION / VETO REASON BOX */}
          {evalResult && (
            <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              evalResult.tieneVetoCritico 
                ? "bg-rose-950/40 border-rose-800/60 text-rose-200" 
                : "bg-slate-800/60 border-slate-700 text-slate-300"
            }`}>
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Motivo del Dictamen Desaprobado Original:</span>
                </div>
                <span className="font-mono bg-rose-950 px-2 py-0.5 rounded text-rose-300 border border-rose-800">
                  Puntaje: {evalResult.porcentajeAprobacion}% (Umbral min. 86%)
                </span>
              </div>
              {evalResult.tieneVetoCritico && evalResult.motivosVeto.length > 0 ? (
                <div className="space-y-1 pt-1">
                  {evalResult.motivosVeto.map((veto, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-rose-300 text-[11px]">
                      <span className="text-rose-500">•</span>
                      <span><strong>{veto.parametro}:</strong> {veto.descripcion}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  El lote no alcanzó el puntaje mínimo de aprobación ({evalResult.porcentajeAprobacion}% de 86% requerido) en los 24 criterios técnicos de recepción.
                </p>
              )}
            </div>
          )}

          {/* PERMISSION CHECK NOTIFICATION */}
          {!esAutorizado ? (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <Lock className="w-5 h-5 shrink-0" />
                <span>Permiso Restringido a Jefatura de Área o Programador</span>
              </div>
              <p>
                Por política de control de calidad y seguridad alimentaria, <strong>únicamente el Jefe de Área</strong> (Jefe de Planta / Vaporizado) o el <strong>Programador</strong> tienen la potestad de reclasificar un lote con dictamen desaprobado a modo experimental.
              </p>
              <div className="p-2.5 bg-amber-900/30 rounded-lg border border-amber-800/40 text-[11px] flex items-center justify-between">
                <span>Su rol activo actual: <strong className="text-white font-mono">{currentUser?.rol || "NO AUTENTICADO"}</strong></span>
                <span className="text-amber-300 font-medium">({currentUser?.nombre || "Usuario"})</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* CURRENT ACTIVE AUTHORIZATION BADGE (IF ALREADY EXPERIMENTAL) */}
              {yaEsExperimental && lote.AUTORIZACION_EXPERIMENTAL && !modoEdicion && (
                <div className="p-4 rounded-xl bg-orange-950/40 border border-orange-700/70 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-orange-400 font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Autorización Experimental Vigente</span>
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(lote.AUTORIZACION_EXPERIMENTAL.fecha).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[11px]">Autorizado Por</span>
                      <span className="font-bold text-white">{lote.AUTORIZACION_EXPERIMENTAL.autorizadoPor}</span>
                      <span className="text-[10px] text-orange-400 block font-mono">Rol: {lote.AUTORIZACION_EXPERIMENTAL.rol}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[11px]">Condición de Uso</span>
                      <span className="font-bold text-emerald-300">{lote.AUTORIZACION_EXPERIMENTAL.condicionUso || "Mezcla Controlada"}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-500 block text-[11px] font-bold uppercase mb-1">Sustento Técnico Registrado:</span>
                    <p className="text-slate-200 italic font-serif leading-relaxed">
                      "{lote.AUTORIZACION_EXPERIMENTAL.sustento}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setModoEdicion(true)}
                      className="text-xs text-orange-400 hover:text-orange-300 underline font-medium cursor-pointer"
                    >
                      Editar sustento técnico o condición
                    </button>

                    <button
                      onClick={handleRevertir}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revertir a Desaprobado</span>
                    </button>
                  </div>
                </div>
              )}

              {/* EDIT / NEW AUTHORIZATION FORM */}
              {(!yaEsExperimental || modoEdicion) && (
                <div className="space-y-4">
                  {/* AUTHORIZER PROFILE BAR */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-300">
                        Autorizador: <strong className="text-white">{currentUser?.nombre || "Jefe de Área / Programador"}</strong>
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-orange-950/80 text-orange-300 border border-orange-700">
                      {currentUser?.rol || "JEFE_PLANTA"}
                    </span>
                  </div>

                  {/* PROTOCOLO / CONDICIÓN DE USO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <span>Condición de Uso / Protocolo Experimental:</span>
                      <span className="text-orange-400">*</span>
                    </label>
                    <select
                      value={condicionUso}
                      onChange={(e) => setCondicionUso(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      {CONDICIONES_USO.map((cond, idx) => (
                        <option key={idx} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      Define la restricción operativa con la que este lote podrá ingresar a la matriz de priorización y batches.
                    </p>
                  </div>

                  {/* SUSTENTO TÉCNICO OBLIGATORIO */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span>Sustento Técnico Obligatorio de Aprobación:</span>
                        <span className="text-rose-400 font-black">*</span>
                      </label>
                      <span className={`text-[11px] font-mono ${
                        sustento.trim().length >= minChars ? "text-emerald-400 font-bold" : "text-amber-400"
                      }`}>
                        {sustento.trim().length} / {minChars} caracteres mín.
                      </span>
                    </div>

                    {/* Plantillas Rápidas con 1 Clic */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        💡 Plantillas rápidas de sustento industrial (clic para autocompletar):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {plantillasRapidas.map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSustento(tpl);
                              setDeclaracionAceptada(true);
                              setErrorMsg(null);
                            }}
                            className="text-[10px] bg-slate-800/90 hover:bg-orange-950/60 hover:text-orange-200 hover:border-orange-600/70 border border-slate-750 text-slate-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer"
                          >
                            + {tpl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={sustento}
                      onChange={(e) => {
                        setSustento(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Ejemplo: Se autoriza excepcionalmente como experimental para mezcla controlada al 15% con lote conforme, debido a que el rendimiento de grano entero es óptimo (58%) y el defecto por grano verde es superficial, compensable mediante curva de vaporizado prolongada..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                    {!sustentoValido && sustento.length > 0 && (
                      <p className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Ingrese al menos {minChars} caracteres para justificar la excepción técnica.</span>
                      </p>
                    )}
                  </div>

                  {/* CHECKBOX DE RESPONSABILIDAD TÉCNICA */}
                  <div className={`p-3 rounded-xl border transition-colors ${
                    declaracionAceptada ? "bg-orange-950/20 border-orange-700/50" : "bg-slate-950/70 border-slate-800"
                  }`}>
                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={declaracionAceptada}
                        onChange={(e) => setDeclaracionAceptada(e.target.checked)}
                        className="mt-0.5 rounded border-slate-700 text-orange-500 focus:ring-orange-500 h-4 w-4 shrink-0 bg-slate-900 cursor-pointer"
                      />
                      <span>
                        Declaro como <strong>Jefatura de Área o Programador</strong> que asumo la responsabilidad técnica de autorizar este lote en calidad de <strong>Experimental</strong> bajo monitoreo de variables críticas de vaporizado y descarga.
                      </span>
                    </label>
                  </div>

                  {yaEsExperimental && (
                    <button
                      type="button"
                      onClick={() => setModoEdicion(false)}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      ← Cancelar edición y ver autorización actual
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-700 rounded-xl text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {esAutorizado ? "Cancelar" : "Cerrar"}
          </button>

          {(!yaEsExperimental || modoEdicion) && (
            <button
              id="btn-confirmar-pasar-experimental"
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer active:scale-98 ${
                sustentoValido
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-950/40"
                  : "bg-gradient-to-r from-orange-700/80 to-amber-700/80 hover:from-orange-600 hover:to-amber-600 text-white/90 shadow-md border border-orange-500/50"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registrando autorización...</span>
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4 text-orange-200" />
                  <span>{yaEsExperimental ? "Actualizar Autorización Experimental" : "Autorizar y Pasar a Experimental"}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
