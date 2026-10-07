import { UserProfile, UserRole } from "../types";

export const USUARIOS_DEL_SISTEMA: UserProfile[] = [
  {
    id: "usr-fredy",
    nombre: "Ing. Fredy Granados Caicedo",
    email: "fredyleonardogranadoscaicedo@gmail.com",
    rol: "PROGRAMADOR",
    cargo: "Ingeniería de Procesos & Desarrollador Principal / Programador",
    departamento: "Ingeniería de Sistemas y Optimización Industrial (ItsyCreaciones)",
    avatarColor: "from-purple-600 to-indigo-700",
    iniciales: "FG",
    nivelAcceso: "Super Admin / Control Total / Configuración de Algoritmos IA & OCR",
    telefono: "+51 987 654 321",
    activo: true,
    pin: "2026",
    permisos: [
      "Control total del sistema y arquitectura de datos",
      "Configuración de parámetros matemáticos y ponderaciones de éxito",
      "Calibración de algoritmos de Visión IA y OCR de formatos",
      "Sincronización de base de datos y hojas de cálculo",
      "Auditoría integral de procesos y trazabilidad",
      "Administración y asignación de usuarios y roles"
    ]
  }
];

export const LOCAL_STORAGE_USERS_KEY = "anvap_users_v1";
export const LOCAL_STORAGE_USER_KEY = "anvap_active_user_v1";
export const LOCAL_STORAGE_AUTH_KEY = "anvap_auth_session_active_v1";

/**
 * Garantiza que la lista de usuarios sea válida, sin duplicados por ID,
 * y que siempre incluya el perfil maestro de Programador (usr-fredy).
 */
function normalizarListaUsuarios(lista: UserProfile[]): UserProfile[] {
  const masterProgramador = USUARIOS_DEL_SISTEMA[0];
  const map = new Map<string, UserProfile>();

  if (Array.isArray(lista)) {
    for (const u of lista) {
      if (!u || typeof u !== "object") continue;
      const id = (u.id || "").trim();
      const nombre = (u.nombre || "").trim();
      if (!id || !nombre) continue;

      if (id === "usr-fredy") {
        map.set("usr-fredy", {
          ...masterProgramador,
          ...u,
          id: "usr-fredy",
          rol: "PROGRAMADOR",
          pin: (u.pin || "2026").trim(),
          activo: true
        });
      } else {
        map.set(id, {
          ...u,
          id,
          nombre,
          email: (u.email || `${id}@planta-apit.pe`).trim(),
          rol: u.rol || "OPERARIO",
          pin: (u.pin || (u.rol === "PROGRAMADOR" ? "2026" : "1234")).trim(),
          activo: u.activo !== undefined ? u.activo : true
        });
      }
    }
  }

  if (!map.has("usr-fredy")) {
    map.set("usr-fredy", { ...masterProgramador });
  }

  return Array.from(map.values());
}

/**
 * Obtiene la lista completa de usuarios del sistema preservando todos los perfiles creados y editados.
 */
export function obtenerUsuariosSistema(): UserProfile[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalizados = normalizarListaUsuarios(parsed);
        return normalizados;
      }
    }

    // Fallback: verificar si existen usuarios en la base de datos local (arroz_apit_local_db_v4)
    const dbRaw = localStorage.getItem("arroz_apit_local_db_v4");
    if (dbRaw) {
      const dbParsed = JSON.parse(dbRaw);
      if (Array.isArray(dbParsed?.users) && dbParsed.users.length > 0) {
        const normalizados = normalizarListaUsuarios(dbParsed.users);
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(normalizados));
        return normalizados;
      }
    }
  } catch (e) {
    console.warn("Error leyendo usuarios locales:", e);
  }

  const initial = normalizarListaUsuarios(USUARIOS_DEL_SISTEMA);
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(initial));
  } catch {
    // ignore storage errors
  }
  return initial;
}

/**
 * Guarda la lista completa de usuarios en localStorage
 */
export function guardarUsuariosSistema(users: UserProfile[]): UserProfile[] {
  const normalizados = normalizarListaUsuarios(users);
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(normalizados));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("usuarios_sistema_updated", { detail: normalizados }));
    }
  } catch (e) {
    console.warn("Error guardando lista de usuarios:", e);
  }
  return normalizados;
}

/**
 * Crea o actualiza un usuario de forma atómica y retorna la lista completa actualizada
 */
