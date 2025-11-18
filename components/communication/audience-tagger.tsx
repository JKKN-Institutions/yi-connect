"use client";

import { useState, useEffect } from "react";
import { AudienceFilter, CommunicationSegment } from "@/types/communication";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Filter, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAudiencePreviewCount } from "@/app/actions/communication";

interface AudienceTaggerProps {
  segmentId?: string;
  audienceFilter?: AudienceFilter;
  segments: CommunicationSegment[];
  onSegmentChange: (segmentId: string | undefined) => void;
  onFilterChange: (filter: AudienceFilter | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function AudienceTagger({
  segmentId,
  audienceFilter,
  segments,
  onSegmentChange,
  onFilterChange,
  disabled = false,
  className
}: AudienceTaggerProps) {
  const [mode, setMode] = useState<"all" | "segment" | "custom">(
    segmentId ? "segment" : audienceFilter ? "custom" : "all"
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);

  // Roles available for filtering
  const availableRoles = [
    "Super Admin",
    "National Admin",
    "Executive Member",
    "Chair",
    "Co-Chair",
    "EC Member",
    "Member"
  ];

  useEffect(() => {
    // Load preview count when segment or filter changes
    const loadPreview = async () => {
      if (mode === "all") {
        setPreviewCount(null);
        return;
      }

      setIsLoadingPreview(true);
      try {
        const result = await getAudiencePreviewCount(segmentId, audienceFilter);
        if (result.success && result.count !== undefined) {
          setPreviewCount(result.count);
        } else {
          console.error("Failed to load preview:", result.message);
          setPreviewCount(null);
        }
      } catch (error) {
        console.error("Failed to load preview:", error);
        setPreviewCount(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [segmentId, audienceFilter, mode]);

  const handleModeChange = (newMode: "all" | "segment" | "custom") => {
    setMode(newMode);

    if (newMode === "all") {
      onSegmentChange(undefined);
      onFilterChange(undefined);
    } else if (newMode === "segment") {
      onFilterChange(undefined);
    } else if (newMode === "custom") {
      onSegmentChange(undefined);
    }
  };

  const getAudienceDescription = () => {
    if (mode === "all") {
      return "All active members in your chapter";
    }

    if (mode === "segment" && segmentId) {
      const segment = segments.find(s => s.id === segmentId);
      return segment?.description || "Selected segment members";
    }

    if (mode === "custom" && audienceFilter) {
      const filters: string[] = [];

      if (audienceFilter.roles && audienceFilter.roles.length > 0) {
        filters.push(`Roles: ${audienceFilter.roles.join(", ")}`);
      }

      if (audienceFilter.engagement) {
        if (audienceFilter.engagement.min !== undefined && audienceFilter.engagement.max !== undefined) {
          filters.push(`Engagement: ${audienceFilter.engagement.min}%-${audienceFilter.engagement.max}%`);
        } else if (audienceFilter.engagement.min !== undefined) {
          filters.push(`Engagement: ≥${audienceFilter.engagement.min}%`);
        } else if (audienceFilter.engagement.max !== undefined) {
          filters.push(`Engagement: ≤${audienceFilter.engagement.max}%`);
        }
      }

      if (audienceFilter.joined_after || audienceFilter.joined_before) {
        filters.push("Date filters applied");
      }

      return filters.length > 0 ? filters.join(" • ") : "Custom filters applied";
    }

    return "Select audience targeting";
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label>Target Audience *</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Choose who will receive this announcement
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant={mode === "all" ? "default" : "outline"}
          onClick={() => handleModeChange("all")}
          disabled={disabled}
          className="flex-col h-auto py-3"
        >
          <Users className="h-5 w-5 mb-1" />
          <span className="text-xs">All Members</span>
        </Button>

        <Button
          type="button"
          variant={mode === "segment" ? "default" : "outline"}
          onClick={() => handleModeChange("segment")}
          disabled={disabled || segments.length === 0}
          className="flex-col h-auto py-3"
        >
          <Target className="h-5 w-5 mb-1" />
          <span className="text-xs">Saved Segment</span>
        </Button>

        <Button
          type="button"
          variant={mode === "custom" ? "default" : "outline"}
          onClick={() => handleModeChange("custom")}
          disabled={disabled}
          className="flex-col h-auto py-3"
        >
          <Filter className="h-5 w-5 mb-1" />
          <span className="text-xs">Custom Filter</span>
        </Button>
      </div>

      {/* Segment Selector */}
      {mode === "segment" && (
        <div>
          <Label>Select Segment</Label>
          <Select
            value={segmentId}
            onValueChange={onSegmentChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a saved segment..." />
            </SelectTrigger>
            <SelectContent>
              {segments.map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{segment.name}</span>
                    {segment.description && (
                      <span className="text-xs text-muted-foreground">
                        {segment.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom Filter Builder */}
      {mode === "custom" && (
        <div>
          <Dialog open={showFilterBuilder} onOpenChange={setShowFilterBuilder}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" disabled={disabled} className="w-full">
                <Filter className="mr-2 h-4 w-4" />
                {audienceFilter ? "Edit Custom Filter" : "Build Custom Filter"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Build Custom Audience Filter</DialogTitle>
                <DialogDescription>
                  Create custom criteria to target specific member groups
                </DialogDescription>
              </DialogHeader>

              <FilterBuilder
                filter={audienceFilter}
                onChange={onFilterChange}
                availableRoles={availableRoles}
                onClose={() => setShowFilterBuilder(false)}
              />
            </DialogContent>
          </Dialog>

          {audienceFilter && (
            <div className="mt-2 p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-2">Active Filters:</p>
              <div className="flex flex-wrap gap-2">
                {audienceFilter.roles && audienceFilter.roles.length > 0 && (
                  <Badge variant="secondary">
                    {audienceFilter.roles.length} role(s)
                  </Badge>
                )}
                {audienceFilter.engagement && (
                  <Badge variant="secondary">Engagement filter</Badge>
                )}
                {(audienceFilter.joined_after || audienceFilter.joined_before) && (
                  <Badge variant="secondary">Date filter</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audience Preview */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium mb-1">Audience Preview</p>
            <p className="text-sm text-muted-foreground">
              {getAudienceDescription()}
            </p>
          </div>

          {isLoadingPreview ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : previewCount !== null ? (
            <div className="text-right">
              <p className="text-2xl font-bold">{previewCount}</p>
              <p className="text-xs text-muted-foreground">members</p>
            </div>
          ) : mode === "all" ? (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">All active members</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Filter Builder Component
interface FilterBuilderProps {
  filter?: AudienceFilter;
  onChange: (filter: AudienceFilter | undefined) => void;
  availableRoles: string[];
  onClose: () => void;
}

function FilterBuilder({
  filter,
  onChange,
  availableRoles,
  onClose
}: FilterBuilderProps) {
  const [localFilter, setLocalFilter] = useState<Partial<AudienceFilter>>(
    filter || {}
  );

  const handleRoleToggle = (role: string) => {
    const currentRoles = localFilter.roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];

    setLocalFilter({
      ...localFilter,
      roles: newRoles.length > 0 ? newRoles : undefined
    });
  };

  const handleApply = () => {
    // Remove undefined fields
    const cleanedFilter = Object.fromEntries(
      Object.entries(localFilter).filter(([_, v]) => v !== undefined)
    ) as AudienceFilter;

    onChange(Object.keys(cleanedFilter).length > 0 ? cleanedFilter : undefined);
    onClose();
  };

  const handleClear = () => {
    setLocalFilter({});
    onChange(undefined);
    onClose();
  };

  return (
    <div className="space-y-6">
      {/* Role Filter */}
      <div>
        <Label className="text-base">Filter by Roles</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Select one or more roles to target
        </p>
        <div className="grid grid-cols-2 gap-3">
          {availableRoles.map((role) => (
            <div key={role} className="flex items-center space-x-2">
              <Checkbox
                id={`role-${role}`}
                checked={(localFilter.roles || []).includes(role)}
                onCheckedChange={() => handleRoleToggle(role)}
              />
              <Label htmlFor={`role-${role}`} className="font-normal cursor-pointer">
                {role}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Filter */}
      <div>
        <Label className="text-base">Filter by Engagement Score</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Target members based on their engagement level (0-100%)
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="engagement-min">Minimum</Label>
            <Input
              id="engagement-min"
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={localFilter.engagement?.min || ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                engagement: {
                  ...localFilter.engagement,
                  min: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
            />
          </div>
          <div>
            <Label htmlFor="engagement-max">Maximum</Label>
            <Input
              id="engagement-max"
              type="number"
              min={0}
              max={100}
              placeholder="100"
              value={localFilter.engagement?.max || ""}
              onChange={(e) => setLocalFilter({
                ...localFilter,
                engagement: {
                  ...localFilter.engagement,
                  max: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={handleClear}>
          Clear All
        </Button>
        <Button type="button" onClick={handleApply}>
          Apply Filter
        </Button>
      </div>
    </div>
  );
}
