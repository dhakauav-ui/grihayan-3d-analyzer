import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, X, Loader2, Sparkles } from 'lucide-react';
import { surveyApi } from '../../services/api';
import { RawPreviewResponse } from '../../types/survey';
import { formatBytes } from '../../utils/formatters';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (data: RawPreviewResponse) => void;
  onLoadDemo?: (projectName?: string) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onLoadDemo,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setErrorMessage(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowed = ['.csv', '.xlsx', '.xls', '.txt'];
    if (!allowed.includes(ext)) {
      setErrorMessage(`Unsupported file format '${ext}'. Please upload CSV, XLSX, or TXT.`);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const data = await surveyApi.uploadFile(selectedFile);
      onUploadSuccess(data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload and analyze survey file.';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Upload Survey Data</h3>
              <p className="text-xs text-slate-400">Upload Land Survey RL/XYZ measurements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition ${
              isDragging
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <FileSpreadsheet className="w-12 h-12 text-slate-500 mb-3" />
            <p className="text-sm font-semibold text-slate-200 mb-1">
              Drag & Drop survey file here, or <span className="text-blue-400">Browse</span>
            </p>
            <p className="text-xs text-slate-500">
              Supports CSV, XLSX, XLS, TXT (up to 150MB)
            </p>
          </div>

          {/* Selected File Card */}
          {selectedFile && (
            <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-3 truncate">
                <FileSpreadsheet className="w-6 h-6 text-blue-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-200 truncate">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{formatBytes(selectedFile.size)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-slate-400 hover:text-red-400 p-1"
              >
                Change
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <div>
            {onLoadDemo && (
              <button
                type="button"
                onClick={() => onLoadDemo('Khagrachari_1000Acre_Survey')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-500 hover:to-blue-500 text-white shadow-md flex items-center space-x-1.5 transition transform hover:scale-105"
                title="Load pre-calculated 1000+ points 3D terrain survey dataset"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Load Sample 3D Project</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              disabled={!selectedFile || isUploading}
              onClick={handleUpload}
              className={`px-5 py-2 rounded-md text-xs font-semibold flex items-center space-x-2 text-white transition ${
                !selectedFile || isUploading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20'
              }`}
            >
              {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isUploading ? 'Analyzing File...' : 'Upload & Analyze'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
