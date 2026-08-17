import path from "node:path";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Svg,
  Path,
  Circle,
  Rect,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

type DamageSeverity = "light" | "medium" | "severe";

type DamageMarker = {
  id: string;
  x: number;
  y: number;
  description: string;
  severity: DamageSeverity;
  createdAt?: string;
};

type LegacyDamageZone =
  | "front"
  | "bonnet"
  | "windscreen"
  | "roof"
  | "rear"
  | "left_front"
  | "left_rear"
  | "right_front"
  | "right_rear";

type DamageValue = DamageMarker | LegacyDamageZone;

const officialLogoPath = path.join(
  process.cwd(),
  "public",
  "images",
  "7go-stp-official-logo.png",
);

type Inspection = {
  registrationPlate?: string;
  mileage?: number;
  fuelLevel?: string;
  condition?: string;
  notes?: string;
  photoUrls?: string[];
  inspectionPhotos?: {
    front?: string;
    rear?: string;
    left?: string;
    right?: string;
    interior?: string;
    dashboard?: string;
  };
  customerSignatureUrl?: string;
  customerSignedAt?: string;
  staffSignatureUrl?: string;
  staffSignedAt?: string;
  hasDamage?: boolean;
  damageDescription?: string;
  damageAmount?: number;
  damageZones?: DamageValue[];
  fuelCharge?: number;
  cleaningRequired?: boolean;
  cleaningNotes?: string;
  cleaningAmount?: number;
  depositReceived?: boolean;
  depositPaymentMethod?: "cash" | "transfer" | "pos";
  depositAmount?: number;
  depositRefundAmount?: number;
  depositRetainedAmount?: number;
  additionalAmountDue?: number;
  completed?: boolean;
};

export type FinalRentalBooking = {
  id: string;
  reference?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  carBrand?: string;
  carModel?: string;
  carYear?: number;
  carRegistrationPlate?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  rentalHours?: number;
  totalDays?: number;
  rentalModeLabel?: string;
  dailyRate?: number;
  appliedExcess?: number;
  normalExcess?: number;
  refundableDeposit?: number;
  estimatedTotal?: number;
  currency?: string;
  paymentStatus?: string;
  depositStatus?: string;
  verificationCode?: string;
  verificationUrl?: string;
  verificationQrDataUrl?: string;
  checkout?: Inspection;
  checkin?: Inspection;
};

const styles = StyleSheet.create({
  page: {
    padding: 34,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#172019",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  officialLogo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginRight: 10,
  },
  headerTitleBlock: {
    justifyContent: "center",
  },
  headerMainTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 5,
    fontSize: 8,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  headerSlogan: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: "Helvetica-BoldOblique",
    color: "#15803d",
  },
  header: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#22c55e",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 25,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
  },
  tagline: {
    marginTop: 3,
    fontSize: 7,
    letterSpacing: 1.4,
  },
  referenceQr: {
    width: 54,
    height: 54,
    marginLeft: "auto",
    marginBottom: 5,
    objectFit: "contain",
  },
  verificationCode: {
    marginTop: 4,
    color: "#657068",
    fontSize: 6,
    textAlign: "right",
  },
  verificationLabel: {
    marginTop: 2,
    color: "#15803d",
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  reference: {
    textAlign: "right",
  },
  referenceLabel: {
    color: "#657068",
    fontSize: 7,
  },
  referenceValue: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    marginBottom: 15,
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  section: {
    marginBottom: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dce4dd",
    borderRadius: 6,
  },
  sectionTitle: {
    marginBottom: 9,
    color: "#15803d",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  field: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 9,
  },
  label: {
    marginBottom: 3,
    color: "#657068",
    fontSize: 7,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  total: {
    marginTop: 5,
    padding: 10,
    backgroundColor: "#edf9f0",
    borderRadius: 5,
  },
  totalLabel: {
    color: "#15803d",
    fontSize: 7,
  },
  totalValue: {
    marginTop: 4,
    color: "#15803d",
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
  },
  note: {
    marginTop: 5,
    color: "#657068",
    lineHeight: 1.5,
  },
  inspectionPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    marginHorizontal: -3,
  },
  identifiedPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },

  identifiedPhotoCard: {
    width: "31%",
    marginRight: "2%",
    marginBottom: 10,
    padding: 5,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 5,
    backgroundColor: "#f8fafc",
  },

  identifiedPhotoLabel: {
    marginBottom: 4,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    textTransform: "uppercase",
  },

  identifiedPhotoImage: {
    width: "100%",
    height: 88,
    objectFit: "cover",
  },

  inspectionPhoto: {
    width: "31.33%",
    height: 90,
    marginHorizontal: "1%",
    marginBottom: 6,
    objectFit: "cover",
    borderRadius: 4,
  },
  signatureGrid: {
    flexDirection: "row",
    marginTop: 10,
    marginHorizontal: -4,
  },
  signatureCard: {
    width: "50%",
    paddingHorizontal: 4,
  },
  signatureBox: {
    height: 72,
    padding: 6,
    borderWidth: 1,
    borderColor: "#dce4dd",
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  signatureImage: {
    width: "100%",
    height: 48,
    objectFit: "contain",
  },
  signatureLabel: {
    marginTop: 4,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  signatureDate: {
    marginTop: 2,
    color: "#657068",
    fontSize: 6,
  },
  damageMap: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#dce4dd",
    borderRadius: 5,
    backgroundColor: "#fafcfb",
  },
  damageMapHeader: {
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  damageMapTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#172019",
  },
  damageMapCount: {
    fontSize: 6,
    color: "#657068",
  },
  damageMapCanvas: {
    width: "100%",
    height: 165,
  },
  damageLegend: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  damageLegendItem: {
    marginRight: 12,
    marginBottom: 3,
    fontSize: 6,
    color: "#657068",
  },
  damageList: {
    marginTop: 7,
  },
  damageListItem: {
    marginBottom: 3,
    fontSize: 7,
    color: "#37413a",
  },
  footer: {
    position: "absolute",
    right: 34,
    bottom: 22,
    left: 34,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#dce4dd",
    color: "#657068",
    fontSize: 7,
    textAlign: "center",
  },
});

