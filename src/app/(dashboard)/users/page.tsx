"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import { Plus, Key, Trash2 } from "lucide-react";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("COUNTER_OPERATOR");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUserName, setResetUserName] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/users");
    const json = await res.json();
    setUsers(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        name: newName,
        role: newRole,
      }),
    });
    setCreating(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to create user");
      return;
    }

    toast.success(`User "${newUsername}" created`);
    setCreateOpen(false);
    setNewUsername("");
    setNewPassword("");
    setNewName("");
    setNewRole("COUNTER_OPERATOR");
    fetchUsers();
  }

  async function toggleActive(user: User) {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, active: !user.active }),
    });

    if (!res.ok) {
      toast.error("Failed to update user");
      return;
    }

    toast.success(`User ${user.active ? "deactivated" : "activated"}`);
    fetchUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setDeletingId(user.id);
    const res = await fetch(`/api/users?id=${user.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to delete user");
      return;
    }
    toast.success(`User "${user.username}" deleted`);
    fetchUsers();
  }

  async function handleResetPassword() {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetUserId, password: resetPassword }),
    });

    if (!res.ok) {
      toast.error("Failed to reset password");
      return;
    }

    toast.success("Password reset successfully");
    setResetOpen(false);
    setResetPassword("");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">Manage counter operators and owners</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New User
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "OWNER" ? "default" : "secondary"}>
                      {user.role === "OWNER" ? "Owner" : user.role === "MANAGER" ? "Manager" : "Counter Operator"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "default" : "destructive"}>
                      {user.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResetUserId(user.id);
                          setResetUserName(user.name);
                          setResetPassword("");
                          setResetOpen(true);
                        }}
                        title="Reset password"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                        title="Delete user"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={user.active}
                        onCheckedChange={() => toggleActive(user)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Username *</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <Label>Role *</Label>
              <AsyncSelect
                value={newRole}
                onValueChange={setNewRole}
                options={[
                  { id: "COUNTER_OPERATOR", name: "Counter Operator" },
                  { id: "MANAGER", name: "Manager" },
                  { id: "OWNER", name: "Owner" },
                ]}
                placeholder="Select role"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newUsername || !newPassword || !newName}>
              {creating ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password — {resetUserName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New Password *</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={!resetPassword}>
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
