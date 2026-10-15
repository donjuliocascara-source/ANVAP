import React, { useState, useEffect } from "react";
import { 
  X, 
  FlaskConical, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Save, 
  Info, 
  Calendar, 
  UserCheck, 
  FileText, 
  Lock,
  ArrowRight
} from "lucide-react";
import { Lote, UserProfile, AnalisisHumedo } from "../types";
import { ResultadoEvaluacionLote } from "../utils/evaluacionCalidad";

interface ModalSustentoExperimentalLoteProps {
  isOpen: boolean;
  lote: Lote | null;
  analisisHumedo?: AnalisisHumedo | null;
  evalResult?: ResultadoEvaluacionLote | null;
  currentUser?: UserProfile | { nombre: string; rol: string };
  initialModo?: "ver" | "aprobar" | "editar" | "rechazar";
  onClose: () => void;
  onAprobar: (lote: Lote, sustentoTexto: string, condicionUso: string) => void;
  onEditar: (lote: Lote, sustentoTexto: string, condicionUso: string, aprobarDirecto?: boolean) => void;
  onRechazar: (lote: Lote, motivoRechazo: string) => void;
}

const CONDICIONES_USO = [
  "Mezcla Controlada (Máximo 15% en formulación de batch)",
  "Mezcla Controlada (Máximo 25% en formulación de batch)",
  "Batch Piloto Exclusivo (100% lote en prueba unitaria controlada)",
  "Secado Diferenciado y Monitoreo Estricto de Descarga"
];

const PLANTILLAS_SUSTENTO = [
  "Mezcla controlada con lote conforme (máx. 15% en tolva de vaporizado).",
  "Compensación técnica mediante curva de vaporizado prolongada y temperatura ajustada.",
  "Lote asignado a prueba piloto industrial bajo monitoreo continuo de calidad.",
  "Autorización excepcional validada por Jefatura de Planta para optimización de molienda.",
  "Compensación por grano quebrado/inmaduro mediante ajuste de presión en pase 1."
];

const PLANTILLAS_RECHAZO = [
  "Sustento técnico con justificación errónea; los defectos superan la tolerancia admisible.",
  "Riesgo crítico de quebrado o manchado en molienda no compensable por vaporizado.",
  "Inconsistencia entre el reporte analítico y el sustento presentado.",
  "Lote no apto para mezcla controlada según criterios vigentes de planta."
];

