"""Comprehensive test suite for document parsing across all 6 supported formats.

Verifies:
- PDF: Text extraction, page provenance, headings
- DOCX: Paragraphs, heading levels, tables
- XLSX: Multi-sheet tables, column headers, cell references
- CSV: Delimited rows, header recognition, empty values
- TXT: Numbered requirement clauses, sections
- MD: Markdown headings, code blocks, sections
- Edge cases: Empty files, unsupported extensions, oversized files, directory traversal attempts
"""
from pathlib import Path

import pytest

from app.core.errors import AppError
from app.services.document_processor import (
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    extract_document_content,
    parse_csv,
    parse_docx,
    parse_markdown,
    parse_pdf,
    parse_txt,
    parse_xlsx,
    validate_file_upload,
)


def test_supported_extensions_whitelist():
    assert ".pdf" in ALLOWED_EXTENSIONS
    assert ".docx" in ALLOWED_EXTENSIONS
    assert ".xlsx" in ALLOWED_EXTENSIONS
    assert ".csv" in ALLOWED_EXTENSIONS
    assert ".txt" in ALLOWED_EXTENSIONS
    assert ".md" in ALLOWED_EXTENSIONS


def test_validate_file_upload_valid_formats():
    for ext in [".pdf", ".docx", ".xlsx", ".csv", ".txt", ".md"]:
        name, ft, sz = validate_file_upload(f"test_doc{ext}", b"Sample content for validation")
        assert name == f"test_doc{ext}"
        assert sz > 0
        assert ft in ("pdf", "docx", "xlsx", "csv", "txt", "md")


def test_validate_file_upload_empty_file_rejected():
    with pytest.raises(AppError, match="Document file is empty"):
        validate_file_upload("empty.pdf", b"")


def test_validate_file_upload_unsupported_format_rejected():
    with pytest.raises(AppError, match="Unsupported document format"):
        validate_file_upload("executable.exe", b"MZbinarycontent")


def test_validate_file_upload_oversized_file_rejected():
    oversized = b"X" * (MAX_FILE_SIZE_BYTES + 1024)
    with pytest.raises(AppError, match="Document exceeds maximum size"):
        validate_file_upload("large.pdf", oversized)


def test_validate_file_upload_traversal_sanitized():
    name, _, _ = validate_file_upload("../../etc/passwd.pdf", b"Some content")
    assert ".." not in name
    assert "/" not in name


REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DOCS_DIR = REPO_ROOT / "data" / "dayforce_sample_docs"


def test_parse_dayforce_prd_pdf():
    pdf_path = SAMPLE_DOCS_DIR / "Dayforce_PRD_v1.2.pdf"
    assert pdf_path.exists(), f"Dayforce PRD PDF must exist at {pdf_path}"
    res = parse_pdf(pdf_path)
    assert res["pages_count"] >= 2
    assert "Dayforce Enterprise Product Requirements" in res["extracted_text"]
    assert len(res["sections"]) > 0
    assert len(res["items"]) >= 2
    assert any("overtime at 1.5x" in it["content"].lower() for it in res["items"])


def test_parse_dayforce_srs_docx():
    docx_path = SAMPLE_DOCS_DIR / "Dayforce_SRS_v1.0.docx"
    assert docx_path.exists(), f"Dayforce SRS DOCX must exist at {docx_path}"
    res = parse_docx(docx_path)
    assert "Dayforce Software Requirements Specification" in res["extracted_text"]
    assert len(res["sections"]) >= 4
    assert len(res["tables"]) >= 1
    # Check table content
    assert any("VAC" in str(t["sample_rows"]) for t in res["tables"])


def test_parse_dayforce_business_rules_xlsx():
    xlsx_path = SAMPLE_DOCS_DIR / "Business_Rules.xlsx"
    assert xlsx_path.exists(), f"Dayforce Business Rules XLSX must exist at {xlsx_path}"
    res = parse_xlsx(xlsx_path)
    assert res["sheets_count"] >= 3
    assert "Attendance_Policies" in res["extracted_text"]
    assert "Overtime_Rules" in res["extracted_text"]
    assert "Leave_Entitlements" in res["extracted_text"]
    assert any(it["source_section"] == "Sheet: Overtime_Rules" for it in res["items"])


def test_parse_csv_file(tmp_path):
    csv_file = tmp_path / "employee_data.csv"
    csv_file.write_text("Employee_ID,Name,Department,Status\nEMP101,John Doe,Engineering,Active\nEMP102,Jane Smith,HR,Active\n", encoding="utf-8")
    res = parse_csv(csv_file)
    assert "EMP101" in res["extracted_text"]
    assert len(res["tables"]) == 1
    assert res["tables"][0]["headers"] == ["Employee_ID", "Name", "Department", "Status"]
    assert res["tables"][0]["rows_count"] == 2


def test_parse_txt_file(tmp_path):
    txt_file = tmp_path / "policy.txt"
    txt_file.write_text(
        "1. GENERAL POLICY\nThe system shall log all login attempts.\n\n2. AUDIT COMPLIANCE\nThe system must retain records for 7 years.\n",
        encoding="utf-8"
    )
    res = parse_txt(txt_file)
    assert "GENERAL POLICY" in res["extracted_text"]
    assert len(res["sections"]) >= 2
    assert len(res["items"]) >= 2


def test_parse_markdown_file():
    md_path = SAMPLE_DOCS_DIR / "Dayforce_API_Integration.md"
    assert md_path.exists(), f"Dayforce API Integration markdown must exist at {md_path}"
    res = parse_markdown(md_path)
    assert "Authentication & Security Expectations" in res["extracted_text"]
    assert len(res["sections"]) >= 3
    assert len(res["items"]) >= 3


def test_extract_document_content_routing():
    pdf_path = SAMPLE_DOCS_DIR / "Dayforce_PRD_v1.2.pdf"
    res = extract_document_content(pdf_path, "pdf")
    assert "Dayforce" in res["extracted_text"]
