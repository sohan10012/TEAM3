import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmbeddedDocumentViewer } from "@/components/documents/EmbeddedDocumentViewer";

describe("EmbeddedDocumentViewer Component", () => {
  it("renders non-PDF fallback correctly with text and table data", () => {
    const tables = [
      {
        title: "Tax Brackets 2026",
        headers: ["Income Band", "Rate %"],
        rows: [
          ["$0 - $11,600", "10%"],
          ["$11,600 - $47,150", "12%"],
        ],
      },
    ];

    render(
      <EmbeddedDocumentViewer
        documentId={42}
        filename="PAYE_Tax_Specification.xlsx"
        fileType="xlsx"
        extractedTextFallback="This is extracted specification content for tax calculations."
        tablesFallback={tables}
      />
    );

    expect(screen.getByText("PAYE_Tax_Specification.xlsx")).toBeInTheDocument();
    expect(screen.getByText("xlsx")).toBeInTheDocument();
    expect(screen.getByText("Tax Brackets 2026")).toBeInTheDocument();
    expect(screen.getByText("Income Band")).toBeInTheDocument();
    expect(screen.getByText("$11,600 - $47,150")).toBeInTheDocument();
    expect(screen.getByText("This is extracted specification content for tax calculations.")).toBeInTheDocument();
    expect(screen.getByText("Download Original")).toBeInTheDocument();
  });

  it("renders highlight excerpt banner when targetExcerpt is provided", () => {
    render(
      <EmbeddedDocumentViewer
        documentId={99}
        filename="FLSA_Overtime_Part_778.pdf"
        fileType="pdf"
        initialPage={14}
        highlightExcerpt="Hours worked above 40 in a workweek must be paid at one and one-half times the regular rate."
      />
    );

    expect(screen.getByText("Target Source Passage")).toBeInTheDocument();
    expect(
      screen.getByText(/Hours worked above 40 in a workweek must be paid at one and one-half times the regular rate./)
    ).toBeInTheDocument();
  });
});
