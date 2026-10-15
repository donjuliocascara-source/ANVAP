import React, { useState, useEffect, useMemo } from "react";
import { 
  ResultadoCoccionExterno, 
  ConfigConexionCoccion, 
  UserProfile 
} from "../types";
import { 
  procesarDatosCoccionExternos, 
  obtenerResultadosCoccionLocales, 
  guardarResultadosCoccionLocales, 
  obtenerConfigConexion, 
  guardarConfigConexion,
  generarDatosPruebaMixtos 
} from "../utils/integracionCoccionService";
import { 
  Link2, 
  Upload, 
  FileSpreadsheet, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Database, 
  Trash2, 
  X, 
  Check, 
  Copy, 
  Flame, 
  RefreshCw, 
  ArrowRight, 
  Filter, 
  FileText, 
  Code, 
  Sliders, 
  Layers,
  HelpCircle,
  Clock,
  ShieldCheck,
  Info
} from "lucide-react";

interface IntegracionCoccionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile;
  onDatosActualizados?: () => void;
  onResultadosImportados?: () => void;
}

export const IntegracionCoccionModal: React.FC<IntegracionCoccionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onDatosActualizados
}) => {
  const [activeTab, setActiveTab] = useState<"pegar" | "archivo" | "api" | "guardados">("pegar");
  
  // Input raw text for pasting
  const [rawText, setRawText] = useState<string>("");
  const [fuenteNombre, setFuenteNombre] = useState<string>("Aplicativo Externo de Cocción");
  
  // API config state
  const [apiConfig, setApiConfig] = useState<ConfigConexionCoccion>(() => obtenerConfigConexion());
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [apiTestResult, setApiTestResult] = useState<{ status: "ok" | "error"; message: string } | null>(null);

  // Stored items state
  const [resultadosGuardados, setResultadosGuardados] = useState<ResultadoCoccionExterno[]>(() => obtenerResultadosCoccionLocales());
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"vaporizados" | "omitidos">("vaporizados");

  // Re-read storage on open
  useEffect(() => {
    if (isOpen) {
      setResultadosGuardados(obtenerResultadosCoccionLocales());
      setApiConfig(obtenerConfigConexion());
    }
  }, [isOpen]);

  // Parse raw text on the fly
  const parseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    return procesarDatosCoccionExternos(rawText, fuenteNombre);
  }, [rawText, fuenteNombre]);

  if (!isOpen) return null;

  // Handle Loading Mock / Test Data
  const handleCargarEjemplo = () => {
    const mock = generarDatosPruebaMixtos();
    setRawText(mock.tsv);
    setFuenteNombre("Excel Laboratorio (Prueba Mixta)");
  };

  // Handle Confirm Import
  const handleConfirmarImportacion = () => {
    if (!parseResult || parseResult.vaporizados.length === 0) return;

    const actualizados = guardarResultadosCoccionLocales(parseResult.vaporizados);
    setResultadosGuardados(actualizados);

    // Call callback to notify parent views
    if (onDatosActualizados) {
      onDatosActualizados();
    }

    setSuccessToast(`✅ Se integraron con éxito ${parseResult.vaporizados.length} registros de VAPORIZADO. (${parseResult.anejadosOmitidos.length} de Añejado fueron filtrados y omitidos).`);
    setTimeout(() => {
      setSuccessToast(null);
      setActiveTab("guardados");
    }, 2500);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFuenteNombre(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setActiveTab("pegar"); // Switch to view parsed table
      }
    };
    reader.readAsText(file);
  };

  // Handle Save API Config
  const handleGuardarApiConfig = () => {
    guardarConfigConexion(apiConfig);
    setSuccessToast("✅ Configuración de conexión API guardada exitosamente.");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Handle Test API
  const handleProbarConexionApi = async () => {
    if (!apiConfig.apiUrl) {
      setApiTestResult({ status: "error", message: "Ingrese una URL válida de API o Webhook." });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      // Simulate or execute real fetch
      const res = await fetch(apiConfig.apiUrl, {
        method: "GET",
        headers: apiConfig.apiKey ? { "Authorization": `Bearer ${apiConfig.apiKey}` } : {}
      });

      if (!res.ok) {
        throw new Error(`Servidor respondió con código ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const resultado = procesarDatosCoccionExternos(data, "API en Tiempo Real");

      if (resultado.vaporizados.length > 0) {
        guardarResultadosCoccionLocales(resultado.vaporizados);
        setResultadosGuardados(obtenerResultadosCoccionLocales());
        if (onDatosActualizados) onDatosActualizados();
        setApiTestResult({ 
          status: "ok", 
          message: `Conexión exitosa. Se recibieron ${resultado.totalRecibidos} registros (${resultado.vaporizados.length} Vaporizados importados, ${resultado.anejadosOmitidos.length} Añejados omitidos).` 
        });
      } else {
        setApiTestResult({ 
          status: "ok", 
          message: `Conexión exitosa, pero no se encontraron nuevos registros con proceso 'VAPORIZADO'.` 
        });
      }
    } catch (err: any) {
      setApiTestResult({ 
        status: "error", 
        message: `Error al conectar con la API: ${err.message || 'No se pudo contactar el servidor'}` 
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Handle Delete All
  const handleEliminarTodos = () => {
    if (window.confirm("¿Está seguro de eliminar todos los resultados de cocción externos guardados?")) {
      localStorage.removeItem("resultados_coccion_externos_v1");
      setResultadosGuardados([]);
      if (onDatosActualizados) onDatosActualizados();
      setSuccessToast("Registros de cocción eliminados.");
      setTimeout(() => setSuccessToast(null), 2500);
    }
  };

  // Handle Delete Single
  const handleEliminarUno = (id: string) => {
    const filtrados = resultadosGuardados.filter(r => r.id !== id);
    localStorage.setItem("resultados_coccion_externos_v1", JSON.stringify(filtrados));
    setResultadosGuardados(filtrados);
    if (onDatosActualizados) onDatosActualizados();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-slate-850 border-b border-slate-750 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />
                INTERFAZ & SINCRONIZACIÓN DE COCCIÓN
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Filtro Exclusivo: SOLO VAPORIZADO
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              Enlazar Resultados de Cocción del Aplicativo Externo
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Si tu aplicativo registra datos de <strong>Añejado</strong> y <strong>Vaporizado</strong>, este módulo <strong>discrimina y extrae automáticamente solo los lotes y batches de Vaporizado</strong>, integrando sus métricas en olla (tiempo, ratio de agua, expansión, soltura de grano, textura y score) al sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOAST ALERT */}
        {successToast && (
          <div className="p-3 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button type="button" onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 p-3 bg-slate-950 border-b border-slate-800 shrink-0 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("pegar")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "pegar"
                ? "bg-amber-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Pegar Datos (Excel / Sheets)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("archivo")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "archivo"
                ? "bg-amber-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Cargar Archivo (.csv, .json)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("api")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "api"
                ? "bg-amber-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Conexión API / Webhook</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guardados")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "guardados"
                ? "bg-amber-500 text-slate-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Registros Enlazados ({resultadosGuardados.length})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">

          {/* =================================================================== */}
          {/* TAB 1: PEGAR DATOS DIRECTOS DESDE EXCEL / GOOGLE SHEETS / JSON      */}
          {/* =================================================================== */}
          {activeTab === "pegar" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Pega aquí las filas de tu hoja de cocción o archivo JSON:</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCargarEjemplo}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-amber-500/30 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cargar Ejemplo Mixto (Añejado + Vaporizado)</span>
                  </button>

                  {rawText && (
                    <button
                      type="button"
                      onClick={() => setRawText("")}
                      className="px-2 py-1 text-slate-400 hover:text-rose-400 text-xs transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="md:col-span-2 space-y-2">
                  <textarea
                    rows={7}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Copia y pega directamente las columnas desde Excel/Sheets. Ejemplo:
BATCH	PROCESO	VARIEDAD	FECHA	TIEMPO	RATIO_AGUA	EXPANSION	SOLTURA	TEXTURA	SCORE	OBSERVACIONES
B-0001	VAPORIZADO	Tinajones	2026-08-20	18	1:2.5	x2.6	100% Suelto	Al dente	98	Excelente
LOT-104	AÑEJADO	Tinajones	2026-08-20	22	1:2.2	x2.2	Suelto Seco	Firme	88	Arroz añejado en silo`}
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Nombre de Fuente / App:</span>
                    <input
                      type="text"
                      value={fuenteNombre}
                      onChange={(e) => setFuenteNombre(e.target.value)}
                      className="bg-slate-950 border border-slate-750 rounded px-2 py-0.5 text-xs text-white w-56 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Explicación de cómo funciona el filtro */}
                <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750 space-y-2.5 text-xs text-slate-300">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Filtro de Proceso Activo</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    El algoritmo busca en cualquier columna palabras clave como <strong className="text-cyan-300">"VAPORIZADO"</strong> o <strong className="text-cyan-300">"PARBOIL"</strong>.
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Si el registro dice <strong className="text-rose-400">"AÑEJADO"</strong>, <strong className="text-rose-400">"ENVEJECIDO"</strong> o <strong className="text-rose-400">"SILO"</strong>, el sistema lo <strong>omite automáticamente</strong> para no mezclar los resultados.
                  </p>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-750 text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Mapeo tolerante de nombres de columna</span>
                  </div>
                </div>
              </div>

              {/* LIVE PARSER RESULTS & PREVIEW */}
              {parseResult && (
                <div className="bg-slate-850 rounded-xl border border-slate-750 p-4 space-y-4 shadow-xl animate-in fade-in">
                  {/* Summary Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl border border-slate-750">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-bold font-mono">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{parseResult.vaporizados.length} VAPORIZADOS (Aprobados)</span>
                      </div>

                      <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-bold font-mono">
                        <Filter className="w-4 h-4 text-rose-400" />
                        <span>{parseResult.anejadosOmitidos.length} AÑEJADOS (Filtrados / Omitidos)</span>
                      </div>

                      {parseResult.otrosOmitidos.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-lg text-slate-400 text-xs font-mono">
                          <span>{parseResult.otrosOmitidos.length} Otros</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={parseResult.vaporizados.length === 0}
                      onClick={handleConfirmarImportacion}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirmar e Importar ({parseResult.vaporizados.length}) Vaporizados</span>
                    </button>
                  </div>

                  {/* Preview Selector Tabs */}
                  <div className="flex items-center gap-2 border-b border-slate-750 pb-2">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("vaporizados")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        previewTab === "vaporizados"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Ver Registros de Vaporizado ({parseResult.vaporizados.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("omitidos")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        previewTab === "omitidos"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Ver Añejados Descartados ({parseResult.anejadosOmitidos.length})
                    </button>
                  </div>

                  {/* Table: Vaporizados */}
                  {previewTab === "vaporizados" && (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0 font-bold border-b border-slate-800 text-[11px] uppercase">
                          <tr>
                            <th className="p-2.5">Batch / Lote</th>
                            <th className="p-2.5">Proceso</th>
                            <th className="p-2.5">Variedad</th>
                            <th className="p-2.5 text-center">Tiempo Olla</th>
                            <th className="p-2.5 text-center">Ratio Agua</th>
                            <th className="p-2.5 text-center">Expansión</th>
                            <th className="p-2.5">Soltura & Textura</th>
                            <th className="p-2.5 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-xs">
                          {parseResult.vaporizados.map((v, i) => (
                            <tr key={i} className="hover:bg-slate-800/40">
                              <td className="p-2.5 font-bold text-amber-400">
                                {v.batchId} {v.correlativo ? `(${v.correlativo})` : ''}
                              </td>
                              <td className="p-2.5 font-sans">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                  VAPORIZADO
                                </span>
                              </td>
                              <td className="p-2.5 font-sans text-slate-200 truncate max-w-[120px]">
                                {v.variedad}
                              </td>
                              <td className="p-2.5 text-center text-slate-300">
                                {v.tiempoCoccionMin} min
                              </td>
                              <td className="p-2.5 text-center text-cyan-300">
                                {v.ratioAguaArroz}
                              </td>
                              <td className="p-2.5 text-center text-slate-300">
                                {v.expansionVolumetrica}
                              </td>
                              <td className="p-2.5 font-sans text-[11px] text-slate-300 truncate max-w-[180px]" title={`${v.solturaGrano} - ${v.texturaFirmeza}`}>
                                {v.solturaGrano}
                              </td>
                              <td className="p-2.5 text-right">
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40">
                                  {v.puntajeCoccion} pts
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Table: Añejados Omitidos */}
                  {previewTab === "omitidos" && (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0 font-bold border-b border-slate-800 text-[11px] uppercase">
                          <tr>
                            <th className="p-2.5">Fila #</th>
                            <th className="p-2.5">Identificador Detectado</th>
                            <th className="p-2.5">Proceso Original</th>
                            <th className="p-2.5">Motivo de Exclusión</th>
                            <th className="p-2.5">Detalle Crudo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-400">
                          {parseResult.anejadosOmitidos.map((om, i) => (
                            <tr key={i} className="hover:bg-slate-800/40 opacity-75">
                              <td className="p-2.5 text-slate-500">#{om.indice}</td>
                              <td className="p-2.5 text-rose-300 font-bold">
                                {om.filaOriginal?.BATCH || om.filaOriginal?.BATCH_ID || om.filaOriginal?.LOTE || "Sin ID"}
                              </td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                  {om.proceso}
                                </span>
                              </td>
                              <td className="p-2.5 font-sans text-xs text-rose-300 font-medium">
                                🚫 Omitido: Proceso Añejado no aplica a línea de Vaporizado
                              </td>
                              <td className="p-2.5 font-mono text-[10px] text-slate-500 truncate max-w-[200px]" title={JSON.stringify(om.filaOriginal)}>
                                {JSON.stringify(om.filaOriginal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: CARGAR ARCHIVO EXCEL / CSV / JSON                           */}
          {/* =================================================================== */}
          {activeTab === "archivo" && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-slate-750 hover:border-amber-500/50 rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-center space-y-3 transition-colors">
                <div className="p-4 rounded-full bg-amber-500/10 text-amber-400">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">
                    Selecciona o arrastra tu archivo de resultados de cocción
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md">
                    Formatos compatibles: <strong>.CSV</strong>, <strong>.JSON</strong> o exportaciones tabuladas de Excel.
                  </p>
                </div>

                <label className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow transition-all">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Explorar Archivos en tu PC</span>
                  <input
                    type="file"
                    accept=".csv, .json, .txt, .tsv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-4 bg-slate-850 rounded-xl border border-slate-750 text-xs text-slate-300 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>¿Cómo estructura el archivo tu aplicativo actual?</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  No necesitas modificar las columnas de tu archivo. El sistema detecta automáticamente columnas como:
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-cyan-300">
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-750">PROCESO / TIPO_PROCESO</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-750">BATCH / LOTE / CORRELATIVO</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-750">TIEMPO_COCCION</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-750">RATIO_AGUA / ABSORCION</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-750">SOLTURA_GRANO / APELMAZAMIENTO</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-750">SCORE / CALIFICACION</span>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: CONEXIÓN API / WEBHOOK EN TIEMPO REAL                       */}
          {/* =================================================================== */}
          {activeTab === "api" && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  Sincronización Directa por Endpoint REST / Webhook
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Si tu aplicativo de cocción cuenta con un servicio web o API REST, puedes configurar la URL aquí para sincronizar automáticamente o enviar los datos vía POST.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">URL del Endpoint de tu Aplicativo / Webhook:</label>
                    <input
                      type="text"
                      placeholder="https://tu-sistema-arroz.com/api/coccion"
                      value={apiConfig.apiUrl || ""}
                      onChange={(e) => setApiConfig({ ...apiConfig, apiUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">Token / API Key de Autorización (Opcional):</label>
                    <input
                      type="password"
                      placeholder="Bearer token_secreto_aqui"
                      value={apiConfig.apiKey || ""}
                      onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-750">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Filtro de Proceso Forzado:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[11px]">
                      SOLO "VAPORIZADO"
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGuardarApiConfig}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Guardar Configuración
                    </button>
                    <button
                      type="button"
                      disabled={isTestingApi}
                      onClick={handleProbarConexionApi}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin" : ""}`} />
                      <span>{isTestingApi ? "Conectando..." : "Probar Conexión & Sincronizar"}</span>
                    </button>
                  </div>
                </div>

                {apiTestResult && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                    apiTestResult.status === "ok"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  }`}>
                    {apiTestResult.status === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{apiTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Guía para desarrollador de cómo enviar vía POST */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span>Si prefieres que tu aplicativo envíe los datos hacia este sistema (Push Webhook):</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tu aplicativo puede hacer un <code>POST</code> con la lista de resultados a:
                </p>
                <div className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto">
                  POST {window.location.origin}/api/coccion-externo/sync
                </div>
                <p className="text-[10px] text-slate-500">
                  El servidor filtrará automáticamente cualquier elemento donde <code>proceso !== "VAPORIZADO"</code> y asociará el resto a cada Batch.
                </p>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 4: LISTA DE RESULTADOS DE COCCIÓN GUARDADOS EN EL SISTEMA       */}
          {/* =================================================================== */}
          {activeTab === "guardados" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    Resultados de Cocción de Vaporizado Integrados ({resultadosGuardados.length})
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Estos datos se reflejan directamente en el Comparador de Procesos y en las Fichas de Batch.
                  </p>
                </div>

                {resultadosGuardados.length > 0 && (
                  <button
                    type="button"
                    onClick={handleEliminarTodos}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Todos</span>
                  </button>
                )}
              </div>

              {resultadosGuardados.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <Flame className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-slate-300 text-xs font-semibold">No hay resultados de cocción externos integrados todavía.</p>
                  <p className="text-slate-500 text-[11px]">Usa la pestaña "Pegar Datos" o "Cargar Archivo" para enlazar tus primeros registros.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("pegar")}
                    className="mt-2 px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow"
                  >
                    Ir a Pegar Datos
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 font-bold border-b border-slate-800 text-[11px] uppercase">
                      <tr>
                        <th className="p-3">Batch / Correlativo</th>
                        <th className="p-3">Variedad</th>
                        <th className="p-3">Fecha & Fuente</th>
                        <th className="p-3 text-center">Tiempo Cocción</th>
                        <th className="p-3 text-center">Ratio Agua</th>
                        <th className="p-3">Soltura & Textura</th>
                        <th className="p-3 text-right">Score Olla</th>
                        <th className="p-3 text-center w-12">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-xs">
                      {resultadosGuardados.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-900/50">
                          <td className="p-3 font-bold text-amber-400">
                            {r.batchId} {r.correlativo && r.correlativo !== r.batchId ? `(${r.correlativo})` : ''}
                          </td>
                          <td className="p-3 font-sans text-slate-200">
                            {r.variedad || "General"}
                          </td>
                          <td className="p-3 font-sans text-[11px]">
                            <div className="text-slate-300">{r.fechaCoccion}</div>
                            <div className="text-slate-500 text-[10px]">{r.fuenteExterna || "Externo"}</div>
                          </td>
                          <td className="p-3 text-center text-slate-300">
                            {r.tiempoCoccionMin} min
                          </td>
                          <td className="p-3 text-center text-cyan-300">
                            {r.ratioAguaArroz}
                          </td>
                          <td className="p-3 font-sans text-[11px] text-slate-300 truncate max-w-[200px]" title={r.observaciones}>
                            <div>{r.solturaGrano}</div>
                            <div className="text-slate-500 text-[10px]">{r.texturaFirmeza}</div>
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/40">
                              {r.puntajeCoccion} pts
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleEliminarUno(r.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="Eliminar este registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 sm:p-4 bg-slate-850 border-t border-slate-750 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Total registros de cocción vaporizado activos: <strong>{resultadosGuardados.length}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
