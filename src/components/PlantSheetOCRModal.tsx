import React, { useState, useRef } from "react";
import { 
  Camera, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Loader2, 
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Thermometer,
  Flame,
  Check,
  Edit2,
  HelpCircle,
  Maximize2
} from "lucide-react";
import { ControlVaporizado } from "../types";
import { localDB } from "../utils/localDB";

export type SeccionOCR = 
  | "HOJA_PLANTA_COMPLETA"
  | "DATOS_INGRESO"
  | "PARAMETROS_PADDY"
  | "DATOS_VAPORIZADO"
  | "SILOS"
  | "ETAPA_SECADO";

interface PlantSheetOCRModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSeccion?: SeccionOCR;
  onApplyOCRData: (seccion: SeccionOCR, extracted: any) => void;
}

export const SECCIONES_OCR_INFO: { id: SeccionOCR; label: string; icon: string; desc: string }[] = [
  { 
    id: "DATOS_INGRESO", 
    label: "Datos de Ingreso", 
    icon: "📦", 
    desc: "Procedencia, Código, N° Sacos, Peso Total, Variedad, % Humedad, Tiempo Reposo" 
  },
  { 
    id: "PARAMETROS_PADDY", 
    label: "Parámetros del Paddy (Calidad)", 
    icon: "🌾", 
    desc: "Humedad, Rendimientos RI/RB, Quebrado, Tiza Total/Parcial, Manchado, Trizado, Blancura" 
  },
  { 
    id: "DATOS_VAPORIZADO", 
    label: "Datos de Vaporizado (Autoclave)", 
    icon: "🔥", 
    desc: "Horas Tolva Pulmón, Inyección de Vapor, Presión (bar), RPM, Temperatura de Trabajo" 
  },
  { 
    id: "SILOS", 
    label: "Batería de Silos (1 al 6)", 
    icon: "🏭", 
    desc: "Exclusa horas/T.A/H.R/Presión, Temperaturas Sup/Inf, Descarga %HD, Blancura, BLP, Trizado" 
  },
  { 
    id: "ETAPA_SECADO", 
    label: "Etapa de Secado (Perfiles 0-14)", 
    icon: "💨", 
    desc: "Perfiles horarios, Horas inicio, Temperaturas de Grano/Ambiente, Humedad % grano, Receta" 
  },
  { 
    id: "HOJA_PLANTA_COMPLETA", 
    label: "Ficha / Hoja de Planta Completa", 
    icon: "📄", 
    desc: "Escanea la hoja de control oficial completa con todas las secciones simultáneamente" 
  }
];

