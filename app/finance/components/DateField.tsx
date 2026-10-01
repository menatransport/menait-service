'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateFull, isoToLocalDate, localDateToIso } from '@/lib/finance/dates';

/** Date input that always shows dd/mm/yyyy; value/onChange/min are 'YYYY-MM-DD' strings. */
export function DateField({ value, onChange, disabled, min, placeholder = 'dd/mm/yyyy' }: {
  value: string; onChange: (iso: string) => void; disabled?: boolean; min?: string; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? isoToLocalDate(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}
          className={`h-11 w-full justify-start rounded-xl border-gray-200 bg-white text-left font-normal ${value ? '' : 'text-gray-400'}`}>
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? formatDateFull(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={date => { if (date) { onChange(localDateToIso(date)); setOpen(false); } }}
          disabled={min ? { before: isoToLocalDate(min) } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
