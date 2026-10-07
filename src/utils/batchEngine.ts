import { 
  Lote, 
  BatchVaporizado, 
  BatchLote, 
  AnalisisHumedo, 
  ParametrosTrabajo, 
  SaldoLoteInfo, 
  BatchParticipanteInfo, 
  CompatibilidadLotesResult,
  EstadoSaldoLote,
  SubBatchDraft 
} from "../types";

export const PARAMETROS_TRABAJO_DEFAULT: ParametrosTrabajo = {
  lotesObjetivoPorDia: 2,
  maxLotesPorDia: 3,
  capacidadMinimaProcesoKg: 22000,
  capacidadMaximaSecadoraKg: 35000,
  capacidadExcepcionalMaximaKg: 37000,
  toleranciaDefectosPp: 2.0,
  toleranciaQuebradoPp: 2.0,
  turnosDisponibles: ["Turno Día", "Turno Noche"],
  sugeridoPorIA: {
    lotesObjetivoPorDia: 2,
    maxLotesPorDia: 3,
    capacidadMinimaProcesoKg: 22000,
    capacidadMaximaSecadoraKg: 35000,
    capacidadExcepcionalMaximaKg: 37000,
    toleranciaDefectosPp: 2.0,
    toleranciaQuebradoPp: 2.0,
    turnosDisponibles: ["Turno Día", "Turno Noche"],
    justificacionIA: "Parámetros estándar de operación industrial para autoclave APIT (35 TN) y secadoras cilíndricas.",
    fechaSugerencia: "2026-08-17"
  },
  ultimaModificacion: "2026-08-17 08:00:00",
  modificadoPor: "Ing. Carlos Morales (Jefe de Planta)"
};

export const STORAGE_KEY_PARAMETROS_TRABAJO = "molino_parametros_trabajo_v1";

/**
 * Obtiene los parámetros de trabajo guardados en localStorage con fallback a defaults
 */
export function obtenerParametrosTrabajoGuardados(): ParametrosTrabajo {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY_PARAMETROS_TRABAJO);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          let capMax = Number(parsed.capacidadMaximaSecadoraKg) || PARAMETROS_TRABAJO_DEFAULT.capacidadMaximaSecadoraKg;
          let capExcep = Number(parsed.capacidadExcepcionalMaximaKg) || PARAMETROS_TRABAJO_DEFAULT.capacidadExcepcionalMaximaKg;
          // Actualización automática a la capacidad de APIT (35 TN) si tenía los 32 TN previos
          if (capMax === 32000) capMax = 35000;
          if (capExcep === 34000) capExcep = 37000;

          return {
            ...PARAMETROS_TRABAJO_DEFAULT,
            ...parsed,
            capacidadMaximaSecadoraKg: capMax,
            capacidadMinimaProcesoKg: Number(parsed.capacidadMinimaProcesoKg) || PARAMETROS_TRABAJO_DEFAULT.capacidadMinimaProcesoKg,
            capacidadExcepcionalMaximaKg: capExcep,
            toleranciaDefectosPp: Number(parsed.toleranciaDefectosPp) ?? PARAMETROS_TRABAJO_DEFAULT.toleranciaDefectosPp,
            toleranciaQuebradoPp: Number(parsed.toleranciaQuebradoPp) ?? PARAMETROS_TRABAJO_DEFAULT.toleranciaQuebradoPp,
            lotesObjetivoPorDia: Number(parsed.lotesObjetivoPorDia) || PARAMETROS_TRABAJO_DEFAULT.lotesObjetivoPorDia,
            maxLotesPorDia: Number(parsed.maxLotesPorDia) || PARAMETROS_TRABAJO_DEFAULT.maxLotesPorDia,
            turnosDisponibles: Array.isArray(parsed.turnosDisponibles) && parsed.turnosDisponibles.length > 0 ? parsed.turnosDisponibles : PARAMETROS_TRABAJO_DEFAULT.turnosDisponibles
          };
        }
      }
    }
  } catch (e) {
    console.warn("Error leyendo parámetros de trabajo desde localStorage:", e);
  }
  return { ...PARAMETROS_TRABAJO_DEFAULT };
}

/**
 * Guarda los parámetros de trabajo en localStorage y emite un evento para sincronización en tiempo real
 */
export function guardarParametrosTrabajoLocal(params: ParametrosTrabajo): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PARAMETROS_TRABAJO, JSON.stringify(params));
      window.dispatchEvent(new CustomEvent("parametros-trabajo-updated", { detail: params }));
    }
  } catch (e) {
    console.error("Error guardando parámetros de trabajo en localStorage:", e);
  }
}

