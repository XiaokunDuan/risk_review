import React, { useState, useMemo } from 'react';
import { FileUploader } from './FileUploader';
import { processRiskCSV, processSourceMapping, downloadRiskData } from '../utils/processor';
import { RiskAnalysisRow } from '../types';
import { Filter, BarChart3, Search, FileText, X, Copy, Layers, CheckSquare, Square, Upload, Database, Download } from 'lucide-react';

export const RiskAnalyzer: React.FC = () => {
  const [data, setData] = useState<RiskAnalysisRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Source Mapping State
  const [sourceLoading, setSourceLoading] = useState(false);
  const [hasSourceData, setHasSourceData] = useState(false);

  // Threshold state
  const [threshold, setThreshold] = useState<number>(0.0001);

  const handleFilesSelect = async (files: File[]) => {
    setLoading(true);
    setError(null);
    setData([]);
    setSelectedIds(new Set());
    setHasSourceData(false);

    try {
      const promises = files.map(file => processRiskCSV(file));
      const results = await Promise.all(promises);
      
      let globalIdCounter = 0;

      // FIX: Use flatMap instead of spread operator (...) to avoid "Maximum call stack size exceeded" on large files
      const combinedData = results.flatMap((fileRows) => {
        return fileRows.map((row) => ({
          ...row,
          id: globalIdCounter++, // Re-index rows to ensure unique IDs across multiple files
        }));
      });

      if (combinedData.length === 0) {
        setError("No valid rows found in the uploaded files. Please check the column names.");
      } else {
        setData(combinedData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse one or more files.");
    } finally {
      setLoading(false);
    }
  };

  const handleSourceFileSelect = async (files: File[]) => {
      if (files.length === 0) return;
      const file = files[0]; // Only take first for now, or could loop
      setSourceLoading(true);
      setError(null);

      try {
          const mapping = await processSourceMapping(file);
          
          // Update existing data with NIDs
          setData(prevData => {
              const updated = prevData.map(row => {
                  const nid = mapping.get(row.content); // Content is already normalized in processRiskCSV
                  return nid ? { ...row, nid } : row;
              });
              
              // Check if we actually mapped anything
              const matchedCount = updated.filter(r => r.nid).length;
              if (matchedCount > 0) {
                  setHasSourceData(true);
              }
              return updated;
          });

      } catch (err: any) {
          console.error(err);
          setError(`Source File Error: ${err.message}`);
      } finally {
          setSourceLoading(false);
      }
  };

  // Filter logic
  const filteredData = useMemo(() => {
    return data.filter(row => row.riskScore >= threshold).sort((a, b) => b.riskScore - a.riskScore);
  }, [data, threshold]);

  const maxScore = useMemo(() => {
    return data.length > 0 ? Math.max(...data.map(d => d.riskScore)) : 1;
  }, [data]);

  // Selection Logic
  const toggleSelectRow = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    // If all currently filtered rows are selected, unselect them. Otherwise, select all.
    const allFilteredSelected = filteredData.length > 0 && filteredData.every(row => selectedIds.has(row.id));
    
    if (allFilteredSelected) {
        setSelectedIds(new Set());
    } else {
        const newSet = new Set(filteredData.map(r => r.id));
        setSelectedIds(newSet);
    }
  };

  const isAllSelected = filteredData.length > 0 && filteredData.every(row => selectedIds.has(row.id));

  // Export Logic
  const handleExport = () => {
    const targetData = selectedIds.size > 0 
        ? filteredData.filter(row => selectedIds.has(row.id))
        : filteredData;
    
    if (targetData.length === 0) {
        alert("No data to export.");
        return;
    }

    // Deduplicate by content to ensure unique exports
    const seenContent = new Set<string>();
    const uniqueData: RiskAnalysisRow[] = [];
    
    targetData.forEach(row => {
        if (!seenContent.has(row.content)) {
            seenContent.add(row.content);
            uniqueData.push(row);
        }
    });

    downloadRiskData(uniqueData);
  };

  // Report Generation Logic
  const reportContent = useMemo(() => {
    // Determine the target dataset: Selection (if active) OR Filtered View (default)
    const targetData = selectedIds.size > 0 
        ? filteredData.filter(row => selectedIds.has(row.id))
        : filteredData;

    if (targetData.length === 0) return "";

    const totalCount = data.length;
    const violationCount = targetData.length; // Use target data count
    const violationPercent = totalCount > 0 ? ((violationCount / totalCount) * 100).toFixed(2) : "0.00";
    
    // Deduplicate violations based on content
    const uniqueViolations = new Set(targetData.map(r => r.content));
    const uniqueViolationCount = uniqueViolations.size;

    // Group by Risk Type
    const grouped = targetData.reduce((acc, row) => {
      if (!acc[row.riskType]) {
        acc[row.riskType] = new Set<string>();
      }
      acc[row.riskType].add(row.content);
      return acc;
    }, {} as Record<string, Set<string>>);

    let caseText = "";
    let index = 1;
    for (const [type, contentSetRaw] of Object.entries(grouped)) {
      // Explicit cast to fix type inference issue
      const contentSet = contentSetRaw as Set<string>;
      
      // Get up to 5 examples
      const examples = Array.from(contentSet).slice(0, 5).join('、');
      const suffix = contentSet.size > 5 ? '...' : '';
      caseText += `${index}.${type}：${examples}${suffix}\n`;
      index++;
    }

    const modeText = selectedIds.size > 0 ? "(Selected Items Only)" : "";

    return `样本数量：${totalCount}个
违规样本：${violationCount}个（${violationPercent}%）${modeText}
（去重后${uniqueViolationCount}个）
违规case
${caseText}`;
  }, [data, filteredData, selectedIds]);

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Risk Score Analyzer</h2>
        </div>
        <p className="text-slate-500">
          Upload verified CSV files to filter results. Optionally upload Original Source CSV to match NIDs.
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Upload Area */}
        {data.length === 0 && (
          <div>
             <FileUploader onFileSelect={handleFilesSelect} isLoading={loading} />
             {error && <p className="mt-3 text-red-600 bg-red-50 p-3 rounded-lg text-sm">{error}</p>}
          </div>
        )}

        {/* Analysis UI */}
        {data.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Control Panel */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6 space-y-6">
              
              {/* Row 1: Source File & Slider */}
              <div className="flex flex-col xl:flex-row gap-8">
                  
                  {/* Source File Upload (Compact) */}
                  <div className="flex-none xl:w-1/3 border-b xl:border-b-0 xl:border-r border-slate-200 pb-6 xl:pb-0 xl:pr-8">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            Original Source File
                        </label>
                        {hasSourceData && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded font-medium border border-green-200">NIDs Linked</span>}
                      </div>
                      
                      {!hasSourceData ? (
                          <div className="relative group cursor-pointer">
                              <div className="absolute inset-0 bg-blue-50 border border-blue-200 border-dashed rounded-lg opacity-50 group-hover:opacity-100 transition-opacity"></div>
                              <div className="relative flex items-center justify-center gap-2 py-3">
                                  <Upload className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm text-slate-600 font-medium">{sourceLoading ? "Mapping..." : "Upload Original CSV"}</span>
                              </div>
                              <input 
                                type="file" 
                                onChange={(e) => e.target.files && handleSourceFileSelect(Array.from(e.target.files))}
                                accept=".csv"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={sourceLoading}
                              />
                          </div>
                      ) : (
                          <div className="text-sm text-slate-500 bg-white p-3 border border-slate-200 rounded-lg">
                              Original file loaded. NIDs are now visible in the table.
                          </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2">Upload the raw source file containing 'NID' to match against content.</p>
                  </div>

                  {/* Slider & Stats */}
                  <div className="flex-1 space-y-4">
                     <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Risk Score Threshold
                        </label>
                        <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                           ≥ {threshold}
                        </span>
                     </div>
                     <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="0"
                          max={Math.min(maxScore * 1.2, 1)}
                          step="0.00001"
                          value={threshold}
                          onChange={(e) => setThreshold(parseFloat(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <input 
                          type="number" 
                          value={threshold}
                          onChange={(e) => setThreshold(Math.max(0, parseFloat(e.target.value) || 0))}
                          step="0.00001"
                          className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                     </div>
                  </div>
              </div>

              {/* Row 2: Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                   <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-center flex items-center justify-between px-6">
                      <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                          {selectedIds.size > 0 ? 'Selected' : 'Matches'}
                      </span>
                      <span className="text-2xl font-bold text-indigo-600">
                          {selectedIds.size > 0 ? selectedIds.size : filteredData.length}
                      </span>
                   </div>
                   
                   <div className="flex gap-2 flex-1">
                       <button 
                        onClick={handleExport}
                        disabled={filteredData.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         <Download className="w-4 h-4" />
                         <span className="text-sm font-semibold">Export CSV</span>
                       </button>

                       <button 
                        onClick={() => setShowReport(true)}
                        disabled={filteredData.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg shadow-md shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         <FileText className="w-4 h-4" />
                         <span className="text-sm font-semibold">Generate Report</span>
                       </button>
                   </div>
              </div>

            </div>

            {/* Results Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
               <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-700">Filtered Results</h3>
                    <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Total Rows: {data.length}</span>
                    {selectedIds.size > 0 && (
                        <button 
                            onClick={() => setSelectedIds(new Set())}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-2 underline"
                        >
                            Clear Selection ({selectedIds.size})
                        </button>
                    )}
                  </div>
                  <button onClick={() => setData([])} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 font-medium transition-colors">
                    <Layers className="w-3 h-3" />
                    Upload New Files
                  </button>
               </div>
               
               <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 bg-slate-50 w-12">
                         <div className="flex items-center justify-center">
                            <input 
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                         </div>
                      </th>
                      {hasSourceData && <th className="px-6 py-3 font-medium bg-slate-50 text-blue-600">NID</th>}
                      <th className="px-6 py-3 font-medium bg-slate-50">Score</th>
                      <th className="px-6 py-3 font-medium bg-slate-50">Risk Type</th>
                      <th className="px-6 py-3 font-medium bg-slate-50">Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={hasSourceData ? 5 : 4} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <p>No rows match the current threshold.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row) => {
                        const isSelected = selectedIds.has(row.id);
                        return (
                            <tr 
                                key={row.id} 
                                className={`transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-center">
                                    <input 
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectRow(row.id)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </div>
                              </td>
                              {hasSourceData && (
                                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-blue-600 font-bold">
                                      {row.nid || '-'}
                                  </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`
                                  inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                  ${row.riskScore > 0.5 ? 'bg-red-100 text-red-800 border-red-200' : 
                                    row.riskScore > 0.001 ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                                    'bg-green-100 text-green-800 border-green-200'}
                                `}>
                                  {row.riskScore.toFixed(7)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {row.riskType}
                              </td>
                              <td className="px-6 py-4 text-slate-700 min-w-[300px]">
                                {row.content}
                              </td>
                            </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Risk Summary Report</h3>
              <button 
                onClick={() => setShowReport(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-lg p-6 font-mono text-sm leading-relaxed text-slate-700 whitespace-pre-wrap shadow-sm">
                {reportContent}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setShowReport(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(reportContent);
                  alert("Report copied to clipboard!");
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Text
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};