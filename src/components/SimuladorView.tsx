import React, { useState } from "react";
import { AISimulationResult, Lote, UserProfile } from "../types";
import { 
  Sparkles, 
  Play, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Gauge, 
  Clock, 
  Flame, 
  Thermometer, 
  Droplet, 
  Info,
  Loader2,
  TrendingUp,
  Percent
} from "lucide-react";

interface SimuladorViewProps {
  lotes?: Lote[];
  currentUser?: UserProfile;
  onRequestSimulation: (params: any) => Promise<AISimulationResult>;
}

export const SimuladorView: React.FC<SimuladorViewProps> = ({
  lotes = [],
  currentUser,
  onRequestSimulation
}) => {
  // Simulator Parameters State
  const [variedad, setVariedad] = useState<string>("Tinajones Extra");
  const [humedadIngreso, setHumedadIngreso] = useState<number>(14.2);
  const [presionBar, setPresionBar] = useState<number>(1.85);
  const [rpm, setRpm] = useState<number>(18);
  const [tiempoVaporizado, setTiempoVaporizado] = useState<number>(28);
  const [tiempoReposo, setTiempoReposo] = useState<number>(45);
  const [tempSecado, setTempSecado] = useState<number>(75);

  const [isLoading, setIsLoading] = useState(false);
  const [simResult, setSimResult] = useState<AISimulationResult | null>({
    es_simulacion: true,
    advertencia: "ESTO ES UNA SIMULACIÓN TEÓRICA / PREDICTIVA. No modifica los datos reales de la planta.",
    predicciones: {
      quebrado_incremento_estimado_pct: 1.2,
      blancura_estimada: 31.8,
      gelatinizacion_estimada_pct: 94.5,
      humedad_salida_estimada_pct: 18.2,
      indice_exito_estimado: 93.5,
      clasificacion_proyectada: "EXITOSO"
    },
    analisis_variables: {
      impacto_presion: "La presión de 1.85 bar genera una tasa de penetración de calor uniforme sin hidrolizar los almidones superficiales.",
      impacto_tiempo_vapor: "28 minutos es la duración idónea para arroz Tinajones a 14.2% HUM para lograr gelatinización central.",
      impacto_tiempo_reposo: "45 minutos permite disipar el gradiente térmico antes de la despresurización."
    },
    alertas_simuladas: [],
    recomendacion_ajuste: "Parámetros óptimos dentro de la ventana de proceso.",
    suficiencia_datos: "ALTA"
  });

  const handleRunSimulation = async () => {
    setIsLoading(true);
    try {
      const res = await onRequestSimulation({
        variedad,
        humedadIngreso,
        presionBar,
        rpm,
        tiempoVaporizado,
        tiempoReposo,
        tempSecado
      });
      setSimResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToBaseline = () => {
    setVariedad("Tinajones Extra");
    setHumedadIngreso(14.2);
    setPresionBar(1.85);
    setRpm(18);
    setTiempoVaporizado(28);
    setTiempoReposo(45);
    setTempSecado(75);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-850 p-5 rounded-2xl border border-purple-500/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Entorno de Simulación Predictiva
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Simulador de Vaporizado & Predicción de Calidad IA
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1">
            Pruebe escenarios hipotéticos modificando presión, temperatura, tiempos y humedades para predecir el índice de éxito y riesgo de quebrado antes de encender las calderas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-reset-simulator"
            onClick={handleResetToBaseline}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer
          </button>

          <button
            id="btn-run-simulation"
            onClick={handleRunSimulation}
            disabled={isLoading}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-md transition-transform active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            {isLoading ? "Simulando con Gemini..." : "Ejecutar Simulación"}
          </button>
        </div>
      </div>

      {/* Mandatory Safety Notice */}
      <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-3.5 flex items-center gap-3 text-xs text-purple-200">
        <Info className="w-5 h-5 text-purple-400 shrink-0" />
        <div>
          <strong className="text-white">AVISO DE AMBIENTE VIRTUAL:</strong> Esta herramienta corre exclusivamente en modo simulación estocástica e inferencia física. Ningún valor ingresado aquí afecta los lotes reales ni la base de datos de producción.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls / Sliders (5 cols) */}
        <div className="lg:col-span-5 bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-700 pb-2.5">
            <Gauge className="w-4 h-4" />
            Variables del Escenario de Simulación
          </h3>

          {/* Variedad */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Variedad de Arroz
            </label>
            <select
              id="sim-variedad"
              aria-label="Seleccionar variedad de arroz para simular"
              value={variedad}
              onChange={(e) => setVariedad(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-bold"
            >
              <option value="Tinajones Extra">Tinajones Extra (Grano Largo / Resistente)</option>
              <option value="IR-43">IR-43 (Sensible a Sobrepresión)</option>
              <option value="Mallares">Mallares (Grano Medio)</option>
              <option value="Pita">Pita (Riesgo de Manchado)</option>
            </select>
          </div>

          {/* Humedad de Ingreso Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-cyan-400" /> Humedad Inicial:
              </span>
              <span className="font-bold text-cyan-400 font-mono text-sm">{humedadIngreso}%</span>
            </div>
            <input
              id="sim-slider-humedad"
              aria-label="Humedad inicial en porcentaje"
              type="range"
              min="11"
              max="20"
              step="0.1"
              value={humedadIngreso}
              onChange={(e) => setHumedadIngreso(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>11% (Seco)</span>
              <span>14% (Óptimo)</span>
              <span>20% (Húmedo)</span>
            </div>
          </div>

          {/* Presión de Vapor Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> Presión de Vapor (bar):
              </span>
              <span className="font-bold text-orange-400 font-mono text-sm">{presionBar} bar</span>
            </div>
            <input
              id="sim-slider-presion"
              aria-label="Presión de vapor en bar"
              type="range"
              min="1.0"
              max="3.0"
              step="0.05"
              value={presionBar}
              onChange={(e) => setPresionBar(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1.0 bar (Bajo)</span>
              <span>1.85 bar (Ideal)</span>
              <span>3.0 bar (Peligro)</span>
            </div>
          </div>

          {/* Tiempo de Vaporizado Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Tiempo de Vaporizado:
              </span>
              <span className="font-bold text-amber-400 font-mono text-sm">{tiempoVaporizado} min</span>
            </div>
            <input
              id="sim-slider-tiempo-vap"
              aria-label="Tiempo de vaporizado en minutos"
              type="range"
              min="10"
              max="60"
              step="1"
              value={tiempoVaporizado}
              onChange={(e) => setTiempoVaporizado(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>10 min</span>
              <span>28 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Tiempo de Reposo Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Tiempo de Reposo:
              </span>
              <span className="font-bold text-purple-400 font-mono text-sm">{tiempoReposo} min</span>
            </div>
            <input
              id="sim-slider-tiempo-rep"
              aria-label="Tiempo de reposo en minutos"
              type="range"
              min="15"
              max="90"
              step="5"
              value={tiempoReposo}
              onChange={(e) => setTiempoReposo(parseInt(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>15 min</span>
              <span>45 min</span>
              <span>90 min</span>
            </div>
          </div>

          {/* Velocidad RPM */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold text-slate-300">Velocidad de Giro Autoclave:</span>
              <span className="font-bold text-white font-mono text-sm">{rpm} RPM</span>
            </div>
            <input
              id="sim-slider-rpm"
              aria-label="Velocidad de giro del autoclave en RPM"
              type="range"
              min="8"
              max="30"
              step="1"
              value={rpm}
              onChange={(e) => setRpm(parseInt(e.target.value))}
              className="w-full accent-slate-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Results & Simulation Predictions (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {simResult && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm space-y-5">
              {/* Predicted Success Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                simResult.predicciones.clasificacion_proyectada === "EXITOSO"
                  ? "bg-emerald-950/40 border-emerald-500/50"
                  : simResult.predicciones.clasificacion_proyectada === "CONFORME"
                  ? "bg-amber-950/40 border-amber-500/50"
                  : "bg-rose-950/40 border-rose-500/50"
              }`}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Proyección del Simulador
                  </div>
                  <div className={`text-xl font-black mt-0.5 ${
                    simResult.predicciones.clasificacion_proyectada === "EXITOSO" ? "text-emerald-400" :
                    simResult.predicciones.clasificacion_proyectada === "CONFORME" ? "text-amber-400" :
                    "text-rose-400"
                  }`}>
                    Lote Proyectado: {simResult.predicciones.clasificacion_proyectada}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Índice Éxito Proyectado</div>
                  <div className="text-2xl font-black text-white">
                    {simResult.predicciones.indice_exito_estimado}%
                  </div>
                </div>
              </div>

              {/* Physical Predictions Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                {/* Δ Quebrado */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-750">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Δ Quebrado Estimado</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    +{simResult.predicciones.quebrado_incremento_estimado_pct}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Control excelente</div>
                </div>

                {/* Blancura */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-750">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Blancura Estimada</div>
                  <div className="text-lg font-black text-white mt-1">
                    {simResult.predicciones.blancura_estimada}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Kett comercial</div>
                </div>

                {/* Gelatinización */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-750">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Gelatinización</div>
                  <div className="text-lg font-black text-purple-400 mt-1">
                    {simResult.predicciones.gelatinizacion_estimada_pct}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Almidón transformado</div>
                </div>

                {/* Humedad Salida */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-750">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Humedad de Salida</div>
                  <div className="text-lg font-black text-cyan-400 mt-1">
                    {simResult.predicciones.humedad_salida_estimada_pct}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Hacia secador</div>
                </div>
              </div>

              {/* AI Physical Impact Explanations */}
              <div className="space-y-2.5 text-xs">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Análisis Termodinámico de las Variables:
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-750 text-slate-300 space-y-2">
                  <p><strong>Impacto de Presión ({presionBar} bar):</strong> {simResult.analisis_variables.impacto_presion}</p>
                  <p><strong>Impacto de Vaporizado ({tiempoVaporizado} min):</strong> {simResult.analisis_variables.impacto_tiempo_vapor}</p>
                  <p><strong>Impacto de Reposo ({tiempoReposo} min):</strong> {simResult.analisis_variables.impacto_tiempo_reposo}</p>
                </div>
              </div>

              {/* Simulated Alerts */}
              {simResult.alertas_simuladas?.length > 0 && (
                <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Alertas del Escenario:
                  </div>
                  <ul className="list-disc pl-4 text-amber-200/90 space-y-0.5">
                    {simResult.alertas_simuladas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Adjust Recommendation */}
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-lg p-3 text-xs text-purple-200">
                <strong className="text-white">Recomendación para Planta:</strong> {simResult.recomendacion_ajuste}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
