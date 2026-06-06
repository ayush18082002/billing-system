"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function UserManagement() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndFetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdminAndFetchUsers = async () => {
    setLoading(true);
    
    // 1. Get current logged-in user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.push('/login');
      return;
    }

    // 2. Check if they are a superadmin
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (myProfile?.role !== 'superadmin') {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // 3. If admin, fetch all system users
    setIsAdmin(true);
    fetchProfiles();
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setProfiles(data);
    setLoading(false);
  };

  // Action: Approve or Revoke Access
  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'pending') => {
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
    if (error) alert("Error updating status: " + error.message);
    else fetchProfiles();
  };

  // Action: Promote to Admin or Demote to User
  const handleUpdateRole = async (id: string, newRole: 'superadmin' | 'user') => {
    if (!window.confirm(`Are you sure you want to make this person a ${newRole}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    if (error) alert("Error updating role: " + error.message);
    else fetchProfiles();
  };

  if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Verifying Security Credentials...</div>;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-red-50 text-red-600 p-8 rounded-xl border border-red-200 text-center max-w-md shadow-sm">
          <h2 className="text-2xl font-bold mb-2">🛑 Access Denied</h2>
          <p className="font-medium">You do not have Super Admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 md:p-8">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">User Management</h1>
        <p className="text-slate-500 mt-1">Approve new staff accounts and manage system privileges.</p>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-800 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Email / User ID</th>
                <th className="p-4 text-center">Join Date</th>
                <th className="p-4 text-center">System Role</th>
                <th className="p-4 text-center">Access Status</th>
                <th className="p-4 text-center">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {profiles.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-400 italic">No users found.</td></tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{profile.email}</td>
                    <td className="p-4 text-center text-slate-500">{new Date(profile.created_at).toLocaleDateString()}</td>
                    
                    {/* Role Display */}
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        profile.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {profile.role}
                      </span>
                    </td>

                    {/* Status Display */}
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        profile.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {profile.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        {/* Status Toggles */}
                        {profile.status === 'pending' ? (
                          <button onClick={() => handleUpdateStatus(profile.id, 'approved')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                            ✅ Approve Access
                          </button>
                        ) : (
                          <button onClick={() => handleUpdateStatus(profile.id, 'pending')} className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                            ⏸️ Suspend
                          </button>
                        )}

                        {/* Role Toggles */}
                        {profile.role === 'user' ? (
                          <button onClick={() => handleUpdateRole(profile.id, 'superadmin')} className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                            👑 Make Admin
                          </button>
                        ) : (
                          <button onClick={() => handleUpdateRole(profile.id, 'user')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                            ⬇️ Demote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}