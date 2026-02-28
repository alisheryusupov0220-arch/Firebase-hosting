"use client"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type ComboboxProps = {
  options: { value: string; label: string }[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  notFoundMessage?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  notFoundMessage = "No option found.",
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")

  const selectedLabel = React.useMemo(() => {
    return options.find((option) => option.value === value)?.label
  }, [options, value])

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [options, searchTerm])

  // Reset search term when popover closes to ensure the full list is shown next time.
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
            <Input 
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="h-9"
            />
        </div>
        <ScrollArea className="h-[200px]">
            {filteredOptions.length > 0 ? (
                <div className="p-1">
                    {filteredOptions.map((option) => (
                        <Button
                            key={option.value}
                            variant="ghost"
                            className="w-full justify-start font-normal h-auto py-1.5 px-2"
                            onClick={() => {
                                onChange(option.value)
                                setOpen(false)
                            }}
                        >
                             <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                value === option.value ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <span className="truncate">{option.label}</span>
                        </Button>
                    ))}
                </div>
            ) : (
                <p className="p-4 text-center text-sm text-muted-foreground">{notFoundMessage}</p>
            )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
