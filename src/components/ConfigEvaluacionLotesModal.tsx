import React, { useState, useEffect, useMemo } from "react";
import { 
  ConfiguracionEvaluacionLotes, 
  CriterioEvaluacionConfig, 
  CategoriaCriterioEvaluacion,
  Lote, 
  AnalisisHumedo, 
  RegistroHumedad,
  UserProfile,
  ReglasVetoCriticoConfig
} from "../types";
import { 
  CONFIG_EVALUACION_LOTES_DEFAULT, 
  REGLAS_VETO_DEFAULT,
  PRESETS_EVALUACION_LOTES, 
  calcularEvaluacionLote,
  OPCIONES_ORGANOLEPTICAS,
  CodigoOrganoleptico
} from "../utils/evaluacionCalidad";
import { 
  X, 
  Save, 
  RotateCcw, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  Layers, 
  Percent, 
  Check, 
  Search, 
  Filter, 
  FlaskConical, 
  Droplet, 
  Scale, 
  TrendingUp, 
  ShieldCheck, 
  Flame,
  ChevronDown,
  RefreshCw,
  Award,
  ShieldAlert,
  Bug,
  Wind,
  BellRing,
  Bell,
  AlertOctagon,
  Activity,
  Leaf,
  Scissors,
  Plus,
  Trash2,
  Eye,
  SlidersHorizontal,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import {
  ReglaAlertaCriticaDashboard,
  ConfiguracionAlertasDashboard,
  OperadorAlerta,
  SeveridadAlerta,
  ParametroAlertaCalidad
} from "../types";
import {
  CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT,
  REGLAS_ALERTAS_DASHBOARD_DEFAULT,
  evaluarTodasAlertasCriticas
} from "../utils/evaluacionCalidad";

interface ConfigEvaluacionLotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfiguracionEvaluacionLotes;
  onSaveConfig: (newConfig: ConfiguracionEvaluacionLotes) => Promise<void>;
  currentUser?: UserProfile;
  lotes?: Lote[];
  analisisHumedos?: AnalisisHumedo[];
  humedades?: RegistroHumedad[];
  initialTab?: "criterios" | "umbrales" | "vetos" | "alertas" | "simulador";
}

