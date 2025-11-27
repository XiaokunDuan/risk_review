import Papa from 'papaparse';
import { ProcessedRow, ProcessingStats, RiskAnalysisRow } from '../types';

export const processCSV = (file: File): Promise<{ data: ProcessedRow[]; stats: ProcessingStats }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        // Critical: Decode as GBK to handle Chinese characters correctly
        const decoder = new TextDecoder('gbk');
        const csvString = decoder.decode(buffer);

        Papa.parse(csvString, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as Record<string, string>[];
            const processedData: ProcessedRow[] = [];
            let validCount = 0;
            let skippedCount = 0;
            const fields = results.meta.fields || [];

            // Find the correct column name for content
            const contentKey = fields.find(f => {
                const clean = f.trim();
                return clean === '内容' || clean === 'content';
            });

            if (!contentKey) {
              reject(new Error("Could not find the column named '内容' or 'content' in the CSV file."));
              return;
            }

            rows.forEach((row) => {
              const contentValue = row[contentKey];
              
              if (contentValue) {
                // Remove specific prefix if present and trim
                let cleanContent = contentValue.trim().replace(/^用户评价文本[:：]?\s*/, '');

                processedData.push({
                  strategy: 'service_safe_cate_v2', // Constant value as requested
                  content: cleanContent,
                });
                validCount++;
              } else {
                skippedCount++;
              }
            });

            resolve({
              data: processedData,
              stats: {
                totalRows: rows.length,
                validRows: validCount,
                skippedRows: skippedCount
              }
            });
          },
          error: (error: Error) => {
            reject(error);
          }
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    // Read as ArrayBuffer to allow manual decoding
    reader.readAsArrayBuffer(file);
  });
};

export const processRiskCSV = (file: File): Promise<RiskAnalysisRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        
        // Strategy: Try GBK first (User request), if that fails to find columns, try UTF-8.
        let decoder = new TextDecoder('gbk');
        let csvString = decoder.decode(buffer);
        
        let parseResult = Papa.parse(csvString, { header: true, skipEmptyLines: true });
        let fields = parseResult.meta.fields || [];
        
        // Check if we found the score column with GBK
        // Look for "风险得分" or "Risk Score" or similar
        const isColumnFound = (f: string) => f.includes('风险得分') || f.includes('文心安全算子') || f.includes('Risk Score');
        let scoreKey = fields.find(isColumnFound);

        // If not found, try UTF-8
        if (!scoreKey) {
             console.warn("GBK decoding failed to find expected columns. Retrying with UTF-8.");
             decoder = new TextDecoder('utf-8');
             csvString = decoder.decode(buffer);
             parseResult = Papa.parse(csvString, { header: true, skipEmptyLines: true });
             fields = parseResult.meta.fields || [];
             scoreKey = fields.find(isColumnFound);
        }

        if (!scoreKey) {
          const available = fields.map(f => `'${f}'`).join(', ');
          reject(new Error(`Could not find column '文心安全算子V2-风险得分' (or similar). Found columns: ${available}`));
          return;
        }

        const rows = parseResult.data as Record<string, string>[];
        const riskData: RiskAnalysisRow[] = [];

        // Helper to find column with flexible matching
        const findColumn = (target: string) => {
            return fields.find(f => f.trim().includes(target));
        };
        
        // Try to find content column
        const contentKey = fields.find(f => ['content', '内容'].some(k => f.trim() === k)) || findColumn('内容') || findColumn('content');
        
        // Try specific full matches first, then partials for Risk Type
        let typeKey = fields.find(f => f.trim() === '文心安全算子V2-一级风险类型');
        if (!typeKey) typeKey = findColumn('一级风险类型');

        rows.forEach((row, index) => {
          const scoreRaw = row[scoreKey!]; 
          if (!scoreRaw) return;

          const score = parseFloat(scoreRaw);

          if (!isNaN(score)) {
            riskData.push({
              id: index,
              content: contentKey ? row[contentKey] : '',
              riskScore: score,
              riskType: typeKey ? row[typeKey] : 'N/A',
              originalRow: row
            });
          }
        });

        resolve(riskData);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

export const downloadTXT = (data: ProcessedRow[], filename: string) => {
  // Create tab-separated content
  // Header: strategy \t content
  const header = "strategy\tcontent";
  
  // Replace tabs and newlines in content to ensure 1 line per record and clean structure
  const rows = data.map(row => {
    const safeContent = row.content.replace(/[\t\n\r]+/g, ' '); 
    return `${row.strategy}\t${safeContent}`;
  }).join('\n');
  
  const fileContent = `${header}\n${rows}`;

  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.replace('.csv', '_processed.txt'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
