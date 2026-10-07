import React, { useState } from "react";
import { Lote, AnalisisHumedo, RegistroHumedad, ConfiguracionEvaluacionLotes, UserProfile } from "../types";
import { calcularEvaluacionLote } from "../utils/evaluacionCalidad";
import { ModalAutorizarExperimental } from "./ModalAutorizarExperimental";
import { puedeAutorizarLoteExperimental } from "../utils/permisosService";
import { 
  X, 
  Printer, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Droplet, 
  Building, 
  Calendar, 
  Scale, 
  Package, 
  FileText,
  ShieldCheck, 
  Info,
  Sliders,
  FlaskConical,
  Lock,
  Trash2,
  Loader2
} from "lucide-react";

interface FichaUnificadaModalProps {
  isOpen: boolean;
  loteId: string;
  lotes?: Lote[];
  humedades?: RegistroHumedad[];
  analisisHumedos?: AnalisisHumedo[];
  evaluacionConfig?: ConfiguracionEvaluacionLotes;
  currentUser?: UserProfile;
  onOpenConfigEvaluacion?: () => void;
  onSaveLote?: (lote: Partial<Lote>) => Promise<void>;
  onDeleteLote?: (loteId: string) => Promise<void>;
  onClose: () => void;
  onEditLote?: (loteId: string) => void;
}

