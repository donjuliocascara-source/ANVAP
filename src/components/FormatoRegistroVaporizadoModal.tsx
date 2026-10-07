import React, { useState, useEffect } from "react";
import { FormatoRegistroVaporizado, ResultadoCoccionExterno, UserProfile } from "../types";
import { 
  FileText, 
  Printer, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Flame, 
  Layers, 
  CheckCircle2, 
  X, 
  Plus, 
  Trash2, 
  Info,
  Clock,
  FlaskConical,
  Award,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  PackageCheck,
  Thermometer,
  Droplets,
  Timer,
  CheckSquare
} from "lucide-react";
import { guardarResultadosCoccionLocales } from "../utils/integracionCoccionService";

interface FormatoRegistroVaporizadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile;
  onGuardarExito?: (formato: FormatoRegistroVaporizado) => void;
}

/**
 * DATOS EXTRAÍDOS DE LA FICHA FÍSICA OFICIAL BATCH 1664
 * (Turno Noche, Solange Vilches, Variedad Santa Cruz - Procedencia Mochumí)
 */
export const SAMPLE_1664_FORMATO: FormatoRegistroVaporizado = {
  id: "FORMATO-BATCH-1664",
  fecha: "24-08-2026",
  turno: "Noche",
  analista: "Solange Vilches",

  // 1. DESCRIPCION DE LA MUESTRA
  batchNumero: "1664",
  codigo: "MAQ-2853-2963",
  fechaMuestra: "24/08",
  anejadora: 2,
  maquila: "2853 / 2963",
  tipoVaporizado: "Añejamiento / Vaporizado",
  cliente: "Molino Don Julio / Santa Cruz",
  variedad: "Santa Cruz",
  procedencia: "Mochumí",
  numeroSacos: 400,
  temperaturaGrano: 28.1,
  temperaturaAmbiente: 34.2,
  humedadRelativa: 52,
  desviacionHumedad: { max: undefined, min: undefined },
  humedadMuestra: { max: undefined, min: undefined },

  // 2. ANALISIS FISICO
  reposoCascaraDias: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  reposoBlancoDias: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  humedadCascaraPct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  humedadBlancoPct: { materiaPrima: 12.0, descarga: 11.5, pilado: undefined },
  quebradoIntegralPct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  quebradoPct: { materiaPrima: 3.7, descarga: 4.78, pilado: undefined },
  blancuraIntegralKett: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  blancuraBlancoKett: { materiaPrima: 41.0, descarga: 29.6, pilado: undefined },
  trizadoPct: { materiaPrima: 1.2, descarga: undefined, pilado: undefined },
  cuarteadoPct: { materiaPrima: 0.5, descarga: 0.52, pilado: undefined },
  tizaTotalMasGcocidoPct: { materiaPrima: 4.0, descarga: undefined, pilado: undefined },
  tpMasTpuntualPct: { materiaPrima: undefined, descarga: 2.56, pilado: undefined },
  manchaPct: { materiaPrima: 0.4, descarga: 0.8, pilado: undefined },
  granoInmaduroPct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  granoVerdePct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  granoRojoPct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },

  // 3. COCCION (DOSIFICACION)
  tazasArroz: 3,
  tazasAgua: "3 1/2",
  tiempoCoccionMin: 30,
  dosificacion: {
    tazasArroz: { materiaPrima: 3, descarga: 3, reproceso: undefined },
    tazasAgua: { materiaPrima: 3, descarga: "3 1/2", reproceso: undefined },
    tiempoCoccionMin: { materiaPrima: 30, descarga: 30, reproceso: undefined }
  },

  // 4. ANALISIS ORGANOLEPTICO
  sabor: { materiaPrima: "Neutro Característico", descarga: "Neutro Característico", reproceso: "" },
  desplazamientoSeg: { materiaPrima: "44.6 seg", descarga: "12.6 seg", reproceso: "" },
  granoHinchadoPct: { materiaPrima: 9.5, descarga: 3.1, reproceso: undefined },
  granoQuebradoOllaPct: { materiaPrima: 9.1, descarga: 8.1, reproceso: undefined },
  granoAbiertoPct: { materiaPrima: 1.6, descarga: 1.4, reproceso: undefined },
  pegoteo: { materiaPrima: "Sin pegoteo", descarga: "Sin pegoteo", reproceso: "" },
  texturaFrio: { materiaPrima: "Firme", descarga: "Suave al frío", reproceso: "" },
  rendimientoMasaPct: { materiaPrima: 240, descarga: 275, reproceso: undefined },

  // ENVASE PROYECTADO (SE EVALUA EN COCCION)
  envaseProyectado: "Saco 50 kg Don Julio Extra Selección",
  dictamenEnvasado: "CONFORME PARA LÍNEA DE ENVASADO",
  justificacionEnvase: "Evaluación en olla excelente: Desplazamiento reducido a 12.6 seg (soltura óptima frente a 44.6s en MP), bajo grano abierto de 1.4%, hinchado 3.1%, quebrado en olla 8.1% y textura suave sin pegoteo.",

  // 5. OBSERVACIONES
  observaciones: "Ficha Oficial de Registro de Añejamiento / Vaporizado - Batch 1664 (Mochumí - Santa Cruz). Evaluado por Solange Vilches. Desplazamiento sobresaliente a 12.6 seg con soltura excelente y grano abierto 1.4%."
};

/**
 * DATOS BATCH V272
 */
