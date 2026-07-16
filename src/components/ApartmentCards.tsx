import { useState } from 'react';
import { SheetReport, AlertFilter } from '../types';
import { 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Layers, 
  Eye, 
  Inbox
} from 'lucide-react';

interface ApartmentCardsProps {
  reports: SheetReport[];
  shortageTerms: string[];
}

export default function ApartmentCards({ reports }: ApartmentCardsProps) {
  const [filter, setFilter] = useState<AlertFilter>({
    type: 'all',
    searchText: '',
  });

  const [selectedReport, setSelectedReport] = useState<SheetReport | null>(null);

  // Filter reports
  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.sheetName
      .toLowerCase()
      .includes(filter.searchText.toLowerCase());
    
    if (filter.type === 'alert_only') {
      return matchesSearch && report.hasLowStock;
    }
    return matchesSearch;
  });

  const totalAlarmRooms = reports.filter(r => r.hasLowStock).length;

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search apartments..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-slate-700 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition duration-200 outline-none font-sans text-sm"
              value={filter.searchText}
              onChange={(e) => setFilter({ ...filter, searchText: e.target.value })}
            />
          </div>
          
          <div className="flex gap-2.5">
            <button
              onClick={() => setFilter({ ...filter, type: 'all' })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition duration-200 ${
                filter.type === 'all'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              All ({reports.length})
            </button>
            <button
              onClick={() => setFilter({ ...filter, type: 'alert_only' })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition duration-200 ${
                filter.type === 'alert_only'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-amber-600 hover:bg-amber-50/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Low Stock ({totalAlarmRooms})
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-slate-800 font-semibold mb-1 text-base">No apartments found</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            {filter.type === 'alert_only' 
              ? 'Great! No apartments are currently low on stock.'
              : 'Try searching with another keyword or verify your spreadsheet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {filteredReports.map((report) => {
            return (
              <div 
                key={report.sheetName}
                id={`card-${report.sheetName.replace(/\s+/g, '-')}`}
                className={`bg-white rounded-2xl border transition duration-200 overflow-hidden flex flex-col justify-between ${
                  report.hasLowStock 
                    ? 'border-amber-200 shadow-amber-50/20 shadow-lg' 
                    : 'border-slate-100 hover:border-indigo-100 shadow-xs'
                }`}
              >
                {/* Header of Block */}
                <div className={`p-5 flex items-start justify-between border-b ${
                  report.hasLowStock ? 'bg-amber-50/30 border-amber-100' : 'bg-slate-50/30 border-slate-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      report.hasLowStock ? 'bg-amber-100/80 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      <Building2 className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h4 className="text-slate-800 font-semibold font-display text-base tracking-tight">
                        Apartment: {report.sheetName}
                      </h4>
                      <p className="text-slate-500 text-xs font-sans mt-0.5">
                        Checked row: <strong className="text-slate-700">Row #{report.lastRowIndex}</strong>
                      </p>
                    </div>
                  </div>

                  {report.lastRowIndex === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      No Data
                    </span>
                  ) : report.hasLowStock ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 animate-pulse border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Low Stock ({report.lowItems.length})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Fully Stocked
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 space-y-4">
                  {report.lastRowIndex > 0 ? (
                    <>
                      {/* Critical Low Stock Items lists */}
                      {report.hasLowStock && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-amber-700 tracking-wider uppercase block">
                            Low Stock Items (Action Required):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {report.lowItems.map((item, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs font-medium"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <strong className="font-semibold">{item.name}</strong> ({item.value})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display grid of all check items */}
                      <div className="space-y-2 pt-2 border-t border-dashed border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase flex justify-between">
                          <span>All Inventory Details</span>
                          <span className="text-slate-500 lowercase normal-case">({report.headers.length} items)</span>
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto no-scrollbar py-1">
                          {report.headers.map((header, idx) => {
                            const val = report.values[idx] || '';
                            const isLow = report.lowItems.some(item => item.name === header);
                            
                            return (
                              <div 
                                key={idx}
                                className={`p-2 rounded-lg border text-xs flex justify-between items-center ${
                                  isLow 
                                    ? 'bg-rose-50/40 border-rose-100 text-rose-900 font-medium' 
                                    : 'bg-slate-50/60 border-slate-100 text-slate-600'
                                }`}
                              >
                                <span className="truncate max-w-[100px] text-slate-700 font-sans" title={header}>
                                  {header}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono shrink-0 font-semibold ${
                                  isLow 
                                    ? 'bg-rose-100 text-rose-700' 
                                    : val.toLowerCase() === 'full' || val.toLowerCase() === 'good' || val.toLowerCase() === 'ok'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {val || '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No data rows found. Please update your Google Sheets.
                    </div>
                  )}
                </div>

                {/* Footer actions for this card */}
                {report.lastRowIndex > 0 && (
                  <div className="p-3.5 bg-slate-50/40 border-t border-slate-100 flex justify-between items-center">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium py-1 px-2.5 rounded-lg hover:bg-indigo-50 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View row details
                    </button>
                    
                    <span className="text-[10px] text-slate-400 font-mono">
                      {report.lowItems.length > 0 ? `${report.lowItems.length} issues` : 'Secure'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal - Inspect Full Last Row Object */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-slate-800 font-semibold font-display text-base">
                  Apartment {selectedReport.sheetName} — Row #{selectedReport.lastRowIndex} Details
                </h3>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
              <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs text-indigo-800 space-y-1">
                <p>💡 <strong>Info</strong>: This list displays all inventory levels for the last active row of the sheet tab <strong>{selectedReport.sheetName}</strong>.</p>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Column (Item Name)</th>
                      <th className="py-2.5 px-4 font-semibold">Status Value</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Alert Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {selectedReport.headers.map((header, idx) => {
                      const val = selectedReport.values[idx] || '';
                      const isLow = selectedReport.lowItems.some(item => item.name === header);
                      return (
                        <tr key={idx} className={isLow ? 'bg-amber-50/20' : ''}>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{header}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{val || '(Empty)'}</td>
                          <td className="py-2.5 px-4 text-right">
                            {isLow ? (
                              <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700 rounded-md">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-md">
                                Full
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button 
                onClick={() => setSelectedReport(null)}
                className="px-5 py-2 hover:bg-slate-200 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
