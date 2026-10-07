import React, { useState, useMemo } from "react";
import { UserProfile, UserRole } from "../types";
import { 
  X, 
  UserCheck, 
  ShieldCheck, 
  Code2, 
  Flame, 
  Microscope, 
  Gauge, 
  Check, 
  Mail, 
  Phone, 
  Building2, 
  Lock, 
  Award,
  Users,
  ShieldAlert,
  Shield,
  CheckCircle2,
  XCircle,
  UserPlus,
  Edit3,
  Trash2,
  Search,
  RotateCcw,
  Save,
  AlertTriangle,
  Briefcase,
  CheckSquare,
  Sparkles,
  UserX
} from "lucide-react";
import { 
  obtenerBadgeRol, 
  crearUsuario, 
  actualizarUsuario, 
  eliminarUsuario, 
  restablecerUsuariosPorDefecto,
  guardarYActualizarUsuario
} from "../utils/usuariosService";
import { 
  PermisosRol, 
  PermisoAccion, 
  LISTA_ACCIONES_CATALOGO, 
  obtenerMatrizPermisos, 
  guardarMatrizPermisos, 
  restablecerMatrizPermisos 
} from "../utils/permisosService";
import { UsuarioFormModal } from "./UsuarioFormModal";
import { PinPromptModal } from "./PinPromptModal";

interface UsuariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  users: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onUpdateUsers?: (users: UserProfile[]) => void;
}

const ROLES_MATRIZ: { rol: UserRole; label: string; sub: string; icon: React.ReactNode; color: string }[] = [
  { rol: "PROGRAMADOR", label: "Programador", sub: "Fredy G. (Admin)", icon: <Code2 className="w-3.5 h-3.5 text-purple-400" />, color: "text-purple-300" },
  { rol: "JEFE_VAPORIZADO", label: "Jefe Vaporizado", sub: "Carlos M.", icon: <Flame className="w-3.5 h-3.5 text-amber-400" />, color: "text-amber-300" },
  { rol: "SUPERVISOR", label: "Supervisor", sub: "Roberto S.", icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />, color: "text-blue-300" },
  { rol: "ANALISTA_CALIDAD", label: "Calidad", sub: "Ana R.", icon: <Microscope className="w-3.5 h-3.5 text-emerald-400" />, color: "text-emerald-300" },
  { rol: "OPERARIO", label: "Operario", sub: "Pedro H.", icon: <Gauge className="w-3.5 h-3.5 text-yellow-400" />, color: "text-yellow-300" },
  { rol: "GERENCIA", label: "Gerencia", sub: "Daniel M.", icon: <Briefcase className="w-3.5 h-3.5 text-indigo-400" />, color: "text-indigo-300" },
  { rol: "AUDITOR", label: "Auditor", sub: "Patricia L.", icon: <CheckSquare className="w-3.5 h-3.5 text-slate-400" />, color: "text-slate-300" }
];

// Helper functions to guarantee clean name and cargo separation
const getDisplayUserName = (u: UserProfile): string => {
  if (u.nombre && u.nombre.trim().length > 0) {
    return u.nombre.trim();
  }
  if (u.id === "usr-fredy") {
    return "Ing. Fredy Granados Caicedo";
  }
  return u.cargo || "Personal de Planta";
};

const getDisplayUserCargo = (u: UserProfile): string => {
  return u.cargo?.trim() || "Operaciones de Planta";
};

const getDisplayUserInitials = (u: UserProfile): string => {
  if (u.iniciales && u.iniciales.trim()) {
    return u.iniciales.trim();
  }
  const name = getDisplayUserName(u);
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("") || "U";
};

