import React from 'react';

export default function InvoiceHeader() {
  return (
    <div className="w-full flex flex-col font-sans text-black bg-white pt-4">
      
      {/* Top Regulatory Row */}
      <div className="relative w-full flex justify-center items-start pb-1">
        <div className="text-center flex flex-col items-center">
          <span className="text-[15px] font-bold uppercase underline tracking-wide">
            Tax Invoice
          </span>
          <span className="text-[11px] whitespace-nowrap mt-0.5">
            [See Section 31 CGST Act and Rule1 of Invoice rule]
          </span>
        </div>
        <div className="absolute right-0 bottom-1">
          <span className="text-[15px] font-bold uppercase underline">
            ORIGINAL FOR RECIPIENT
          </span>
        </div>
      </div>

      {/* Main Header Box with Top/Bottom Borders */}
      <div className="w-full border-y-[3px] border-black py-3 flex flex-col items-center justify-center">
        
        {/* Company Name */}
        <h1 
          className="text-4xl font-extrabold text-[#000080] uppercase tracking-wider mb-2"
          style={{ 
            fontFamily: "Georgia, 'Times New Roman', serif",
            textShadow: "1px 1px 0px #fff, -1px -1px 0px #fff, 2px 2px 0px #000080"
          }} 
        >
          SLE MECHTRONICS LLP
        </h1>

        {/* Address */}
        <p className="text-[14px] font-bold uppercase mb-1.5">
          KH NO. 110/22, , MUNDKA INDUSTRIAL AREA , MUNDKA , NEW DELHI -110041
        </p>

        {/* Contact Info */}
        <div className="text-[14px] font-bold flex gap-8">
          <span>Mob. :- +91-9873947619 , +91- 9811258459</span>
          <span>E-Mail : sigmadelhi@yahoo.com</span>
        </div>

      </div>
    </div>
  );
}