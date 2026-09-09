import type { Metadata } from "next";
import {
  Space_Grotesk,
  Inter,
  JetBrains_Mono,
  Noto_Sans_Arabic,
} from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { AuthProvider } from "@/components/providers/auth-provider";
import { UploadSessionProvider } from "@/components/providers/upload-session-provider";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "OQZARO DataAnalyzer | AI Data Analysis & Cleaning Agent",
  description:
    "Upload your CSV or Excel files and let OQZARO DataAnalyzer Agent analyze, visualize, clean, and export your data with AI-powered precision.",
};

// Apply persisted theme/language before first paint to avoid a flash.
const noFlashScript = `try{var t=localStorage.getItem('oqzaro:theme');var l=localStorage.getItem('oqzaro:lang');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}else if(l==='fr'){document.documentElement.lang='fr';document.documentElement.dir='ltr';}else{document.documentElement.lang='en';document.documentElement.dir='ltr';}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} ${arabic.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="bg-dark-blue-900 text-white min-h-screen">
        <AuthProvider>
          <AppProviders>
            <UploadSessionProvider>
              <WorkspaceProvider>{children}</WorkspaceProvider>
            </UploadSessionProvider>
          </AppProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
