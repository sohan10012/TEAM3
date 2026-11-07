import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  ZoomIn,
  ZoomOut,
  X,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/utils/format";

// Point PDF.js worker to local public asset for 100% offline reliability
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface EmbeddedDocumentViewerProps {
  documentId: number;
  filename: string;
  fileType: string;
  initialPage?: number | null;
  highlightExcerpt?: string | null;
  onPageChange?: (page: number) => void;
  extractedTextFallback?: string;
  tablesFallback?: any[];
}

export function EmbeddedDocumentViewer({
  documentId,
  filename,
  fileType,
  initialPage = 1,
  highlightExcerpt = null,
  onPageChange,
  extractedTextFallback = "",
  tablesFallback = [],
}: EmbeddedDocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [scale, setScale] = useState<number>(1.25);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [matchingPages, setMatchingPages] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const isPdf = fileType.toLowerCase() === "pdf" || filename.toLowerCase().endsWith(".pdf");

  // Load PDF Document
  useEffect(() => {
    if (!isPdf) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const docUrl = `/api/v1/documents/${documentId}/download`;

    const loadingTask = pdfjsLib.getDocument({
      url: docUrl,
      withCredentials: true,
      cMapUrl: "https://unpkg.com/pdfjs-dist@4.10.38/cmaps/",
      cMapPacked: true,
    });

    loadingTask.promise
      .then((pdfDoc) => {
        if (!isMounted) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        const validInitial = initialPage && initialPage <= pdfDoc.numPages ? initialPage : 1;
        setCurrentPage(validInitial);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Failed to load PDF with PDF.js:", err);
        setError("Unable to render PDF binary directly. Switching to text representation.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
      loadingTask.destroy();
    };
  }, [documentId, isPdf, initialPage]);

  // Handle external initialPage change
  useEffect(() => {
    if (initialPage && initialPage > 0 && (!numPages || initialPage <= numPages)) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, numPages]);

  // Render Current Page
  const renderPage = useCallback(
    async (pageNum: number) => {
      const pdf = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;

        if (onPageChange) {
          onPageChange(pageNum);
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF page render error:", err);
        }
      }
    },
    [scale, onPageChange]
  );

  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [currentPage, renderPage]);

  // Search through PDF pages
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    const pdf = pdfDocRef.current;
    if (!pdf || !term.trim()) {
      setMatchingPages([]);
      setCurrentMatchIdx(-1);
      return;
    }

    setIsSearching(true);
    const matches: number[] = [];
    const query = term.toLowerCase();

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStr = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .toLowerCase();

        if (pageStr.includes(query)) {
          matches.push(i);
        }
      } catch (err) {
        console.warn(`Search error on page ${i}:`, err);
      }
    }

    setMatchingPages(matches);
    setIsSearching(false);

    if (matches.length > 0) {
      setCurrentMatchIdx(0);
      setCurrentPage(matches[0]);
    } else {
      setCurrentMatchIdx(-1);
    }
  };

  const nextMatch = () => {
    if (matchingPages.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % matchingPages.length;
    setCurrentMatchIdx(nextIdx);
    setCurrentPage(matchingPages[nextIdx]);
  };

  const prevMatch = () => {
    if (matchingPages.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + matchingPages.length) % matchingPages.length;
    setCurrentMatchIdx(prevIdx);
    setCurrentPage(matchingPages[prevIdx]);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `/api/v1/documents/${documentId}/download`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFitToWidth = async () => {
    const pdf = pdfDocRef.current;
    const container = containerRef.current;
    if (!pdf || !container) {
      setScale(1.25);
      return;
    }
    try {
      const page = await pdf.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const availableWidth = container.clientWidth - 48;
      if (availableWidth > 200 && unscaledViewport.width > 0) {
        const newScale = Math.max(0.6, Math.min(2.5, availableWidth / unscaledViewport.width));
        setScale(Number(newScale.toFixed(2)));
      } else {
        setScale(1.25);
      }
    } catch {
      setScale(1.25);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Non-PDF fallback viewer
  if (!isPdf || error) {
    return (
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {fileType === "xlsx" || fileType === "csv" ? (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            ) : (
              <FileText className="h-4 w-4 text-blue-600" />
            )}
            <span className="text-xs font-semibold text-slate-800">{filename}</span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 uppercase">
              {fileType}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Original</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabular data presentation for spreadsheets */}
        {tablesFallback.length > 0 && (
          <div className="p-4 border-b border-slate-200 bg-slate-50/30">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Structured Tables ({tablesFallback.length})</h4>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {tablesFallback.map((table: any, tIdx: number) => (
                <div key={tIdx} className="rounded border border-slate-200 bg-white p-3 text-xs">
                  <div className="font-semibold text-slate-800 mb-1.5">{table.title || `Table ${tIdx + 1}`}</div>
                  {table.rows && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-2xs">
                        {table.headers && (
                          <thead className="bg-slate-100">
                            <tr>
                              {table.headers.map((h: string, hIdx: number) => (
                                <th key={hIdx} className="px-2 py-1 font-medium text-slate-700">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {table.rows.slice(0, 10).map((row: any[], rIdx: number) => (
                            <tr key={rIdx}>
                              {row.map((cell: any, cIdx: number) => (
                                <td key={cIdx} className="px-2 py-1 text-slate-600">
                                  {String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Text presentation */}
        <div className="p-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
            {extractedTextFallback || "No text content available for this document."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs transition-all",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0"
      )}
    >
      {/* PDF Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-50/90 px-3.5 py-2">
        {/* Left: Document info & Page Navigation */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#3067DB] shrink-0" />
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px] md:max-w-[280px]" title={filename}>
            {filename}
          </span>

          <div className="h-4 w-[1px] bg-slate-300 mx-1 hidden sm:block" />

          {/* Page Stepper */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-mono text-xs text-slate-700 min-w-16 text-center">
              Page {currentPage} of {numPages || "–"}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages || loading}
              className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Center: Search inside Document */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs min-w-[200px]">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search in document…"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-16 rounded border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#3067DB] focus:border-[#3067DB]"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {matchingPages.length > 0 && (
            <div className="flex items-center gap-1 shrink-0 text-2xs font-mono text-slate-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
              <span>
                {currentMatchIdx + 1}/{matchingPages.length}
              </span>
              <button
                onClick={prevMatch}
                className="p-0.5 hover:bg-blue-100 rounded text-slate-700"
                title="Previous match"
              >
                ▲
              </button>
              <button
                onClick={nextMatch}
                className="p-0.5 hover:bg-blue-100 rounded text-slate-700"
                title="Next match"
              >
                ▼
              </button>
            </div>
          )}

          {isSearching && <RotateCw className="h-3 w-3 animate-spin text-[#3067DB]" />}
        </div>

        {/* Right: Zoom, Fullscreen & Download */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
              className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-600 px-1.5 min-w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
              className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleFitToWidth}
              className="rounded px-1.5 py-0.5 text-2xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Fit to Container Width"
            >
              Fit
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Document View"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded bg-[#3067DB] hover:bg-[#2554B8] text-white px-2.5 py-1 text-xs font-medium shadow-xs transition-colors"
            title="Download original file"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Target Excerpt Callout Banner if navigating from a Requirement */}
      {highlightExcerpt && (
        <div className="flex items-start gap-2.5 bg-blue-50/80 border-b border-blue-200 px-4 py-2 text-xs text-blue-950">
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase shrink-0 mt-0.5">
            Target Source Passage
          </span>
          <p className="flex-1 font-mono text-[11px] leading-relaxed text-blue-900 line-clamp-2">
            "{highlightExcerpt}"
          </p>
          <button
            onClick={() => handleSearch(highlightExcerpt.slice(0, 30))}
            className="underline font-medium hover:text-blue-700 text-2xs shrink-0"
          >
            Find on page
          </button>
        </div>
      )}

      {/* Canvas Viewport Area */}
      <div className="relative flex-1 min-h-[500px] max-h-[75vh] overflow-auto bg-slate-700/80 p-4 flex justify-center items-start">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xs gap-3">
            <RotateCw className="h-6 w-6 animate-spin text-[#3067DB]" />
            <span className="text-xs font-medium text-slate-600">Rendering document with PDF.js…</span>
          </div>
        )}

        <div className="relative shadow-2xl rounded bg-white">
          <canvas ref={canvasRef} className="block rounded" />
        </div>
      </div>

      {/* Footer Page Bar */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-2xs text-slate-500">
        <span className="font-mono">
          Page {currentPage} of {numPages} · Scale {Math.round(scale * 100)}%
        </span>
        <div className="flex items-center gap-3">
          <span>Use Zoom & Search tools to inspect original clauses and tables</span>
        </div>
      </div>
    </div>
  );
}
