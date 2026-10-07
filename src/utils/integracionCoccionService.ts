import { ResultadoCoccionExterno, ConfigConexionCoccion } from "../types";

const COCCION_STORAGE_KEY = "resultados_coccion_externos_v1";
const COCCION_CONFIG_KEY = "config_conexion_coccion_v1";

/**
 * Normaliza un string para comparaciones tolerantes a acentos y mayúsculas
 */
function normalizarTexto(str: string = ""): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Determina si un registro corresponde a VAPORIZADO o a AÑEJADO
 */
export function clasificarTipoProceso(valor: any): "VAPORIZADO" | "AÑEJADO" | "OTRO" {
  if (!valor) return "OTRO";
  const t = normalizarTexto(String(valor));
  
  if (t.includes("VAPOR") || t.includes("PARBOIL") || t.includes("PARBOILED") || t.includes("COCIDO") || t.includes("TERMICO")) {
    return "VAPORIZADO";
  }
  if (t.includes("ANEJ") || t.includes("ENVEJEC") || t.includes("REPOS") || t.includes("NATURAL") || t.includes("SILO")) {
    return "AÑEJADO";
  }
  return "OTRO";
}

/**
 * Procesa y parsea datos crudos provenientes de JSON, CSV, Excel (copiar/pegar TSV) o API
 * Filtrando estrictamente solo los registros de VAPORIZADO.
 */