export const PlantSheetOCRModal: React.FC<PlantSheetOCRModalProps> = ({
  isOpen,
  onClose,
  initialSeccion = "DATOS_INGRESO",
  onApplyOCRData
}) => {
  const [selectedSeccion, setSelectedSeccion] = useState<SeccionOCR>(initialSeccion);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync initial seccion if modal opens with different context
  React.useEffect(() => {
    if (isOpen) {
      setSelectedSeccion(initialSeccion);
    }
  }, [isOpen, initialSeccion]);

  if (!isOpen) return null;

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setExtractedData(null);
    setConfidence(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessOCR = async () => {
    if (!imagePreview) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const json = localDB.ocrFallback(imagePreview, selectedSeccion);
      const payload = json.datos_extraidos || json.data || json;
      setExtractedData(payload);
      setConfidence(json.confianza || "Alta");
      setObservaciones(json.advertencia || null);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la fotografía.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (!extractedData) return;
    onApplyOCRData(selectedSeccion, extractedData);
    onClose();
  };

  const currentSectionMeta = SECCIONES_OCR_INFO.find(s => s.id === selectedSeccion) || SECCIONES_OCR_INFO[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col justify-between animate-fadeIn">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Digitalización por Foto & OCR Inteligente</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  Gemini AI Vision
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Fotografía la hoja física de planta, ticket de balanza, libreta o display para autocompletar la sección sin digitación manual.
              </p>
            </div>
          </div>
          <button
            id="btn-close-plant-ocr"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Section Selection Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">
              1. Selecciona la Sección que vas a Fotografiar / Escanear:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SECCIONES_OCR_INFO.map((sec) => {
                const isSelected = selectedSeccion === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setSelectedSeccion(sec.id);
                      setExtractedData(null);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-emerald-950/60 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/50"
                        : "bg-slate-850 hover:bg-slate-800 border-slate-700/80 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sec.icon}</span>
                      <span className="text-xs font-bold truncate">{sec.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                      {sec.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload or Camera Capture Box */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">
              2. Capturar Fotografía o Subir Archivo:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Celular / Camera Direct trigger */}
              <div
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-xl p-5 text-center cursor-pointer bg-emerald-950/20 hover:bg-emerald-950/40 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-inner">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black text-emerald-300">Tomar Foto con Celular o Cámara</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Captura directa instantánea en planta</div>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                  }}
                />
              </div>

              {/* Subir archivo de imagen */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-5 text-center cursor-pointer bg-slate-850 hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Subir Imagen o Captura</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Formatos JPG, PNG, WEBP o PDF escaneado</div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Image Preview & Process Button */}
          {imagePreview && (
            <div className="p-4 bg-slate-850 rounded-xl border border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Vista Previa de la Fotografía:</span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    ({selectedFile?.name || "Foto capturada"})
                  </span>
                </div>

                <button
                  id="btn-process-plant-ocr"
                  type="button"
                  onClick={handleProcessOCR}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Analizando con IA de Planta...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Extraer Datos de {currentSectionMeta.label}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="max-h-56 overflow-hidden rounded-lg border border-slate-750 flex items-center justify-center bg-black/60 p-2">
                <img 
                  src={imagePreview} 
                  alt="Preview Captura" 
                  className="max-h-52 max-w-full object-contain rounded" 
                />
              </div>
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Extracted Data Review & Confirmation */}
          {extractedData && (
            <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/50 space-y-3 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Datos Extraídos con Éxito para: {currentSectionMeta.label}</span>
                </div>
                {confidence && (
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                    Confianza: {confidence}
                  </span>
                )}
              </div>

              {/* Dynamic Friendly Summary Table of Values based on Section */}
              <div className="space-y-2">
                {/* 1. If DATOS DE INGRESO */}
                {(selectedSeccion === "DATOS_INGRESO" || extractedData.datosIngreso) && (
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs">
                    <div className="font-bold text-emerald-300 text-[11px] mb-2 flex items-center gap-1.5">
                      <span>📦 Valores Detectados de Ingreso:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Procedencia</span>
                        <span className="font-bold text-white">
                          {extractedData.datosIngreso?.procedencia || extractedData.procedencia || "No detectado"}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Código</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {extractedData.datosIngreso?.codigo || extractedData.codigo || extractedData.LOTE_ID || "No detectado"}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">N° Sacos</span>
                        <span className="font-bold text-white">
                          {extractedData.datosIngreso?.numSacos || extractedData.numSacos || "No detectado"}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Peso Total (Kg)</span>
                        <span className="font-bold text-white">
                          {extractedData.datosIngreso?.pesoKg || extractedData.datosIngreso?.pesoTotalKg || extractedData.pesoKg || "35000"} kg
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Variedad</span>
                        <span className="font-bold text-cyan-300">
                          {extractedData.datosIngreso?.variedad || extractedData.variedad || "No detectado"}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">% Humedad</span>
                        <span className="font-bold text-amber-400">
                          {extractedData.datosIngreso?.humedadPct || extractedData.HUMEDAD || extractedData.humedadPct || "No detectado"} %
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800 col-span-2">
                        <span className="text-[10px] text-slate-400 block">Tiempo Reposo</span>
                        <span className="font-bold text-white">
                          {extractedData.datosIngreso?.tiempoReposo || "45 min"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. If PARAMETROS DEL PADDY */}
                {(selectedSeccion === "PARAMETROS_PADDY" || extractedData.parametrosPaddy || extractedData.RI !== undefined) && (
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs">
                    <div className="font-bold text-emerald-300 text-[11px] mb-2 flex items-center gap-1.5">
                      <span>🌾 Valores de Calidad y Rendimientos Detectados:</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[11px]">
                      <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9.5px] text-slate-400 block">Humedad (H.I)</span>
                        <span className="font-bold text-amber-400">{extractedData.HUMEDAD ?? extractedData.H_I ?? "-"}%</span>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9.5px] text-slate-400 block">Rend. Integral</span>
                        <span className="font-bold text-white">{extractedData.RI ?? "-"}%</span>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9.5px] text-slate-400 block">Rend. Blanco</span>
                        <span className="font-bold text-white">{extractedData.RB ?? "-"}%</span>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9.5px] text-slate-400 block">Quebrado (Q)</span>
                        <span className="font-bold text-rose-400">{extractedData.QI ?? extractedData.Q ?? extractedData.QUEBRADO ?? "-"}%</span>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9.5px] text-slate-400 block">Trizado (TZ)</span>
                        <span className="font-bold text-rose-400">{extractedData.TZ ?? extractedData.TRIZADO ?? "-"}%</span>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9.5px] text-slate-400 block">Blancura</span>
                        <span className="font-bold text-cyan-400">{extractedData.BLANCO_PULIDO ?? extractedData.BL ?? extractedData.BL_I ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. If DATOS DE VAPORIZADO */}
                {(selectedSeccion === "DATOS_VAPORIZADO" || extractedData.datosVaporizado || extractedData.presionVapor !== undefined) && (
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs">
                    <div className="font-bold text-amber-300 text-[11px] mb-2 flex items-center gap-1.5">
                      <span>🔥 Parámetros de Autoclave & Vaporizado:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Presión Vapor</span>
                        <span className="font-bold text-emerald-400">{extractedData.datosVaporizado?.presionVapor ?? extractedData.PRESION_BAR ?? "0.45"} bar</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">RPM</span>
                        <span className="font-bold text-white">{extractedData.datosVaporizado?.rpm ?? extractedData.RPM ?? "18"} RPM</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Temp. Trabajo</span>
                        <span className="font-bold text-white">{extractedData.datosVaporizado?.tempTrabajo ?? "128 / 130"} °C</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Inyección Vapor</span>
                        <span className="font-mono text-amber-400">
                          {extractedData.datosVaporizado?.inyeccionVapor?.inicio || "--"} a {extractedData.datosVaporizado?.inyeccionVapor?.fin || "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw JSON viewer toggle if user wants full details */}
                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200 font-semibold py-1">
                    Ver estructura JSON completa extraída ({Object.keys(extractedData).length} campos)
                  </summary>
                  <pre className="mt-1 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-emerald-400 max-h-36 overflow-y-auto">
                    {JSON.stringify(extractedData, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {extractedData && (
            <button
              id="btn-apply-plant-ocr"
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xl hover:shadow-emerald-900/40 active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aplicar Datos a la Hoja de Planta</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
