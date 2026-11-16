import type { Metadata } from "next";
import { Suspense } from "react";
import { ResultsView } from "@/components/results/ResultsView";
import { LoadingState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Results & Schema" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading results…" />}>
      <ResultsView />
    </Suspense>
  );
}
