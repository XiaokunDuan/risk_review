export interface ProcessedRow {
  strategy: string;
  content: string;
}

export interface ProcessingStats {
  totalRows: number;
  validRows: number;
  skippedRows: number;
}

export interface RiskAnalysisRow {
  id: number;
  content: string;
  riskScore: number;
  riskType: string;
  originalRow: Record<string, string>;
}