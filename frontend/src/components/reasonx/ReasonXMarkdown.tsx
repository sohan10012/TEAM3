import { Check, Copy } from "lucide-react";
import React, { useState } from "react";

interface ReasonXMarkdownProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

/**
 * Enterprise Markdown Code Block with syntax header and copy button
 */
function MarkdownCodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3 py-1.5 text-2xs text-slate-400">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {lang || "Code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Format inline tokens: Bold, Italics, Code, Links, and QA Status Badges
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Regex splitting on:
  // 1. Markdown Links [label](url)
  // 2. Bold **text**
  // 3. Inline code `code`
  // 4. Italics *text* or _text_
  const tokens = text.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`|\*[^*]+?\*|_[^_]+?_)/g);

  return tokens.map((part, index) => {
    // 1. Markdown Link
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 underline hover:text-blue-800 transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // 2. Bold Text with Status Badge Detection
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      const upper = inner.trim().toUpperCase();

      if (upper === "PASS" || upper === "PASSED" || upper === "VERIFIED") {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
          >
            {inner}
          </span>
        );
      }
      if (upper === "FAIL" || upper === "FAILED" || upper === "CRITICAL") {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
          >
            {inner}
          </span>
        );
      }
      if (upper === "HIGH" || upper === "WARNING" || upper === "BLOCKED") {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
          >
            {inner}
          </span>
        );
      }

      return (
        <strong key={index} className="font-semibold text-slate-900">
          {inner}
        </strong>
      );
    }

    // 3. Inline Code
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800 border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // 4. Italics
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 2)
    ) {
      return (
        <em key={index} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

/**
 * Enterprise Markdown Renderer for ReasonX
 * Robust against streaming partial text, unclosed tags, and rich formatting.
 */
export function ReasonXMarkdown({
  content,
  className,
  isStreaming = false,
}: ReasonXMarkdownProps) {
  if (!content) {
    if (isStreaming) {
      return (
        <span className="inline-block w-1.5 h-3.5 bg-blue-600 align-middle animate-pulse rounded-xs" />
      );
    }
    return null;
  }

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";
  let tableLines: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const headerRow = tableLines[0];
    const dataRows = tableLines.slice(2); // Skip separator row

    const parseCells = (row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    const headers = parseCells(headerRow);

    renderedElements.push(
      <div
        key={`table-${renderedElements.length}`}
        className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs"
      >
        <table className="min-w-full divide-y divide-slate-200 text-left text-2xs">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3.5 py-2 font-semibold text-slate-800 uppercase tracking-wider text-[10px]"
                >
                  {renderInlineFormatting(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {dataRows.map((row, ri) => {
              const cells = parseCells(row);
              return (
                <tr
                  key={ri}
                  className="transition-colors hover:bg-slate-50/80 odd:bg-white even:bg-slate-50/30"
                >
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2 text-slate-700 leading-normal">
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
    inTable = false;
  };

  const flushCodeBlock = () => {
    if (codeBlockLines.length === 0) return;
    renderedElements.push(
      <MarkdownCodeBlock
        key={`code-${renderedElements.length}`}
        code={codeBlockLines.join("\n")}
        lang={codeBlockLang}
      />
    );
    codeBlockLines = [];
    inCodeBlock = false;
    codeBlockLang = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code Block Toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        if (inTable) flushTable();
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Markdown Table Detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      inTable = true;
      tableLines.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Horizontal Divider
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
      renderedElements.push(
        <hr key={i} className="my-3 border-t border-slate-200" />
      );
      continue;
    }

    // Blockquote / Callout
    if (line.trim().startsWith(">")) {
      const quoteText = line.replace(/^\s*>\s?/, "");
      renderedElements.push(
        <div
          key={i}
          className="my-2 border-l-3 border-blue-500 bg-blue-50/50 py-2 px-3 rounded-r-lg text-xs text-slate-800 leading-relaxed italic"
        >
          {renderInlineFormatting(quoteText)}
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      renderedElements.push(
        <h4
          key={i}
          className="mt-3.5 mb-1.5 text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          <span>{renderInlineFormatting(line.slice(4))}</span>
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      renderedElements.push(
        <h3
          key={i}
          className="mt-4 mb-2 text-sm font-bold text-slate-900 tracking-tight pb-1 border-b border-slate-100"
        >
          {renderInlineFormatting(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      renderedElements.push(
        <h2
          key={i}
          className="mt-4 mb-2 text-base font-extrabold text-slate-900 tracking-tight pb-1.5 border-b border-slate-200"
        >
          {renderInlineFormatting(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Unordered List Items with Key-Value Pair formatting
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, "");
      renderedElements.push(
        <li
          key={i}
          className="ml-4 list-disc text-xs leading-relaxed text-slate-700 my-1 marker:text-blue-500"
        >
          {renderInlineFormatting(text)}
        </li>
      );
      continue;
    }

    // Numbered List Items
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      renderedElements.push(
        <div
          key={i}
          className="ml-1 my-1 flex items-start gap-2 text-xs leading-relaxed text-slate-700"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 mt-0.5">
            {numberedMatch[1]}
          </span>
          <div className="flex-1 min-w-0">{renderInlineFormatting(numberedMatch[2])}</div>
        </div>
      );
      continue;
    }

    // Empty Lines (Paragraph spacing)
    if (line.trim() === "") {
      renderedElements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular Paragraph
    renderedElements.push(
      <p key={i} className="text-xs leading-relaxed text-slate-700 my-1">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  // Flush any open blocks
  if (inCodeBlock) flushCodeBlock();
  if (inTable) flushTable();

  return (
    <div className={className}>
      {renderedElements}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-blue-600 ml-1 align-middle animate-pulse rounded-xs" />
      )}
    </div>
  );
}
