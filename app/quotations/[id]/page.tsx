"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

// Helper function to convert INR numbers to words (Indian Numbering System)
const numberToWords = (num: number | string) => {
  if (!num || isNaN(Number(num))) return "Zero Rupees Only";
  const [rupees, paise] = Number(num).toFixed(2).split('.');
  
  const toWords = (n: number) => {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    if (n === 0) return '';
    if (n > 999999999) return 'Overflow';
    let str = '';
    const core = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!core) return '';
    str += (Number(core[1]) !== 0) ? (a[Number(core[1])] || b[core[1][0] as any] + ' ' + a[core[1][1] as any]) + 'Crore ' : '';
    str += (Number(core[2]) !== 0) ? (a[Number(core[2])] || b[core[2][0] as any] + ' ' + a[core[2][1] as any]) + 'Lakh ' : '';
    str += (Number(core[3]) !== 0) ? (a[Number(core[3])] || b[core[3][0] as any] + ' ' + a[core[3][1] as any]) + 'Thousand ' : '';
    str += (Number(core[4]) !== 0) ? (a[Number(core[4])] || b[core[4][0] as any] + ' ' + a[core[4][1] as any]) + 'Hundred ' : '';
    str += (Number(core[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(core[5])] || b[core[5][0] as any] + ' ' + a[core[5][1] as any]) : '';
    return str.trim();
  };
  
  let res = toWords(Number(rupees)) + ' Rupees';
  if (Number(paise) > 0) {
     res += ' and ' + toWords(Number(paise)) + ' Paise';
  }
  return res + ' Only';
};

