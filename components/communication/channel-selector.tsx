"use client";

import { useState } from "react";
import { AnnouncementChannel } from "@/types/communication";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelSelectorProps {
  selectedChannels: AnnouncementChannel[];
  onChange: (channels: AnnouncementChannel[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ChannelSelector({
  selectedChannels,
  onChange,
  disabled = false,
  className
}: ChannelSelectorProps) {
  const channels: Array<{
    id: AnnouncementChannel;
    label: string;
    description: string;
    icon: typeof Mail;
    color: string;
  }> = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      description: "Send via WhatsApp Business API",
      icon: MessageCircle,
      color: "text-green-600 dark:text-green-400"
    },
    {
      id: "email",
      label: "Email",
      description: "Send via email to member addresses",
      icon: Mail,
      color: "text-purple-600 dark:text-purple-400"
    },
    {
      id: "in_app",
      label: "In-App Notification",
      description: "Real-time notification in the app",
      icon: Bell,
      color: "text-blue-600 dark:text-blue-400"
    }
  ];

  const handleChannelToggle = (channelId: AnnouncementChannel) => {
    if (disabled) return;

    if (selectedChannels.includes(channelId)) {
      onChange(selectedChannels.filter((c) => c !== channelId));
    } else {
      onChange([...selectedChannels, channelId]);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Select Channels *</Label>
      <div className="space-y-2">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const isSelected = selectedChannels.includes(channel.id);

          return (
            <div
              key={channel.id}
              className={cn(
                "flex items-start space-x-3 rounded-lg border p-4 transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Checkbox
                id={`channel-${channel.id}`}
                checked={isSelected}
                onCheckedChange={() => handleChannelToggle(channel.id)}
                disabled={disabled}
                className="mt-1"
              />
              <div className="flex-1">
                <Label
                  htmlFor={`channel-${channel.id}`}
                  className={cn(
                    "flex items-center font-medium cursor-pointer",
                    disabled && "cursor-not-allowed"
                  )}
                >
                  <Icon className={cn("mr-2 h-4 w-4", channel.color)} />
                  {channel.label}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {channel.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
