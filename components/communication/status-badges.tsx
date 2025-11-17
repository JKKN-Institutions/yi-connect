import { Badge } from "@/components/ui/badge";
import { AnnouncementStatus } from "@/types/communication";
import {
  CircleDot,
  Clock,
  SendHorizontal,
  CheckCircle2,
  XCircle,
  Ban
} from "lucide-react";

interface StatusBadgeProps {
  status: AnnouncementStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    draft: {
      label: "Draft",
      variant: "secondary" as const,
      icon: CircleDot,
      className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    },
    scheduled: {
      label: "Scheduled",
      variant: "default" as const,
      icon: Clock,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
    },
    sending: {
      label: "Sending",
      variant: "default" as const,
      icon: SendHorizontal,
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
    },
    sent: {
      label: "Sent",
      variant: "default" as const,
      icon: CheckCircle2,
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    },
    cancelled: {
      label: "Cancelled",
      variant: "outline" as const,
      icon: Ban,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    },
    failed: {
      label: "Failed",
      variant: "destructive" as const,
      icon: XCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
    }
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge variant="outline" className={`${statusClassName} ${className || ""}`}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

interface ChannelBadgeProps {
  channel: "email" | "whatsapp" | "in_app";
  className?: string;
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const config = {
    email: {
      label: "Email",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
    },
    whatsapp: {
      label: "WhatsApp",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    },
    in_app: {
      label: "In-App",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
    }
  };

  const { label, className: channelClassName } = config[channel];

  return (
    <Badge variant="outline" className={`${channelClassName} ${className || ""}`}>
      {label}
    </Badge>
  );
}

interface PriorityBadgeProps {
  priority: "low" | "normal" | "high" | "urgent";
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = {
    low: {
      label: "Low",
      className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
    },
    normal: {
      label: "Normal",
      className: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
    },
    high: {
      label: "High",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
    },
    urgent: {
      label: "Urgent",
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
    }
  };

  const { label, className: priorityClassName } = config[priority];

  return (
    <Badge variant="outline" className={`${priorityClassName} ${className || ""}`}>
      {label}
    </Badge>
  );
}