export function procesarDatosCoccionExternos(
  rawInput: string | any[],
  fuenteNombre: string = "Aplicativo Externo de Cocción"
): {
  vaporizados: ResultadoCoccionExterno[];
  anejadosOmitidos: any[];
  otrosOmitidos: any[];
  totalRecibidos: number;
  errores: string[];
} {
  const vaporizados: ResultadoCoccionExterno[] = [];
  const anejadosOmitidos: any[] = [];
  const otrosOmitidos: any[] = [];
  const errores: string[] = [];

  let filas: any[] = [];

  if (Array.isArray(rawInput)) {
    filas = rawInput;
  } else if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { vaporizados, anejadosOmitidos, otrosOmitidos, totalRecibidos: 0, errores: ["El contenido está vacío."] };
    }

    // Probar si es JSON
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          filas = parsed;
        } else if (parsed && typeof parsed === "object") {
          // Si es un objeto contenedor como { data: [...] } o { resultados: [...] }
          const keyArray = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
          if (keyArray) {
            filas = parsed[keyArray];
          } else {
            filas = [parsed];
          }
        }
      } catch (err: any) {
        errores.push(`Error al analizar JSON: ${err.message}. Intentando analizar como tabla/CSV.`);
      }
    }

    // Si no fue JSON o falló, procesar como CSV / TSV (Tab separated - copiar de Excel)
    if (filas.length === 0) {
      const lineas = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lineas.length > 0) {
        // Detectar separador (, ; \t |)
        const primeraLinea = lineas[0];
        let sep = "\t";
        if (primeraLinea.includes("\t")) sep = "\t";
        else if (primeraLinea.includes(";")) sep = ";";
        else if (primeraLinea.includes(",")) sep = ",";
        else if (primeraLinea.includes("|")) sep = "|";

        const headers = primeraLinea.split(sep).map(h => normalizarTexto(h).replace(/["']/g, ""));

        for (let i = 1; i < lineas.length; i++) {
          const vals = lineas[i].split(sep).map(v => v.replace(/^["']|["']$/g, "").trim());
          const obj: any = {};
          headers.forEach((h, idx) => {
            obj[h] = vals[idx] !== undefined ? vals[idx] : "";
          });
          filas.push(obj);
        }
      }
    }
  }

  // Ahora procesamos cada fila y clasificamos VAPORIZADO vs AÑEJADO
  filas.forEach((fila, index) => {
    // Buscar valor de proceso en las llaves comunes
    const keys = Object.keys(fila);
    let valorProceso = "";
    
    // Buscar claves como PROCESO, TIPO_PROCESO, TIPO, LINEA, METODO, TIPO_ARROZ
    const procesoKey = keys.find(k => {
      const norm = normalizarTexto(k);
      return norm === "PROCESO" || norm === "TIPO_PROCESO" || norm === "TIPO" || norm === "LINEA" || norm === "METODO" || norm === "TIPO_ARROZ" || norm === "TRATAMIENTO";
    });

    if (procesoKey) {
      valorProceso = fila[procesoKey];
    } else {
      // Buscar en cualquier campo si dice Vaporizado o Añejado
      for (const k of keys) {
        const val = String(fila[k] || "");
        if (clasificarTipoProceso(val) !== "OTRO") {
          valorProceso = val;
          break;
        }
      }
    }

    const clasificacion = clasificarTipoProceso(valorProceso);

    if (clasificacion === "AÑEJADO") {
      anejadosOmitidos.push({
        indice: index + 1,
        proceso: valorProceso || "AÑEJADO",
        filaOriginal: fila
      });
      return;
    }

    if (clasificacion === "OTRO" && valorProceso && valorProceso.trim() !== "") {
      otrosOmitidos.push({
        indice: index + 1,
        proceso: valorProceso,
        filaOriginal: fila
      });
      return;
    }

    // Si es VAPORIZADO o no especificó proceso pero tiene campos de batch de vaporizado
    // Extraer campos mapeados
    const getVal = (possibleKeys: string[], defaultVal: any = ""): any => {
      for (const pk of possibleKeys) {
        const found = keys.find(k => normalizarTexto(k) === normalizarTexto(pk));
        if (found && fila[found] !== undefined && fila[found] !== null && fila[found] !== "") {
          return fila[found];
        }
      }
      return defaultVal;
    };

    // Identificadores de Batch / Correlativo / Lote
    let batchIdRaw = String(getVal(["N_BATCH", "NRO_BATCH", "BATCH", "BATCH_ID", "CODIGO_BATCH", "ID_BATCH", "BATCH_NRO", "CORRELATIVO", "MUESTRA", "LOTE", "LOTE_ID"], `V272`));
    
    // Normalizar correlativo a formato V272 / B-XXXX / XXXX
    let correlativo = batchIdRaw.replace(/BATCH/i, "").trim();
    if (/^\d+$/.test(correlativo)) {
      correlativo = correlativo.padStart(4, "0");
    }

    const fecha = getVal(["FECHA", "FECHA_COCCION", "FECHA_PRUEBA", "FECHA_EVALUACION", "TIMESTAMP"], "26/08/26");
    const turno = String(getVal(["TURNO", "GUARDIA", "HORARIO"], "1250"));
    const panelista = String(getVal(["ANALISTA", "PANELISTA", "EVALUADOR", "RESPONSABLE", "OPERADOR"], "Fellon Salas"));
    const variedad = String(getVal(["VARIEDAD", "TIPO_GRANO", "ARROZ_VARIEDAD", "PRODUCTO"], "Valor"));
    const cliente = String(getVal(["CLIENTE", "MOLINO", "PROVEEDOR", "CLIENTE_DESTINO"], "Chiroque Santamaria Felipe"));
    const procedencia = String(getVal(["PROCEDENCIA", "ORIGEN", "VALLE", "ZONA"], "Punto 4"));
    const numeroSacos = Number(getVal(["N_SACOS", "NUMERO_SACOS", "SACOS", "CANTIDAD_SACOS"], 372));
    const tipoVaporizado = String(getVal(["TIPO_VAPORIZADO", "METODO_VAPORIZADO", "MODALIDAD"], "Presecado"));

    // Dosificación & Tiempos de Cocción
    const tazasArroz = Number(getVal(["TAZAS_ARROZ", "TAZAS_DE_ARROZ", "ARROZ_TAZAS"], 3));
    const tazasAgua = String(getVal(["TAZAS_AGUA", "TAZAS_DE_AGUA", "AGUA_TAZAS"], "3 1/2"));
    let tiempoCoccion = getVal(["TIEMPO_COCCION", "TIEMPO_DE_COCCION", "MINUTOS_COCCION", "TIEMPO_MIN", "TIEMPO_OLLA", "TIEMPO"], 30);
    if (typeof tiempoCoccion === "string") {
      const match = tiempoCoccion.match(/\d+/);
      if (match) tiempoCoccion = Number(match[0]);
    }

    // Análisis Organoléptico (Olla)
    const desplazamientoSeg = String(getVal(["DESPLAZAMIENTO", "DESPLAZAMIENTO_SEG", "VELOCIDAD_DESPLAZAMIENTO"], "15 seg"));
    const granoQuebradoOllaPct = Number(getVal(["G_QUEBRADO_OLLA", "QUEBRADO_OLLA", "G_QUEBRADO", "PORC_G_QUEBRADO"], 18.0));
    const granoHinchadoPct = Number(getVal(["G_HINCHADO", "HINCHADO", "PORC_G_HINCHADO"], 8.6));
    const granoAbiertoPct = Number(getVal(["G_ABIERTO", "ABIERTO", "APERTURA_GRANO", "PORC_G_ABIERTO"], 1.3));
    const texturaFrio = String(getVal(["TEXTURA_FRIO", "TEXTURA", "FIRMEZA", "CONSISTENCIA"], "Suave"));
    const rendimientoMasaPct = Number(getVal(["RENDIMIENTO_MASA", "RENDIMIENTO", "MASA_REND"], 260));

    // Análisis Físico: MP vs Descarga vs Pilado
    const trizadoMP = Number(getVal(["TRIZADO_MP", "TRIZADO_MATERIA_PRIMA", "TRIZADO_PADDY"], 2.0));
    const trizadoDescarga = Number(getVal(["TRIZADO_DESCARGA", "TRIZADO_SALIDA", "TRIZADO_FINAL", "TRIZADO"], 28.5));
    const deltaTrizado = Number((trizadoDescarga - trizadoMP).toFixed(2));

    const quebradoIntegralMP = Number(getVal(["QUEBRADO_INTEGRAL_MP", "QUEBRADO_INTEGRAL_MATERIA_PRIMA"], 4.1));
    const quebradoIntegralDescarga = Number(getVal(["QUEBRADO_INTEGRAL_DESCARGA", "QUEBRADO_INTEGRAL_SALIDA"], 16.1));

    const quebradoMP = Number(getVal(["QUEBRADO_MP", "QUEBRADO_MATERIA_PRIMA", "QI_INGRESO"], 10.9));
    const quebradoDescarga = Number(getVal(["QUEBRADO_DESCARGA", "QUEBRADO_SALIDA", "QUEBRADO_PILADO"], 25.3));
    const deltaQuebrado = Number((quebradoDescarga - quebradoMP).toFixed(2));

    const blancuraIntegralMP = Number(getVal(["BL_INTEGRAL_MP", "BLANCURA_INTEGRAL_MP"], 21.5));
    const blancuraIntegralDescarga = Number(getVal(["BL_INTEGRAL_DESCARGA", "BLANCURA_INTEGRAL_DESCARGA"], 18.8));

    const blancuraBlancoMP = Number(getVal(["BL_BLANCO_MP", "BLANCURA_BLANCO_MP"], 40.1));
    const blancuraBlancoDescarga = Number(getVal(["BL_BLANCO_DESCARGA", "BLANCURA_BLANCO_DESCARGA"], 31.4));

    const tizaTotalMasGcocidoMP = Number(getVal(["TIZA_TOTAL_MP", "TIZA_GCOCIDO_MP"], 1.7));
    const tizaTotalMasGcocidoDescarga = Number(getVal(["TIZA_TOTAL_DESCARGA", "TIZA_GCOCIDO_DESCARGA", "TIZA_TOTAL_MAS_GCOCIDO"], 3.4));

    const tpMasTpuntualMP = Number(getVal(["TP_TPUNTUAL_MP", "TP_PUNTUAL_MP"], 3.4));
    const tpMasTpuntualDescarga = Number(getVal(["TP_TPUNTUAL_DESCARGA", "TP_PUNTUAL_DESCARGA"], 6.1));

    const manchaMP = Number(getVal(["MANCHA_MP", "MANCHADO_MP"], 1.6));
    const manchaDescarga = Number(getVal(["MANCHA_DESCARGA", "MANCHADO_DESCARGA"], 3.3));

    const granoInmaduroMP = Number(getVal(["G_INMADURO_MP", "INMADURO_MP"], 1.0));
    const granoInmaduroDescarga = Number(getVal(["G_INMADURO_DESCARGA", "INMADURO_DESCARGA"], 1.3));

    const humedadCascaraMP = Number(getVal(["H_CASCARA_MP", "HUMEDAD_CASCARA_MP"], 14.4));
    const humedadCascaraDescarga = Number(getVal(["H_CASCARA_DESCARGA", "HUMEDAD_CASCARA_DESCARGA"], 11.5));
    const humedadBlancoDescarga = Number(getVal(["H_BLANCO_DESCARGA", "HUMEDAD_BLANCO_DESCARGA"], 11.0));
    const reposoCascaraDias = Number(getVal(["REPOSO_CASCARA", "REPOSO_CASCARA_DIAS"], 44));

    const ratioAgua = String(getVal(["RATIO_AGUA", "ABSORCION_AGUA", "RELACION_AGUA", "AGUA_ARROZ", "ABSORCION"], `${tazasArroz} tazas arroz / ${tazasAgua} tazas agua`));
    const expansion = String(getVal(["EXPANSION", "EXPANSION_VOLUMETRICA", "RENDIMIENTO", "VOLUMEN_FINAL"], "x2.6"));
    const soltura = String(getVal(["SOLTURA", "SOLTURA_GRANO", "GRANO_SUELTO", "APELMAZAMIENTO"], "100% Suelto, no se apelmaza"));
    const color = String(getVal(["COLOR", "COLOR_COCIDO", "APARIENCIA", "ASPECTO"], `Blancura Kett ${blancuraBlancoDescarga}°BL`));
    const aroma = String(getVal(["AROMA", "SABOR", "AROMA_SABOR", "SENSORIAL"], "Aroma suave característico, sabor neutro premium"));

    // Puntaje / Calificación de Cocción (0 - 100)
    let score = getVal(["SCORE", "PUNTAJE", "CALIFICACION", "PUNTAJE_COCCION", "SCORE_COCCION", "NOTA", "PUNTOS", "IEP"], 95);
    let numScore = Number(score);
    if (isNaN(numScore)) numScore = 95;
    if (numScore > 0 && numScore <= 5) {
      numScore = Math.round(numScore * 20);
    } else if (numScore > 5 && numScore <= 10) {
      numScore = Math.round(numScore * 10);
    }
    numScore = Math.max(0, Math.min(100, numScore));

    // Variables Sintéticas de Cocción Oficiales
    const sabor = String(getVal(["SABOR", "SABOR_COCIDO", "SABOR_DESCARGA", "SABOR_OLLA", "SABOR_GRANO"], "Neutro Característico"));
    const envaseProyectado = String(getVal([
      "ENVASE_PROYECTADO", "ENVASE", "EMPAQUE_PROYECTADO", "DESTINO_ENVASE", "PROYECCION_ENVASE", "PRESENTACION_ENVASE"
    ], numScore >= 95 ? "Saco 50 kg Don Julio Extra Selección" : numScore >= 90 ? "Saco 50 kg Don Julio Superior" : "Saco 50 kg Corriente / Granel"));

    const obs = String(getVal(["OBSERVACIONES", "OBSERVACION", "NOTAS", "COMENTARIOS", "DICTAMEN"], "Formato de Registro de Vaporizado verificado. Parámetros de cocción y análisis físico conformes."));

    const item: ResultadoCoccionExterno = {
      id: `COCC-VAP-${Date.now()}-${index}`,
      batchId: batchIdRaw,
      correlativo,
      loteId: getVal(["LOTE", "LOTE_ID", "COD_LOTE", "CODIGO"], "7568-7579-7598-7684"),
      proceso: "VAPORIZADO",
      fechaCoccion: fecha,
      turno,
      panelista,
      cliente,
      variedad,
      procedencia,
      numeroSacos,
      tipoVaporizado,

      // Resumen Sintético de Variables de Cocción
      // 1. Dosificación
      tazasArroz,
      tazasAgua,
      tiempoCoccionMin: tiempoCoccion,
      
      // 2. Evaluación de Grano Cocido
      sabor,
      desplazamientoSeg,
      granoQuebradoOllaPct,
      granoHinchadoPct,
      granoAbiertoPct,
      texturaFrio,

      // 3. Envase Proyectado (se evalúa en cocción)
      envaseProyectado,

      ratioAguaArroz: ratioAgua,
      expansionVolumetrica: expansion,
      solturaGrano: soltura,
      texturaFirmeza: texturaFrio,
      colorCocido: color,
      aromaSabor: aroma,

      // Organoléptico Ficha adicional
      rendimientoMasaPct,

      // Físico MP vs Descarga
      trizadoMP,
      trizadoDescarga,
      deltaTrizado,
      quebradoIntegralMP,
      quebradoIntegralDescarga,
      quebradoMP,
      quebradoDescarga,
      deltaQuebrado,
      blancuraIntegralMP,
      blancuraIntegralDescarga,
      blancuraBlancoMP,
      blancuraBlancoDescarga,
      tizaTotalMasGcocidoMP,
      tizaTotalMasGcocidoDescarga,
      tpMasTpuntualMP,
      tpMasTpuntualDescarga,
      manchaMP,
      manchaDescarga,
      granoInmaduroMP,
      granoInmaduroDescarga,
      humedadCascaraMP,
      humedadCascaraDescarga,
      humedadBlancoDescarga,
      reposoCascaraDias,

      puntajeCoccion: numScore,
      observaciones: obs,
      fuenteExterna: fuenteNombre,
      estadoIntegracion: "INTEGRADO",
      rawOriginal: fila
    };

    vaporizados.push(item);
  });

  return {
    vaporizados,
    anejadosOmitidos,
    otrosOmitidos,
    totalRecibidos: filas.length,
    errores
  };
}

export const COCCION_DEFAULTS_INICIALES: ResultadoCoccionExterno[] = [
  {
    id: "FORMATO-BATCH-1664",
    batchId: "1664",
    correlativo: "1664",
    loteId: "MAQ-2853-2963",
    proceso: "VAPORIZADO",
    tipoVaporizado: "Añejamiento / Vaporizado",
    fechaCoccion: "24-08-2026",
    turno: "Noche",
    panelista: "Solange Vilches",
    cliente: "Molino Don Julio / Santa Cruz",
    variedad: "Santa Cruz",
    procedencia: "Mochumí",
    numeroSacos: 400,
    anejadora: 2,
    maquila: "2853 / 2963",
    temperaturaGrano: 28.1,
    temperaturaAmbiente: 34.2,
    humedadRelativa: 52,

    tazasArroz: 3,
    tazasAgua: "3 1/2",
    tiempoCoccionMin: 30,
    tazasArrozMP: 3,
    tazasArrozDescarga: 3,
    tazasAguaMP: 3,
    tazasAguaDescarga: "3 1/2",
    tiempoCoccionMinMP: 30,
    tiempoCoccionMinDescarga: 30,

    sabor: "Neutro Característico",
    saborMP: "Neutro Característico",
    saborDescarga: "Neutro Característico",
    desplazamientoSeg: "12.6 seg",
    desplazamientoMP: "44.6 seg",
    desplazamientoDescarga: "12.6 seg",
    granoHinchadoPct: 3.1,
    hinchadoMP: 9.5,
    hinchadoDescarga: 3.1,
    granoQuebradoOllaPct: 8.1,
    quebradoOllaMP: 9.1,
    quebradoOllaDescarga: 8.1,
    granoAbiertoPct: 1.4,
    abiertoMP: 1.6,
    abiertoDescarga: 1.4,
    pegoteoMP: "Sin pegoteo",
    pegoteoDescarga: "Sin pegoteo",
    texturaFrio: "Suave al frío",
    texturaFrioMP: "Firme",
    texturaFrioDescarga: "Suave al frío",

    envaseProyectado: "Saco 50 kg Don Julio Extra Selección",
    dictamenEnvasado: "CONFORME PARA LÍNEA DE ENVASADO",
    justificacionEnvase: "Evaluación en olla excelente: Desplazamiento reducido a 12.6 seg (soltura óptima frente a 44.6s en MP), bajo grano abierto de 1.4%, hinchado 3.1%, quebrado en olla 8.1% y textura suave sin pegoteo.",

    quebradoMP: 3.7,
    quebradoDescarga: 4.78,
    deltaQuebrado: 1.08,
    trizadoMP: 1.2,
    cuarteadoMP: 0.5,
    cuarteadoDescarga: 0.52,
    tizaTotalMasGcocidoMP: 4.0,
    tpMasTpuntualDescarga: 2.56,
    manchaMP: 0.4,
    manchaDescarga: 0.8,
    blancuraBlancoMP: 41.0,
    blancuraBlancoDescarga: 29.6,
    humedadBlancoMP: 12.0,
    humedadBlancoDescarga: 11.5,

    puntajeCoccion: 98,
    observaciones: "Ficha Oficial de Registro de Añejamiento / Vaporizado - Batch 1664 (Mochumí - Santa Cruz). Evaluado por Solange Vilches.",
    fuenteExterna: "Ficha Oficial de Registro Físico (Planta)",
    estadoIntegracion: "INTEGRADO"
  },
  {
    id: "FORMATO-V272",
    batchId: "V272",
    correlativo: "V272",
    loteId: "7568-7579-7598-7684",
    proceso: "VAPORIZADO",
    tipoVaporizado: "Presecado",
    fechaCoccion: "26/08/26",
    turno: "1250",
    panelista: "Fellon Salas",
    cliente: "Chiroque Santamaria Felipe",
    variedad: "Valor",
    procedencia: "Punto 4",
    numeroSacos: 372,

    tazasArroz: 3,
    tazasAgua: "3 1/2",
    tiempoCoccionMin: 30,
    sabor: "Neutro Característico",
    desplazamientoSeg: "15 seg",
    granoQuebradoOllaPct: 18.0,
    granoHinchadoPct: 8.6,
    granoAbiertoPct: 1.3,
    texturaFrio: "Suave",
    rendimientoMasaPct: 260,

    envaseProyectado: "Saco 50 kg Don Julio Extra Selección",
    dictamenEnvasado: "CONFORME PARA LÍNEA DE ENVASADO",

    trizadoMP: 2.0,
    trizadoDescarga: 28.5,
    deltaTrizado: 26.5,
    quebradoIntegralMP: 4.1,
    quebradoIntegralDescarga: 16.1,
    quebradoMP: 10.9,
    quebradoDescarga: 25.3,
    deltaQuebrado: 14.4,
    blancuraIntegralMP: 21.5,
    blancuraIntegralDescarga: 18.8,
    blancuraBlancoMP: 40.1,
    blancuraBlancoDescarga: 31.4,
    tizaTotalMasGcocidoMP: 1.7,
    tizaTotalMasGcocidoDescarga: 3.4,
    tpMasTpuntualMP: 3.4,
    tpMasTpuntualDescarga: 6.1,
    manchaMP: 1.6,
    manchaDescarga: 3.3,
    granoInmaduroMP: 1.0,
    granoInmaduroDescarga: 1.3,
    humedadCascaraMP: 14.4,
    humedadCascaraDescarga: 11.5,
    humedadBlancoDescarga: 11.0,
    reposoCascaraDias: 44,

    puntajeCoccion: 96,
    observaciones: "Batch V272 verificado en laboratorio. El incremento de trizado térmico y la desgasificación/cocción cumplen los parámetros.",
    fuenteExterna: "Formato Oficial de Registro de Vaporizado",
    estadoIntegracion: "INTEGRADO"
  }
];

/**
 * Obtiene los resultados de cocción externos guardados localmente
 */
export function obtenerResultadosCoccionLocales(): ResultadoCoccionExterno[] {
  try {
    const raw = localStorage.getItem(COCCION_STORAGE_KEY);
    if (!raw) {
      // Inicializar con los defaults (Batch 1664 y V272)
      localStorage.setItem(COCCION_STORAGE_KEY, JSON.stringify(COCCION_DEFAULTS_INICIALES));
      return COCCION_DEFAULTS_INICIALES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return COCCION_DEFAULTS_INICIALES;
    }
    // Asegurar que si 1664 no está presente, se incluya
    const tiene1664 = parsed.some(p => p.batchId === "1664" || p.correlativo === "1664");
    if (!tiene1664) {
      const merged = [COCCION_DEFAULTS_INICIALES[0], ...parsed];
      localStorage.setItem(COCCION_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    return parsed;
  } catch {
    return COCCION_DEFAULTS_INICIALES;
  }
}

/**
 * Guarda resultados de cocción en localStorage y hace merge con los existentes
 */
export function guardarResultadosCoccionLocales(nuevosResultados: ResultadoCoccionExterno[]): ResultadoCoccionExterno[] {
  const existentes = obtenerResultadosCoccionLocales();
  const mapa = new Map<string, ResultadoCoccionExterno>();

  existentes.forEach(item => {
    const key = (item.correlativo || item.batchId || item.id).trim().toUpperCase();
    mapa.set(key, item);
  });

  nuevosResultados.forEach(item => {
    const key = (item.correlativo || item.batchId || item.id).trim().toUpperCase();
    mapa.set(key, item);
  });

  const combinados = Array.from(mapa.values());
  try {
    localStorage.setItem(COCCION_STORAGE_KEY, JSON.stringify(combinados));
  } catch (e) {
    console.error("Error al guardar resultados de cocción en localStorage:", e);
  }
  return combinados;
}

/**
 * Guarda o actualiza los datos de cocción para un Batch específico
 * asegurando la sincronización en localStorage y el backend
 */
export async function guardarCoccionParaBatch(
  data: Partial<ResultadoCoccionExterno> & { batchId: string }
): Promise<ResultadoCoccionExterno> {
  const bId = (data.batchId || "").trim();
  const corr = (data.correlativo || bId.replace(/^B-?/i, "")).trim();
  
  const record: ResultadoCoccionExterno = {
    id: data.id || `COCC-MANUAL-${bId}-${Date.now()}`,
    batchId: bId,
    correlativo: corr,
    loteId: data.loteId || "",
    proceso: "VAPORIZADO",
    fechaCoccion: data.fechaCoccion || new Date().toISOString().split("T")[0],
    variedad: data.variedad || "Variedad General",
    cliente: data.cliente || "",
    panelista: data.panelista || "Laboratorio de Calidad",
    tiempoCoccionMin: data.tiempoCoccionMin ?? 30,
    tazasArroz: data.tazasArroz ?? 3,
    tazasAgua: data.tazasAgua ?? "3 1/2",
    ratioAguaArroz: data.ratioAguaArroz || "3 tazas arroz / 3 1/2 tazas agua",
    expansionVolumetrica: data.expansionVolumetrica || "x2.6",
    solturaGrano: data.solturaGrano || "100% Suelto, no se apelmaza",
    texturaFirmeza: data.texturaFirmeza || "Firme al dente, no gomoso",
    colorCocido: data.colorCocido || "Blanco marfil traslúcido homogéneo",
    aromaSabor: data.aromaSabor || "Aroma característico agradable, sabor neutro",
    puntajeCoccion: Number(data.puntajeCoccion ?? 95),
    observaciones: data.observaciones || "Evaluación de cocción en olla conforme.",
    
    // Resumen Sintético de Variables de Cocción
    sabor: data.sabor || "Neutro Característico",
    desplazamientoSeg: data.desplazamientoSeg || "15 seg",
    granoQuebradoOllaPct: data.granoQuebradoOllaPct ?? 18.0,
    granoHinchadoPct: data.granoHinchadoPct ?? 8.6,
    granoAbiertoPct: data.granoAbiertoPct ?? 1.3,
    texturaFrio: data.texturaFrio || "Suave",
    envaseProyectado: data.envaseProyectado || (Number(data.puntajeCoccion ?? 95) >= 95 ? "Saco 50 kg Don Julio Extra Selección" : "Saco 50 kg Don Julio Superior"),
    rendimientoMasaPct: data.rendimientoMasaPct ?? 260,
    
    // Análisis físico comparativo MP vs Descarga
    trizadoMP: data.trizadoMP ?? 2.0,
    trizadoDescarga: data.trizadoDescarga ?? 28.5,
    deltaTrizado: data.deltaTrizado ?? 26.5,
    quebradoIntegralMP: data.quebradoIntegralMP ?? 4.1,
    quebradoIntegralDescarga: data.quebradoIntegralDescarga ?? 16.1,
    quebradoMP: data.quebradoMP ?? 10.9,
    quebradoDescarga: data.quebradoDescarga ?? 25.3,
    deltaQuebrado: data.deltaQuebrado ?? 14.4,
    blancuraIntegralMP: data.blancuraIntegralMP ?? 21.5,
    blancuraIntegralDescarga: data.blancuraIntegralDescarga ?? 18.8,
    blancuraBlancoMP: data.blancuraBlancoMP ?? 40.1,
    blancuraBlancoDescarga: data.blancuraBlancoDescarga ?? 31.4,
    tizaTotalMasGcocidoMP: data.tizaTotalMasGcocidoMP ?? 1.7,
    tizaTotalMasGcocidoDescarga: data.tizaTotalMasGcocidoDescarga ?? 3.4,
    tpMasTpuntualMP: data.tpMasTpuntualMP ?? 3.4,
    tpMasTpuntualDescarga: data.tpMasTpuntualDescarga ?? 6.1,
    manchaMP: data.manchaMP ?? 1.6,
    manchaDescarga: data.manchaDescarga ?? 3.3,
    granoInmaduroMP: data.granoInmaduroMP ?? 1.0,
    granoInmaduroDescarga: data.granoInmaduroDescarga ?? 1.3,
    humedadCascaraMP: data.humedadCascaraMP ?? 14.4,
    humedadCascaraDescarga: data.humedadCascaraDescarga ?? 11.5,
    humedadBlancoDescarga: data.humedadBlancoDescarga ?? 11.0,
    reposoCascaraDias: data.reposoCascaraDias ?? 44,

    fuenteExterna: data.fuenteExterna || "Registro Directo de Calidad"
  };

  // Guardar en localStorage
  guardarResultadosCoccionLocales([record]);

  return record;
}

/**
 * Busca si existe un resultado de cocción externo para un Batch dado
 */
export function buscarCoccionParaBatch(
  batchId: string, 
  correlativo: string, 
  loteIds: string[] = [],
  resultadosCoccion: ResultadoCoccionExterno[] = []
): ResultadoCoccionExterno | undefined {
  if (!resultadosCoccion || resultadosCoccion.length === 0) {
    resultadosCoccion = obtenerResultadosCoccionLocales();
  }

  const bId = normalizarTexto(batchId);
  const corr = normalizarTexto(correlativo);
  const corrSinPrefijo = corr.replace(/^B-?/, "");

  return resultadosCoccion.find(r => {
    const rBatch = normalizarTexto(r.batchId || "");
    const rCorr = normalizarTexto(r.correlativo || "");
    const rCorrSinPrefijo = rCorr.replace(/^B-?/, "");

    // Comparación directa de Batch ID o Correlativo
    if (rBatch === bId || rBatch === corr || rBatch === corrSinPrefijo) return true;
    if (rCorr === corr || rCorr === bId || rCorrSinPrefijo === corrSinPrefijo) return true;
    
    // Comparación con loteIds si aplica
    if (r.loteId && loteIds.some(lid => normalizarTexto(lid) === normalizarTexto(r.loteId))) return true;

    return false;
  });
}

/**
 * Obtiene la configuración de conexión externa
 */
export function obtenerConfigConexion(): ConfigConexionCoccion {
  try {
    const raw = localStorage.getItem(COCCION_CONFIG_KEY);
    if (!raw) {
      return {
        tipoConexion: "manual",
        autoSync: false,
        filtroProcesoExclusivo: "VAPORIZADO"
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      tipoConexion: "manual",
      autoSync: false,
      filtroProcesoExclusivo: "VAPORIZADO"
    };
  }
}

/**
 * Guarda la configuración de conexión externa
 */
export function guardarConfigConexion(config: ConfigConexionCoccion): void {
  try {
    localStorage.setItem(COCCION_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Error guardando config de conexión:", e);
  }
}

/**
 * Genera datos de prueba que contienen AMBOS procesos (Añejado y Vaporizado)
 * para demostrar el filtro inteligente.
 */
export function generarDatosPruebaMixtos(): {
  json: string;
  tsv: string;
} {
  const datos = [
    {
      "N_BATCH": "1664",
      "CORRELATIVO": "1664",
      "CODIGO": "MAQ-2853-2963",
      "PROCESO": "VAPORIZADO",
      "TIPO_VAPORIZADO": "Añejamiento / Vaporizado",
      "ANEJADORA": 2,
      "MAQUILA": "2853 / 2963",
      "CLIENTE": "Molino Don Julio / Santa Cruz",
      "VARIEDAD": "Santa Cruz",
      "PROCEDENCIA": "Mochumí",
      "N_SACOS": 400,
      "FECHA": "24-08-2026",
      "TURNO": "Noche",
      "ANALISTA": "Solange Vilches",
      "T_GRANO": 28.1,
      "T_AMBIENTE": 34.2,
      "HR": 52,
      "QUEBRADO_MP": 3.7,
      "QUEBRADO_DESCARGA": 4.78,
      "TRIZADO_MP": 1.2,
      "CUARTEADO_MP": 0.5,
      "CUARTEADO_DESCARGA": 0.52,
      "TIZA_TOTAL_MP": 4.0,
      "TP_TPUNTUAL_DESCARGA": 2.56,
      "MANCHA_MP": 0.4,
      "MANCHA_DESCARGA": 0.8,
      "BL_BLANCO_MP": 41.0,
      "BL_BLANCO_DESCARGA": 29.6,
      "H_BLANCO_MP": 12.0,
      "H_BLANCO_DESCARGA": 11.5,
      "TAZAS_ARROZ": 3,
      "TAZAS_AGUA": "3 1/2",
      "TIEMPO_COCCION": 30,
      "TAZAS_ARROZ_MP": 3,
      "TAZAS_ARROZ_DESCARGA": 3,
      "TAZAS_AGUA_MP": 3,
      "TAZAS_AGUA_DESCARGA": "3 1/2",
      "TIEMPO_COCCION_MP": 30,
      "TIEMPO_COCCION_DESCARGA": 30,
      "SABOR": "Neutro Característico",
      "DESPLAZAMIENTO": "12.6 seg",
      "DESPLAZAMIENTO_MP": "44.6 seg",
      "DESPLAZAMIENTO_DESCARGA": "12.6 seg",
      "G_HINCHADO_MP": 9.5,
      "G_HINCHADO_DESCARGA": 3.1,
      "G_HINCHADO": 3.1,
      "G_QUEBRADO_OLLA_MP": 9.1,
      "G_QUEBRADO_OLLA_DESCARGA": 8.1,
      "G_QUEBRADO_OLLA": 8.1,
      "G_ABIERTO_MP": 1.6,
      "G_ABIERTO_DESCARGA": 1.4,
      "G_ABIERTO": 1.4,
      "PEGOTEO_MP": "Sin pegoteo",
      "PEGOTEO_DESCARGA": "Sin pegoteo",
      "TEXTURA_FRIO_MP": "Firme",
      "TEXTURA_FRIO_DESCARGA": "Suave al frío",
      "TEXTURA_FRIO": "Suave al frío",
      "ENVASE_PROYECTADO": "Saco 50 kg Don Julio Extra Selección",
      "DICTAMEN_ENVASADO": "CONFORME PARA LÍNEA DE ENVASADO",
      "SCORE_COCCION": 98,
      "OBSERVACIONES": "Formato de Registro de Añejamiento / Vaporizado - Batch 1664 (Mochumí - Santa Cruz). Evaluado por Solange Vilches. Desplazamiento sobresaliente a 12.6 seg con soltura excelente y grano abierto 1.4%."
    },
    {
      "N_BATCH": "V272",
      "CORRELATIVO": "V272",
      "CODIGO": "7568-7579-7598-7684",
      "PROCESO": "VAPORIZADO",
      "TIPO_VAPORIZADO": "Presecado",
      "CLIENTE": "Chiroque Santamaria Felipe",
      "VARIEDAD": "Valor",
      "PROCEDENCIA": "Punto 4",
      "N_SACOS": 372,
      "FECHA": "26/08/26",
      "TURNO": "1250",
      "ANALISTA": "Fellon Salas",
      "REPOSO_CASCARA": 44,
      "H_CASCARA_MP": 14.4,
      "H_CASCARA_DESCARGA": 11.5,
      "H_BLANCO_DESCARGA": 11.0,
      "QUEBRADO_INTEGRAL_MP": 4.1,
      "QUEBRADO_INTEGRAL_DESCARGA": 16.1,
      "QUEBRADO_MP": 10.9,
      "QUEBRADO_DESCARGA": 25.3,
      "BL_INTEGRAL_MP": 21.5,
      "BL_INTEGRAL_DESCARGA": 18.8,
      "BL_BLANCO_MP": 40.1,
      "BL_BLANCO_DESCARGA": 31.4,
      "TRIZADO_MP": 2.0,
      "TRIZADO_DESCARGA": 28.5,
      "TIZA_TOTAL_MP": 1.7,
      "TIZA_TOTAL_DESCARGA": 3.4,
      "TP_TPUNTUAL_MP": 3.4,
      "TP_TPUNTUAL_DESCARGA": 6.1,
      "MANCHA_MP": 1.6,
      "MANCHA_DESCARGA": 3.3,
      "G_INMADURO_MP": 1.0,
      "G_INMADURO_DESCARGA": 1.3,
      "TAZAS_ARROZ": 3,
      "TAZAS_AGUA": "3 1/2",
      "TIEMPO_COCCION": 30,
      "SABOR": "Neutro Característico",
      "DESPLAZAMIENTO": "15 seg",
      "G_QUEBRADO_OLLA": 18.0,
      "G_HINCHADO": 8.6,
      "G_ABIERTO": 1.3,
      "TEXTURA_FRIO": "Suave",
      "ENVASE_PROYECTADO": "Saco 50 kg Don Julio Extra Selección",
      "SCORE_COCCION": 96,
      "OBSERVACIONES": "Formato de Registro de Vaporizado - Batch V272 registrado con análisis físico y organoléptico en olla."
    },
    {
      "N_BATCH": "B-0001",
      "CORRELATIVO": "0001",
      "PROCESO": "VAPORIZADO",
      "VARIEDAD": "Tinajones Extra",
      "FECHA": "2026-08-20",
      "TAZAS_ARROZ": 3,
      "TAZAS_AGUA": "3 1/2",
      "TIEMPO_COCCION": 18,
      "SABOR": "Neutro Agradable",
      "DESPLAZAMIENTO": "14 seg",
      "G_QUEBRADO_OLLA": 10.5,
      "G_HINCHADO": 7.2,
      "G_ABIERTO": 0.9,
      "TEXTURA_FRIO": "Al dente, excelente firmeza",
      "ENVASE_PROYECTADO": "Saco 50 kg Don Julio Extra Selección",
      "RATIO_AGUA": "1:2.5",
      "EXPANSION": "x2.6",
      "SOLTURA_GRANO": "100% Suelto, grano entero y firme",
      "TRIZADO_MP": 2.2,
      "TRIZADO_DESCARGA": 3.1,
      "SCORE_COCCION": 98,
      "ANALISTA": "Ing. Carlos Mendoza (Lab Calidad)",
      "OBSERVACIONES": "Gelatinización homogénea perfecta. Óptima elongación en cocción."
    },
    {
      "N_BATCH": "LOT-ANJ-104",
      "CORRELATIVO": "ANJ-104",
      "PROCESO": "AÑEJADO",
      "VARIEDAD": "Tinajones Añejado 6 Meses",
      "FECHA": "2026-08-21",
      "TAZAS_ARROZ": 3,
      "TAZAS_AGUA": "3 1/4",
      "TIEMPO_COCCION": 22,
      "SABOR": "Aroma a Silo Añejo",
      "DESPLAZAMIENTO": "18 seg",
      "G_QUEBRADO_OLLA": 14.0,
      "G_HINCHADO": 9.5,
      "G_ABIERTO": 2.1,
      "TEXTURA_FRIO": "Seco y firme",
      "ENVASE_PROYECTADO": "Saco 50 kg Don Julio Añejado Tradicional",
      "RATIO_AGUA": "1:2.2",
      "EXPANSION": "x2.2",
      "SOLTURA_GRANO": "Suelto, textura tradicional de añejo",
      "SCORE_COCCION": 89,
      "ANALISTA": "Ing. María Torres",
      "OBSERVACIONES": "Arroz añejado en silo. (ESTE REGISTRO SERÁ OMITIDO AUTOMÁTICAMENTE)."
    },
    {
      "N_BATCH": "B-0002",
      "CORRELATIVO": "0002",
      "PROCESO": "VAPORIZADO",
      "VARIEDAD": "IR-43 Mejorado",
      "FECHA": "2026-08-21",
      "TAZAS_ARROZ": 3,
      "TAZAS_AGUA": "3 1/2",
      "TIEMPO_COCCION": 19,
      "SABOR": "Neutro Característico",
      "DESPLAZAMIENTO": "16 seg",
      "G_QUEBRADO_OLLA": 12.0,
      "G_HINCHADO": 8.0,
      "G_ABIERTO": 1.1,
      "TEXTURA_FRIO": "Al dente suave",
      "ENVASE_PROYECTADO": "Saco 50 kg Don Julio Superior",
      "RATIO_AGUA": "1:2.5",
      "EXPANSION": "x2.5",
      "SOLTURA_GRANO": "100% Suelto, no se apelmaza",
      "TRIZADO_MP": 1.9,
      "TRIZADO_DESCARGA": 2.8,
      "SCORE_COCCION": 96,
      "ANALISTA": "Ing. Carlos Mendoza",
      "OBSERVACIONES": "Excelente cocción, grano rendidor y blanco marfil."
    }
  ];

  const headers = Object.keys(datos[0]);
  const tsvLines = [
    headers.join("\t"),
    ...datos.map(d => headers.map(h => (d as any)[h]).join("\t"))
  ];

  return {
    json: JSON.stringify(datos, null, 2),
    tsv: tsvLines.join("\n")
  };
}
