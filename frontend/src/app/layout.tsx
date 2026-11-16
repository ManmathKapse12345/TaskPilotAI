import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { WorkspaceProvider } from "@/lib/workspace";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "TaskPilot AI", template: "%s · TaskPilot AI" },
  description: "Turn natural-language instructions into verified CLI executions.",
};

export const viewport: Viewport = {
  themeColor: "#060e20",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="h-full">
        <ToastProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
