import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Allocatify — Privacy-First Financial Allocation Engine",
  description:
    "Map your financial distribution instantly. Zero sign-up, zero friction. Your data stays on your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Apply the saved/system theme before first paint (prevents a white flash).
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("allocatify-theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.add(d?"dark":"light")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
