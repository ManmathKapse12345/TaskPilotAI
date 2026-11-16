import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryView } from "@/components/history/HistoryView";
import { LoadingState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Task History" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading task history…" />}>
      <HistoryView />
    </Suspense>
  );
}