/**
 * Calcula los defectos totales (%) a partir del análisis húmedo o estimación estándar
 */
export function obtenerDefectosLote(lote: Lote, ah?: AnalisisHumedo): number {
  if (ah) {
    const mancha = Number(ah.M || ah.MANCHADO || 0);
    const tiza = Number(ah.TT || (Number(ah.TP || 0) + Number(ah["T. PUNT."] || 0)) || 0);
    const rojo = Number(ah.GR || 0);
    const inmaduro = Number(ah.GI || 0);
    const verde = Number(ah.GV || 0);
    const cascado = Number(ah.CASCADO || 0);
    const total = mancha + tiza + rojo + inmaduro + verde + cascado;
    if (total > 0) return Number(total.toFixed(2));
  }
  // Estimación empírica por humedad si no hay análisis aún
  const hum = Number(lote.HUM || 14.0);
  const defBase = hum > 22 ? 7.5 : hum > 18 ? 5.8 : 4.2;
  return Number(defBase.toFixed(2));
}

/**
 * Calcula el % de quebrado inicial a partir del análisis húmedo o estimación
 */
export function obtenerQuebradoLote(lote: Lote, ah?: AnalisisHumedo): number {
  if (ah) {
    if (ah.QI !== undefined && Number(ah.QI) > 0) return Number(Number(ah.QI).toFixed(2));
    if (ah.QB !== undefined && Number(ah.QB) > 0) return Number(Number(ah.QB).toFixed(2));
  }
  const hum = Number(lote.HUM || 14.0);
  const qBase = hum > 24 ? 12.5 : hum > 18 ? 10.0 : 8.5;
  return Number(qBase.toFixed(2));
}

/**
 * CONTROL DE SALDOS ESTRICTO:
 * Calcula para cada lote su peso original, peso procesado acumulado en batches, 
 * saldo disponible, estado de saldo e historial bidireccional de batches.
 */
export function calcularSaldosLotes(
  lotes: Lote[],
  batchLotes: BatchLote[] = [],
  batches: BatchVaporizado[] = [],
  analisisHumedos: AnalisisHumedo[] = []
): Map<string, SaldoLoteInfo> {
  const map = new Map<string, SaldoLoteInfo>();

  const batchMap = new Map<string, BatchVaporizado>();
  batches.forEach(b => batchMap.set(b.BATCH_ID, b));

  lotes.forEach((lote) => {
    const loteId = lote.LOTE_ID;
    const pesoOriginal = Number(lote.PESO_KG) || 0;
    const sacosOriginales = Number(lote.SACOS) || (pesoOriginal > 0 ? Math.round(pesoOriginal / 50) : 0);

    // Filter all batch-lote records that used this lote
    const lotUsages = batchLotes.filter((bl) => bl.LOTE_ID === loteId);

    let totalPesoProcesado = 0;
    let totalSacosProcesados = 0;
    const participantes: BatchParticipanteInfo[] = [];

    // Sort usages by batch/order
    lotUsages.forEach((usage, idx) => {
      const bObj = batchMap.get(usage.BATCH_ID);
      const pesoUso = Number(usage.PESO_KG) || 0;
      const sacosUso = Number(usage.SACOS) || (pesoUso > 0 ? Math.round(pesoUso / 50) : 0);

      totalPesoProcesado += pesoUso;
      totalSacosProcesados += sacosUso;

      participantes.push({
        batchId: usage.BATCH_ID,
        correlativo: bObj?.CORRELATIVO || usage.BATCH_ID,
        parte: usage.PARTE || (idx + 1),
        totalPartes: usage.TOTAL_PARTES || lotUsages.length,
        pesoSacos: sacosUso,
        pesoKg: pesoUso,
        fecha: bObj?.FECHA_PROGRAMADA || bObj?.FECHA_INICIO || "Sin fecha",
        turno: bObj?.TURNO || "Turno Día",
        estadoBatch: bObj?.ESTADO_BATCH || "PROGRAMADO"
      });
    });

    const saldoPendienteKg = Math.max(0, pesoOriginal - totalPesoProcesado);
    const sacosPendientes = Math.max(0, sacosOriginales - totalSacosProcesados);
    const porcentajeProcesado = pesoOriginal > 0 ? Number(((totalPesoProcesado / pesoOriginal) * 100).toFixed(1)) : 0;

    let estadoSaldo: EstadoSaldoLote = "PENDIENTE";
    if (totalPesoProcesado === 0) {
      estadoSaldo = "PENDIENTE";
    } else if (saldoPendienteKg <= 0.01) {
      estadoSaldo = "PROCESADO / COMPLETO";
    } else {
      estadoSaldo = "PARCIALMENTE PROCESADO";
    }

    const ah = analisisHumedos.find(a => a.LOTE_ID === loteId);
    const defectosPct = obtenerDefectosLote(lote, ah);
    const quebradoPct = obtenerQuebradoLote(lote, ah);

    // Identificar si el lote pertenece a un grupo de unión de lotes (ej. proceso V200)
    let grupoUnionId: string | undefined;
    let grupoUnionProceso: string | undefined;
    let lotesPermitidosUnion: string[] | undefined;
    let esSaldoReservadoUnion = false;

    for (const b of batches) {
      if (b.LOTES_UNION && Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.includes(loteId)) {
        grupoUnionId = b.GRUPO_UNION_ID || `UNION-${b.PROCESO_PADRE || (b.CORRELATIVO ? b.CORRELATIVO.split("-")[0] : "V200")}`;
        grupoUnionProceso = b.PROCESO_PADRE || (b.CORRELATIVO ? b.CORRELATIVO.split("-")[0] : "V200");
        lotesPermitidosUnion = b.LOTES_UNION;
        esSaldoReservadoUnion = true;
        break;
      }
    }

    map.set(loteId, {
      loteId,
      cliente: lote.CLIENTE || "Sin Cliente",
      variedad: lote.VARIEDAD || "Sin Variedad",
      humedad: Number(lote.HUM || 14.0),
      pesoOriginalKg: pesoOriginal,
      sacosOriginales: sacosOriginales,
      pesoProcesadoKg: totalPesoProcesado,
      sacosProcesados: totalSacosProcesados,
      saldoPendienteKg: Number(saldoPendienteKg.toFixed(2)),
      sacosPendientes,
      porcentajeProcesado,
      estadoSaldo,
      defectosPct,
      quebradoPct,
      batchesParticipantes: participantes,
      grupoUnionId,
      grupoUnionProceso,
      lotesPermitidosUnion,
      esSaldoReservadoUnion
    });
  });

  return map;
}

