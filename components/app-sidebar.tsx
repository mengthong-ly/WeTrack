"use client"

import { CheckIcon, ChevronsUpDownIcon, FolderIcon, FolderOpenIcon, PlusIcon as LucidePlusIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect } from "react"
import { toast } from "sonner"

import { ArchiveIcon } from "@/components/animate-ui/icons/archive"
import { ArrowLeftIcon } from "@/components/animate-ui/icons/arrow-left"
import { BlocksIcon } from "@/components/animate-ui/icons/blocks"
import { CalendarDaysIcon } from "@/components/animate-ui/icons/calendar-days"
import { ClipboardListIcon } from "@/components/animate-ui/icons/clipboard-list"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"
import { LayersIcon } from "@/components/animate-ui/icons/layers"
import { LayoutDashboardIcon } from "@/components/animate-ui/icons/layout-dashboard"
import { MessageSquareMoreIcon } from "@/components/animate-ui/icons/message-square-more"
import { PlusIcon } from "@/components/animate-ui/icons/plus"
import { SearchIcon } from "@/components/animate-ui/icons/search"
import { SendIcon } from "@/components/animate-ui/icons/send"
import { UsersIcon } from "@/components/animate-ui/icons/users"
import { ProjectDot } from "@/components/bits"
import { NEW_TASK_EVENT, SEARCH_EVENT, type NewTaskPreset } from "@/components/command-menu"
import { Button } from "@/components/coss/button"
import { Kbd as CossKbd, KbdGroup } from "@/components/coss/kbd"
import { Menu, MenuGroup, MenuGroupLabel, MenuLinkItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/coss/menu"
import { NewProject } from "@/components/new-project"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { CREATE_PROJECT_HREF, feedbackHref, newTaskHref, projectHref, projectIdFromPath, tasksHref, updatesHref } from "@/lib/routes"
import { cn, isTyping, whenIdle } from "@/lib/utils"

// Each animate-ui icon types its own animations; here they only take a className and play from AnimateIcon.
type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }
export type SwitcherProject = { id: string; name: string; color: string; logo: string | null }

// Project selection mode: before any task work, pick a project or start one.
const ORG_NAV: NavItem[] = [
  { href: "/projects", label: "Projects", icon: BlocksIcon },
  { href: "/workspace", label: "Workspace", icon: LayersIcon },
  { href: "/meetings", label: "Meetings", icon: CalendarDaysIcon },
  { href: "/team", label: "Team", icon: UsersIcon },
  { href: "/archive", label: "Archive", icon: ArchiveIcon },
]

// Task management mode: the project's own sections.
const projectNav = (id: string): NavItem[] => [
  { href: projectHref(id), label: "Overview", icon: LayoutDashboardIcon, exact: true },
  { href: tasksHref(id), label: "Tasks", icon: ClipboardListIcon },
  { href: feedbackHref(id), label: "Feedback", icon: MessageSquareMoreIcon },
  { href: updatesHref(id), label: "Client updates", icon: SendIcon },
]

const isActive = ({ href, exact }: NavItem, pathname: string | null) =>
  exact ? pathname === href : pathname === href || !!pathname?.startsWith(`${href}/`)

// The sidebar's content slides in when the mode changes (each mode is its own layout, so it mounts fresh), so
// picking a project reads as stepping into it. Within a mode the layout stays and nothing moves.
function ModeSwitch({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-0 flex-1 flex-col font-heading"
    >
      {children}
    </motion.div>
  )
}

// Project selection mode's sidebar: the team, the dark New project button, then Projects, Workspace and Team.
export function OrgSidebar({ orgName, account }: { orgName?: React.ReactNode; account?: React.ReactNode }) {
  return (
    <Sidebar variant="inset" collapsible="icon" data-app-sidebar data-mode="projects">
      <ModeSwitch>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/projects" />}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-heading text-sm font-medium text-primary-foreground">
                  w.
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-heading font-medium">WeTrack</span>
                  <span className="truncate text-xs text-muted-foreground">{orgName}</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <NewProject variant="sidebar" />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <NavGroup label="Navigate" items={ORG_NAV} />
        </SidebarContent>
        <SidebarFooter>{account}</SidebarFooter>
      </ModeSwitch>
      <SidebarRail />
    </Sidebar>
  )
}

