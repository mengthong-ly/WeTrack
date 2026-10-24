"use client"

import { XIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { MemberLite } from "@/lib/options"
import { whenIdle } from "@/lib/utils"

const loadForm = () => import("@/components/meeting-form").then((m) => m.MeetingForm)
// The form (calendar, date-fns) loads in idle time after the page, not with it. The placeholder holds
// the form's height for the rare open that beats it.
const MeetingForm = dynamic(loadForm, { loading: () => <div className="h-80" /> })

export const NEW_MEETING_EVENT = "wetrack:new-meeting"

export type Prefill = { title?: string; taskId?: string }

export function openNewMeeting(prefill?: Prefill) {
  window.dispatchEvent(new CustomEvent(NEW_MEETING_EVENT, { detail: prefill }))
}

// Mounted once in the app layout; opens on NEW_MEETING_EVENT (⌘K, task detail, Home).
export function NewMeetingDialog({
  members,
  meId,
  calendarConnected,
  slackConnected,
  googleEnabled,
}: {
  members: MemberLite[]
  meId: string
  calendarConnected: boolean
  slackConnected: boolean
  googleEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<Prefill>({})

  useEffect(() => {
    const onOpen = (e: Event) => {
      setPrefill((e as CustomEvent<Prefill | undefined>).detail ?? {})
      setOpen(true)
    }
    window.addEventListener(NEW_MEETING_EVENT, onOpen)
    const cancel = whenIdle(() => void loadForm())
    return () => {
      window.removeEventListener(NEW_MEETING_EVENT, onOpen)
      cancel()
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-tile p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">New meeting</DialogTitle>
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-xs text-muted-foreground">New meeting</span>
          <DialogClose
            aria-label="Close"
            className="-mr-2 grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition-[background-color,scale] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            <XIcon className="size-4" />
          </DialogClose>
        </div>
        {/* The content unmounts on close, so every open starts from fresh defaults. */}
        {googleEnabled ? (
          <MeetingForm
            members={members}
            meId={meId}
            calendarConnected={calendarConnected}
            slackConnected={slackConnected}
            prefill={prefill}
            onDone={() => setOpen(false)}
          />
        ) : (
          <p className="px-6 pt-3 pb-7 text-sm text-muted-foreground">
            Meetings need Google Calendar, which isn&apos;t set up for this workspace yet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
