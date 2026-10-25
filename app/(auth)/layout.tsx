import { ThemeToggle } from "@/components/auth-form"
import { Logo } from "@/components/logo"
import { Reveal } from "@/components/motion-bits"

// One centred column on the canvas, over Phnom Penh drawn across the floor. The skyline rises in, then the logo and the
// page. Bottom padding keeps the form clear of the skyline.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      {/* A background, not an <img>, so only the current theme's image downloads. Grey, like the rest of the app. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[min(29.83vw,50vh)] min-h-44 bg-[url(/login/phnom-penh.webp)] bg-cover bg-bottom opacity-70 mask-t-from-70% grayscale animate-in fade-in-0 slide-in-from-bottom-8 duration-900 ease-out-expo motion-reduce:slide-in-from-bottom-0 dark:bg-[url(/login/phnom-penh-night.webp)] dark:opacity-60"
      />
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[25vh]">
        <Reveal className="mb-10 self-center">
          <Logo className="text-4xl" />
        </Reveal>
        <Reveal index={1}>{children}</Reveal>
      </main>
    </div>
  )
}
