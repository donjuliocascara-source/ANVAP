import React from "react";
import { 
  Package, 
  CheckCircle2, 
  Sparkles, 
  Gauge, 
  Layers, 
  Microscope, 
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Flame
} from "lucide-react";

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  countLabel?: string;
  badge?: string;
  badgeColor?: string;
}

interface WorkflowProcessBarProps {
  activeTab: string;
  onNavigate: (tab: string, filterId?: string) => void;
  lotesTotal?: number;
  lotesAptos?: number;
  lotesObservados?: number;
  batchesProgramados?: number;
  batchesEnProceso?: number;
  batchesTotal?: number;
  analisisTotal?: number;
  emergenciasCount?: number;
}

export const WorkflowProcessBar: React.FC<WorkflowProcessBarProps> = ({
  activeTab,
  onNavigate,
  lotesTotal = 0,
  lotesAptos = 0,
  lotesObservados = 0,
  batchesProgramados = 0,
  batchesEnProceso = 0,
  batchesTotal = 0,
  analisisTotal = 0,
  emergenciasCount = 0
}) => {
  const steps: WorkflowStep[] = [
    {
      id: "lotes",
      stepNumber: 1,
      title: "Ingreso Lotes",
      subtitle: "Recepción & 14 Caladas",
      icon: Package,
      count: lotesTotal,
      countLabel: "lotes"
    },
    {
      id: "priorizacion-programacion",
      stepNumber: 2,
      title: "Programación",
      subtitle: "Crear Batch V200+",
      icon: Sparkles,
      count: batchesProgramados,
      countLabel: "prog.",
      badge: emergenciasCount > 0 ? `🚨 ${emergenciasCount} Emerg.` : "V200+",
      badgeColor: emergenciasCount > 0 ? "bg-rose-600 text-white animate-pulse" : "bg-amber-500/20 text-amber-300 border-amber-500/40"
    },
    {
      id: "control-vaporizado",
      stepNumber: 3,
      title: "Proceso Vaporizado",
      subtitle: "Autoclave & Secado",
      icon: Gauge,
      count: batchesEnProceso,
      countLabel: "en proc.",
      badge: batchesEnProceso > 0 ? "Activo" : undefined,
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40"
    },
    {
      id: "batches",
      stepNumber: 4,
      title: "Batches Guardados",
      subtitle: "Historial & Trazabilidad",
      icon: Layers,
      count: batchesTotal,
      countLabel: "batches"
    },
    {
      id: "analisis-vaporizado",
      stepNumber: 5,
      title: "Análisis Calidad",
      subtitle: "Laboratorio Post-Secado",
      icon: Microscope,
      count: analisisTotal,
      countLabel: "análisis"
    }
  ];

  // Map alias tabs to active step
  const getActiveStepIndex = (): number => {
    if (activeTab === "lotes" || activeTab === "humedad" || activeTab === "analisis-humedo") return 0;
    if (
      activeTab === "priorizacion-programacion" || 
      activeTab === "priorizacion" || 
      activeTab === "programacion-apit" || 
      activeTab === "programacion" ||
      activeTab === "creacion-batch" ||
      activeTab === "crear-batch" ||
      activeTab === "programacion-batch" ||
      activeTab === "programacion-oficial"
    ) return 1;
    if (activeTab === "control-vaporizado" || activeTab === "presecado-seco") return 2;
    if (activeTab === "batches") return 3;
    if (activeTab === "analisis-vaporizado") return 4;
    return -1;
  };

  const currentStepIdx = getActiveStepIndex();

  return (
    <div className="bg-slate-900/90 border-y border-slate-800 py-2.5 px-3 sm:px-6 shadow-md backdrop-blur">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = currentStepIdx === idx;
            const isPassed = currentStepIdx > idx;

            return (
              <React.Fragment key={step.id}>
                <button
                  id={`workflow-step-${step.stepNumber}`}
                  onClick={() => onNavigate(step.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 shrink-0 cursor-pointer ${
                    isCurrent
                      ? "bg-amber-500/15 border border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/40"
                      : isPassed
                      ? "bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-slate-600"
                      : "bg-slate-900/40 border border-slate-800/80 hover:bg-slate-800/40 text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                    isCurrent
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : isPassed
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}>
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span>{step.stepNumber}</span>
                    )}
                  </div>

                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold whitespace-nowrap ${
                        isCurrent ? "text-amber-400 font-extrabold" : isPassed ? "text-slate-200" : "text-slate-400"
                      }`}>
                        {step.title}
                      </span>
                      {step.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${step.badgeColor || "bg-slate-700 text-slate-300 border-slate-600"}`}>
                          {step.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="truncate max-w-[120px]">{step.subtitle}</span>
                      {step.count !== undefined && step.count > 0 && (
                        <span className={`text-[10px] font-mono font-semibold ${isCurrent ? "text-amber-300" : "text-slate-300"}`}>
                          • {step.count} {step.countLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {idx < steps.length - 1 && (
                  <ChevronRight className={`w-4 h-4 shrink-0 mx-0.5 ${
                    currentStepIdx > idx ? "text-emerald-500/60" : "text-slate-700"
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
