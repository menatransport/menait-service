"use client"
 
import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
 
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Option {
  option_value: string;
  option_label: string;
}

interface IssueDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  error?: boolean;
  disabled?: boolean;
}

export const IssueDropdown = ({
  value,
  onChange,
  options,
  placeholder = "-- กรุณาเลือก --",
  searchPlaceholder = "ค้นหา...",
  error = false,
  disabled = false
}: IssueDropdownProps) => {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find(opt => opt.option_value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-1/2 h-12 justify-between px-4 bg-white border-2 rounded-xl text-sm font-normal transition-all duration-300 hover:border-[#026a75]/50 focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75]",
            error ? "border-rose-300 bg-rose-50" : "border-gray-200",
            !value && "text-gray-500"
          )}
        >
          {selectedOption ? selectedOption.option_label : placeholder}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 rounded-xl border-2 border-gray-200 shadow-xl" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-10" />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-gray-500">
              ไม่พบรายการ
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.option_value}
                  value={option.option_value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue)
                    setOpen(false)
                  }}
                  className=" cursor-pointer"
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4 text-[#026a75]",
                      value === option.option_value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.option_label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}