import Papa from 'papaparse';
import JSZip from 'jszip';
import { ProcessedRow, ProcessingStats, RiskAnalysisRow, ProcessedFileResult } from '../types';

// Helper to normalize content for matching (removes prefix, handles whitespace)
const normalizeContent = (text: string): string => {
  if (!text) return '';
  // 1. Remove specific prefix
  let clean = text.trim().replace(/^用户评价文本[:：]?\s*/, '');
  // 2. Normalize whitespace (tabs/newlines -> space)
  clean = clean.replace(/[\t\n\r]+/g, ' ').trim();
  return clean;
};

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
            
            // Set to track duplicates
            const seenContent = new Set<string>();

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
                const cleanContent = normalizeContent(contentValue);

                // 3. Deduplication Check
                if (cleanContent && !seenContent.has(cleanContent)) {
                    seenContent.add(cleanContent);
                    processedData.push({
                      strategy: 'service_safe_cate_v2', // Constant value as requested
                      content: cleanContent,
                    });
                    validCount++;
                } else {
                    // Duplicate or empty after cleaning
                    skippedCount++;
                }
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
            // Normalize content for potential matching later
            const rawContent = contentKey ? row[contentKey] : '';
            const normalizedContent = normalizeContent(rawContent);

            riskData.push({
              id: index,
              content: normalizedContent || rawContent, // Use normalized if possible, else raw
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

export const processSourceMapping = (file: File): Promise<Map<string, string>> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const buffer = event.target?.result as ArrayBuffer;
                // Try GBK first as per usual requirement, fallback to UTF-8 handled if key columns missing
                let decoder = new TextDecoder('gbk');
                let csvString = decoder.decode(buffer);
                
                let parseResult = Papa.parse(csvString, { header: true, skipEmptyLines: true });
                let fields = parseResult.meta.fields || [];
                
                // Check for NID column
                let nidKey = fields.find(f => f.trim().toUpperCase() === 'NID' || f.includes('业务方id'));
                
                if (!nidKey) {
                    // Try UTF-8 Fallback
                    decoder = new TextDecoder('utf-8');
                    csvString = decoder.decode(buffer);
                    parseResult = Papa.parse(csvString, { header: true, skipEmptyLines: true });
                    fields = parseResult.meta.fields || [];
                    nidKey = fields.find(f => f.trim().toUpperCase() === 'NID' || f.includes('业务方id'));
                }

                if (!nidKey) {
                    reject(new Error("Could not find 'NID' column in source file."));
                    return;
                }

                // Find content column
                const contentKey = fields.find(f => ['content', '内容'].some(k => f.trim() === k)) || fields.find(f => f.includes('内容'));
                 if (!contentKey) {
                    reject(new Error("Could not find 'Content' column in source file."));
                    return;
                }

                const mapping = new Map<string, string>();
                const rows = parseResult.data as Record<string, string>[];

                rows.forEach(row => {
                    const nid = row[nidKey!];
                    const content = row[contentKey!];
                    if (nid && content) {
                        // Normalize content to match the processed format (remove prefix, etc)
                        const cleanContent = normalizeContent(content);
                        if (cleanContent) {
                            mapping.set(cleanContent, nid);
                        }
                    }
                });
                
                console.log(`Mapped ${mapping.size} NIDs from source file.`);
                resolve(mapping);

            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read source file"));
        reader.readAsArrayBuffer(file);
    });
};

const formatFileContent = (data: ProcessedRow[]) => {
    const header = "strategy\tcontent";
    const rows = data.map(row => {
        return `${row.strategy}\t${row.content}`;
    }).join('\n');
    return `${header}\n${rows}`;
};

export const downloadTXT = (data: ProcessedRow[], filename: string) => {
  const fileContent = formatFileContent(data);
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  let safeName = filename.replace(/\.(csv|txt)$/i, '');
  link.setAttribute('download', `${safeName}_processed.txt`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadZip = async (files: ProcessedFileResult[]) => {
    const zip = new JSZip();
    
    files.forEach(file => {
        if (file.error || file.data.length === 0) return;
        const content = formatFileContent(file.data);
        const safeName = file.originalName.replace(/\.(csv|txt)$/i, '');
        zip.file(`${safeName}_processed.txt`, content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'batch_processed_files.zip');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const downloadRiskData = (data: RiskAnalysisRow[]) => {
    // Add BOM for Excel utf-8 compatibility
    const BOM = "\uFEFF";
    const header = "nid,risk_score,risk_type,content";
    const csvContent = data.map(row => {
        // Escape quotes in content
        const safeContent = row.content.replace(/"/g, '""');
        return `${row.nid || ''},${row.riskScore},${row.riskType},"${safeContent}"`;
    }).join('\n');

    const blob = new Blob([BOM + header + '\n' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'risk_analysis_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};