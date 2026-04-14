'use client';

/**
 * MembersTable — shows workspace members with roles.
 * Owners can invite new members (by email) and remove existing ones.
 * Non-owners see a read-only list.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface WorkspaceMember {
  userId: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
}

interface MembersTableProps {
  workspaceId: string;
  currentUserId: string;
  initialMembers: WorkspaceMember[];
  isOwner: boolean;
}

const roleVariantMap: Record<
  WorkspaceMember['role'],
  { label: string; className: string }
> = {
  owner: { label: 'Owner', className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400' },
  editor: { label: 'Editor', className: 'border-blue-500/20 bg-blue-500/10 text-blue-400' },
  viewer: { label: 'Viewer', className: 'border-slate-500/20 bg-slate-500/10 text-slate-400' },
};

export function MembersTable({
  workspaceId,
  currentUserId,
  initialMembers,
  isOwner,
}: MembersTableProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(body.error ?? 'Failed to invite member');
        return;
      }

      // Optimistically add the new member
      const newMember: WorkspaceMember = {
        userId: body.userId,
        email: inviteEmail.trim(),
        role: inviteRole,
        createdAt: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, newMember]);
      setInviteEmail('');
      toast.success(`${inviteEmail.trim()} added as ${inviteRole}`);
    } catch {
      toast.error('Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to remove member' }));
        toast.error(body.error ?? 'Failed to remove member');
        return;
      }

      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  }

  const ownerCount = members.filter((m) => m.role === 'owner').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Members
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Member list */}
        <div className="divide-y divide-border rounded-md border">
          {members.map((member) => {
            const roleInfo = roleVariantMap[member.role];
            const isSelf = member.userId === currentUserId;
            const isLastOwner = member.role === 'owner' && ownerCount <= 1;
            const canRemove = isOwner && !isSelf && !isLastOwner;

            return (
              <div
                key={member.userId}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">
                    {member.email}
                    {isSelf && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Added {new Date(member.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={roleInfo.className}>
                    {roleInfo.label}
                  </Badge>

                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(member.userId)}
                      disabled={removingId === member.userId}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Remove {member.email}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Invite form (owners only) */}
        {isOwner && (
          <div className="flex flex-col gap-3 rounded-md border border-dashed p-3">
            <Label className="text-xs font-medium">Invite Member</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                className="h-8 flex-1 text-sm"
              />
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as 'editor' | 'viewer')}
              >
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8"
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isInviting}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="ml-1.5">Invite</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The user must have an existing account. Editors can upload documents; viewers can only chat.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
