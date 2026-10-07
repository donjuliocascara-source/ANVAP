import React, { useState, useEffect, useRef } from "react";
import { UserProfile, UserRole } from "../types";
import { 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Flame, 
  Microscope, 
  Gauge, 
  Code2, 
  Briefcase, 
  CheckSquare, 
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  Building2,
  Delete
} from "lucide-react";
import { 
  USUARIOS_DEL_SISTEMA, 
  obtenerBadgeRol, 
  validarPinUsuario, 
  iniciarSesionUsuario 
} from "../utils/usuariosService";

interface LoginViewProps {
  users?: UserProfile[];
  onLoginSuccess: (user: UserProfile) => void;
  targetUserIdFromUrl?: string;
  targetRoleFromUrl?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({
  users = [],
  onLoginSuccess,
  targetUserIdFromUrl,
  targetRoleFromUrl
}) => {
  const effectiveUsers = users.length > 0 ? users : USUARIOS_DEL_SISTEMA;
  
  // Find initial user from URL params if present
  const initialUser = React.useMemo(() => {
    if (targetUserIdFromUrl) {
      const found = effectiveUsers.find(u => u.id === targetUserIdFromUrl);
      if (found) return found;
    }
    if (targetRoleFromUrl) {
      const found = effectiveUsers.find(u => u.rol.toLowerCase() === targetRoleFromUrl.toLowerCase());
      if (found) return found;
    }
    // Default select Programador
    return effectiveUsers.find(u => u.rol === "PROGRAMADOR") || effectiveUsers[0];
  }, [effectiveUsers, targetUserIdFromUrl, targetRoleFromUrl]);

  const [selectedUser, setSelectedUser] = useState<UserProfile>(initialUser);
  const [pin, setPin] = useState<string>("");
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    // Focus PIN input whenever selected user changes
    setErrorMsg(null);
    setPin("");
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 150);
  }, [selectedUser]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setErrorMsg(null);
    setPin("");
  };

  const handleNumClick = (digit: string) => {
    if (pin.length < 8) {
      setPin(prev => prev + digit);
      setErrorMsg(null);
    }
  };

  const handleDeleteDigit = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClearPin = () => {
    setPin("");
    setErrorMsg(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg("Ingrese el PIN de seguridad.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    setTimeout(() => {
      const isValid = validarPinUsuario(selectedUser, pin);
      if (isValid) {
        iniciarSesionUsuario(selectedUser);
        onLoginSuccess(selectedUser);
      } else {
        setErrorMsg("PIN incorrecto. Verifique su clave o contacte al Ingeniero Fredy.");
        setIsSubmitting(false);
      }
    }, 200);
  };

  const filteredUsers = effectiveUsers.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      u.rol.toLowerCase().includes(q) ||
      (u.cargo || "").toLowerCase().includes(q)
    );
  });

  const badge = obtenerBadgeRol(selectedUser.rol);

  const getRoleIcon = (rol: UserRole) => {
    switch (rol) {
      case "PROGRAMADOR":
      case "INGENIERO_PROGRAMADOR":
      case "ADMINISTRADOR":
      case "ADMIN":
        return <Code2 className="w-4 h-4 text-purple-400" />;
      case "JEFE_VAPORIZADO":
      case "JEFE_PLANTA":
        return <Flame className="w-4 h-4 text-amber-400" />;
      case "SUPERVISOR":
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case "ANALISTA_CALIDAD":
      case "CONTROL_CALIDAD":
      case "CALIDAD":
        return <Microscope className="w-4 h-4 text-emerald-400" />;
      case "GERENCIA":
        return <Briefcase className="w-4 h-4 text-indigo-400" />;
      case "AUDITOR":
        return <CheckSquare className="w-4 h-4 text-slate-400" />;
      default:
        return <Gauge className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Flame className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest uppercase bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-mono">
                LÍNEA INDUSTRIAL APIT 35 TN
              </span>
              <span className="text-xs font-medium text-slate-500 font-mono">v3.0</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
              Control de Vaporizado & Trazabilidad de Planta
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-xl">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Acceso Restringido por Roles & PIN de Seguridad</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* Left Column: User Selection Grid */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-sm shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  1. Seleccione su Perfil de Planta
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identifíquese con su usuario asignado para ingresar con sus permisos específicos
                </p>
              </div>

              {/* Quick Filter */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o rol..."
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-colors w-full sm:w-52"
              />
            </div>

            {/* Grid of Users */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const isSelected = selectedUser.id === u.id;
                const userBadge = obtenerBadgeRol(u.rol);
                return (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    type="button"
                    className={`text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 relative group ${
                      isSelected
                        ? "bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30"
                        : "bg-slate-950/40 hover:bg-slate-800/50 border-slate-800/70 hover:border-slate-700"
                    }`}
                  >
                    {/* User Avatar Circle */}
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                        u.avatarColor || userBadge.bgGradient
                      } flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0 mt-0.5`}
                    >
                      {u.iniciales || u.nombre.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs sm:text-sm font-bold text-white truncate block">
                          {u.nombre}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono flex items-center gap-1 ${userBadge.badgeClass}`}
                        >
                          {getRoleIcon(u.rol)}
                          {userBadge.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-1">
                        {u.cargo || u.departamento || "Operaciones Planta"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Note below user selection */}
            <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Info className="w-4 h-4 text-amber-400" />
                Los operadores solo ven sus pantallas de control y registro de piso.
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Total: {effectiveUsers.length} usuarios
              </span>
            </div>
          </div>

          {/* Right Column: PIN Verification & Access */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">2. Ingrese su PIN de Seguridad</h3>
                  <p className="text-xs text-slate-400">Autenticación requerida para acceder</p>
                </div>
              </div>

              {/* Selected Profile Banner */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                      selectedUser.avatarColor || badge.bgGradient
                    } flex items-center justify-center text-white font-black text-base shadow-inner shrink-0`}
                  >
                    {selectedUser.iniciales || selectedUser.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-slate-400 block font-mono">Usuario Seleccionado:</span>
                    <h4 className="text-sm sm:text-base font-black text-white truncate">
                      {selectedUser.nombre}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono ${badge.badgeClass}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIN Input Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>PIN DE ACCESO (4 DÍGITOS):</span>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 focus:outline-none"
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPin ? "Ocultar" : "Mostrar"}
                    </button>
                  </label>

                  <div className="relative">
                    <input
                      ref={pinInputRef}
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        setPin(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="• • • •"
                      maxLength={8}
                      autoFocus
                      className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-center text-xl tracking-[0.4em] font-mono font-bold text-white focus:outline-none transition-all ${
                        errorMsg
                          ? "border-red-500 bg-red-950/20 text-red-200 focus:ring-2 focus:ring-red-500/30"
                          : "border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      }`}
                    />
                  </div>

                  {errorMsg && (
                    <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5 animate-bounce">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>

                {/* On-screen Numeric Keypad for Touchscreens/Plant Screens */}
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="grid grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleNumClick(num)}
                        className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-amber-600 text-white font-mono text-base font-bold transition-all border border-slate-800/80 hover:border-slate-700 active:scale-95"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleClearPin}
                      className="py-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-xs font-semibold transition-all border border-slate-800/80"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumClick("0")}
                      className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-amber-600 text-white font-mono text-base font-bold transition-all border border-slate-800/80 hover:border-slate-700 active:scale-95"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteDigit}
                      className="py-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-xs font-semibold transition-all border border-slate-800/80 flex items-center justify-center"
                      title="Borrar último dígito"
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !pin.trim()}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <span>Verificando credenciales...</span>
                  ) : (
                    <>
                      <span>Ingresar al Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Help Hint Banner */}
            <div className="mt-6 p-3.5 bg-purple-950/40 border border-purple-500/30 rounded-xl text-[11px] text-slate-300 shadow-lg">
              <div className="flex items-center gap-1.5 font-bold text-purple-300 mb-1">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Credencial de Acceso del Programador:</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                • <strong className="text-white">Ing. Fredy Granados Caicedo (Programador / Super Admin):</strong> PIN <code className="text-purple-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-purple-500/40 font-bold tracking-widest text-xs">2026</code>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono">
        <div>
          © 2026 Planta de Arroz Vaporizado APIT • Sistema de Seguridad y Roles
        </div>
        <div className="flex items-center gap-4">
          <span>Diseño & Desarrollo: Ing. Fredy Granados Caicedo</span>
        </div>
      </footer>
    </div>
  );
};
