import React from 'react';
import { ProcessedRow } from '../types';

interface PreviewTableProps {
  data: ProcessedRow[];
}

export const PreviewTable: React.FC<PreviewTableProps> = ({ data }) => {
  const previewRows = data.slice(0, 10); // Show top 10

  return (
    <div className="w-full mt-6 bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">Preview (First 10 rows)</h3>
        <span className="text-xs font-mono text-slate-500 bg-slate-200 px-2 py-1 rounded">
           Total: {data.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 w-48 font-medium">strategy</th>
              <th className="px-6 py-3 font-medium">content</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-slate-600 whitespace-nowrap">
                  {row.strategy}
                </td>
                <td className="px-6 py-4 text-slate-700 max-w-xl truncate">
                  {row.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-center text-slate-500">
          ... and {data.length - 10} more rows
        </div>
      )}
    </div>
  );
};