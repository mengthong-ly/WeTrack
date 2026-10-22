import { Logo } from "@/components/logo"
import { ProjectScene } from "@/components/project-scene"
import { SAMPLE_SCENE } from "@/lib/scene"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <ProjectScene data={SAMPLE_SCENE} surface="background" className="h-[28rem] lg:h-auto" />
      <div className="flex flex-col items-center justify-center gap-8 p-4 pb-12 lg:pb-4">
        <Logo className="text-4xl" />
        <div className="w-full max-w-sm rounded-tile bg-card p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  )
}
