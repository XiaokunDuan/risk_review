import React, { useRef, useState } from 'react';
import { Upload, FileType, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (files: File[]) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles: File[] = [];
      // Cast to File[] to handle potential 'unknown' inference
      const files = Array.from(e.dataTransfer.files) as File[];
      files.forEach(file => {
          if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.type === "text/csv" || file.type === "text/plain") {
              validFiles.push(file);
          }
      });
      
      if (validFiles.length > 0) {
        onFileSelect(validFiles);
      } else {
        alert("Please upload CSV or TXT files.");
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          onFileSelect(Array.from(e.target.files));
      }
  };

  return (
    <div
      onClick={() => !isLoading && fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        ${isDragging 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        }
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleInputChange}
        accept=".csv,.txt"
        className="hidden" 
        multiple
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium text-slate-700">
            {isLoading ? 'Processing...' : 'Click or drag files here'}
          </p>
          <p className="text-sm text-slate-500">
            Supports multiple CSV/TXT files (GBK auto-detect)
          </p>
        </div>
      </div>
    </div>
  );
};