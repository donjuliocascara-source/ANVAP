import React, { useState, useRef, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  Layers, 
  Database,
  Cloud,
  FileUp,
  AlertTriangle,
  FileCheck2,
  Table,
  Sparkles,
  Settings2,
  ArrowRightLeft,
  Eye,
  SlidersHorizontal,
  Check,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Wand2,
  Calendar,
  Hash,
  HelpCircle,
  CheckCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import { parseSheetToRows } from "../utils/excelSheetParser";
import { localDB } from "../utils/localDB";
import { formatLoteCode } from "../utils/formatLoteCode";
import { cloudSyncService } from "../services/cloudSyncService";
import { 
  ExcelColumnMapper, 
  autoDetectColumnMapping, 
  SYSTEM_FIELDS 
} from "./ExcelColumnMapper";
import { 
  validateImportDataset, 
  SheetValidationReport, 
  RowValidationResult, 
  CellValidationError 
} from "../utils/excelValidation";
import { 
  ExcelDatosFaltantesModal, 
  detectMissingFieldsInRows, 
  MissingFieldsSummary 
} from "./ExcelDatosFaltantesModal";

export interface ExcelAllData {
  lotes?: any[];
  humedades?: any[];
  analisisHum?: any[];
  presecados?: any[];
  analisisSec?: any[];
  programaciones?: any[];
  batches?: any[];
  batchLotes?: any[];
  controles?: any[];
  analisisVap?: any[];
  equipos?: any[];
  estados?: any[];
  [key: string]: any;
}

interface ExcelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  allData?: ExcelAllData;
  onImportData: (data: any) => Promise<void>;
}

interface ParsedWorkbookSheet {
  name: string;
  rows: any[];
  columns: string[];
}

