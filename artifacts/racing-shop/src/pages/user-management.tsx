import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListUsers, 
  useCreateUser, 
  useUpdateUser,
  useDeleteUser,
  useListRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useGetMe
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users as UsersIcon, Shield, Plus, Trash2, Pencil, Check, X, Search, Copy, CheckCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_LIST = [
  "Dashboard",
  "Penjualan",
  "Pencairan",
  "Biaya",
  "Master Barang",
  "Master Bank",
  "Master Online Shop",
  "Customer",
  "Modal",
  "Laporan",
  "Manajemen Pengguna",
  "Laporan Malam"
];

const PERMISSION_ACTIONS = ["view", "add", "edit", "delete", "export"];

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  const { data: users, isLoading: isLoadingUsers } = useListUsers();
  const { data: roles, isLoading: isLoadingRoles } = useListRoles();
  const { data: me } = useGetMe();

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  // Permissions
  const checkPermission = (action: string) => {
    const role = String(me?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (me as any)?.permissions || {};
    const perms = permissions['Manajemen Pengguna'] || permissions['manajemen pengguna'] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canAdd = checkPermission('add');
  const canEdit = checkPermission('edit');
  const canDelete = checkPermission('delete');

  // User Form State
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", name: "", role: "" });
  const [confirmPassword, setConfirmPassword] = useState("");

  // Role Form State
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; permissions: Record<string, string[]> }>({ name: "", permissions: {} });

  // Search State
  const [userSearch, setUserSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");

  const filteredUsers = users?.filter(u => 
    u.username.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredRoles = roles?.filter(r => 
    r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  // --- Handlers for Users ---
  const handleSaveUser = async () => {
    try {
      const trimmedForm = {
        ...userForm,
        username: userForm.username.trim(),
        name: userForm.name.trim(),
      };

      if (!trimmedForm.username || !trimmedForm.name || !userForm.role) {
        toast({ title: "Validation Error", description: "Username, name, and role are required", variant: "destructive" });
        return;
      }
      if (!editingUserId && userForm.password !== confirmPassword) {
        toast({ title: "Validation Error", description: "Passwords do not match", variant: "destructive" });
        return;
      }
      if (editingUserId) {
        await updateUser.mutateAsync({ id: editingUserId, data: trimmedForm });
        toast({ title: "Success", description: "User updated successfully." });
      } else {
        if (!userForm.password) {
            toast({ title: "Validation Error", description: "Password is required for new users", variant: "destructive" });
            return;
        }
        await createUser.mutateAsync({ data: trimmedForm });
        toast({ title: "Success", description: "User created successfully." });
      }
      setEditingUserId(null);
      setUserForm({ username: "", password: "", name: "", role: "" });
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save user", variant: "destructive" });
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUserId(user.id);
    setUserForm({ username: user.username, password: "", name: user.name, role: user.role });
    setConfirmPassword("");
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser.mutateAsync({ id });
      toast({ title: "Deleted", description: "User has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // --- Handlers for Roles ---
  const handlePermissionToggle = (menu: string, action: string) => {
    setRoleForm(prev => {
      const currentMenuPerms = prev.permissions[menu] || [];
      const isSelected = currentMenuPerms.includes(action);
      
      let newMenuPerms;
      if (isSelected) {
        newMenuPerms = currentMenuPerms.filter(a => a !== action);
      } else {
        newMenuPerms = [...currentMenuPerms, action];
      }
      
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [menu]: newMenuPerms
        }
      };
    });
  };

  const handleBulkPermissionToggle = (menu: string, all: boolean) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [menu]: all ? [...PERMISSION_ACTIONS] : []
      }
    }));
  };

  const handleAllPermissionsToggle = (all: boolean) => {
    const newPerms: Record<string, string[]> = {};
    if (all) {
      MENU_LIST.forEach(m => {
        newPerms[m] = [...PERMISSION_ACTIONS];
      });
    }
    setRoleForm(prev => ({ ...prev, permissions: newPerms }));
  };

  const handleSaveRole = async () => {
    try {
      const trimmedName = roleForm.name.trim();
      if (!trimmedName) {
        toast({ title: "Validation Error", description: "Role name is required", variant: "destructive" });
        return;
      }
      const payload = { ...roleForm, name: trimmedName };
      if (editingRoleId) {
        await updateRole.mutateAsync({ id: editingRoleId, data: payload });
        toast({ title: "Success", description: "Role updated successfully." });
      } else {
        await createRole.mutateAsync({ data: payload });
        toast({ title: "Success", description: "Role created successfully." });
      }
      setEditingRoleId(null);
      setRoleForm({ name: "", permissions: {} });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save role", variant: "destructive" });
    }
  };

  const handleEditRole = (role: any) => {
    setEditingRoleId(role.id);
    setRoleForm({ name: role.name, permissions: role.permissions || {} });
  };

  const handleCopyRole = (role: any) => {
    setEditingRoleId(null);
    setRoleForm({ name: `${role.name} (Copy)`, permissions: role.permissions || {} });
    setActiveTab("roles");
    toast({ title: "Template Copied", description: "Role template copied to form." });
  };

  const handleDeleteRole = async (id: number) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await deleteRole.mutateAsync({ id });
      toast({ title: "Deleted", description: "Role has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <UsersIcon className="text-primary" /> Manajemen Pengguna
          </h1>
          <p className="text-muted-foreground mt-1">Atur pengguna sistem dan hak akses (role).</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-secondary/30 p-1.5 rounded-xl w-fit border border-border/50">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "users" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <UsersIcon className="w-4 h-4" /> Pengguna
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === "roles" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Shield className="w-4 h-4" /> Hak Akses / Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-1">
          {activeTab === "users" ? (
            (editingUserId ? canEdit : canAdd) && (
            <Card className="border-primary/20 shadow-lg shadow-primary/5 sticky top-24">
              <CardHeader className="bg-secondary/30 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" /> {editingUserId ? "Edit User" : "User Baru"}
                </CardTitle>
                {editingUserId && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingUserId(null); setUserForm({ username: "", password: "", name: "", role: "" }); }}>
                    Batal Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Username</label>
                  <input value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="johndoe" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Nama Lengkap</label>
                  <input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Role</label>
                  <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none">
                    <option value="">-- Pilih Role --</option>
                    {roles?.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Password {editingUserId && "(Kosongkan jika tidak diubah)"}</label>
                  <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="••••••••" />
                </div>
                {!editingUserId && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Konfirmasi Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none" placeholder="••••••••" />
                  </div>
                )}
                <Button onClick={handleSaveUser} className="w-full font-bold shadow-md shadow-primary/20" disabled={createUser.isPending || updateUser.isPending}>
                  {editingUserId ? "Simpan Perubahan" : "Simpan User"}
                </Button>
              </CardContent>
            </Card>
            )
          ) : (
            (editingRoleId ? canEdit : canAdd) && (
            <Card className="border-primary/20 shadow-lg shadow-primary/5 sticky top-24">
              <CardHeader className="bg-secondary/30 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> {editingRoleId ? "Edit Role" : "Role Baru"}
                </CardTitle>
                {editingRoleId && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingRoleId(null); setRoleForm({ name: "", permissions: {} }); }}>
                    Batal Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Nama Role</label>
                  <input 
                    value={roleForm.name} 
                    onChange={e => setRoleForm(prev => ({...prev, name: e.target.value}))} 
                    className={cn(
                      "w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none font-bold",
                      !roleForm.name.trim() && "border-rose-500/30"
                    )} 
                    placeholder="Contoh: Kasir, Admin Toko, dll" 
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-medium tracking-tight font-black uppercase text-muted-foreground tracking-widest pl-1">Hak Akses / Permissions</label>
                    <div className="flex gap-2">
                       <button onClick={() => handleAllPermissionsToggle(true)} className="text-xs italic tracking-tighter font-black uppercase text-primary hover:text-primary/70 transition-colors flex items-center gap-1">
                         <CheckCheck className="w-3 h-3" /> Full Access
                       </button>
                       <button onClick={() => handleAllPermissionsToggle(false)} className="text-xs italic tracking-tighter font-black uppercase text-rose-500 hover:text-rose-500/70 transition-colors flex items-center gap-1">
                         <X className="w-3 h-3" /> Clear All
                       </button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {MENU_LIST.map(menu => (
                      <div key={menu} className="border border-border/40 rounded-xl p-3 bg-secondary/10 hover:border-primary/20 transition-all group/menu">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm text-foreground group-hover/menu:text-primary transition-colors">{menu}</h4>
                          <div className="flex gap-2 opacity-0 group-hover/menu:opacity-100 transition-opacity">
                            <button onClick={() => handleBulkPermissionToggle(menu, true)} className="text-[8px] font-black uppercase text-primary hover:underline">All</button>
                            <button onClick={() => handleBulkPermissionToggle(menu, false)} className="text-[8px] font-black uppercase text-rose-500 hover:underline">None</button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {PERMISSION_ACTIONS.map(action => (
                            <label key={`${menu}-${action}`} className="flex items-center gap-1.5 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={(roleForm.permissions[menu] || []).includes(action)}
                                onChange={() => handlePermissionToggle(menu, action)}
                                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary/40 border-border bg-background"
                              />
                              <span className="text-xs font-medium tracking-tight font-medium text-muted-foreground group-hover:text-foreground uppercase">{action}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSaveRole} className="w-full font-bold shadow-md shadow-primary/20" disabled={createRole.isPending || updateRole.isPending}>
                  {editingRoleId ? "Simpan Perubahan Role" : "Simpan Role Baru"}
                </Button>
              </CardContent>
            </Card>
            )
          )}
        </div>

        {/* List Panel */}
        <div className="lg:col-span-2">
          {activeTab === "users" ? (
             <Card className="border-border/50 shadow-xl shadow-black/5 overflow-hidden">
               <CardHeader className="border-b border-border/50 bg-secondary/10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <CardTitle className="text-lg uppercase tracking-tight font-black">Daftar Pengguna</CardTitle>
                 <div className="relative w-full md:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <input 
                     value={userSearch}
                     onChange={e => setUserSearch(e.target.value)}
                     placeholder="Cari user..."
                     className="w-full bg-background border border-border/50 rounded-xl pl-9 pr-3 py-2 text-sm focus:border-primary outline-none transition-all focus:ring-4 focus:ring-primary/10"
                   />
                 </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto">
                 <table className="w-full text-sm text-left border-collapse">
                   <thead className="text-xs font-medium tracking-tight text-muted-foreground uppercase bg-secondary/30">
                     <tr>
                       <th className="px-4 py-3 font-black tracking-widest">Username</th>
                       <th className="px-4 py-3 font-black tracking-widest">Nama Lengkap</th>
                       <th className="px-4 py-3 font-black tracking-widest">Role</th>
                       <th className="px-4 py-3 text-center font-black tracking-widest">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/30">
                     {isLoadingUsers && <tr><td colSpan={4} className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div></td></tr>}
                      {!isLoadingUsers && filteredUsers?.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-20 text-muted-foreground italic font-medium">Pengguna tidak ditemukan.</td></tr>
                      )}
                      {filteredUsers?.map(user => (
                        <tr key={user.id} className={cn("hover:bg-primary/[0.02] transition-colors", me?.id === user.id && "bg-primary/[0.03]")}>
                          <td className="px-4 py-3 font-semibold text-muted-foreground flex items-center gap-2">
                             {user.username}
                             {me?.id === user.id && <span className="text-[8px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">You</span>}
                          </td>
                          <td className="px-4 py-3 font-black text-foreground">{user.name}</td>
                          <td className="px-4 py-3">
                            <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg text-xs italic tracking-tighter font-black uppercase tracking-wider">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {canEdit && (
                                <button onClick={() => handleEditUser(user)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all border border-blue-500/20 active:scale-90"><Pencil className="w-4 h-4" /></button>
                              )}
                              {me?.id !== user.id ? (
                                canDelete && (
                                  <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-rose-500/20 active:scale-90"><Trash2 className="w-4 h-4" /></button>
                                )
                              ) : (
                                <button disabled title="You cannot delete yourself" className="p-2 text-muted-foreground/30 cursor-not-allowed rounded-xl border border-border/20"><Trash2 className="w-4 h-4 opacity-50" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </CardContent>
             </Card>
          ) : (
            <Card className="border-border/50 shadow-xl shadow-black/5 overflow-hidden">
               <CardHeader className="border-b border-border/50 bg-secondary/10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <CardTitle className="text-lg uppercase tracking-tight font-black">Daftar Roles</CardTitle>
                 <div className="relative w-full md:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <input 
                     value={roleSearch}
                     onChange={e => setRoleSearch(e.target.value)}
                     placeholder="Cari role..."
                     className="w-full bg-background border border-border/50 rounded-xl pl-9 pr-3 py-2 text-sm focus:border-primary outline-none transition-all focus:ring-4 focus:ring-primary/10"
                   />
                 </div>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto">
                 <table className="w-full text-sm text-left border-collapse">
                   <thead className="text-xs font-medium tracking-tight text-muted-foreground uppercase bg-secondary/30">
                     <tr>
                       <th className="px-4 py-3 font-black tracking-widest w-1/4">Nama Role</th>
                       <th className="px-4 py-3 font-black tracking-widest">Ringkasan Hak Akses</th>
                       <th className="px-4 py-3 text-center font-black tracking-widest w-[100px]">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/30">
                      {isLoadingRoles && <tr><td colSpan={3} className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div></td></tr>}
                      {!isLoadingRoles && filteredRoles?.length === 0 && (
                        <tr><td colSpan={3} className="text-center py-20 text-muted-foreground italic font-medium">Role tidak ditemukan.</td></tr>
                      )}
                      {filteredRoles?.map(role => (
                        <tr key={role.id} className="hover:bg-primary/[0.02] transition-colors align-top">
                          <td className="px-4 py-5">
                            <div className="font-black text-foreground tracking-tight">{role.name}</div>
                            <div className="text-xs font-medium tracking-tight text-muted-foreground/60 font-mono mt-1">ID: {role.id}</div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-wrap gap-2">
                              {role.permissions && Object.entries(role.permissions).map(([menu, actions]: [string, any]) => {
                                if (actions.length === 0) return null;
                                return (
                                  <div key={menu} className="flex flex-col gap-1.5 border border-border/40 p-2 rounded-xl bg-secondary/20 hover:border-primary/30 transition-colors">
                                    <span className="text-xs italic tracking-tighter font-black uppercase text-muted-foreground tracking-widest">{menu}</span>
                                    <div className="flex flex-wrap gap-1">
                                      {actions.map((act: string) => (
                                        <span key={act} className="text-[8px] uppercase tracking-tighter bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold border border-primary/5">{act}</span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex items-center justify-center gap-2">
                              {canAdd && (
                                <button onClick={() => handleCopyRole(role)} title="Copy Template" className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all border border-emerald-500/20 active:scale-90"><Copy className="w-4 h-4" /></button>
                              )}
                              {canEdit && (
                                <button onClick={() => handleEditRole(role)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all border border-blue-500/20 active:scale-90"><Pencil className="w-4 h-4" /></button>
                              )}
                               {(role.name.toLowerCase() !== "admin" && role.name.toLowerCase() !== "superadmin") && (
                                 canDelete && (
                                   <button onClick={() => handleDeleteRole(role.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-rose-500/20 active:scale-90"><Trash2 className="w-4 h-4" /></button>
                                 )
                               )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </CardContent>
             </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
