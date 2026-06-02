"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // A simple list of our navigation routes
  const navLinks = [
    { name: "Dashboard & Reports", href: "/" },
    { name: "Customers", href: "/customers" },
    { name: "Products", href: "/products" },
    { name: "Billings", href: "/quotations" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      
      {/* 1. THE SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wider text-blue-400">ERP<span className="text-white">SYSTEM</span></h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navLinks.map((link) => {
            // Check if the current page matches the link so we can highlight it
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
        
        {/* User Profile Area at bottom of sidebar */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
              A
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">Admin User</span>
              <span className="text-xs text-slate-400">Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. THE MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* THE TOP HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <h2 className="text-lg font-medium text-slate-700">
            {navLinks.find(link => link.href === pathname)?.name || "Dashboard"}
          </h2>
          
          <button 
            onClick={() => alert("Logout functionality coming soon!")}
            className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5 border border-transparent hover:border-red-100 hover:bg-red-50 rounded-md"
          >
            Logout
          </button>
        </header>

        {/* THE DYNAMIC PAGE CONTENT */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-8">
          {children}
        </main>
        
      </div>
    </div>
  );
}