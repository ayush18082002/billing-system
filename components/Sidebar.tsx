import Link from 'next/link';

export default function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-8 text-center border-b border-slate-700 pb-4">
        Billing System
      </h1>
      
      <nav className="flex flex-col gap-2">
        <Link href="/" className="hover:bg-slate-800 p-3 rounded transition-colors">
          Dashboard and Report
        </Link>
        <Link href="/products" className="hover:bg-slate-800 p-3 rounded transition-colors">
          Products Master
        </Link>
        <Link href="/customers" className="hover:bg-slate-800 p-3 rounded transition-colors">
          Customers Master
        </Link>
        <Link href="/quotations" className="hover:bg-slate-800 p-3 rounded transition-colors">
          Billing
        </Link>
      </nav>
    </div>
  );
}