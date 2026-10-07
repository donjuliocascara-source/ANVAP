import React, { useState, useRef, useEffect } from "react";
import { UserProfile, UserRole } from "../types";
import { 
  Flame, 
  User, 
  ShieldCheck, 
  FileSpreadsheet, 
  Camera, 
  Sliders, 
  Sparkles, 
  Settings, 
  ChevronDown,
  Scale,
  Users,
  Code2,
  Microscope,
  Gauge,
  UserCheck,
  Lock,
  AlertTriangle,
  Briefcase,
  CheckSquare,
  Share2,
  Cloud,
  LogOut,
  RotateCcw
} from "lucide-react";
import { obtenerBadgeRol, USUARIOS_DEL_SISTEMA } from "../utils/usuariosService";
import { tienePermiso, obtenerMensajeRestriccion } from "../utils/permisosService";
import { PinPromptModal } from "./PinPromptModal";
import { CompartirAccesoModal } from "./CompartirAccesoModal";

interface HeaderProps {
  currentUser: UserProfile;
  users?: UserProfile[];
  onSelectUser?: (user: UserProfile) => void;
  onRoleChange?: (role: UserRole) => void;
  onOpenOCR: () => void;
  onOpenExcelSync: () => void;
  onOpenCloudSync?: () => void;
  onOpenConfig?: () => void;
  onOpenConfigEvaluacion?: () => void;
  onOpenSimulator?: () => void;
  onOpenUsuariosModal?: () => void;
  onOpenResetTesting?: () => void;
  onLogout?: () => void;
  alertCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users = [],
  onSelectUser,
  onRoleChange,
  onOpenOCR,
  onOpenExcelSync,
  onOpenCloudSync,
  onOpenConfig,
  onOpenConfigEvaluacion,
  onOpenSimulator,
  onOpenUsuariosModal,
  onOpenResetTesting,
  onLogout,
  alertCount = 0
}) => {
  const [isConfigDropdownOpen, setIsConfigDropdownOpen] = useState(false);
  const [permissionToast, setPermissionToast] = useState<string | null>(null);
  const [pendingSwitchUser, setPendingSwitchUser] = useState<UserProfile | null>(null);
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsConfigDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear permission warning toast after 4 seconds
  useEffect(() => {
    if (permissionToast) {
      const timer = setTimeout(() => setPermissionToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [permissionToast]);

  const effectiveUsers: UserProfile[] = users.length > 0 ? users : USUARIOS_DEL_SISTEMA;
  const currentBadge = obtenerBadgeRol(currentUser.rol);

  // Permisos para las acciones rápidas del Header
  const canSyncExcel = tienePermiso(currentUser.rol, "sincronizar_excel");
  const canUseOCR = tienePermiso(currentUser.rol, "usar_ocr_documentos");
  const canEditPesos = tienePermiso(currentUser.rol, "modificar_pesos_algoritmo");
  const canEditCriterios = tienePermiso(currentUser.rol, "modificar_criterios_evaluacion");

  const handleRestrictedAction = (msg: string) => {
    setPermissionToast(msg);
  };

  const getShortRoleLabel = (rol: UserRole): string => {
    switch (rol) {
      case "PROGRAMADOR":
      case "INGENIERO_PROGRAMADOR":
      case "ADMINISTRADOR":
      case "ADMIN":
        return "Programador";
      case "JEFE_VAPORIZADO":
      case "JEFE_PLANTA":
        return "Jefe Vap.";
      case "SUPERVISOR":
        return "Supervisor";
      case "ANALISTA_CALIDAD":
      case "CONTROL_CALIDAD":
      case "CALIDAD":
        return "Calidad";
      case "OPERARIO":
      case "OPERADOR":
        return "Operario";
      case "GERENCIA":
        return "Gerencia";
      case "AUDITOR":
        return "Auditor";
      default:
        return rol;
    }
  };

  const getRoleIcon = (rol: UserRole) => {
    switch (rol) {
      case "PROGRAMADOR":
      case "INGENIERO_PROGRAMADOR":
      case "ADMINISTRADOR":
      case "ADMIN":
        return <Code2 className="w-3.5 h-3.5 text-purple-300" />;
      case "JEFE_VAPORIZADO":
      case "JEFE_PLANTA":
        return <Flame className="w-3.5 h-3.5 text-amber-300" />;
      case "SUPERVISOR":
        return <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />;
      case "ANALISTA_CALIDAD":
      case "CONTROL_CALIDAD":
      case "CALIDAD":
        return <Microscope className="w-3.5 h-3.5 text-emerald-300" />;
      case "OPERARIO":
      case "OPERADOR":
        return <Gauge className="w-3.5 h-3.5 text-amber-400" />;
      case "GERENCIA":
        return <Briefcase className="w-3.5 h-3.5 text-indigo-300" />;
      case "AUDITOR":
        return <CheckSquare className="w-3.5 h-3.5 text-slate-300" />;
      default:
        return <User className="w-3.5 h-3.5 text-slate-300" />;
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* Dynamic Floating Notification for Restricted Permission feedback */}
      {permissionToast && (
        <div className="bg-rose-950/95 border-b border-rose-700/80 px-4 py-2 text-rose-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-150">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{permissionToast}</span>
          </div>
          <button 
            onClick={() => setPermissionToast(null)}
            className="text-rose-400 hover:text-white text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2.5 sm:gap-4 flex-wrap lg:flex-nowrap">
        {/* Brand & Industrial Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-inner text-white font-black text-base sm:text-lg shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-amber-400 font-extrabold tracking-wider">ANVAP</span>
                <span className="text-slate-300 font-normal text-xs sm:text-sm hidden md:inline">| Planta de Vaporizado y Secado</span>
              </h1>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                v2.0
              </span>
            </div>
            <div className="text-[11px] text-slate-400 hidden xl:flex items-center gap-1.5 whitespace-nowrap">
              <span>Desarrollado por: <strong className="text-purple-300 font-bold">Ing. Fredy Granados Caicedo</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-medium">ItsyCreaciones</span>
            </div>
          </div>
        </div>

        {/* Global Utilities & Role Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick OCR Scanner */}
          <button
            id="btn-quick-ocr"
            onClick={canUseOCR ? onOpenOCR : () => handleRestrictedAction(obtenerMensajeRestriccion("usar_ocr_documentos"))}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm active:scale-95 cursor-pointer shrink-0 ${
              canUseOCR
                ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
            }`}
            title={canUseOCR ? "Subir foto de formatos o tickets con OCR IA" : "Función restringida"}
          >
            <Camera className={`w-3.5 h-3.5 ${canUseOCR ? "text-emerald-400" : "text-slate-500"}`} />
            <span className="hidden md:inline">Subir Foto</span>
            {!canUseOCR && <Lock className="w-2.5 h-2.5 text-slate-500 ml-0.5" />}
          </button>

          {/* Excel / Cloud Sheets Sync */}
          <button
            id="btn-excel-sync"
            onClick={canSyncExcel ? onOpenExcelSync : () => handleRestrictedAction(obtenerMensajeRestriccion("sincronizar_excel"))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm ${
              canSyncExcel
                ? "bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/50 ring-1 ring-emerald-500/30"
                : "bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60"
            }`}
            title={canSyncExcel ? "Importar / Exportar 12 Hojas de Excel (Lotes, Análisis, Programación)" : "Sincronización restringida para este rol"}
          >
            <FileSpreadsheet className={`w-4 h-4 ${canSyncExcel ? "text-emerald-400" : "text-slate-500"}`} />
            <span className="font-bold tracking-wide">Excel</span>
            {!canSyncExcel && <Lock className="w-2.5 h-2.5 text-slate-500 ml-0.5" />}
          </button>

          {/* Consolidated Settings Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              id="btn-settings-dropdown"
              onClick={() => setIsConfigDropdownOpen(!isConfigDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Configuración de Parámetros de Planta"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Ajustes</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isConfigDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-850 rounded-xl border border-slate-700 shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-750 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Configuración de Planta</span>
                  <span className="font-mono text-amber-400">{currentBadge.label}</span>
                </div>

                {onOpenConfigEvaluacion && (
                  <button
                    onClick={() => {
                      setIsConfigDropdownOpen(false);
                      if (canEditCriterios) {
                        onOpenConfigEvaluacion();
                      } else {
                        handleRestrictedAction(obtenerMensajeRestriccion("modificar_criterios_evaluacion"));
                        onOpenConfigEvaluacion();
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-750 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>Criterios de Evaluación</span>
                          {!canEditCriterios && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700">Lectura</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">Umbrales, pesos y dictámenes %</div>
                      </div>
                    </div>
                    {!canEditCriterios && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                  </button>
                )}

                {onOpenConfig && (
                  <button
                    onClick={() => {
                      setIsConfigDropdownOpen(false);
                      if (canEditPesos) {
                        onOpenConfig();
                      } else {
                        handleRestrictedAction(obtenerMensajeRestriccion("modificar_pesos_algoritmo"));
                        onOpenConfig();
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-750 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>Ponderaciones de Éxito</span>
                          {!canEditPesos && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700">Lectura</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">Fórmulas IA quebrado y cocción</div>
                      </div>
                    </div>
                    {!canEditPesos && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                  </button>
                )}

                {onOpenUsuariosModal && (
                  <button
                    onClick={() => {
                      setIsConfigDropdownOpen(false);
                      onOpenUsuariosModal();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-750 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-750/70"
                  >
                    <Users className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>Gestión y Matriz de Roles</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono">{users.length}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Ver permisos y restricciones</div>
                    </div>
                  </button>
                )}

                {onOpenResetTesting && (
                  <button
                    id="btn-header-reset-testing"
                    onClick={() => {
                      setIsConfigDropdownOpen(false);
                      onOpenResetTesting();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-750/70"
                  >
                    <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>Limpiar Datos para Pruebas</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono">Reset</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Borrar lotes y comenzar de cero</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Botón Sincronización en la Nube (Multi-máquina) */}
          {onOpenCloudSync && (
            <button
              id="btn-open-cloud-sync"
              onClick={onOpenCloudSync}
              title="Sincronización centralizada en la nube con Firebase Firestore (100% Automática en tiempo real)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:border-blue-500 text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Nube Auto</span>
            </button>
          )}

          {/* Botón Compartir Enlaces por Rol */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            title="Compartir enlace con acceso restringido por rol (Operarios, Calidad, etc.)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500 text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Compartir Rol</span>
          </button>

          {/* User & Role Switcher */}
          <div className="flex items-center bg-slate-800/90 hover:bg-slate-800 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 border border-slate-700 shadow-sm transition-colors shrink-0">
            {/* User Avatar Circle */}
            <button
              onClick={onOpenUsuariosModal}
              title="Ver detalles de perfil, permisos y restricciones"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${currentUser.avatarColor || currentBadge.bgGradient} flex items-center justify-center text-white text-[11px] sm:text-xs font-black shadow-inner cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0 mr-2`}
            >
              {currentUser.id === "usr-jefe-vap" || currentUser.email === "carlos.morales@arrozvapor.pe"
                ? "CM"
                : (currentUser.iniciales || currentUser.nombre.substring(0, 2).toUpperCase())}
            </button>

            {/* Quick Role / User Dropdown (Protected by PIN) */}
            <div className="relative flex items-center mr-2">
              <select
                id="select-active-user"
                aria-label="Seleccionar usuario activo"
                value={currentUser.id}
                onChange={(e) => {
                  const targetId = e.target.value;
                  if (targetId === currentUser.id) return;
                  const u = effectiveUsers.find((item) => item.id === targetId);
                  if (u) {
                    setPendingSwitchUser(u);
                    setIsPinPromptOpen(true);
                  }
                }}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-5 appearance-none w-auto max-w-[170px] sm:max-w-[220px] md:max-w-[280px] truncate"
              >
                {effectiveUsers.map((u) => {
                  const nombreItem = (u.nombre || "").trim() || u.cargo || "Usuario";
                  return (
                    <option key={u.id} value={u.id} className="bg-slate-900 text-white py-1 font-sans">
                      {nombreItem}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 pointer-events-none" />
            </div>

            {/* Subtle Divider */}
            <div className="h-4 w-px bg-slate-700 mr-2 shrink-0 hidden sm:block" />

            {/* Role Badge pill */}
            <button
              onClick={onOpenUsuariosModal}
              title="Ver matriz de permisos de este rol"
              className={`px-2 py-0.5 sm:py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border font-mono flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0 whitespace-nowrap ${currentBadge.badgeClass}`}
            >
              {getRoleIcon(currentUser.rol)}
              <span className="hidden lg:inline">{currentBadge.label}</span>
              <span className="hidden sm:inline lg:hidden">{getShortRoleLabel(currentUser.rol)}</span>
              <span className="sm:hidden">{getShortRoleLabel(currentUser.rol)}</span>
            </button>

            {/* Cerrar Sesión / Bloquear */}
            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión y bloquear estación (requiere PIN para volver a entrar)"
                className="ml-2 p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pin Prompt Modal when switching users */}
      <PinPromptModal
        isOpen={isPinPromptOpen}
        onClose={() => {
          setIsPinPromptOpen(false);
          setPendingSwitchUser(null);
        }}
        targetUser={pendingSwitchUser}
        onSuccess={(targetUser) => {
          onSelectUser?.(targetUser);
          onRoleChange?.(targetUser.rol);
          setIsPinPromptOpen(false);
          setPendingSwitchUser(null);
        }}
      />

      {/* Share restricted links modal */}
      <CompartirAccesoModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        currentUser={currentUser}
        users={effectiveUsers}
      />
    </header>
  );
};


