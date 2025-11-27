import React, { useRef, useState } from 'react';
import { Upload, FileType, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
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
      const file = e.dataTransfer.files[0];
      if (file.type === "text/csv" || file.name.endsWith('.csv')) {
        onFileSelect(file);
      } else {
        alert("Please upload a CSV file.");
      }
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
        onChange={(e) => e.target.files && onFileSelect(e.target.files[0])} 
        accept=".csv"
        className="hidden" 
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium text-slate-700">
            {isLoading ? 'Processing...' : 'Click or drag CSV file here'}
          </p>
          <p className="text-sm text-slate-500">
            Supports GBK/Chinese encoding automatically
          </p>
        </div>
      </div>
    </div>
  );
};