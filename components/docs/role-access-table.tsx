/**
 * Role Access Table Component
 *
 * Displays role-based permissions for a module with color-coded access levels.
 * Responsive design with card layout on mobile and table on desktop.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Minus } from 'lucide-react';

type AccessLevel = 'full' | 'limited' | 'view' | 'none';

interface RoleAccess {
  role: string;
  access: AccessLevel;
  permissions: string[];
}

interface RoleAccessTableProps {
  accesses: RoleAccess[];
  title?: string;
}

function AccessBadge({ level }: { level: AccessLevel }) {
  switch (level) {
    case 'full':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
          <Check className="h-3 w-3 mr-1" />
          Full Access
        </Badge>
      );
    case 'limited':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
          <Minus className="h-3 w-3 mr-1" />
          Limited
        </Badge>
      );
    case 'view':
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
          <Check className="h-3 w-3 mr-1" />
          View Only
        </Badge>
      );
    case 'none':
      return (
        <Badge variant="secondary" className="text-muted-foreground text-xs">
          <X className="h-3 w-3 mr-1" />
          No Access
        </Badge>
      );
  }
}

export function RoleAccessTable({ accesses, title }: RoleAccessTableProps) {
  return (
    <div className="my-4 sm:my-6">
      {title && (
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">{title}</h3>
      )}

      {/* Mobile: Card Layout */}
      <div className="sm:hidden space-y-3">
        {accesses.map((item) => (
          <Card key={item.role}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-sm">{item.role}</span>
                <AccessBadge level={item.access} />
              </div>
              <div className="text-xs text-muted-foreground">
                {item.permissions.length > 0 ? (
                  <ul className="space-y-0.5">
                    {item.permissions.map((perm, idx) => (
                      <li key={idx}>- {perm}</li>
                    ))}
                  </ul>
                ) : (
                  '-'
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden sm:block border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Role</TableHead>
                <TableHead className="w-[140px]">Access Level</TableHead>
                <TableHead>Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accesses.map((item) => (
                <TableRow key={item.role}>
                  <TableCell className="font-medium text-sm">{item.role}</TableCell>
                  <TableCell>
                    <AccessBadge level={item.access} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.permissions.length > 0
                      ? item.permissions.join(', ')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
