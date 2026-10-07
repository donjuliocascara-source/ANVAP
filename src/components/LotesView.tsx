import React, { useState, useEffect, useMemo } from "react";
import { Lote, EstadoLote, UserProfile, RegistroHumedad, AnalisisHumedo } from "../types";
import { 
  Package, 
  Plus, 
  Search, 
  Eye, 
  Edit3, 
  FileText, 
  CheckCircle, 
  Clock, 
  Filter, 
  Building, 
  MapPin, 
  Scale, 
  Droplet,
  FlaskConical,
  ExternalLink,
  ChevronRight,
  Info,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Activity,
  Layers,
  AlertTriangle,
  Award,
  CheckCircle2,
  Sliders,
  BarChart3
} from "lucide-react";
import { HumedadView } from "./HumedadView";
import { AnalisisHumedoView } from "./AnalisisHumedoView";
import { formatLoteCode } from "../utils/formatLoteCode";

export const VARIEDADES_ARROZ_OPCIONES = [
  "TINAJONES",
  "SANTACRUZ",
  "NIR",
  "MARAÑON",
  "PAKAMURO",
  "MAYARES",
  "PUNTILLA",
  "FERON",
  "NOPAL",
  "VALOR",
  "IR-43",
  "CHICLAYO",
  "OTRA"
];

interface LotesViewProps {
  lotes?: Lote[];
  estados?: EstadoLote[];
  humedades?: RegistroHumedad[];
  analisisHumedos?: AnalisisHumedo[];
  currentUser?: UserProfile;
  initialLoteId?: string;
  initialSubTab?: "lotes" | "humedad" | "analisis-humedo" | "analisis-lote";
  onSaveLote: (lote: Partial<Lote>) => Promise<void>;
  onSaveHumedad?: (rec: Partial<RegistroHumedad>) => Promise<void>;
  onSaveAnalisisHum?: (analisis: Partial<AnalisisHumedo>) => Promise<void>;
  onOpenReport?: (loteId: string) => void;
  onOpenNewLote?: () => void;
  onOpenOCR?: () => void;
  onNavigate: (tab: string, filterId?: string) => void;
}

