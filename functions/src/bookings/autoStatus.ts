import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

type BookingStatus =
  | "pending"
  | "pending_payment"
  | "confirmed"
  | "in_progress"
  | "overdue"
  | "completed"
  | "cancelled";

interface BookingData {
  status?: BookingStatus;
  pickupDate?: string;
  returnDate?: string;
  returnTime?: string;
  reference?: string;
}

interface BookingUpdate {
  bookingId: string;
  reference?: string;
  previousStatus: BookingStatus;
  newStatus: "overdue";
}

const TIME_ZONE = "Africa/Sao_Tome";
const MAX_BOOKINGS_PER_BATCH = 200;

function getTodayInSaoTome(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Não foi possível determinar a data atual.");
  }

  return `${year}-${month}-${day}`;
}

function shouldMarkAsOverdue(
  booking: BookingData,
  now: Date,
): boolean {
  if (booking.status !== "in_progress" || !booking.returnDate) return false;
  const returnAt = new Date(`${booking.returnDate}T${booking.returnTime || "23:59"}:00`);
  return !Number.isNaN(returnAt.getTime()) && now >= returnAt;
}

async function findBookingsToUpdate(
  now: Date,
): Promise<BookingUpdate[]> {
  const db = getFirestore();

  const snapshot = await db
    .collection("bookings")
    .where("status", "==", "in_progress")
    .get();

  const updates: BookingUpdate[] = [];

  for (const document of snapshot.docs) {
    const booking = document.data() as BookingData;

    if (!shouldMarkAsOverdue(booking, now)) {
      continue;
    }

    updates.push({
      bookingId: document.id,
      reference: booking.reference,
      previousStatus: "in_progress",
      newStatus: "overdue",
    });
  }

  return updates;
}

async function applyBookingUpdates(
  updates: BookingUpdate[],
): Promise<void> {
  const db = getFirestore();

  for (
    let index = 0;
    index < updates.length;
    index += MAX_BOOKINGS_PER_BATCH
  ) {
    const group = updates.slice(
      index,
      index + MAX_BOOKINGS_PER_BATCH,
    );

    const batch = db.batch();

    for (const update of group) {
      const updateData = {
        status: update.newStatus,
        statusUpdatedAt: FieldValue.serverTimestamp(),
        statusUpdatedBy: "system",
      };

      batch.update(
        db.collection("bookings").doc(update.bookingId),
        updateData,
      );

      if (update.reference?.trim()) {
        batch.set(
          db.collection("bookingStatus").doc(update.reference.trim()),
          updateData,
          { merge: true },
        );
      }
    }

    await batch.commit();
  }
}

export const syncBookingStatus = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: TIME_ZONE,
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 120,
    retryCount: 1,
  },
  async () => {
    const now = new Date();
    const today = getTodayInSaoTome();

    logger.info("Início da verificação de reservas em atraso.", {
      today,
      timeZone: TIME_ZONE,
    });

    const updates = await findBookingsToUpdate(now);

    if (updates.length === 0) {
      logger.info("Nenhuma reserva em curso está atrasada.", {
        today,
      });

      return;
    }

    await applyBookingUpdates(updates);

    logger.warn("Reservas marcadas como overdue.", {
      today,
      totalUpdated: updates.length,
      updates,
    });
  },
);
