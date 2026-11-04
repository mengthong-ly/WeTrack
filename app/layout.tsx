import type { Metadata } from "next"
import { Geist_Mono, Google_Sans, Poppins } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Google Sans for UI text (coss.com's quiet geometric sans); Poppins for headings and big numbers, which also
// keeps the light (300) weight DESIGN.md's titles use. To run on Poppins alone, point --font-sans at --font-poppins.
const googleSans = Google_Sans({ subsets: ["latin"], variable: "--font-google-sans" })
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-poppins" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: { default: "WeTrack", template: "%s · WeTrack" },
  description: "Development tasks, deadlines and releases — without the spreadsheet.",
  // Opened from the Home Screen it runs full screen, which is what lets iOS deliver push.
  appleWebApp: { capable: true, title: "WeTrack", statusBarStyle: "default" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", googleSans.variable, poppins.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