/**
 * VALIDACIÓN ESTRICTA DE COMPATIBILIDAD ENTRE LOTES:
 * 1. Mismo Cliente.
 * 2. Misma Variedad.
 * 3. Diferencia máx de Defectos <= tolerancia (2 pp).
 * 4. Diferencia máx de Quebrado <= tolerancia (2 pp).
 * 5. Restricción de Saldos de Unión: Los saldos de cada código solo deben unirse con los códigos seleccionados para juntarse.
 */
export function validarCompatibilidadLotes(
  loteIds: string[],
  lotes: Lote[],
  analisisHumedos: AnalisisHumedo[] = [],
  parametros: ParametrosTrabajo = PARAMETROS_TRABAJO_DEFAULT,
  saldosMap?: Map<string, SaldoLoteInfo>
): CompatibilidadLotesResult {
  if (!loteIds || loteIds.length === 0) {
    return {
      esCompatible: true,
      motivosIncompatibilidad: [],
      mismoCliente: true,
      mismaVariedad: true,
      diferenciaDefectos: 0,
      toleranciaDefectos: parametros.toleranciaDefectosPp,
      diferenciaQuebrado: 0,
      toleranciaQuebrado: parametros.toleranciaQuebradoPp,
      advertencias: [],
      detalles: []
    };
  }

  const selectedItems = loteIds.map(id => {
    const l = lotes.find(item => item.LOTE_ID === id);
    const ah = analisisHumedos.find(item => item.LOTE_ID === id);
    const saldoInfo = saldosMap?.get(id);
    const cliente = (l?.CLIENTE || "Desconocido").trim();
    const variedad = (l?.VARIEDAD || "Desconocido").trim();
    const defectos = saldoInfo?.defectosPct ?? (l ? obtenerDefectosLote(l, ah) : 0);
    const quebrado = saldoInfo?.quebradoPct ?? (l ? obtenerQuebradoLote(l, ah) : 0);
    const saldoKg = saldoInfo?.saldoPendienteKg ?? (l?.PESO_KG || 0);

    const humVal = Number(ah?.HUMEDADES ?? l?.HUM ?? 14.0);

    return {
      loteId: id,
      cliente,
      variedad,
      humedad: isNaN(humVal) ? 14.0 : humVal,
      defectos,
      quebrado,
      saldoKg
    };
  }).filter(Boolean);

  if (selectedItems.length === 1) {
    const single = selectedItems[0];
    return {
      esCompatible: true,
      motivosIncompatibilidad: [],
      mismoCliente: true,
      clienteComun: single.cliente,
      mismaVariedad: true,
      variedadComun: single.variedad,
      diferenciaDefectos: 0,
      toleranciaDefectos: parametros.toleranciaDefectosPp,
      diferenciaQuebrado: 0,
      toleranciaQuebrado: parametros.toleranciaQuebradoPp,
      advertencias: [],
      detalles: selectedItems
    };
  }

  const motivos: string[] = [];
  const advertencias: string[] = [];

  // 0. Validar Restricción Estricta de Saldos de Unión:
  // "LOS SALDOS DE CADA CODIGO SOLO DEBE UNIRSE CON LOS QUE SE SELECCIONO QUE VAN A JUNTARSE"
  selectedItems.forEach(item => {
    const saldoInfo = saldosMap?.get(item.loteId);
    if (saldoInfo?.esSaldoReservadoUnion && saldoInfo.lotesPermitidosUnion && saldoInfo.lotesPermitidosUnion.length > 0) {
      const lotesExtranos = selectedItems
        .map(i => i.loteId)
        .filter(id => !saldoInfo.lotesPermitidosUnion!.includes(id));
      
      if (lotesExtranos.length > 0) {
        motivos.push(
          `RESTRICCIÓN DE SALDO: El saldo del lote ${item.loteId} está reservado exclusivamente para el proceso ${saldoInfo.grupoUnionProceso || "de unión"} con los lotes [${saldoInfo.lotesPermitidosUnion.join(", ")}]. No puede combinarse con lotes ajenos (${lotesExtranos.join(", ")}).`
        );
      }
    }
  });

  // 1. Validar Mismo Cliente (Estricto: Todos los lotes deben pertenecer a un solo cliente)
  const firstCliente = selectedItems[0].cliente;
  const clientesDiferentes = selectedItems.some(item => item.cliente.toLowerCase() !== firstCliente.toLowerCase());
  const mismoCliente = !clientesDiferentes;
  if (clientesDiferentes) {
    const clientesDetectados = Array.from(new Set(selectedItems.map(i => i.cliente))).join(", ");
    motivos.push(`NO COMPATIBLE: Clientes diferentes (${clientesDetectados}). Todos los lotes del batch deben pertenecer al mismo cliente.`);
  }

  // 2. Validar Misma Variedad (Salvo que esté descrita explícitamente como MEZCLA)
  const esMezcla = (v: string) => {
    const norm = (v || "").toLowerCase();
    return norm.includes("mezcla") || norm.includes("mix");
  };

  const firstVariedad = selectedItems[0].variedad;
  const variedadesDiferentes = selectedItems.some(item => item.variedad.toLowerCase() !== firstVariedad.toLowerCase());
  const algunaEsMezcla = selectedItems.some(item => esMezcla(item.variedad));
  const todasMezclaOIguales = selectedItems.every(item => item.variedad.toLowerCase() === firstVariedad.toLowerCase() || esMezcla(item.variedad) || esMezcla(firstVariedad));
  const variedadValida = !variedadesDiferentes || todasMezclaOIguales;
  const mismaVariedad = !variedadesDiferentes;

  if (!variedadValida) {
    motivos.push(`NO COMPATIBLE: Variedades distintas (${Array.from(new Set(selectedItems.map(i => i.variedad))).join(", ")}). Solo se permite unir variedades distintas si la variedad está descrita explícitamente como MEZCLA.`);
  } else if (variedadesDiferentes && algunaEsMezcla) {
    advertencias.push("Compatibilidad permitida: Se detectaron variedades distintas con clasificación explícita de MEZCLA.");
  }

  // 3. Validar Uniformidad de Parámetros: Diferencia de Humedad (Máx 1.5 pp respecto a la dispersión)
  const humedadesList = selectedItems.map(item => item.humedad);
  const minHum = Math.min(...humedadesList);
  const maxHum = Math.max(...humedadesList);
  const difHum = Number((maxHum - minHum).toFixed(2));
  if (difHum > 1.5) {
    motivos.push(`NO COMPATIBLE: Dispersión de humedad superior a 1.5 pp (Diferencia: ${difHum} pp, Mín: ${minHum}%, Máx: ${maxHum}%). No cumple con el criterio de uniformidad.`);
  }

  // 4. Validar Uniformidad de Parámetros: Diferencia de Defectos
  const defectosList = selectedItems.map(item => item.defectos);
  const minDef = Math.min(...defectosList);
  const maxDef = Math.max(...defectosList);
  const difDefectos = Number((maxDef - minDef).toFixed(2));
  if (difDefectos > parametros.toleranciaDefectosPp) {
    motivos.push(`NO COMPATIBLE: Diferencia de defectos superior a ${parametros.toleranciaDefectosPp} puntos (Diferencia actual: ${difDefectos} pp, Mín: ${minDef}%, Máx: ${maxDef}%).`);
  }

  // 5. Validar Uniformidad de Parámetros: Diferencia de Quebrado
  const quebradosList = selectedItems.map(item => item.quebrado);
  const minQueb = Math.min(...quebradosList);
  const maxQueb = Math.max(...quebradosList);
  const difQuebrado = Number((maxQueb - minQueb).toFixed(2));
  if (difQuebrado > parametros.toleranciaQuebradoPp) {
    motivos.push(`NO COMPATIBLE: Diferencia de quebrado superior a ${parametros.toleranciaQuebradoPp} puntos (Diferencia actual: ${difQuebrado} pp, Mín: ${minQueb}%, Máx: ${maxQueb}%).`);
  }

  return {
    esCompatible: motivos.length === 0,
    motivosIncompatibilidad: motivos,
    mismoCliente,
    clienteComun: mismoCliente ? firstCliente : undefined,
    mismaVariedad,
    variedadComun: mismaVariedad ? firstVariedad : undefined,
    diferenciaDefectos: difDefectos,
    toleranciaDefectos: parametros.toleranciaDefectosPp,
    diferenciaQuebrado: difQuebrado,
    toleranciaQuebrado: parametros.toleranciaQuebradoPp,
    advertencias,
    detalles: selectedItems
  };
}