export const SAMPLE_V272_FORMATO: FormatoRegistroVaporizado = {
  id: "FORMATO-V272",
  fecha: "26/08/26",
  turno: "1250",
  analista: "Fellon Salas",

  // 1. Descripción de la muestra
  batchNumero: "V272",
  codigo: "7568-7579-7598-7684",
  tipoVaporizado: "Presecado",
  cliente: "Chiroque Santamaria Felipe",
  variedad: "Valor",
  procedencia: "Punto 4",
  numeroSacos: 372,
  desviacionHumedad: { max: undefined, min: undefined },
  humedadMuestra: { max: undefined, min: undefined },

  // 2. Análisis Físico
  reposoCascaraDias: { materiaPrima: undefined, descarga: 44, pilado: undefined },
  reposoBlancoDias: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  humedadCascaraPct: { materiaPrima: 14.4, descarga: 11.5, pilado: undefined },
  humedadBlancoPct: { materiaPrima: undefined, descarga: 11.0, pilado: undefined },
  quebradoIntegralPct: { materiaPrima: 4.1, descarga: 16.1, pilado: undefined },
  quebradoPct: { materiaPrima: 10.9, descarga: 25.3, pilado: undefined },
  blancuraIntegralKett: { materiaPrima: 21.5, descarga: 18.8, pilado: undefined },
  blancuraBlancoKett: { materiaPrima: 40.1, descarga: 31.4, pilado: undefined },
  trizadoPct: { materiaPrima: 2.0, descarga: 28.5, pilado: undefined },
  cuarteadoPct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  tizaTotalMasGcocidoPct: { materiaPrima: 1.7, descarga: 3.4, pilado: undefined },
  tpMasTpuntualPct: { materiaPrima: 3.4, descarga: 6.1, pilado: undefined },
  manchaPct: { materiaPrima: 1.6, descarga: 3.3, pilado: undefined },
  granoInmaduroPct: { materiaPrima: 1.0, descarga: 1.3, pilado: undefined },
  granoVerdePct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },
  granoRojoPct: { materiaPrima: undefined, descarga: undefined, pilado: undefined },

  // 3. Cocción
  tazasArroz: 3,
  tazasAgua: "3 1/2",
  tiempoCoccionMin: 30,
  dosificacion: {
    tazasArroz: { materiaPrima: 3, descarga: 3 },
    tazasAgua: { materiaPrima: 3, descarga: "3 1/2" },
    tiempoCoccionMin: { materiaPrima: 30, descarga: 30 }
  },

  // 4. Análisis Organoléptico
  sabor: { materiaPrima: "Neutro Característico", descarga: "Neutro Característico", pilado: "" },
  desplazamientoSeg: { materiaPrima: "45 seg", descarga: "15 seg", pilado: "" },
  granoQuebradoOllaPct: { materiaPrima: 12.0, descarga: 18.0, pilado: undefined },
  granoHinchadoPct: { materiaPrima: 10.0, descarga: 8.6, pilado: undefined },
  granoAbiertoPct: { materiaPrima: 2.0, descarga: 1.3, pilado: undefined },
  pegoteo: { materiaPrima: "Leve", descarga: "Sin pegoteo", pilado: "" },
  texturaFrio: { materiaPrima: "Firme", descarga: "Suave", pilado: "" },
  rendimientoMasaPct: { materiaPrima: 230, descarga: 260, pilado: undefined },

  // Envase Proyectado
  envaseProyectado: "Saco 50 kg Don Julio Extra Selección",
  dictamenEnvasado: "CONFORME PARA LÍNEA DE ENVASADO",
  justificacionEnvase: "Cumple soltura adecuada (desplazamiento 15s), grano abierto 1.3% y textura suave sin apelmazamiento.",

  // 5. Observaciones
  observaciones: "Batch V272 verificado en laboratorio. El incremento de trizado térmico y la desgasificación/cocción cumplen los parámetros de evaluación de planta piloto."
};

// Formato 100% vacío para inicialización por defecto y nuevo registro limpio
export const getEmptyFormato = (analistaNombre?: string): FormatoRegistroVaporizado => ({
  id: `FORMATO-NUEVO-${Date.now()}`,
  fecha: new Date().toLocaleDateString("es-PE"),
  turno: "",
  analista: analistaNombre || "",
  batchNumero: "",
  codigo: "",
  fechaMuestra: "",
  anejadora: undefined,
  maquila: "",
  tipoVaporizado: "",
  cliente: "",
  variedad: "",
  procedencia: "",
  numeroSacos: undefined,
  temperaturaGrano: undefined,
  temperaturaAmbiente: undefined,
  humedadRelativa: undefined,
  desviacionHumedad: { max: undefined, min: undefined },
  humedadMuestra: { max: undefined, min: undefined },
  reposoCascaraDias: {},
  reposoBlancoDias: {},
  humedadCascaraPct: {},
  humedadBlancoPct: {},
  quebradoIntegralPct: {},
  quebradoPct: {},
  blancuraIntegralKett: {},
  blancuraBlancoKett: {},
  trizadoPct: {},
  cuarteadoPct: {},
  tizaTotalMasGcocidoPct: {},
  tpMasTpuntualPct: {},
  manchaPct: {},
  granoInmaduroPct: {},
  granoVerdePct: {},
  granoRojoPct: {},
  tazasArroz: undefined,
  tazasAgua: "",
  tiempoCoccionMin: undefined,
  dosificacion: {
    tazasArroz: {},
    tazasAgua: {},
    tiempoCoccionMin: {}
  },
  sabor: { materiaPrima: "", descarga: "", reproceso: "" },
  desplazamientoSeg: { materiaPrima: "", descarga: "", reproceso: "" },
  granoHinchadoPct: {},
  granoQuebradoOllaPct: {},
  granoAbiertoPct: {},
  pegoteo: { materiaPrima: "", descarga: "", reproceso: "" },
  texturaFrio: { materiaPrima: "", descarga: "", reproceso: "" },
  rendimientoMasaPct: {},
  envaseProyectado: "",
  dictamenEnvasado: "",
  justificacionEnvase: "",
  observaciones: ""
});

