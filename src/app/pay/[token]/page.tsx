import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { PayView } from "./PayView";

// Public page a client opens from the link the agent created.
export default function PayPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Spinner label="Loading your payment options" />}>
      <PayViewLoader params={params} />
    </Suspense>
  );
}

async function PayViewLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PayView token={token} />;
}