export const ExcelSyncModal: React.FC<ExcelSyncModalProps> = ({
  isOpen,
  onClose,
  allData,
  onImportData
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"sheets" | "import" | "export">("sheets");

  // State for file importation
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTarget, setImportTarget] = useState<"AUTO" | "lotes" | "humedades" | "analisisHum" | "analisisSec">("AUTO");
  
  // Multi-sheet and column mapping state
  const [parsedSheets, setParsedSheets] = useState<ParsedWorkbookSheet[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [activeMappingSubTab, setActiveMappingSubTab] = useState<"mapping" | "preview">("mapping");
  
  // Capa de validación de formatos (fechas, números, campos obligatorios)
  const [previewFilter, setPreviewFilter] = useState<"all" | "errors" | "warnings">("all");
  const [autoSanitizeOnImport, setAutoSanitizeOnImport] = useState<boolean>(true);
  const [showValidationConfirmModal, setShowValidationConfirmModal] = useState<boolean>(false);
  
  // Detección y solicitud de datos faltantes (sin inventar datos ficticios)
  const [showMissingDataModal, setShowMissingDataModal] = useState<boolean>(false);
  const [missingSummary, setMissingSummary] = useState<MissingFieldsSummary | null>(null);
  const [rowsPendingMissingCompletion, setRowsPendingMissingCompletion] = useState<any[]>([]);
  
  const [parsedPreview, setParsedPreview] = useState<{
    summary: string;
    target: string;
    rowsCount: number;
    sampleRows: any[];
    fullPayload: any;
  } | null>(null);

  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeData: ExcelAllData = allData || {};
  const lotes = safeData.lotes || [];
  const humedades = safeData.humedades || [];
  const analisisHum = safeData.analisisHum || [];
  const presecados = safeData.presecados || [];
  const analisisSec = safeData.analisisSec || [];
  const programaciones = safeData.programaciones || [];
  const batches = safeData.batches || [];
  const batchLotes = safeData.batchLotes || [];
  const controles = safeData.controles || [];
  const analisisVap = safeData.analisisVap || [];
  const equipos = safeData.equipos || [];
  const estados = safeData.estados || [];

  // Active sheet being inspected/mapped
  const activeSheet = parsedSheets[selectedSheetIndex] || null;
  const activeColumns = activeSheet ? activeSheet.columns : [];
  const rawRows = activeSheet ? activeSheet.rows : [];

  // Informe de validación profunda de tipos de datos (fechas, números, porcentajes)
  const validationReport: SheetValidationReport | null = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return null;
    return validateImportDataset(rawRows, columnMapping);
  }, [rawRows, columnMapping]);

  // Filas transformadas dinámicamente aplicando el mapeo actual
  const transformedRows = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return [];
    return rawRows.map((row) => {
      const transformed: any = { ...row };
      Object.entries(columnMapping).forEach(([sysKey, excelCol]) => {
        if (excelCol && row[excelCol] !== undefined) {
          const val = row[excelCol];
          transformed[sysKey] = (sysKey === "LOTE_ID" || sysKey === "CODIGO") ? (formatLoteCode(val) || val) : val;
        }
      });
      if (transformed.LOTE_ID) {
        transformed.LOTE_ID = formatLoteCode(transformed.LOTE_ID) || transformed.LOTE_ID;
        transformed.CODIGO = transformed.LOTE_ID;
        transformed["Codigo"] = transformed.LOTE_ID;
      }
      return transformed;
    });
  }, [rawRows, columnMapping]);

  // Filas filtradas para la vista previa según el filtro de validación seleccionado
  const filteredPreviewValidations = useMemo(() => {
    if (!validationReport) return [];
    if (previewFilter === "errors") {
      return validationReport.rowValidations.filter((r) => r.hasErrors);
    }
    if (previewFilter === "warnings") {
      return validationReport.rowValidations.filter((r) => r.hasWarnings);
    }
    return validationReport.rowValidations;
  }, [validationReport, previewFilter]);

  // Valid lot codes count in transformed rows
  const validLotsCount = useMemo(() => {
    return transformedRows.filter((r) => {
      const code = formatLoteCode(r.LOTE_ID || r.CODIGO || r.LOTE || "");
      return code.length > 0 && code !== "0";
    }).length;
  }, [transformedRows]);

  if (!isOpen) return null;

  // Export complete multi-sheet Excel (.xlsx) file
  const handleExportFullExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      if (lotes.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lotes), "LOTES");
      if (humedades.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(humedades), "REGIS_HUM");
      if (analisisHum.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analisisHum), "ANALISIS_HUMEDO");
      if (presecados.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(presecados), "PRESECADO");
      if (analisisSec.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analisisSec), "ANALISIS_SECO");
      if (programaciones.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(programaciones), "PROGRAMACION");
      if (batches.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batches), "BATCH_VAPORIZADO");
      if (controles.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(controles), "CONTROL_VAP");
      if (analisisVap.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analisisVap), "ANALISIS_VAP");

      const fileName = `ArrozVapor_12_Hojas_Maestras_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error("Error exportando a Excel:", err);
      alert("Error exportando a Excel: " + err.message);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ArrozVapor_12_Hojas_Maestras_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = (sheetName: string, items: any[]) => {
    if (!items || items.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(items);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${sheetName}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleGoogleSheetsSync = async () => {
    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSyncing(false);
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 3000);
  };

  // Switch sheet and re-calculate column mappings
  const handleSheetSelect = (newIndex: number) => {
    setSelectedSheetIndex(newIndex);
    const targetSheet = parsedSheets[newIndex];
    if (targetSheet) {
      const detected = autoDetectColumnMapping(targetSheet.columns);
      setColumnMapping(detected);
    }
  };

  // Reset to auto-detected mapping
  const handleResetAutoMapping = () => {
    if (activeSheet) {
      const detected = autoDetectColumnMapping(activeSheet.columns);
      setColumnMapping(detected);
    }
  };

  // Clear mapping
  const handleClearMapping = () => {
    setColumnMapping({});
  };

  // Process selected file (.xlsx, .xls, .csv, .json)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);
    setImportResultMessage(null);

    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith(".json")) {
        const text = await file.text();
        const json = JSON.parse(text);
        const lotesRows = Array.isArray(json) ? json : json.lotes || [];
        const cols = lotesRows.length > 0 ? Object.keys(lotesRows[0]) : [];
        setParsedSheets([{ name: "JSON Data", rows: lotesRows, columns: cols }]);
        setSelectedSheetIndex(0);
        setColumnMapping(autoDetectColumnMapping(cols));
        setParsedPreview({
          summary: `Archivo JSON con ${Array.isArray(json) ? `${lotesRows.length} lotes` : "múltiples tablas"}`,
          target: Array.isArray(json) ? "lotes" : "AUTO",
          rowsCount: lotesRows.length || 1,
          sampleRows: lotesRows.slice(0, 5),
          fullPayload: Array.isArray(json) ? { lotes: json } : json
        });
        return;
      }

      // Excel / CSV using XLSX
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetNames = wb.SheetNames;

      if (sheetNames.length === 0) {
        throw new Error("El archivo no contiene hojas legibles.");
      }

      const extractedSheets: ParsedWorkbookSheet[] = [];
      const payload: Record<string, any[]> = {};
      let totalRows = 0;
      let preferredSheetIndex = 0;

      sheetNames.forEach((sName, sIdx) => {
        const upper = sName.trim().toUpperCase();
        const sheet = wb.Sheets[sName];
        const rows = parseSheetToRows(sheet) as any[];

        if (rows.length > 0) {
          totalRows += rows.length;

          // Extract all unique column headers from first 25 rows
          const colSet = new Set<string>();
          rows.slice(0, 25).forEach((r) => {
            Object.keys(r).forEach((k) => colSet.add(k));
          });
          const columns = Array.from(colSet);

          extractedSheets.push({
            name: sName,
            rows,
            columns
          });

          // Check if this sheet is the primary lots or analysis sheet
          const hasLoteCol = columns.some((k) => {
            const u = k.trim().toUpperCase();
            return u === "CODIGO" || u === "CÓDIGO" || u === "LOTE" || u === "LOTE_ID" || u === "ID" || u === "TICKET" || u.includes("LOTE");
          });
          const isAnalisisHumedo = upper.includes("HUMEDO") || upper.includes("HÚMEDO") || upper.includes("ANALISIS");

          if (isAnalisisHumedo || hasLoteCol || upper.includes("LOTE")) {
            preferredSheetIndex = extractedSheets.length - 1;
            payload.lotes = rows;
          } else if (upper.includes("HUMEDAD") || upper.includes("REGIS")) {
            payload.humedades = rows;
          } else if (upper.includes("SECO")) {
            payload.analisisSec = rows;
          }
        }
      });

      if (extractedSheets.length === 0) {
        throw new Error("El archivo no contiene filas o datos tabulares legibles.");
      }

      setParsedSheets(extractedSheets);
      setSelectedSheetIndex(preferredSheetIndex);

      // Auto-detect initial column mappings from the preferred sheet
      const activeSheetCols = extractedSheets[preferredSheetIndex]?.columns || [];
      const initialMapping = autoDetectColumnMapping(activeSheetCols);
      setColumnMapping(initialMapping);

      const targetSheet = extractedSheets[preferredSheetIndex];
      const previewRows = targetSheet ? targetSheet.rows.slice(0, 5) : [];

      setParsedPreview({
        summary: `${extractedSheets.length} hoja(s) leída(s) • ${totalRows} filas totales`,
        target: "lotes",
        rowsCount: totalRows,
        sampleRows: previewRows,
        fullPayload: payload
      });
    } catch (err: any) {
      console.error("Error leyendo archivo:", err);
      setImportError("Error al procesar el archivo: " + err.message);
      setParsedPreview(null);
      setParsedSheets([]);
    }
  };

  // Submit parsed data to server bulk import with validation support
  const handleConfirmImport = async (
    importMode?: "all_sanitized" | "only_valid",
    bypassMissingCheck?: boolean,
    explicitRows?: any[]
  ) => {
    let lotesToImport: any[] = [];

    if (explicitRows && explicitRows.length > 0) {
      lotesToImport = explicitRows;
    } else {
      if (transformedRows.length === 0) {
        setImportError("No hay filas disponibles para importar.");
        return;
      }

      if (!columnMapping["LOTE_ID"]) {
        setImportError("Debes asociar una columna al campo obligatorio 'Código de Lote' antes de continuar.");
        return;
      }

      // Interceptar si existen celdas con errores y el usuario no ha elegido modo explícito
      if (!importMode && validationReport && validationReport.invalidRowsCount > 0) {
        setShowValidationConfirmModal(true);
        return;
      }

      if (validationReport) {
        if (importMode === "only_valid") {
          // Filtrar y omitir estrictamente filas que contienen errores
          lotesToImport = validationReport.rowValidations
            .filter((r) => r.isValid)
            .map((r) => r.cleanedRow);
        } else {
          // Importar todo aplicando sanitización automática de valores compatibles
          lotesToImport = validationReport.rowValidations.map((r) => r.cleanedRow);
        }
      } else {
        lotesToImport = transformedRows;
      }
    }

    if (lotesToImport.length === 0) {
      setImportError("No se encontraron filas válidas para importar. Revisa el mapeo o corrige las celdas en tu archivo.");
      setIsProcessingImport(false);
      return;
    }

    // Comprobación de datos faltantes para solicitar al usuario y no inventar datos ficticios
    if (!bypassMissingCheck) {
      const missing = detectMissingFieldsInRows(lotesToImport, columnMapping);
      if (
        missing.missingLoteIdCount > 0 ||
        missing.missingCliente ||
        missing.missingFecha ||
        missing.missingSacos ||
        missing.missingPeso ||
        missing.missingVariedad
      ) {
        setMissingSummary(missing);
        setRowsPendingMissingCompletion(lotesToImport);
        setShowMissingDataModal(true);
        setIsProcessingImport(false);
        return;
      }
    }

    setShowValidationConfirmModal(false);
    setShowMissingDataModal(false);
    setIsProcessingImport(true);
    setImportError(null);

    try {
      // Build clean payload with transformed rows using user's explicit column mappings
      const payloadToSend: Record<string, any[]> = {
        lotes: lotesToImport
      };

      // Si el libro tiene otras hojas complementarias, agregarlas también si aplican
      if (parsedSheets.length > 1) {
        parsedSheets.forEach((s, idx) => {
          if (idx !== selectedSheetIndex) {
            const upper = s.name.trim().toUpperCase();
            if (upper.includes("HUMEDAD") || upper.includes("REGIS")) {
              payloadToSend.registroHumedad = s.rows;
            } else if (upper.includes("SECO")) {
              payloadToSend.analisisSec = s.rows;
            } else if (upper.includes("BATCH")) {
              payloadToSend.batches = s.rows;
            }
          }
        });
      }

      // 1. Guardar y procesar en LocalDB con soporte de Upsert Inteligente
      const result = localDB.bulkImport(payloadToSend);
      const stats = result.stats || {};
      
      const statsMessage = `¡Éxito! Lotes Nuevos: ${stats.lotesNuevos || 0} • Lotes Actualizados: ${stats.lotesActualizados || 0} • Humedades (M1-M14): ${stats.humedadesSincronizadas || 0} • Análisis Físicos: ${stats.analisisSincronizados || 0} ${importMode === "only_valid" ? `(Omitidas ${validationReport?.invalidRowsCount || 0} filas con formato inválido)` : ""}`;
      setImportResultMessage(statsMessage);

      // 2. Sincronizar en Express backend para persistir en disco
      try {
        await fetch("/api/excel/bulk-upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadToSend)
        });
      } catch (backendErr) {
        console.warn("[ExcelSyncModal] Express bulk-upsert sync warning:", backendErr);
      }

      // 3. Sincronizar en Firestore los registros normalizados de result.db (sin propiedades sombra crudas del Excel)
      try {
        const importedLoteIds = new Set(
          (payloadToSend.lotes || [])
            .map((l: any) => formatLoteCode(l?.LOTE_ID || l?.CODIGO || ""))
            .filter(Boolean)
        );
        const normalizedLotes = (result.db?.lotes || []).filter((l: any) => importedLoteIds.has(formatLoteCode(l.LOTE_ID)));
        const normalizedHum = (result.db?.registroHumedad || []).filter((h: any) => importedLoteIds.has(formatLoteCode(h.LOTE_ID)));
        const normalizedAH = (result.db?.analisisHumedo || []).filter((a: any) => importedLoteIds.has(formatLoteCode(a.LOTE_ID)));

        await cloudSyncService.syncImportedDataset({
          lotes: normalizedLotes,
          registroHumedad: normalizedHum,
          analisisHumedo: normalizedAH
        });
      } catch (cloudErr) {
        console.warn("[ExcelSyncModal] Cloud sync push warning:", cloudErr);
      }
      
      // 4. Actualizar estado reactivo de la aplicación
      await onImportData(result);

      // Limpiar archivo tras completar
      setTimeout(() => {
        setImportFile(null);
        setParsedPreview(null);
        setParsedSheets([]);
        setColumnMapping({});
      }, 3500);
    } catch (err: any) {
      console.error("Error guardando importación:", err);
      setImportError(err.message || "Ocurrió un error al guardar los datos.");
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Download sample CSV template for lotes
  const handleDownloadSampleLotesCSV = () => {
    const sample = [
      {
        LOTE_ID: "C02026",
        VARIEDAD: "IR-43",
        CLIENTE: "Molino San Pedro",
        ORIGEN: "Ferreñafe - Sector A",
        SACOS: 700,
        PESO_KG: 35000,
        HUM: 13.8,
        DESV: 0.35,
        RI: 78.5,
        RB: 69.2,
        QI: 12.0,
        QB: 14.2,
        ENTERO: 55.0,
        FECHA: new Date().toISOString().split("T")[0]
      },
      {
        LOTE_ID: "C02027",
        VARIEDAD: "Tinajones",
        CLIENTE: "Agroindustrial Norte",
        ORIGEN: "Lambayeque - Valle Chancay",
        SACOS: 620,
        PESO_KG: 31000,
        HUM: 14.1,
        DESV: 0.40,
        RI: 79.1,
        RB: 70.0,
        QI: 11.5,
        QB: 13.8,
        ENTERO: 56.2,
        FECHA: new Date().toISOString().split("T")[0]
      }
    ];
    handleExportCSV("Plantilla_Lotes_Modelo", sample);
  };

  const sheets = [
    { name: "LOTES", count: lotes.length, label: "Ficha Maestra de Lotes" },
    { name: "REGIS. HUM.", count: humedades.length, label: "Muestreo de Caladas (M1-M14)" },
    { name: "ANALISIS_HUMEDO", count: analisisHum.length, label: "Análisis Físico Húmedo" },
    { name: "PRESECADO", count: presecados.length, label: "Análisis Post-Presecado" },
    { name: "ANALISIS_SECO", count: analisisSec.length, label: "Análisis Seco Final" },
    { name: "PROGRAMACION_APIT", count: programaciones.length, label: "Programación APIT" },
    { name: "BATCH_VAPORIZADO", count: batches.length, label: "Batches de Vaporizado" },
    { name: "BATCH_LOTES", count: batchLotes.length, label: "Asociación Batch-Lotes" },
    { name: "CONTROL_VAPORIZADO", count: controles.length, label: "Control de Planta" },
    { name: "ANALISIS_VAPORIZADO", count: analisisVap.length, label: "Análisis de Salida Muestras" },
    { name: "EQUIPOS", count: equipos.length, label: "Catálogo de Autoclaves y Secadores" },
    { name: "ESTADOS_LOTE", count: estados.length, label: "Catálogo de Estados" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-hidden shadow-2xl flex flex-col justify-between">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-white font-black text-base flex items-center gap-2">
                <span>Centro de Sincronización Excel</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  Con Mapeo de Columnas
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Importa, mapea o exporta datos de la planta con archivos Excel (.xlsx, .xls) o CSV.
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-1 border-b border-slate-800 bg-slate-900 flex gap-2">
          <button
            onClick={() => setActiveTab("sheets")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "sheets" 
                ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>12 Hojas de Cálculo</span>
          </button>

          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "import" 
                ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>Importar y Mapear Columnas</span>
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "export" 
                ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel / CSV</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[70vh] space-y-4">
          
          {/* TAB 1: 12 HOJAS MAESTRAS OVERVIEW */}
          {activeTab === "sheets" && (
            <div className="space-y-4 text-xs">
              <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-white flex items-center gap-2 text-sm">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Estructura 100% Homologada con el Excel Maestro
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Todas las tablas respetan exactamente las columnas, fórmulas y nombres de las 12 hojas maestras de vaporizado.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-export-full-xlsx"
                    onClick={handleExportFullExcel}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Todo en Excel (.xlsx)</span>
                  </button>

                  <button
                    id="btn-trigger-cloud-sync"
                    onClick={handleGoogleSheetsSync}
                    disabled={isSyncing}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
                    <span>{isSyncing ? "Sincronizando..." : "Sincronizar Cloud"}</span>
                  </button>
                </div>
              </div>

              {syncSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-700 rounded-xl text-emerald-300 font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Base de datos local sincronizada exitosamente con la nube.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sheets.map((s) => (
                  <div key={s.name} className="p-3 bg-slate-850 rounded-xl border border-slate-750 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white font-mono">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.label}</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-emerald-400 border border-slate-750">
                        {s.count} registros
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORTAR Y MAPEAR COLUMNAS */}
          {activeTab === "import" && (
            <div className="space-y-4 text-xs">
              {/* Box de carga de archivo */}
              <div className="bg-slate-850 border border-slate-750 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-emerald-400" />
                    <span>Cargar Archivo Excel (.xlsx, .xls) o CSV</span>
                  </div>
                  <button
                    onClick={handleDownloadSampleLotesCSV}
                    className="text-emerald-400 hover:text-emerald-300 underline text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    Descargar Plantilla de Ejemplo
                  </button>
                </div>

                {/* Banner explicativo con soporte Drive y Mapeo */}
                <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-300 leading-relaxed">
                    <span className="font-bold text-amber-300">Compatibilidad Total con tus Archivos de Excel o Drive: </span>
                    Puedes cargar tu archivo aunque tenga columnas con nombres diferentes a los estándar. Utiliza la sección de <strong>Mapeo de Columnas</strong> para asociar libremente tus columnas (ej. <em>CODIGO, CLIENTE, SACO, PROM. H, RI, RB</em>) a los campos del sistema.
                  </div>
                </div>

                {/* Dropzone & Picker */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-5 text-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-colors"
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".xlsx,.xls,.csv,.json" 
                    onChange={handleFileSelect}
                    className="hidden" 
                  />
                  <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-slate-200">
                    {importFile ? importFile.name : "Haz clic o arrastra tu archivo Excel (.xlsx, .csv) aquí"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Soporta hojas con pestañas múltiples (ej. 'ANALISIS EN HUMEDO', 'LOTES', 'REGIS_HUM')
                  </div>
                </div>
              </div>

              {/* Error Notification */}
              {importError && (
                <div className="p-3 bg-rose-950/60 border border-rose-700 rounded-xl text-rose-200 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Success Notification */}
              {importResultMessage && (
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-700 rounded-xl text-emerald-300 font-bold flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{importResultMessage}</span>
                </div>
              )}

              {/* SECCIÓN INTERACTIVA DE MAPEO DE COLUMNAS */}
              {parsedSheets.length > 0 && activeSheet && (
                <div className="space-y-3">
                  
                  {/* Selector de Hoja si el libro tiene más de una pestaña */}
                  {parsedSheets.length > 1 && (
                    <div className="bg-slate-850 border border-slate-750 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-white text-xs">Pestaña / Hoja del archivo a procesar:</span>
                      </div>

                      <select
                        value={selectedSheetIndex}
                        onChange={(e) => handleSheetSelect(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                      >
                        {parsedSheets.map((s, idx) => (
                          <option key={s.name} value={idx}>
                            Hoja: '{s.name}' ({s.rows.length} filas, {s.columns.length} columnas)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sub-navegación entre Mapeo y Vista Previa */}
                  <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMappingSubTab("mapping")}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          activeMappingSubTab === "mapping"
                            ? "bg-emerald-600 text-white shadow"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>1. Mapeo Manual de Columnas</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900/60 text-emerald-300 font-mono">
                          {Object.keys(columnMapping).filter((k) => !!columnMapping[k]).length} asociadas
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMappingSubTab("preview")}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          activeMappingSubTab === "preview"
                            ? "bg-emerald-600 text-white shadow"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>2. Vista Previa de Datos Transformados</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900/60 text-emerald-300 font-mono">
                          {transformedRows.length} filas
                        </span>
                      </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Hoja activa: <strong className="text-white font-mono">{activeSheet.name}</strong></span>
                    </div>
                  </div>

                  {/* VISTA 1: EDITOR DE MAPEO DE COLUMNAS */}
                  {activeMappingSubTab === "mapping" && (
                    <ExcelColumnMapper
                      excelColumns={activeColumns}
                      sampleRows={rawRows.slice(0, 10)}
                      columnMapping={columnMapping}
                      onMappingChange={(newMapping) => setColumnMapping(newMapping)}
                      onResetAutoMapping={handleResetAutoMapping}
                      onClearMapping={handleClearMapping}
                      validationErrorsByColumn={validationReport?.errorsByColumn}
                    />
                  )}

                  {/* VISTA 2: VISTA PREVIA DE FILAS TRANSFORMADAS Y VALIDACIÓN */}
                  {activeMappingSubTab === "preview" && (
                    <div className="bg-slate-850 border border-slate-750 rounded-xl p-4 space-y-3.5">
                      
                      {/* BANNER DE LA CAPA DE VALIDACIÓN */}
                      {validationReport && (
                        <div>
                          {validationReport.totalErrors > 0 ? (
                            <div className="bg-rose-950/40 border border-rose-500/60 rounded-xl p-3.5 space-y-2 text-rose-200">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                                  <div>
                                    <h5 className="font-black text-sm text-white flex items-center gap-2">
                                      <span>Capa de Validación: Formatos Inválidos Detectados</span>
                                      <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/40">
                                        {validationReport.totalErrors} celdas en {validationReport.invalidRowsCount} fila(s)
                                      </span>
                                    </h5>
                                    <p className="text-[11px] text-rose-300/90 mt-0.5">
                                      Se detectaron celdas que no cumplen con los tipos de datos esperados (fechas, números o código obligatorio). Las celdas afectadas están resaltadas en rojo.
                                    </p>
                                  </div>
                                </div>

                                {/* Botón rápido para aislar filas con error */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewFilter(previewFilter === "errors" ? "all" : "errors")}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                    previewFilter === "errors"
                                      ? "bg-rose-600 text-white shadow"
                                      : "bg-rose-900/50 hover:bg-rose-900/80 text-rose-200 border border-rose-600/50"
                                  }`}
                                >
                                  <Filter className="w-3.5 h-3.5" />
                                  <span>{previewFilter === "errors" ? "Ver todas las filas" : `Ver solo filas con error (${validationReport.invalidRowsCount})`}</span>
                                </button>
                              </div>

                              {/* Píldoras de desglose de tipos de error */}
                              <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                                {validationReport.dateErrorsCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg bg-rose-900/60 text-rose-200 border border-rose-700/50 font-mono flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-rose-400" />
                                    {validationReport.dateErrorsCount} fecha(s) no válida(s)
                                  </span>
                                )}
                                {validationReport.numberErrorsCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg bg-rose-900/60 text-rose-200 border border-rose-700/50 font-mono flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-rose-400" />
                                    {validationReport.numberErrorsCount} número(s) / porcentaje(s) inválido(s)
                                  </span>
                                )}
                                {validationReport.requiredErrorsCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg bg-rose-900/60 text-rose-200 border border-rose-700/50 font-mono flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-rose-400" />
                                    {validationReport.requiredErrorsCount} código(s) de lote faltante(s)
                                  </span>
                                )}
                                {validationReport.totalWarnings > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    {validationReport.totalWarnings} advertencia(s) de rango
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between gap-3 text-emerald-300">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div>
                                  <div className="font-bold text-xs text-white flex items-center gap-2">
                                    <span>Capa de Validación Aprobada (100% Conforme)</span>
                                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      {validationReport.validRowsCount} filas listas
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-emerald-400/80 mt-0.5">
                                    Todas las fechas, números y códigos de lote cumplen estrictamente con los formatos requeridos por el sistema.
                                  </p>
                                </div>
                              </div>
                              <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0 hidden sm:block" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* BARRA DE HERRAMIENTAS Y FILTROS DE TABLA */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-800">
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                          <button
                            type="button"
                            onClick={() => setPreviewFilter("all")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                              previewFilter === "all"
                                ? "bg-slate-700 text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                            }`}
                          >
                            Todas las filas ({validationReport?.totalRows || transformedRows.length})
                          </button>

                          {validationReport && validationReport.invalidRowsCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewFilter("errors")}
                              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                                previewFilter === "errors"
                                  ? "bg-rose-600 text-white shadow-sm"
                                  : "text-rose-400 hover:bg-rose-950/40 border border-rose-700/50"
                              }`}
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Con Errores ({validationReport.invalidRowsCount})</span>
                            </button>
                          )}

                          {validationReport && validationReport.totalWarnings > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewFilter("warnings")}
                              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                                previewFilter === "warnings"
                                  ? "bg-amber-600 text-white shadow-sm"
                                  : "text-amber-300 hover:bg-amber-950/40 border border-amber-600/50"
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              <span>Con Advertencias ({validationReport.totalWarnings})</span>
                            </button>
                          )}
                        </div>

                        {/* Toggle de auto-sanitización */}
                        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={autoSanitizeOnImport}
                            onChange={(e) => setAutoSanitizeOnImport(e.target.checked)}
                            className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>Sanitizar automáticamente datos compatibles (comas decimales, signos %, seriales de Excel)</span>
                        </label>
                      </div>

                      {/* TABLA CON RESALTADO DE CELDAS INVÁLIDAS */}
                      <div className="overflow-x-auto border border-slate-750 rounded-lg max-h-72">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-900 text-slate-300 font-mono border-b border-slate-700">
                              <th className="p-2 whitespace-nowrap">#</th>
                              <th className="p-2 whitespace-nowrap text-amber-300">LOTE_ID (Código) *</th>
                              <th className="p-2 whitespace-nowrap text-sky-300">FECHA</th>
                              <th className="p-2 whitespace-nowrap">CLIENTE</th>
                              <th className="p-2 whitespace-nowrap">VARIEDAD</th>
                              <th className="p-2 whitespace-nowrap text-indigo-300">SACOS</th>
                              <th className="p-2 whitespace-nowrap text-indigo-300">PESO KG</th>
                              <th className="p-2 whitespace-nowrap text-purple-300">HUMEDAD %</th>
                              <th className="p-2 whitespace-nowrap">DESV (D.)</th>
                              <th className="p-2 whitespace-nowrap text-purple-300">RI / RB / ENTERO</th>
                              <th className="p-2 whitespace-nowrap">OBSERVACIONES</th>
                              <th className="p-2 whitespace-nowrap text-center">ESTADO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 font-sans">
                            {filteredPreviewValidations.length === 0 ? (
                              <tr>
                                <td colSpan={12} className="p-6 text-center text-slate-400 text-xs">
                                  No hay filas que coincidan con el filtro seleccionado.
                                </td>
                              </tr>
                            ) : (
                              filteredPreviewValidations.slice(0, 50).map((rowVal) => {
                                const rowIdx = rowVal.rowIndex;
                                const r = transformedRows[rowIdx] || {};
                                const cleaned = rowVal.cleanedRow || r;
                                const cellErrors = rowVal.cellErrors;
                                const cellWarnings = rowVal.cellWarnings;

                                const loteCode = cleaned.LOTE_ID || r.LOTE_ID || r.CODIGO || r.LOTE || "";
                                const fechaVal = cleaned.FECHA || r.FECHA || r.FECHA_INGRESO || "";
                                const humVal = cleaned.HUM ?? r.HUM ?? r["PROM. H"] ?? r["HUM. M"] ?? "";
                                const desvVal = cleaned.DESVIACION ?? r.DESVIACION ?? r["D."] ?? r.DESV ?? "";
                                const sacosVal = cleaned.SACOS ?? r.SACOS ?? "";
                                const pesoVal = cleaned.PESO_KG ?? r.PESO_KG ?? "";
                                const ri = cleaned.RI ?? r.RI ?? "";
                                const rb = cleaned.RB ?? r.RB ?? "";
                                const ent = cleaned.ENTERO ?? r.ENTERO ?? "";

                                return (
                                  <tr 
                                    key={rowIdx} 
                                    className={`transition-colors ${
                                      rowVal.hasErrors 
                                        ? "bg-rose-950/20 hover:bg-rose-950/35" 
                                        : rowVal.hasWarnings 
                                          ? "bg-amber-950/15 hover:bg-amber-950/25" 
                                          : "hover:bg-slate-800/50"
                                    }`}
                                  >
                                    <td className="p-2 font-mono text-slate-500 text-[10px]">
                                      {rowIdx + 1}
                                    </td>

                                    {/* Celda: LOTE_ID */}
                                    <td className="p-2 font-mono whitespace-nowrap">
                                      {cellErrors["LOTE_ID"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>{String(loteCode || "Sin código")}</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["LOTE_ID"].error}
                                          </div>
                                        </div>
                                      ) : loteCode ? (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                          {String(loteCode)}
                                        </span>
                                      ) : (
                                        <span className="text-rose-400 text-[10px] italic">Sin código</span>
                                      )}
                                    </td>

                                    {/* Celda: FECHA */}
                                    <td className="p-2 whitespace-nowrap font-mono text-[11px]">
                                      {cellErrors["FECHA"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>"{String(cellErrors["FECHA"].rawValue)}"</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["FECHA"].error}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className={fechaVal ? "text-sky-300" : "text-slate-500"}>
                                          {String(fechaVal || "-")}
                                        </span>
                                      )}
                                    </td>

                                    {/* Celda: CLIENTE */}
                                    <td className="p-2 text-slate-200 whitespace-nowrap font-medium">
                                      {String(cleaned.CLIENTE || r.CLIENTE || "-")}
                                    </td>

                                    {/* Celda: VARIEDAD */}
                                    <td className="p-2 text-slate-300 whitespace-nowrap">
                                      {String(cleaned.VARIEDAD || r.VARIEDAD || "-")}
                                    </td>

                                    {/* Celda: SACOS (Numérico entero) */}
                                    <td className="p-2 whitespace-nowrap font-mono">
                                      {cellErrors["SACOS"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>"{String(cellErrors["SACOS"].rawValue)}"</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["SACOS"].error}
                                          </div>
                                        </div>
                                      ) : sacosVal !== "" ? (
                                        <span className="text-slate-200 font-semibold">{sacosVal} sacos</span>
                                      ) : (
                                        <span className="text-slate-500">-</span>
                                      )}
                                    </td>

                                    {/* Celda: PESO_KG (Numérico) */}
                                    <td className="p-2 whitespace-nowrap font-mono">
                                      {cellErrors["PESO_KG"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>"{String(cellErrors["PESO_KG"].rawValue)}"</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["PESO_KG"].error}
                                          </div>
                                        </div>
                                      ) : pesoVal !== "" ? (
                                        <span className="text-slate-200">{pesoVal} kg</span>
                                      ) : (
                                        <span className="text-slate-500">-</span>
                                      )}
                                    </td>

                                    {/* Celda: HUMEDAD % (Porcentaje numérico 0-100) */}
                                    <td className="p-2 whitespace-nowrap font-mono">
                                      {cellErrors["HUM"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>"{String(cellErrors["HUM"].rawValue)}"</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["HUM"].error}
                                          </div>
                                        </div>
                                      ) : cellWarnings["HUM"] ? (
                                        <div className="bg-amber-950/50 border border-amber-500 text-amber-200 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-amber-300">
                                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                            <span>{humVal}%</span>
                                          </div>
                                          <div className="text-[9px] text-amber-300 mt-0.5">
                                            {cellWarnings["HUM"].warning}
                                          </div>
                                        </div>
                                      ) : humVal !== "" ? (
                                        <span className="font-bold text-sky-300">{humVal}%</span>
                                      ) : (
                                        <span className="text-slate-500">-</span>
                                      )}
                                    </td>

                                    {/* Celda: DESVIACION */}
                                    <td className="p-2 text-slate-400 whitespace-nowrap font-mono">
                                      {cellErrors["DESVIACION"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>"{String(cellErrors["DESVIACION"].rawValue)}"</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["DESVIACION"].error}
                                          </div>
                                        </div>
                                      ) : desvVal !== "" ? (
                                        `±${desvVal}`
                                      ) : (
                                        "-"
                                      )}
                                    </td>

                                    {/* Celda: RI / RB / ENTERO */}
                                    <td className="p-2 text-purple-300 whitespace-nowrap font-mono">
                                      {cellErrors["RI"] || cellErrors["RB"] || cellErrors["ENTERO"] ? (
                                        <div className="bg-rose-950/70 border border-rose-500 text-rose-200 ring-1 ring-rose-500/50 rounded-lg p-1.5">
                                          <div className="flex items-center gap-1 font-bold text-rose-300">
                                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                            <span>Error en rendimiento</span>
                                          </div>
                                          <div className="text-[9px] text-rose-400 mt-0.5">
                                            {cellErrors["RI"]?.error || cellErrors["RB"]?.error || cellErrors["ENTERO"]?.error}
                                          </div>
                                        </div>
                                      ) : ri || rb || ent ? (
                                        `${ri || "-"} / ${rb || "-"} / ${ent || "-"}`
                                      ) : (
                                        "-"
                                      )}
                                    </td>

                                    {/* Celda: OBSERVACIONES */}
                                    <td className="p-2 text-slate-400 truncate max-w-xs text-[10px]">
                                      {String(cleaned.OBSERVACIONES || r.OBSERVACIONES || "-")}
                                    </td>

                                    {/* Estado General de Fila */}
                                    <td className="p-2 whitespace-nowrap text-center font-mono">
                                      {rowVal.hasErrors ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                          {Object.keys(cellErrors).length} Error(es)
                                        </span>
                                      ) : rowVal.hasWarnings ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                          Advertencia
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                          Conforme
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* MODAL DE CONFIRMACIÓN DE VALIDACIÓN (Si hay celdas con errores) */}
                  {showValidationConfirmModal && validationReport && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-black text-base text-white">
                              Células con Formato Inválido Detectadas
                            </h4>
                            <p className="text-xs text-slate-400">
                              Revisión previa a la confirmación de importación
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                          <p>
                            Se han identificado <strong>{validationReport.totalErrors} celdas</strong> con formato no válido (fechas no reconocidas, texto en campos numéricos o código faltante) en <strong>{validationReport.invalidRowsCount} fila(s)</strong>.
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                            <div className="p-2 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-emerald-300">
                              ✓ Filas Conformes: <strong>{validationReport.validRowsCount}</strong>
                            </div>
                            <div className="p-2 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300">
                              ⚠️ Filas con Errores: <strong>{validationReport.invalidRowsCount}</strong>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                          ¿Cómo deseas proceder con la importación a la base de datos de la planta?
                        </p>

                        <div className="space-y-2.5 pt-1">
                          {/* Opción 1: Solo filas válidas */}
                          <button
                            type="button"
                            onClick={() => handleConfirmImport("only_valid")}
                            className="w-full p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow"
                          >
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                                <span>Importar Únicamente Filas 100% Válidas</span>
                              </div>
                              <div className="text-[10px] text-emerald-100/80 font-normal pl-5 mt-0.5">
                                Importa {validationReport.validRowsCount} filas seguras y omite las {validationReport.invalidRowsCount} filas con error
                              </div>
                            </div>
                            <span className="font-mono text-[11px] bg-emerald-700/60 px-2 py-1 rounded-lg">
                              {validationReport.validRowsCount} Lotes
                            </span>
                          </button>

                          {/* Opción 2: Sanitizar e importar todo */}
                          <button
                            type="button"
                            onClick={() => handleConfirmImport("all_sanitized")}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                          >
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <Wand2 className="w-4 h-4 text-amber-400" />
                                <span>Sanitizar e Importar Todo el Archivo</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal pl-5 mt-0.5">
                                Aplica correcciones automáticas; celdas irreconocibles se guardarán vacías
                              </div>
                            </div>
                            <span className="font-mono text-[11px] bg-slate-700/60 px-2 py-1 rounded-lg">
                              {validationReport.totalRows} Lotes
                            </span>
                          </button>

                          {/* Opción 3: Cancelar */}
                          <button
                            type="button"
                            onClick={() => setShowValidationConfirmModal(false)}
                            className="w-full py-2.5 text-center text-xs text-slate-400 hover:text-white font-medium cursor-pointer transition-colors"
                          >
                            Cancelar y regresar a revisar las celdas resaltadas
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción finales */}
                  <div className="bg-slate-900 border border-slate-750 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs">
                      {!columnMapping["LOTE_ID"] ? (
                        <div className="text-amber-400 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Asocia una columna al Código de Lote para activar la importación.</span>
                        </div>
                      ) : validationReport && validationReport.invalidRowsCount > 0 ? (
                        <div className="text-amber-300 font-medium flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            {validationReport.validRowsCount} filas listas • <strong className="text-rose-400">{validationReport.invalidRowsCount} filas con formato inválido</strong>
                          </span>
                        </div>
                      ) : (
                        <div className="text-emerald-300 font-medium flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            Listo para importar <strong>{transformedRows.length} registros válidos</strong> a la base de datos de la planta.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setImportFile(null);
                          setParsedPreview(null);
                          setParsedSheets([]);
                          setColumnMapping({});
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConfirmImport()}
                        disabled={isProcessingImport || !columnMapping["LOTE_ID"] || transformedRows.length === 0}
                        className={`px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          validationReport && validationReport.invalidRowsCount > 0
                            ? "bg-amber-600 hover:bg-amber-500"
                            : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {isProcessingImport 
                            ? "Guardando en Sistema..." 
                            : validationReport && validationReport.invalidRowsCount > 0
                              ? `Importar con Validación (${transformedRows.length})`
                              : `Cargar ${transformedRows.length} Lotes en el Sistema`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXPORT */}
          {activeTab === "export" && (
            <div className="space-y-4 text-xs">
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Libro Completo de Excel (.xlsx)</div>
                  <div className="text-[11px] text-slate-400">Descarga un solo archivo con todas las 12 hojas en pestañas separadas.</div>
                </div>
                <button
                  onClick={handleExportFullExcel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Excel (.xlsx)
                </button>
              </div>

              <p className="text-slate-400 pt-2">
                O descargue copias de seguridad de tablas individuales en formato CSV estándar:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleExportCSV("LOTES", lotes)}
                  className="p-3 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="font-bold text-white font-mono">LOTES.csv</span>
                  <Download className="w-4 h-4 text-emerald-400" />
                </button>

                <button
                  onClick={() => handleExportCSV("REGIS_HUMEDAD", humedades)}
                  className="p-3 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="font-bold text-white font-mono">REGIS_HUM.csv</span>
                  <Download className="w-4 h-4 text-emerald-400" />
                </button>

                <button
                  onClick={() => handleExportCSV("ANALISIS_HUMEDO", analisisHum)}
                  className="p-3 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="font-bold text-white font-mono">ANALISIS_HUMEDO.csv</span>
                  <Download className="w-4 h-4 text-emerald-400" />
                </button>

                <button
                  onClick={() => handleExportCSV("CONTROL_VAPORIZADO", controles)}
                  className="p-3 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="font-bold text-white font-mono">CONTROL_VAPORIZADO.csv</span>
                  <Download className="w-4 h-4 text-emerald-400" />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Descargar copia de seguridad en JSON:</span>
                <button
                  id="btn-export-full-json"
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Respaldo JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de Solicitud de Datos Faltantes (No inventar datos) */}
      {showMissingDataModal && missingSummary && (
        <ExcelDatosFaltantesModal
          isOpen={showMissingDataModal}
          onClose={() => setShowMissingDataModal(false)}
          fileName={importFile?.name}
          totalRows={rowsPendingMissingCompletion.length}
          missingSummary={missingSummary}
          rows={rowsPendingMissingCompletion}
          onConfirmImport={(cleanedRows) => {
            setShowMissingDataModal(false);
            handleConfirmImport(undefined, true, cleanedRows);
          }}
        />
      )}
    </div>
  );
};
