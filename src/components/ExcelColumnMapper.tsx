import React, { useMemo } from "react";
import { 
  ArrowRight, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Droplet, 
  FlaskConical, 
  FileSpreadsheet, 
  HelpCircle,
  Hash,
  User,
  Scale,
  Calendar,
  MapPin,
  FileText,
  Percent
} from "lucide-react";
import { 
  FieldDataType, 
  validateDateValue, 
  validateNumberValue 
} from "../utils/excelValidation";

export interface SystemField {
  key: string;
  label: string;
  category: "lote" | "humedad" | "calidad";
  type?: FieldDataType;
  required?: boolean;
  min?: number;
  max?: number;
  integerOnly?: boolean;
  description: string;
  example: string;
  aliases: string[];
}

export const SYSTEM_FIELDS: SystemField[] = [
  // --- CAMPOS DE RECEPCIÓN Y LOTE ---
  {
    key: "LOTE_ID",
    label: "Código / N° de Lote",
    category: "lote",
    type: "string",
    required: true,
    description: "Identificador único o número de lote/ticket",
    example: "6964, C02026, L-01",
    aliases: ["CODIGO", "CÓDIGO", "LOTE", "LOTE_ID", "COD", "ID", "TICKET", "NRO LOTE", "NRO_LOTE", "N° LOTE", "FICHA", "NUMERO", "NUMERO_LOTE"]
  },
  {
    key: "CLIENTE",
    label: "Cliente / Productor",
    category: "lote",
    type: "string",
    description: "Nombre del agricultor, productor o molino",
    example: "AGROINDUSTRIA DEL NORTE, MOLINO SAN PEDRO",
    aliases: ["CLIENTE / AGRICULTOR / PRODUCTOR", "CLIENTE/AGRICULTOR/PRODUCTOR", "CLIENTE", "PRODUCTOR", "AGRICULTOR", "PROVEEDOR", "SEÑOR", "NOMBRE", "CLIENT", "RAZON SOCIAL", "CLIENTE / PRODUCTOR", "AGRO", "DUEÑO", "DUENO"]
  },
  {
    key: "VARIEDAD",
    label: "Variedad de Arroz",
    category: "lote",
    type: "string",
    description: "Variedad botánica recibida",
    example: "Tinajones Extra, IR-43, Mallares",
    aliases: ["VARIEDAD", "VARIEDA", "VARIEDAD ARROZ", "VARIEDAD DE ARROZ", "VAR", "TIPO ARROZ", "TIPO DE ARROZ", "TIPO", "VARIEDADES"]
  },
  {
    key: "SACOS",
    label: "Cantidad de Sacos",
    category: "lote",
    type: "number",
    integerOnly: true,
    min: 0,
    description: "Número total de sacos ingresados a planta (entero)",
    example: "700, 620, 150",
    aliases: ["SACOS", "SACO", "CANTIDAD", "BULTOS", "BOLSAS", "NRO SACOS", "N° SACOS", "CANTIDAD DE SACOS", "CANT", "BULT"]
  },
  {
    key: "PESO_KG",
    label: "Peso Neto Balanza (Kg)",
    category: "lote",
    type: "number",
    min: 0,
    description: "Peso total neto en kilogramos (numérico)",
    example: "35000, 31000",
    aliases: ["PESO_KG", "PESO (KG)", "PESO (Kg)", "PESO(KG)", "PESO (kg)", "PESO NETO (KG)", "PESO EN KG", "PESO KG", "PESO", "KILOS", "TOTAL_KG", "PESO_NETO", "PESO NETO", "KG", "NETO"]
  },
  {
    key: "FECHA",
    label: "Fecha de Ingreso",
    category: "lote",
    type: "date",
    description: "Fecha de recepción o muestreo (AAAA-MM-DD o DD/MM/AAAA)",
    example: "2026-09-24, 24/09/2026",
    aliases: ["FECHA_INGRESO", "FECHA DE RECEPCION", "FECHA DE RECEPCIÓN", "FECHA RECEPCION", "FECHA RECEPCIÓN", "FECHA DE INGRESO", "FECHA", "FECHA INGRESO", "FECHA_ANALISIS", "DATE", "F. INGRESO", "F. RECEPCION", "FECHA RECEPCION"]
  },
  {
    key: "UBICACION",
    label: "Ubicación / Silo / Tolva",
    category: "lote",
    type: "string",
    description: "Lugar de acopio inicial o silo asignado",
    example: "Silo 01, Tolva Recepción, Pampa",
    aliases: ["UBICACION", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ALMACÉN", "ZONA ACOPIO", "DESTINO"]
  },
  {
    key: "ZONA",
    label: "Zona / Procedencia",
    category: "lote",
    type: "string",
    description: "Valle, sector o procedencia del cultivo",
    example: "Valle Chancay, Ferreñafe",
    aliases: ["ZONA", "PROCEDENCIA", "ORIGEN", "SECTOR", "VALLE", "LUGAR"]
  },
  {
    key: "OBSERVACIONES",
    label: "Observaciones / Notas",
    category: "lote",
    type: "string",
    description: "Notas del recibidor o analista de calidad",
    example: "Grano húmedo de tolva 2, llegada tarde",
    aliases: ["OBSERVACIONES", "OBSERVACION", "OBSERVACIÓN", "OBSERVACION POR LOTE", "OBSERVACIÓN POR LOTE", "OBSERVACIONES POR LOTE", "OBS POR LOTE", "OBS LOTE", "OBS", "OBS.", "NOTA", "DETALLE", "COMENTARIOS", "COMENTARIO", "NOTAS"]
  },

  // --- CAMPOS DE HUMEDAD ---
  {
    key: "HUM",
    label: "Humedad Promedio (%)",
    category: "humedad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje promedio de humedad medido (número 0 - 100%)",
    example: "13.8, 14.2, 12.5",
    aliases: ["HUM", "PROM. H", "PROM H", "PROM_H", "HUM. M", "HUMEDAD", "HUMEDADES", "H. PROMEDIO", "HUM PROM", "%H", "PROM.", "HUMEDAD %", "H%"]
  },
  {
    key: "DESVIACION",
    label: "Desviación Estándar (D.)",
    category: "humedad",
    type: "number",
    min: 0,
    max: 20,
    description: "Dispersión entre caladas individuales (número)",
    example: "0.35, 0.40, 0.22",
    aliases: ["DESVIACION", "DESVIACIÓN", "D.", "DESV", "D", "DESV.", "STD", "DS", "DESVIACION ESTANDAR"]
  },
  {
    key: "HUM_MAX",
    label: "Humedad Máxima (%)",
    category: "humedad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Muestra o calada con mayor humedad registrada",
    example: "23.8, 26.2",
    aliases: ["HUM. MAX", "HUM.MAX", "HUM MAX", "HUMEDAD MAXIMA", "HUMEDAD MÁXIMA", "H. MAX", "MAX", "MAXIMA"]
  },
  {
    key: "HUM_MIN",
    label: "Humedad Mínima (%)",
    category: "humedad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Muestra o calada con menor humedad registrada",
    example: "16.5, 24.1",
    aliases: ["HUM.MIN", "HUM. MIN", "HUM MIN", "HUMEDAD MINIMA", "HUMEDAD MÍNIMA", "H. MIN", "MIN", "MINIMA"]
  },

  // --- CAMPOS DE ANÁLISIS FÍSICO / LABORATORIO ---
  {
    key: "RI",
    label: "Rendimiento Integral (RI %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje de arroz descascarado / integral (0 - 100%)",
    example: "78.5, 79.2",
    aliases: ["R. INTEGRAL", "R INTEGRAL", "RENDIMIENTO INTEGRAL", "RI", "R.I.", "R.I", "%RI", "R_I", "REND. INTEGRAL"]
  },
  {
    key: "RB",
    label: "Rendimiento Blanco (RB %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje total de arroz blanco pulido (0 - 100%)",
    example: "69.0, 71.5",
    aliases: ["R. BLANCO", "R BLANCO", "RENDIMIENTO BLANCO", "RB", "R.B.", "R.B", "%RB", "R_B", "REND. BLANCO"]
  },
  {
    key: "RM",
    label: "Rendimiento Masa (RM %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Diferencia RI - RB (salvado/polvillo)",
    example: "9.5, 8.2",
    aliases: ["RM", "RENDIMIENTO MASA", "R.M.", "%RM", "R_M"]
  },
  {
    key: "QI",
    label: "Quebrado Integral (QI %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje de grano quebrado en integral",
    example: "12.0, 14.5",
    aliases: ["QI", "QUEBRADO INTEGRAL", "Q", "QUEBRADO", "%QI", "Q_I", "QUEB. INTEGRAL"]
  },
  {
    key: "QB",
    label: "Quebrado Blanco (QB %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje de grano quebrado en blanco",
    example: "14.0, 16.2",
    aliases: ["QUEBRADO EN BLANCO", "QB", "QUEBRADO BLANCO", "%QB", "Q_B", "QUEB. BLANCO"]
  },
  {
    key: "ENTERO",
    label: "Grano Entero (%)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Arroz blanco entero aprovechable (RB - Quebrado)",
    example: "55.0, 58.2",
    aliases: ["ENTERO", "ARROZ ENTERO", "% ENTERO", "GRANO ENTERO", "ENTEROS"]
  },
  {
    key: "TT",
    label: "Total Trizado / Tiza (TT %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Granos con textura de tiza o yesados",
    example: "1.2, 0.8",
    aliases: ["TIZA. TOTAL", "TIZA.TOTAL", "TIZA TOTAL", "TT", "TOTAL TRIZADO", "TIZA", "%TT", "T_T"]
  },
  {
    key: "TP",
    label: "Punto Negro / Yesado (TP %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Defectos de punta o manchas oscuras",
    example: "0.5, 0.3",
    aliases: ["TIZA. PARCIAL", "TIZA.PARCIAL", "TIZA PARCIAL", "TP", "T. PUNT.", "T_PUNT", "PUNTO NEGRO", "PUNTOS", "%TP", "T_P"]
  },
  {
    key: "M",
    label: "Granos Manchados (M %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje de granos manchados por hongos o calor",
    example: "0.4, 0.6",
    aliases: ["MANCHA", "M", "MANCHADO", "MANCHADOS", "%M", "GRANOS MANCHADOS"]
  },
  {
    key: "TZ",
    label: "Trizado (TZ %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Fisuras internas del grano",
    example: "2.1, 1.8",
    aliases: ["TZ", "TRIZADO", "%TZ", "T_Z"]
  },
  {
    key: "GR",
    label: "Granos Rojos (GR %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Estrías rojas o arroz rojo silvestre",
    example: "0.2, 0.5",
    aliases: ["GRANO ROJO", "GR", "ROJO", "ROJOS", "GRANOS ROJOS", "%GR", "G_R"]
  },
  {
    key: "GI",
    label: "Grano Inmaduro (GI %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Granos no formados completamente o lechosos",
    example: "1.6, 1.8",
    aliases: ["GRANO INM", "GRANO INM.", "GRANO.INM", "GRANO INMADURO", "GRANOS INMADUROS", "INMADURO", "YESOSO", "GI", "G.I.", "%GI", "G_I", "INM"]
  },
  {
    key: "GV",
    label: "Grano Verde (GV %)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Granos cosechados antes de su maduración",
    example: "3.8, 3.2",
    aliases: ["GRANO . VERDE", "GRANO. VERDE", "GRANO.VERDE", "GRANO VERDE", "GRANOS VERDES", "VERDE", "VERDES", "GV", "G.V.", "%GV", "G_V"]
  },
  {
    key: "BLI",
    label: "Blancura Integral / Kett",
    category: "calidad",
    type: "number",
    min: 0,
    max: 100,
    description: "Lectura de blancura reflectométrica en integral",
    example: "23.5, 23.9",
    aliases: ["BL. INTEGRAL", "BL.INTEGRAL", "BL INTEGRAL", "BLI", "BL", "B.INTEGRAL", "B_INTEGRAL", "BLANCURA INTEGRAL", "BLANCURA", "KETT"]
  },
  {
    key: "BLP",
    label: "Blancura Pulido",
    category: "calidad",
    type: "number",
    min: 0,
    max: 100,
    description: "Lectura de blancura reflectométrica en grano pulido",
    example: "42.0",
    aliases: ["BL.PULID.", "BL.PULID", "BL. PULID.", "BLANCURA PULIDO", "B. PULIDO", "B.PULIDO", "B_PULIDO", "BLP"]
  },
  {
    key: "IMPUREZAS",
    label: "Impurezas (%)",
    category: "calidad",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje de materias extrañas y paja",
    example: "0.5, 1.0",
    aliases: ["IMPUREZS", "IMPUREZAS", "IMP", "IMP.", "%IMP", "MATERIA EXTRAÑA"]
  }
];

// Helper: Normalizar texto para comparación sin tildes ni símbolos
export function normalizeKey(str: string): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[\s_\-\.\%\°\(\)\/\#\:\;]/g, ""); // quitar espacios y signos
}

// Algoritmo de auto-detección de mapeo inteligente
export function autoDetectColumnMapping(excelColumns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedCols = new Set<string>();

  // 1. Fase 1: Coincidencia Exacta con Key o con Alias
  for (const field of SYSTEM_FIELDS) {
    const fieldKeyNorm = normalizeKey(field.key);
    const aliasNorms = field.aliases.map(normalizeKey);

    for (const col of excelColumns) {
      if (usedCols.has(col)) continue;
      const colNorm = normalizeKey(col);

      if (colNorm === fieldKeyNorm || aliasNorms.includes(colNorm)) {
        mapping[field.key] = col;
        usedCols.add(col);
        break;
      }
    }
  }

  // 2. Fase 2: Coincidencia por Inclusión (solo para alias de longitud >= 4 caracteres)
  for (const field of SYSTEM_FIELDS) {
    if (mapping[field.key]) continue; // Ya mapeado

    const eligibleAliases = field.aliases
      .map(normalizeKey)
      .filter((a) => a.length >= 4);

    for (const col of excelColumns) {
      if (usedCols.has(col)) continue;
      const colNorm = normalizeKey(col);

      const matched = eligibleAliases.some(
        (alias) => colNorm.includes(alias) || alias.includes(colNorm)
      );

      if (matched) {
        mapping[field.key] = col;
        usedCols.add(col);
        break;
      }
    }
  }

  return mapping;
}

interface ExcelColumnMapperProps {
  excelColumns: string[];
  sampleRows: any[];
  columnMapping: Record<string, string>;
  onMappingChange: (newMapping: Record<string, string>) => void;
  onResetAutoMapping: () => void;
  onClearMapping: () => void;
  validationErrorsByColumn?: Record<string, number>;
}

export const ExcelColumnMapper: React.FC<ExcelColumnMapperProps> = ({
  excelColumns,
  sampleRows,
  columnMapping,
  onMappingChange,
  onResetAutoMapping,
  onClearMapping,
  validationErrorsByColumn = {}
}) => {
  const [activeCategory, setActiveCategory] = React.useState<"all" | "lote" | "humedad" | "calidad">("all");
  const [searchTerm, setSearchTerm] = React.useState("");

  // Mapa de muestras de valores para cada columna de Excel (primeras filas con valor)
  const columnSampleValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const col of excelColumns) {
      for (const row of sampleRows) {
        if (row && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== "") {
          map[col] = String(row[col]).slice(0, 30);
          break;
        }
      }
    }
    return map;
  }, [excelColumns, sampleRows]);

  // Manejar cambio de un mapeo individual
  const handleFieldChange = (fieldKey: string, excelCol: string) => {
    const updated = { ...columnMapping };
    if (!excelCol) {
      delete updated[fieldKey];
    } else {
      updated[fieldKey] = excelCol;
    }
    onMappingChange(updated);
  };

  // Filtrado de campos
  const filteredFields = useMemo(() => {
    return SYSTEM_FIELDS.filter((f) => {
      const matchCat = activeCategory === "all" || f.category === activeCategory;
      if (!matchCat) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        f.label.toLowerCase().includes(s) ||
        f.key.toLowerCase().includes(s) ||
        f.description.toLowerCase().includes(s)
      );
    });
  }, [activeCategory, searchTerm]);

  // Estadísticas de mapeo
  const mappedCount = Object.keys(columnMapping).filter((k) => !!columnMapping[k]).length;
  const isLoteIdMapped = Boolean(columnMapping["LOTE_ID"]);
  const totalFieldErrors = Object.values(validationErrorsByColumn).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Header con estadísticas y acciones rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>Mapeo Manual de Columnas</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  {mappedCount} de {SYSTEM_FIELDS.length} asociados
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Asocia las columnas de tu Excel a los campos internos requeridos por el sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones: Auto-detectar / Limpiar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetAutoMapping}
            className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 hover:border-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Detectar automáticamente columnas por nombres y sinónimos comunes"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Detectar</span>
          </button>

          <button
            type="button"
            onClick={onClearMapping}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-300 border border-slate-750 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Quitar todas las asociaciones"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Alerta de campo requerido LOTE_ID */}
      {!isLoteIdMapped ? (
        <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-200 text-xs flex items-center gap-2 animate-pulse">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Campo obligatorio:</strong> Debes asociar una columna al <strong>Código de Lote</strong> (ej. CODIGO, LOTE, ID, TICKET) para poder importar.
          </span>
        </div>
      ) : (
        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Código de Lote vinculado a la columna: <strong className="font-mono text-white underline">{columnMapping["LOTE_ID"]}</strong>
            </span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono">Requerido cumplido</span>
        </div>
      )}

      {/* Categorías & Filtro */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Pills de Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === "all"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            Todos ({SYSTEM_FIELDS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("lote")}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeCategory === "lote"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-300" />
            <span>Recepción y Lotes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("humedad")}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeCategory === "humedad"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Droplet className="w-3.5 h-3.5 text-sky-300" />
            <span>Humedad</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("calidad")}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeCategory === "calidad"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-purple-300" />
            <span>Laboratorio Físico</span>
          </button>
        </div>

        {/* Input de Búsqueda Rápida */}
        <input
          type="text"
          placeholder="Buscar campo (ej. Cliente, Humedad, RI)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-slate-950 border border-slate-750 text-slate-200 text-xs rounded-xl px-3 py-1.5 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-60"
        />
      </div>

      {/* Grid / Lista de Campos a Mapear */}
      <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 max-h-72 overflow-y-auto bg-slate-950/40">
        {filteredFields.map((field) => {
          const mappedCol = columnMapping[field.key] || "";
          const sampleVal = mappedCol ? columnSampleValues[mappedCol] : null;

          return (
            <div
              key={field.key}
              className={`p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                mappedCol
                  ? "bg-emerald-950/15 hover:bg-emerald-950/25"
                  : "hover:bg-slate-850/60"
              }`}
            >
              {/* Información del Campo Interno */}
              <div className="sm:w-1/2 pr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs text-white">
                    {field.label}
                  </span>

                  {field.required && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Requerido
                    </span>
                  )}

                  {/* Badge de Tipo de Dato */}
                  {field.type === "date" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      Fecha
                    </span>
                  )}
                  {field.type === "number" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" />
                      {field.integerOnly ? "Número Entero" : "Número"}
                    </span>
                  )}
                  {field.type === "percentage" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Percent className="w-2.5 h-2.5" />
                      Porcentaje
                    </span>
                  )}

                  {/* Badge si hay errores detectados en la columna */}
                  {Boolean(validationErrorsByColumn[field.key]) && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/50 flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                      {validationErrorsByColumn[field.key]} error(es) detectado(s)
                    </span>
                  )}

                  <span className="font-mono text-[10px] text-slate-500">
                    ({field.key})
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {field.description}
                </div>

                {field.example && (
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Ej: <span className="text-slate-400">{field.example}</span>
                  </div>
                )}
              </div>

              {/* Selector de Columna de Excel */}
              <div className="sm:w-1/2 flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden sm:block" />

                <div className="flex-1">
                  <select
                    value={mappedCol}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl px-2.5 py-1.5 border transition-all focus:outline-none cursor-pointer ${
                      mappedCol
                        ? validationErrorsByColumn[field.key]
                          ? "bg-slate-900 border-rose-500 text-rose-300 ring-1 ring-rose-500/30 font-mono"
                          : "bg-slate-900 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30 font-mono"
                        : "bg-slate-900/80 border-slate-750 text-slate-400 focus:border-slate-500"
                    }`}
                  >
                    <option value="">-- (Omitir / No mapear) --</option>
                    {excelColumns.map((col) => {
                      const sample = columnSampleValues[col];
                      return (
                        <option key={col} value={col}>
                          {col} {sample ? `(ej: "${sample}")` : ""}
                        </option>
                      );
                    })}
                  </select>

                  {/* Muestra valor de ejemplo real extraído y validación preliminar */}
                  {mappedCol && sampleVal && (() => {
                    let sampleValidation: { isValid: boolean; error?: string } = { isValid: true };
                    if (field.type === "date") {
                      sampleValidation = validateDateValue(sampleVal);
                    } else if (field.type === "number" || field.type === "percentage") {
                      sampleValidation = validateNumberValue(sampleVal, {
                        min: field.min,
                        max: field.max,
                        integerOnly: field.integerOnly,
                        isPercentage: field.type === "percentage"
                      });
                    }

                    return (
                      <div className="flex items-center justify-between text-[10px] font-mono mt-1 gap-2">
                        <div className="truncate text-slate-400">
                          Muestra: <span className="text-slate-200">"{sampleVal}"</span>
                        </div>
                        {!sampleValidation.isValid ? (
                          <span className="text-rose-400 font-bold shrink-0 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            Formato no compatible
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-medium shrink-0 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Formato válido
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda y ayuda */}
      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>
            Las columnas no asociadas se ignorarán o utilizarán valores predeterminados seguros.
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          Columnas detectadas en archivo: {excelColumns.length}
        </div>
      </div>
    </div>
  );
};
