import React, { useState, useRef, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  Gauge, 
  Microscope, 
  Sparkles, 
  Flame, 
  Award, 
  ChevronDown, 
  MoreHorizontal, 
  FileSpreadsheet, 
  Camera 
} from "lucide-react";
import { UserRole } from "../types";
import { puedeAccederModulo } from "../utils/permisosService";

export type TabType = 
  | "dashboard"
  | "priorizacion-programacion"
  | "priorizacion"
  | "lotes"
  | "batches"
  | "control-vaporizado"
  | "analisis-descarga"
  | "resultados-coccion"
  | "analisis-vaporizado"
  | "evaluacion-batch"
  | "comparador"
  | "simulador"
  | "sabana-batches";

interface NavigationProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
  onSelectTab?: (tab: TabType) => void;
  lotesCount?: number;
  batchesCount?: number;
  pendientesDescargaCount?: number;
  pendientesCoccionCount?: number;
  loteCount?: number;
  batchCount?: number;
  alertCount?: number;
  emergenciasCount?: number;
  lotesAptosCount?: number;
  currentUserRole?: UserRole;
  onOpenOCR?: () => void;
  onOpenExcelSync?: () => void;
  onOpenConfig?: () => void;
}

interface NavItem {
  id: TabType;
  step?: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: {
    text: string;
    type: "neutral" | "warning" | "alert" | "success";
  } | null;
  aliases?: string[];
  group: "inicio" | "etapas" | "auditoria";
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onSelectTab,
  lotesCount = 0,
  batchesCount = 0,
  pendientesDescargaCount = 0,
  pendientesCoccionCount = 0,
  loteCount,
  batchCount,
  emergenciasCount = 0,
  currentUserRole = "PROGRAMADOR",
  onOpenOCR,
  onOpenExcelSync,
  onOpenConfig
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const totalLotes = lotesCount || loteCount || 0;
  const totalBatches = batchesCount || batchCount || 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setIsMoreMenuOpen(false);
    if (onTabChange) onTabChange(id);
    if (onSelectTab) onSelectTab(id as TabType);
  };

  // Definición estructurada de la barra de navegación en 3 grupos claros
  const navItems: NavItem[] = [
    // 1. Centro de Mando
    { 
      id: "dashboard" as TabType, 
      label: "Dashboard", 
      shortLabel: "Inicio",
      description: "Resumen gerencial de tolvas, silos, lotes y KPIs de planta",
      icon: LayoutDashboard, 
      badge: null,
      group: "inicio"
    },

    // 2. Flujo Operativo Secuencial de Planta (Pasos 1 al 6)
    { 
      id: "lotes" as TabType, 
      step: "1",
      label: "Lotes MP", 
      shortLabel: "Lotes",
      description: "Recepción de materia prima, tolvas, silos y humedad",
      icon: Package, 
      badge: totalLotes > 0 ? { text: `${totalLotes}`, type: "neutral" } : null,
      group: "etapas"
    },
    { 
      id: "priorizacion-programacion" as TabType, 
      step: "2",
      label: "Programación", 
      shortLabel: "Programar",
      description: "Algoritmo APIT, priorización de lotes y formulación de batch",
      icon: Sparkles, 
      badge: emergenciasCount > 0 ? { text: `🚨 ${emergenciasCount}`, type: "alert" } : null,
      aliases: ["creacion-batch", "crear-batch", "programacion-batch", "programacion-oficial", "priorizacion", "programacion-apit", "programacion"],
      group: "etapas"
    },
    { 
      id: "control-vaporizado" as TabType, 
      step: "3",
      label: "Control Vaporizado", 
      shortLabel: "Vaporizado",
      description: "Monitoreo en vivo de autoclave, presión, tiempos y secadoras",
      icon: Gauge, 
      badge: null,
      group: "etapas"
    },
    { 
      id: "batches" as TabType, 
      step: "4",
      label: "Batches", 
      shortLabel: "Batches",
      description: "Historial de cargas producidas, correlativos y trazabilidad",
      icon: Layers, 
      badge: totalBatches > 0 ? { text: `${totalBatches}`, type: "neutral" } : null,
      group: "etapas"
    },
    { 
      id: "analisis-descarga" as TabType, 
      step: "5",
      label: "Análisis Descarga", 
      shortLabel: "Descarga",
      description: "Muestras físicas de laboratorio post-secado (Boleta Don Julio)",
      icon: Microscope, 
      badge: pendientesDescargaCount > 0 
        ? { text: `${pendientesDescargaCount} pend.`, type: "alert" } 
        : { text: "Al día", type: "success" },
      aliases: ["descarga", "analisis-descarga-pendientes"],
      group: "etapas"
    },
    { 
      id: "resultados-coccion" as TabType, 
      step: "6",
      label: "Resultados & Cocción", 
      shortLabel: "Cocción",
      description: "Incrementos de defectos (Quebrado, Tiza, Trizado) y evaluación culinaria en olla",
      icon: Flame, 
      badge: pendientesCoccionCount > 0 
        ? { text: `${pendientesCoccionCount} pend.`, type: "warning" } 
        : { text: "Al día", type: "success" },
      aliases: ["coccion", "carga-coccion", "cocciones-pendientes", "evaluacion-coccion", "resultados-defectos", "resultados"],
      group: "etapas"
    },

    // 3. Auditoría & Rendimiento
    { 
      id: "evaluacion-batch" as TabType, 
      label: "Evaluación & Sábana", 
      shortLabel: "Auditoría",
      description: "Sábana de batches 313-336, replicador de recetas, comparador y ranking",
      icon: Award, 
      badge: null,
      aliases: ["comparador", "comparador-procesos", "evaluacion-procesos", "sabana-batches", "replicador-recetas", "analisis-data", "analisis-batches"],
      group: "auditoria"
    },
  ];

  // Herramientas Avanzadas en Menú Desplegable
  const secondaryTools = [
    {
      id: "evaluacion-batch" as TabType,
      label: "Sábana de Batches & Replicador",
      description: "Consulta de lotes exitosos por variedad, presión, exclusa y reposo",
      icon: FileSpreadsheet
    },
    {
      id: "analisis-vaporizado" as TabType,
      label: "Laboratorio Completo (14 Caladas)",
      description: "Registro de boleta física oficial y evaluación técnica de grano",
      icon: Microscope
    },
    {
      id: "simulador" as TabType,
      label: "Simulador de Parámetros IA",
      description: "Proyección de quebrado y rendimiento antes de ingresar a autoclave",
      icon: Sparkles
    }
  ];

  const isSecondaryActive = secondaryTools.some(t => t.id === activeTab);

  return (
    <nav aria-label="Menú principal de planta ANVAP" className="bg-slate-900 border-b border-slate-800 shadow-lg sticky top-14 z-30">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between py-1.5 gap-2">
          
          {/* LADO IZQUIERDO / PRINCIPAL: DASHBOARD + VISTAS DEL 1 AL 6 + AUDITORÍA */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
            
            {/* Dashboard / Inicio */}
            {(() => {
              const dashItem = navItems[0];
              const Icon = dashItem.icon;
              const isActive = activeTab === dashItem.id;
              const isPermitted = puedeAccederModulo((currentUserRole || "OPERARIO") as UserRole, dashItem.id);

              return (
                <button
                  key={dashItem.id}
                  id={`nav-tab-${dashItem.id}`}
                  onClick={() => handleSelect(dashItem.id)}
                  title={dashItem.description}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer border shrink-0 ${
                    isActive
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-1 ring-amber-400 font-black"
                      : isPermitted
                      ? "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-750/80"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border-transparent opacity-60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-slate-950" : "text-amber-400"}`} />
                  <span className="hidden sm:inline">{dashItem.label}</span>
                  <span className="sm:hidden">{dashItem.shortLabel || dashItem.label}</span>
                </button>
              );
            })()}

            {/* Separador sutil */}
            <div className="h-5 w-[1px] bg-slate-800 shrink-0 mx-0.5" />

            {/* VISTAS DEL 1 AL 6 COMO BOTONES EN LA PARTE SUPERIOR */}
            {navItems.slice(1, 7).map((step) => {
              const StepIcon = step.icon;
              const isCurrent = activeTab === step.id || (step.aliases && step.aliases.includes(activeTab));
              const isPermitted = puedeAccederModulo((currentUserRole || "OPERARIO") as UserRole, step.id);

              return (
                <button
                  key={step.id}
                  id={`nav-tab-${step.id}`}
                  onClick={() => handleSelect(step.id)}
                  title={`${step.step}. ${step.label}: ${step.description}`}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer border shrink-0 ${
                    isCurrent
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-1 ring-amber-400 font-black"
                      : isPermitted
                      ? "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-750/80"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border-transparent opacity-60"
                  }`}
                >
                  <span className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isCurrent 
                      ? "bg-slate-950 text-amber-400" 
                      : "bg-slate-750 text-amber-400 border border-slate-700"
                  }`}>
                    {step.step}
                  </span>
                  <StepIcon className={`w-3.5 h-3.5 ${isCurrent ? "text-slate-950" : "text-amber-400"}`} />
                  
                  {/* Label adaptable: Completo en pantallas grandes, corto en pantallas medianas */}
                  <span className="hidden xl:inline">{step.label}</span>
                  <span className="xl:hidden">{step.shortLabel || step.label}</span>

                  {/* Badges de alertas o conteos */}
                  {step.badge && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black shrink-0 ml-0.5 ${
                      isCurrent
                        ? "bg-slate-950 text-amber-300"
                        : step.badge.type === "alert"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : step.badge.type === "warning"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : step.badge.type === "success"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      {step.badge.text}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Separador sutil */}
            <div className="h-5 w-[1px] bg-slate-800 shrink-0 mx-0.5 hidden xl:block" />

            {/* Botón Auditoría / Sábana */}
            {(() => {
              const evalItem = navItems[7];
              const EvalIcon = evalItem.icon;
              const isEvalActive = activeTab === evalItem.id || (evalItem.aliases && evalItem.aliases.includes(activeTab));
              const isPermitted = puedeAccederModulo((currentUserRole || "OPERARIO") as UserRole, evalItem.id);

              return (
                <button
                  key={evalItem.id}
                  id={`nav-tab-${evalItem.id}`}
                  onClick={() => handleSelect(evalItem.id)}
                  title={evalItem.description}
                  className={`hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer border shrink-0 ${
                    isEvalActive
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-1 ring-amber-400 font-black"
                      : isPermitted
                      ? "bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-750/80"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border-transparent opacity-60"
                  }`}
                >
                  <EvalIcon className={`w-3.5 h-3.5 ${isEvalActive ? "text-slate-950" : "text-purple-400"}`} />
                  <span className="hidden xl:inline">{evalItem.label}</span>
                  <span className="xl:hidden">{evalItem.shortLabel || evalItem.label}</span>
                </button>
              );
            })()}

          </div>

          {/* LADO DERECHO: HERRAMIENTAS ADICIONALES (LAB / SIMULADOR) */}
          <div className="flex items-center gap-1 shrink-0">
            
            {/* Dropdown de Herramientas Avanzadas */}
            <div className="relative" ref={moreMenuRef}>
              <button
                id="nav-more-tools-btn"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                  isSecondaryActive
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-750 hover:text-white"
                }`}
                title="Herramientas adicionales de laboratorio, IA y configuración"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden xl:inline text-[11px]">Herramientas</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Módulos de Apoyo Técnico</span>
                    <span className="text-amber-400 font-mono">IA & Lab</span>
                  </div>

                  <div className="py-1 space-y-1">
                    {secondaryTools.map((tool) => {
                      const ToolIcon = tool.icon;
                      const isToolActive = activeTab === tool.id;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => handleSelect(tool.id)}
                          className={`w-full text-left p-2 rounded-xl text-xs flex items-start gap-2.5 transition-colors cursor-pointer ${
                            isToolActive
                              ? "bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30"
                              : "text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          <ToolIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-100">{tool.label}</div>
                            <div className="text-[10px] text-slate-400">{tool.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Acciones Rápidas Complementarias */}
                  {(onOpenOCR || onOpenExcelSync || onOpenConfig) && (
                    <div className="pt-1.5 mt-1 border-t border-slate-800 space-y-0.5">
                      <div className="px-3 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Acciones Directas
                      </div>
                      {onOpenOCR && (
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            onOpenOCR();
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-2"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Subir Formato / Ticket OCR</span>
                        </button>
                      )}
                      {onOpenExcelSync && (
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            onOpenExcelSync();
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-2"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sincronizar con Excel</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </nav>
  );
};