// Task management mode's sidebar: back to all projects, the project, the dark New task button, its sections.
export function ProjectSidebar({ head, account }: { head: React.ReactNode; account?: React.ReactNode }) {
  return (
    <Sidebar variant="inset" collapsible="icon" data-app-sidebar data-mode="tasks">
      <ModeSwitch>
        <SidebarHeader>{head}</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <AnimateIcon animateOnHover asChild>
                  <SidebarMenuButton tooltip="New task" onClick={() => window.dispatchEvent(new Event(NEW_TASK_EVENT))} className={CTA}>
                    <PlusIcon />
                    <span>New task</span>
                    <Kbd className="ml-auto bg-primary-foreground/15 text-primary-foreground">C</Kbd>
                  </SidebarMenuButton>
                </AnimateIcon>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          {/* The project comes from the URL, which streams in; until then the section rows hold their place. */}
          <Suspense fallback={<NavSkeleton label="Project" rows={4} />}>
            <ProjectNav />
          </Suspense>
        </SidebarContent>
        <SidebarFooter>{account}</SidebarFooter>
      </ModeSwitch>
      <SidebarRail />
    </Sidebar>
  )
}

// The dark call to action at the top of each mode: New project, or New task inside a project.
export const CTA =
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"

// "← All projects", then the project you're in. Without `project`, the loading shape.
export function ProjectSidebarHead({ project, archived }: { project?: SwitcherProject; archived?: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <AnimateIcon animateOnHover asChild>
          <SidebarMenuButton
            tooltip="All projects"
            size="sm"
            className="text-muted-foreground"
            render={<Link href="/projects" onClick={() => isMobile && setOpenMobile(false)} />}
          >
            <ArrowLeftIcon />
            <span>All projects</span>
          </SidebarMenuButton>
        </AnimateIcon>
      </SidebarMenuItem>
      <SidebarMenuItem>
        {project ? (
          <SidebarMenuButton size="lg" render={<Link href={projectHref(project.id)} />}>
            <ProjectTile project={project} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-heading font-medium">{project.name}</span>
              <span className="truncate text-xs text-muted-foreground">{archived ? "Archived project" : "Project"}</span>
            </span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuSkeleton showIcon className="h-12" />
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// A project as a square like the team's "w." tile: its logo, or its colour dot on a quiet tile.
function ProjectTile({ project }: { project: SwitcherProject }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background">
      {project.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it
        <img src={project.logo} alt="" className="size-full object-contain" />
      ) : (
        <ProjectDot color={project.color} className="size-2.5" />
      )}
    </span>
  )
}

function ProjectNav() {
  const { projectId } = useParams<{ projectId: string }>()
  return <NavGroup label="Project" items={projectNav(projectId)} />
}

function NavSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {Array.from({ length: rows }, (_, i) => (
          <SidebarMenuItem key={i}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        {/* The path is unknown while a dynamic route prerenders; links show with nothing active until it streams in. */}
        <Suspense fallback={<NavLinks items={items} pathname={null} />}>
          <CurrentNavLinks items={items} />
        </Suspense>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function CurrentNavLinks({ items }: { items: NavItem[] }) {
  return <NavLinks items={items} pathname={usePathname()} />
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <AnimateIcon animateOnHover asChild>
            <SidebarMenuButton
              tooltip={item.label}
              isActive={isActive(item, pathname)}
              render={<Link href={item.href} onClick={() => isMobile && setOpenMobile(false)} />}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </AnimateIcon>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

// The inset panel's top bar: sidebar toggle, the project switcher, then search and `tools` (the bell).
export function AppHeader({ switcher, tools }: { switcher?: React.ReactNode; tools?: React.ReactNode }) {
  return (
    <header
      data-app-header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 md:rounded-t-xl"
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
      {switcher}
      <Suspense>
        <PageTitle />
      </Suspense>
      <div className="ml-auto flex items-center gap-1.5">
        <SearchButton />
        {tools}
      </div>
    </header>
  )
}

// coss.com's "| Home" after the switcher: the section you're on, from the same nav the sidebar lists.
function PageTitle() {
  const pathname = usePathname()
  const id = projectIdFromPath(pathname)
  const here = [...(id ? projectNav(id) : []), ...ORG_NAV].find((n) => isActive(n, pathname))
  if (!here) return null
  return (
    <>
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4 data-vertical:self-center max-sm:hidden" />
      <span className="truncate text-sm font-medium max-sm:hidden">{here.label}</span>
    </>
  )
}

export function SwitcherSkeleton() {
  return <span aria-hidden className="h-8 w-44 rounded-lg bg-muted" />
}

// coss.com's "Default / ● Development ⇅": the team, then the project you're in ("Select a project" while
// picking one). Switching keeps the section you're on (Tasks stays Tasks); a task or point goes to its list.
// Spotlight-sized rows: tall enough to aim at, base-size text, room around the icon.
const ROW = "min-h-11 gap-3 rounded-row px-3 sm:text-base [&_svg:not([class*='size-'])]:size-5"

export function ProjectSwitcher({ team, current, projects }: { team: string; current?: string; projects: SwitcherProject[] }) {
  const pathname = usePathname()
  const here = projects.find((p) => p.id === current)
  const section = here ? (pathname?.split("/")[3] ?? "") : ""
  const into = (id: string) => `${projectHref(id)}${["tasks", "feedback", "updates"].includes(section) ? `/${section}` : ""}`
  return (
    <Menu>
      <MenuTrigger render={<Button variant="outline" className="min-w-0 max-w-full" />}>
        <FolderIcon />
        <span className="truncate max-sm:hidden">{team}</span>
        <span aria-hidden className="text-muted-foreground/60 max-sm:hidden">
          /
        </span>
        {here ? <ProjectDot color={here.color} className="size-1.5" /> : <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-foreground/30" />}
        <span className={cn("truncate", !here && "text-muted-foreground")}>{here?.name ?? "Select a project"}</span>
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </MenuTrigger>
      <MenuPopup
        align="start"
        sideOffset={8}
        className="max-h-[min(36rem,75dvh)] w-[min(26rem,calc(100vw-2rem))] rounded-sheet bg-popover/85 shadow-xl/10 backdrop-blur-xl before:rounded-sheet *:p-2"
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="grid size-11 place-items-center rounded-panel border bg-background">
            <FolderIcon className="size-5 text-muted-foreground" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-base font-medium">{team}</span>
            <span className="text-sm text-muted-foreground">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </span>
        </div>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel className="px-3 pt-2 text-sm">Project</MenuGroupLabel>
          {projects.map((p) => (
            <MenuLinkItem key={p.id} className={ROW} render={<Link href={into(p.id)} />}>
              <ProjectDot color={p.color} className="size-2.5" />
              <span className="truncate">{p.name}</span>
              {p.id === current && <CheckIcon className="ml-auto" />}
            </MenuLinkItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuLinkItem className={ROW} render={<Link href="/projects" />}>
          <FolderOpenIcon />
          All projects
        </MenuLinkItem>
        <MenuLinkItem className={ROW} render={<Link href={CREATE_PROJECT_HREF} />}>
          <LucidePlusIcon />
          New project
        </MenuLinkItem>
      </MenuPopup>
    </Menu>
  )
}

// coss.com's header search: a coss outline button shaped like its input (the 1px edge light), "Search…" and
// separate ⌘ / K keys; an icon button on phones. Opens CommandMenu.
export function SearchButton() {
  return (
    <AnimateIcon animateOnHover asChild>
      <Button
        variant="outline"
        onClick={() => window.dispatchEvent(new Event(SEARCH_EVENT))}
        aria-label="Search and commands"
        className="justify-start font-normal text-muted-foreground max-sm:size-8 max-sm:px-0 sm:w-60 sm:pr-1.5"
      >
        <SearchIcon />
        <span className="max-sm:hidden">Search…</span>
        <KbdGroup className="ml-auto max-sm:hidden">
          <CossKbd>⌘</CossKbd>
          <CossKbd>K</CossKbd>
        </KbdGroup>
      </Button>
    </AnimateIcon>
  )
}

// C anywhere, the sidebar's New task, NEW_TASK_EVENT from ⌘K or a panel: all open the New task page of the
// preset's project or the one you're in. With neither (picking a project), you're asked to pick one first.
export function NewTaskHost() {
  const router = useRouter()
  const pathname = usePathname()
  const here = projectIdFromPath(pathname)
  useEffect(() => {
    const open = (preset?: NewTaskPreset) => {
      const projectId = preset?.projectId ?? here
      if (projectId) return router.push(newTaskHref(projectId, preset))
      toast("Pick a project first", { description: "Tasks live inside a project." })
      if (pathname !== "/projects") router.push("/projects")
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        open()
      }
    }
    // NEW_TASK_EVENT may carry defaults: { priority } from a priority group's "Add task" row,
    // { status | projectId | assigneeId } from a panel in the 3D workspace.
    const onNew = (e: Event) => open((e as CustomEvent<NewTaskPreset | null>).detail ?? undefined)
    window.addEventListener("keydown", onKey)
    window.addEventListener(NEW_TASK_EVENT, onNew)
    const cancel = here ? whenIdle(() => router.prefetch(newTaskHref(here))) : () => {}
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(NEW_TASK_EVENT, onNew)
      cancel()
    }
  }, [router, here, pathname])
  return null
}
