"""Document ingestion, validation, and multi-format text & table parsing service.

Supports PDF, DOCX, XLSX, TXT, Markdown, and CSV with page, section, and sheet provenance.
"""
from __future__ import annotations

import csv
import io
import logging
import os
import re
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import BadRequest
from app.db.base import utcnow
from app.db.models import Document

log = logging.getLogger("tracetest.documents")

ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".xlsx": "xlsx",
    ".txt": "txt",
    ".md": "md",
    ".markdown": "md",
    ".csv": "csv",
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


def get_documents_storage_dir(project_id: int) -> Path:
    settings = get_settings()
    base_dir = settings.data_dir / "documents" / str(project_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def validate_file_upload(filename: str, content: bytes) -> tuple[str, str, int]:
    """Validate file name, extension, and content size."""
    if not filename or not filename.strip():
        raise BadRequest("Document filename cannot be empty")

    safe_name = Path(filename).name
    # Strip any directory traversal or path separators
    safe_name = re.sub(r"[^\w\s\.-]", "_", safe_name).strip()
    if not safe_name:
        raise BadRequest("Invalid document filename")

    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed_list = ", ".join(sorted(ALLOWED_EXTENSIONS.keys()))
        raise BadRequest(f"Unsupported document format '{ext}'. Allowed: {allowed_list}")

    file_type = ALLOWED_EXTENSIONS[ext]
    size = len(content)
    if size == 0:
        raise BadRequest("Document file is empty")
    if size > MAX_FILE_SIZE_BYTES:
        raise BadRequest(f"Document exceeds maximum size of 25MB (size: {size} bytes)")

    return safe_name, file_type, size


def save_document_file(project_id: int, doc_id: int, filename: str, content: bytes) -> Path:
    storage_dir = get_documents_storage_dir(project_id)
    safe_name = f"{doc_id}_{filename}"
    target_path = storage_dir / safe_name
    # Security check: ensure path stays within storage_dir
    resolved = target_path.resolve()
    if not str(resolved).startswith(str(storage_dir.resolve())):
        raise BadRequest("Invalid file path resolution detected")

    target_path.write_bytes(content)
    return target_path


def parse_pdf(file_path: Path) -> dict[str, Any]:
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    pages_text: list[str] = []
    sections: list[dict[str, Any]] = []
    warnings: list[str] = []

    current_section = "General"
    for page_idx, page in enumerate(reader.pages, start=1):
        try:
            txt = page.extract_text() or ""
            pages_text.append(f"--- [Page {page_idx}] ---\n{txt}")
            # Scan for headings
            lines = [ln.strip() for ln in txt.splitlines() if ln.strip()]
            for line_idx, line in enumerate(lines):
                if re.match(r"^(\d+(\.\d+)*|[A-Z]\.)\s+[A-Za-z0-9\s_-]{3,80}$", line) or (
                    len(line) < 60 and line.isupper() and len(line.split()) <= 6
                ):
                    current_section = line
                    sections.append({
                        "title": line,
                        "page": f"Page {page_idx}",
                        "level": line.count(".") + 1 if "." in line else 1,
                        "line": line_idx + 1,
                    })
        except Exception as e:
            warnings.append(f"Failed to extract text from page {page_idx}: {e}")

    full_text = "\n\n".join(pages_text)
    return {
        "extracted_text": full_text,
        "sections": sections,
        "tables": [],
        "pages_count": len(reader.pages),
        "warnings": warnings,
    }


def parse_docx(file_path: Path) -> dict[str, Any]:
    import docx

    doc = docx.Document(str(file_path))
    paragraphs_text: list[str] = []
    sections: list[dict[str, Any]] = []
    tables_data: list[dict[str, Any]] = []
    warnings: list[str] = []

    for p_idx, p in enumerate(doc.paragraphs, start=1):
        txt = p.text.strip()
        if not txt:
            continue
        paragraphs_text.append(txt)
        if p.style.name.startswith("Heading"):
            try:
                level = int(p.style.name.replace("Heading", "").strip())
            except ValueError:
                level = 1
            sections.append({
                "title": txt,
                "level": level,
                "page": f"Paragraph {p_idx}",
            })

    # Extract tables
    for t_idx, table in enumerate(doc.tables, start=1):
        table_rows = []
        for row in table.rows:
            table_rows.append([cell.text.strip() for cell in row.cells])
        if table_rows:
            headers = table_rows[0]
            data = table_rows[1:]
            tables_data.append({
                "table_index": t_idx,
                "headers": headers,
                "rows_count": len(data),
                "sample_rows": data[:10],
            })
            # Also append textual representation
            table_repr = f"\n[Table {t_idx}]\n" + " | ".join(headers) + "\n"
            table_repr += "\n".join(" | ".join(r) for r in data[:20])
            paragraphs_text.append(table_repr)

    return {
        "extracted_text": "\n\n".join(paragraphs_text),
        "sections": sections,
        "tables": tables_data,
        "warnings": warnings,
    }


def parse_xlsx(file_path: Path) -> dict[str, Any]:
    import openpyxl

    wb = openpyxl.load_workbook(str(file_path), data_only=True)
    sheets_text: list[str] = []
    sections: list[dict[str, Any]] = []
    tables_data: list[dict[str, Any]] = []
    warnings: list[str] = []

    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        sections.append({
            "title": f"Sheet: {sheet_name}",
            "level": 1,
            "page": sheet_name,
        })
        rows_list = []
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None for cell in row):
                rows_list.append([str(c).strip() if c is not None else "" for c in row])

        if rows_list:
            headers = rows_list[0]
            data = rows_list[1:]
            tables_data.append({
                "sheet_name": sheet_name,
                "headers": headers,
                "rows_count": len(data),
                "sample_rows": data[:10],
            })
            text_block = f"--- [Sheet: {sheet_name}] ---\n"
            text_block += " | ".join(headers) + "\n"
            text_block += "\n".join(" | ".join(r) for r in data)
            sheets_text.append(text_block)

    return {
        "extracted_text": "\n\n".join(sheets_text),
        "sections": sections,
        "tables": tables_data,
        "sheets_count": len(wb.sheetnames),
        "warnings": warnings,
    }


