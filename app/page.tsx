export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* Dashboard Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">Welcome to your Billing System overview.</p>
      </div>

      {/* Placeholder Cards for Future Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium">Total Products</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">--</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium">Total Customers</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">--</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-medium">Invoices This Month</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">--</p>
        </div>
      </div>
    </div>
  );
}