export default function QuotationPrintView() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // NOTE: Replace this with your actual Home State UUID from state_master
  const COMPANY_STATE_ID = "REPLACE_WITH_COMPANY_STATE_UUID"; 

  useEffect(() => {
    if (params.id) {
      fetchQuotationData(params.id as string);
    }
  }, [params.id]);

  const fetchQuotationData = async (id: string) => {
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotations')
      .select('*, customers!fk_quotation_customer(*)')
      .eq('id', id)
      .single();

    if (quoteError) {
      console.error(quoteError);
      setLoading(false);
      return;
    }

    const { data: itemsData } = await supabase
      .from('quotation_line_items')
      .select('*, products(*)')
      .eq('quotation_id', id);

    const { data: statesData } = await supabase.from('state_master').select('*');

    setQuotation(quoteData);
    if (itemsData) setLineItems(itemsData);
    if (statesData) setStates(statesData);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Loading document...</div>;
  if (!quotation) return <div className="p-10 text-center text-red-500 font-bold">Quotation not found.</div>;

  const customer = quotation.customers;
  const isLocal = Number(quotation.cgst) > 0 || Number(quotation.sgst) > 0;

  const getStateDetails = (stateId: string) => {
    return states.find(s => s.id === stateId) || { state_name: 'N/A', code: 'N/A' };
  };

  const customerState = getStateDetails(customer.state);
  const consigneeState = quotation.consignee_state ? getStateDetails(quotation.consignee_state) : null;
  const companyState = getStateDetails(COMPANY_STATE_ID);

  const placeOfSupply = quotation.is_consignee_different && consigneeState 
    ? consigneeState.state_name 
    : customerState.state_name;

  return (
    <>
      {/* NEW: Strict Print Isolation CSS 
        This forces the browser to hide the sidebar, header, and body, 
        and pins only the invoice to the absolute top-left of the printed page.
      */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-invoice, #printable-invoice * {
              visibility: visible;
            }
            #printable-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            #print-action-bar {
              display: none !important;
            }
          }
        `
      }} />

      {/* Main Wrapper with ID for Print Targeting */}
      <div id="printable-invoice" className="bg-slate-100 min-h-screen p-4 md:p-8 print:p-0 print:bg-white text-black">
        
        {/* ACTION BAR */}
        <div id="print-action-bar" className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
          <button onClick={() => router.push('/quotations')} className="text-slate-600 hover:text-slate-900 font-medium">
            ← Back to Dashboard
          </button>
          <button 
            onClick={() => window.print()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>

        {/* THE A4 INVOICE DOCUMENT */}
        <div className="max-w-5xl mx-auto bg-white print:max-w-full text-xs md:text-sm">
          
          {/* TEXT OUTSIDE THE BORDER */}
          <div className="text-center mb-1">
            <h1 className="text-xl font-bold uppercase tracking-wider text-black">TAX Invoice</h1>
            <p className="text-xs text-black font-medium">See Section 31 CGST Act & Rule 1 of Invoice Rule</p>
          </div>

          {/* ========================================== */}
          {/* START OF BLACK BORDER ENCLOSURE */}
          {/* ========================================== */}
          <div className="border-[2px] border-black text-xs md:text-sm">
            
            {/* COMPANY HEADER ROW */}
            <div className="flex border-b-[2px] border-black">
              <div className="w-1/2 p-2 border-r-[2px] border-black">
                <h2 className="text-lg font-bold uppercase">YOUR ENTERPRISE NAME</h2>
                <p className="font-medium mt-1">Manufacturers of Industrial Equipment</p>
                <p>123 Business Tech Park, Sector 45</p>
                <p>New Delhi, India 110001</p>
                <p className="mt-1">Mobile: +91 98765 43210</p>
                <p>Email: billing@yourenterprise.com</p>
              </div>
              <div className="w-1/2 p-2 flex flex-col justify-center">
                <div className="grid grid-cols-[100px_1fr] gap-1">
                  <span className="font-bold">GSTIN/UIN</span><span className="uppercase">: 07AAACA1234A1Z5</span>
                  <span className="font-bold">PAN</span><span className="uppercase">: AAACA1234A</span>
                  <span className="font-bold">IEC No.</span><span className="uppercase">: 0123456789</span>
                  <span className="font-bold">State Code</span><span className="uppercase">: {companyState.code || '07'}</span>
                </div>
              </div>
            </div>

            {/* INVOICE DETAILS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-b-[2px] border-black divide-x-[2px] divide-black">
              <div className="p-2">
                <p className="text-[10px] md:text-xs font-bold mb-1">Invoice / Bill No.</p>
                <p className="font-semibold">{quotation.bill_no}</p>
              </div>
              <div className="p-2">
                <p className="text-[10px] md:text-xs font-bold mb-1">Date of Supply</p>
                <p className="font-semibold">{new Date(quotation.quotation_date).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="p-2">
                <p className="text-[10px] md:text-xs font-bold mb-1">Place of Supply</p>
                <p className="font-semibold">{placeOfSupply}</p>
              </div>
              <div className="p-2">
                <p className="text-[10px] md:text-xs font-bold mb-1">Vehicle Number</p>
                <p className="font-semibold">{quotation.vehicle_number || 'N/A'}</p>
              </div>
            </div>

            {/* PARTIES ROW (Billed To / Shipped To) */}
            <div className="flex border-b-[2px] border-black">
              <div className="w-1/2 p-2 border-r-[2px] border-black">
                <p className="text-xs font-bold italic mb-1 underline">Details of Receiver (Billed to)</p>
                <h3 className="font-bold uppercase">{customer.business_name}</h3>
                <p className="whitespace-pre-line mt-1">{customer.billing_address}</p>
                {customer.phone && <p>Phone: {customer.phone}</p>}
                
                <div className="mt-2 grid grid-cols-[80px_1fr] gap-y-0.5">
                  <span className="font-bold text-xs">State</span><span className="text-xs">: {customerState.state_name}</span>
                  <span className="font-bold text-xs">State Code</span><span className="text-xs">: {customerState.code}</span>
                  <span className="font-bold text-xs">GSTIN</span><span className="text-xs uppercase">: {customer.gstin || 'Unregistered'}</span>
                  <span className="font-bold text-xs">PAN</span><span className="text-xs uppercase">: {customer.pan || 'N/A'}</span>
                </div>
              </div>

              <div className="w-1/2 p-2">
                <p className="text-xs font-bold italic mb-1 underline">Details of Consignee (Shipped to)</p>
                {quotation.is_consignee_different ? (
                  <>
                    <h3 className="font-bold uppercase">{quotation.consignee_name}</h3>
                    <p className="whitespace-pre-line mt-1">{quotation.consignee_address}</p>
                    
                    <div className="mt-2 grid grid-cols-[80px_1fr] gap-y-0.5">
                      <span className="font-bold text-xs">State</span><span className="text-xs">: {consigneeState?.state_name}</span>
                      <span className="font-bold text-xs">State Code</span><span className="text-xs">: {consigneeState?.code}</span>
                      <span className="font-bold text-xs">GSTIN</span><span className="text-xs uppercase">: {quotation.consignee_gstin || 'Unregistered'}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-400 italic">Same as Billed To</p>
                  </div>
                )}
              </div>
            </div>

            {/* LINE ITEMS TABLE */}
            <div className="border-b-[2px] border-black">
              <table className="w-full text-left text-[10px] md:text-xs">
                <thead className="border-b-[2px] border-black bg-slate-50">
                  <tr className="divide-x-[2px] divide-black">
                    <th className="p-1 md:p-2 font-bold text-center w-8">S.No</th>
                    <th className="p-1 md:p-2 font-bold">Description of Goods</th>
                    <th className="p-1 md:p-2 font-bold text-center">HSN/SAC</th>
                    <th className="p-1 md:p-2 font-bold text-center w-12">Qty</th>
                    <th className="p-1 md:p-2 font-bold text-right">Rate</th>
                    <th className="p-1 md:p-2 font-bold text-center">Disc%</th>
                    <th className="p-1 md:p-2 font-bold text-right">Taxable</th>
                    
                    {isLocal ? (
                      <>
                        <th className="p-1 md:p-2 font-bold text-right">CGST</th>
                        <th className="p-1 md:p-2 font-bold text-right">SGST</th>
                      </>
                    ) : (
                      <th className="p-1 md:p-2 font-bold text-right">IGST</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y-[2px] divide-black">
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="divide-x-[2px] divide-black">
                      <td className="p-1 md:p-2 text-center align-top">{index + 1}</td>
                      <td className="p-1 md:p-2 align-top">
                        <span className="font-bold">{item.products?.name}</span>
                      </td>
                      <td className="p-1 md:p-2 text-center align-top">{item.products?.hsn_code || '-'}</td>
                      <td className="p-1 md:p-2 text-center align-top">{item.qty} {item.products?.uom}</td>
                      <td className="p-1 md:p-2 text-right align-top">₹{Number(item.rate).toFixed(2)}</td>
                      <td className="p-1 md:p-2 text-center align-top">{Number(item.discount_percent) > 0 ? `${item.discount_percent}%` : '-'}</td>
                      <td className="p-1 md:p-2 text-right align-top font-bold">₹{Number(item.taxable_amount).toFixed(2)}</td>
                      
                      {isLocal ? (
                        <>
                          <td className="p-1 md:p-2 text-right align-top">
                            ₹{Number(item.cgst_amount).toFixed(2)} <span className="block text-[8px] text-gray-500">({item.gst_percent / 2}%)</span>
                          </td>
                          <td className="p-1 md:p-2 text-right align-top">
                            ₹{Number(item.sgst_amount).toFixed(2)} <span className="block text-[8px] text-gray-500">({item.gst_percent / 2}%)</span>
                          </td>
                        </>
                      ) : (
                        <td className="p-1 md:p-2 text-right align-top">
                          ₹{Number(item.igst_amount).toFixed(2)} <span className="block text-[8px] text-gray-500">({item.gst_percent}%)</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTALS & BANK DETAILS */}
            <div className="flex">
              {/* Left side: Bank Info */}
              <div className="w-1/2 p-4 border-r-[2px] border-black flex flex-col justify-center">
                <p className="text-xs md:text-sm font-bold italic underline mb-2">Bank Details:</p>
                <div className="grid grid-cols-[100px_1fr] gap-y-1">
                  <span className="font-bold">Bank Name</span><span>: HDFC Bank Ltd.</span>
                  <span className="font-bold">A/C Name</span><span>: YOUR ENTERPRISE NAME</span>
                  <span className="font-bold">A/C Number</span><span>: 50200012345678</span>
                  <span className="font-bold">IFSC Code</span><span>: HDFC0001234</span>
                </div>
              </div>

              {/* Right side: Math Breakdown */}
              <div className="w-1/2">
                <table className="w-full text-xs md:text-sm">
                  <tbody className="divide-y-[2px] divide-black">
                    <tr>
                      <td className="py-1 px-2 font-bold">Total Taxable Value</td>
                      <td className="py-1 px-2 text-right font-bold w-32 border-l-[2px] border-black">₹{Number(quotation.subtotal).toFixed(2)}</td>
                    </tr>
                    
                    {isLocal ? (
                      <>
                        <tr>
                          <td className="py-1 px-2 font-bold">Add: CGST</td>
                          <td className="py-1 px-2 text-right w-32 border-l-[2px] border-black">₹{Number(quotation.cgst).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-2 font-bold">Add: SGST</td>
                          <td className="py-1 px-2 text-right w-32 border-l-[2px] border-black">₹{Number(quotation.sgst).toFixed(2)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td className="py-1 px-2 font-bold">Add: IGST</td>
                        <td className="py-1 px-2 text-right w-32 border-l-[2px] border-black">₹{Number(quotation.igst).toFixed(2)}</td>
                      </tr>
                    )}

                    {Number(quotation.packaging_charges) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-bold">Add: Packaging Charges</td>
                        <td className="py-1 px-2 text-right w-32 border-l-[2px] border-black">₹{Number(quotation.packaging_charges).toFixed(2)}</td>
                      </tr>
                    )}
                    
                    {Number(quotation.carrier_charges) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-bold">Add: Freight Charges</td>
                        <td className="py-1 px-2 text-right w-32 border-l-[2px] border-black">₹{Number(quotation.carrier_charges).toFixed(2)}</td>
                      </tr>
                    )}

                    {Number(quotation.other_charges) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-bold">Add: Other Costs</td>
                        <td className="py-1 px-2 text-right w-32 border-l-[2px] border-black">₹{Number(quotation.other_charges).toFixed(2)}</td>
                      </tr>
                    )}
                    
                    <tr className="bg-slate-50">
                      <td className="py-2 px-2 text-sm md:text-base font-black uppercase tracking-wide">Grand Total</td>
                      <td className="py-2 px-2 text-right text-sm md:text-base font-black w-32 border-l-[2px] border-black">₹{Number(quotation.grand_total).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* INVOICE VALUE IN WORDS */}
            <div className="border-t-[2px] border-black p-3 bg-slate-50">
              <span className="font-bold">Invoice Value (In Words): </span> 
              <span className="italic font-medium">{numberToWords(quotation.grand_total)}</span>
            </div>

            {/* REVERSE CHARGE TEXT */}
            <div className="border-t-[2px] border-black p-3">
              <span className="font-bold">Tax is payable on reverse charge (Yes/No): </span> 
              <span>No</span>
            </div>

            {/* CERTIFICATION */}
            <div className="border-t-[2px] border-black p-3 font-bold text-center">
              Certified that the particulars given above are true and correct.
            </div>

            {/* TERMS & SIGNATURE BLOCK */}
            <div className="border-t-[2px] border-black flex">
              
              {/* Terms and Conditions (Left) */}
              <div className="w-1/2 p-3 border-r-[2px] border-black">
                <p className="text-xs md:text-sm font-bold italic underline mb-2">Terms & Conditions:</p>
                <ul className="text-[10px] md:text-xs list-decimal list-inside space-y-1">
                  <li>Goods once sold will not be taken back or exchanged.</li>
                  <li>Interest @ 18% p.a. will be charged if payment is delayed beyond 15 days.</li>
                  <li>Our responsibility ceases the moment goods leave our premises.</li>
                  <li>Subject to Delhi jurisdiction only.</li>
                </ul>
              </div>

              {/* Signature (Right) */}
              <div className="w-1/2 p-3 flex flex-col justify-between items-end text-center">
                <p className="font-bold w-full text-right">For YOUR ENTERPRISE NAME</p>
                <div className="h-16"></div> {/* Space for physical signature/stamp */}
                <div className="w-48 border-t border-black pt-1 mr-2">
                  <p className="text-xs font-bold uppercase">Authorized Signatory</p>
                </div>
              </div>
            </div>
            
          </div>
          {/* ========================================== */}
          {/* END OF BLACK BORDER ENCLOSURE */}
          {/* ========================================== */}

        </div>
      </div>
    </>
  );
}