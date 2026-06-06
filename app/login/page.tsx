"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase"; // Adjust path if needed
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // Simple Email & Password Authentication
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // If successful, redirect to the dashboard
      router.push("/");
    } catch (error: any) {
      setErrorMsg("Invalid User ID or Password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        
        <div className="bg-slate-900 p-6 text-center">
          <h1 className="text-2xl font-bold text-white tracking-wide">ERP SYSTEM</h1>
          <p className="text-slate-400 text-sm mt-1">
            Authorized Personnel Only
          </p>
        </div>

        <div className="p-8">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-6 border border-red-200 font-medium text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User ID (Email)</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="admin@enterprise.com" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="••••••••" 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-md transition-colors disabled:bg-slate-400 mt-4"
            >
              {loading ? "Authenticating..." : "Secure Sign In"}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}