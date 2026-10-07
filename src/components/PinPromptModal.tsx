import React, { useState, useRef, useEffect } from "react";
import { UserProfile, UserRole } from "../types";
import { 
  Lock, 
  X, 
  KeyRound, 
  AlertCircle, 
  ArrowRight, 
  Delete, 
  ShieldCheck, 
  Code2, 
  Flame, 
  Microscope, 
  Gauge, 
  Briefcase, 
  CheckSquare 
} from "lucide-react";
import { obtenerBadgeRol, validarPinUsuario } from "../utils/usuariosService";

interface PinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  onSuccess: (user: UserProfile) => void;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess
}) => {
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setErrorMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, targetUser]);

  if (!isOpen || !targetUser) return null;

  const badge = obtenerBadgeRol(targetUser.rol);

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

    const isValid = validarPinUsuario(targetUser, pin);
    if (isValid) {
      onSuccess(targetUser);
      onClose();
    } else {
      setErrorMsg("PIN incorrecto. Acceso no autorizado.");
    }
  };

  const getRoleIcon = (rol: UserRole) => {
    switch (rol) {
      case "PROGRAMADOR":
      case "INGENIERO_PROGRAMADOR":
      case "ADMINISTRADOR":
      case "ADMIN":
        return <Code2 className="w-3.5 h-3.5 text-purple-400" />;
      case "JEFE_VAPORIZADO":
      case "JEFE_PLANTA":
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case "SUPERVISOR":
        return <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />;
      case "ANALISTA_CALIDAD":
      case "CONTROL_CALIDAD":
      case "CALIDAD":
        return <Microscope className="w-3.5 h-3.5 text-emerald-400" />;
      case "GERENCIA":
        return <Briefcase className="w-3.5 h-3.5 text-indigo-400" />;
      case "AUDITOR":
        return <CheckSquare className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <Gauge className="w-3.5 h-3.5 text-yellow-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Verificación de Seguridad</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-xs text-slate-300 mb-3">
            Para cambiar al siguiente usuario y habilitar sus permisos, ingrese su PIN:
          </p>

          {/* Target User Banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-4 flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                targetUser.avatarColor || badge.bgGradient
              } flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0`}
            >
              {targetUser.iniciales || targetUser.nombre.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                {targetUser.nombre}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono flex items-center gap-1 ${badge.badgeClass}`}>
                  {getRoleIcon(targetUser.rol)}
                  {badge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="• • • •"
                maxLength={8}
                className={`w-full bg-slate-950 border rounded-xl px-4 py-2.5 text-center text-xl tracking-[0.4em] font-mono font-bold text-white focus:outline-none transition-all ${
                  errorMsg
                    ? "border-red-500 bg-red-950/20 text-red-200"
                    : "border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                }`}
              />

              {errorMsg && (
                <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Numeric Keypad */}
            <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800">
              <div className="grid grid-cols-3 gap-1.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumClick(num)}
                    className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-amber-600 text-white font-mono text-sm font-bold border border-slate-800/80"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearPin}
                  className="py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 font-mono text-xs"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick("0")}
                  className="py-2 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-amber-600 text-white font-mono text-sm font-bold border border-slate-800/80"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDigit}
                  className="py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 flex items-center justify-center"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!pin.trim()}
                className="w-2/3 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>Confirmar PIN</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
