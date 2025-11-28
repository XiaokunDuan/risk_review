import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { PreviewTable } from './components/PreviewTable';
import { RiskAnalyzer } from './components/RiskAnalyzer'; 
import { processCSV, downloadTXT, downloadZip } from './utils/processor';
import { ProcessedFileResult, ProcessedRow } from './types';
import { FileText, Download, RefreshCcw, AlertTriangle, ArrowDown, Eye, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function App() {
  const [processedFiles, setProcessedFiles] = useState<ProcessedFileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  // Helper to generate IDs
  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleFilesSelect = async (files: File[]) => {
    setLoading(true);
    
    const newResults: ProcessedFileResult[] = [];

    // Process files sequentially or in parallel
    for (const file of files) {
      const id = generateId();
      try {
        const result = await processCSV(file);
        newResults.push({
          id,
          originalName: file.name,
          data: result.data,
          stats: result.stats
        });
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        newResults.push({
          id,
          originalName: file.name,
          data: [],
          stats: { totalRows: 0, validRows: 0, skippedRows: 0 },
          error: err.message || "Unknown processing error"
        });
      }
    }

    setProcessedFiles(prev => [...prev, ...newResults]);
    setLoading(false);
    
    // Auto-preview first successful file if no preview exists
    const firstSuccess = newResults.find(f => !f.error);
    if (firstSuccess && !previewFileId && processedFiles.length === 0) {
      setPreviewFileId(firstSuccess.id);
    }
  };

  const handleDownloadSingle = (file: ProcessedFileResult) => {
    if (file.data.length === 0) return;
    downloadTXT(file.data, file.originalName);
  };

  const handleDownloadAll = () => {
    const validFiles = processedFiles.filter(f => !f.error && f.data.length > 0);
    if (validFiles.length === 0) return;
    downloadZip(validFiles);
  };

  const removeFile = (id: string) => {
    setProcessedFiles(prev => prev.filter(f => f.id !== id));
    if (previewFileId === id) setPreviewFileId(null);
  };

  const reset = () => {
    setProcessedFiles([]);
    setPreviewFileId(null);
  };

  const previewData = processedFiles.find(f => f.id === previewFileId)?.data || [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Module 1: Batch Processor */}
        <section>
          {/* Header */}
          <header className="mb-10 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Batch CSV/TXT to Strategy TXT
            </h1>
            <p className="text-slate-500 max-w-lg mx-auto">
              Upload multiple GBK-encoded CSV or TXT files. We'll format them and you can download the results individually or as a ZIP.
            </p>
          </header>

          <main className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-2">
               <FileUploader onFileSelect={handleFilesSelect} isLoading={loading} />
            </div>

            {/* File List & Results */}
            {processedFiles.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                
                {/* Global Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                   <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">{processedFiles.length}</span>
                      <span className="text-slate-500 text-sm">Files processed</span>
                   </div>
                   <div className="flex gap-2">
                      <button 
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                      >
                        <RefreshCcw className="w-4 h-4" /> Clear All
                      </button>
                      <button 
                        onClick={handleDownloadAll}
                        disabled={!processedFiles.some(f => !f.error)}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" /> Download All (ZIP)
                      </button>
                   </div>
                </div>

                {/* File List */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium">Filename</th>
                                    <th className="px-6 py-3 font-medium">Rows (Valid/Total)</th>
                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {processedFiles.map(file => (
                                    <tr key={file.id} className={`transition-colors ${previewFileId === file.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {file.error ? (
                                                <div className="flex items-center text-red-600 gap-2">
                                                    <XCircle className="w-5 h-5" />
                                                    <span className="text-xs font-bold">Error</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center text-green-600 gap-2">
                                                    <CheckCircle className="w-5 h-5" />
                                                    <span className="text-xs font-bold">Ready</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            {file.originalName}
                                            {file.error && <div className="text-xs text-red-500 mt-1">{file.error}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                            {!file.error && (
                                                <span>
                                                    <span className="text-green-600 font-bold">{file.stats.validRows}</span> 
                                                    <span className="text-slate-400"> / </span>
                                                    {file.stats.totalRows}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                {!file.error && (
                                                    <>
                                                    <button 
                                                        onClick={() => setPreviewFileId(file.id)}
                                                        className={`p-2 rounded-lg transition-colors ${previewFileId === file.id ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                                        title="Preview"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDownloadSingle(file)}
                                                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    </>
                                                )}
                                                <button 
                                                    onClick={() => removeFile(file.id)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Preview Table */}
                {previewFileId && (
                   <div className="animate-in fade-in slide-in-from-bottom-2">
                       <div className="flex items-center gap-2 mb-2 px-2">
                          <Eye className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-600">
                              Previewing: {processedFiles.find(f => f.id === previewFileId)?.originalName}
                          </span>
                       </div>
                       <PreviewTable data={previewData} />
                   </div>
                )}

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