import React, { useState, useEffect, useRef } from "react";

const CUSTOM_LOGO_STORAGE_KEY = "anvap_molino_don_julio_logo_v1";

interface MolinoDonJulioLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  withCard?: boolean;
  allowUpload?: boolean;
}

/**
 * Logo Oficial de MOLINO Don Julio
 * Soporta cargar directamente el archivo de imagen original (clic o arrastrar imagen)
 * para mostrar exactamente el PNG subido por el usuario sin ninguna alteración,
 * además del SVG vectorial fiel al diseño original.
 */
export const MolinoDonJulioLogo: React.FC<MolinoDonJulioLogoProps> = ({
  className = "",
  size = "md",
  withCard = true,
  allowUpload = true,
}) => {
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncLogo = () => {
      try {
        setCustomLogoUrl(localStorage.getItem(CUSTOM_LOGO_STORAGE_KEY));
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", syncLogo);
    window.addEventListener("molino-logo-updated", syncLogo);
    return () => {
      window.removeEventListener("storage", syncLogo);
      window.removeEventListener("molino-logo-updated", syncLogo);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl) {
        try {
          localStorage.setItem(CUSTOM_LOGO_STORAGE_KEY, dataUrl);
          setCustomLogoUrl(dataUrl);
          window.dispatchEvent(new Event("molino-logo-updated"));
        } catch (err) {
          console.warn("No se pudo guardar el logo en localStorage:", err);
          setCustomLogoUrl(dataUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const dimensions =
    size === "sm"
      ? "h-9 sm:h-10 w-auto"
      : size === "lg"
      ? "h-14 sm:h-16 w-auto"
      : "h-11 sm:h-12 w-auto";

  const content = customLogoUrl ? (
    <img
      src={customLogoUrl}
      alt="MOLINO Don Julio"
      className={`${dimensions} object-contain select-none shrink-0`}
    />
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 176"
      className={`${dimensions} select-none shrink-0`}
      role="img"
      aria-label="MOLINO Don Julio"
    >
      <rect width="320" height="176" fill="#FFFFFF" />

      <defs>
        <g id="mdj-par-espiga" fill="#FDB813">
          <path d="M -0.7 0.5 C -4.2 -1.2, -6.2 -5.2, -6.8 -10.5 C -3.4 -7.5, -1.2 -4.0, -0.7 0.5 Z" />
          <path d="M 0.7 0.5 C 4.2 -1.2, 6.2 -5.2, 6.8 -10.5 C 3.4 -7.5, 1.2 -4.0, 0.7 0.5 Z" />
        </g>

        <g id="mdj-espiga-completa" fill="#FDB813">
          <path d="M -0.7 0 L -0.35 -54 L 0 -64 L 0.35 -54 L 0.7 0 Z" />
          <path d="M 0 -63 C -2.3 -55, -2.3 -48, 0 -44 C 2.3 -48, 2.3 -55, 0 -63 Z" />
          <use href="#mdj-par-espiga" transform="translate(0, -42) scale(0.84)" />
          <use href="#mdj-par-espiga" transform="translate(0, -34) scale(0.94)" />
          <use href="#mdj-par-espiga" transform="translate(0, -25.5) scale(1.0)" />
          <use href="#mdj-par-espiga" transform="translate(0, -17) scale(0.98)" />
          <use href="#mdj-par-espiga" transform="translate(0, -8.5) scale(0.90)" />
        </g>
      </defs>

      {/* 5 Espigas con bases separadas en arco */}
      <use href="#mdj-espiga-completa" transform="translate(122, 74) rotate(-14) scale(0.78)" />
      <use href="#mdj-espiga-completa" transform="translate(141, 76) rotate(-7) scale(0.90)" />
      <use href="#mdj-espiga-completa" transform="translate(160, 77) rotate(0) scale(1.02)" />
      <use href="#mdj-espiga-completa" transform="translate(179, 76) rotate(7) scale(0.90)" />
      <use href="#mdj-espiga-completa" transform="translate(198, 74) rotate(14) scale(0.78)" />

      {/* Hojas basales doradas */}
      <path
        d="M 159.5 80 C 142 79, 114 72, 86 64 C 108 76, 134 85, 159.5 84.5 Z"
        fill="#FDB813"
      />
      <path
        d="M 160.5 80 C 178 79, 206 72, 234 64 C 212 76, 186 85, 160.5 84.5 Z"
        fill="#FDB813"
      />

      {/* Hoja curva verde inferior derecha */}
      <path
        d="M 142 86.5 C 166 90.5, 200 83, 232 69.5 C 206 86.5, 172 93.5, 142 86.5 Z"
        fill="#006837"
      />

      {/* Texto MOLINO */}
      <text
        x="160"
        y="129"
        textAnchor="middle"
        fill="#006837"
        stroke="#006837"
        strokeWidth="1.2"
        fontFamily="Georgia, 'Times New Roman', Times, serif"
        fontWeight="bold"
        fontSize="45"
        textLength="226"
        lengthAdjust="spacingAndGlyphs"
      >
        MOLINO
      </text>

      {/* Barras laterales verdes y Don Julio */}
      <rect x="47" y="147" width="54" height="5.5" fill="#006837" />
      <rect x="219" y="147" width="54" height="5.5" fill="#006837" />

      <text
        x="160"
        y="157"
        textAnchor="middle"
        fill="#FDB813"
        stroke="#FDB813"
        strokeWidth="0.4"
        fontFamily="'Brush Script MT', 'Monotype Corsiva', 'Segoe Script', 'Palatino Linotype', Georgia, cursive"
        fontStyle="italic"
        fontWeight="bold"
        fontSize="29"
      >
        Don Julio
      </text>
    </svg>
  );

  return (
    <div
      data-pdf-logo="true"
      onClick={() => {
        if (allowUpload) fileInputRef.current?.click();
      }}
      className={`inline-flex items-center justify-center bg-white rounded-md overflow-hidden shrink-0 molino-logo pdf-no-logo print:hidden ${
        allowUpload ? "cursor-pointer hover:opacity-95 transition-opacity" : ""
      } ${className}`}
      title={
        allowUpload
          ? "MOLINO Don Julio (Clic para cargar el archivo PNG original de su equipo si lo desea)"
          : "MOLINO Don Julio"
      }
    >
      {allowUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
      {content}
    </div>
  );
};