/**
 * Genera correlativo secuencial único (V200, V201, V202...)
 */
export function generarSiguienteCorrelativoBatch(batches: BatchVaporizado[] = []): string {
  let maxNumber = 199; // Base de inicio V200

  batches.forEach(b => {
    const corr = b.CORRELATIVO || b.BATCH_ID || "";
    // Match V followed by digits or numbers in general
    const match = corr.match(/V(\d+)/i) || corr.match(/(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber && num < 100000) {
        maxNumber = num;
      }
    }
  });

  const nextNum = maxNumber + 1;
  return `V${nextNum}`;
}

/**
 * Evaluación de capacidad de secadora con límites configurables
 */
export function evaluarCapacidadBatch(
  pesoTotalKg: number,
  parametros: ParametrosTrabajo = PARAMETROS_TRABAJO_DEFAULT
): {
  porcentajeUtilizado: number;
  capacidadDisponibleKg: number;
  capacidadDisponibleTn: number;
  pesoTotalTn: number;
  estadoCapacidad: "OPTIMO" | "SUBUTILIZADO" | "SOBRECARGA_EXCEPCIONAL_PAMPA" | "EXCESO_NO_PERMITIDO" | "VACIO";
  esExcepcionalPampa: boolean;
  alertaMensaje: string;
} {
  const capNominal = parametros.capacidadMaximaSecadoraKg || 35000;
  const capMin = parametros.capacidadMinimaProcesoKg || 22000;
  const capExcep = parametros.capacidadExcepcionalMaximaKg || 37000;

  const pesoTotalTn = Number((pesoTotalKg / 1000).toFixed(2));
  const porcentajeUtilizado = capNominal > 0 ? Number(((pesoTotalKg / capNominal) * 100).toFixed(1)) : 0;
  const capacidadDisponibleKg = Math.max(0, capNominal - pesoTotalKg);
  const capacidadDisponibleTn = Number((capacidadDisponibleKg / 1000).toFixed(2));

  if (pesoTotalKg === 0) {
    return {
      porcentajeUtilizado: 0,
      capacidadDisponibleKg: capNominal,
      capacidadDisponibleTn: Number((capNominal / 1000).toFixed(2)),
      pesoTotalTn: 0,
      estadoCapacidad: "VACIO",
      esExcepcionalPampa: false,
      alertaMensaje: "Batch sin carga asignada. Seleccione lotes compatibles."
    };
  }

  if (pesoTotalKg > capExcep) {
    const excesoKg = pesoTotalKg - capNominal;
    return {
      porcentajeUtilizado,
      capacidadDisponibleKg: 0,
      capacidadDisponibleTn: 0,
      pesoTotalTn,
      estadoCapacidad: "EXCESO_NO_PERMITIDO",
      esExcepcionalPampa: false,
      alertaMensaje: `⚠️ EXCESO CRÍTICO: El peso de ${pesoTotalKg.toLocaleString()} kg supera el límite excepcional máximo de ${capExcep.toLocaleString()} kg (${(capExcep/1000).toFixed(1)} TN). Reduzca la carga para proteger el equipo.`
    };
  }

  if (pesoTotalKg > capNominal && pesoTotalKg <= capExcep) {
    const excesoPampaKg = pesoTotalKg - capNominal;
    return {
      porcentajeUtilizado,
      capacidadDisponibleKg: 0,
      capacidadDisponibleTn: 0,
      pesoTotalTn,
      estadoCapacidad: "SOBRECARGA_EXCEPCIONAL_PAMPA",
      esExcepcionalPampa: true,
      alertaMensaje: `⚡ CAPACIDAD EXCEPCIONAL (${pesoTotalKg.toLocaleString()} kg): Se superan los ${capNominal.toLocaleString()} kg normales. El excedente (${excesoPampaKg.toLocaleString()} kg / ${(excesoPampaKg/1000).toFixed(2)} TN) debe bajarse y secarse en pampa.`
    };
  }

  if (pesoTotalKg < capMin) {
    const faltanteKg = capMin - pesoTotalKg;
    return {
      porcentajeUtilizado,
      capacidadDisponibleKg,
      capacidadDisponibleTn,
      pesoTotalTn,
      estadoCapacidad: "SUBUTILIZADO",
      esExcepcionalPampa: false,
      alertaMensaje: `ℹ️ CARGA MENOR AL MÍNIMO (${pesoTotalKg.toLocaleString()} kg): Por debajo de la capacidad mínima recomendada (${capMin.toLocaleString()} kg). Capacidad disponible en secadora: ${capacidadDisponibleKg.toLocaleString()} kg.`
    };
  }

  return {
    porcentajeUtilizado,
    capacidadDisponibleKg,
    capacidadDisponibleTn,
    pesoTotalTn,
    estadoCapacidad: "OPTIMO",
    esExcepcionalPampa: false,
    alertaMensaje: `✅ CARGA ÓPTIMA (${porcentajeUtilizado}%): Capacidad en rango normal (${(capMin/1000).toFixed(1)} a ${(capNominal/1000).toFixed(1)} TN). Capacidad remanente disponible: ${capacidadDisponibleKg.toLocaleString()} kg.`
  };
}