export const LotesView: React.FC<LotesViewProps> = ({
  lotes = [],
  estados = [],
  humedades = [],
  analisisHumedos = [],
  currentUser,
  initialLoteId,
  initialSubTab = "lotes",
  onSaveLote,
  onSaveHumedad = async () => {},
  onSaveAnalisisHum = async () => {},
  onOpenReport,
  onOpenNewLote,
  onOpenOCR,
  onNavigate
}) => {
  const [subTab, setSubTab] = useState<"lotes" | "humedad" | "analisis-humedo" | "analisis-lote">(initialSubTab);
  const [activeLoteFocusId, setActiveLoteFocusId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [savedSuccessLoteId, setSavedSuccessLoteId] = useState<string | null>(null);
  const [isCustomVariedad, setIsCustomVariedad] = useState(false);
  const [customVariedadText, setCustomVariedadText] = useState("");

  useEffect(() => {
    if (initialLoteId) {
      setActiveLoteFocusId(initialLoteId);
    }
  }, [initialLoteId]);

  const [createError, setCreateError] = useState<string | null>(null);

  // Normalize Lote code to C0 standard (e.g. '2020' -> 'C02020', '8432' -> 'C08432', 'CO8432' -> 'C08432')
  const normalizeLoteId = (input?: string): string => {
    return formatLoteCode(input) || "0";
  };

  // Calculate next sequential Lote code (e.g. C02026) ensuring uniqueness
  const getNextLoteId = (): string => {
    let maxNum = 2025;
    lotes.forEach((l) => {
      const match = (l.LOTE_ID || "").match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum && n < 99999) maxNum = n;
      }
    });
    let candNum = maxNum + 1;
    let candidate = `C0${candNum}`;
    while (lotes.some((l) => normalizeLoteId(l.LOTE_ID) === candidate)) {
      candNum++;
      candidate = `C0${candNum}`;
    }
    return candidate;
  };

  // Clean empty form template without pre-filled mock/dummy data, with today's date and initial value 0
  const getInitialNewLoteState = (): Partial<Lote> => ({
    LOTE_ID: "0",
    FECHA_INGRESO: new Date().toISOString().split("T")[0],
    CLIENTE: "",
    VARIEDAD: "",
    SACOS: 0,
    PESO_KG: 0,
    HUM: 0,
    UBICACION: "",
    ZONA: "",
    ESTADO_LOTE: "INGRESADO",
    OBSERVACIONES: ""
  });

  const [newLoteData, setNewLoteData] = useState<Partial<Lote>>(getInitialNewLoteState());

  const currentNormalizedNewLoteId = useMemo(() => {
    if (!newLoteData.LOTE_ID || newLoteData.LOTE_ID === "0") return "0";
    return normalizeLoteId(newLoteData.LOTE_ID);
  }, [newLoteData.LOTE_ID]);

  const isDuplicateNewLote = useMemo(() => {
    if (!currentNormalizedNewLoteId || currentNormalizedNewLoteId === "0") return false;
    return lotes.some((l) => normalizeLoteId(l.LOTE_ID) === currentNormalizedNewLoteId);
  }, [currentNormalizedNewLoteId, lotes]);

  const handleOpenCreateModal = () => {
    setNewLoteData(getInitialNewLoteState());
    setIsCustomVariedad(false);
    setCustomVariedadText("");
    setSavedSuccessLoteId(null);
    setIsNewModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setNewLoteData(getInitialNewLoteState());
    setIsCustomVariedad(false);
    setCustomVariedadText("");
    setSavedSuccessLoteId(null);
    setIsNewModalOpen(false);
  };

  // Helper to compute humidity from 14 caladas sampling
  const getLoteHumidityInfo = (loteId: string, fallbackHum: number = 0) => {
    const matchHum = humedades.filter((h) => h.LOTE_ID === loteId);
    if (matchHum.length > 0) {
      const latest = matchHum[matchHum.length - 1];
      const avg = latest["H. PROMEDIO"] || (
        [latest.M1, latest.M2, latest.M3, latest.M4, latest.M5, latest.M6, latest.M7,
         latest.M8, latest.M9, latest.M10, latest.M11, latest.M12, latest.M13, latest.M14]
        .filter((v) => typeof v === "number" && v > 0)
        .reduce((a, b, _, arr) => a + b / arr.length, 0)
      );
      if (avg > 0) {
        return {
          hum: Number(avg.toFixed(2)),
          hasRegisteredHum: true,
          caladasCount: 14,
          desv: latest["DESV."] || 0,
          record: latest
        };
      }
    }
    return {
      hum: fallbackHum || 0,
      hasRegisteredHum: false,
      caladasCount: 0,
      desv: 0,
      record: null
    };
  };

  // Helper to check if Lote has Analisis Humedo
  const getLoteAnalisisHumedo = (loteId: string) => {
    return analisisHumedos.find((ah) => ah.LOTE_ID === loteId);
  };

  // Filters
  const filteredLotes = lotes.filter((l) => {
    const matchesSearch = 
      (l.LOTE_ID || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.CLIENTE || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.VARIEDAD || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.ZONA || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = selectedEstado ? l.ESTADO_LOTE === selectedEstado : true;
    return matchesSearch && matchesEstado;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CERRADO":
      case "EVALUADO":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "EN PROCESO":
      case "VAPORIZADO":
      case "EN SECADO":
        return "bg-amber-950 text-amber-300 border-amber-800";
      case "PROGRAMADO":
        return "bg-cyan-950 text-cyan-300 border-cyan-800";
      case "ANALIZADO":
      case "APTO":
        return "bg-blue-950 text-blue-300 border-blue-800";
      case "OBSERVADO":
        return "bg-rose-950 text-rose-300 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const selectedFocusLote = lotes.find((l) => l.LOTE_ID === activeLoteFocusId) || lotes[0];
  const focusHumInfo = selectedFocusLote ? getLoteHumidityInfo(selectedFocusLote.LOTE_ID, selectedFocusLote.HUM) : null;
  const focusAnalisis = selectedFocusLote ? getLoteAnalisisHumedo(selectedFocusLote.LOTE_ID) : null;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Main Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Módulo Integral de Lotes y Calidad Inicial
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión completa de ingreso C0, muestreo de 14 caladas, análisis físico húmedo y evaluación integral.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-register-lote"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Nuevo Lote C0
          </button>
        </div>
      </div>

      {/* Internal Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-750 pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab("lotes")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "lotes"
              ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
              : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>1. Maestro de Lotes ({lotes.length})</span>
        </button>

        <button
          onClick={() => setSubTab("humedad")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "humedad"
              ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
              : "bg-slate-800 text-cyan-300 hover:bg-slate-750 hover:text-cyan-200 border border-cyan-500/20"
          }`}
        >
          <Droplet className="w-4 h-4" />
          <span>2. Registro de Humedad (14 Caladas)</span>
        </button>

        <button
          onClick={() => setSubTab("analisis-humedo")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "analisis-humedo"
              ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
              : "bg-slate-800 text-emerald-300 hover:bg-slate-750 hover:text-emerald-200 border border-emerald-500/20"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>3. Análisis Físico Húmedo</span>
        </button>

        <button
          onClick={() => setSubTab("analisis-lote")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "analisis-lote"
              ? "bg-indigo-500 text-white shadow-md font-extrabold"
              : "bg-slate-800 text-indigo-300 hover:bg-slate-750 hover:text-indigo-200 border border-indigo-500/20"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>4. Análisis Integral del Lote</span>
        </button>
      </div>

      {/* SUBTAB 1: MAESTRO DE LOTES */}
      {subTab === "lotes" && (
        <div className="space-y-4">
          {/* Process Flow Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Flujo de Calidad Integrado:</strong> 1. Ingresar Lote (C0) → 2. Registrar 14 Caladas de Humedad (promedio automático) → 3. Análisis Físico Húmedo → 4. Análisis Integral / Programación.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubTab("humedad")}
                className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Registrar Caladas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Search & Filter bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="input-search-lotes"
                type="text"
                placeholder="Buscar por código de lote (Ej. C02020), cliente, variedad, zona..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                id="select-lote-filter-estado"
                aria-label="Filtrar por estado del lote"
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos los Estados</option>
                {estados.map((est) => (
                  <option key={est.ESTADO_ID} value={est.ESTADO}>{est.ESTADO}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lotes Cards / Table View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLotes.map((lote) => {
              const humInfo = getLoteHumidityInfo(lote.LOTE_ID, lote.HUM);
              const anHumedo = getLoteAnalisisHumedo(lote.LOTE_ID);

              return (
                <div
                  key={lote.LOTE_ID}
                  className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl border border-slate-700/80 p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
                          {lote.LOTE_ID}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1">{lote.FECHA_INGRESO || "Fecha sin registrar"}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(lote.ESTADO_LOTE)}`}>
                        {lote.ESTADO_LOTE}
                      </span>
                    </div>

                    {/* Body Info */}
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">{lote.CLIENTE || "Cliente no especificado"}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-400">{lote.ZONA || "Sin zona"}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/60 rounded text-[11px] text-amber-300 font-bold">
                          {lote.VARIEDAD || "Sin variedad"}
                        </span>
                      </div>

                      {/* Metrics: Sacos, Peso y Humedad Promedio Automática */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 rounded-lg p-2 text-center text-slate-300 text-[11px] border border-slate-750">
                        <div>
                          <div className="text-slate-400 text-[10px]">Sacos</div>
                          <div className="font-bold text-white">{lote.SACOS || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">Peso Total</div>
                          <div className="font-bold text-white">{lote.PESO_KG ? `${(lote.PESO_KG / 1000).toFixed(1)} TN` : "0 TN"}</div>
                        </div>
                        <div className="bg-slate-950/60 rounded p-1">
                          <div className="text-cyan-400 text-[10px] flex items-center justify-center gap-0.5">
                            <Droplet className="w-2.5 h-2.5" />
                            <span>Humedad</span>
                          </div>
                          {humInfo.hasRegisteredHum ? (
                            <div>
                              <div className="font-bold text-cyan-300">{humInfo.hum}%</div>
                              <div className="text-[9px] text-emerald-400 font-medium leading-none">14 caladas ✓</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-amber-300">{humInfo.hum > 0 ? `${humInfo.hum}%` : "Pendiente"}</div>
                              <div className="text-[9px] text-amber-400/80 leading-none">Sin caladas</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estado de Pruebas Físicas */}
                      <div className="flex items-center justify-between text-[11px] bg-slate-850 px-2 py-1.5 rounded border border-slate-700/50">
                        <span className="text-slate-400">Análisis Húmedo:</span>
                        {anHumedo ? (
                          <span className="text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            Rend. {anHumedo.RI || 0}% / Imp. {anHumedo.IMPUREZS || 0}%
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No registrado</span>
                        )}
                      </div>

                      {lote.UBICACION && (
                        <div className="text-[11px] text-slate-400">
                          Ubicación: <strong className="text-slate-200">{lote.UBICACION}</strong>
                        </div>
                      )}

                      {lote.OBSERVACIONES && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-2 mt-1">
                          "{lote.OBSERVACIONES}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Direct Access Quick Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-col gap-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        id={`btn-open-humedad-${lote.LOTE_ID}`}
                        onClick={() => {
                          setActiveLoteFocusId(lote.LOTE_ID);
                          setSubTab("humedad");
                        }}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
                        title="Registrar Muestreo de Humedad M1-M14"
                      >
                        <Droplet className="w-3.5 h-3.5" />
                        <span>Humedad</span>
                      </button>

                      <button
                        id={`btn-open-analisis-${lote.LOTE_ID}`}
                        onClick={() => {
                          setActiveLoteFocusId(lote.LOTE_ID);
                          setSubTab("analisis-humedo");
                        }}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                        title="Registrar Análisis Físico en Húmedo"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Análisis</span>
                      </button>

                      <button
                        id={`btn-open-diagnostico-${lote.LOTE_ID}`}
                        onClick={() => {
                          setActiveLoteFocusId(lote.LOTE_ID);
                          setSubTab("analisis-lote");
                        }}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800 text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
                        title="Ver Dossier y Diagnóstico Integral del Lote"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Dossier</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        id={`btn-view-lote-report-${lote.LOTE_ID}`}
                        onClick={() => onOpenReport?.(lote.LOTE_ID)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium cursor-pointer"
                        title="Generar informe completo de 25 puntos"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        Informe
                      </button>

                      <button
                        id={`btn-open-programar-${lote.LOTE_ID}`}
                        onClick={() => onNavigate("programacion-apit", lote.LOTE_ID)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Programar APIT</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLotes.length === 0 && (
            <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/60 p-6">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">No se encontraron lotes con los filtros seleccionados.</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-3 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Ingresar Primer Lote C0
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: REGISTRO DE HUMEDAD INTEGRADO */}
      {subTab === "humedad" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-cyan-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-cyan-300">
              <Droplet className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Módulo de Humedad (14 Caladas):</strong> Registre las lecturas M1 a M14 para calcular el promedio y desviación estándar que sincronizará automáticamente el lote.
              </span>
            </div>
            <button
              onClick={() => setSubTab("lotes")}
              className="text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              ← Volver a Maestro de Lotes
            </button>
          </div>

          <HumedadView
            humedades={humedades}
            lotes={lotes}
            initialLoteId={activeLoteFocusId}
            currentUser={currentUser}
            onSaveHumedad={onSaveHumedad}
            onOpenOCR={onOpenOCR}
          />
        </div>
      )}

      {/* SUBTAB 3: ANÁLISIS FÍSICO HÚMEDO INTEGRADO */}
      {subTab === "analisis-humedo" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-emerald-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Análisis Físico en Húmedo:</strong> Registro de rendimiento de pilado (RI, RB, RM), grano entero, quebrados, impurezas y defectos de calidad.
              </span>
            </div>
            <button
              onClick={() => setSubTab("lotes")}
              className="text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              ← Volver a Maestro de Lotes
            </button>
          </div>

          <AnalisisHumedoView
            analisisList={analisisHumedos}
            lotes={lotes}
            initialLoteId={activeLoteFocusId}
            currentUser={currentUser}
            onSaveAnalisisHum={onSaveAnalisisHum}
            onOpenOCR={onOpenOCR}
          />
        </div>
      )}

      {/* SUBTAB 4: ANÁLISIS INTEGRAL Y DIAGNÓSTICO DEL LOTE */}
      {subTab === "analisis-lote" && (
        <div className="space-y-4">
          {/* Lote Selector & Quick Summary */}
          <div className="bg-slate-850 border border-slate-750 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Dossier de Calidad y Trazabilidad</span>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2 mt-0.5">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Diagnóstico Completo del Lote
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-300 font-semibold">Seleccionar Lote:</label>
              <select
                value={selectedFocusLote?.LOTE_ID || ""}
                onChange={(e) => setActiveLoteFocusId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
              >
                {lotes.map((l) => (
                  <option key={l.LOTE_ID} value={l.LOTE_ID}>
                    {l.LOTE_ID} - {l.CLIENTE || "Sin cliente"} ({l.VARIEDAD || "Sin variedad"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedFocusLote ? (
            <div className="space-y-4">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Lote y Variedad</span>
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-amber-400 font-mono mt-1">{selectedFocusLote.LOTE_ID}</div>
                  <div className="text-xs text-slate-200 font-semibold">{selectedFocusLote.VARIEDAD || "Sin variedad"}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{selectedFocusLote.CLIENTE || "Cliente no registrado"}</div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Peso y Volumen</span>
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {selectedFocusLote.PESO_KG ? `${(selectedFocusLote.PESO_KG / 1000).toFixed(1)} TN` : "0 TN"}
                  </div>
                  <div className="text-xs text-slate-300">{selectedFocusLote.SACOS || 0} sacos recibidos</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ubicación: {selectedFocusLote.UBICACION || "Silo Pulmón"}</div>
                </div>

                <div className="bg-slate-800 border border-cyan-800/60 rounded-xl p-3.5">
                  <div className="text-[11px] text-cyan-400 flex items-center justify-between">
                    <span>Humedad Promedio</span>
                    <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-cyan-300 mt-1">
                    {focusHumInfo?.hum ? `${focusHumInfo.hum}%` : "Pendiente"}
                  </div>
                  <div className="text-xs text-cyan-200">
                    {focusHumInfo?.hasRegisteredHum ? "14 caladas promediadas ✓" : "Sin muestreo M1-M14"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {focusHumInfo?.desv ? `Desv. Estándar: ±${focusHumInfo.desv}` : "Desv. no calculada"}
                  </div>
                </div>

                <div className="bg-slate-800 border border-emerald-800/60 rounded-xl p-3.5">
                  <div className="text-[11px] text-emerald-400 flex items-center justify-between">
                    <span>Rendimiento Integral (RI)</span>
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-300 mt-1">
                    {focusAnalisis?.RI ? `${focusAnalisis.RI}%` : "Pendiente"}
                  </div>
                  <div className="text-xs text-emerald-200">
                    {focusAnalisis ? `Grano Entero: ${focusAnalisis.ENTERO || 0}%` : "Análisis no registrado"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {focusAnalisis ? `Impurezas: ${focusAnalisis.IMPUREZS || 0}%` : ""}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 14 Caladas Humedad Breakdown */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <Droplet className="w-4 h-4" />
                      <span>Muestreo de 14 Caladas ({selectedFocusLote.LOTE_ID})</span>
                    </div>
                    <button
                      onClick={() => setSubTab("humedad")}
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Editar Caladas <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {focusHumInfo?.hasRegisteredHum && focusHumInfo.record ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => {
                          const val = (focusHumInfo.record as any)[`M${i}`];
                          return (
                            <div key={i} className="bg-slate-900 border border-slate-750 rounded p-1">
                              <div className="text-[9px] text-slate-500 font-sans">M{i}</div>
                              <div className="font-bold text-cyan-300">{val ? `${val}%` : "-"}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-900/60 text-xs flex items-center justify-between">
                        <div>
                          <span className="text-slate-400">Humedad Promedio Oficial:</span>
                          <strong className="text-cyan-300 ml-1 text-sm">{focusHumInfo.hum}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Desviación:</span>
                          <strong className="text-slate-200 ml-1">±{focusHumInfo.desv}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Condición:</span>
                          <span className="ml-1 text-emerald-400 font-bold">
                            {focusHumInfo.hum > 14.5 ? "Requiere Presecado" : "Humedad Óptima"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-900/60 rounded-lg p-4">
                      <Droplet className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Aún no se han registrado las 14 caladas para este lote.</p>
                      <button
                        onClick={() => setSubTab("humedad")}
                        className="mt-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar 14 Caladas
                      </button>
                    </div>
                  )}
                </div>

                {/* Análisis Físico Breakdown */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <FlaskConical className="w-4 h-4" />
                      <span>Parámetros Físicos de Calidad ({selectedFocusLote.LOTE_ID})</span>
                    </div>
                    <button
                      onClick={() => setSubTab("analisis-humedo")}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Editar Análisis <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {focusAnalisis ? (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Rendimiento Integral (RI)</div>
                          <div className="font-bold text-emerald-300 text-sm">{focusAnalisis.RI || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Rendimiento Blanco (RB)</div>
                          <div className="font-bold text-white text-sm">{focusAnalisis.RB || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Rendimiento Masa (RM)</div>
                          <div className="font-bold text-white text-sm">{focusAnalisis.RM || 0}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Grano Entero</div>
                          <div className="font-bold text-cyan-300">{focusAnalisis.ENTERO || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Quebrado Integral (QI)</div>
                          <div className="font-bold text-amber-300">{focusAnalisis.QI || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Impurezas</div>
                          <div className="font-bold text-rose-300">{focusAnalisis.IMPUREZS || 0}%</div>
                        </div>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-750 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Olor / Estado Organoléptico:</span>
                        <strong className="text-slate-200">{focusAnalisis.OLOR || "Normal / Característico"}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-900/60 rounded-lg p-4">
                      <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Aún no se ha realizado el análisis físico en húmedo para este lote.</p>
                      <button
                        onClick={() => setSubTab("analisis-humedo")}
                        className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar Análisis Físico
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar for Lote */}
              <div className="flex items-center justify-between bg-slate-850 p-4 rounded-xl border border-slate-750">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenReport?.(selectedFocusLote.LOTE_ID)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Ver Ficha Técnica Completa (25 Parámetros)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate("presecado-seco", selectedFocusLote.LOTE_ID)}
                    className="px-3.5 py-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-bold text-xs rounded-lg border border-amber-500/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ir a Presecado</span>
                  </button>
                  <button
                    onClick={() => onNavigate("programacion-apit", selectedFocusLote.LOTE_ID)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <span>Programar Vaporizado APIT</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/60 p-6">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">No hay lotes disponibles para visualizar.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Registrar Nuevo Lote (Con Selección de Variedades + Peso Manual + Código C0) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Package className="w-5 h-5" />
                <span>Registrar Nuevo Lote de Arroz</span>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {savedSuccessLoteId ? (
              <div className="mt-4 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">¡Lote Registrado Exitosamente!</h3>
                  <p className="text-xs text-slate-300 mt-1 font-mono font-bold text-amber-400">
                    Código: {savedSuccessLoteId}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setActiveLoteFocusId(savedSuccessLoteId);
                      setSubTab("humedad");
                      handleCloseCreateModal();
                    }}
                    className="w-full py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer text-xs"
                  >
                    <Droplet className="w-4 h-4" />
                    <span>Registrar Muestreo de Humedad (14 Caladas)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveLoteFocusId(savedSuccessLoteId);
                      setSubTab("analisis-humedo");
                      handleCloseCreateModal();
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer text-xs"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>Realizar Análisis Físico en Húmedo</span>
                  </button>

                  <button
                    onClick={handleCloseCreateModal}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <span>Ver Tabla de Lotes</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreateError(null);
                  let rawId = (newLoteData.LOTE_ID || "").trim();
                  if (!rawId || rawId === "0" || rawId === "C00") {
                    setCreateError("Debe ingresar un código de lote válido (distinto de 0) o pulsar 'Generar auto'.");
                    return;
                  }
                  const targetLoteId = normalizeLoteId(rawId);
                  if (lotes.some(l => normalizeLoteId(l.LOTE_ID) === targetLoteId)) {
                    setCreateError(`El código de lote "${targetLoteId}" ya existe en el sistema. Los códigos de lote son únicos y no se pueden repetir.`);
                    return;
                  }

                  let sacosFinal = newLoteData.SACOS && Number(newLoteData.SACOS) > 0 ? Number(newLoteData.SACOS) : 0;
                  let pesoFinal = newLoteData.PESO_KG && Number(newLoteData.PESO_KG) > 0 ? Number(newLoteData.PESO_KG) : 0;

                  if (sacosFinal > 0 && pesoFinal <= 0) {
                    pesoFinal = sacosFinal * 50;
                  } else if (pesoFinal > 0 && sacosFinal <= 0) {
                    sacosFinal = Math.max(1, Math.round(pesoFinal / 50));
                  }

                  if (sacosFinal <= 0 && pesoFinal <= 0) {
                    setCreateError("Por favor ingrese la cantidad de sacos o el peso total del lote.");
                    return;
                  }

                  const selectedVar = isCustomVariedad ? customVariedadText : (newLoteData.VARIEDAD || "");
                  try {
                    await onSaveLote({
                      ...newLoteData,
                      LOTE_ID: targetLoteId,
                      VARIEDAD: selectedVar,
                      SACOS: sacosFinal,
                      PESO_KG: pesoFinal,
                      FECHA_INGRESO: newLoteData.FECHA_INGRESO || new Date().toISOString().split("T")[0],
                      HUM: 0, // Moisture must be calculated through caladas sampling
                      ESTADO_LOTE: "INGRESADO",
                      isNew: true
                    } as any);
                    setSavedSuccessLoteId(targetLoteId);
                  } catch (err: any) {
                    setCreateError(err.message || "Error al registrar el lote en el sistema.");
                  }
                }}
                className="mt-4 space-y-4 text-xs"
              >
                {createError && (
                  <div className="p-3 bg-rose-950/90 border border-rose-500/80 rounded-xl flex items-start gap-2.5 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-rose-300 block">Error de Validación</span>
                      <span className="text-rose-200 mt-0.5 block">{createError}</span>
                    </div>
                  </div>
                )}

                {/* Código de Lote C0 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Código de Lote *</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = getNextLoteId();
                            setNewLoteData({ ...newLoteData, LOTE_ID: next });
                            setCreateError(null);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                        >
                          Generar auto
                        </button>
                        {currentNormalizedNewLoteId && (
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isDuplicateNewLote
                              ? "text-rose-300 bg-rose-950 border-rose-500 animate-pulse"
                              : "text-amber-400 bg-slate-950 border-amber-500/40"
                          }`}>
                            {isDuplicateNewLote ? `⚠️ ${currentNormalizedNewLoteId} (Repetido)` : currentNormalizedNewLoteId}
                          </span>
                        )}
                      </div>
                    </label>
                    <div className={`flex rounded-lg overflow-hidden border transition-colors ${
                      isDuplicateNewLote
                        ? "border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20"
                        : "border-slate-700 focus-within:border-amber-500 bg-slate-800"
                    }`}>
                      <span className={`inline-flex items-center px-3 font-mono font-black text-xs border-r select-none ${
                        isDuplicateNewLote
                          ? "bg-rose-500/20 text-rose-300 border-rose-600"
                          : "bg-amber-500/20 text-amber-400 border-slate-700"
                      }`}>
                        C0
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="0"
                        value={newLoteData.LOTE_ID === "0" ? "0" : (newLoteData.LOTE_ID || "").replace(/^C0*/i, "")}
                        onFocus={(e) => {
                          if (e.target.value === "0") {
                            e.target.select();
                          }
                        }}
                        onChange={(e) => {
                          setCreateError(null);
                          const raw = e.target.value.trim();
                          if (raw === "" || raw === "0") {
                            setNewLoteData({ ...newLoteData, LOTE_ID: "0" });
                          } else {
                            const formatted = raw.toUpperCase().startsWith("C0") ? raw.toUpperCase() : `C0${raw}`;
                            setNewLoteData({ ...newLoteData, LOTE_ID: formatted });
                          }
                        }}
                        className="w-full bg-transparent px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    {isDuplicateNewLote ? (
                      <div className="mt-2 p-2 bg-rose-950/90 border border-rose-500/70 rounded-lg flex items-start gap-1.5 text-rose-200 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-rose-300">¡Código ya existe!</span>
                          <p className="text-[10px] text-rose-200 mt-0.5">
                            Los códigos de lote no se pueden repetir. Use otro o genere uno automático.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const next = getNextLoteId();
                              setNewLoteData({ ...newLoteData, LOTE_ID: next });
                              setCreateError(null);
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            Asignar libre ({getNextLoteId()})
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">
                        💡 Puede escribir <strong className="text-amber-300">2020</strong> y el sistema guardará <strong className="text-amber-300 font-mono">C02020</strong>. Debe ser único.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Fecha de Ingreso *</label>
                    <input
                      type="date"
                      required
                      value={newLoteData.FECHA_INGRESO || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, FECHA_INGRESO: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Cliente / Productor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Agrícola del Norte S.A.C."
                      value={newLoteData.CLIENTE || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, CLIENTE: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  
                  {/* Lista Desplegable de Variedades de Arroz */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Variedad de Arroz *</label>
                    <select
                      required
                      value={isCustomVariedad ? "OTRA" : (newLoteData.VARIEDAD || "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "OTRA") {
                          setIsCustomVariedad(true);
                          setNewLoteData({ ...newLoteData, VARIEDAD: customVariedadText });
                        } else {
                          setIsCustomVariedad(false);
                          setNewLoteData({ ...newLoteData, VARIEDAD: val });
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Seleccionar Variedad...</option>
                      {VARIEDADES_ARROZ_OPCIONES.map((v) => (
                        <option key={v} value={v}>
                          {v === "OTRA" ? "OTRA (Ingresar manualmente...)" : v}
                        </option>
                      ))}
                    </select>

                    {isCustomVariedad && (
                      <input
                        type="text"
                        required
                        placeholder="Escriba el nombre de la variedad..."
                        value={customVariedadText}
                        onChange={(e) => {
                          setCustomVariedadText(e.target.value);
                          setNewLoteData({ ...newLoteData, VARIEDAD: e.target.value });
                        }}
                        className="mt-2 w-full bg-slate-800 border border-amber-500/60 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Sacos y Peso Total (Ingreso Manual con Auto-estimación opcional) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Cantidad de Sacos *</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={newLoteData.SACOS !== undefined ? newLoteData.SACOS : 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setNewLoteData({ 
                          ...newLoteData, 
                          SACOS: val
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {newLoteData.PESO_KG && Number(newLoteData.PESO_KG) > 0 && (!newLoteData.SACOS || Number(newLoteData.SACOS) <= 0) && (
                      <button
                        type="button"
                        onClick={() => setNewLoteData({ ...newLoteData, SACOS: Math.max(1, Math.round(Number(newLoteData.PESO_KG) / 50)) })}
                        className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Estimar: {Math.max(1, Math.round(Number(newLoteData.PESO_KG) / 50))} sacos</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Peso Total (Kg) - Manual *</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={newLoteData.PESO_KG !== undefined ? newLoteData.PESO_KG : 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setNewLoteData({ ...newLoteData, PESO_KG: val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {newLoteData.SACOS && Number(newLoteData.SACOS) > 0 && (!newLoteData.PESO_KG || Number(newLoteData.PESO_KG) <= 0) && (
                      <button
                        type="button"
                        onClick={() => setNewLoteData({ ...newLoteData, PESO_KG: Number(newLoteData.SACOS) * 50 })}
                        className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Estimar: {(Number(newLoteData.SACOS) * 50).toLocaleString()} kg</span>
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ingreso manual directo según boleta/pesaje de balanza (valor inicial en 0).
                    </p>
                  </div>
                </div>

                {/* Bloqueo Explicativo de Humedad: Cálculo Automático por 14 Caladas */}
                <div className="bg-slate-950/90 border border-cyan-800/60 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <Droplet className="w-4 h-4" />
                    <span>Humedad Inicial (%): Cálculo Automático por 14 Caladas</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Por norma de calidad, la humedad no se digita directamente aquí. Se calculará como el <strong>promedio exacto de las 14 caladas de muestreo</strong> en la pestaña <strong>"2. Registro de Humedad"</strong>.
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-mono bg-cyan-950/50 px-2 py-1 rounded">
                    <span>Estado: <strong>Pendiente de 14 Caladas (M1 - M14)</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Zona de Origen</label>
                    <input
                      type="text"
                      placeholder="Ej. Chiclayo / Ferreñafe"
                      value={newLoteData.ZONA || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, ZONA: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Ubicación / Silo</label>
                    <input
                      type="text"
                      placeholder="Ej. Silo Pulmón 01"
                      value={newLoteData.UBICACION || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, UBICACION: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Observaciones</label>
                  <textarea
                    rows={2}
                    placeholder="Detalles sobre estado del grano, impurezas visuales, transporte..."
                    value={newLoteData.OBSERVACIONES || ""}
                    onChange={(e) => setNewLoteData({ ...newLoteData, OBSERVACIONES: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseCreateModal}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isDuplicateNewLote}
                    title={isDuplicateNewLote ? "El código de lote ya existe en el sistema. Los códigos no se pueden repetir." : undefined}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Guardar Lote C0
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
