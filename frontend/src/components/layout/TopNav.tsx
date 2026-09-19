import React from 'react';
import { 
  Mountain, 
  Upload, 
  Download, 
  FileText, 
  Settings, 
  HelpCircle, 
  Maximize2, 
  Minimize2,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface TopNavProps {
  projectName: string;
  status: 'idle' | 'uploaded' | 'validating' | 'validated' | 'ready';
  onOpenUpload: () => void;
  onOpenReport?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  projectName,
  status,
  onOpenUpload,
  onOpenReport,
  onOpenExport,
  onOpenSettings,
  onOpenHelp,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'ready':
      case 'validated':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Validated / Ready</span>
          </span>
        );
      case 'validating':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processing...</span>
          </span>
        );
      case 'uploaded':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting Validation</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            No Data Loaded
          </span>
        );
    }
  };

  return (
    <header className="h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between select-none z-30 shadow-md">
      {/* Left: App Brand & Project Title */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl shadow-inner">
            <Mountain className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wider text-sm text-slate-100 uppercase">
              GRIHAYAN <span className="text-blue-400 font-bold">3D SURFACE ANALYZER</span>
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Project Name & Status */}
        <div className="flex items-center space-x-2.5">
          <span className="text-xs text-slate-400 font-medium">
            Project: <strong className="text-slate-200 font-semibold">{projectName}</strong>
          </span>
          {getStatusBadge()}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenUpload}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition shadow-md hover:shadow-blue-500/25"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Survey File</span>
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Export</span>
        </button>

        <button
          onClick={onOpenReport}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
        >
          <FileText className="w-3.5 h-3.5 text-purple-400" />
          <span>Report</span>
        </button>

        <div className="h-4 w-px bg-slate-800" />

        <button
          onClick={onOpenSettings}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenHelp}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
          title="Help & Documentation"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