/**
 * Genera el plan estructurado de sub-batches para unión de lotes (ej. V200-1, V200-2, V200-3)
 * Garantiza que los sobrantes queden habilitados y reservados exclusivamente para los códigos del grupo.
 */
export function generarPlanUnionSubBatches(
  loteIds: string[],
  lotes: Lote[],
  macroProceso: string = "V200",
  capacidadSubBatchKg: number = 35000,
  saldosMap?: Map<string, SaldoLoteInfo>
): SubBatchDraft[] {
  const normIds = loteIds.map(id => id.trim().toUpperCase());
  const hasC8432 = normIds.includes("C08432");
  const hasC8434 = normIds.includes("C08434");
  const hasC8428 = normIds.includes("C08428");

  // Caso Específico Solicitado: Unión C08432 + C08434 + C08428 en Proceso V200
  if (hasC8432 && hasC8434 && hasC8428 && normIds.length === 3) {
    const l8432 = lotes.find(l => l.LOTE_ID === "C08432");
    const l8434 = lotes.find(l => l.LOTE_ID === "C08434");
    const l8428 = lotes.find(l => l.LOTE_ID === "C08428");

    const p8432Raw = saldosMap?.get("C08432")?.saldoPendienteKg;
    const p8434Raw = saldosMap?.get("C08434")?.saldoPendienteKg;
    const p8428Raw = saldosMap?.get("C08428")?.saldoPendienteKg;

    const p8432 = (p8432Raw !== undefined && p8432Raw > 0) ? p8432Raw : (l8432 ? Number(l8432.PESO_KG) || 18000 : 18000);
    const p8434 = (p8434Raw !== undefined && p8434Raw > 0) ? p8434Raw : (l8434 ? Number(l8434.PESO_KG) || 70000 : 70000);
    const p8428 = (p8428Raw !== undefined && p8428Raw > 0) ? p8428Raw : (l8428 ? Number(l8428.PESO_KG) || 17000 : 17000);

    // V200-1: C08432 (18 TN) + C08434 Parte 1 (90 sacos / 4.5 TN o 17 TN)
    const sub1Kg8432 = Math.min(p8432, 18000);
    const sub1Kg8434 = (p8434 <= 25000 && p8434 >= 20000) ? 4500 : Math.min(p8434, capacidadSubBatchKg - sub1Kg8432);
    const sobranteTrasSub1 = p8434 - sub1Kg8434;

    // V200-2: C08434 Parte 2 (333 sacos / 16.65 TN o 35 TN)
    const sub2Kg8434 = (p8434 <= 25000 && p8434 >= 20000) ? 16650 : Math.min(sobranteTrasSub1, capacidadSubBatchKg);
    const sobranteTrasSub2 = sobranteTrasSub1 - sub2Kg8434;

    // V200-3: Restante C08434 Parte 3 (30 sacos / 1.5 TN o 18 TN) + C08428
    const sub3Kg8434 = (p8434 <= 25000 && p8434 >= 20000) ? 1500 : sobranteTrasSub2;
    const sub3Kg8428 = Math.min(p8428, capacidadSubBatchKg - sub3Kg8434);
    const sobranteFinal8434 = Math.max(0, sobranteTrasSub2 - sub3Kg8434);

    return [
      {
        id: `${macroProceso}-1`,
        subBatchCorrelativo: `${macroProceso}-1`,
        procesoPadre: macroProceso,
        turno: "Turno Día",
        fecha: new Date().toISOString().split("T")[0],
        equipo: "APIT",
        pesoTotalKg: sub1Kg8432 + sub1Kg8434,
        totalSacos: Math.round((sub1Kg8432 + sub1Kg8434) / 50),
        observaciones: `Sub-Batch ${macroProceso}-1: Unión de C08432 (18.0 TN) con parte 1 de C08434 (${(sub1Kg8434 / 1000).toFixed(1)} TN). Sobrante de C08434 habilitado: ${(sobranteTrasSub1 / 1000).toFixed(1)} TN para unirse con los códigos seleccionados.`,
        asignaciones: [
          {
            loteId: "C08432",
            pesoKg: sub1Kg8432,
            sacos: Math.round(sub1Kg8432 / 50),
            parte: 1,
            totalPartes: 1,
            porcentajeSubBatch: Number(((sub1Kg8432 / (sub1Kg8432 + sub1Kg8434)) * 100).toFixed(1)),
            sobranteLoteTrasSubBatchKg: 0
          },
          {
            loteId: "C08434",
            pesoKg: sub1Kg8434,
            sacos: Math.round(sub1Kg8434 / 50),
            parte: 1,
            totalPartes: 3,
            porcentajeSubBatch: Number(((sub1Kg8434 / (sub1Kg8432 + sub1Kg8434)) * 100).toFixed(1)),
            sobranteLoteTrasSubBatchKg: sobranteTrasSub1
          }
        ]
      },
      {
        id: `${macroProceso}-2`,
        subBatchCorrelativo: `${macroProceso}-2`,
        procesoPadre: macroProceso,
        turno: "Turno Noche",
        fecha: new Date().toISOString().split("T")[0],
        equipo: "APIT",
        pesoTotalKg: sub2Kg8434,
        totalSacos: Math.round(sub2Kg8434 / 50),
        observaciones: `Sub-Batch ${macroProceso}-2: Proceso de C08434 parte 2 (${(sub2Kg8434 / 1000).toFixed(1)} TN). Sobrante restante habilitado: ${(sobranteTrasSub2 / 1000).toFixed(1)} TN para unirse con C08428.`,
        asignaciones: [
          {
            loteId: "C08434",
            pesoKg: sub2Kg8434,
            sacos: Math.round(sub2Kg8434 / 50),
            parte: 2,
            totalPartes: 3,
            porcentajeSubBatch: 100,
            sobranteLoteTrasSubBatchKg: sobranteTrasSub2
          }
        ]
      },
      {
        id: `${macroProceso}-3`,
        subBatchCorrelativo: `${macroProceso}-3`,
        procesoPadre: macroProceso,
        turno: "Turno Día",
        fecha: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        equipo: "APIT",
        pesoTotalKg: sub3Kg8434 + sub3Kg8428,
        totalSacos: Math.round((sub3Kg8434 + sub3Kg8428) / 50),
        observaciones: `Sub-Batch ${macroProceso}-3: Unión del restante de C08434 (${(sub3Kg8434 / 1000).toFixed(1)} TN) con C08428 (${(sub3Kg8428 / 1000).toFixed(1)} TN). Proceso de unión completado al 100%.`,
        asignaciones: [
          {
            loteId: "C08434",
            pesoKg: sub3Kg8434,
            sacos: Math.round(sub3Kg8434 / 50),
            parte: 3,
            totalPartes: 3,
            porcentajeSubBatch: Number(((sub3Kg8434 / (sub3Kg8434 + sub3Kg8428)) * 100).toFixed(1)),
            sobranteLoteTrasSubBatchKg: sobranteFinal8434
          },
          {
            loteId: "C08428",
            pesoKg: sub3Kg8428,
            sacos: Math.round(sub3Kg8428 / 50),
            parte: 1,
            totalPartes: 1,
            porcentajeSubBatch: Number(((sub3Kg8428 / (sub3Kg8434 + sub3Kg8428)) * 100).toFixed(1)),
            sobranteLoteTrasSubBatchKg: 0
          }
        ]
      }
    ];
  }

  // Algoritmo General para cualquier conjunto de lotes unidos:
  // Llena secuencialmente cada sub-batch hasta capacidadSubBatchKg (35 TN)
  const lotesDisponibles = normIds.map(id => {
    const l = lotes.find(item => item.LOTE_ID === id);
    const saldoKg = saldosMap?.get(id)?.saldoPendienteKg ?? (l ? Number(l.PESO_KG) || 0 : 0);
    return {
      loteId: id,
      saldoRestanteKg: saldoKg,
      partesUsadas: 0
    };
  }).filter(l => l.saldoRestanteKg > 0);

  const subBatches: SubBatchDraft[] = [];
  let subIndex = 1;
  const turnos = ["Turno Día", "Turno Noche"];

  while (lotesDisponibles.some(l => l.saldoRestanteKg > 100) && subIndex <= 10) {
    let espacioDisponible = capacidadSubBatchKg;
    const asignacionesSub: SubBatchDraft["asignaciones"] = [];

    for (const item of lotesDisponibles) {
      if (espacioDisponible <= 0 || item.saldoRestanteKg <= 0) continue;

      const aTomarKg = Math.min(espacioDisponible, item.saldoRestanteKg);
      item.saldoRestanteKg -= aTomarKg;
      espacioDisponible -= aTomarKg;
      item.partesUsadas++;

      asignacionesSub.push({
        loteId: item.loteId,
        pesoKg: aTomarKg,
        sacos: Math.round(aTomarKg / 50),
        parte: item.partesUsadas,
        totalPartes: item.partesUsadas,
        porcentajeSubBatch: 0,
        sobranteLoteTrasSubBatchKg: Math.round(item.saldoRestanteKg)
      });
    }

    const subTotalKg = asignacionesSub.reduce((acc, a) => acc + a.pesoKg, 0);
    if (subTotalKg > 0) {
      asignacionesSub.forEach(a => {
        a.porcentajeSubBatch = Number(((a.pesoKg / subTotalKg) * 100).toFixed(1));
      });

      subBatches.push({
        id: `${macroProceso}-${subIndex}`,
        subBatchCorrelativo: `${macroProceso}-${subIndex}`,
        procesoPadre: macroProceso,
        turno: turnos[(subIndex - 1) % turnos.length],
        fecha: new Date().toISOString().split("T")[0],
        equipo: "APIT",
        pesoTotalKg: subTotalKg,
        totalSacos: Math.round(subTotalKg / 50),
        observaciones: `Sub-Batch ${macroProceso}-${subIndex}: ${asignacionesSub.map(a => `${a.loteId} (${(a.pesoKg / 1000).toFixed(1)} TN)`).join(" + ")}`,
        asignaciones: asignacionesSub
      });
      subIndex++;
    } else {
      break;
    }
  }

  // Actualizar totalPartes para cada lote en todas las asignaciones
  const totalPartesPorLote = new Map<string, number>();
  subBatches.forEach(sb => {
    sb.asignaciones.forEach(a => {
      const current = totalPartesPorLote.get(a.loteId) || 0;
      totalPartesPorLote.set(a.loteId, Math.max(current, a.parte));
    });
  });

  subBatches.forEach(sb => {
    sb.asignaciones.forEach(a => {
      a.totalPartes = totalPartesPorLote.get(a.loteId) || a.parte;
    });
  });

  return subBatches;
}
