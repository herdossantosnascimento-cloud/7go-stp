"use client";

import {
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import styles from "./CarDamageMap.module.css";

export type DamageSeverity = "light" | "medium" | "severe";

export type DamageMarker = {
  id: string;
  x: number;
  y: number;
  description: string;
  severity: DamageSeverity;
  createdAt?: string;
};

export type LegacyDamageZone =
  | "front"
  | "bonnet"
  | "windscreen"
  | "roof"
  | "rear"
  | "left_front"
  | "left_rear"
  | "right_front"
  | "right_rear";

export type DamageZone = DamageMarker;

type DamageValue = DamageMarker | LegacyDamageZone | string;

type CarDamageMapProps = {
  selectedZones: DamageValue[];
  onChange: (zones: DamageMarker[]) => void;
  existingZones?: DamageValue[];
  mode?: "checkout" | "checkin";
};

const legacyPositions: Record<
  LegacyDamageZone,
  {
    x: number;
    y: number;
    description: string;
  }
> = {
  front: {
    x: 13,
    y: 55,
    description: "Frente",
  },
  bonnet: {
    x: 26,
    y: 42,
    description: "Capô",
  },
  windscreen: {
    x: 40,
    y: 31,
    description: "Para-brisas",
  },
  roof: {
    x: 54,
    y: 16,
    description: "Tejadilho",
  },
  rear: {
    x: 88,
    y: 49,
    description: "Traseira",
  },
  left_front: {
    x: 35,
    y: 55,
    description: "Lateral esquerda dianteira",
  },
  left_rear: {
    x: 67,
    y: 55,
    description: "Lateral esquerda traseira",
  },
  right_front: {
    x: 35,
    y: 83,
    description: "Lateral direita dianteira",
  },
  right_rear: {
    x: 67,
    y: 83,
    description: "Lateral direita traseira",
  },
};

const legacyZoneNames = Object.keys(legacyPositions) as LegacyDamageZone[];

const severityLabels: Record<DamageSeverity, string> = {
  light: "Ligeiro",
  medium: "Médio",
  severe: "Grave",
};

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `damage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isDamageMarker(value: DamageValue): value is DamageMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function normalizeDamageValues(
  values: DamageValue[] | undefined,
  source: "current" | "existing",
): DamageMarker[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value, index) => {
      if (isDamageMarker(value)) {
        return {
          id: value.id || `${source}-damage-${index + 1}`,
          x: Math.min(100, Math.max(0, Number(value.x) || 0)),
          y: Math.min(100, Math.max(0, Number(value.y) || 0)),
          description:
            typeof value.description === "string" ? value.description : "",
          severity:
            value.severity === "medium" || value.severity === "severe"
              ? value.severity
              : "light",
          createdAt: value.createdAt,
        };
      }

      if (
        typeof value === "string" &&
        legacyZoneNames.includes(value as LegacyDamageZone)
      ) {
        const legacy = legacyPositions[value as LegacyDamageZone];

        return {
          id: `${source}-legacy-${value}-${index}`,
          x: legacy.x,
          y: legacy.y,
          description: legacy.description,
          severity: "light" as const,
        };
      }

      return null;
    })
    .filter((value): value is DamageMarker => value !== null);
}

export default function CarDamageMap({
  selectedZones,
  onChange,
  existingZones = [],
  mode = "checkout",
}: CarDamageMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const currentMarkers = useMemo(
    () => normalizeDamageValues(selectedZones, "current"),
    [selectedZones],
  );

  const previousMarkers = useMemo(
    () => normalizeDamageValues(existingZones, "existing"),
    [existingZones],
  );

  const [editingId, setEditingId] = useState<string | null>(null);

  const editingMarker =
    currentMarkers.find((marker) => marker.id === editingId) ?? null;

  const updateMarker = (markerId: string, values: Partial<DamageMarker>) => {
    onChange(
      currentMarkers.map((marker) =>
        marker.id === markerId
          ? {
              ...marker,
              ...values,
            }
          : marker,
      ),
    );
  };

  const addMarker = (event: ReactMouseEvent<SVGSVGElement>) => {
    const target = event.target as Element;

    if (target.closest("[data-damage-marker]")) {
      return;
    }

    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const bounds = svg.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
      return;
    }

    const marker: DamageMarker = {
      id: createId(),
      x: Number(
        (((event.clientX - bounds.left) / bounds.width) * 100).toFixed(2),
      ),
      y: Number(
        (((event.clientY - bounds.top) / bounds.height) * 100).toFixed(2),
      ),
      description: "",
      severity: "light",
      createdAt: new Date().toISOString(),
    };

    onChange([...currentMarkers, marker]);
    setEditingId(marker.id);
  };

  const removeMarker = (markerId: string) => {
    const confirmed = window.confirm(
      "Pretendes remover este marcador de dano?",
    );

    if (!confirmed) {
      return;
    }

    onChange(currentMarkers.filter((marker) => marker.id !== markerId));

    if (editingId === markerId) {
      setEditingId(null);
    }
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Mapa visual</span>

          <h4>
            {mode === "checkin"
              ? "Comparação dos danos"
              : "Danos existentes na entrega"}
          </h4>

          <p>
            {mode === "checkin"
              ? "Os marcadores azuis são danos registados na entrega. Clique no carro para adicionar apenas danos novos."
              : "Clique diretamente no ponto exato do carro onde existe um risco, amolgadela ou outro dano."}
          </p>
        </div>

        <strong className={styles.counter}>
          {currentMarkers.length}{" "}
          {currentMarkers.length === 1 ? "marcador" : "marcadores"}
        </strong>
      </div>

      {mode === "checkin" && previousMarkers.length > 0 && (
        <div className={styles.legend}>
          <span>
            <i className={styles.previousLegend} />
            Danos da entrega
          </span>

          <span>
            <i className={styles.newLegend} />
            Novos danos
          </span>
        </div>
      )}

      <div className={styles.map}>
        <svg
          ref={svgRef}
          className={styles.vehicle}
          viewBox="0 0 800 360"
          role="img"
          aria-label="Mapa interativo de danos da viatura"
          onClick={addMarker}
        >
          <defs>
            <linearGradient id="carDamageBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />

              <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          <path
            className={styles.carOutline}
            d="M108 205
               L143 139
               Q155 115 183 106
               L288 74
               Q318 64 349 64
               L487 64
               Q518 65 541 83
               L621 145
               L687 164
               Q716 173 727 199
               L740 230
               Q747 249 728 259
               L690 270
               L121 270
               Q88 267 76 245
               Q67 226 82 214
               Z"
          />

          <path
            className={styles.window}
            d="M315 84 L352 78 L479 78 Q498 79 514 91 L573 139 L294 139 Z"
          />

          <line className={styles.divider} x1="395" y1="79" x2="390" y2="139" />

          <line className={styles.divider} x1="520" y1="96" x2="497" y2="139" />

          <circle className={styles.wheel} cx="210" cy="266" r="50" />

          <circle className={styles.wheelInner} cx="210" cy="266" r="25" />

          <circle className={styles.wheel} cx="615" cy="266" r="50" />

          <circle className={styles.wheelInner} cx="615" cy="266" r="25" />

          <rect
            className={styles.detail}
            x="92"
            y="207"
            width="47"
            height="20"
            rx="8"
          />

          <rect
            className={styles.detail}
            x="680"
            y="193"
            width="40"
            height="20"
            rx="8"
          />

          {previousMarkers.map((marker, index) => (
            <g
              key={marker.id}
              data-damage-marker
              className={`${styles.marker} ${styles.previousMarker}`}
              transform={`translate(${(marker.x / 100) * 800} ${
                (marker.y / 100) * 360
              })`}
              aria-label={`Dano anterior ${index + 1}`}
            >
              <circle r="17" />

              <text y="5">{index + 1}</text>
            </g>
          ))}

          {currentMarkers.map((marker, index) => (
            <g
              key={marker.id}
              data-damage-marker
              className={`${styles.marker} ${styles.currentMarker}`}
              transform={`translate(${(marker.x / 100) * 800} ${
                (marker.y / 100) * 360
              })`}
              role="button"
              tabIndex={0}
              aria-label={`Editar dano ${index + 1}`}
              onClick={(event) => {
                event.stopPropagation();
                setEditingId(marker.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setEditingId(marker.id);
                }
              }}
            >
              <circle r="18" />

              <text y="5">{index + 1}</text>
            </g>
          ))}
        </svg>
      </div>

      {currentMarkers.length === 0 && (
        <p className={styles.empty}>
          Nenhum dano assinalado. Clique no carro para criar o primeiro
          marcador.
        </p>
      )}

      {currentMarkers.length > 0 && (
        <div className={styles.damageList}>
          {currentMarkers.map((marker, index) => (
            <button
              key={marker.id}
              type="button"
              className={`${styles.damageItem} ${
                editingId === marker.id ? styles.damageItemActive : ""
              }`}
              onClick={() => setEditingId(marker.id)}
            >
              <span className={styles.itemNumber}>{index + 1}</span>

              <span className={styles.itemText}>
                <strong>
                  {marker.description.trim() || `Dano ${index + 1}`}
                </strong>

                <small>{severityLabels[marker.severity]}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {editingMarker && (
        <div className={styles.editor}>
          <div className={styles.editorHeader}>
            <div>
              <span className={styles.eyebrow}>Detalhes do marcador</span>

              <h5>
                Dano{" "}
                {currentMarkers.findIndex(
                  (marker) => marker.id === editingMarker.id,
                ) + 1}
              </h5>
            </div>

            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setEditingId(null)}
              aria-label="Fechar edição"
            >
              ×
            </button>
          </div>

          <label className={styles.field}>
            Descrição do dano
            <textarea
              value={editingMarker.description}
              placeholder="Ex.: risco de aproximadamente 10 cm na porta"
              onChange={(event) =>
                updateMarker(editingMarker.id, {
                  description: event.target.value,
                })
              }
            />
          </label>

          <label className={styles.field}>
            Gravidade
            <select
              value={editingMarker.severity}
              onChange={(event) =>
                updateMarker(editingMarker.id, {
                  severity: event.target.value as DamageSeverity,
                })
              }
            >
              <option value="light">Ligeiro</option>

              <option value="medium">Médio</option>

              <option value="severe">Grave</option>
            </select>
          </label>

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => removeMarker(editingMarker.id)}
            >
              Remover marcador
            </button>

            <button
              type="button"
              className={styles.doneButton}
              onClick={() => setEditingId(null)}
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
