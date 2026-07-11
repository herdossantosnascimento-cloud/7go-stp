import { RentalSheet } from "@/components/admin/RentalSheet";

export default async function RentalSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <RentalSheet bookingId={id} />;
}
