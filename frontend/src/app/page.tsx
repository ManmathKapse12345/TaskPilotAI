import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { LoadingState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  // ?task=<id> is request data, so the chat renders inside a Suspense boundary.
  return (
    <Suspense fallback={<LoadingState label="Loading chat…" />}>
      <ChatView />
    </Suspense>
  );
}
