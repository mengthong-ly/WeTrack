"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type Option = { value: string; label: React.ReactNode }

// Thin wrapper over the Base UI select so every picker in the app looks and behaves the same.
export function Pick({
  value,
  onChange,
  options,
  placeholder,
  className,
  variant = "outline",
  "aria-label": ariaLabel,
}: {
  value: string | null
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  variant?: "outline" | "ghost"
  "aria-label"?: string
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v != null && onChange(String(v))}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-9 rounded-full",
          variant === "ghost" && "-ml-2.5 border-transparent hover:bg-muted",
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