export function guardarYActualizarUsuario(
  datos: Omit<UserProfile, "id"> & { id?: string },
  currentUsers?: UserProfile[]
): { usuario: UserProfile; lista: UserProfile[] } {
  const baseUsers = Array.isArray(currentUsers) && currentUsers.length > 0
    ? normalizarListaUsuarios([...obtenerUsuariosSistema(), ...currentUsers])
    : obtenerUsuariosSistema();

  const id = (datos.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`).trim();
  const nombreLimpio = (datos.nombre || "Usuario de Planta").trim();

  const iniciales = (datos.iniciales || nombreLimpio
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("") || "U").trim();

  const slug = nombreLimpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "") || id;

  const emailFinal = (datos.email || "").trim() || `${slug}@planta-apit.pe`;
  const pinFinal = (datos.pin || (datos.rol === "PROGRAMADOR" ? "2026" : "1234")).trim();

  const existingIndex = baseUsers.findIndex(u => u.id === id);
  let usuarioGuardado: UserProfile;
  let nuevaLista: UserProfile[];

  if (existingIndex !== -1) {
    usuarioGuardado = {
      ...baseUsers[existingIndex],
      ...datos,
      id,
      nombre: nombreLimpio,
      email: emailFinal,
      iniciales,
      pin: pinFinal,
      activo: datos.activo !== undefined ? datos.activo : baseUsers[existingIndex].activo ?? true
    };
    nuevaLista = baseUsers.map((u, idx) => (idx === existingIndex ? usuarioGuardado : u));
  } else {
    usuarioGuardado = {
      ...datos,
      id,
      nombre: nombreLimpio,
      email: emailFinal,
      iniciales,
      pin: pinFinal,
      activo: datos.activo !== undefined ? datos.activo : true,
      fechaCreacion: datos.fechaCreacion || new Date().toISOString().split("T")[0]
    };
    nuevaLista = [usuarioGuardado, ...baseUsers];
  }

  const listaNormalizada = guardarUsuariosSistema(nuevaLista);
  const finalUser = listaNormalizada.find(u => u.id === id) || usuarioGuardado;
  return { usuario: finalUser, lista: listaNormalizada };
}

/**
 * Crea un nuevo usuario y lo persiste en la lista
 */
export function crearUsuario(datos: Omit<UserProfile, "id"> & { id?: string }): UserProfile {
  return guardarYActualizarUsuario(datos).usuario;
}

/**
 * Actualiza los datos de un usuario existente
 */
export function actualizarUsuario(id: string, updates: Partial<UserProfile>): UserProfile[] {
  const users = obtenerUsuariosSistema();
  const existing = users.find(u => u.id === id);
  if (!existing) {
    return guardarYActualizarUsuario({ ...(updates as UserProfile), id }, users).lista;
  }
  const merged: UserProfile = {
    ...existing,
    ...updates,
    id
  };
  if (updates.nombre && !updates.iniciales) {
    merged.iniciales = updates.nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join("");
  }
  return guardarYActualizarUsuario(merged, users).lista;
}

/**
 * Elimina un usuario del sistema (excepto el usuario activo actual o superadmin principal)
 */
export function eliminarUsuario(id: string): UserProfile[] {
  const users = obtenerUsuariosSistema();
  // Proteger al programador principal
  if (id === "usr-fredy") {
    throw new Error("No es posible eliminar el perfil de Ingeniería Principal (Fredy Granados).");
  }

  const actualizada = users.filter(u => u.id !== id);
  return guardarUsuariosSistema(actualizada);
}

/**
 * Restablece los usuarios a la lista oficial por defecto
 */
export function restablecerUsuariosPorDefecto(): UserProfile[] {
  const defaults = normalizarListaUsuarios(USUARIOS_DEL_SISTEMA);
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(defaults));
  } catch (e) {
    console.warn("Error restableciendo usuarios:", e);
  }
  return defaults;
}

/**
 * Verifica si hay una sesión activa autenticada
 */
export function haySesionIniciada(): boolean {
  try {
    const isAuth = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
    const userRaw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    return isAuth === "true" && !!userRaw;
  } catch (e) {
    return false;
  }
}

/**
 * Valida el PIN de un usuario
 */
export function validarPinUsuario(user: UserProfile, pinIngresado: string): boolean {
  const pinLimpio = (pinIngresado || "").trim();
  if (!pinLimpio) return false;

  // PIN configurado en el usuario
  if (user.pin && user.pin.trim() === pinLimpio) {
    return true;
  }

  // Fallbacks de seguridad industrial conocidos
  if ((user.id === "usr-fredy" || user.rol === "PROGRAMADOR") && (pinLimpio === "2026" || pinLimpio === "admin2026")) {
    return true;
  }
  if (user.id !== "usr-fredy" && (pinLimpio === "1234" || pinLimpio === "0000")) {
    return true;
  }

  return false;
}

/**
 * Inicia la sesión autenticada de un usuario
 */
export function iniciarSesionUsuario(user: UserProfile): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, "true");
  } catch (e) {
    console.warn("Error iniciando sesión:", e);
  }
}

/**
 * Cierra la sesión activa del sistema (bloquea la pantalla para el siguiente usuario)
 */
export function cerrarSesionUsuario(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  } catch (e) {
    console.warn("Error cerrando sesión:", e);
  }
}

/**
 * Obtiene el usuario activo guardado si la sesión está autenticada
 */
export function obtenerUsuarioActivoGuardado(): UserProfile | null {
  try {
    if (!haySesionIniciada()) return null;
    const raw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        const allUsers = obtenerUsuariosSistema();
        const found = allUsers.find(u => u.id === parsed.id);
        if (found) return { ...found, ...parsed };
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error recuperando usuario activo guardado:", e);
  }
  return null;
}

/**
 * Obtiene el usuario activo inicial
 */
export function obtenerUsuarioActivoInicial(): UserProfile {
  const allUsers = obtenerUsuariosSistema();
  const masterProgramador = allUsers.find(u => u.id === "usr-fredy") || USUARIOS_DEL_SISTEMA[0];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) {
        const found = allUsers.find(u => u.id === parsed.id);
        if (found) return { ...found, ...parsed };
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error recuperando usuario activo:", e);
  }
  return masterProgramador;
}

/**
 * Guarda el usuario activo en localStorage
 */
export function guardarUsuarioActivo(user: UserProfile): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("Error guardando usuario activo:", e);
  }
}

/**
 * Retorna metadatos visuales de acuerdo al rol
 */
export function obtenerBadgeRol(rol: UserRole): {
  label: string;
  badgeClass: string;
  bgGradient: string;
  iconName: string;
  borderClass: string;
} {
  switch (rol) {
    case "PROGRAMADOR":
    case "INGENIERO_PROGRAMADOR":
    case "ADMINISTRADOR":
    case "ADMIN":
      return {
        label: "Ingeniería / Programador",
        badgeClass: "bg-purple-900/70 text-purple-200 border-purple-600/60",
        bgGradient: "from-purple-600 to-indigo-700",
        iconName: "Code2",
        borderClass: "border-purple-500/50"
      };
    case "JEFE_VAPORIZADO":
    case "JEFE_PLANTA":
      return {
        label: "Jefe de Vaporizado",
        badgeClass: "bg-amber-900/70 text-amber-200 border-amber-600/60",
        bgGradient: "from-amber-600 to-orange-700",
        iconName: "Flame",
        borderClass: "border-amber-500/50"
      };
    case "SUPERVISOR":
      return {
        label: "Supervisor de Vaporizado",
        badgeClass: "bg-blue-900/70 text-blue-200 border-blue-600/60",
        bgGradient: "from-blue-600 to-cyan-700",
        iconName: "ShieldCheck",
        borderClass: "border-blue-500/50"
      };
    case "ANALISTA_CALIDAD":
    case "CONTROL_CALIDAD":
    case "CALIDAD":
      return {
        label: "Analista de Calidad",
        badgeClass: "bg-emerald-900/70 text-emerald-200 border-emerald-600/60",
        bgGradient: "from-emerald-600 to-teal-700",
        iconName: "Microscope",
        borderClass: "border-emerald-500/50"
      };
    case "OPERARIO":
    case "OPERADOR":
      return {
        label: "Operario de Vaporizado",
        badgeClass: "bg-amber-950/80 text-amber-300 border-amber-700/60",
        bgGradient: "from-amber-700 to-yellow-800",
        iconName: "Gauge",
        borderClass: "border-amber-600/50"
      };
    case "GERENCIA":
      return {
        label: "Gerencia General",
        badgeClass: "bg-indigo-900/70 text-indigo-200 border-indigo-600/60",
        bgGradient: "from-indigo-600 to-blue-800",
        iconName: "Briefcase",
        borderClass: "border-indigo-500/50"
      };
    case "AUDITOR":
      return {
        label: "Auditor de Calidad",
        badgeClass: "bg-slate-800 text-slate-200 border-slate-600",
        bgGradient: "from-slate-700 to-slate-800",
        iconName: "CheckSquare",
        borderClass: "border-slate-500/50"
      };
    default:
      return {
        label: rol,
        badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
        bgGradient: "from-slate-700 to-slate-800",
        iconName: "User",
        borderClass: "border-slate-700"
      };
  }
}