function value(input: unknown, fallback = "Não registado") {
  if (input === undefined || input === null || input === "") {
    return fallback;
  }

  return String(input);
}

function money(currency: string, input: number | undefined) {
  return input == null ? "Não registado" : `${currency}${input}`;
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{children}</Text>
    </View>
  );
}

const legacyDamagePositions: Record<
  LegacyDamageZone,
  { x: number; y: number; description: string }
> = {
  front: { x: 50, y: 13, description: "Parte dianteira" },
  bonnet: { x: 50, y: 28, description: "Capô" },
  windscreen: { x: 50, y: 40, description: "Para-brisas" },
  roof: { x: 50, y: 53, description: "Tejadilho" },
  rear: { x: 50, y: 88, description: "Parte traseira" },
  left_front: { x: 25, y: 31, description: "Lateral esquerda dianteira" },
  left_rear: { x: 25, y: 69, description: "Lateral esquerda traseira" },
  right_front: { x: 75, y: 31, description: "Lateral direita dianteira" },
  right_rear: { x: 75, y: 69, description: "Lateral direita traseira" },
};

const damageSeverityLabels: Record<DamageSeverity, string> = {
  light: "Ligeiro",
  medium: "Médio",
  severe: "Grave",
};

const damageSeverityColours: Record<DamageSeverity, string> = {
  light: "#f59e0b",
  medium: "#f97316",
  severe: "#dc2626",
};

function normalizeDamageMarkers(
  values: DamageValue[] | undefined,
  source: string,
): DamageMarker[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item, index): DamageMarker | null => {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.x === "number" &&
        typeof item.y === "number"
      ) {
        const severity: DamageSeverity =
          item.severity === "medium" || item.severity === "severe"
            ? item.severity
            : "light";

        return {
          id:
            typeof item.id === "string" && item.id
              ? item.id
              : `${source}-${index + 1}`,
          x: Math.min(100, Math.max(0, item.x)),
          y: Math.min(100, Math.max(0, item.y)),
          description:
            typeof item.description === "string" ? item.description : "",
          severity,
          createdAt:
            typeof item.createdAt === "string" ? item.createdAt : undefined,
        };
      }

      if (typeof item === "string" && item in legacyDamagePositions) {
        const legacy = legacyDamagePositions[item as LegacyDamageZone];

        return {
          id: `${source}-${item}-${index + 1}`,
          x: legacy.x,
          y: legacy.y,
          description: legacy.description,
          severity: "light",
        };
      }

      return null;
    })
    .filter((marker): marker is DamageMarker => marker !== null);
}

