"use client";

import { useState } from "react";
import { FolderOpen, FileSpreadsheet, Plus } from "lucide-react";
import {
  isFileSystemAccessSupported,
  requestFileAccess,
  createNewFile,
  hasFileAccess,
  getFileName,
} from "@/lib/excel-storage";

type FilePickerProps = {
  onFileSelected: () => void;
};

export function FilePicker({ onFileSelected }: FilePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenFile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const handle = await requestFileAccess();
      if (handle) {
        onFileSelected();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const handle = await createNewFile();
      if (handle) {
        onFileSelected();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create file");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if File System Access API is supported
  if (!isFileSystemAccessSupported()) {
    return (
      <div className="min-h-screen bg-hero-grid flex items-center justify-center">
        <div className="glass-panel rounded-3xl p-8 max-w-md text-center">
          <div className="mb-4 text-amber-400">
            <FileSpreadsheet className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-xl font-semibold text-lime-100 mb-4">
            Browser Not Supported
          </p>
          <p className="text-lime-100/70 mb-6">
            Your browser doesn't support the File System Access API. Please use
            Chrome, Edge, or Opera for the best experience.
          </p>
          <p className="text-xs text-lime-100/50">
            Safari and Firefox have limited support. The app will still work but
            file access may be restricted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero-grid flex items-center justify-center">
      <div className="glass-panel rounded-3xl p-8 max-w-md text-center">
        <div className="mb-4">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-lime-400" />
        </div>
        <p className="text-xl font-semibold text-lime-100 mb-4">
          Welcome to G-Buddy
        </p>
        <p className="text-lime-100/70 mb-6">
          Select an existing Excel file or create a new one to start tracking
          your plants. Your data stays on your device.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleOpenFile}
            disabled={isLoading}
            className="w-full rounded-xl border border-lime-300/20 bg-lime-300/12 px-6 py-3 font-semibold text-lime-100 transition hover:bg-lime-300/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FolderOpen className="h-5 w-5" />
            {isLoading ? "Opening..." : "Open Existing File"}
          </button>

          <button
            onClick={handleCreateFile}
            disabled={isLoading}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-lime-100 transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            {isLoading ? "Creating..." : "Create New File"}
          </button>
        </div>

        <p className="mt-6 text-xs text-lime-100/50">
          Data is stored locally in your Excel file. No cloud storage required.
        </p>
      </div>
    </div>
  );
}