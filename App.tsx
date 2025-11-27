import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { PreviewTable } from './components/PreviewTable';
import { RiskAnalyzer } from './components/RiskAnalyzer'; // Import the new module
import { processCSV, downloadTXT } from './utils/processor';
import { ProcessedRow, ProcessingStats } from './types';
import { FileText, Download, RefreshCcw, AlertTriangle, ArrowDown } from 'lucide-react';

export default function App() {
  const [data, setData] = useState<ProcessedRow[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('output.txt');

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    setData([]);
    setStats(null);
    setOriginalFileName(file.name);

    try {
      const result = await processCSV(file);
      setData(result.data);
      setStats(result.stats);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unknown error occurred while processing the file.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (data.length === 0) return;
    downloadTXT(data, originalFileName);
  };

  const reset = () => {
    setData([]);
    setStats(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Module 1: Processor */}
        <section>
          {/* Header */}
          <header className="mb-10 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
              GBK CSV to Strategy TXT
            </h1>
            <p className="text-slate-500 max-w-lg mx-auto">
              Upload your raw GBK-encoded CSV. We'll extract the "内容" column, remove the "用户评价文本:" prefix, and format it with the "service_safe_cate_v2" strategy tag.
            </p>
          </header>

          <main className="space-y-6">
            {/* Upload Section (Hidden if data exists) */}
            {data.length === 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-2">
                 <FileUploader onFileSelect={handleFileSelect} isLoading={loading} />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Processing Error</h3>
                  <p className="text-sm opacity-90">{error}</p>
                  <button 
                    onClick={reset}
                    className="mt-2 text-xs font-semibold hover:underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Results Section */}
            {data.length > 0 && stats && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Rows</span>
                      <span className="font-mono font-bold text-slate-800">{stats.totalRows}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-300"></div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Valid</span>
                      <span className="font-mono font-bold text-green-600">{stats.validRows}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                     <button 
                      onClick={reset}
                      className="flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors flex"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Reset
                    </button>
                    <button 
                      onClick={handleDownload}
                      className="flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex"
                    >
                      <Download className="w-4 h-4" />
                      Download TXT
                    </button>
                  </div>
                </div>

                {/* Data Table */}
                <PreviewTable data={data} />
              </div>
            )}
          </main>
        </section>

        {/* Divider */}
        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink-0 mx-4 text-slate-300">
            <ArrowDown className="w-6 h-6" />
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Module 2: Risk Analyzer */}
        <RiskAnalyzer />

      </div>
    </div>
  );
}