export const ModalSustentoExperimentalLote: React.FC<ModalSustentoExperimentalLoteProps> = ({
  isOpen,
  lote,
  analisisHumedo,
  evalResult,
  currentUser,
  initialModo = "aprobar",
  onClose,
  onAprobar,
  onEditar,
  onRechazar
}) => {
  const [modo, setModo] = useState<"ver" | "aprobar" | "editar" | "rechazar">(initialModo);
  const [sustentoTexto, setSustentoTexto] = useState("");
  const [condicionUso, setCondicionUso] = useState(CONDICIONES_USO[0]);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmarRechazo, setConfirmarRechazo] = useState(false);

  useEffect(() => {
    if (lote && isOpen) {
      const auth = lote.AUTORIZACION_EXPERIMENTAL;
      const sustentoActual = auth?.sustento || lote.SUSTENTO_EXPERIMENTAL || "";
      setSustentoTexto(sustentoActual);
      setCondicionUso(auth?.condicionUso || CONDICIONES_USO[0]);
      setMotivoRechazo("");
      setErrorMsg(null);
      setConfirmarRechazo(false);
      setModo(initialModo);
    }
  }, [lote, isOpen, initialModo]);

  if (!isOpen || !lote) return null;

  const auth = lote.AUTORIZACION_EXPERIMENTAL;
  const estaAprobado = Boolean(
    auth?.sustentoAprobado === true || 
    (lote as any).SUSTENTO_APROBADO === true || 
    (lote as any).ESTADO_SUSTENTO === "APROBADO"
  );
  const estaRechazado = Boolean(
    auth?.sustentoAprobado === false || 
    (lote as any).ESTADO_SUSTENTO === "RECHAZADO"
  );

  const minChars = 10;
  const sustentoValido = sustentoTexto.trim().length >= minChars;

  const handleEjecutarAprobacion = () => {
    if (!sustentoTexto.trim()) {
      setErrorMsg("Debe ingresar o redactar un sustento técnico para aprobar el lote experimental.");
      return;
    }
    if (!sustentoValido) {
      setErrorMsg(`El sustento técnico debe contener al menos ${minChars} caracteres explicativos.`);
      return;
    }
    setErrorMsg(null);
    onAprobar(lote, sustentoTexto.trim(), condicionUso);
    onClose();
  };

  const handleEjecutarGuardarEdicion = (aprobarTambien: boolean) => {
    if (!sustentoTexto.trim()) {
      setErrorMsg("El sustento no puede quedar vacío. Ingrese una justificación técnica.");
      return;
    }
    if (!sustentoValido) {
      setErrorMsg(`El sustento debe tener al menos ${minChars} caracteres explicativos.`);
      return;
    }
    setErrorMsg(null);
    onEditar(lote, sustentoTexto.trim(), condicionUso, aprobarTambien);
    onClose();
  };

  const handleEjecutarRechazo = () => {
    if (!motivoRechazo.trim()) {
      setErrorMsg("Debe ingresar el motivo de rechazo del sustento (mínimo 5 caracteres).");
      return;
    }
    if (motivoRechazo.trim().length < 5) {
      setErrorMsg("El motivo de rechazo debe contener al menos 5 caracteres explicativos.");
      return;
    }
    setErrorMsg(null);
    onRechazar(lote, motivoRechazo.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div 
        id="modal-sustento-experimental"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-6 animate-in fade-in duration-200"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-orange-950/80 via-slate-900 to-slate-900 border-b border-orange-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600/20 text-orange-400 border border-orange-500/30 rounded-xl">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  Validación de Sustento Técnico
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded font-black bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  {lote.LOTE_ID}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Lote Experimental: Verifique, edite o rechace el sustento antes de autorizar su programación en Batch.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* LOTE SUMMARY CARD */}
          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Cliente</span>
              <span className="font-semibold text-white truncate block">{lote.CLIENTE || "Sin cliente"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Variedad</span>
              <span className="font-semibold text-emerald-400 truncate block">{lote.VARIEDAD || "Sin variedad"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Sacos / Peso</span>
              <span className="font-semibold text-slate-200">
                {Number(lote.SACOS || 0).toLocaleString()} sacos ({(Number(lote.PESO_KG || 0) / 1000).toFixed(1)} TN)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Humedad</span>
              <span className="font-mono font-bold text-cyan-400">
                {Number(analisisHumedo?.HUMEDADES ?? lote.HUM ?? lote.HUMEDAD ?? 14.0).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* ESTADO ACTUAL DEL SUSTENTO */}
          <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
            estaAprobado 
              ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-200" 
              : estaRechazado
              ? "bg-rose-950/30 border-rose-700/50 text-rose-200"
              : "bg-amber-950/30 border-amber-700/50 text-amber-200"
          }`}>
            <div className="flex items-center gap-2">
              {estaAprobado ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : estaRechazado ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <span className="font-bold">
                  {estaAprobado 
                    ? "Estado: SUSTENTO TÉCNICO APROBADO (Habilitado para programar)" 
                    : estaRechazado
                    ? "Estado: SUSTENTO RECHAZADO (Desaprobado - Bloqueado de programación)"
                    : "Estado: SUSTENTO PENDIENTE DE APROBACIÓN (Requiere validación)"}
                </span>
                {auth?.fechaAprobacion && estaAprobado && (
                  <p className="text-[10px] text-slate-400">
                    Aprobado por {auth.aprobadoPor || "Jefe de Planta"} el {new Date(auth.fechaAprobacion).toLocaleDateString("es-PE")} {new Date(auth.fechaAprobacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {auth?.motivoRechazo && estaRechazado && (
                  <p className="text-[10px] text-rose-300">
                    Motivo: "{auth.motivoRechazo}"
                  </p>
                )}
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              estaAprobado 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                : estaRechazado
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            }`}>
              {estaAprobado ? "APROBADO" : estaRechazado ? "RECHAZADO" : "PENDIENTE"}
            </span>
          </div>

          {/* DETALLES DE CALIDAD / MOTIVO EXPERIMENTAL */}
          {evalResult && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Calidad de Recepción: {evalResult.porcentajeAprobacion}% (Criterio Activo)
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {evalResult.tieneVetoCritico ? "Presenta Vetos Técnicos" : "Condición Subestándar"}
                </span>
              </div>
              {evalResult.motivosVeto?.length > 0 && (
                <div className="space-y-0.5 pt-0.5">
                  {evalResult.motivosVeto.map((m: any, i: number) => (
                    <p key={i} className="text-[11px] text-slate-400">
                      • <strong className="text-slate-300">{m.parametro}:</strong> {m.descripcion}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SELECTOR DE ACCIÓN / PESTAÑAS (APROBAR / EDITAR / RECHAZAR) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => { setModo("aprobar"); setErrorMsg(null); }}
              className={`py-2 px-3 rounded-lg font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                modo === "aprobar"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-emerald-300 hover:bg-slate-850"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aprobar Sustento</span>
            </button>

            <button
              type="button"
              onClick={() => { setModo("editar"); setErrorMsg(null); }}
              className={`py-2 px-3 rounded-lg font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                modo === "editar"
                  ? "bg-amber-600 text-white shadow"
                  : "text-slate-400 hover:text-amber-300 hover:bg-slate-850"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Sustento</span>
            </button>

            <button
              type="button"
              onClick={() => { setModo("rechazar"); setErrorMsg(null); }}
              className={`py-2 px-3 rounded-lg font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                modo === "rechazar"
                  ? "bg-rose-600 text-white shadow"
                  : "text-slate-400 hover:text-rose-300 hover:bg-slate-850"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rechazar Sustento</span>
            </button>
          </div>

          {/* CONTENIDO SEGÚN MODO SELECCIONADO */}
          {modo === "aprobar" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Aprobación Técnica de Sustento para Programación</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Al aprobar este sustento, se certifica que la justificación técnica es correcta y válida para la formulación de Batch. El lote quedará de inmediato habilitado para <strong>PROGRAMAR LOTE</strong>.
                </p>
              </div>

              {/* Condición de Uso */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">
                  Condición de Uso / Protocolo Experimental:
                </label>
                <select
                  value={condicionUso}
                  onChange={(e) => setCondicionUso(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  {CONDICIONES_USO.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Sustento a Aprobar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-bold text-slate-300">
                    Sustento Técnico que será Aprobado:
                  </label>
                  <span className={`text-[10px] font-mono ${sustentoValido ? "text-emerald-400 font-bold" : "text-amber-400"}`}>
                    {sustentoTexto.trim().length} / {minChars} car. mín.
                  </span>
                </div>
                <textarea
                  value={sustentoTexto}
                  onChange={(e) => {
                    setSustentoTexto(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  rows={3}
                  placeholder="Escriba o confirme el sustento técnico explicativo..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />

                {!sustentoTexto.trim() && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="text-[10px] text-slate-400 block w-full">Sugerir plantilla rápida:</span>
                    {PLANTILLAS_SUSTENTO.slice(0, 3).map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSustentoTexto(p)}
                        className="text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 px-2 py-1 rounded cursor-pointer transition-colors"
                      >
                        + {p.slice(0, 45)}...
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Info de quién aprueba */}
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aprobado por: <strong className="text-white">{currentUser?.nombre || "Jefe de Planta / Programador"}</strong></span>
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {currentUser?.rol || "JEFE_PLANTA"}
                </span>
              </div>
            </div>
          )}

          {modo === "editar" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Edit3 className="w-4 h-4" />
                  <span>Edición y Corrección de Sustento Técnico</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Modifique la redacción técnica o condición de uso para corregir inconsistencias antes de programar en Batch.
                </p>
              </div>

              {/* Condición de Uso */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">
                  Condición de Uso / Protocolo Experimental:
                </label>
                <select
                  value={condicionUso}
                  onChange={(e) => setCondicionUso(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {CONDICIONES_USO.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Plantillas Rápidas con 1 Clic */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">
                  💡 Plantillas industriales de sustento (clic para autocompletar):
                </span>
                <div className="flex flex-wrap gap-1">
                  {PLANTILLAS_SUSTENTO.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSustentoTexto(tpl)}
                      className="text-[10px] bg-slate-850 hover:bg-amber-950/60 hover:text-amber-200 hover:border-amber-600/70 border border-slate-750 text-slate-300 px-2 py-1 rounded transition-all text-left cursor-pointer"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea de edición */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-bold text-slate-300">
                    Redacción del Sustento Técnico:
                  </label>
                  <span className={`text-[10px] font-mono ${sustentoValido ? "text-emerald-400 font-bold" : "text-amber-400"}`}>
                    {sustentoTexto.trim().length} / {minChars} car. mín.
                  </span>
                </div>
                <textarea
                  value={sustentoTexto}
                  onChange={(e) => {
                    setSustentoTexto(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  rows={4}
                  placeholder="Redacte el sustento técnico corregido que justifica la excepción industrial..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {modo === "rechazar" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs space-y-2 text-rose-200">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Rechazo de Sustento y Bloqueo de Programación</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Si el sustento es <strong>erróneo, insuficiente o inapropiado</strong> para la calidad de la planta, al rechazarlo el lote perderá su condición experimental y pasará a estado <strong>DESAPROBADO</strong>.
                </p>
                <div className="p-2 bg-rose-950/60 rounded-lg border border-rose-700/60 text-[10px] text-rose-300 font-bold">
                  🚫 El lote será excluido de la lista de pendientes y NO PODRÁ ser programado en ningún batch.
                </div>
              </div>

              {/* Plantillas de motivo de rechazo */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">
                  Motivos sugeridos de rechazo rápido:
                </span>
                <div className="flex flex-wrap gap-1">
                  {PLANTILLAS_RECHAZO.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMotivoRechazo(tpl)}
                      className="text-[10px] bg-slate-850 hover:bg-rose-950/60 hover:text-rose-200 hover:border-rose-600/70 border border-slate-750 text-slate-300 px-2 py-1 rounded transition-all text-left cursor-pointer"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input motivo de rechazo */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">
                  Motivo o Justificación del Rechazo:
                </label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => {
                    setMotivoRechazo(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  rows={3}
                  placeholder="Explique el motivo por el cual se rechaza el sustento (ej. sustento técnico erróneo, defectos inaceptables)..."
                  className="w-full bg-slate-950 border border-rose-800/80 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* MENSAJE DE ERROR */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-950/70 border border-rose-700 rounded-xl text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {modo === "aprobar" && (
              <button
                type="button"
                onClick={handleEjecutarAprobacion}
                disabled={!sustentoValido}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 ${
                  sustentoValido
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
                    : "bg-emerald-950 text-emerald-400/50 border border-emerald-800/40 cursor-not-allowed"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Aprobar Sustento Técnico</span>
              </button>
            )}

            {modo === "editar" && (
              <>
                <button
                  type="button"
                  onClick={() => handleEjecutarGuardarEdicion(false)}
                  disabled={!sustentoValido}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Guardar Cambios</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEjecutarGuardarEdicion(true)}
                  disabled={!sustentoValido}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Guardar y Aprobar</span>
                </button>
              </>
            )}

            {modo === "rechazar" && (
              <button
                type="button"
                onClick={handleEjecutarRechazo}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-950/50 active:scale-95"
              >
                <XCircle className="w-4 h-4 text-rose-200" />
                <span>Rechazar Sustento y Desaprobar Lote</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
