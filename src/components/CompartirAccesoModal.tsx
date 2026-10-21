import React, { useState } from "react";
import { UserProfile, UserRole } from "../types";
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Lock, 
  ShieldCheck, 
  Flame, 
  Microscope, 
  Gauge, 
  Code2, 
  AlertCircle,
  Link,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { obtenerBadgeRol } from "../utils/usuariosService";

interface CompartirAccesoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  users: UserProfile[];
}

export const CompartirAccesoModal: React.FC<CompartirAccesoModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users = []
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Base URL calculation (works in dev, preview, or shared domains)
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const baseUrl = `${origin}${pathname}`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const shareProfiles = [
    {
      id: "share-general",
      titulo: "Enlace General al Sistema (Login con PIN)",
      subtitulo: "Pantalla de control de acceso y validación de seguridad",
      rol: (currentUser.rol || "PROGRAMADOR") as UserRole,
      userId: "",
      pin: currentUser.pin || "2026",
      permisosTexto: "Pantalla de bloqueo. Requiere autenticación con PIN para acceder.",
      icon: <Lock className="w-4 h-4 text-purple-400" />,
      colorBadge: "bg-purple-950/60 text-purple-300 border-purple-700/50"
    },
    ...users.map((u) => {
      const isProg = u.rol === "PROGRAMADOR";
      return {
        id: `share-${u.id}`,
        titulo: `Acceso Directo: ${u.nombre}`,
        subtitulo: `${u.cargo || "Programador & Desarrollador Principal"}`,
        rol: u.rol,
        userId: u.id,
        pin: u.pin || (isProg ? "2026" : "1234"),
        permisosTexto: u.nivelAcceso || "Control Total del Sistema y Configuración",
        icon: isProg ? <Code2 className="w-4 h-4 text-purple-400" /> : <ShieldCheck className="w-4 h-4 text-indigo-400" />,
        colorBadge: isProg 
          ? "bg-purple-950/60 text-purple-300 border-purple-700/50"
          : "bg-indigo-950/60 text-indigo-300 border-indigo-700/50"
      };
    })
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Compartir Acceso con Roles Restringidos</h3>
              <p className="text-xs text-slate-400">
                Evite dar acceso a todo: copie el enlace exacto para cada miembro de planta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-3.5">
          {/* Explanatory Banner */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white block mb-0.5">Control de Seguridad Activo:</strong>
              Cualquier persona que abra el enlace compartido llegará a la{" "}
              <span className="text-amber-300 font-semibold">Pantalla de Inicio de Sesión</span>.
              Nadie puede ver pantallas administrativas ni modificar recetas sin ingresar el PIN de su usuario.
            </div>
          </div>

          {/* Links list */}
          <div className="space-y-2.5">
            {shareProfiles.map((item) => {
              const url = item.userId 
                ? `${baseUrl}?usuario=${item.userId}`
                : `${baseUrl}`;

              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-slate-800 text-white">
                        {item.icon}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.titulo}
                      </h4>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${item.colorBadge}`}>
                        PIN: {item.pin}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {item.subtitulo} • <span className="text-slate-500">{item.permisosTexto}</span>
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={url}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-300 focus:outline-none select-all"
                      />
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(url, item.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCopied
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-500"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Enlace</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Admin Warning */}
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-3 text-[11px] text-purple-200/90 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>Nota de Seguridad:</strong> El perfil <em>Ing. Fredy Granados (Programador)</em> está protegido con el PIN secreto <code>2026</code>. Nunca comparta ese PIN a terceros.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
