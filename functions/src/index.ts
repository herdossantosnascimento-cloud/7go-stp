import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();

setGlobalOptions({
  maxInstances: 10,
  region: "europe-west1",
});

export { syncBookingStatus } from "./bookings/autoStatus";
