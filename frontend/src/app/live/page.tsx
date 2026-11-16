import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveView } from "@/components/execution/LiveView";
import { LoadingState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Live CLI Execution" };

export default function Page() {
  // useSearchParams (?id=) is request data, so the view renders inside a Suspense boundary.
  return (
    <Suspense fallback={<LoadingState label="Connecting to execution stream…" />}>
      <LiveView />
    </Suspense>
  );
}