export const UsuariosModal: React.FC<UsuariosModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  onSelectUser,
  onUpdateUsers
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"perfiles" | "matriz">("perfiles");
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("TODOS");

  // State for Create/Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // State for Delete Confirmation
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Matriz de permisos interactiva
  const [matrizPermisos, setMatrizPermisos] = useState<Record<UserRole, PermisosRol>>(() => obtenerMatrizPermisos());
  const [matrixHasChanges, setMatrixHasChanges] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // State for PIN Prompt when switching users
  const [pendingSwitchUser, setPendingSwitchUser] = useState<UserProfile | null>(null);
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);

  const handlePromptSwitchUser = (targetUser: UserProfile) => {
    setPendingSwitchUser(targetUser);
    setIsPinPromptOpen(true);
  };

  // Determinar usuario seleccionado para el panel derecho
  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0] || currentUser;
  }, [users, selectedUserId, currentUser]);

  // Filtrar lista de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = 
        u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.cargo && u.cargo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.departamento && u.departamento.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchRole = roleFilter === "TODOS" || u.rol === roleFilter;

      return matchSearch && matchRole;
    });
  }, [users, searchTerm, roleFilter]);

  if (!isOpen) return null;

  const currentRoleCfg = matrizPermisos[selectedUser.rol] || matrizPermisos.OPERARIO;

  // Handlers para Usuarios
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditUser = (user: UserProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const userToEdit: UserProfile = {
      ...user,
      nombre: getDisplayUserName(user),
      cargo: getDisplayUserCargo(user),
      iniciales: getDisplayUserInitials(user)
    };
    setEditingUser(userToEdit);
    setIsFormModalOpen(true);
  };

  const handleSaveUserFromForm = (usuario: UserProfile) => {
    const { usuario: savedUser, lista: updatedList } = guardarYActualizarUsuario(usuario, users);

    if (onUpdateUsers) {
      onUpdateUsers(updatedList);
    }
    setSelectedUserId(savedUser.id);
    setSaveToast(`Usuario ${savedUser.nombre} guardado exitosamente.`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handlePromptDelete = (user: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user.id === "usr-fredy") {
      setDeleteError("El perfil de Ingeniería Principal (Fredy Granados) está protegido y no puede ser eliminado.");
      setTimeout(() => setDeleteError(null), 4000);
      return;
    }
    if (user.id === currentUser.id) {
      setDeleteError("No puede eliminar el usuario de la sesión actualmente activa.");
      setTimeout(() => setDeleteError(null), 4000);
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    try {
      const updatedList = eliminarUsuario(userToDelete.id);
      if (onUpdateUsers) {
        onUpdateUsers(updatedList);
      }
      if (selectedUserId === userToDelete.id) {
        setSelectedUserId(currentUser.id);
      }
      setUserToDelete(null);
      setSaveToast(`Usuario ${userToDelete.nombre} eliminado.`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      setDeleteError(err.message || "Error al eliminar usuario.");
      setTimeout(() => setDeleteError(null), 4000);
    }
  };

  const handleToggleUserStatus = (user: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !(user.activo !== false);
    const updatedList = actualizarUsuario(user.id, { activo: newStatus });
    if (onUpdateUsers) {
      onUpdateUsers(updatedList);
    }
    setSaveToast(`Usuario ${user.nombre} ${newStatus ? "habilitado" : "deshabilitado"}.`);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleResetToDefaultUsers = () => {
    const def = restablecerUsuariosPorDefecto();
    if (onUpdateUsers) {
      onUpdateUsers(def);
    }
    setSaveToast("Usuarios restablecidos a los valores oficiales de planta.");
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Handlers para Matriz de Permisos
  const handleToggleMatrixCell = (rol: UserRole, accion: PermisoAccion) => {
    const currentVal = Boolean(matrizPermisos[rol]?.acciones[accion]);
    setMatrizPermisos(prev => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        acciones: {
          ...prev[rol].acciones,
          [accion]: !currentVal
        }
      }
    }));
    setMatrixHasChanges(true);
  };

  const handleSaveMatrixChanges = () => {
    guardarMatrizPermisos(matrizPermisos);
    setMatrixHasChanges(false);
    setSaveToast("Matriz de permisos guardada y aplicada a todo el sistema.");
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleResetMatrixDefaults = () => {
    const def = restablecerMatrizPermisos();
    setMatrizPermisos(def);
    setMatrixHasChanges(false);
    setSaveToast("Permisos restablecidos a los estándares oficiales.");
    setTimeout(() => setSaveToast(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md flex justify-center items-start sm:items-center">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col my-auto max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Floating Feedback Toast */}
        {saveToast && (
          <div className="bg-emerald-900/95 border-b border-emerald-500/80 px-4 py-2 text-emerald-100 text-xs font-semibold flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{saveToast}</span>
            </div>
            <button onClick={() => setSaveToast(null)} className="text-emerald-300 hover:text-white text-xs">✕</button>
          </div>
        )}

        {deleteError && (
          <div className="bg-rose-950/95 border-b border-rose-600/80 px-4 py-2 text-rose-200 text-xs font-semibold flex items-center justify-between shadow-lg shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{deleteError}</span>
            </div>
            <button onClick={() => setDeleteError(null)} className="text-rose-300 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Centro de Usuarios & Matriz de Permisos (RBAC)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  {users.length} USUARIOS REGISTRADOS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Administración de credenciales, roles operativos y control de acceso granular de la planta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Sub-tabs switch */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => setActiveSubTab("perfiles")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "perfiles"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Directorio de Usuarios ({users.length})
              </button>
              <button
                onClick={() => setActiveSubTab("matriz")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === "matriz"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Matriz de Permisos
                {matrixHasChanges && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Cambios sin guardar" />
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Toolbar: Search, Role Filters & New User Button (Pinned below header) */}
        {activeSubTab === "perfiles" && (
          <div className="px-4 sm:px-5 py-3 bg-slate-850/90 border-b border-slate-800 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, cargo, correo..."
                  className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full text-xs font-mono">
                {["TODOS", "PROGRAMADOR", "JEFE_VAPORIZADO", "SUPERVISOR", "ANALISTA_CALIDAD", "OPERARIO", "GERENCIA", "AUDITOR"].map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                      roleFilter === r
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60"
                    }`}
                  >
                    {r === "TODOS" ? "Todos" : r.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* Create User Button */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleOpenCreateUser}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-950/40 transition-all cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo Usuario</span>
                </button>

                <button
                  onClick={handleResetToDefaultUsers}
                  title="Restablecer usuarios predeterminados de planta"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Body */}
        {activeSubTab === "perfiles" ? (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto min-h-0">
            {/* Layout 2 Columns: Users List (left) and Selected User Details (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Left Column: Users Cards List */}
              <div className="lg:col-span-7 space-y-2.5">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No se encontraron usuarios</p>
                    <p className="text-xs text-slate-500 mt-1">Pruebe ajustando los filtros de búsqueda o registre un nuevo usuario.</p>
                    <button
                      onClick={handleOpenCreateUser}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      + Crear Primer Usuario
                    </button>
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isActive = currentUser.id === u.id;
                    const isSelected = selectedUser.id === u.id;
                    const badgeInfo = obtenerBadgeRol(u.rol);
                    const isAccountActive = u.activo !== false;

                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-slate-800/95 border-purple-500 shadow-md ring-1 ring-purple-500/40"
                            : "bg-slate-850/60 hover:bg-slate-800/50 border-slate-800"
                        } ${!isAccountActive ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Avatar */}
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${u.avatarColor || badgeInfo.bgGradient} flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0`}>
                            {getDisplayUserInitials(u)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-white truncate">{getDisplayUserName(u)}</h4>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                                  <Check className="w-3 h-3" /> Sesión Activa
                                </span>
                              )}
                              {!isAccountActive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                                  Inactivo
                                </span>
                              )}
                              {u.permisosPersonalizados && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                                  Personalizado
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 truncate mt-0.5">{getDisplayUserCargo(u)}</p>
                            
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`px-2 py-0.2 rounded text-[10px] font-black border uppercase font-mono ${badgeInfo.badgeClass}`}>
                                {badgeInfo.label}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons on card */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Botón Activar Sesión */}
                          {!isActive && isAccountActive && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePromptSwitchUser(u);
                              }}
                              title="Activar como usuario de sesión actual (requiere PIN)"
                              className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-semibold transition-all cursor-pointer"
                            >
                              Activar
                            </button>
                          )}

                          {/* Botón Editar */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditUser(u, e)}
                            title="Editar usuario y permisos"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Botón Eliminar (no para Fredy ni usuario actual) */}
                          {u.id !== "usr-fredy" && u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={(e) => handlePromptDelete(u, e)}
                              title="Eliminar usuario"
                              className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Selected User Full Details & Permissions */}
              <div className="lg:col-span-5 bg-slate-950/60 rounded-xl p-5 border border-slate-800 flex flex-col justify-between sticky top-2">
                <div>
                  {/* Header profile badge */}
                  <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-start gap-3.5">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${selectedUser.avatarColor || "from-purple-600 to-indigo-700"} flex items-center justify-center text-white text-xl font-black shadow-xl shrink-0`}>
                        {getDisplayUserInitials(selectedUser)}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white leading-snug">{getDisplayUserName(selectedUser)}</h4>
                        <p className="text-xs text-purple-300 font-medium mt-0.5">{getDisplayUserCargo(selectedUser)}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border uppercase font-mono ${obtenerBadgeRol(selectedUser.rol).badgeClass}`}>
                            {obtenerBadgeRol(selectedUser.rol).label}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${selectedUser.activo !== false ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60" : "bg-rose-950/60 text-rose-300 border-rose-800/60"}`}>
                            {selectedUser.activo !== false ? "Habilitado" : "Deshabilitado"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditUser(selectedUser)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Editar este usuario"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Department & Contact Details */}
                  <div className="mt-3.5 space-y-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-400 font-sans">Área:</span>
                      <strong className="text-white">{selectedUser.departamento || "Planta de Vaporizado"}</strong>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-400 font-sans">Correo:</span>
                      <strong className="text-cyan-300 break-all">{selectedUser.email}</strong>
                    </div>

                    {selectedUser.telefono && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-400 font-sans">Contacto:</span>
                        <strong className="text-white">{selectedUser.telefono}</strong>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-slate-300 pt-0.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-400 font-sans">Nivel Acceso:</span>
                      <strong className="text-amber-300 font-sans text-[11px]">{selectedUser.nivelAcceso || "Operaciones Estándar"}</strong>
                    </div>
                  </div>

                  {/* Permissions list */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-purple-400" />
                        Permisos Habilitados
                      </span>
                      {selectedUser.permisosPersonalizados && (
                        <span className="text-[10px] text-amber-300 font-mono bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/50">
                          Matriz Personalizada
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {selectedUser.permisos && selectedUser.permisos.length > 0 ? (
                        selectedUser.permisos.map((permiso, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-xs bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-slate-200 text-[11px] leading-tight">{permiso}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic p-2 bg-slate-900/40 rounded-lg">
                          Habilitado según plantilla de rol estándar ({selectedUser.rol}).
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security Restrictions Box */}
                  {currentRoleCfg.restriccionesClave && currentRoleCfg.restriccionesClave.length > 0 && (
                    <div className="mt-3 bg-amber-950/20 border border-amber-800/40 rounded-xl p-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase font-mono mb-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        Restricciones por Rol ({selectedUser.rol})
                      </div>
                      <ul className="space-y-1 text-[11px] text-amber-200/90">
                        {currentRoleCfg.restriccionesClave.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleToggleUserStatus(selectedUser, e)}
                    className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    {selectedUser.activo !== false ? "Deshabilitar cuenta" : "Habilitar cuenta"}
                  </button>

                  {currentUser.id === selectedUser.id ? (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
                      <Check className="w-4 h-4" /> Sesión Activa
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePromptSwitchUser(selectedUser)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-950/50 transition-all cursor-pointer active:scale-95"
                    >
                      <UserCheck className="w-4 h-4" />
                      Activar este Usuario
                    </button>
                  )}
                </div>

              </div>

            </div>

          </div>
        ) : (
          /* Matriz Dinámica e Interactiva de Permisos (RBAC) */
          <div className="p-3 sm:p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
            
            {/* Action & Info Bar */}
            <div className="bg-slate-850 p-3 rounded-xl border border-slate-750 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Haga clic en cualquier celda para <strong>habilitar o bloquear permisos en tiempo real</strong> para cada rol de planta.
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 text-[11px] font-mono mr-2 hidden sm:flex">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Permitido
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <XCircle className="w-3.5 h-3.5" /> Restringido
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleResetMatrixDefaults}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveMatrixChanges}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95 ${
                    matrixHasChanges
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 animate-pulse"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{matrixHasChanges ? "Guardar Cambios *" : "Guardar Permisos"}</span>
                </button>
              </div>
            </div>

            {/* Interactive RBAC Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-950 text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-800 font-mono text-[11px]">
                  <tr>
                    <th className="py-3 px-4 bg-slate-950 min-w-[250px]">Acción / Función Operativa</th>
                    {ROLES_MATRIZ.map(r => (
                      <th key={r.rol} className={`py-3 px-2 text-center bg-slate-950 ${r.color} min-w-[110px]`}>
                        <div className="flex items-center justify-center gap-1">
                          {r.icon}
                          <span>{r.label}</span>
                        </div>
                        <div className="text-[9px] font-normal text-slate-400">{r.sub}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                  {LISTA_ACCIONES_CATALOGO.map((acc) => {
                    return (
                      <tr key={acc.key} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-100">{acc.label}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-purple-300 text-[9px] border border-slate-700">
                              {acc.modulo}
                            </span>
                            <span>{acc.desc}</span>
                          </div>
                        </td>

                        {ROLES_MATRIZ.map((r) => {
                          const isSuperAdmin = Boolean(matrizPermisos[r.rol]?.esSuperAdmin);
                          const isAllowed = isSuperAdmin || Boolean(matrizPermisos[r.rol]?.acciones[acc.key]);

                          return (
                            <td 
                              key={r.rol} 
                              className="py-2 px-2 text-center cursor-pointer select-none hover:bg-slate-800/80 transition-colors"
                              onClick={() => {
                                if (isSuperAdmin && r.rol === "PROGRAMADOR") {
                                  // El superadmin programador mantiene acceso total
                                  return;
                                }
                                handleToggleMatrixCell(r.rol, acc.key);
                              }}
                              title={isSuperAdmin && r.rol === "PROGRAMADOR" ? "Super Admin tiene acceso irrestricto" : "Clic para conmutar permiso"}
                            >
                              {isAllowed ? (
                                <span className="inline-flex items-center justify-center p-1 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/90 rounded-full border border-emerald-700/60 transition-transform active:scale-90">
                                  <CheckCircle2 className="w-4 h-4" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center p-1 bg-rose-950/60 text-rose-400/80 hover:bg-rose-900/80 rounded-full border border-rose-800/50 transition-transform active:scale-90">
                                  <XCircle className="w-4 h-4" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1">
              <span>Los cambios realizados en la matriz se guardan localmente en el navegador y rigen de inmediato en toda la aplicación.</span>
              <button
                onClick={() => setActiveSubTab("perfiles")}
                className="text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer"
              >
                ← Volver a Directorio de Usuarios
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal Formulario Crear / Editar Usuario */}
      {isFormModalOpen && (
        <UsuarioFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingUser(null);
          }}
          usuarioAEditar={editingUser}
          onSave={handleSaveUserFromForm}
          matrizPermisos={matrizPermisos}
        />
      )}

      {/* Confirmation Dialog for Delete */}
      {userToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-700/60 text-rose-400 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">¿Eliminar Usuario?</h4>
                <p className="text-xs text-slate-400">Esta acción removerá el perfil y sus credenciales.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{userToDelete.nombre}</div>
              <div className="text-purple-300 font-mono text-[11px]">{userToDelete.rol}</div>
              <div className="text-slate-400">{userToDelete.email}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/50 cursor-pointer"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Prompt Modal */}
      <PinPromptModal
        isOpen={isPinPromptOpen}
        onClose={() => {
          setIsPinPromptOpen(false);
          setPendingSwitchUser(null);
        }}
        targetUser={pendingSwitchUser}
        onSuccess={(target) => {
          onSelectUser(target);
          setSelectedUserId(target.id);
          setIsPinPromptOpen(false);
          setPendingSwitchUser(null);
        }}
      />

    </div>
  );
};