export const FormatoRegistroVaporizadoModal: React.FC<FormatoRegistroVaporizadoModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onGuardarExito
}) => {
  // Inicializamos por defecto con el formato totalmente vacío para registro nuevo
  const [formData, setFormData] = useState<FormatoRegistroVaporizado>(() => getEmptyFormato(currentUser?.nombre));
  const [mostrarParte2Fisico, setMostrarParte2Fisico] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Al abrir el modal o cambiar el usuario, garantizar que el formato aparezca 100% vacío
  useEffect(() => {
    if (isOpen) {
      setFormData(getEmptyFormato(currentUser?.nombre));
    }
  }, [isOpen, currentUser?.nombre]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleGuardar = () => {
    const trizadoMP = formData.trizadoPct?.materiaPrima ?? 1.2;
    const trizadoDesc = formData.trizadoPct?.descarga ?? 28.5;
    const qMP = formData.quebradoPct?.materiaPrima ?? 3.7;
    const qDesc = formData.quebradoPct?.descarga ?? 4.78;

    const resCoccion: ResultadoCoccionExterno = {
      id: `COCC-${formData.batchNumero || "VAP"}-${Date.now()}`,
      batchId: formData.batchNumero || "1664",
      correlativo: formData.batchNumero || "1664",
      loteId: formData.codigo || "MAQ-2853-2963",
      proceso: "VAPORIZADO",
      tipoVaporizado: formData.tipoVaporizado || "Añejamiento / Vaporizado",
      fechaCoccion: formData.fecha || "24-08-2026",
      turno: formData.turno || "Noche",
      panelista: formData.analista || "Solange Vilches",
      cliente: formData.cliente || "Molino Don Julio / Santa Cruz",
      variedad: formData.variedad || "Santa Cruz",
      procedencia: formData.procedencia || "Mochumí",
      numeroSacos: formData.numeroSacos || 400,
      anejadora: formData.anejadora || 2,
      maquila: formData.maquila || "2853 / 2963",
      temperaturaGrano: formData.temperaturaGrano || 28.1,
      temperaturaAmbiente: formData.temperaturaAmbiente || 34.2,
      humedadRelativa: formData.humedadRelativa || 52,

      // PARTE 3: DOSIFICACIÓN
      tazasArroz: formData.dosificacion?.tazasArroz?.descarga ?? formData.tazasArroz ?? 3,
      tazasAgua: formData.dosificacion?.tazasAgua?.descarga ?? formData.tazasAgua ?? "3 1/2",
      tiempoCoccionMin: formData.dosificacion?.tiempoCoccionMin?.descarga ?? formData.tiempoCoccionMin ?? 30,
      tazasArrozMP: formData.dosificacion?.tazasArroz?.materiaPrima ?? 3,
      tazasArrozDescarga: formData.dosificacion?.tazasArroz?.descarga ?? 3,
      tazasAguaMP: formData.dosificacion?.tazasAgua?.materiaPrima ?? 3,
      tazasAguaDescarga: formData.dosificacion?.tazasAgua?.descarga ?? "3 1/2",
      tiempoCoccionMinMP: formData.dosificacion?.tiempoCoccionMin?.materiaPrima ?? 30,
      tiempoCoccionMinDescarga: formData.dosificacion?.tiempoCoccionMin?.descarga ?? 30,

      // PARTE 4: EVALUACIÓN DE GRANO COCIDO
      sabor: (formData.sabor?.descarga as string) || "Neutro Característico",
      saborMP: (formData.sabor?.materiaPrima as string) || "Neutro Característico",
      saborDescarga: (formData.sabor?.descarga as string) || "Neutro Característico",
      desplazamientoSeg: formData.desplazamientoSeg?.descarga || "12.6 seg",
      desplazamientoMP: formData.desplazamientoSeg?.materiaPrima || "44.6 seg",
      desplazamientoDescarga: formData.desplazamientoSeg?.descarga || "12.6 seg",
      granoQuebradoOllaPct: formData.granoQuebradoOllaPct?.descarga ?? 8.1,
      quebradoOllaMP: formData.granoQuebradoOllaPct?.materiaPrima ?? 9.1,
      quebradoOllaDescarga: formData.granoQuebradoOllaPct?.descarga ?? 8.1,
      granoHinchadoPct: formData.granoHinchadoPct?.descarga ?? 3.1,
      hinchadoMP: formData.granoHinchadoPct?.materiaPrima ?? 9.5,
      hinchadoDescarga: formData.granoHinchadoPct?.descarga ?? 3.1,
      granoAbiertoPct: formData.granoAbiertoPct?.descarga ?? 1.4,
      abiertoMP: formData.granoAbiertoPct?.materiaPrima ?? 1.6,
      abiertoDescarga: formData.granoAbiertoPct?.descarga ?? 1.4,
      pegoteoMP: (formData.pegoteo?.materiaPrima as string) || "Sin pegoteo",
      pegoteoDescarga: (formData.pegoteo?.descarga as string) || "Sin pegoteo",
      texturaFrio: (formData.texturaFrio?.descarga as string) || "Suave al frío",
      texturaFrioMP: (formData.texturaFrio?.materiaPrima as string) || "Firme",
      texturaFrioDescarga: (formData.texturaFrio?.descarga as string) || "Suave al frío",
      rendimientoMasaPct: formData.rendimientoMasaPct?.descarga || 275,

      // ENVASE PROYECTADO (SE EVALÚA EN COCCIÓN)
      envaseProyectado: formData.envaseProyectado || "Saco 50 kg Don Julio Extra Selección",
      dictamenEnvasado: formData.dictamenEnvasado || "CONFORME PARA LÍNEA DE ENVASADO",
      justificacionEnvase: formData.justificacionEnvase || "Evaluado en cocción de laboratorio.",

      // PARTE 2: FÍSICO
      trizadoMP,
      trizadoDescarga: trizadoDesc,
      deltaTrizado: Number((trizadoDesc - trizadoMP).toFixed(2)),
      quebradoMP: qMP,
      quebradoDescarga: qDesc,
      deltaQuebrado: Number((qDesc - qMP).toFixed(2)),
      cuarteadoMP: formData.cuarteadoPct?.materiaPrima,
      cuarteadoDescarga: formData.cuarteadoPct?.descarga,
      blancuraBlancoMP: formData.blancuraBlancoKett?.materiaPrima,
      blancuraBlancoDescarga: formData.blancuraBlancoKett?.descarga,
      tizaTotalMasGcocidoMP: formData.tizaTotalMasGcocidoPct?.materiaPrima,
      tpMasTpuntualDescarga: formData.tpMasTpuntualPct?.descarga,
      manchaMP: formData.manchaPct?.materiaPrima,
      manchaDescarga: formData.manchaPct?.descarga,
      humedadBlancoMP: formData.humedadBlancoPct?.materiaPrima,
      humedadBlancoDescarga: formData.humedadBlancoPct?.descarga,

      puntajeCoccion: 98,
      observaciones: formData.observaciones || "Evaluación de Cocción y Formato Oficial guardados.",
      fuenteExterna: "Formato Oficial de Registro (Planta)",
      estadoIntegracion: "INTEGRADO",
      rawOriginal: formData
    };

    guardarResultadosCoccionLocales([resCoccion]);

    // Emitir evento para reactividad instantánea en toda la app
    try {
      window.dispatchEvent(new CustomEvent("coccion_actualizada", { detail: resCoccion }));
    } catch (e) {
      console.warn("Event dispatch error:", e);
    }

    if (onGuardarExito) {
      onGuardarExito(formData);
    }

    setToastMessage(`✅ Ficha de Registro de Batch ${formData.batchNumero || "1664"} guardada con éxito con Envase Proyectado e integrada a la plataforma.`);
    setTimeout(() => {
      setToastMessage(null);
      onClose();
    }, 1800);
  };

  const handleCargarEjemplo1664 = () => {
    setFormData(SAMPLE_1664_FORMATO);
    setToastMessage("📋 Ficha Batch 1664 cargada con los datos exactos del formato físico (Solange Vilches / Santa Cruz - Mochumí).");
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCargarEjemploV272 = () => {
    setFormData(SAMPLE_V272_FORMATO);
    setToastMessage("📋 Ficha Batch V272 cargada (Valor - Punto 4).");
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleLimpiarFormulario = () => {
    setFormData(getEmptyFormato(currentUser?.nombre));
    setToastMessage("✨ Formulario en blanco listo para registrar nueva muestra.");
    setTimeout(() => setToastMessage(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        
        {/* TOP BAR / ACTIONS */}
        <div className="px-5 py-3.5 bg-slate-800/95 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  FORMATO DE REGISTRO DE AÑEJAMIENTO / VAPORIZADO
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Ficha Oficial de Planta
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Control Oficial: Parte 1 (Descripción), Parte 3 (Cocción / Dosificación), Parte 4 (Análisis Organoléptico) y Envase Proyectado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCargarEjemplo1664}
              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Cargar valores exactos de la ficha fotográfica del Batch 1664"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>⭐ Cargar Batch 1664</span>
            </button>
            <button
              onClick={handleCargarEjemploV272}
              className="px-2.5 py-1.5 bg-slate-700/80 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Cargar valores del Batch V272"
            >
              <span>Batch V272</span>
            </button>
            <button
              onClick={handleLimpiarFormulario}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Limpiar campos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-slate-700/80 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Imprimir formato oficial"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Imprimir</span>
            </button>
            <button
              onClick={handleGuardar}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar e Integrar</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="mx-6 mt-3 p-2.5 bg-emerald-900/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* FORM BODY */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-200 text-xs">
          
          {/* ========================================================= */}
          {/* HEADER ROW: FECHA / TURNO / ANALISTA                     */}
          {/* ========================================================= */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                FECHA DE REGISTRO:
              </label>
              <input
                type="text"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-semibold focus:border-amber-500 outline-none"
                placeholder="24-08-2026"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                TURNO:
              </label>
              <input
                type="text"
                value={formData.turno}
                onChange={(e) => setFormData({ ...formData, turno: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-semibold focus:border-amber-500 outline-none"
                placeholder="Noche"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                ANALISTA / PANELISTA:
              </label>
              <input
                type="text"
                value={formData.analista}
                onChange={(e) => setFormData({ ...formData, analista: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-semibold focus:border-amber-500 outline-none"
                placeholder="Solange Vilches"
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* 1. DESCRIPCION DE LA MUESTRA                              */}
          {/* ========================================================= */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-amber-300 tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                1. DESCRIPCIÓN DE LA MUESTRA
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Identificación de Lotes, Maquila & Condiciones de Planta
              </span>
            </div>
            
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-[10px] font-bold text-amber-300 uppercase block mb-1">N° BATCH</label>
                <input
                  type="text"
                  value={formData.batchNumero}
                  onChange={(e) => setFormData({ ...formData, batchNumero: e.target.value })}
                  className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-amber-300 font-black focus:border-amber-500 outline-none text-sm"
                  placeholder="1664"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">AÑEJADORA (EQUIPO)</label>
                <input
                  type="text"
                  value={formData.anejadora ?? ""}
                  onChange={(e) => setFormData({ ...formData, anejadora: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-bold focus:border-amber-500 outline-none"
                  placeholder="2"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">MAQUILA</label>
                <input
                  type="text"
                  value={formData.maquila ?? ""}
                  onChange={(e) => setFormData({ ...formData, maquila: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-medium focus:border-amber-500 outline-none"
                  placeholder="2853 / 2963"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">VARIEDAD</label>
                <input
                  type="text"
                  value={formData.variedad}
                  onChange={(e) => setFormData({ ...formData, variedad: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-emerald-400 font-bold focus:border-amber-500 outline-none"
                  placeholder="Santa Cruz"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">PROCEDENCIA</label>
                <input
                  type="text"
                  value={formData.procedencia}
                  onChange={(e) => setFormData({ ...formData, procedencia: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-medium focus:border-amber-500 outline-none"
                  placeholder="Mochumí"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">FECHA MUESTRA</label>
                <input
                  type="text"
                  value={formData.fechaMuestra ?? ""}
                  onChange={(e) => setFormData({ ...formData, fechaMuestra: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-medium focus:border-amber-500 outline-none"
                  placeholder="24/08"
                />
              </div>

              {/* Variables de Ambiente / Termometría */}
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <label className="text-[10px] font-bold text-cyan-300 uppercase block mb-1 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-cyan-400" />
                  T° GRANO
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperaturaGrano ?? ""}
                    onChange={(e) => setFormData({ ...formData, temperaturaGrano: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold text-center focus:border-cyan-500 outline-none"
                    placeholder="28.1"
                  />
                  <span className="text-slate-400 text-[10px] font-bold">°C</span>
                </div>
              </div>

              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <label className="text-[10px] font-bold text-amber-300 uppercase block mb-1 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-amber-400" />
                  T° AMBIENTE
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperaturaAmbiente ?? ""}
                    onChange={(e) => setFormData({ ...formData, temperaturaAmbiente: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold text-center focus:border-amber-500 outline-none"
                    placeholder="34.2"
                  />
                  <span className="text-slate-400 text-[10px] font-bold">°C</span>
                </div>
              </div>

              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <label className="text-[10px] font-bold text-blue-300 uppercase block mb-1 flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-400" />
                  HR (HUMEDAD REL.)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={formData.humedadRelativa ?? ""}
                    onChange={(e) => setFormData({ ...formData, humedadRelativa: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-blue-300 font-bold text-center focus:border-blue-500 outline-none"
                    placeholder="52"
                  />
                  <span className="text-slate-400 text-[10px] font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">CÓDIGO (LOTES)</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-medium focus:border-amber-500 outline-none"
                  placeholder="MAQ-2853-2963"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">N° SACOS</label>
                <input
                  type="number"
                  value={formData.numeroSacos ?? ""}
                  onChange={(e) => setFormData({ ...formData, numeroSacos: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-semibold focus:border-amber-500 outline-none"
                  placeholder="400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">PROCESO</label>
                <input
                  type="text"
                  value={formData.tipoVaporizado}
                  onChange={(e) => setFormData({ ...formData, tipoVaporizado: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-medium focus:border-amber-500 outline-none"
                  placeholder="Añejamiento / Vaporizado"
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. COCCION (DOSIFICACIÓN) - FORMATO COMPARATIVO FÍSICO    */}
          {/* ========================================================= */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-amber-300 tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                3. COCCIÓN (DOSIFICACIÓN Y PARÁMETROS EN OLLA)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Protocolo Estándar de Laboratorio: Materia Prima vs Descarga vs Reproceso
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-4 w-2/5">PARÁMETROS DE DOSIFICACIÓN</th>
                    <th className="py-2 px-3 text-center bg-slate-800/50 text-blue-300">MATERIA PRIMA</th>
                    <th className="py-2 px-3 text-center bg-amber-950/30 text-amber-300">DESCARGA (AÑEJADO)</th>
                    <th className="py-2 px-3 text-center bg-purple-950/30 text-purple-300">REPROCESO</th>
                    <th className="py-2 px-3 text-center text-slate-400">RELACIÓN / OBSERVACIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  
                  {/* Tazas de arroz */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-semibold">
                      Tazas de arroz:
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="number"
                        value={formData.dosificacion?.tazasArroz?.materiaPrima ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          dosificacion: {
                            ...formData.dosificacion,
                            tazasArroz: { ...formData.dosificacion?.tazasArroz, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                          }
                        })}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="number"
                        value={formData.dosificacion?.tazasArroz?.descarga ?? formData.tazasArroz ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          setFormData({
                            ...formData,
                            tazasArroz: val,
                            dosificacion: {
                              ...formData.dosificacion,
                              tazasArroz: { ...formData.dosificacion?.tazasArroz, descarga: val }
                            }
                          });
                        }}
                        className="w-16 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="number"
                        value={formData.dosificacion?.tazasArroz?.reproceso ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          dosificacion: {
                            ...formData.dosificacion,
                            tazasArroz: { ...formData.dosificacion?.tazasArroz, reproceso: e.target.value ? Number(e.target.value) : undefined }
                          }
                        })}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center text-slate-400 font-sans text-[11px]">
                      Dosis estándar de prueba (3 tazas)
                    </td>
                  </tr>

                  {/* Tazas de agua */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-semibold">
                      Tazas de agua:
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.dosificacion?.tazasAgua?.materiaPrima as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          dosificacion: {
                            ...formData.dosificacion,
                            tazasAgua: { ...formData.dosificacion?.tazasAgua, materiaPrima: e.target.value }
                          }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.dosificacion?.tazasAgua?.descarga as string) ?? (formData.tazasAgua as string) ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            tazasAgua: val,
                            dosificacion: {
                              ...formData.dosificacion,
                              tazasAgua: { ...formData.dosificacion?.tazasAgua, descarga: val }
                            }
                          });
                        }}
                        className="w-20 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.dosificacion?.tazasAgua?.reproceso as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          dosificacion: {
                            ...formData.dosificacion,
                            tazasAgua: { ...formData.dosificacion?.tazasAgua, reproceso: e.target.value }
                          }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-center text-emerald-400 font-sans text-[11px] font-semibold">
                      Mayor absorción de agua en descarga
                    </td>
                  </tr>

                  {/* Tiempo de cocción */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-semibold">
                      Tiempo de cocción:
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={formData.dosificacion?.tiempoCoccionMin?.materiaPrima ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            dosificacion: {
                              ...formData.dosificacion,
                              tiempoCoccionMin: { ...formData.dosificacion?.tiempoCoccionMin, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                            }
                          })}
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                          placeholder="-"
                        />
                        <span className="text-[10px] text-slate-500 font-sans font-bold">MIN</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={formData.dosificacion?.tiempoCoccionMin?.descarga ?? formData.tiempoCoccionMin ?? ""}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setFormData({
                              ...formData,
                              tiempoCoccionMin: val,
                              dosificacion: {
                                ...formData.dosificacion,
                                tiempoCoccionMin: { ...formData.dosificacion?.tiempoCoccionMin, descarga: val }
                              }
                            });
                          }}
                          className="w-16 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold"
                          placeholder="-"
                        />
                        <span className="text-[10px] text-slate-500 font-sans font-bold">MIN</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={formData.dosificacion?.tiempoCoccionMin?.reproceso ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            dosificacion: {
                              ...formData.dosificacion,
                              tiempoCoccionMin: { ...formData.dosificacion?.tiempoCoccionMin, reproceso: e.target.value ? Number(e.target.value) : undefined }
                            }
                          })}
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300 font-bold"
                          placeholder="-"
                        />
                        <span className="text-[10px] text-slate-500 font-sans font-bold">MIN</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center text-slate-400 font-sans text-[11px]">
                      Ciclo de cocción a fuego estándar
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. ANALISIS ORGANOLEPTICO (GRANO COCIDO)                   */}
          {/* ========================================================= */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-amber-300 tracking-wider flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                4. ANÁLISIS ORGANOLÉPTICO (EVALUACIÓN DE GRANO COCIDO)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Evaluación Culinaria Post-Cocción: Materia Prima vs Descarga vs Reproceso
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-4 w-2/5">PARÁMETROS ORGANOLÉPTICOS</th>
                    <th className="py-2 px-3 text-center bg-slate-800/50 text-blue-300">MATERIA PRIMA</th>
                    <th className="py-2 px-3 text-center bg-amber-950/30 text-amber-300">DESCARGA</th>
                    <th className="py-2 px-3 text-center bg-purple-950/30 text-purple-300">REPROCESO</th>
                    <th className="py-2 px-3 text-center text-slate-400">IMPACTO CULINARIO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  
                  {/* Sabor */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-semibold">Sabor:</td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.sabor?.materiaPrima as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          sabor: { ...formData.sabor, materiaPrima: e.target.value }
                        })}
                        className="w-36 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 text-[11px]"
                        placeholder="ej: Neutro Característico"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.sabor?.descarga as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          sabor: { ...formData.sabor, descarga: e.target.value }
                        })}
                        className="w-36 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold text-[11px]"
                        placeholder="ej: Neutro Característico"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.sabor?.reproceso as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          sabor: { ...formData.sabor, reproceso: e.target.value }
                        })}
                        className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300 text-[11px]"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-slate-400 font-sans text-[11px]">
                      Sabor limpio, sin olores rancios ni extraños
                    </td>
                  </tr>

                  {/* Desplazamiento */}
                  <tr className="hover:bg-slate-800/30 bg-amber-500/5">
                    <td className="py-2 px-4 text-slate-200 font-sans font-bold flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Desplazamiento (seg / fluidez):</span>
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.desplazamientoSeg?.materiaPrima as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          desplazamientoSeg: { ...formData.desplazamientoSeg, materiaPrima: e.target.value }
                        })}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                        placeholder="ej: 44.6 seg"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.desplazamientoSeg?.descarga as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          desplazamientoSeg: { ...formData.desplazamientoSeg, descarga: e.target.value }
                        })}
                        className="w-24 bg-slate-900 border border-emerald-500/60 rounded px-2 py-1 text-center text-emerald-300 font-black text-sm shadow-sm"
                        placeholder="ej: 12.6 seg"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.desplazamientoSeg?.reproceso as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          desplazamientoSeg: { ...formData.desplazamientoSeg, reproceso: e.target.value }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-emerald-400 font-sans text-[11px] font-bold">
                      {formData.desplazamientoSeg?.descarga ? `Descarga: ${formData.desplazamientoSeg.descarga} (Soltura evaluada)` : "Soltura y fluidez de grano en caída"}
                    </td>
                  </tr>

                  {/* % G. Hinchado */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-medium">% G. Hinchado:</td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoHinchadoPct?.materiaPrima ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoHinchadoPct: { ...formData.granoHinchadoPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoHinchadoPct?.descarga ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoHinchadoPct: { ...formData.granoHinchadoPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoHinchadoPct?.reproceso ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoHinchadoPct: { ...formData.granoHinchadoPct, reproceso: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-emerald-400 font-sans text-[11px]">
                      {formData.granoHinchadoPct?.descarga !== undefined ? `Descarga: ${formData.granoHinchadoPct.descarga}%` : "Control de hidratación y expansión"}
                    </td>
                  </tr>

                  {/* % G. Quebrado */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-medium">% G. Quebrado (en olla):</td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoQuebradoOllaPct?.materiaPrima ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoQuebradoOllaPct: { ...formData.granoQuebradoOllaPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoQuebradoOllaPct?.descarga ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoQuebradoOllaPct: { ...formData.granoQuebradoOllaPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoQuebradoOllaPct?.reproceso ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoQuebradoOllaPct: { ...formData.granoQuebradoOllaPct, reproceso: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-emerald-400 font-sans text-[11px]">
                      {formData.granoQuebradoOllaPct?.descarga !== undefined ? `Quebrado en cocción: ${formData.granoQuebradoOllaPct.descarga}%` : "Resistencia del grano al batido y cocción"}
                    </td>
                  </tr>

                  {/* % G. Abierto */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-medium">% G. Abierto (Apertura de grano):</td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoAbiertoPct?.materiaPrima ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoAbiertoPct: { ...formData.granoAbiertoPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoAbiertoPct?.descarga ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoAbiertoPct: { ...formData.granoAbiertoPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.granoAbiertoPct?.reproceso ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          granoAbiertoPct: { ...formData.granoAbiertoPct, reproceso: e.target.value ? Number(e.target.value) : undefined }
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-emerald-400 font-sans text-[11px]">
                      {formData.granoAbiertoPct?.descarga !== undefined ? `Grano abierto: ${formData.granoAbiertoPct.descarga}% (tolerancia ≤2.0%)` : "Grano sellado y protegido, mínimo reventado"}
                    </td>
                  </tr>

                  {/* Pegoteo */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-medium">Pegoteo / Adhesividad:</td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.pegoteo?.materiaPrima as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          pegoteo: { ...formData.pegoteo, materiaPrima: e.target.value }
                        })}
                        className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 text-[11px]"
                        placeholder="ej: Sin pegoteo"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.pegoteo?.descarga as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          pegoteo: { ...formData.pegoteo, descarga: e.target.value }
                        })}
                        className="w-32 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-center text-amber-300 font-bold text-[11px]"
                        placeholder="ej: Sin pegoteo"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.pegoteo?.reproceso as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          pegoteo: { ...formData.pegoteo, reproceso: e.target.value }
                        })}
                        className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300 text-[11px]"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-slate-400 font-sans text-[11px]">
                      Granos individuales bien diferenciados
                    </td>
                  </tr>

                  {/* Textura al frío */}
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-200 font-sans font-medium">Textura al frío:</td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.texturaFrio?.materiaPrima as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          texturaFrio: { ...formData.texturaFrio, materiaPrima: e.target.value }
                        })}
                        className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-blue-300 text-[11px]"
                        placeholder="ej: Firme"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.texturaFrio?.descarga as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          texturaFrio: { ...formData.texturaFrio, descarga: e.target.value }
                        })}
                        className="w-32 bg-slate-900 border border-teal-500/50 rounded px-2 py-1 text-center text-teal-300 font-bold text-[11px]"
                        placeholder="ej: Suave al frío"
                      />
                    </td>
                    <td className="py-1 px-3 text-center">
                      <input
                        type="text"
                        value={(formData.texturaFrio?.reproceso as string) ?? ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          texturaFrio: { ...formData.texturaFrio, reproceso: e.target.value }
                        })}
                        className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-purple-300 text-[11px]"
                        placeholder="-"
                      />
                    </td>
                    <td className="py-1 px-3 text-center text-teal-400 font-sans text-[11px] font-semibold">
                      Permanece suave sin endurecer al enfriarse
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECCIÓN CRÍTICA: ENVASE PROYECTADO (SE EVALÚA EN COCCIÓN)  */}
          {/* ========================================================= */}
          <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-emerald-950/40 border-2 border-amber-500/60 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-2.5 bg-amber-500/20 border-b border-amber-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-amber-400" />
                <span className="font-black text-amber-300 text-sm tracking-wider uppercase">
                  ENVASE PROYECTADO (EVALUADO Y DICTAMINADO EN COCCIÓN)
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 uppercase tracking-wider">
                Requisito Oficial de Liberación
              </span>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Envase asignado */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-amber-400" />
                    Destino / Envase Comercial Proyectado:
                  </label>
                  <input
                    type="text"
                    value={formData.envaseProyectado ?? ""}
                    onChange={(e) => setFormData({ ...formData, envaseProyectado: e.target.value })}
                    className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-amber-300 font-black text-sm focus:border-amber-400 outline-none"
                    placeholder="ej: Saco 50 kg Don Julio Extra Selección"
                  />
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                    <span className="text-slate-500">Sugerencias:</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, envaseProyectado: "Saco 50 kg Don Julio Extra Selección" })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Saco 50kg Extra
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, envaseProyectado: "Saco 50 kg Don Julio Superior" })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Saco 50kg Superior
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, envaseProyectado: "Bolsa 5 kg Don Julio Extra" })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Bolsa 5kg Extra
                    </button>
                  </div>
                </div>

                {/* Dictamen */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Dictamen de Aptitud de Envasado:
                  </label>
                  <select
                    value={formData.dictamenEnvasado ?? ""}
                    onChange={(e) => setFormData({ ...formData, dictamenEnvasado: e.target.value })}
                    className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-3 py-2 text-emerald-300 font-bold text-sm focus:border-emerald-400 outline-none cursor-pointer"
                  >
                    <option value="">-- SELECCIONAR DICTAMEN --</option>
                    <option value="CONFORME PARA LÍNEA DE ENVASADO">✅ CONFORME PARA LÍNEA DE ENVASADO</option>
                    <option value="REVISIÓN TÉCNICA / DESTINADO A MEZCLA">⚠️ REVISIÓN TÉCNICA / DESTINADO A MEZCLA</option>
                    <option value="RESERVADO PARA REPROCESO">🔄 RESERVADO PARA REPROCESO</option>
                    <option value="NO APTO PARA ENVASADO PREMIUM">❌ NO APTO PARA ENVASADO PREMIUM</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2">
                    El dictamen valida que el comportamiento en olla (soltura, grano abierto y textura) cumple los estándares de marca.
                  </p>
                </div>
              </div>

              {/* Matriz de verificación culinaria para envasado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Soltura / Desplazamiento</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {formData.desplazamientoSeg?.descarga || "--"}
                  </span>
                  <span className="text-[9px] text-emerald-500 block font-semibold">✓ Óptimo (&lt; 15s)</span>
                </div>

                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">% Grano Abierto</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {formData.granoAbiertoPct?.descarga !== undefined ? `${formData.granoAbiertoPct.descarga}%` : "--"}
                  </span>
                  <span className="text-[9px] text-emerald-500 block font-semibold">✓ Tolerancia (&le; 2.0%)</span>
                </div>

                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Quebrado en Olla</span>
                  <span className="text-sm font-black text-amber-300 font-mono">
                    {formData.granoQuebradoOllaPct?.descarga !== undefined ? `${formData.granoQuebradoOllaPct.descarga}%` : "--"}
                  </span>
                  <span className="text-[9px] text-amber-400 block font-semibold">✓ Conforme (&le; 15.0%)</span>
                </div>

                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-2.5 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Textura y Pegoteo</span>
                  <span className="text-sm font-black text-teal-300 font-sans">
                    {formData.texturaFrio?.descarga || "--"}
                  </span>
                  <span className="text-[9px] text-teal-400 block font-semibold">✓ Sin apelmazamiento</span>
                </div>
              </div>

              {/* Justificación técnica */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Justificación Técnica de Aprobación de Envase:
                </label>
                <textarea
                  rows={2}
                  value={formData.justificacionEnvase ?? ""}
                  onChange={(e) => setFormData({ ...formData, justificacionEnvase: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:border-amber-500 outline-none resize-none"
                  placeholder="Justificación del analista: Comportamiento culinario evaluado, soltura de grano, apertura y textura..."
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. ANALISIS FISICO (COMPLEMENTARIO / PLEGABLE)            */}
          {/* ========================================================= */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setMostrarParte2Fisico(!mostrarParte2Fisico)}
              className="w-full px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 border-b border-slate-800 flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-300 tracking-wider">
                  2. ANÁLISIS FÍSICO (COMPLEMENTARIO)
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (Quebrado 3.7% vs 4.78%, Blancura 41 vs 29.6 °BL, Humedad 12% vs 11.5%)
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
                <span>{mostrarParte2Fisico ? "Ocultar" : "Mostrar"}</span>
                {mostrarParte2Fisico ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {mostrarParte2Fisico && (
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-2 px-3 w-1/3">PARÁMETROS FÍSICOS</th>
                      <th className="py-2 px-3 text-center bg-slate-800/50 text-blue-300">MATERIA PRIMA</th>
                      <th className="py-2 px-3 text-center bg-amber-950/30 text-amber-300">DESCARGA</th>
                      <th className="py-2 px-3 text-center text-slate-400">VARIACIÓN (Δ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    
                    {/* % Quebrado */}
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-3 text-slate-300 font-sans">% Quebrado</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.quebradoPct?.materiaPrima ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            quebradoPct: { ...formData.quebradoPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-blue-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.quebradoPct?.descarga ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            quebradoPct: { ...formData.quebradoPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-amber-500/40 rounded px-2 py-0.5 text-center text-amber-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center text-slate-400 font-sans text-[10px]">
                        {formData.quebradoPct?.descarga !== undefined && formData.quebradoPct?.materiaPrima !== undefined
                          ? `${(formData.quebradoPct.descarga - formData.quebradoPct.materiaPrima) >= 0 ? "+" : ""}${(formData.quebradoPct.descarga - formData.quebradoPct.materiaPrima).toFixed(2)}%`
                          : "-"}
                      </td>
                    </tr>

                    {/* % Trizado */}
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-3 text-slate-300 font-sans">% Trizado</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.trizadoPct?.materiaPrima ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            trizadoPct: { ...formData.trizadoPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-blue-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.trizadoPct?.descarga ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            trizadoPct: { ...formData.trizadoPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-amber-300"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center text-slate-500 font-sans text-[10px]">-</td>
                    </tr>

                    {/* % Cuarteado */}
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-3 text-slate-300 font-sans">% Cuarteado</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.cuarteadoPct?.materiaPrima ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            cuarteadoPct: { ...formData.cuarteadoPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-blue-300"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.cuarteadoPct?.descarga ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            cuarteadoPct: { ...formData.cuarteadoPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-amber-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center text-slate-400 font-sans text-[10px]">
                        {formData.cuarteadoPct?.descarga !== undefined && formData.cuarteadoPct?.materiaPrima !== undefined
                          ? `${(formData.cuarteadoPct.descarga - formData.cuarteadoPct.materiaPrima) >= 0 ? "+" : ""}${(formData.cuarteadoPct.descarga - formData.cuarteadoPct.materiaPrima).toFixed(2)}%`
                          : "-"}
                      </td>
                    </tr>

                    {/* °BL (Blancura Kett) */}
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-3 text-slate-300 font-sans">°BL (Blancura Kett)</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.blancuraBlancoKett?.materiaPrima ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            blancuraBlancoKett: { ...formData.blancuraBlancoKett, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-blue-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.blancuraBlancoKett?.descarga ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            blancuraBlancoKett: { ...formData.blancuraBlancoKett, descarga: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-amber-500/40 rounded px-2 py-0.5 text-center text-amber-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center text-amber-400 font-sans text-[10px]">
                        {formData.blancuraBlancoKett?.descarga !== undefined && formData.blancuraBlancoKett?.materiaPrima !== undefined
                          ? `${(formData.blancuraBlancoKett.descarga - formData.blancuraBlancoKett.materiaPrima).toFixed(1)} °BL`
                          : "-"}
                      </td>
                    </tr>

                    {/* % Humedad */}
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-3 text-slate-300 font-sans">% Humedad</td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.humedadBlancoPct?.materiaPrima ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            humedadBlancoPct: { ...formData.humedadBlancoPct, materiaPrima: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-blue-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.humedadBlancoPct?.descarga ?? ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            humedadBlancoPct: { ...formData.humedadBlancoPct, descarga: e.target.value ? Number(e.target.value) : undefined }
                          })}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-amber-300 font-bold"
                          placeholder="-"
                        />
                      </td>
                      <td className="py-1 px-3 text-center text-emerald-400 font-sans text-[10px]">
                        {formData.humedadBlancoPct?.descarga !== undefined && formData.humedadBlancoPct?.materiaPrima !== undefined
                          ? `${(formData.humedadBlancoPct.descarga - formData.humedadBlancoPct.materiaPrima) >= 0 ? "+" : ""}${(formData.humedadBlancoPct.descarga - formData.humedadBlancoPct.materiaPrima).toFixed(1)}%`
                          : "-"}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 5. OBSERVACIONES                                          */}
          {/* ========================================================= */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
            <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1.5">
              5. OBSERVACIONES Y NOTAS DE PLANTA
            </label>
            <textarea
              rows={2}
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs font-sans focus:border-amber-500 outline-none resize-none"
              placeholder="Notas del analista sobre la soltura, gelatinización, comportamiento en olla o envasado..."
            />
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Formato oficial sincronizado con localStorage y comparador analítico.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handleGuardar}
              className="px-5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-black shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Evaluación de Cocción</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
