import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { X, Monitor, Tablet, Smartphone, Code2, Copy, Check, RotateCcw, FileArchive, Maximize2, Minimize2, ChevronLeft } from "lucide-react";
import JSZip from "jszip";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import type { ArtifactBlock } from "../../lib/artifact/extractor";
import { buildPreviewHtml } from "../../lib/artifact/preview";
import { FileTree } from "./FileTree";

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

interface ArtifactPreviewProps {
  artifact: ArtifactBlock;
  onClose: () => void;
}

export function ArtifactPreview({ artifact, onClose }: ArtifactPreviewProps) {
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [showCode, setShowCode] = useState(false);
  const [fullCode, setFullCode] = useState(false);
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("index.html");
  const [navHistory, setNavHistory] = useState<string[]>(["index.html"]);
  const [navIndex, setNavIndex] = useState(0);
  const isDragging = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const files = artifact.files || [{ path: "index.html", content: artifact.code }];

  // Check if multi-page
  const htmlFilesCount = files.filter((f) => f.path.endsWith(".html")).length;
  const hasMultiplePages = htmlFilesCount > 1;

  // Build preview HTML using inline injection (terbukti 100% jalan)
  const previewHtml = useMemo(() => {
    setPreviewErrors([]); // Reset errors on rebuild
    return buildPreviewHtml(files);
  }, [files]);

  // Build the full HTML for iframe srcdoc attribute
    const srcDocHtml = useMemo(() => {
      return previewHtml;
    }, [previewHtml]);

  // Refresh iframe
  const handleRefresh = useCallback(() => {
      const iframe = iframeRef.current;
      if (iframe) {
        iframe.srcdoc = "";
              requestAnimationFrame(() => {
                iframe.srcdoc = srcDocHtml;
        });
        setPreviewErrors([]);
      }
    }, [srcDocHtml]);

  const handleBack = useCallback(() => {
      if (navIndex > 0) {
      const newIndex = navIndex - 1;
      const path = navHistory[newIndex];
      setNavIndex(newIndex);
      setCurrentPath(path);
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "lyra-navigate", path },
          "*"
        );
      }
    }
  }, [navIndex, navHistory]);

  // Listen for error messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "lyra-error") {
        setPreviewErrors((prev) => {
          const updated = [
            `${e.data.count}. ${e.data.message}`,
            ...prev,
          ];
          return updated.slice(0, 5);
        });
      }
      if (e.data?.type === "lyra-navigate" && e.data?.path) {
        setCurrentPath(e.data.path);
        setNavHistory((prev) => [...prev.slice(0, navIndex + 1), e.data.path]);
        setNavIndex((prev) => prev + 1);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navIndex]);

  // Copy handler
  const handleCopy = useCallback(async () => {
    const fileContent = files[activeFile]?.content || artifact.code;
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [files, activeFile, artifact.code]);

  // Download ZIP handler
  const handleDownloadZip = useCallback(async () => {
    const zip = new JSZip();
    const folderName = (artifact.title || "website")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    const folder = zip.folder(folderName);
    for (const file of files) {
      folder?.file(file.path, file.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [files, artifact.title]);

  // Highlight.js code highlighting
  const highlightedCode = useMemo(() => {
    const code = files[activeFile]?.content || artifact.code || "";
    if (!code.trim()) return "";
    try {
      const langMap: Record<string, string> = {
        html: "html", htm: "html",
        css: "css", scss: "css", less: "css",
        js: "javascript", mjs: "javascript",
        ts: "typescript", tsx: "typescript",
        jsx: "javascript",
        json: "json",
        svg: "xml", xml: "xml",
        md: "markdown",
        txt: "plaintext",
      };
      const ext = files[activeFile]?.path?.split(".").pop()?.toLowerCase() || "";
      const lang = langMap[ext] || "";
      if (lang) {
        const result = hljs.highlight(code, { language: lang });
        if (result && result.value) return result.value;
      }
      const autoResult = hljs.highlightAuto(code);
      return autoResult.value;
    } catch {
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [files, activeFile, artifact.code]);

  useEffect(() => {
    document.querySelectorAll(".hljs code").forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  }, [activeFile]);

  const currentFileName =
    files[activeFile]?.path?.split("/").pop() || "index.html";
  const isCurrentlySelected = (idx: number) => activeFile === idx;

  return (
    <div className="flex flex-col h-full bg-bg border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-1">
          {showCode && (
            <button
              onClick={() => setFullCode(!fullCode)}
              title={fullCode ? "Show preview" : "Full code mode"}
              className={`p-1.5 rounded-lg transition-colors ${
                fullCode
                  ? "bg-primary/10 text-primary"
                  : "text-text-dim hover:text-text hover:bg-bg-alt"
              }`}
            >
              {fullCode ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          )}
          {!fullCode && (
            <>
              <DeviceButton
                icon={Monitor}
                mode="desktop"
                active={device}
                onClick={setDevice}
                label="Desktop"
              />
              <DeviceButton
                icon={Tablet}
                mode="tablet"
                active={device}
                onClick={setDevice}
                label="Tablet"
              />
              <DeviceButton
                icon={Smartphone}
                mode="mobile"
                active={device}
                onClick={setDevice}
                label="Mobile"
              />
            </>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => setShowCode(!showCode)}
            title={showCode ? "Preview" : "Source code"}
            className={`p-1.5 rounded-lg transition-colors ${
              showCode
                ? "bg-primary text-white"
                : "text-text-dim hover:text-text hover:bg-bg-alt"
            }`}
          >
            <Code2 size={14} />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <span className="text-[11px] text-text-dim mr-2 hidden sm:block truncate max-w-[140px]">
            {showCode ? currentFileName : artifact.title || "Preview"}
          </span>
          {/* Error badge */}
          {previewErrors.length > 0 && (
            <div className="relative group">
              <button
                title="Ada error JavaScript di preview"
                className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
              >
                <span>&#x26A0;&#xFE0F;</span>
                <span>{previewErrors.length}</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-64 bg-[#1e1e2e] border border-[#313244] rounded-xl shadow-xl p-2 hidden group-hover:block z-50">
                <div className="text-[10px] text-red-400 font-medium mb-1 px-1">
                  Preview JavaScript Errors:
                </div>
                {previewErrors.map((err, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-red-300/80 px-1 py-0.5 border-b border-[#313244] last:border-0 truncate"
                  >
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={handleDownloadZip}
            title="Download ZIP"
            className="p-1.5 rounded-lg text-text-dim hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <FileArchive size={13} />
          </button>
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors"
          >
            {copied ? (
              <Check size={13} className="text-green-500" />
            ) : (
              <Copy size={13} />
            )}
          </button>
          <button
            onClick={onClose}
            title="Tutup preview"
            className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors ml-1"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Custom Address Bar for multi-page navigation */}
      {hasMultiplePages && !showCode && !fullCode && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-bg-alt flex-shrink-0">
          <button
            onClick={handleBack}
            disabled={navIndex === 0}
            title="Kembali"
            className={`p-1 rounded transition-colors ${
              navIndex > 0
                ? "text-text-dim hover:text-text hover:bg-bg"
                : "text-text-dim/30 cursor-not-allowed"
            }`}
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex-1 flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-border text-[11px] text-text-dim overflow-hidden">
            <span className="text-text-dim/50">/</span>
            <span className="truncate">{currentPath}</span>
          </div>
        </div>
      )}

      {/* Content: Split View (Code + Preview) or Full Preview */}
      {showCode && fullCode ? (
        /* Full Code Mode */
        <div className="flex-1 flex overflow-hidden">
          <FileTree
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
          />
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
            <div className="flex items-center gap-0 px-1 pt-0 overflow-x-auto flex-shrink-0 bg-[#1e1e2e] border-b border-[#313244]">
              {files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveFile(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                    isCurrentlySelected(idx)
                      ? "text-[#cdd6f4] border-[#cba6f7] bg-[#313244]/50"
                      : "text-[#6c7086] border-transparent hover:text-[#a6adc8] hover:bg-[#313244]/30"
                  }`}
                >
                  <FileIcon path={file.path} />
                  <span>{file.path.split("/").pop()}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre
                className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words hljs"
                style={{ background: "transparent" }}
              >
                <code
                  className="hljs"
                  dangerouslySetInnerHTML={{
                    __html: highlightedCode || "&nbsp;",
                  }}
                />
              </pre>
            </div>
          </div>
        </div>
      ) : showCode ? (
        /* Split Mode: Code on left + Preview on right */
        <div className="flex-1 flex overflow-hidden">
          {/* Code side */}
          <div
            className="flex overflow-hidden"
            style={{ width: `${splitRatio}%` }}
          >
            <FileTree
              files={files}
              activeFile={activeFile}
              onFileSelect={setActiveFile}
            />
            <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
              <div className="flex items-center gap-0 px-1 pt-0 overflow-x-auto flex-shrink-0 bg-[#1e1e2e] border-b border-[#313244]">
                {files.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFile(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                      isCurrentlySelected(idx)
                        ? "text-[#cdd6f4] border-[#cba6f7] bg-[#313244]/50"
                        : "text-[#6c7086] border-transparent hover:text-[#a6adc8] hover:bg-[#313244]/30"
                    }`}
                  >
                    <FileIcon path={file.path} />
                    <span>{file.path.split("/").pop()}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre
                  className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words hljs"
                  style={{ background: "transparent" }}
                >
                  <code
                    className="hljs"
                    dangerouslySetInnerHTML={{
                      __html: highlightedCode || "&nbsp;",
                    }}
                  />
                </pre>
              </div>
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="w-[4px] bg-[#313131] hover:bg-[#cba6f7] cursor-col-resize shrink-0 relative transition-colors group z-10"
            onMouseDown={(e) => {
              isDragging.current = true;
              const startX = e.clientX;
              const startRatio = splitRatio;
              const container = e.currentTarget.parentElement!;
              const containerWidth = container.offsetWidth;

              const handleMouseMove = (me: MouseEvent) => {
                if (!isDragging.current) return;
                const dx = me.clientX - startX;
                const newRatio = Math.min(
                  80,
                  Math.max(20, startRatio + (dx / containerWidth) * 100)
                );
                setSplitRatio(newRatio);
              };
              const handleMouseUp = () => {
                isDragging.current = false;
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
              };
              document.addEventListener("mousemove", handleMouseMove);
              document.addEventListener("mouseup", handleMouseUp);
            }}
          >
            <div className="absolute inset-y-0 left-[-2px] right-[-2px] group-hover:bg-[#cba6f7]/20 transition-colors" />
          </div>

          {/* Preview side */}
          <div className="flex-1 flex justify-center p-3 overflow-hidden bg-[#e8e5e0] min-w-0">
            <div
              className="bg-white shadow-medium overflow-hidden transition-all duration-300 ease-out w-full h-full"
              style={{ maxWidth: DEVICE_WIDTHS[device] }}
            >
              <iframe
                              ref={iframeRef}
                              srcDoc={srcDocHtml}
                              title={artifact.title || "Website Preview"}
                              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                              className="w-full h-full border-0"
                              style={{ minHeight: "100%" }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Preview only (full screen) */
                      <div className="flex-1 flex justify-center p-3 overflow-hidden bg-[#e8e5e0]">
                        <div
                          className="bg-white shadow-medium overflow-hidden transition-all duration-300 ease-out w-full h-full"
                          style={{ maxWidth: DEVICE_WIDTHS[device] }}
                        >
                          <iframe
                            ref={iframeRef}
                            srcDoc={srcDocHtml}
                            title={artifact.title || "Website Preview"}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            className="w-full h-full border-0"
                            style={{ minHeight: "100%" }}
                          />
          </div>
        </div>
      )}
    </div>
  );
}

function FileIcon({ path }: { path: string }) {
  const name = path.split("/").pop()?.toLowerCase() || "";
  const ext = name.split(".").pop();

  switch (ext) {
    case "html":
    case "htm":
      return <span className="text-[#e37933] text-[11px]">&#x1F4C4;</span>;
    case "css":
    case "scss":
      return <span className="text-[#519aba] text-[11px]">&#x1F3A8;</span>;
    case "js":
    case "jsx":
    case "mjs":
      return <span className="text-[#cbcb41] text-[11px]">&#x26A1;</span>;
    case "ts":
    case "tsx":
      return <span className="text-[#3178c6] text-[11px]">TS</span>;
    case "json":
      return <span className="text-[#cbcb41] text-[11px]">{"{ }"}</span>;
    default:
      return <span className="text-text-dim text-[11px]">&#x1F4C4;</span>;
  }
}

function DeviceButton({
  icon: Icon,
  mode,
  active,
  onClick,
  label,
}: {
  icon: typeof Monitor;
  mode: DeviceMode;
  active: DeviceMode;
  onClick: (m: DeviceMode) => void;
  label: string;
}) {
  const isActive = active === mode;
  return (
    <button
      onClick={() => onClick(mode)}
      title={label}
      className={`p-1.5 rounded-lg transition-colors ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-text-dim hover:text-text hover:bg-bg-alt"
      }`}
    >
      <Icon size={14} />
    </button>
  );
}