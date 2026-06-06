"use client";

import { useState, useEffect } from "react";
import { supabase } from "../app/lib/supabase"; // Adjust this path if your lib is somewhere else
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // 1. Skip auth checks entirely if the user is just trying to view the login page
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    // 2. Check if a valid session exists
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // No session found? Kick them to the login screen
        router.push('/login');
      } else {
        // Valid session found! Save their email to display in the top bar
        setUserEmail(session.user.email || null);
        setLoading(false);
      }
    };

    checkAuth();

    // 3. Listen for changes (e.g., if they log out in another tab, log them out here too)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login');
      } else {
        setUserEmail(session.user.email || null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // --- LOGOUT FUNCTION ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // If we are on the login page, just render the login card (No Sidebar, No Topbar)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Prevent flickering by showing a loading screen while Supabase checks the session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 font-medium animate-pulse">
          Verifying security credentials...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      {/* 1. Left Sidebar (Hidden when printing) */}
      <div className="hidden md:block flex-shrink-0 print:hidden">
        <Sidebar />
      </div>

      {/* 2. Main Right Side Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Navigation Bar (Hidden when printing) */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 flex-shrink-0 print:hidden shadow-sm z-10">
          
          <div className="font-bold text-slate-800 md:hidden">
            ERP SYSTEM
          </div>
          
          <div className="hidden md:block text-slate-500 font-medium text-sm">
            Welcome to your workspace
          </div>
          
          {/* User Profile & Logout Area */}
          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="text-sm font-medium text-slate-600 hidden sm:block">
                {userEmail}
              </span>
            )}
            
            <div className="h-5 w-px bg-slate-300 hidden sm:block"></div>
            
            <button 
              onClick={handleLogout}
              className="text-sm font-bold text-slate-600 hover:text-red-600 transition-colors uppercase tracking-wider"
            >
              Logout
            </button>
          </div>
        </header>

        {/* 3. The actual Page Content injected here */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100">
          {children}
        </main>

      </div>
    </div>
  );
}