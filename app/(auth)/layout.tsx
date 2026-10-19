import { Logo } from "@/components/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-4">
      <Logo className="text-4xl" />
      <div className="w-full max-w-sm rounded-tile bg-card p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  )
}
