import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileSpreadsheet, 
  HelpCircle, 
  Sparkles, 
  Check, 
  ArrowRight,
  Database,
  Calendar,
  User,
  Scale,
  MapPin,
  Tag,
  Table as TableIcon
} from "lucide-react";
import { getFieldVal, parseNumericVal } from "../utils/localDB";
import { validateDateValue } from "../utils/excelValidation";
import { formatLoteCode } from "../utils/formatLoteCode";

export interface MissingFieldsSummary {
  missingVariedad: boolean;
  missingVariedadCount: number;
  missingCliente: boolean;
  missingClienteCount: number;
  missingFecha: boolean;
  missingFechaCount: number;
  missingUbicacion: boolean;
  missingUbicacionCount: number;
  missingSacos: boolean;
  missingSacosCount: number;
  missingPeso: boolean;
  missingPesoCount: number;
  missingLoteIdCount: number;
  totalWithMissing: number;
}

export function detectMissingFieldsInRows(rows: any[], mapping?: Record<string, string>): MissingFieldsSummary {
  let missingVariedadCount = 0;
  let missingClienteCount = 0;
  let missingFechaCount = 0;
  let missingUbicacionCount = 0;
  let missingSacosCount = 0;
  let missingPesoCount = 0;
  let missingLoteIdCount = 0;
  let totalWithMissing = 0;

  for (const r of rows) {
    let hasAny = false;
    // 1. Código de Lote (Obligatorio)
    const rawLote = mapping?.LOTE_ID ? r[mapping.LOTE_ID] : getFieldVal(r, [
      "CODIGO", "Codigo", "CÓDIGO", "LOTE", "LOTE_ID", "LOTE ID", "COD", "CÓD", "ID", "TICKET", "FICHA", 
      "NRO LOTE", "NRO_LOTE", "N° LOTE", "CODIGO DE LOTE", "CÓDIGO DE LOTE", "COD LOTE", "CÓD. LOTE", "COLUMNA 3", "COL 3"
    ]);
    const normLote = formatLoteCode(rawLote);
    if (!normLote || normLote === "0" || normLote.toUpperCase() === "TOTAL" || normLote.toUpperCase() === "PROMEDIO") {
      missingLoteIdCount++;
      hasAny = true;
    }

    // 2. Cliente / Productor (Obligatorio)
    const rawCli = mapping?.CLIENTE ? r[mapping.CLIENTE] : getFieldVal(r, [
      "CLIENTE / AGRICULTOR / PRODUCTOR", "CLIENTE/AGRICULTOR/PRODUCTOR", "CLIENTE", "Cliente", "PRODUCTOR", "AGRICULTOR", "PROVEEDOR", "SEÑOR", "NOMBRE", 
      "CLIENTE / PRODUCTOR", "CLIENTE/PRODUCTOR", "RAZON SOCIAL", "RAZÓN SOCIAL", "DUEÑO", "DUENO", "TITULAR", "COLUMNA 4", "COL 4"
    ]);
    if (!rawCli || String(rawCli).trim() === "") {
      missingClienteCount++;
      hasAny = true;
    }

    // 3. Fecha de Recepción o Ingreso (Obligatorio)
    const rawFec = mapping?.FECHA ? r[mapping.FECHA] : getFieldVal(r, [
      "FECHA DE RECEPCION", "FECHA DE RECEPCIÓN", "Fecha de recepcion", "FECHA RECEPCION", "FECHA RECEPCIÓN", 
      "FECHA DE INGRESO", "FECHA_INGRESO", "FECHA", "Fecha", "FECHA INGRESO", "FECHA_ANALISIS", 
      "FECHA ANALISIS", "DATE", "F. INGRESO", "F. RECEPCION", "FECHA RECEP", "COLUMNA 1", "COL 1"
    ]);
    let hasValidDate = false;
    if (rawFec !== undefined && rawFec !== null && String(rawFec).trim() !== "") {
      const v = validateDateValue(rawFec);
      if (v.isValid) hasValidDate = true;
      else if (String(rawFec).trim().length >= 4) hasValidDate = true;
    }
    if (!hasValidDate) {
      missingFechaCount++;
      hasAny = true;
    }

    // 4. Cantidad de Sacos (Obligatorio)
    const rawSac = mapping?.SACOS ? r[mapping.SACOS] : getFieldVal(r, [
      "SACOS", "Sacos", "SACO", "CANTIDAD", "CANTIDAD DE SACOS", "CANTIDAD SACOS", "BULTOS", "BOLSAS", "NRO SACOS", "N° SACOS", 
      "NRO_SACOS", "CANT", "BULT", "COLUMNA 5", "COL 5"
    ]);
    const parsedSac = parseNumericVal(rawSac);
    if (!parsedSac || parsedSac <= 0) {
      missingSacosCount++;
      hasAny = true;
    }

    // 5. Peso Neto en Kg (Obligatorio)
    const rawPes = mapping?.PESO_KG ? r[mapping.PESO_KG] : getFieldVal(r, [
      "PESO (KG)", "PESO (Kg)", "PESO(KG)", "PESO (kg)", "Peso (kg)", "PESO NETO (KG)", "PESO NETO(KG)",
      "PESO_KG", "PESO EN KG", "PESO KG", "PESO", "KILOS", "TOTAL_KG", "PESO_NETO", "PESO NETO", "NETO", "KG", "COLUMNA 6", "COL 6"
    ]);
    const rawPesTn = getFieldVal(r, ["PESO (TN)", "PESO TN", "TN"]);
    const parsedPes = parseNumericVal(rawPes);
    const parsedPesTn = parseNumericVal(rawPesTn);
    const finalPesVal = (parsedPes !== undefined && parsedPes > 0) ? parsedPes : (parsedPesTn !== undefined && parsedPesTn > 0 ? parsedPesTn * 1000 : 0);
    if (!finalPesVal || finalPesVal <= 0) {
      missingPesoCount++;
      hasAny = true;
    }

    // 6. Variedad de Arroz (Identificación de producto)
    const rawVar = mapping?.VARIEDAD ? r[mapping.VARIEDAD] : getFieldVal(r, [
      "VARIEDAD DE ARROZ", "Variedad de arroz", "VARIEDAD DEL ARROZ", "VARIEDAD", "VARIEDA", "VARIEDAD ARROZ", "VAR", 
      "TIPO ARROZ", "TIPO DE ARROZ", "TIPO", "VARIEDADES", "PRODUCTO", "CLASE", "ESPECIE", "TIPO DE GRANO", "COLUMNA 30", "COL 30"
    ]);
    if (!rawVar || String(rawVar).trim() === "") {
      missingVariedadCount++;
      hasAny = true;
    }

    // 7. Ubicación (Informativa, opcional en la recepción en tolva/silo)
    const rawUbi = mapping?.UBICACION ? r[mapping.UBICACION] : getFieldVal(r, [
      "UBICACION", "Ubicacion", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ALMACÉN", "ZONA ACOPIO", "DESTINO", "COLUMNA 2", "COL 2"
    ]);
    if (!rawUbi || String(rawUbi).trim() === "") {
      missingUbicacionCount++;
    }

    if (hasAny) totalWithMissing++;
  }

  return {
    missingVariedad: missingVariedadCount > 0,
    missingVariedadCount,
    missingCliente: missingClienteCount > 0,
    missingClienteCount,
    missingFecha: missingFechaCount > 0,
    missingFechaCount,
    missingUbicacion: missingUbicacionCount > 0,
    missingUbicacionCount,
    missingSacos: missingSacosCount > 0,
    missingSacosCount,
    missingPeso: missingPesoCount > 0,
    missingPesoCount,
    missingLoteIdCount,
    totalWithMissing
  };
}

export interface ExcelDatosFaltantesModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  totalRows: number;
  missingSummary: MissingFieldsSummary;
  rows: any[]; // Todas las filas del Excel mapeadas
  onConfirmImport: (cleanedRows: any[], globalFills: Record<string, any>) => void;
}

const VARIEDADES_COMUNES = [
  "Tinajones Extra",
  "IR-43",
  "Mallares",
  "Pitipo",
  "El Cautivo",
  "NIR",
  "Bellavista"
];

const UBICACIONES_COMUNES = [
  "Tolva 1",
  "Tolva 2",
  "Tolva 3",
  "Silo 1",
  "Silo 2",
  "Silo 3",
  "Tolva de Recepción",
  "Patios de Acopio"
];

export const ExcelDatosFaltantesModal: React.FC<ExcelDatosFaltantesModalProps> = ({
  isOpen,
  onClose,
  fileName,
  totalRows,
  missingSummary,
  rows,
  onConfirmImport
}) => {
  // Valores globales a aplicar a los campos vacíos
  const [globalVariedad, setGlobalVariedad] = useState<string>("");
  const [globalCliente, setGlobalCliente] = useState<string>("");
  const [globalFecha, setGlobalFecha] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [globalUbicacion, setGlobalUbicacion] = useState<string>("");
  const [globalSacos, setGlobalSacos] = useState<string>("");
  const [kgPorSacoFactor, setKgPorSacoFactor] = useState<string>("50");
  const [aplicarKgPorSaco, setAplicarKgPorSaco] = useState<boolean>(false);

  // Modo de vista: "resumen" o "detalle_filas"
  const [activeTab, setActiveTab] = useState<"formulario" | "tabla_filas">("formulario");

  // Edición fila por fila para personalizaciones puntuales
  const [rowOverrides, setRowOverrides] = useState<Record<number, Record<string, any>>>({});

  // Filas que tienen al menos un dato faltante
  const rowsWithMissing = useMemo(() => {
    return rows.map((r, index) => {
      const rawLoteId = String(getFieldVal(r, [
        "CODIGO", "CÓDIGO", "LOTE", "LOTE_ID", "LOTE ID", "COD", "CÓD", "ID", "TICKET", "FICHA", 
        "NRO LOTE", "NRO_LOTE", "N° LOTE", "CODIGO DE LOTE", "CÓDIGO DE LOTE", "COD LOTE", "CÓD. LOTE"
      ]) || "").trim();
      const loteId = formatLoteCode(rawLoteId);

      const cliente = String(getFieldVal(r, [
        "CLIENTE", "PRODUCTOR", "AGRICULTOR", "PROVEEDOR", "SEÑOR", "NOMBRE", 
        "CLIENTE / PRODUCTOR", "CLIENTE/PRODUCTOR", "RAZON SOCIAL", "RAZÓN SOCIAL", "DUEÑO", "DUENO", "TITULAR"
      ]) || "").trim();

      const variedad = String(getFieldVal(r, [
        "VARIEDAD", "VARIEDA", "VARIEDAD ARROZ", "VARIEDAD DE ARROZ", "VAR", 
        "TIPO ARROZ", "TIPO DE ARROZ", "TIPO", "VARIEDADES", "PRODUCTO", "CLASE", "ESPECIE", "TIPO DE GRANO"
      ]) || "").trim();

      const rawFec = getFieldVal(r, [
        "FECHA DE RECEPCION", "FECHA DE RECEPCIÓN", "FECHA RECEPCION", "FECHA RECEPCIÓN", 
        "FECHA DE INGRESO", "FECHA_INGRESO", "FECHA", "FECHA INGRESO", "FECHA_ANALISIS", 
        "FECHA ANALISIS", "DATE", "F. INGRESO", "F. RECEPCION", "FECHA RECEP"
      ]);
      let fecha = "";
      if (rawFec !== undefined && rawFec !== null && String(rawFec).trim() !== "") {
        const v = validateDateValue(rawFec);
        fecha = v.isoDate || String(rawFec).trim();
      }

      const ubicacion = String(getFieldVal(r, [
        "UBICACION", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ALMACÉN", "ZONA ACOPIO", "DESTINO"
      ]) || "").trim();

      const rawSac = getFieldVal(r, [
        "SACOS", "SACO", "CANTIDAD", "CANTIDAD DE SACOS", "CANTIDAD SACOS", "BULTOS", "BOLSAS", "NRO SACOS", "N° SACOS", 
        "NRO_SACOS", "CANT", "BULT"
      ]);
      const sacos = parseNumericVal(rawSac) || 0;

      const rawPes = getFieldVal(r, [
        "PESO (KG)", "PESO (Kg)", "PESO(KG)", "PESO (kg)", "PESO NETO (KG)", "PESO NETO(KG)",
        "PESO_KG", "PESO EN KG", "PESO KG", "PESO", "KILOS", "TOTAL_KG", "PESO_NETO", "PESO NETO", "NETO", "KG"
      ]);
      const rawPesTn = getFieldVal(r, ["PESO (TN)", "PESO TN", "TN"]);
      const parsedP = parseNumericVal(rawPes);
      const parsedPTn = parseNumericVal(rawPesTn);
      const peso = (parsedP !== undefined && parsedP > 0) ? parsedP : (parsedPTn !== undefined && parsedPTn > 0 ? parsedPTn * 1000 : 0);

      const observacion = String(getFieldVal(r, [
        "OBSERVACION POR LOTE", "OBSERVACIÓN POR LOTE", "OBSERVACIONES POR LOTE",
        "OBS POR LOTE", "OBS. POR LOTE", "OBS LOTE", "OBSERVACION DE LOTE", "OBSERVACIONES DE LOTE",
        "OBSERVACION", "OBSERVACIÓN", "OBSERVACIONES", "OBS", "OBS.", "NOTA", "NOTAS", "DETALLE", "COMENTARIOS", "COMENTARIO"
      ]) || "").trim();

      const missingLote = !loteId || loteId === "0";
      const missingCli = !cliente;
      const missingVar = !variedad;
      const missingFec = !fecha;
      const missingUbi = !ubicacion;
      const missingSac = sacos <= 0;
      const missingPes = peso <= 0;

      // Una fila se lista si le falta alguno de los campos de datos requeridos
      const hasAnyMissing = missingLote || missingCli || missingFec || missingSac || missingPes || (missingSummary.missingVariedad && missingVar);

      return {
        rowIndex: index,
        raw: r,
        loteId,
        cliente,
        variedad,
        fecha,
        ubicacion,
        sacos,
        peso,
        observacion,
        missingLote,
        missingCli,
        missingVar,
        missingFec,
        missingUbi,
        missingSac,
        missingPes,
        hasAnyMissing
      };
    }).filter(x => x.hasAnyMissing);
  }, [rows, missingSummary]);

  if (!isOpen) return null;

  const handleRowFieldChange = (rowIndex: number, field: string, value: any) => {
    setRowOverrides(prev => ({
      ...prev,
      [rowIndex]: {
        ...(prev[rowIndex] || {}),
        [field]: value
      }
    }));
  };

  const handleConfirm = () => {
    // Procesar y aplicar los datos solicitados sin inventar nada ficticio
    const finalRows = rows.map((r, index) => {
      const override = rowOverrides[index] || {};
      const currentLoteId = String(getFieldVal(r, [
        "CODIGO", "CÓDIGO", "LOTE", "LOTE_ID", "LOTE ID", "COD", "CÓD", "ID", "TICKET", "FICHA", 
        "NRO LOTE", "NRO_LOTE", "N° LOTE", "CODIGO DE LOTE", "CÓDIGO DE LOTE", "COD LOTE", "CÓD. LOTE"
      ]) || "").trim();
      const rawFinalLoteId = override.LOTE_ID !== undefined && String(override.LOTE_ID).trim() !== "" ? String(override.LOTE_ID).trim() : currentLoteId;
      const finalLoteId = formatLoteCode(rawFinalLoteId) || rawFinalLoteId;

      const currentCliente = String(getFieldVal(r, [
        "CLIENTE", "PRODUCTOR", "AGRICULTOR", "PROVEEDOR", "SEÑOR", "NOMBRE", 
        "CLIENTE / PRODUCTOR", "CLIENTE/PRODUCTOR", "RAZON SOCIAL", "RAZÓN SOCIAL", "DUEÑO", "DUENO", "TITULAR"
      ]) || "").trim().toUpperCase();

      const currentVariedad = String(getFieldVal(r, [
        "VARIEDAD", "VARIEDA", "VARIEDAD ARROZ", "VARIEDAD DE ARROZ", "VAR", 
        "TIPO ARROZ", "TIPO DE ARROZ", "TIPO", "VARIEDADES", "PRODUCTO", "CLASE", "ESPECIE", "TIPO DE GRANO"
      ]) || "").trim();

      const rawFec = getFieldVal(r, [
        "FECHA DE RECEPCION", "FECHA DE RECEPCIÓN", "FECHA RECEPCION", "FECHA RECEPCIÓN", 
        "FECHA DE INGRESO", "FECHA_INGRESO", "FECHA", "FECHA INGRESO", "FECHA_ANALISIS", 
        "FECHA ANALISIS", "DATE", "F. INGRESO", "F. RECEPCION", "FECHA RECEP"
      ]);
      let currentFecha = "";
      if (rawFec !== undefined && rawFec !== null && String(rawFec).trim() !== "") {
        const v = validateDateValue(rawFec);
        currentFecha = v.isoDate || String(rawFec).trim();
      }

      const currentUbicacion = String(getFieldVal(r, [
        "UBICACION", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ALMACÉN", "ZONA ACOPIO", "DESTINO"
      ]) || "").trim();

      const rawSac = getFieldVal(r, [
        "SACOS", "SACO", "CANTIDAD", "CANTIDAD DE SACOS", "CANTIDAD SACOS", "BULTOS", "BOLSAS", "NRO SACOS", "N° SACOS", 
        "NRO_SACOS", "CANT", "BULT"
      ]);
      const currentSacos = parseNumericVal(rawSac) || 0;

      const rawPes = getFieldVal(r, [
        "PESO (KG)", "PESO (Kg)", "PESO(KG)", "PESO (kg)", "PESO NETO (KG)", "PESO NETO(KG)",
        "PESO_KG", "PESO EN KG", "PESO KG", "PESO", "KILOS", "TOTAL_KG", "PESO_NETO", "PESO NETO", "NETO", "KG"
      ]);
      const rawPesTn = getFieldVal(r, ["PESO (TN)", "PESO TN", "TN"]);
      const parsedP = parseNumericVal(rawPes);
      const parsedPTn = parseNumericVal(rawPesTn);
      const currentPeso = (parsedP !== undefined && parsedP > 0) ? parsedP : (parsedPTn !== undefined && parsedPTn > 0 ? parsedPTn * 1000 : 0);

      const currentObs = String(getFieldVal(r, [
        "OBSERVACION POR LOTE", "OBSERVACIÓN POR LOTE", "OBSERVACIONES POR LOTE",
        "OBS POR LOTE", "OBS. POR LOTE", "OBS LOTE", "OBSERVACION DE LOTE", "OBSERVACIONES DE LOTE",
        "OBSERVACION", "OBSERVACIÓN", "OBSERVACIONES", "OBS", "OBS.", "NOTA", "NOTAS", "DETALLE", "COMENTARIOS", "COMENTARIO"
      ]) || "").trim();

      const finalCliente = override.CLIENTE !== undefined 
        ? override.CLIENTE 
        : (currentCliente || (globalCliente.trim() ? globalCliente.trim().toUpperCase() : ""));

      const finalVariedad = override.VARIEDAD !== undefined 
        ? override.VARIEDAD 
        : (currentVariedad || (globalVariedad.trim() ? globalVariedad.trim() : ""));

      const finalFecha = override.FECHA !== undefined 
        ? override.FECHA 
        : (currentFecha || (globalFecha ? globalFecha : ""));

      const finalUbicacion = override.UBICACION !== undefined 
        ? override.UBICACION 
        : (currentUbicacion || (globalUbicacion.trim() ? globalUbicacion.trim() : ""));

      const finalObs = override.OBSERVACIONES !== undefined ? override.OBSERVACIONES : currentObs;

      let finalSacos = override.SACOS !== undefined 
        ? (parseNumericVal(override.SACOS) || 0)
        : (currentSacos > 0 ? currentSacos : (globalSacos && parseNumericVal(globalSacos) ? parseNumericVal(globalSacos)! : 0));
      
      let finalPeso = override.PESO_KG !== undefined ? (parseNumericVal(override.PESO_KG) || 0) : currentPeso;

      // Solo si el usuario autorizó explícitamente el cálculo de peso basado en sacos
      if (aplicarKgPorSaco && finalPeso <= 0 && finalSacos > 0 && Number(kgPorSacoFactor) > 0) {
        finalPeso = finalSacos * Number(kgPorSacoFactor);
      }

      return {
        ...r,
        LOTE_ID: finalLoteId,
        CODIGO: finalLoteId,
        Codigo: finalLoteId,
        LOTE: finalLoteId,
        CLIENTE: finalCliente,
        VARIEDAD: finalVariedad,
        FECHA_INGRESO: finalFecha,
        FECHA: finalFecha,
        UBICACION: finalUbicacion,
        SACOS: finalSacos > 0 ? finalSacos : undefined,
        PESO_KG: finalPeso > 0 ? finalPeso : undefined,
        OBSERVACIONES: finalObs
      };
    });

    onConfirmImport(finalRows, {
      globalVariedad,
      globalCliente,
      globalFecha,
      globalUbicacion,
      globalSacos,
      aplicarKgPorSaco,
      kgPorSacoFactor
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        id="excel-datos-faltantes-modal"
        className="relative w-full max-w-3xl bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  Completar Datos Faltantes del Archivo Excel
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold tracking-wide uppercase">
                  No se inventarán datos
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {fileName ? `Archivo: ${fileName} • ` : ""}{totalRows} fila(s) leída(s) • Se requiere tu confirmación para campos no definidos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de Detección */}
        <div className="bg-amber-950/20 border-b border-amber-900/30 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-amber-200 font-semibold mb-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Campos que no fueron encontrados o están incompletos en el archivo:</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {missingSummary.missingLoteIdCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Código de Lote ({missingSummary.missingLoteIdCount} filas sin código)
              </span>
            )}
            {missingSummary.missingVariedadCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-amber-400" />
                Variedad ({missingSummary.missingVariedadCount} filas sin dato)
              </span>
            )}
            {missingSummary.missingClienteCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                <User className="w-3 h-3 text-blue-400" />
                Cliente / Productor ({missingSummary.missingClienteCount} filas sin dato)
              </span>
            )}
            {missingSummary.missingFechaCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-purple-400" />
                Fecha ({missingSummary.missingFechaCount} filas sin dato)
              </span>
            )}
            {missingSummary.missingUbicacionCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Tolva / Silo ({missingSummary.missingUbicacionCount} filas sin dato)
              </span>
            )}
            {missingSummary.missingPesoCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                <Scale className="w-3 h-3 text-rose-400" />
                Peso Neto ({missingSummary.missingPesoCount} filas sin dato)
              </span>
            )}
            {missingSummary.missingSacosCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                Sacos ({missingSummary.missingSacosCount} filas sin dato)
              </span>
            )}
          </div>
        </div>

        {/* Selector de pestañas */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("formulario")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "formulario"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Asignación Rápida a Filas Faltantes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tabla_filas")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "tabla_filas"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Revisar Filas con Datos Faltantes ({rowsWithMissing.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {activeTab === "formulario" ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                Define a continuación los datos reales que deben aplicarse a los lotes donde el Excel no especificó la información. 
                <strong> Los campos que dejes en blanco se registrarán como no especificados (sin inventar nombres ni variedades falsas).</strong>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Variedad (solo si falta en el archivo) */}
                {missingSummary.missingVariedadCount > 0 && (
                  <div className="p-4 rounded-xl border bg-slate-850 border-amber-500/40 shadow-sm">
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        Variedad de Arroz
                      </span>
                      <span className="text-[10px] text-amber-400 font-semibold">
                        Falta en {missingSummary.missingVariedadCount} lote(s)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Crucial para recetas de vaporizado, parámetros de secado y rendimientos.
                    </p>
                    <input
                      type="text"
                      value={globalVariedad}
                      onChange={(e) => setGlobalVariedad(e.target.value)}
                      placeholder="Ej. Tinajones Extra, IR-43, Mallares..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 mb-2"
                    />
                    {/* Variedades comunes rápidas */}
                    <div className="flex flex-wrap gap-1">
                      {VARIEDADES_COMUNES.map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setGlobalVariedad(v)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            globalVariedad === v
                              ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                              : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Cliente / Productor (solo si falta en el archivo) */}
                {missingSummary.missingClienteCount > 0 && (
                  <div className="p-4 rounded-xl border bg-slate-850 border-blue-500/40 shadow-sm">
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        Cliente / Agricultor / Productor
                      </span>
                      <span className="text-[10px] text-blue-400 font-semibold">
                        Falta en {missingSummary.missingClienteCount} lote(s)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Identifica a quién pertenece el lote en acopio y liquidación.
                    </p>
                    <input
                      type="text"
                      value={globalCliente}
                      onChange={(e) => setGlobalCliente(e.target.value)}
                      placeholder="Ej. Molino San Pedro, Comité de Regantes..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>
                )}

                {/* 3. Fecha de Ingreso (solo si falta en el archivo) */}
                {missingSummary.missingFechaCount > 0 && (
                  <div className="p-4 rounded-xl border bg-slate-850 border-purple-500/40 shadow-sm">
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        Fecha de Recepción en Planta
                      </span>
                      <span className="text-[10px] text-purple-400 font-semibold">
                        Falta en {missingSummary.missingFechaCount} lote(s)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Fecha real de descarga o ingreso de los lotes.
                    </p>
                    <input
                      type="date"
                      value={globalFecha}
                      onChange={(e) => setGlobalFecha(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                )}

                {/* 4. Tolva / Silo de Recepción (solo si falta en el archivo) */}
                {missingSummary.missingUbicacionCount > 0 && (
                  <div className="p-4 rounded-xl border bg-slate-850 border-emerald-500/40 shadow-sm">
                    <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        Tolva / Silo de Descarga
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        Falta en {missingSummary.missingUbicacionCount} lote(s)
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Ubicación física inicial donde se almacena el lote.
                    </p>
                    <input
                      type="text"
                      value={globalUbicacion}
                      onChange={(e) => setGlobalUbicacion(e.target.value)}
                      placeholder="Ej. Tolva 1, Silo 2..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400 mb-2"
                    />
                    <div className="flex flex-wrap gap-1">
                      {UBICACIONES_COMUNES.slice(0, 5).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setGlobalUbicacion(u)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            globalUbicacion === u
                              ? "bg-emerald-500 text-slate-950 font-bold border-emerald-400"
                              : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensaje de confirmación cuando todos los campos están presentes */}
                {missingSummary.missingVariedadCount === 0 && 
                 missingSummary.missingClienteCount === 0 && 
                 missingSummary.missingFechaCount === 0 && 
                 missingSummary.missingUbicacionCount === 0 &&
                 missingSummary.missingSacosCount === 0 &&
                 missingSummary.missingPesoCount === 0 && (
                   <div className="col-span-full p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 flex items-center gap-3">
                     <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                     <div>
                       <h4 className="text-xs font-bold text-white">Todos los campos requeridos se encuentran completos</h4>
                       <p className="text-[11px] text-emerald-300/80 mt-0.5">
                         Se detectaron correctamente: Fecha de recepción, Ubicación, Código, Cliente, Sacos, Peso y todos los parámetros de análisis sin datos faltantes.
                       </p>
                     </div>
                   </div>
                 )}
              </div>

              {/* 5. Cantidad de Sacos (si faltan) */}
              {missingSummary.missingSacosCount > 0 && (
                <div className="p-4 rounded-xl border border-slate-700 bg-slate-850 space-y-2">
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-amber-400" />
                      Número de Sacos (para filas sin dato)
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold">
                      Falta en {missingSummary.missingSacosCount} lote(s)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Opcional: Si los lotes en tu archivo corresponden a una cantidad estándar de sacos, indícala aquí (o edítala fila por fila en la otra pestaña).
                  </p>
                  <input
                    type="number"
                    value={globalSacos}
                    onChange={(e) => setGlobalSacos(e.target.value)}
                    placeholder="Ej. 500"
                    className="w-36 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              )}

              {/* 6. Tratamiento de Pesos y Sacos */}
              {missingSummary.missingPesoCount > 0 && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <input
                      id="check-peso-por-saco"
                      type="checkbox"
                      checked={aplicarKgPorSaco}
                      onChange={(e) => setAplicarKgPorSaco(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="check-peso-por-saco" className="text-xs text-slate-200 cursor-pointer">
                      <span className="font-bold">Calcular Peso Neto estimado si solo existen Sacos:</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        Si el Excel incluye número de sacos pero no el peso total en kilogramos, calcular usando el factor por saco indicado (solo con tu confirmación explícita).
                      </span>
                    </label>
                  </div>
                  {aplicarKgPorSaco && (
                    <div className="pl-6 pt-1 flex items-center gap-2">
                      <span className="text-xs text-slate-300">Factor de conversión:</span>
                      <input
                        type="number"
                        value={kgPorSacoFactor}
                        onChange={(e) => setKgPorSacoFactor(e.target.value)}
                        className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-center"
                      />
                      <span className="text-xs text-slate-400">Kg por saco</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Vista Tabla Fila por Fila */
            <div className="space-y-3">
              <div className="text-xs text-slate-300 flex items-center justify-between">
                <span>Edita directamente cualquier fila con datos faltantes antes de importar:</span>
                <span className="text-[11px] text-amber-400 font-mono">
                  {rowsWithMissing.length} fila(s) afectadas
                </span>
              </div>
              <div className="overflow-x-auto max-h-[50vh] border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Lote</th>
                      <th className="p-2.5">Cliente / Productor</th>
                      <th className="p-2.5">Variedad</th>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Ubicación</th>
                      <th className="p-2.5">Sacos</th>
                      <th className="p-2.5">Peso (Kg)</th>
                      <th className="p-2.5">Observación por Lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {rowsWithMissing.map((item) => {
                      const override = rowOverrides[item.rowIndex] || {};
                      const loteVal = override.LOTE_ID ?? item.loteId;
                      const cliVal = override.CLIENTE ?? (item.cliente || globalCliente);
                      const varVal = override.VARIEDAD ?? (item.variedad || globalVariedad);
                      const fecVal = override.FECHA ?? (item.fecha || globalFecha);
                      const ubiVal = override.UBICACION ?? (item.ubicacion || globalUbicacion);
                      const sacVal = override.SACOS ?? item.sacos;
                      const pesVal = override.PESO_KG ?? item.peso;
                      const obsVal = override.OBSERVACIONES ?? item.observacion;

                      return (
                        <tr key={item.rowIndex} className="hover:bg-slate-800/40">
                          <td className="p-2 text-slate-500 font-mono text-[11px]">
                            {item.rowIndex + 1}
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={loteVal}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "LOTE_ID", e.target.value)}
                              className={`px-2 py-1 rounded text-xs w-24 bg-slate-950 border ${
                                item.missingLote ? "border-amber-500 text-amber-200" : "border-slate-800 text-white"
                              }`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cliVal}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "CLIENTE", e.target.value)}
                              placeholder="Sin cliente"
                              className={`px-2 py-1 rounded text-xs w-44 bg-slate-950 border ${
                                item.missingCli && !cliVal ? "border-amber-500/60 text-amber-300" : "border-slate-800 text-white"
                              }`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={varVal}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "VARIEDAD", e.target.value)}
                              placeholder="Sin variedad"
                              className={`px-2 py-1 rounded text-xs w-36 bg-slate-950 border ${
                                item.missingVar && !varVal ? "border-amber-500/60 text-amber-300" : "border-slate-800 text-white"
                              }`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={fecVal}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "FECHA", e.target.value)}
                              className="px-2 py-1 rounded text-xs w-32 bg-slate-950 border border-slate-800 text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={ubiVal}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "UBICACION", e.target.value)}
                              placeholder="Sin ubicación"
                              className="px-2 py-1 rounded text-xs w-28 bg-slate-950 border border-slate-800 text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={sacVal || ""}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "SACOS", e.target.value)}
                              placeholder="0"
                              className="px-2 py-1 rounded text-xs w-16 bg-slate-950 border border-slate-800 text-white text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={pesVal || ""}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "PESO_KG", e.target.value)}
                              placeholder="0"
                              className="px-2 py-1 rounded text-xs w-24 bg-slate-950 border border-slate-800 text-white text-right"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={obsVal || ""}
                              onChange={(e) => handleRowFieldChange(item.rowIndex, "OBSERVACIONES", e.target.value)}
                              placeholder="Observación..."
                              className="px-2 py-1 rounded text-xs w-48 bg-slate-950 border border-slate-800 text-slate-300"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Los datos confirmados se guardarán fielmente sin generar valores ficticios.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-confirmar-importacion-datos-reales"
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar e Importar con Datos Reales</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
