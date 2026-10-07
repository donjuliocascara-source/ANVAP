import React, { useState, useEffect } from "react";
import { UserProfile, UserRole } from "../types";
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Shield, 
  Award, 
  Check, 
  Sparkles,
  AlertCircle,
  KeyRound
} from "lucide-react";
import { PermisosRol, LISTA_ACCIONES_CATALOGO, PermisoAccion } from "../utils/permisosService";
import { obtenerBadgeRol } from "../utils/usuariosService";

interface UsuarioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  usuarioAEditar?: UserProfile | null;
  onSave: (usuario: UserProfile) => void;
  matrizPermisos: Record<UserRole, PermisosRol>;
}

const PALETAS_AVATAR = [
  { label: "Púrpura / Índigo", value: "from-purple-600 to-indigo-700" },
  { label: "Ámbar / Naranja", value: "from-amber-600 to-orange-700" },
  { label: "Azul / Cian", value: "from-blue-600 to-cyan-700" },
  { label: "Esmeralda / Teal", value: "from-emerald-600 to-teal-700" },
  { label: "Ámbar / Amarillo", value: "from-amber-700 to-yellow-800" },
  { label: "Naranja / Óxido", value: "from-orange-700 to-amber-800" },
  { label: "Índigo / Marino", value: "from-indigo-600 to-blue-800" },
  { label: "Pizarra / Acero", value: "from-slate-700 to-slate-800" },
  { label: "Rosa / Carmín", value: "from-rose-600 to-pink-700" }
];

const ROLES_DISPONIBLES: { rol: UserRole; label: string; desc: string }[] = [
  { rol: "PROGRAMADOR", label: "Ingeniería / Programador (Super Admin)", desc: "Control total, algoritmos IA, fórmulas y calibración" },
  { rol: "JEFE_VAPORIZADO", label: "Jefe de Planta y Vaporizado", desc: "Aprobación de recetas, programación de autoclaves y cierre" },
  { rol: "SUPERVISOR", label: "Supervisor de Turno / Operaciones", desc: "Monitoreo en tiempo real de autoclaves, secadoras y tolvas" },
  { rol: "ANALISTA_CALIDAD", label: "Analista de Control de Calidad", desc: "Registro de 14 caladas, humedad de descarga y prueba de olla" },
  { rol: "OPERARIO", label: "Operario de Vaporizado y Secado", desc: "Control de piso, temperaturas, válvulas y carga en tolvas" },
  { rol: "GERENCIA", label: "Gerencia General de Operaciones", desc: "Visualización de KPIs, rendimientos y reportes ejecutivos" },
  { rol: "AUDITOR", label: "Auditor de Calidad y Procesos", desc: "Auditoría de trazabilidad y cumplimiento de normas BPM" }
];

