import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";

export const metadata: Metadata = { title: "Agent Workspace" };

export default function Page() {
  return <WorkspaceView />;
}