export const ConfigEvaluacionLotesModal: React.FC<ConfigEvaluacionLotesModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  currentUser,
  lotes = [],
  analisisHumedos = [],
  humedades = [],
  initialTab = "criterios"
}) => {
  const [activeTab, setActiveTab] = useState<"criterios" | "umbrales" | "vetos" | "alertas" | "simulador">(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Editable local state cloned from config
  const [localConfig, setLocalConfig] = useState<ConfiguracionEvaluacionLotes>(() => {
    const initial = config ? JSON.parse(JSON.stringify(config)) : CONFIG_EVALUACION_LOTES_DEFAULT;
    if (!initial.reglasVeto) {
      initial.reglasVeto = { ...REGLAS_VETO_DEFAULT };
    }
    if (!initial.alertasDashboard) {
      initial.alertasDashboard = JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
    }
    return initial;
  });

  // Keep local state in sync when config prop changes or modal opens
  useEffect(() => {
    if (isOpen && config) {
      const cloned = JSON.parse(JSON.stringify(config));
      if (!cloned.reglasVeto) {
        cloned.reglasVeto = { ...REGLAS_VETO_DEFAULT };
      }
      if (!cloned.alertasDashboard) {
        cloned.alertasDashboard = JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
      }
      setLocalConfig(cloned);
      setSavedSuccess(false);
    }
  }, [isOpen, config]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Simulator state: test with an existing lote or custom
  const [simulatorLoteId, setSimulatorLoteId] = useState<string>(lotes[0]?.LOTE_ID || "");

  if (!isOpen) return null;

  // Total weight calculation
  const totalPesoActivo = localConfig.criterios
    .filter((c) => c.activo)
    .reduce((acc, c) => acc + (Number(c.peso) || 0), 0);

  const isBalanced100 = Math.abs(totalPesoActivo - 100) < 0.01;

  // Filtered criteria for display
  const filteredCriterios = localConfig.criterios.filter((c) => {
    const matchesCat = selectedCategory === "TODOS" || c.categoria === selectedCategory;
    const matchesSearch = 
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.abreviatura.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.condicion.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Handle Preset Load
  const handleLoadPreset = (preset: ConfiguracionEvaluacionLotes) => {
    setLocalConfig(JSON.parse(JSON.stringify(preset)));
  };

  // Handle criterion field update
  const handleUpdateCriterio = (id: string, updates: Partial<CriterioEvaluacionConfig>) => {
    setLocalConfig((prev) => {
      const criterios = prev.criterios.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates };
          // Auto-generate condition string if numeric limits changed
          if (updates.tipoOperador || updates.valorMin !== undefined || updates.valorMax !== undefined || updates.codigoOrganolepticoMax) {
            if (updated.tipoOperador === "MAYOR_A" && updated.valorMin !== undefined) {
              updated.condicion = `MAYOR A ${updated.valorMin}`;
            } else if (updated.tipoOperador === "MAYOR_IGUAL" && updated.valorMin !== undefined) {
              updated.condicion = `DE ${updated.valorMin} A +`;
            } else if (updated.tipoOperador === "MENOR_A" && updated.valorMax !== undefined) {
              updated.condicion = `MENOR A ${updated.valorMax}`;
            } else if (updated.tipoOperador === "MENOR_IGUAL" && updated.valorMax !== undefined) {
              updated.condicion = `MAX ${updated.valorMax}`;
            } else if (updated.tipoOperador === "RANGO" && updated.valorMin !== undefined && updated.valorMax !== undefined) {
              updated.condicion = `DE ${updated.valorMin} A ${updated.valorMax}`;
            } else if (updated.tipoOperador === "ORGANOLEPTICO_MAX") {
              updated.condicion =
                updated.codigoOrganolepticoMax === "N" ? "NINGUNO / NO PRESENTA (N/NP)" :
                updated.codigoOrganolepticoMax === "P" ? "HASTA POCO (N/NP, P)" :
                updated.codigoOrganolepticoMax === "R" ? "HASTA REGULAR (N/NP, P, R)" :
                updated.codigoOrganolepticoMax === "V" ? "HASTA VARIADO (N/NP, P, R, V)" : "CUALQUIERA (HASTA B)";
            }
          }
          return updated;
        }
        return c;
      });
      return { ...prev, criterios };
    });
  };

  // Auto-balance weights to exactly 100%
  const handleAutoBalanceWeights = () => {
    setLocalConfig((prev) => {
      const activeCriterios = prev.criterios.filter((c) => c.activo);
      const currentSum = activeCriterios.reduce((acc, c) => acc + (Number(c.peso) || 0), 0);
      if (currentSum === 0) return prev;

      const scale = 100 / currentSum;
      let runningSum = 0;

      const updatedCriterios = prev.criterios.map((c, index) => {
        if (!c.activo) return c;
        if (index === prev.criterios.length - 1) {
          // Last active item absorbs any rounding difference
          const newWeight = Number((100 - runningSum).toFixed(1));
          return { ...c, peso: Math.max(0, newWeight) };
        }
        const scaledWeight = Number((c.peso * scale).toFixed(1));
        runningSum += scaledWeight;
        return { ...c, peso: scaledWeight };
      });

      return { ...prev, criterios: updatedCriterios };
    });
  };

  // Safe accessor for Veto Rules
  const reglasVeto = localConfig.reglasVeto || REGLAS_VETO_DEFAULT;

  // Safe accessor for Dashboard Alert Rules
  const alertasConfig = useMemo(() => {
    return localConfig.alertasDashboard || JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
  }, [localConfig.alertasDashboard]);

  // Evaluated alerts for registered lots in plant
  const alertasDetectadasEnPlanta = useMemo(() => {
    return evaluarTodasAlertasCriticas(lotes, analisisHumedos, humedades, localConfig);
  }, [lotes, analisisHumedos, humedades, localConfig]);

  const lotesAfectadosSet = useMemo(() => {
    return new Set(alertasDetectadasEnPlanta.map(a => a.loteId));
  }, [alertasDetectadasEnPlanta]);

  const totalCriticosPlanta = useMemo(() => {
    return alertasDetectadasEnPlanta.filter(a => a.severidad === "CRITICO").length;
  }, [alertasDetectadasEnPlanta]);

  const totalAdvertenciasPlanta = useMemo(() => {
    return alertasDetectadasEnPlanta.filter(a => a.severidad === "ADVERTENCIA").length;
  }, [alertasDetectadasEnPlanta]);

  // Search & filter for alerts tab
  const [alertSearchTerm, setAlertSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<"TODAS" | "CRITICO" | "ADVERTENCIA">("TODAS");
  const [isAddingCustomAlert, setIsAddingCustomAlert] = useState(false);
  const [newAlertParam, setNewAlertParam] = useState<ParametroAlertaCalidad>("SCORE_TOTAL");
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertDesc, setNewAlertDesc] = useState("");
  const [newAlertOp, setNewAlertOp] = useState<OperadorAlerta>("MAYOR_A");
  const [newAlertCrit, setNewAlertCrit] = useState<number>(10.0);
  const [newAlertAdv, setNewAlertAdv] = useState<number>(8.0);
  const [newAlertMaxCrit, setNewAlertMaxCrit] = useState<number>(16.0);
  const [newAlertMaxAdv, setNewAlertMaxAdv] = useState<number>(15.0);
  const [newAlertSev, setNewAlertSev] = useState<SeveridadAlerta>("CRITICO");

  const handleUpdateAlertasConfig = (updates: Partial<ConfiguracionAlertasDashboard>) => {
    setLocalConfig((prev) => {
      const current = prev.alertasDashboard || JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
      return {
        ...prev,
        alertasDashboard: {
          ...current,
          ...updates
        }
      };
    });
  };

  const handleUpdateReglaAlerta = (reglaId: string, updates: Partial<ReglaAlertaCriticaDashboard>) => {
    setLocalConfig((prev) => {
      const current = prev.alertasDashboard || JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
      const updatedReglas = current.reglas.map((r) => (r.id === reglaId ? { ...r, ...updates } : r));
      return {
        ...prev,
        alertasDashboard: {
          ...current,
          reglas: updatedReglas
        }
      };
    });
  };

  const handleResetAlertasReglas = () => {
    setLocalConfig((prev) => ({
      ...prev,
      alertasDashboard: JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT))
    }));
  };

  const handleDeleteAlertRule = (reglaId: string) => {
    setLocalConfig((prev) => {
      const current = prev.alertasDashboard || JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
      return {
        ...prev,
        alertasDashboard: {
          ...current,
          reglas: current.reglas.filter((r) => r.id !== reglaId)
        }
      };
    });
  };

  const handleCreateCustomAlert = () => {
    if (!newAlertName.trim()) return;
    const ruleId = `custom-alert-${Date.now()}`;
    const rule: ReglaAlertaCriticaDashboard = {
      id: ruleId,
      parametro: newAlertParam,
      nombre: newAlertName.trim(),
      descripcion: newAlertDesc.trim() || `Alerta personalizada para ${newAlertParam}`,
      unidad: "%",
      operador: newAlertOp,
      umbralCritico: newAlertCrit,
      umbralAdvertencia: newAlertAdv,
      umbralMax: newAlertOp === "FUERA_RANGO" ? newAlertMaxCrit : undefined,
      umbralMaxAdvertencia: newAlertOp === "FUERA_RANGO" ? newAlertMaxAdv : undefined,
      severidadPorDefecto: newAlertSev,
      activo: true,
      mostrarEnDashboard: true,
      colorHex: newAlertSev === "CRITICO" ? "#ef4444" : "#f59e0b"
    };

    setLocalConfig((prev) => {
      const current = prev.alertasDashboard || JSON.parse(JSON.stringify(CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT));
      return {
        ...prev,
        alertasDashboard: {
          ...current,
          reglas: [...current.reglas, rule]
        }
      };
    });

    setIsAddingCustomAlert(false);
    setNewAlertName("");
    setNewAlertDesc("");
  };

  // Handle Save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalConfig: ConfiguracionEvaluacionLotes = {
        ...localConfig,
        fechaActualizacion: new Date().toISOString().split("T")[0],
        actualizadoPor: currentUser?.nombre || "Control de Calidad"
      };
      await onSaveConfig(finalConfig);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error("Error saving evaluacion config:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Simulator calculation
  const simLote = lotes.find((l) => l.LOTE_ID === simulatorLoteId) || lotes[0];
  const simAh = analisisHumedos.find((a) => a.LOTE_ID === simLote?.LOTE_ID);
  const simHum = humedades.find((h) => h.LOTE_ID === simLote?.LOTE_ID);
  const simAvgHum = simHum?.["H. PROMEDIO"] || simLote?.HUM || 0;
  const simDesv = simHum?.["DESV."] || simLote?.DESV || 0;

  const simResult = calcularEvaluacionLote(simAh, simLote, simAvgHum, simDesv, localConfig, simHum);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Configuración Maestra: Evaluación y Dictamen de Lotes
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  24 Parámetros
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ajuste centralizado de porcentajes de ponderación (%) y umbrales de aprobación oficial para materia prima.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-close-config-evaluacion"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRESET SELECTOR & WEIGHT HEALTH BANNER */}
        <div className="px-4 sm:px-6 py-3 bg-slate-850 border-b border-slate-750 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Plantillas Rápidas:
            </span>
            {PRESETS_EVALUACION_LOTES.map((preset) => {
              const isSelected = localConfig.id === preset.id || localConfig.nombre === preset.nombre;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
                  }`}
                >
                  {preset.nombre}
                </button>
              );
            })}
          </div>

          {/* Weight Health Indicator */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 font-bold ${
              isBalanced100 
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : "bg-amber-950/60 border-amber-500/50 text-amber-300"
            }`}>
              <Percent className="w-3.5 h-3.5" />
              <span>Suma de Pesos: {totalPesoActivo.toFixed(1)}% / 100%</span>
              {isBalanced100 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-1" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 ml-1" />
              )}
            </div>

            {!isBalanced100 && (
              <button
                onClick={handleAutoBalanceWeights}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-all"
                title="Ajusta proporcionalmente los pesos para sumar exactamente 100%"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Auto-Calibrar a 100%</span>
              </button>
            )}

            <button
              onClick={() => setLocalConfig(JSON.parse(JSON.stringify(CONFIG_EVALUACION_LOTES_DEFAULT)))}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1 cursor-pointer"
              title="Restaurar parámetros oficiales estándar"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-4 sm:px-6 pt-3 bg-slate-900 border-b border-slate-750 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("criterios")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "criterios"
                ? "bg-slate-800 text-amber-400 border-t border-x border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1. Parámetros y Porcentajes (%)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-slate-400">
              {localConfig.criterios.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("umbrales")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "umbrales"
                ? "bg-slate-800 text-amber-400 border-t border-x border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>2. Umbrales de Aprobación</span>
          </button>

          <button
            onClick={() => setActiveTab("vetos")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "vetos"
                ? "bg-rose-950/60 text-rose-300 border-t border-x border-rose-700/80"
                : "text-slate-400 hover:text-rose-300 hover:bg-slate-850"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>3. Vetos Críticos / Rechazo</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-900/60 text-[10px] text-rose-300 border border-rose-700">
              6
            </span>
          </button>

          <button
            id="tab-alertas-dashboard"
            onClick={() => setActiveTab("alertas")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "alertas"
                ? "bg-slate-800 text-amber-400 border-t border-x border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-amber-300 hover:bg-slate-850"
            }`}
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span>4. Alertas Visuales Dashboard</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] border ${
              alertasDetectadasEnPlanta.length > 0 
                ? "bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse font-bold" 
                : "bg-slate-900 text-slate-400 border-slate-700"
            }`}>
              {alertasConfig.reglas.filter(r => r.activo).length} activas
            </span>
          </button>

          <button
            onClick={() => setActiveTab("simulador")}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "simulador"
                ? "bg-slate-800 text-amber-400 border-t border-x border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>5. Simulador en Tiempo Real</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-900/60 space-y-4">
          
          {/* TAB 1: PARÁMETROS Y PORCENTAJES */}
          {activeTab === "criterios" && (
            <div className="space-y-4">
              {/* Category Filter & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  {[
                    { id: "TODOS", label: "Todos (24)" },
                    { id: "HUMEDAD", label: "Humedad (2)" },
                    { id: "FISICO_RENDIMIENTO", label: "Rendimientos (6)" },
                    { id: "DEFECTOS_CALIDAD", label: "Defectos Calidad (8)" },
                    { id: "ORGANOLEPTICO", label: "Organolépticos (8)" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        selectedCategory === cat.id
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "bg-slate-800 hover:bg-slate-750 text-slate-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar parámetro..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Criteria Cards Grid / Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCriterios.map((c) => {
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                        c.activo
                          ? "bg-slate-800/90 border-slate-700 hover:border-slate-600 shadow-sm"
                          : "bg-slate-900/50 border-slate-800/60 opacity-60"
                      }`}
                    >
                      <div>
                        {/* Header of Item Card */}
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-750">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`chk-${c.id}`}
                              checked={c.activo}
                              onChange={(e) => handleUpdateCriterio(c.id, { activo: e.target.checked })}
                              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-600 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <label 
                                  htmlFor={`chk-${c.id}`}
                                  className="text-xs font-bold text-white cursor-pointer hover:text-amber-400 transition-colors"
                                >
                                  {c.nombre}
                                </label>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-750">
                                  {c.abreviatura}
                                </span>
                              </div>
                              <span className="text-[10px] text-amber-400/90 font-medium">
                                {c.categoria === "HUMEDAD" ? "Humedad y Desviación" :
                                 c.categoria === "FISICO_RENDIMIENTO" ? "Rendimiento Físico" :
                                 c.categoria === "DEFECTOS_CALIDAD" ? "Defecto Físico / Yesos" :
                                 "Factor Organoléptico"}
                              </span>
                            </div>
                          </div>

                          {/* Weight Input Box */}
                          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                            <span className="text-[10px] text-slate-400 font-bold">Peso:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={c.peso}
                              onChange={(e) => handleUpdateCriterio(c.id, { peso: parseFloat(e.target.value) || 0 })}
                              className="w-12 bg-slate-800 text-amber-300 font-black text-xs text-right rounded px-1 py-0.5 border border-slate-600 focus:outline-none focus:border-amber-400"
                            />
                            <span className="text-xs font-bold text-amber-400">%</span>
                          </div>
                        </div>

                        {/* Conditions and Thresholds controls */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {/* Operator Selection */}
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Regla de Cumplimiento:</label>
                            <select
                              value={c.tipoOperador}
                              onChange={(e) => handleUpdateCriterio(c.id, { tipoOperador: e.target.value as any })}
                              className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                            >
                              <option value="MAYOR_A">Mayor estricto (&gt; Min)</option>
                              <option value="MAYOR_IGUAL">Mayor o igual (≥ Min)</option>
                              <option value="MENOR_A">Menor estricto (&lt; Max)</option>
                              <option value="MENOR_IGUAL">Menor o igual (≤ Max)</option>
                              <option value="RANGO">Rango (Min a Max)</option>
                              <option value="ORGANOLEPTICO_MAX">Límite Organoléptico</option>
                            </select>
                          </div>

                          {/* Numeric / Organoleptic Limit Values */}
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Valor(es) de Referencia:</label>
                            
                            {c.tipoOperador === "ORGANOLEPTICO_MAX" ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={c.codigoOrganolepticoMax || "P"}
                                  onChange={(e) => handleUpdateCriterio(c.id, { codigoOrganolepticoMax: e.target.value as any })}
                                  className="flex-1 bg-slate-900 border border-slate-750 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                                >
                                  <option value="N">Estricto Ninguno / No Presenta (N / NP)</option>
                                  <option value="P">Hasta Poco (N/NP o P)</option>
                                  <option value="R">Hasta Regular (N/NP, P o R)</option>
                                  <option value="V">Hasta Variado (N/NP, P, R o V)</option>
                                  <option value="B">Bastante permitido</option>
                                </select>
                              </div>
                            ) : c.tipoOperador === "RANGO" ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Mín"
                                  value={c.valorMin ?? ""}
                                  onChange={(e) => handleUpdateCriterio(c.id, { valorMin: parseFloat(e.target.value) })}
                                  className="w-1/2 bg-slate-900 border border-slate-750 rounded px-1.5 py-1 text-xs text-white text-center"
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Máx"
                                  value={c.valorMax ?? ""}
                                  onChange={(e) => handleUpdateCriterio(c.id, { valorMax: parseFloat(e.target.value) })}
                                  className="w-1/2 bg-slate-900 border border-slate-750 rounded px-1.5 py-1 text-xs text-white text-center"
                                />
                                {c.unidad && <span className="text-[10px] text-slate-400">{c.unidad}</span>}
                              </div>
                            ) : (c.tipoOperador === "MAYOR_A" || c.tipoOperador === "MAYOR_IGUAL") ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Mínimo"
                                  value={c.valorMin ?? ""}
                                  onChange={(e) => handleUpdateCriterio(c.id, { valorMin: parseFloat(e.target.value) })}
                                  className="w-full bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-white"
                                />
                                {c.unidad && <span className="text-[10px] text-slate-400">{c.unidad}</span>}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="Máximo"
                                  value={c.valorMax ?? ""}
                                  onChange={(e) => handleUpdateCriterio(c.id, { valorMax: parseFloat(e.target.value) })}
                                  className="w-full bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-white"
                                />
                                {c.unidad && <span className="text-[10px] text-slate-400">{c.unidad}</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Condition String Summary */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-750/70">
                          <span className="text-slate-400">Condición generada:</span>
                          <span className="font-mono font-bold text-amber-300">
                            {c.condicion}
                          </span>
                        </div>
                      </div>

                      {/* Technical Description */}
                      {c.descripcionTecnica && (
                        <p className="mt-2 text-[10px] text-slate-400 italic">
                          {c.descripcionTecnica}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: UMBRALES DE APROBACIÓN */}
          {activeTab === "umbrales" && (
            <div className="space-y-6 max-w-3xl mx-auto py-2">
              <div className="bg-slate-850 p-5 rounded-2xl border border-slate-750 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-750 pb-3">
                  <Award className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Escala de Clasificación y Dictamen Oficial</h3>
                    <p className="text-xs text-slate-400">
                      Configure el puntaje porcentual mínimo acumulado para cada categoría de dictamen en recepción.
                    </p>
                  </div>
                </div>

                {/* 4 Status Threshold Sliders / Inputs */}
                <div className="space-y-4">
                  {/* 1. APROBADO */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                      <div>
                        <div className="text-xs font-black text-emerald-300">LOTE APROBADO</div>
                        <div className="text-[11px] text-slate-400">Pasa directamente a programación APIT y vaporizado prioritario (Mayor a {localConfig.umbrales.umbralAprobado}%).</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 font-medium">Mayor a (&gt;):</span>
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-emerald-600/50">
                        <input
                          type="number"
                          min="50"
                          max="100"
                          step="0.5"
                          value={localConfig.umbrales.umbralAprobado}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 96;
                            setLocalConfig(prev => ({ ...prev, umbrales: { ...prev.umbrales, umbralAprobado: val } }));
                          }}
                          className="w-14 bg-transparent text-emerald-300 font-black text-sm text-right focus:outline-none"
                        />
                        <span className="text-emerald-400 font-bold text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. OBSERVADOS */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
                      <div>
                        <div className="text-xs font-black text-amber-300">LOTES OBSERVADOS</div>
                        <div className="text-[11px] text-slate-400">Requiere revisión técnica o ajuste de vaporizado ({localConfig.umbrales.umbralObservacion}% a {localConfig.umbrales.umbralAprobado}%).</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 font-medium">Desde (≥):</span>
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-amber-600/50">
                        <input
                          type="number"
                          min="40"
                          max="99"
                          step="0.5"
                          value={localConfig.umbrales.umbralObservacion}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 91;
                            setLocalConfig(prev => ({ ...prev, umbrales: { ...prev.umbrales, umbralObservacion: val } }));
                          }}
                          className="w-14 bg-transparent text-amber-300 font-black text-sm text-right focus:outline-none"
                        />
                        <span className="text-amber-400 font-bold text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. EXPERIMENTAL */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-orange-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></span>
                      <div>
                        <div className="text-xs font-black text-orange-300">LOTE EXPERIMENTAL</div>
                        <div className="text-[11px] text-slate-400">Procesar con batch piloto o supervisión expresa ({localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}% a {localConfig.umbrales.umbralObservacion}%).</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 font-medium">Desde (≥):</span>
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-orange-600/50">
                        <input
                          type="number"
                          min="30"
                          max="95"
                          step="0.5"
                          value={localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 86;
                            setLocalConfig(prev => ({ 
                              ...prev, 
                              umbrales: { 
                                ...prev.umbrales, 
                                umbralExperimental: val,
                                umbralRiesgo: val 
                              } 
                            }));
                          }}
                          className="w-14 bg-transparent text-orange-300 font-black text-sm text-right focus:outline-none"
                        />
                        <span className="text-orange-400 font-bold text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. DESAPROBADO */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
                      <div>
                        <div className="text-xs font-black text-rose-300">LOTE DESAPROBADO</div>
                        <div className="text-[11px] text-slate-400">Puntaje inferior a {localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}%. No apto para proceso regular.</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-rose-950/60 border border-rose-800 rounded text-rose-300 font-mono text-xs font-bold">
                        &lt; {localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Scale Ribbon */}
                <div className="mt-4 pt-4 border-t border-slate-750">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Espectro de Decisión Calibrado:</div>
                  <div className="h-6 rounded-lg overflow-hidden flex text-[10px] font-bold text-slate-950 text-center leading-6">
                    <div 
                      style={{ width: `${localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}%` }} 
                      className="bg-rose-500" 
                      title={`Desaprobado: < ${localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}%`}
                    >
                      Desaprobado (&lt;{localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}%)
                    </div>
                    <div 
                      style={{ width: `${localConfig.umbrales.umbralObservacion - (localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo)}%` }} 
                      className="bg-orange-400"
                      title={`Experimental: ${localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}% a ${localConfig.umbrales.umbralObservacion}%`}
                    >
                      Experimental ({localConfig.umbrales.umbralExperimental ?? localConfig.umbrales.umbralRiesgo}% - {localConfig.umbrales.umbralObservacion}%)
                    </div>
                    <div 
                      style={{ width: `${localConfig.umbrales.umbralAprobado - localConfig.umbrales.umbralObservacion}%` }} 
                      className="bg-amber-400"
                      title={`Observados: ${localConfig.umbrales.umbralObservacion}% a ${localConfig.umbrales.umbralAprobado}%`}
                    >
                      Observados ({localConfig.umbrales.umbralObservacion}% - {localConfig.umbrales.umbralAprobado}%)
                    </div>
                    <div 
                      style={{ width: `${100 - localConfig.umbrales.umbralAprobado}%` }} 
                      className="bg-emerald-400"
                      title={`Aprobado: > ${localConfig.umbrales.umbralAprobado}%`}
                    >
                      Aprobado (&gt;{localConfig.umbrales.umbralAprobado}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VETOS CRÍTICOS / RECHAZO AUTOMÁTICO */}
          {activeTab === "vetos" && (
            <div className="space-y-6 max-w-3xl mx-auto py-2">
              <div className="bg-slate-850 p-5 rounded-2xl border border-rose-900/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-750 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Reglas de Veto Crítico (Desaprobación Automática Inmediata)
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          MANDATORIO
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Si un lote transgrede cualquiera de estas 5 condiciones críticas de calidad, será <strong>DESAPROBADO/RECHAZADO automáticamente</strong>, sin importar el puntaje ponderado obtenido.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-750">
                    <input
                      type="checkbox"
                      checked={reglasVeto.activarVetosCriticos !== false}
                      onChange={(e) => {
                        setLocalConfig(prev => ({
                          ...prev,
                          reglasVeto: {
                            ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                            activarVetosCriticos: e.target.checked
                          }
                        }));
                      }}
                      className="w-4 h-4 text-rose-500 rounded bg-slate-800 border-slate-700 focus:ring-rose-400"
                    />
                    <span className="text-xs font-bold text-slate-200">Vetos Activados</span>
                  </label>
                </div>

                {/* 5 Veto Rules Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Regla 1: Grano Verde (Escalamiento >6% Obs, >8% Riesgo, >10% Rechazo) */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-950 text-rose-400 font-black text-xs flex items-center justify-center border border-rose-800">
                          1
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">Escala Crítica de Grano Verde (GV)</div>
                          <div className="text-[10px] text-slate-400">Escalamiento: Observado &gt; 6%, Riesgo &gt; 8%, Rechazo &gt; 10%</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                      {/* Observado > 6% */}
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300/90 font-medium">1. En Observación si GV &gt;</span>
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-amber-600/50">
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="20"
                            value={reglasVeto.maxGranoVerdeObservado ?? 6.0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 6.0;
                              setLocalConfig(prev => ({
                                ...prev,
                                reglasVeto: {
                                  ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                  maxGranoVerdeObservado: val
                                }
                              }));
                            }}
                            className="w-10 bg-transparent text-amber-300 font-black text-xs text-right focus:outline-none"
                          />
                          <span className="text-amber-400 font-bold text-[10px]">%</span>
                        </div>
                      </div>

                      {/* Riesgo > 8% */}
                      <div className="flex items-center justify-between">
                        <span className="text-orange-300/90 font-medium">2. Con Riesgo si GV &gt;</span>
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-orange-600/50">
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="25"
                            value={reglasVeto.maxGranoVerdeRiesgo ?? 8.0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 8.0;
                              setLocalConfig(prev => ({
                                ...prev,
                                reglasVeto: {
                                  ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                  maxGranoVerdeRiesgo: val
                                }
                              }));
                            }}
                            className="w-10 bg-transparent text-orange-300 font-black text-xs text-right focus:outline-none"
                          />
                          <span className="text-orange-400 font-bold text-[10px]">%</span>
                        </div>
                      </div>

                      {/* Rechazo > 10% */}
                      <div className="flex items-center justify-between">
                        <span className="text-rose-300/90 font-bold">3. Desaprobar / Rechazo si GV &gt;</span>
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-rose-600/60">
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            max="30"
                            value={reglasVeto.maxGranoVerde ?? 10.0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 10.0;
                              setLocalConfig(prev => ({
                                ...prev,
                                reglasVeto: {
                                  ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                  maxGranoVerde: val
                                }
                              }));
                            }}
                            className="w-10 bg-transparent text-rose-300 font-black text-xs text-right focus:outline-none"
                          />
                          <span className="text-rose-400 font-bold text-[10px]">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Regla 2: Grano Inmaduro > 5% */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-950 text-rose-400 font-black text-xs flex items-center justify-center border border-rose-800">
                          2
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">Grano Inmaduro (GI) Crítico</div>
                          <div className="text-[10px] text-slate-400">Rechazo inmediato si supera el límite</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-300">Desaprobar automáticamente si GI &gt;</span>
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-rose-700/60">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="20"
                          value={reglasVeto.maxGranoInmaduro}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 5.0;
                            setLocalConfig(prev => ({
                              ...prev,
                              reglasVeto: {
                                ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                maxGranoInmaduro: val
                              }
                            }));
                          }}
                          className="w-12 bg-transparent text-rose-300 font-black text-sm text-right focus:outline-none"
                        />
                        <span className="text-rose-400 font-bold text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Regla 3: Rendimiento Integral < 75% */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-950 text-rose-400 font-black text-xs flex items-center justify-center border border-rose-800">
                          3
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">Rendimiento Integral (RI) Mínimo</div>
                          <div className="text-[10px] text-slate-400">Rechazo si está por debajo del estándar</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-300">Desaprobar automáticamente si RI &lt;</span>
                      <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-rose-700/60">
                        <input
                          type="number"
                          step="0.5"
                          min="50"
                          max="85"
                          value={reglasVeto.minRendimientoIntegral}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 75.0;
                            setLocalConfig(prev => ({
                              ...prev,
                              reglasVeto: {
                                ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                minRendimientoIntegral: val
                              }
                            }));
                          }}
                          className="w-12 bg-transparent text-rose-300 font-black text-sm text-right focus:outline-none"
                        />
                        <span className="text-rose-400 font-bold text-xs">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Regla 4: Bastante Olor */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-950 text-rose-400 font-black text-xs flex items-center justify-center border border-rose-800">
                          4
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">Bastante Olor (Fermentación)</div>
                          <div className="text-[10px] text-slate-400">Desaprobación inmediata si Olor = B</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-300">Bloquear lote con Bastante Olor</span>
                      <input
                        type="checkbox"
                        checked={reglasVeto.bloquearBastanteOlor !== false}
                        onChange={(e) => {
                          setLocalConfig(prev => ({
                            ...prev,
                            reglasVeto: {
                              ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                              bloquearBastanteOlor: e.target.checked
                            }
                          }));
                        }}
                        className="w-4 h-4 text-rose-500 rounded bg-slate-800 border-slate-700 focus:ring-rose-400"
                      />
                    </div>
                  </div>

                  {/* Regla 5: Bastante Plaga / Hongo */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-950 text-rose-400 font-black text-xs flex items-center justify-center border border-rose-800">
                          5
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">Bastante Plaga, Hongo o Falso Carbón</div>
                          <div className="text-[10px] text-slate-400">Desaprobación inmediata si Plagas, Hongo o Falso Carbón es nivel B (Bastante)</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={reglasVeto.bloquearBastantePlaga !== false}
                        onChange={(e) => {
                          setLocalConfig(prev => ({
                            ...prev,
                            reglasVeto: {
                              ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                              bloquearBastantePlaga: e.target.checked
                            }
                          }));
                        }}
                        className="w-4 h-4 text-rose-500 rounded bg-slate-800 border-slate-700 focus:ring-rose-400"
                      />
                    </div>
                  </div>

                  {/* Regla 6: Humedades <= 10% (> 20% del total de muestras) */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-rose-950 text-rose-400 font-black text-xs flex items-center justify-center border border-rose-800">
                          6
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">Humedades Críticas ≤ 10% (&gt;20% de muestras)</div>
                          <div className="text-[10px] text-slate-400">Rechazo mandatorio si caladas ≤ 10% superan la tolerancia permitida</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={reglasVeto.bloquearHumedadesBajas10 !== false}
                        onChange={(e) => {
                          setLocalConfig(prev => ({
                            ...prev,
                            reglasVeto: {
                              ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                              bloquearHumedadesBajas10: e.target.checked
                            }
                          }));
                        }}
                        className="w-4 h-4 text-rose-500 rounded bg-slate-800 border-slate-700 focus:ring-rose-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Umbral Crítico (≤)</span>
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-rose-700/60">
                          <input
                            type="number"
                            step="0.5"
                            min="5"
                            max="15"
                            value={reglasVeto.umbralHumedadBajaCritica ?? 10.0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 10.0;
                              setLocalConfig(prev => ({
                                ...prev,
                                reglasVeto: {
                                  ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                  umbralHumedadBajaCritica: val
                                }
                              }));
                            }}
                            className="w-12 bg-transparent text-rose-300 font-black text-xs text-right focus:outline-none"
                          />
                          <span className="text-rose-400 font-bold text-xs">%</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Máx. Muestras Toleradas (&gt;)</span>
                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded border border-rose-700/60">
                          <input
                            type="number"
                            step="1"
                            min="5"
                            max="50"
                            value={reglasVeto.maxPctMuestrasHumedadBaja ?? 20.0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 20.0;
                              setLocalConfig(prev => ({
                                ...prev,
                                reglasVeto: {
                                  ...(prev.reglasVeto || REGLAS_VETO_DEFAULT),
                                  maxPctMuestrasHumedadBaja: val
                                }
                              }));
                            }}
                            className="w-12 bg-transparent text-rose-300 font-black text-xs text-right focus:outline-none"
                          />
                          <span className="text-rose-400 font-bold text-xs">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Information Box */}
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Garantía de Calidad ANVAP:</strong> Estas 6 reglas actúan como interruptores de seguridad industrial. Cuando un lote excede cualquiera de estos límites (humedades ≤10% &gt;20%, bastante olor, escala de grano verde, etc.), el dictamen se fija en <strong>RECHAZADO</strong> y se emite la alerta con la causa exacta del veto sin perder la puntuación calculada.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: ALERTAS VISUALES DASHBOARD */}
          {activeTab === "alertas" && (
            <div className="space-y-6 max-w-4xl mx-auto py-2">
              {/* Main Configuration Card */}
              <div className="bg-slate-850 p-5 rounded-2xl border border-amber-600/40 space-y-5">
                
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-750 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <BellRing className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Umbrales Críticos de % y Alertas Visuales en Dashboard
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                          alertasConfig.activarAlertasDashboard
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          {alertasConfig.activarAlertasDashboard ? "ALERTAS ACTIVAS" : "ALERTAS PAUSADAS"}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Defina los límites porcentuales (%) para disparar avisos visuales automáticos y tarjetas destacadas de control en el Dashboard.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetAlertasReglas}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Restablecer reglas y umbrales estándar de fábrica"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Valores Estándar</span>
                    </button>
                    <button
                      onClick={() => setIsAddingCustomAlert(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nueva Alerta</span>
                    </button>
                  </div>
                </div>

                {/* Master Switches Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Master Switch */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-750 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Activar Alertas en Dashboard</div>
                      <div className="text-[11px] text-slate-400">Mostrar panel y badges en pantalla</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertasConfig.activarAlertasDashboard}
                        onChange={(e) => handleUpdateAlertasConfig({ activarAlertasDashboard: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Active Lots Filter */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-750 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Solo Lotes Activos en Planta</div>
                      <div className="text-[11px] text-slate-400">Ignorar lotes cerrados/terminados</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertasConfig.soloLotesActivos}
                        onChange={(e) => handleUpdateAlertasConfig({ soloLotesActivos: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Strict Mode: Only Critical */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-750 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Filtrar: Solo Nivel Crítico</div>
                      <div className="text-[11px] text-slate-400">Ocultar avisos de advertencia</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertasConfig.mostrarSoloCriticos || false}
                        onChange={(e) => handleUpdateAlertasConfig({ mostrarSoloCriticos: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                    </label>
                  </div>
                </div>

                {/* Real-Time Impact Summary in Current Plant Data */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white">Impacto en Tiempo Real: </span>
                      <span className="text-xs text-slate-300">
                        Con los umbrales configurados, se detectan{" "}
                        <strong className="text-rose-400">{totalCriticosPlanta} alertas críticas</strong> y{" "}
                        <strong className="text-amber-300">{totalAdvertenciasPlanta} advertencias</strong> en{" "}
                        <strong className="text-white">{lotesAfectadosSet.size} lotes</strong> registrados.
                      </span>
                    </div>
                  </div>

                  {lotesAfectadosSet.size > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400">Lotes con aviso:</span>
                      {Array.from(lotesAfectadosSet).slice(0, 5).map((loteId) => (
                        <span key={loteId} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono font-bold">
                          {loteId}
                        </span>
                      ))}
                      {lotesAfectadosSet.size > 5 && (
                        <span className="text-slate-400">+{lotesAfectadosSet.size - 5} más</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal / Dialog for New Custom Alert */}
                {isAddingCustomAlert && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" />
                        Agregar Nueva Regla de Alerta Personalizada
                      </span>
                      <button
                        onClick={() => setIsAddingCustomAlert(false)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">Parámetro Base</label>
                        <select
                          value={newAlertParam}
                          onChange={(e) => {
                            const val = e.target.value as ParametroAlertaCalidad;
                            setNewAlertParam(val);
                            if (!newAlertName) {
                              setNewAlertName(`Alerta de ${val}`);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="SCORE_TOTAL">Puntaje Global de Evaluación (%)</option>
                          <option value="HUMEDAD">Humedad de Recepción (%)</option>
                          <option value="DESV_HUMEDAD">Desviación / Heterogeneidad (%)</option>
                          <option value="GRANO_VERDE">Grano Verde - GV (%)</option>
                          <option value="GRANO_INMADURO">Grano Inmaduro - GI (%)</option>
                          <option value="RENDIMIENTO_INTEGRAL">Rendimiento Integral - RI (%)</option>
                          <option value="QUEBRADO_TOTAL">Quebrado Total - QB (%)</option>
                          <option value="MUESTRAS_HUMEDAD_BAJA">Muestras con Humedad ≤ 10% (%)</option>
                          <option value="DANADO_CALOR">Dañado por Calor / Mancha (M) (%)</option>
                          <option value="YESADO">Grano Yesado - GY (%)</option>
                          <option value="GRANOS_ROJOS">Granos Rojos - GR (%)</option>
                          <option value="PLAGAS">Afectación por Plagas (%)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nombre Visual</label>
                        <input
                          type="text"
                          value={newAlertName}
                          onChange={(e) => setNewAlertName(e.target.value)}
                          placeholder="Ej: Límite Especial de Grano Verde"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">Condición de Disparo</label>
                        <select
                          value={newAlertOp}
                          onChange={(e) => setNewAlertOp(e.target.value as OperadorAlerta)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="MAYOR_A">Mayor que (&gt;) el umbral</option>
                          <option value="MENOR_A">Menor que (&lt;) el umbral</option>
                          <option value="FUERA_RANGO">Fuera del rango seguro [Min - Max]</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-rose-400 block mb-1">Umbral Crítico (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newAlertCrit}
                          onChange={(e) => setNewAlertCrit(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-rose-500/50 rounded-lg p-2 text-xs font-mono font-bold text-rose-300"
                        />
                      </div>

                      {newAlertOp === "FUERA_RANGO" && (
                        <div>
                          <label className="text-[11px] font-semibold text-rose-400 block mb-1">Máx. Crítico (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={newAlertMaxCrit}
                            onChange={(e) => setNewAlertMaxCrit(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-rose-500/50 rounded-lg p-2 text-xs font-mono font-bold text-rose-300"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-semibold text-amber-300 block mb-1">Umbral Advertencia (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newAlertAdv}
                          onChange={(e) => setNewAlertAdv(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-amber-500/50 rounded-lg p-2 text-xs font-mono font-bold text-amber-300"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">Severidad por Defecto</label>
                        <select
                          value={newAlertSev}
                          onChange={(e) => setNewAlertSev(e.target.value as SeveridadAlerta)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        >
                          <option value="CRITICO">CRÍTICO (Rojo)</option>
                          <option value="ADVERTENCIA">ADVERTENCIA (Ámbar)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => setIsAddingCustomAlert(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateCustomAlert}
                        disabled={!newAlertName.trim()}
                        className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black disabled:opacity-50"
                      >
                        Guardar Regla de Alerta
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={alertSearchTerm}
                      onChange={(e) => setAlertSearchTerm(e.target.value)}
                      placeholder="Buscar por parámetro o nombre..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-750 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    {(["TODAS", "CRITICO", "ADVERTENCIA"] as const).map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setFilterSeverity(sev)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          filterSeverity === sev
                            ? "bg-amber-500 text-slate-950 font-bold"
                            : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                      >
                        {sev === "TODAS" ? "Todos los Umbrales" : sev === "CRITICO" ? "Críticos" : "Advertencias"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alert Rules List */}
                <div className="space-y-3 pt-1">
                  {alertasConfig.reglas
                    .filter((r) => {
                      const matchesSearch =
                        r.nombre.toLowerCase().includes(alertSearchTerm.toLowerCase()) ||
                        r.parametro.toLowerCase().includes(alertSearchTerm.toLowerCase()) ||
                        r.descripcion.toLowerCase().includes(alertSearchTerm.toLowerCase());
                      const matchesSev =
                        filterSeverity === "TODAS" || r.severidadPorDefecto === filterSeverity;
                      return matchesSearch && matchesSev;
                    })
                    .map((regla) => {
                      const breachedLots = alertasDetectadasEnPlanta.filter((a) => a.reglaId === regla.id);
                      const isBreached = breachedLots.length > 0;

                      return (
                        <div
                          key={regla.id}
                          className={`p-4 rounded-xl border transition-all ${
                            !regla.activo
                              ? "bg-slate-900/40 border-slate-800 opacity-60"
                              : isBreached
                              ? "bg-slate-900 border-amber-500/50 shadow-md shadow-amber-950/20"
                              : "bg-slate-900 border-slate-750 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            
                            {/* Left: Info & Status */}
                            <div className="flex items-start gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={regla.activo}
                                onChange={(e) => handleUpdateReglaAlerta(regla.id, { activo: e.target.checked })}
                                className="mt-1 w-4 h-4 text-amber-500 rounded bg-slate-800 border-slate-700 focus:ring-amber-400 cursor-pointer"
                              />

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-xs">{regla.nombre}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                    {regla.parametro}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border ${
                                    regla.severidadPorDefecto === "CRITICO"
                                      ? "bg-rose-950/80 text-rose-300 border-rose-800"
                                      : "bg-amber-950/80 text-amber-300 border-amber-800"
                                  }`}>
                                    {regla.severidadPorDefecto}
                                  </span>

                                  {isBreached && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                      Disparada en {breachedLots.length} {breachedLots.length === 1 ? "lote" : "lotes"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  {regla.descripcion}
                                </p>
                              </div>
                            </div>

                            {/* Right: Threshold Config Inputs */}
                            <div className="flex flex-wrap items-center gap-3 bg-slate-850 p-2.5 rounded-xl border border-slate-750">
                              
                              {/* Operador */}
                              <div>
                                <span className="text-[10px] text-slate-400 block mb-0.5">Operador</span>
                                <select
                                  value={regla.operador}
                                  onChange={(e) => handleUpdateReglaAlerta(regla.id, { operador: e.target.value as OperadorAlerta })}
                                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                                >
                                  <option value="MAYOR_A">&gt; Mayor a</option>
                                  <option value="MENOR_A">&lt; Menor a</option>
                                  <option value="FUERA_RANGO">Fuera de Rango</option>
                                </select>
                              </div>

                              {/* Umbral Crítico */}
                              <div>
                                <span className="text-[10px] text-rose-400 font-bold block mb-0.5">
                                  {regla.operador === "FUERA_RANGO" ? "Min Crítico" : "Umbral Crítico"}
                                </span>
                                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-rose-600/50">
                                  <button
                                    onClick={() => handleUpdateReglaAlerta(regla.id, { umbralCritico: Number((regla.umbralCritico - 0.5).toFixed(2)) })}
                                    className="text-slate-400 hover:text-white font-bold px-1"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={regla.umbralCritico}
                                    onChange={(e) => handleUpdateReglaAlerta(regla.id, { umbralCritico: parseFloat(e.target.value) || 0 })}
                                    className="w-14 bg-transparent text-rose-300 font-mono font-black text-xs text-center focus:outline-none"
                                  />
                                  <span className="text-[10px] text-rose-400 font-bold">%</span>
                                  <button
                                    onClick={() => handleUpdateReglaAlerta(regla.id, { umbralCritico: Number((regla.umbralCritico + 0.5).toFixed(2)) })}
                                    className="text-slate-400 hover:text-white font-bold px-1"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Max Crítico if FUERA_RANGO */}
                              {regla.operador === "FUERA_RANGO" && (
                                <div>
                                  <span className="text-[10px] text-rose-400 font-bold block mb-0.5">Max Crítico</span>
                                  <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-rose-600/50">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={regla.umbralMax ?? 16.0}
                                      onChange={(e) => handleUpdateReglaAlerta(regla.id, { umbralMax: parseFloat(e.target.value) || 16.0 })}
                                      className="w-14 bg-transparent text-rose-300 font-mono font-black text-xs text-center focus:outline-none"
                                    />
                                    <span className="text-[10px] text-rose-400 font-bold">%</span>
                                  </div>
                                </div>
                              )}

                              {/* Umbral Advertencia */}
                              <div>
                                <span className="text-[10px] text-amber-300 font-bold block mb-0.5">
                                  {regla.operador === "FUERA_RANGO" ? "Min Adv." : "Umbral Advertencia"}
                                </span>
                                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-amber-600/50">
                                  <button
                                    onClick={() => handleUpdateReglaAlerta(regla.id, { umbralAdvertencia: Number(((regla.umbralAdvertencia ?? regla.umbralCritico) - 0.5).toFixed(2)) })}
                                    className="text-slate-400 hover:text-white font-bold px-1"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={regla.umbralAdvertencia ?? regla.umbralCritico}
                                    onChange={(e) => handleUpdateReglaAlerta(regla.id, { umbralAdvertencia: parseFloat(e.target.value) || 0 })}
                                    className="w-14 bg-transparent text-amber-300 font-mono font-black text-xs text-center focus:outline-none"
                                  />
                                  <span className="text-[10px] text-amber-400 font-bold">%</span>
                                  <button
                                    onClick={() => handleUpdateReglaAlerta(regla.id, { umbralAdvertencia: Number(((regla.umbralAdvertencia ?? regla.umbralCritico) + 0.5).toFixed(2)) })}
                                    className="text-slate-400 hover:text-white font-bold px-1"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Max Advertencia if FUERA_RANGO */}
                              {regla.operador === "FUERA_RANGO" && (
                                <div>
                                  <span className="text-[10px] text-amber-300 font-bold block mb-0.5">Max Adv.</span>
                                  <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-amber-600/50">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={regla.umbralMaxAdvertencia ?? (regla.umbralMax ? regla.umbralMax - 1.0 : 15.0)}
                                      onChange={(e) => handleUpdateReglaAlerta(regla.id, { umbralMaxAdvertencia: parseFloat(e.target.value) || 15.0 })}
                                      className="w-14 bg-transparent text-amber-300 font-mono font-black text-xs text-center focus:outline-none"
                                    />
                                    <span className="text-[10px] text-amber-400 font-bold">%</span>
                                  </div>
                                </div>
                              )}

                              {/* Severidad */}
                              <div>
                                <span className="text-[10px] text-slate-400 block mb-0.5">Nivel Visual</span>
                                <select
                                  value={regla.severidadPorDefecto}
                                  onChange={(e) => handleUpdateReglaAlerta(regla.id, { severidadPorDefecto: e.target.value as SeveridadAlerta })}
                                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                >
                                  <option value="CRITICO">Crítico (Rojo)</option>
                                  <option value="ADVERTENCIA">Advertencia (Ámbar)</option>
                                </select>
                              </div>

                              {/* Delete if custom */}
                              {regla.id.startsWith("custom-") && (
                                <button
                                  onClick={() => handleDeleteAlertRule(regla.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Eliminar regla personalizada"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Bottom Informational Note */}
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-700/30 text-xs text-amber-200/90 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-300">
                      Sincronización en Vivo con el Dashboard de Planta:
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      Al guardar estos umbrales, el Dashboard principal del sistema evaluará de forma inmediata las caladas de humedad tomadas en tolva y los análisis húmedos recepcionados. Si un lote supera un umbral crítico de % de grano verde, baja humedad o rendimiento insuficiente, se desplegarán las tarjetas de alerta visuales correspondientes con acceso directo a la inspección y reporte del lote.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: SIMULADOR EN TIEMPO REAL */}
          {activeTab === "simulador" && (
            <div className="space-y-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Simular Evaluación con Lote Real</div>
                    <div className="text-[11px] text-slate-400">Verifique cómo responde esta configuración con los datos de planta actuales.</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-300">Seleccionar Lote:</span>
                  <select
                    value={simulatorLoteId}
                    onChange={(e) => setSimulatorLoteId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  >
                    {lotes.map((l) => (
                      <option key={l.LOTE_ID} value={l.LOTE_ID}>
                        {l.LOTE_ID} - {l.VARIEDAD} ({l.CLIENTE})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Simulation Result Box */}
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                  <div>
                    <span className="text-xs text-slate-400">Resultado Proyectado para Lote:</span>
                    <h4 className="text-base font-black text-white font-mono">{simLote?.LOTE_ID || "---"} ({simLote?.VARIEDAD})</h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold">PUNTAJE OBTENIDO</div>
                      <div className="text-xl font-black text-amber-400">
                        {simResult.puntajeTotal} <span className="text-xs text-slate-400 font-normal">/ {simResult.maxPuntaje} pts</span>
                      </div>
                    </div>

                    <div className={`px-4 py-2 rounded-xl border text-sm font-black flex items-center gap-1.5 ${simResult.colorEstado}`}>
                      {simResult.tieneVetoCritico && <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />}
                      {simResult.porcentajeAprobacion}% {simResult.estadoAprobacion}
                      {simResult.tieneVetoCritico && <span className="text-[10px] bg-rose-900/80 text-rose-200 px-1 rounded ml-1">VETO</span>}
                    </div>
                  </div>
                </div>

                {/* Veto Warning Banner if applicable */}
                {simResult.tieneVetoCritico && (
                  <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-600 text-rose-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>DESAPROBACIÓN AUTOMÁTICA POR VETO CRÍTICO MANDATORIO:</span>
                    </div>
                    <ul className="space-y-1 text-xs">
                      {simResult.motivosVeto.map((v, i) => (
                        <li key={i} className="flex items-start gap-2 bg-rose-900/40 p-2 rounded-lg border border-rose-800/50">
                          <span className="text-rose-400 font-black">•</span>
                          <div>
                            <span className="font-bold text-rose-200">{v.parametro}: </span>
                            <span>{v.descripcion} </span>
                            <span className="text-[11px] text-rose-300 font-mono">({v.valorDetectado} vs {v.limitePermitido})</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Items Evaluados Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {simResult.items.map((item, idx) => (
                    <div 
                      key={item.id || idx}
                      className={`p-2 rounded-lg border text-center text-xs ${
                        item.cumple 
                          ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200" 
                          : "bg-rose-950/40 border-rose-800/60 text-rose-200"
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-400 truncate">{item.abreviatura}</div>
                      <div className="font-bold my-0.5">{item.valorActual}</div>
                      <div className="text-[9px] text-slate-400 leading-tight">{item.condicion}</div>
                      <div className="mt-1 pt-1 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
                        <span>{item.cumple ? "✓ Cumple" : "✗ Falla"}</span>
                        <span className="font-black">+{item.puntos}p</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-850 border-t border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {savedSuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                ¡Configuración maestra guardada con éxito!
              </span>
            ) : (
              <span>Los cambios aplicarán a todas las fichas de recepción, análisis húmedos y dictámenes de lotes.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              id="btn-guardar-config-evaluacion"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Guardando Configuración..." : "Guardar y Aplicar Criterios"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