def parse_csv(file_path: Path) -> dict[str, Any]:
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)
    if not rows:
        return {"extracted_text": "", "sections": [], "tables": [], "warnings": ["Empty CSV file"]}

    headers = rows[0]
    data = rows[1:]
    text_block = f"--- [CSV Table: {file_path.name}] ---\n"
    text_block += " | ".join(headers) + "\n"
    text_block += "\n".join(" | ".join(r) for r in data)

    return {
        "extracted_text": text_block,
        "sections": [{"title": file_path.name, "level": 1, "page": "CSV 1"}],
        "tables": [{
            "headers": headers,
            "rows_count": len(data),
            "sample_rows": data[:10],
        }],
        "warnings": [],
    }


def parse_markdown(file_path: Path) -> dict[str, Any]:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    sections: list[dict[str, Any]] = []

    for idx, line in enumerate(lines, start=1):
        line_s = line.strip()
        if line_s.startswith("#"):
            hashes = len(line_s) - len(line_s.lstrip("#"))
            title = line_s.lstrip("#").strip()
            sections.append({
                "title": title,
                "level": hashes,
                "page": f"Line {idx}",
                "line": idx,
            })

    return {
        "extracted_text": text,
        "sections": sections,
        "tables": [],
        "warnings": [],
    }


def parse_txt(file_path: Path) -> dict[str, Any]:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    sections: list[dict[str, Any]] = []

    for idx, line in enumerate(lines, start=1):
        line_s = line.strip()
        # Heuristic for section titles: numbered or uppercase short lines
        if re.match(r"^(\d+(\.\d+)*|[A-Z]\.)\s+[A-Za-z0-9\s_-]{3,80}$", line_s):
            sections.append({
                "title": line_s,
                "level": line_s.count(".") + 1 if "." in line_s else 1,
                "page": f"Line {idx}",
                "line": idx,
            })

    return {
        "extracted_text": text,
        "sections": sections,
        "tables": [],
        "warnings": [],
    }


def extract_document_content(file_path: Path, file_type: str) -> dict[str, Any]:
    """Route document to appropriate format parser."""
    ft = file_type.lower()
    if ft == "pdf":
        return parse_pdf(file_path)
    elif ft == "docx":
        return parse_docx(file_path)
    elif ft == "xlsx":
        return parse_xlsx(file_path)
    elif ft == "csv":
        return parse_csv(file_path)
    elif ft in ("md", "markdown"):
        return parse_markdown(file_path)
    elif ft == "txt":
        return parse_txt(file_path)
    else:
        raise BadRequest(f"Unsupported format '{file_type}' for text extraction")


def process_document(db: Session, document_id: int) -> Document:
    """Process uploaded document, extract text and metadata, update database record."""
    doc = db.get(Document, document_id)
    if not doc:
        raise BadRequest(f"Document {document_id} not found")

    file_path = Path(doc.file_path)
    if not file_path.exists():
        doc.status = "failed"
        doc.error_message = f"Stored file not found at {file_path}"
        doc.updated_at = utcnow()
        db.commit()
        return doc

    doc.status = "processing"
    doc.updated_at = utcnow()
    db.commit()

    try:
        parsed = extract_document_content(file_path, doc.file_type)
        doc.extracted_text = parsed.get("extracted_text", "")
        doc.metadata_json = {
            "sections": parsed.get("sections", []),
            "tables": parsed.get("tables", []),
            "warnings": parsed.get("warnings", []),
            "pages_count": parsed.get("pages_count"),
            "sheets_count": parsed.get("sheets_count"),
            "extracted_chars": len(doc.extracted_text),
            "processed_at": utcnow().isoformat(),
        }
        doc.status = "completed"
        doc.error_message = None
        doc.updated_at = utcnow()
        db.commit()
        db.refresh(doc)
        log.info("Document %d ('%s') processed successfully (%d chars extracted)",
                 doc.id, doc.filename, len(doc.extracted_text))
        return doc
    except Exception as e:
        log.exception("Failed to process document %d: %s", document_id, e)
        doc.status = "failed"
        doc.error_message = str(e)
        doc.updated_at = utcnow()
        db.commit()
        db.refresh(doc)
        return doc
