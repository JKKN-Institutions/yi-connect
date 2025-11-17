"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  scheduledAt?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function SchedulePicker({
  scheduledAt,
  onChange,
  disabled = false,
  className
}: SchedulePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    scheduledAt
  );
  const [time, setTime] = useState<string>(
    scheduledAt ? format(scheduledAt, "HH:mm") : "09:00"
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      onChange(undefined);
      return;
    }

    // Combine date and time
    const [hours, minutes] = time.split(":");
    const newDate = new Date(date);
    newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    setSelectedDate(newDate);
    onChange(newDate);
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);

    if (selectedDate) {
      const [hours, minutes] = newTime.split(":");
      const newDate = new Date(selectedDate);
      newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      setSelectedDate(newDate);
      onChange(newDate);
    }
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    onChange(undefined);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label>Schedule for Later (Optional)</Label>
        {selectedDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
            className="h-auto p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? (
                format(selectedDate, "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Input
          type="time"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={disabled || !selectedDate}
          className="w-32"
        />
      </div>

      {selectedDate && (
        <p className="text-sm text-muted-foreground">
          Will be sent on {format(selectedDate, "PPP 'at' p")}
        </p>
      )}

      {selectedDate && selectedDate <= new Date() && (
        <p className="text-sm text-destructive">
          Scheduled time must be in the future
        </p>
      )}
    </div>
  );
}
