import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateTimePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Data e Horário",
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [time, setTime] = React.useState<string>(
    value ? format(new Date(value), "HH:mm") : ""
  );
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [popoverSide, setPopoverSide] = React.useState<"top" | "bottom">("bottom");

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setTime(format(date, "HH:mm"));
    } else {
      setSelectedDate(undefined);
      setTime("");
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
  };

  const handleSave = () => {
    if (selectedDate && time) {
      const [hours, minutes] = time.split(":").map(Number);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      // Cria a data com o horário selecionado no fuso horário do Brasil (UTC-3)
      // Formato ISO: YYYY-MM-DDTHH:mm:ss-03:00
      const combinedDate = new Date(year, month, day, hours, minutes, 0, 0);
      
      onChange(combinedDate);
      setOpen(false);
    }
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    setTime("");
    onChange(null);
    setOpen(false);
  };

  const formatDisplayValue = () => {
    if (value) {
      const date = new Date(value);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
    return placeholder;
  };

  React.useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const approximatePopoverHeight = 420; // px
    setPopoverSide(spaceBelow < approximatePopoverHeight ? "top" : "bottom");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          ref={triggerRef}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 max-h-[80vh]" 
        align="start"
        side={popoverSide}
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={8}
      >
        <div className="flex flex-col max-h-[80vh]">
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              className="pointer-events-auto"
              locale={ptBR}
            />
            
            <div className="border-t pt-3">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                Horário
              </Label>
              <Input
                type="time"
                value={time}
                onChange={handleTimeChange}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="flex gap-2 p-3 border-t bg-white sticky bottom-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleClear}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={!selectedDate || !time}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact badge version for Kanban cards
interface DateTimeBadgePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
}

export function DateTimeBadgePicker({
  value,
  onChange,
  disabled = false,
}: DateTimeBadgePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [time, setTime] = React.useState<string>(
    value ? format(new Date(value), "HH:mm") : ""
  );
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const [popoverSide, setPopoverSide] = React.useState<"top" | "bottom">("bottom");

  React.useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setTime(format(date, "HH:mm"));
    } else {
      setSelectedDate(undefined);
      setTime("");
    }
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const approximatePopoverHeight = 420;
    setPopoverSide(spaceBelow < approximatePopoverHeight ? "top" : "bottom");
  }, [open]);

  const handleSave = () => {
    if (selectedDate && time) {
      const [hours, minutes] = time.split(":").map(Number);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      // Cria a data com o horário selecionado no fuso horário do Brasil (UTC-3)
      const combinedDate = new Date(year, month, day, hours, minutes, 0, 0);
      
      onChange(combinedDate);
      setOpen(false);
    }
  };

  const formatDisplayValue = () => {
    if (value) {
      const date = new Date(value);
      return format(date, "dd/MM HH:mm", { locale: ptBR });
    }
    return "Agendar";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setOpen(true);
          }}
          className={cn(
            "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
            value
              ? "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          ref={triggerRef}
        >
          <CalendarIcon className="h-3 w-3 mr-1" />
          {formatDisplayValue()}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 max-h-[80vh]" 
        align="start"
        side={popoverSide}
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col max-h-[80vh]">
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
              className="pointer-events-auto"
              locale={ptBR}
            />
            
            <div className="border-t pt-3">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4" />
                Horário
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="flex gap-2 p-3 border-t bg-white sticky bottom-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDate(undefined);
                setTime("");
                onChange(null);
                setOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={!selectedDate || !time}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
