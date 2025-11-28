export interface ProcessedRow {
  strategy: string;
  content: string;
}

export interface ProcessingStats {
  totalRows: number;
  validRows: number;
  skippedRows: number;
}

export interface ProcessedFileResult {
  id: string;
  originalName: string;
  data: ProcessedRow[];
  stats: ProcessingStats;
  error?: string;
}

export interface RiskAnalysisRow {
  id: number;
  content: string;
  riskScore: number;
  riskType: string;
  originalRow: Record<string, string>;
}