export const FichaUnificadaModal: React.FC<FichaUnificadaModalProps> = ({
  isOpen,
  loteId,
  lotes = [],
  humedades = [],
  analisisHumedos = [],
  evaluacionConfig,
  currentUser,
  onOpenConfigEvaluacion,
  onSaveLote,
  onDeleteLote,
  onClose,
  onEditLote
}) => {
  const [filtroCategoria, setFiltroCategoria] = useState<"todos" | "humedad" | "fisicos" | "organolepticos">("todos");
  const [modalExperimentalOpen, setModalExperimentalOpen] = useState(false);
  const [noticeAccessDenied, setNoticeAccessDenied] = useState(false);
  const [updatedLoteLocal, setUpdatedLoteLocal] = useState<Lote | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const loteEncontrado: Lote = lotes.find((l) => l.LOTE_ID === loteId) || {
    LOTE_ID: loteId,
    CLIENTE: "Sin especificar",
    VARIEDAD: "Sin variedad",
    FECHA_INGRESO: new Date().toISOString().split("T")[0],
    ESTADO_LOTE: "Humedo",
    SACOS: 0,
    PESO_KG: 0,
    UBICACION: "",
    HUM: 14.0,
    HUMEDAD: 14.0,
    ZONA: "Sin zona",
    OBSERVACIONES: ""
  };

  const lote = updatedLoteLocal && updatedLoteLocal.LOTE_ID === loteId ? updatedLoteLocal : loteEncontrado;

  const hum = humedades.find((h) => h.LOTE_ID === loteId);
  const ah = analisisHumedos.find((a) => a.LOTE_ID === loteId);

  // Calcular métricas de humedad desde caladas
  let humProm: number | undefined = undefined;
  let desvHum: number | undefined = undefined;
  let caladasMuestras: number[] | undefined = undefined;

  if (hum) {
    const vals: number[] = [];
    for (let i = 1; i <= 14; i++) {
      const key = `M${i}` as keyof RegistroHumedad;
      const v = parseFloat(String(hum[key]));
      if (!isNaN(v) && v > 0) vals.push(v);
    }
    if (vals.length > 0) {
      caladasMuestras = vals;
      humProm = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (vals.length > 1) {
        desvHum = Math.sqrt(vals.reduce((acc, v) => acc + Math.pow(v - humProm!, 2), 0) / (vals.length - 1));
      } else {
        desvHum = 0;
      }
    }
  }

  // Si no hay caladas, usar valor del lote o del análisis
  if (humProm === undefined) {
    if (ah?.HUMEDADES) humProm = Number(ah.HUMEDADES);
    else if (lote.HUMEDAD) humProm = Number(lote.HUMEDAD);
  }
  if (desvHum === undefined && lote.DESV !== undefined) {
    desvHum = Number(lote.DESV);
  }

  const evaluacion = calcularEvaluacionLote(ah, lote, humProm, desvHum, evaluacionConfig, caladasMuestras || hum);

  // Agrupaciones dinámicas para la tabla
  const itemsHumedad = evaluacion.items.filter((i) => i.categoria === "HUMEDAD");
  const itemsFisicos = evaluacion.items.filter((i) => i.categoria === "FISICO_RENDIMIENTO" || i.categoria === "DEFECTOS_CALIDAD");
  const itemsOrganolepticos = evaluacion.items.filter((i) => i.categoria === "ORGANOLEPTICO");

  const cumpleCount = evaluacion.items.filter((i) => i.cumple).length;
  const noCumpleCount = evaluacion.items.length - cumpleCount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-850 border-b border-slate-750 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Ficha Técnica Unificada & Dictamen de Calidad</h3>
                <span className="px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded font-mono font-bold text-xs">
                  {lote.LOTE_ID}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Evaluación ponderada oficial bajo matriz de {evaluacion.items.length} parámetros ({evaluacion.maxPuntaje} pts / 100%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenConfigEvaluacion && (
              <button
                onClick={onOpenConfigEvaluacion}
                className="p-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg border border-amber-500/30 transition cursor-pointer"
                title="Configuración Maestra de Parámetros (%)"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handlePrint}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
              title="Imprimir Ficha"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* LOTE HEADER DETAILS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Cliente / Productor</span>
              <div className="flex items-center gap-1.5 font-bold text-white truncate">
                <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{lote.CLIENTE || "Sin registrar"}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Variedad / Procedencia</span>
              <div className="font-bold text-emerald-400">
                {lote.VARIEDAD || "Sin variedad"} {lote.ZONA ? `(${lote.ZONA})` : ""}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Fecha de Ingreso</span>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{lote.FECHA_INGRESO || "---"}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Volumen & Peso</span>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-bold text-white">{lote.SACOS || 0} sacos</span>
                <span className="text-slate-400">({lote.PESO_KG ? `${(lote.PESO_KG / 1000).toFixed(1)} TN` : "---"})</span>
              </div>
            </div>
          </div>

          {/* EVALUATION HERO BANNER */}
          <div className={`p-5 rounded-2xl border ${evaluacion.colorEstado} flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg`}>
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-current bg-slate-950 font-black">
                  <span className="text-2xl leading-none">{evaluacion.porcentajeAprobacion}%</span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5">
                    {evaluacion.tieneVetoCritico ? "VETO" : "Aprobación"}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span className="text-lg font-black tracking-wide">
                    DICTAMEN: LOTE {evaluacion.estadoAprobacion}
                  </span>
                  {evaluacion.tieneVetoCritico && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-600">
                      VETO CRÍTICO
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90">
                  {evaluacion.tieneVetoCritico
                    ? "Lote desaprobado automáticamente por infringir una o más reglas de veto crítico mandatorias."
                    : evaluacion.estadoAprobacion === "APROBADO" ? `Cumple satisfactoriamente con los estándares óptimos de rendimiento y sanidad (Puntaje > ${evaluacionConfig?.umbrales.umbralAprobado || 96}%).`
                    : evaluacion.estadoAprobacion === "OBSERVADO" || evaluacion.estadoAprobacion === "OBSERVADOS" || evaluacion.estadoAprobacion === "EN OBSERVACION" ? `Lote observado (Puntaje ${evaluacionConfig?.umbrales.umbralObservacion || 91}% a ${evaluacionConfig?.umbrales.umbralAprobado || 96}%). Requiere calibración o mezcla controlada.`
                    : evaluacion.estadoAprobacion === "EXPERIMENTAL" || evaluacion.estadoAprobacion === "CON RIESGO" ? `Lote experimental (Puntaje ${evaluacionConfig?.umbrales.umbralExperimental ?? evaluacionConfig?.umbrales.umbralRiesgo ?? 86}% a ${evaluacionConfig?.umbrales.umbralObservacion || 91}%). Requiere batch piloto o supervisión.`
                    : `Lote desaprobado por calidad (Puntaje < ${evaluacionConfig?.umbrales.umbralExperimental ?? evaluacionConfig?.umbrales.umbralRiesgo ?? 86}%). No apto para proceso estándar.`}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-4 text-[11px] pt-1">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {cumpleCount} parámetros cumplidos
                  </span>
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {noCumpleCount} desviaciones
                  </span>
                </div>
              </div>
            </div>

            {/* Score Legend Box */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1 shrink-0 w-full md:w-auto">
              <div className="text-slate-400 font-bold text-[10px] uppercase border-b border-slate-800 pb-1">
                Escala Oficial de Aprobación
              </div>
              <div className="flex items-center justify-between gap-4 text-emerald-400">
                <span>&gt; {evaluacionConfig?.umbrales.umbralAprobado || 96}%</span>
                <strong className="font-bold">Aprobado</strong>
              </div>
              <div className="flex items-center justify-between gap-4 text-amber-400">
                <span>{evaluacionConfig?.umbrales.umbralObservacion || 91}% a {evaluacionConfig?.umbrales.umbralAprobado || 96}%</span>
                <strong className="font-bold">Observados</strong>
              </div>
              <div className="flex items-center justify-between gap-4 text-orange-400">
                <span>{evaluacionConfig?.umbrales.umbralExperimental ?? evaluacionConfig?.umbrales.umbralRiesgo ?? 86}% a {(evaluacionConfig?.umbrales.umbralObservacion || 91) - 0.1}%</span>
                <strong className="font-bold">Experimental</strong>
              </div>
              <div className="flex items-center justify-between gap-4 text-rose-400">
                <span>&lt; {evaluacionConfig?.umbrales.umbralExperimental ?? evaluacionConfig?.umbrales.umbralRiesgo ?? 86}%</span>
                <strong className="font-bold">Desaprobado</strong>
              </div>
            </div>
          </div>

          {/* VETO CRITICO DETAILS BOX */}
          {evaluacion.tieneVetoCritico && evaluacion.motivosVeto.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-600/80 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>DETALLE DE VETOS CRÍTICOS QUE IMPIDEN LA APROBACIÓN:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {evaluacion.motivosVeto.map((veto, idx) => (
                  <div key={idx} className="bg-rose-900/40 p-2.5 rounded-xl border border-rose-700/60 text-rose-200">
                    <div className="font-black text-rose-300 flex items-center justify-between">
                      <span>{veto.parametro}</span>
                      <span className="text-[10px] font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-700">
                        Detectado: {veto.valorDetectado} (Máx: {veto.limitePermitido})
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-200 mt-1">{veto.descripcion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN ESPECIAL: RECLASIFICACIÓN A EXPERIMENTAL PARA LOTES DESAPROBADOS (SOLO JEFE DE ÁREA O PROGRAMADOR) */}
          {(evaluacion.estadoAprobacion === "DESAPROBADO" || evaluacion.tieneVetoCritico || lote.ES_EXPERIMENTAL || lote.AUTORIZACION_EXPERIMENTAL) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/80 via-slate-900 to-slate-900 border border-orange-600/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-600/20 text-orange-400 border border-orange-500/40 rounded-xl">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Reclasificación a Modo Experimental</span>
                      {lote.AUTORIZACION_EXPERIMENTAL ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-mono font-bold">
                          AUTORIZADO ACTIVO
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700 font-mono font-bold">
                          NO AUTORIZADO
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-300">
                      Permite ingresar lotes desaprobados al flujo de producción bajo supervisión y parámetros controlados de mezcla.
                    </p>
                  </div>
                </div>

                <div>
                  {lote.AUTORIZACION_EXPERIMENTAL ? (
                    <button
                      id="btn-ver-sustento-experimental-modal"
                      type="button"
                      onClick={() => setModalExperimentalOpen(true)}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-950/40 transition cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4 text-orange-200" />
                      <span>Ver / Modificar Sustento Experimental</span>
                    </button>
                  ) : (
                    <button
                      id="btn-pasar-exp-ficha-modal"
                      type="button"
                      onClick={() => setModalExperimentalOpen(true)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-orange-950/50 transition cursor-pointer border border-orange-400/40"
                    >
                      <FlaskConical className="w-4 h-4 text-orange-200" />
                      <span>🧪 Pasar a Modo Experimental</span>
                    </button>
                  )}
                </div>
              </div>

              {lote.AUTORIZACION_EXPERIMENTAL && (
                <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between text-slate-400 text-[11px] gap-2">
                    <span>
                      Autorizado por: <strong className="text-white">{lote.AUTORIZACION_EXPERIMENTAL.autorizadoPor}</strong> ({lote.AUTORIZACION_EXPERIMENTAL.rol})
                    </span>
                    <span className="text-emerald-400 font-medium">
                      Condición: {lote.AUTORIZACION_EXPERIMENTAL.condicionUso}
                    </span>
                  </div>
                  <div className="italic text-slate-200 font-serif bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    "{lote.AUTORIZACION_EXPERIMENTAL.sustento}"
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EVALUATION PARAMETERS TABLE */}
          <div className="bg-slate-850 rounded-2xl border border-slate-750 overflow-hidden">
            {/* Table Filter Tabs */}
            <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-750 flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFiltroCategoria("todos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filtroCategoria === "todos"
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-750"
                  }`}
                >
                  Todos los 24 Parámetros (100%)
                </button>
                <button
                  onClick={() => setFiltroCategoria("humedad")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filtroCategoria === "humedad"
                      ? "bg-cyan-500 text-slate-950 font-black"
                      : "bg-slate-800 text-cyan-300 hover:bg-slate-750"
                  }`}
                >
                  Humedad (9%)
                </button>
                <button
                  onClick={() => setFiltroCategoria("fisicos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filtroCategoria === "fisicos"
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-slate-800 text-emerald-300 hover:bg-slate-750"
                  }`}
                >
                  Físicos & Calidad (65%)
                </button>
                <button
                  onClick={() => setFiltroCategoria("organolepticos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filtroCategoria === "organolepticos"
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-800 text-amber-300 hover:bg-slate-750"
                  }`}
                >
                  Organolépticos (26%)
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-1.5 text-[10px] bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-bold">Escala:</span>
                  <span className="text-emerald-400 font-bold">P: Poco</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-400 font-bold">R: Regular</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-orange-400 font-bold">V: Variado</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-rose-400 font-bold">B: Bastante</span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Puntaje Total: <strong className="text-amber-400 text-sm">{evaluacion.puntajeTotal}</strong> / 100 pts
                </div>
              </div>
            </div>

            {/* The Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-750 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">Parámetro</th>
                    <th className="py-2.5 px-3">Abreviatura</th>
                    <th className="py-2.5 px-4">Condición de Apto</th>
                    <th className="py-2.5 px-3 text-center">% Asignado</th>
                    <th className="py-2.5 px-4 text-center">Valor Registrado</th>
                    <th className="py-2.5 px-3 text-center">% Obtenido</th>
                    <th className="py-2.5 px-3 text-center">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {/* SECCION HUMEDAD */}
                  {(filtroCategoria === "todos" || filtroCategoria === "humedad") && (
                    <>
                      <tr className="bg-cyan-950/30 text-cyan-400 font-bold text-[11px]">
                        <td colSpan={7} className="py-1.5 px-4 tracking-wider uppercase border-t border-b border-cyan-900/40">
                          Parámetros de Humedad & Muestreo (9% Total)
                        </td>
                      </tr>
                      {itemsHumedad.map((item, idx) => (
                        <tr key={idx} className={item.cumple ? "hover:bg-slate-800/40" : "bg-rose-950/10 hover:bg-rose-950/20"}>
                          <td className="py-2.5 px-4 font-semibold text-white">{item.nombre}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">{item.abreviatura}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-mono">{item.condicion}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-300">{item.peso}%</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-white">{item.valorActual}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                            {item.puntos > 0 ? `+${item.puntos}%` : "0%"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.cumple ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Apto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                <XCircle className="w-3 h-3" /> No cumple
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* SECCION RENDIMIENTOS Y CALIDAD FISICA */}
                  {(filtroCategoria === "todos" || filtroCategoria === "fisicos") && (
                    <>
                      <tr className="bg-emerald-950/30 text-emerald-400 font-bold text-[11px]">
                        <td colSpan={7} className="py-1.5 px-4 tracking-wider uppercase border-t border-b border-emerald-900/40">
                          Parámetros Físicos, Rendimiento & Defectos (65% Total)
                        </td>
                      </tr>
                      {itemsFisicos.map((item, idx) => (
                        <tr key={idx} className={item.cumple ? "hover:bg-slate-800/40" : "bg-rose-950/10 hover:bg-rose-950/20"}>
                          <td className="py-2.5 px-4 font-semibold text-white">{item.nombre}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{item.abreviatura}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-mono">{item.condicion}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-300">{item.peso}%</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-white">{item.valorActual}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                            {item.puntos > 0 ? `+${item.puntos}%` : "0%"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.cumple ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Apto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                <XCircle className="w-3 h-3" /> No cumple
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* SECCION ORGANOLEPTICOS */}
                  {(filtroCategoria === "todos" || filtroCategoria === "organolepticos") && (
                    <>
                      <tr className="bg-amber-950/30 text-amber-400 font-bold text-[11px]">
                        <td colSpan={7} className="py-1.5 px-4 tracking-wider uppercase border-t border-b border-amber-900/40">
                          Parámetros Organolépticos & Sanidad (26% Total)
                        </td>
                      </tr>
                      {itemsOrganolepticos.map((item, idx) => (
                        <tr key={idx} className={item.cumple ? "hover:bg-slate-800/40" : "bg-rose-950/10 hover:bg-rose-950/20"}>
                          <td className="py-2.5 px-4 font-semibold text-white">{item.nombre}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{item.abreviatura}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-mono">{item.condicion}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-300">{item.peso}%</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-white">{item.valorActual}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                            {item.puntos > 0 ? `+${item.puntos}%` : "0%"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.cumple ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Apto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                <XCircle className="w-3 h-3" /> No cumple
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                      Puntaje Total de Evaluación Ponderada:
                    </td>
                    <td className="py-3 px-3 text-center text-amber-400 font-black text-sm">100%</td>
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-black text-sm">
                      {evaluacion.puntajeTotal}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded text-xs font-black border ${evaluacion.colorEstado}`}>
                        {evaluacion.estadoAprobacion}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-t border-slate-750 shrink-0">
          <div className="text-xs text-slate-400">
            Regla Oficial: <strong className="text-emerald-400">≥95% Aprobado</strong> | <strong className="text-amber-400">85-94% Observación</strong> | <strong className="text-orange-400">80-84% Riesgo</strong> | <strong className="text-rose-400">&lt;80% Rechazado</strong>
          </div>

          <div className="flex items-center gap-2">
            {onDeleteLote && (
              <button
                type="button"
                onClick={() => setConfirmarEliminar(true)}
                className="px-3.5 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition mr-auto"
                title="Eliminar este lote permanentemente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Lote</span>
              </button>
            )}

            {onEditLote && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditLote(loteId);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                Editar Análisis del Lote
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer shadow"
            >
              Cerrar Ficha
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMACIÓN IN-APP PARA ELIMINAR LOTE */}
      {confirmarEliminar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-600/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">¿Eliminar este Lote?</h4>
                <p className="text-xs text-rose-300 font-mono">Código: {lote.LOTE_ID}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esta acción eliminará definitivamente el lote <strong>{lote.LOTE_ID}</strong> ({lote.CLIENTE} - {lote.VARIEDAD}) junto con sus registros de análisis físico, humedad y programación. <strong className="text-rose-400">Esta acción no se puede deshacer.</strong>
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmarEliminar(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteLote) return;
                  try {
                    setIsDeleting(true);
                    await onDeleteLote(lote.LOTE_ID);
                    setConfirmarEliminar(false);
                    onClose();
                  } catch (e: any) {
                    console.error("Error al eliminar lote:", e);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/40"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? "Eliminando..." : "Sí, Eliminar Lote"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CAMBIAR LOTE DESAPROBADO A EXPERIMENTAL */}
      {modalExperimentalOpen && (
        <ModalAutorizarExperimental
          isOpen={modalExperimentalOpen}
          lote={lote}
          evalResult={evaluacion}
          currentUser={currentUser}
          onClose={() => setModalExperimentalOpen(false)}
          onSuccess={async (updatedLote) => {
            setUpdatedLoteLocal(updatedLote);
            if (onSaveLote) {
              await onSaveLote(updatedLote);
            }
          }}
          onRevertSuccess={async (updatedLote) => {
            setUpdatedLoteLocal(updatedLote);
            if (onSaveLote) {
              await onSaveLote(updatedLote);
            }
          }}
        />
      )}

      {/* DIÁLOGO INFORMATIVO SI EL ROL NO TIENE PERMISO */}
      {noticeAccessDenied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-750 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-xl text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Acceso Restringido</h4>
                <p className="text-xs text-amber-300">Exclusivo Jefe de Área o Programador</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              La reclasificación de un lote desaprobado a condición experimental requiere rol de <strong>JEFE_PLANTA</strong>, <strong>JEFE_VAPORIZADO</strong>, <strong>PROGRAMADOR</strong> o <strong>ADMIN</strong> junto con el registro obligatorio del sustento técnico.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Su rol actual:</span>{" "}
              <strong className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">{currentUser?.rol || "Sin rol"}</strong>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setNoticeAccessDenied(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
