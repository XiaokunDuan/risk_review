import React, { useState, useMemo } from 'react';
import { FileUploader } from './FileUploader';
import { processRiskCSV } from '../utils/processor';
import { RiskAnalysisRow } from '../types';
import { Filter, BarChart3, Search, FileText, X, Copy, Layers } from 'lucide-react';

export const RiskAnalyzer: React.FC = () => {
  const [data, setData] = useState<RiskAnalysisRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  
  // Threshold state
  const [threshold, setThreshold] = useState<number>(0.0001);

  const handleFilesSelect = async (files: File[]) => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const promises = files.map(file => processRiskCSV(file));
      const results = await Promise.all(promises);
      
      let combinedData: RiskAnalysisRow[] = [];
      let globalIdCounter = 0;

      results.forEach((fileRows) => {
          // Re-index rows to ensure unique IDs across multiple files
          const reIndexed = fileRows.map(row => ({
              ...row,
              id: globalIdCounter++ 
          }));
          combinedData = [...combinedData, ...reIndexed];
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

  // Filter logic
  const filteredData = useMemo(() => {
    return data.filter(row => row.riskScore >= threshold).sort((a, b) => b.riskScore - a.riskScore);
  }, [data, threshold]);

  const maxScore = useMemo(() => {
    return data.length > 0 ? Math.max(...data.map(d => d.riskScore)) : 1;
  }, [data]);

  // Report Generation Logic
  const reportContent = useMemo(() => {
    if (filteredData.length === 0) return "";

    const totalCount = data.length;
    const violationCount = filteredData.length;
    const violationPercent = totalCount > 0 ? ((violationCount / totalCount) * 100).toFixed(2) : "0.00";
    
    // Deduplicate violations based on content
    const uniqueViolations = new Set(filteredData.map(r => r.content));
    const uniqueViolationCount = uniqueViolations.size;

    // Group by Risk Type
    const grouped = filteredData.reduce<Record<string, Set<string>>>((acc, row) => {
      if (!acc[row.riskType]) {
        acc[row.riskType] = new Set<string>();
      }
      acc[row.riskType].add(row.content);
      return acc;
    }, {});

    let caseText = "";
    let index = 1;
    for (const [type, contentSetRaw] of Object.entries(grouped)) {
      // Explicit cast to fix type inference issue where contentSetRaw might be unknown
      const contentSet = contentSetRaw as Set<string>;
      
      // Get up to 5 examples
      const examples = Array.from(contentSet).slice(0, 5).join('、');
      const suffix = contentSet.size > 5 ? '...' : '';
      caseText += `${index}.${type}：${examples}${suffix}\n`;
      index++;
    }

    return `样本数量：${totalCount}个
违规样本：${violationCount}个（${violationPercent}%）
（去重后${uniqueViolationCount}个）
违规case
${caseText}`;
  }, [data, filteredData]);

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
          Upload verified CSV files (single or multiple) to filter results based on '文心安全算子V2-风险得分'. Data will be merged.
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
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6">
              <div className="flex flex-col xl:flex-row gap-6 items-center justify-between">
                
                {/* Slider Control */}
                <div className="flex-1 w-full space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Risk Score Threshold
                    </label>
                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                       Showing scores ≥ {threshold}
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

                {/* Stats & Actions Widget */}
                <div className="flex gap-4 min-w-[320px] items-stretch">
                   <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-center flex flex-col justify-center">
                      <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Matches</div>
                      <div className="text-2xl font-bold text-indigo-600">{filteredData.length}</div>
                   </div>
                   
                   <button 
                    onClick={() => setShowReport(true)}
                    disabled={filteredData.length === 0}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg shadow-md shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <FileText className="w-5 h-5" />
                     <span className="text-xs font-bold uppercase tracking-wide">Generate Report</span>
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
                      <th className="px-6 py-3 font-medium bg-slate-50">Score</th>
                      <th className="px-6 py-3 font-medium bg-slate-50">Risk Type</th>
                      <th className="px-6 py-3 font-medium bg-slate-50">Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <p>No rows match the current threshold.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row) => (
                        <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
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
                      ))
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