function PdfDamageMap({
  title,
  markers,
  previousMarkers = [],
}: {
  title: string;
  markers: DamageValue[] | undefined;
  previousMarkers?: DamageValue[];
}) {
  const current = normalizeDamageMarkers(markers, "current");
  const previous = normalizeDamageMarkers(previousMarkers, "previous");

  if (current.length === 0 && previous.length === 0) {
    return null;
  }

  const width = 500;
  const height = 210;

  const markerX = (x: number) => (x / 100) * width;
  const markerY = (y: number) => (y / 100) * height;

  return (
    <View style={styles.damageMap} wrap={false}>
      <View style={styles.damageMapHeader}>
        <Text style={styles.damageMapTitle}>{title}</Text>

        <Text style={styles.damageMapCount}>
          {current.length}{" "}
          {current.length === 1 ? "dano registado" : "danos registados"}
        </Text>
      </View>

      <Svg viewBox={`0 0 ${width} ${height}`} style={styles.damageMapCanvas}>
        <Rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          rx="12"
          fill="#f8faf9"
          stroke="#dce4dd"
          strokeWidth="2"
        />

        {/* Silhueta superior simplificada da viatura */}
        <Path
          d="
            M 205 20
            C 180 26 163 48 156 71
            L 137 92
            C 129 101 125 114 125 127
            L 125 164
            C 125 179 137 191 152 191
            L 348 191
            C 363 191 375 179 375 164
            L 375 127
            C 375 114 371 101 363 92
            L 344 71
            C 337 48 320 26 295 20
            Z
          "
          fill="#ffffff"
          stroke="#26332a"
          strokeWidth="3"
        />

        <Path
          d="
            M 191 70
            C 199 45 215 34 231 31
            L 269 31
            C 285 34 301 45 309 70
            Z
          "
          fill="#e8eeea"
          stroke="#67736b"
          strokeWidth="2"
        />

        <Path d="M 183 79 L 317 79" stroke="#67736b" strokeWidth="2" />

        <Path d="M 172 103 L 328 103" stroke="#c2cbc4" strokeWidth="2" />

        <Path d="M 172 157 L 328 157" stroke="#c2cbc4" strokeWidth="2" />

        <Rect x="112" y="102" width="17" height="35" rx="5" fill="#26332a" />

        <Rect x="371" y="102" width="17" height="35" rx="5" fill="#26332a" />

        <Rect x="112" y="151" width="17" height="35" rx="5" fill="#26332a" />

        <Rect x="371" y="151" width="17" height="35" rx="5" fill="#26332a" />

        {previous.map((marker, index) => (
          <Circle
            key={`previous-${marker.id}-${index}`}
            cx={markerX(marker.x)}
            cy={markerY(marker.y)}
            r="8"
            fill="#64748b"
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}

        {current.map((marker, index) => (
          <Circle
            key={`current-${marker.id}-${index}`}
            cx={markerX(marker.x)}
            cy={markerY(marker.y)}
            r="9"
            fill={damageSeverityColours[marker.severity]}
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}
      </Svg>

      <View style={styles.damageLegend}>
        {previous.length > 0 && (
          <Text style={styles.damageLegendItem}>
            ● Cinzento: danos existentes na entrega
          </Text>
        )}

        {current.length > 0 && (
          <>
            <Text style={styles.damageLegendItem}>● Amarelo: ligeiro</Text>

            <Text style={styles.damageLegendItem}>● Laranja: médio</Text>

            <Text style={styles.damageLegendItem}>● Vermelho: grave</Text>
          </>
        )}
      </View>

      {current.length > 0 && (
        <View style={styles.damageList}>
          {current.map((marker, index) => (
            <Text
              key={`description-${marker.id}-${index}`}
              style={styles.damageListItem}
            >
              {index + 1}. {marker.description.trim() || "Dano sem descrição"} —{" "}
              {damageSeverityLabels[marker.severity]}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function InspectionBlock({
  title,
  inspection,
  currency,
  previousDamageZones = [],
}: {
  title: string;
  inspection?: Inspection;
  currency: string;
  previousDamageZones?: DamageValue[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {!inspection?.completed ? (
        <Text>Registo não preenchido.</Text>
      ) : (
        <>
          <View style={styles.grid}>
            <Field label="Quilometragem">
              {inspection.mileage == null
                ? "Não registada"
                : `${inspection.mileage} km`}
            </Field>

            <Field label="Combustível">{value(inspection.fuelLevel)}</Field>

            <Field label="Estado do carro">{value(inspection.condition)}</Field>

            <Field label="Novos danos">
              {inspection.hasDamage ? "Sim" : "Não"}
            </Field>
          </View>

          {inspection.notes && (
            <Text style={styles.note}>Observações: {inspection.notes}</Text>
          )}

          <PdfDamageMap
            title={
              previousDamageZones.length > 0
                ? "Comparação visual dos danos"
                : "Mapa visual dos danos"
            }
            markers={inspection.damageZones}
            previousMarkers={previousDamageZones}
          />

          {(() => {
            const identifiedPhotos = [
              {
                key: "front",
                label: "Frente",
                url: inspection.inspectionPhotos?.front,
              },
              {
                key: "rear",
                label: "Traseira",
                url: inspection.inspectionPhotos?.rear,
              },
              {
                key: "left",
                label: "Lado esquerdo",
                url: inspection.inspectionPhotos?.left,
              },
              {
                key: "right",
                label: "Lado direito",
                url: inspection.inspectionPhotos?.right,
              },
              {
                key: "interior",
                label: "Interior",
                url: inspection.inspectionPhotos?.interior,
              },
              {
                key: "dashboard",
                label: "Painel / KM",
                url: inspection.inspectionPhotos?.dashboard,
              },
            ].filter(
              (
                photo,
              ): photo is {
                key: string;
                label: string;
                url: string;
              } => Boolean(photo.url),
            );

            if (identifiedPhotos.length > 0) {
              return (
                <>
                  <Text style={styles.note}>Fotografias identificadas:</Text>

                  <View style={styles.identifiedPhotoGrid}>
                    {identifiedPhotos.map((photo) => (
                      <View key={photo.key} style={styles.identifiedPhotoCard}>
                        <Text style={styles.identifiedPhotoLabel}>
                          {photo.label}
                        </Text>

                        <Image
                          src={photo.url}
                          style={styles.identifiedPhotoImage}
                        />
                      </View>
                    ))}
                  </View>
                </>
              );
            }

            if ((inspection.photoUrls ?? []).length > 0) {
              return (
                <>
                  <Text style={styles.note}>Fotografias da inspeção:</Text>

                  <View style={styles.inspectionPhotoGrid}>
                    {(inspection.photoUrls ?? [])
                      .slice(0, 6)
                      .map((photoUrl) => (
                        <Image
                          key={photoUrl}
                          src={photoUrl}
                          style={styles.inspectionPhoto}
                        />
                      ))}
                  </View>

                  {(inspection.photoUrls ?? []).length > 6 && (
                    <Text style={styles.note}>
                      O registo contém mais{" "}
                      {(inspection.photoUrls ?? []).length - 6} fotografia(s)
                      disponíveis na ficha digital.
                    </Text>
                  )}
                </>
              );
            }

            return null;
          })()}

          {(inspection.customerSignatureUrl ||
            inspection.staffSignatureUrl) && (
            <>
              <Text style={styles.note}>Assinaturas:</Text>

              <View style={styles.signatureGrid}>
                {inspection.customerSignatureUrl && (
                  <View style={styles.signatureCard}>
                    <View style={styles.signatureBox}>
                      <Image
                        src={inspection.customerSignatureUrl}
                        style={styles.signatureImage}
                      />
                    </View>

                    <Text style={styles.signatureLabel}>Cliente</Text>

                    <Text style={styles.signatureDate}>
                      {inspection.customerSignedAt
                        ? new Date(inspection.customerSignedAt).toLocaleString(
                            "pt-PT",
                          )
                        : "Data não registada"}
                    </Text>
                  </View>
                )}

                {inspection.staffSignatureUrl && (
                  <View style={styles.signatureCard}>
                    <View style={styles.signatureBox}>
                      <Image
                        src={inspection.staffSignatureUrl}
                        style={styles.signatureImage}
                      />
                    </View>

                    <Text style={styles.signatureLabel}>Funcionário 7Go</Text>

                    <Text style={styles.signatureDate}>
                      {inspection.staffSignedAt
                        ? new Date(inspection.staffSignedAt).toLocaleString(
                            "pt-PT",
                          )
                        : "Data não registada"}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {inspection.hasDamage && (
            <>
              <Text style={styles.note}>
                Danos: {value(inspection.damageDescription)}
              </Text>

              <Text style={styles.note}>
                Valor associado: {money(currency, inspection.damageAmount)}
              </Text>
            </>
          )}

          <Text style={styles.note}>
            Limpeza especial: {inspection.cleaningRequired ? "Sim" : "Não"}
          </Text>

          {inspection.cleaningRequired && (
            <>
              <Text style={styles.note}>
                Motivo da limpeza: {value(inspection.cleaningNotes)}
              </Text>

              <Text style={styles.note}>
                Valor da limpeza: {money(currency, inspection.cleaningAmount)}
              </Text>
            </>
          )}

          <Text style={styles.note}>
            Combustível cobrado: {money(currency, inspection.fuelCharge)}
          </Text>

          <Text style={styles.note}>
            Caução recebida: {money(currency, inspection.depositAmount)}
          </Text>

          <Text style={styles.note}>
            Total retido: {money(currency, inspection.depositRetainedAmount)}
          </Text>

          <Text style={styles.note}>
            Valor devolvido: {money(currency, inspection.depositRefundAmount)}
          </Text>

          <Text style={styles.note}>
            Valor adicional a pagar:{" "}
            {money(currency, inspection.additionalAmountDue)}
          </Text>
        </>
      )}
    </View>
  );
}

function FinalRentalSheetPdf({ booking }: { booking: FinalRentalBooking }) {
  const currency = booking.currency || "€";
  const excess = booking.appliedExcess ?? booking.normalExcess;

  return (
    <Document
      title={`Ficha final ${booking.reference || booking.id}`}
      author="7Go STP"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Image src={officialLogoPath} style={styles.officialLogo} />

            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerMainTitle}>FICHA FINAL DE ALUGUER</Text>

              <Text style={styles.headerSubtitle}>
                Relatório de inspeção da viatura
              </Text>

              <Text style={styles.headerSlogan}>Drive Your Way</Text>
            </View>
          </View>

          <View style={styles.reference}>
            {booking.verificationQrDataUrl && (
              <Image
                src={booking.verificationQrDataUrl}
                style={styles.referenceQr}
              />
            )}

            <Text style={styles.referenceLabel}>REFERÊNCIA DA RESERVA</Text>

            <Text style={styles.referenceValue}>
              {booking.reference || booking.id}
            </Text>

            {booking.verificationCode && (
              <>
                <Text style={styles.verificationLabel}>
                  DIGITALIZE PARA VALIDAR
                </Text>

                <Text style={styles.verificationCode}>
                  {booking.verificationCode}
                </Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.title}>Resumo final do aluguer</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente e reserva</Text>

          <View style={styles.grid}>
            <Field label="Cliente">{value(booking.customerName)}</Field>

            <Field label="Email">{value(booking.customerEmail)}</Field>

            <Field label="Contacto">{value(booking.customerPhone)}</Field>

            <Field label="Estado">{value(booking.status)}</Field>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Viatura e período</Text>

          <View style={styles.grid}>
            <Field label="Viatura">
              {value(
                [booking.carBrand, booking.carModel].filter(Boolean).join(" "),
              )}
            </Field>

            <Field label="Matrícula">
              {value(booking.carRegistrationPlate)}
            </Field>

            <Field label="Levantamento">
              {`${value(booking.pickupDate)}${booking.pickupTime ? ` às ${booking.pickupTime}` : ""}`}
            </Field>

            <Field label="Devolução">
              {`${value(booking.returnDate)}${booking.returnTime ? ` às ${booking.returnTime}` : ""}`}
            </Field>

            <Field label="Matrícula da viatura">
              {value(booking.carRegistrationPlate)}
            </Field>

            <Field label="Dias">{value(booking.totalDays)}</Field>

            <Field label="Modalidade">{value(booking.rentalModeLabel)}</Field>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Valores</Text>

          <View style={styles.grid}>
            <Field label="Preço final por dia">
              {money(currency, booking.dailyRate)}
            </Field>

            <Field label="Franquia">{money(currency, excess)}</Field>

            <Field label="Caução reembolsável">
              {money(currency, booking.refundableDeposit)}
            </Field>

            <Field label="Pagamento">{value(booking.paymentStatus)}</Field>

            <Field label="Estado da caução">
              {value(booking.depositStatus)}
            </Field>
          </View>

          <View style={styles.total}>
            <Text style={styles.totalLabel}>TOTAL DO ALUGUER</Text>

            <Text style={styles.totalValue}>
              {money(currency, booking.estimatedTotal)}
            </Text>
          </View>
        </View>

        <InspectionBlock
          title="Entrega da viatura"
          inspection={booking.checkout}
          currency={currency}
        />

        <InspectionBlock
          title="Devolução da viatura"
          inspection={booking.checkin}
          currency={currency}
          previousDamageZones={booking.checkout?.damageZones ?? []}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmação e assinaturas</Text>

          <View style={styles.grid}>
            <Field label="Assinatura do cliente">
              ______________________________
            </Field>

            <Field label="Funcionário 7Go STP">
              ______________________________
            </Field>
          </View>
        </View>

        <Text style={styles.note}>
          Esta ficha constitui um resumo final do aluguer e não substitui uma
          fatura fiscal.
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `7Go STP · Drive your way · Página ${pageNumber} de ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function createFinalRentalSheetPdf(booking: FinalRentalBooking) {
  return renderToBuffer(<FinalRentalSheetPdf booking={booking} />);
}