export const UsuarioFormModal: React.FC<UsuarioFormModalProps> = ({
  isOpen,
  onClose,
  usuarioAEditar,
  onSave,
  matrizPermisos
}) => {
  const isEditing = Boolean(usuarioAEditar);

  // Form states
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<UserRole>("OPERARIO");
  const [cargo, setCargo] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nivelAcceso, setNivelAcceso] = useState("");
  const [avatarColor, setAvatarColor] = useState(PALETAS_AVATAR[2].value);
  const [activo, setActivo] = useState(true);
  const [pin, setPin] = useState("1234");

  // Custom permissions map (key -> boolean)
  const [permisosMap, setPermisosMap] = useState<Record<string, boolean>>({});
  const [customPermissionsEnabled, setCustomPermissionsEnabled] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar datos al abrir
  useEffect(() => {
    if (isOpen) {
      if (usuarioAEditar) {
        const nombreCargado = (usuarioAEditar.nombre || "").trim() || "Usuario de Planta";
        const cargoCargado = (usuarioAEditar.cargo || "").trim();

        setNombre(nombreCargado);
        setEmail(usuarioAEditar.email || "");
        setRol(usuarioAEditar.rol || "OPERARIO");
        setCargo(cargoCargado);
        setDepartamento(usuarioAEditar.departamento || "");
        setTelefono(usuarioAEditar.telefono || "");
        setNivelAcceso(usuarioAEditar.nivelAcceso || "");
        setAvatarColor(usuarioAEditar.avatarColor || PALETAS_AVATAR[0].value);
        setActivo(usuarioAEditar.activo !== undefined ? usuarioAEditar.activo : true);
        setPin(usuarioAEditar.pin || (usuarioAEditar.rol === "PROGRAMADOR" ? "2026" : "1234"));

        if (usuarioAEditar.permisosPersonalizados) {
          setPermisosMap(usuarioAEditar.permisosPersonalizados);
          setCustomPermissionsEnabled(true);
        } else {
          // Inicializar según el rol
          const cfg = matrizPermisos[usuarioAEditar.rol] || matrizPermisos.OPERARIO;
          const initialMap: Record<string, boolean> = {};
          LISTA_ACCIONES_CATALOGO.forEach(a => {
            initialMap[a.key] = Boolean(cfg?.acciones[a.key]);
          });
          setPermisosMap(initialMap);
          setCustomPermissionsEnabled(false);
        }
      } else {
        // Reset para nuevo usuario
        setNombre("");
        setEmail("");
        setRol("OPERARIO");
        setCargo("Operario de Vaporizado");
        setDepartamento("Línea de Autoclaves y Secadoras");
        setTelefono("+51 ");
        setNivelAcceso("Registro en Piso de Planta");
        setAvatarColor(PALETAS_AVATAR[4].value);
        setActivo(true);
        setPin("1234");
        setCustomPermissionsEnabled(false);

        const initialMap: Record<string, boolean> = {};
        const cfg = matrizPermisos.OPERARIO;
        LISTA_ACCIONES_CATALOGO.forEach(a => {
          initialMap[a.key] = Boolean(cfg?.acciones[a.key]);
        });
        setPermisosMap(initialMap);
      }
      setErrors({});
    }
  }, [isOpen, usuarioAEditar, matrizPermisos]);

  // Al cambiar de rol, sugerir cargo, departamento y actualizar permisos si no están personalizados
  const handleRoleChange = (nuevoRol: UserRole) => {
    setRol(nuevoRol);
    const badge = obtenerBadgeRol(nuevoRol);
    setAvatarColor(badge.bgGradient);

    // Sugerencias automáticas para rapidez operativa
    if (!isEditing || !cargo) {
      switch (nuevoRol) {
        case "PROGRAMADOR":
          setCargo("Ingeniero de Procesos / Programador");
          setDepartamento("Ingeniería de Sistemas y Optimización Industrial");
          setNivelAcceso("Super Admin / Control Total / Algoritmos IA");
          break;
        case "JEFE_VAPORIZADO":
          setCargo("Jefe de Planta y Línea de Vaporizado");
          setDepartamento("Jefatura de Producción de Vaporizado");
          setNivelAcceso("Aprobación de Batches / Programación Maestra");
          break;
        case "SUPERVISOR":
          setCargo("Supervisor de Turno de Vaporizado");
          setDepartamento("Supervisión de Turnos y Procesos en Planta");
          setNivelAcceso("Monitoreo Operativo en Tiempo Real");
          break;
        case "ANALISTA_CALIDAD":
          setCargo("Analista de Control de Calidad");
          setDepartamento("Laboratorio de Calidad y Análisis Físico-Sensorial");
          setNivelAcceso("Dictamen de Calidad / Pruebas de Olla");
          break;
        case "OPERARIO":
          setCargo("Operario de Vaporizado y Secado");
          setDepartamento("Línea de Autoclaves y Secadoras");
          setNivelAcceso("Registro en Piso de Planta");
          break;
        case "GERENCIA":
          setCargo("Gerente de Operaciones");
          setDepartamento("Gerencia General de Operaciones");
          setNivelAcceso("Acceso Ejecutivo y Reportes");
          break;
        case "AUDITOR":
          setCargo("Auditor de Calidad y Procesos");
          setDepartamento("Aseguramiento de Calidad y Normativa");
          setNivelAcceso("Auditoría de Procesos / Solo Lectura");
          break;
      }
    }

    // Actualizar permisos base
    if (!customPermissionsEnabled) {
      const cfg = matrizPermisos[nuevoRol] || matrizPermisos.OPERARIO;
      const initialMap: Record<string, boolean> = {};
      LISTA_ACCIONES_CATALOGO.forEach(a => {
        initialMap[a.key] = Boolean(cfg?.acciones[a.key]);
      });
      setPermisosMap(initialMap);
    }
  };

  const handleTogglePermiso = (key: PermisoAccion) => {
    setCustomPermissionsEnabled(true);
    setPermisosMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleRestablecerPermisosRol = () => {
    const cfg = matrizPermisos[rol] || matrizPermisos.OPERARIO;
    const map: Record<string, boolean> = {};
    LISTA_ACCIONES_CATALOGO.forEach(a => {
      map[a.key] = Boolean(cfg?.acciones[a.key]);
    });
    setPermisosMap(map);
    setCustomPermissionsEnabled(false);
  };

  const handleToggleTodosPermisos = (valor: boolean) => {
    setCustomPermissionsEnabled(true);
    const map: Record<string, boolean> = {};
    LISTA_ACCIONES_CATALOGO.forEach(a => {
      map[a.key] = valor;
    });
    setPermisosMap(map);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!nombre.trim()) {
      newErrors.nombre = "El nombre completo es obligatorio.";
    }
    if (email.trim() && !email.includes("@")) {
      newErrors.email = "Ingrese un correo electrónico válido o déjelo vacío para autogenerarlo.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Generar iniciales
    const partes = nombre.trim().split(" ").filter(Boolean);
    const iniciales = partes.slice(0, 2).map(p => p[0].toUpperCase()).join("") || "U";

    // Autogenerar correo institucional si se dejó en blanco
    const slug = nombre
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || "usuario";
    const emailFinal = email.trim() || `${slug}@planta-apit.pe`;

    // Generar lista de textos de permisos
    const permisosTexto: string[] = [];
    LISTA_ACCIONES_CATALOGO.forEach(a => {
      if (permisosMap[a.key]) {
        permisosTexto.push(a.label);
      }
    });

    const usuarioFinal: UserProfile = {
      id: usuarioAEditar?.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nombre: nombre.trim(),
      email: emailFinal,
      rol,
      cargo: cargo.trim() || undefined,
      departamento: departamento.trim() || undefined,
      telefono: telefono.trim() || undefined,
      nivelAcceso: nivelAcceso.trim() || undefined,
      avatarColor,
      iniciales,
      activo,
      pin: pin.trim() || (rol === "PROGRAMADOR" ? "2026" : "1234"),
      permisos: permisosTexto,
      permisosPersonalizados: customPermissionsEnabled ? permisosMap : undefined,
      fechaCreacion: usuarioAEditar?.fechaCreacion || new Date().toISOString().split("T")[0]
    };

    onSave(usuarioFinal);
    onClose();
  };

  if (!isOpen) return null;

  const totalHabilitados = Object.values(permisosMap).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md flex justify-center items-start sm:items-center">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col my-auto max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-base shadow-lg shrink-0`}>
              {nombre ? nombre.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("") : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {isEditing ? "Editar Perfil de Usuario" : "Crear Nuevo Usuario del Sistema"}
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-mono">
                  {rol}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing 
                  ? "Modifique los datos operativos, credenciales y permisos asignados." 
                  : "Complete los datos para dar de alta un nuevo miembro de planta y asignar permisos."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
          
          {/* Bloque 1: Identificación y Rol */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <User className="w-4 h-4 text-purple-400" />
              1. Datos Principales y Asignación de Rol
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Nombre Completo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (errors.nombre) setErrors(prev => ({ ...prev, nombre: "" }));
                  }}
                  placeholder="Ej: Ing. Jorge Ramírez Gómez"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                />
                {errors.nombre && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.nombre}
                  </p>
                )}
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico <span className="text-slate-500 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                    }}
                    placeholder="jorge.ramirez@arrozvapor.pe"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors font-mono text-xs"
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Selector de Rol */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Rol Oficial en Planta <span className="text-rose-400">*</span></span>
                  <span className="text-[11px] text-purple-300 font-mono">
                    Determina la matriz base de permisos
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ROLES_DISPONIBLES.map((item) => {
                    const isSelected = rol === item.rol;
                    const badge = obtenerBadgeRol(item.rol);
                    return (
                      <div
                        key={item.rol}
                        onClick={() => handleRoleChange(item.rol)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50 shadow-md"
                            : "bg-slate-950/60 hover:bg-slate-800/60 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase font-mono ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">
                          {item.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Bloque 2: Información Operativa y Contacto */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              2. Ubicación Operativa, Puesto y Contacto
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Cargo / Puesto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cargo o Puesto Específico
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ej: Operario de Autoclaves Turno Mañana"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              {/* Departamento / Área */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Área / Departamento / Turno
                </label>
                <input
                  type="text"
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  placeholder="Ej: Planta de Vaporizado - Turno A"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              {/* Teléfono / Anexo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Teléfono / Anexo de Planta
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+51 987 654 321 ó Anexo 204"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors font-mono text-xs"
                  />
                </div>
              </div>

              {/* Nivel de Acceso */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nivel de Acceso / Alcance
                </label>
                <input
                  type="text"
                  value={nivelAcceso}
                  onChange={(e) => setNivelAcceso(e.target.value)}
                  placeholder="Ej: Operaciones de Piso / Control Autoclaves"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>

              {/* PIN de Seguridad de Acceso */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    PIN de Acceso al Sistema
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">4-8 dígitos numéricos</span>
                </label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  maxLength={8}
                  className="w-full bg-slate-950 border border-slate-750 focus:border-amber-500 rounded-xl px-3 py-2 text-sm text-amber-300 placeholder-slate-500 outline-none transition-colors font-mono tracking-widest font-bold"
                />
              </div>

              {/* Paleta de Color de Avatar */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Color del Avatar
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PALETAS_AVATAR.map((pal, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarColor(pal.value)}
                      title={pal.label}
                      className={`w-7 h-7 rounded-lg bg-gradient-to-br ${pal.value} transition-transform ${
                        avatarColor === pal.value ? "ring-2 ring-white scale-110 shadow-lg" : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Estado del Usuario */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Estado de la Cuenta
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={(e) => setActivo(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <span className={`text-xs font-bold font-mono ${activo ? "text-emerald-400" : "text-rose-400"}`}>
                    {activo ? "Habilitado / Activo" : "Deshabilitado / Inactivo"}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Bloque 3: Configuración de Permisos (RBAC con Override) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                3. Permisos y Atribuciones Operativas ({totalHabilitados} de {LISTA_ACCIONES_CATALOGO.length})
              </h4>

              <div className="flex items-center gap-2">
                {customPermissionsEnabled && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Personalizado
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRestablecerPermisosRol}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer underline"
                >
                  Restablecer por Rol
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleTodosPermisos(true)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleTodosPermisos(false)}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Active o desactive permisos puntuales para este usuario. Si se desvía de la plantilla del rol, se guardará como perfil de permisos personalizado.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 border border-slate-800 rounded-xl bg-slate-950/40">
              {LISTA_ACCIONES_CATALOGO.map((accion) => {
                const isEnabled = Boolean(permisosMap[accion.key]);
                return (
                  <div
                    key={accion.key}
                    onClick={() => handleTogglePermiso(accion.key)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isEnabled
                        ? "bg-slate-850/90 border-emerald-500/40 hover:border-emerald-500/70"
                        : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isEnabled ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-800 border border-slate-700 text-transparent"
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white leading-tight truncate">
                          {accion.label}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                          {accion.modulo}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                        {accion.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Summary above Footer */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{Object.values(errors).filter(Boolean).join(" ")}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <Check className="w-4 h-4" />
              {isEditing ? "Actualizar Usuario" : "Crear y Guardar Usuario"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
