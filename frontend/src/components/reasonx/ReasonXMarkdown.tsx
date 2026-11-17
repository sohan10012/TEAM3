import React from "react";

interface ReasonXMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Clean, lightweight, dependency-free Markdown renderer for ReasonX
 * Handles headings, code blocks, tables, bold text, lists, and linebreaks safely.
 */
export function ReasonXMarkdown({ content, className }: ReasonXMarkdownProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const headerRow = tableLines[0];
    const dataRows = tableLines.slice(2); // skip separator

    const parseCells = (row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    const headers = parseCells(headerRow);

    renderedElements.push(
      <div key={`table-${renderedElements.length}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-2xs">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-1.5 font-semibold text-slate-700">
                  {renderInlineFormatting(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {dataRows.map((row, ri) => {
              const cells = parseCells(row);
              return (
                <tr key={ri} className="hover:bg-slate-50/50">
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-slate-600">
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
      <pre
        key={`code-${renderedElements.length}`}
        className="my-2.5 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100 leading-normal"
      >
        <code>{codeBlockLines.join("\n")}</code>
      </pre>
    );
    codeBlockLines = [];
    inCodeBlock = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        if (inTable) flushTable();
        inCodeBlock = true;
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

    // Headings
    if (line.startsWith("### ")) {
      renderedElements.push(
        <h4 key={i} className="mt-3 mb-1 text-xs font-semibold text-slate-900 tracking-tight">
          {renderInlineFormatting(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      renderedElements.push(
        <h3 key={i} className="mt-3.5 mb-1 text-sm font-semibold text-slate-900 tracking-tight">
          {renderInlineFormatting(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      renderedElements.push(
        <h2 key={i} className="mt-4 mb-1.5 text-base font-bold text-slate-900 tracking-tight">
          {renderInlineFormatting(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Unordered List items
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, "");
      renderedElements.push(
        <li key={i} className="ml-4 list-disc text-xs leading-relaxed text-slate-700 my-0.5">
          {renderInlineFormatting(text)}
        </li>
      );
      continue;
    }

    // Numbered List items
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      renderedElements.push(
        <div key={i} className="ml-1 my-0.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-500 shrink-0">{numberedMatch[1]}.</span>
          <span>{renderInlineFormatting(numberedMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      renderedElements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Normal paragraph line
    renderedElements.push(
      <p key={i} className="text-xs leading-relaxed text-slate-700 my-1">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  if (inCodeBlock) flushCodeBlock();
  if (inTable) flushTable();

  return <div className={className}>{renderedElements}</div>;
}

/**
 * Format inline bold `**text**` and code `` `code` ``
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Split on bold or backticks
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return tokens.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800 border border-slate-200/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
