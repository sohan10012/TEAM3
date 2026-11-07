"""Document ingestion, validation, and multi-format text & table parsing service.

Supports PDF, DOCX, XLSX, TXT, Markdown, and CSV with page, section, and sheet provenance.
"""
from __future__ import annotations

import csv
import hashlib
import io
import logging
import re
from pathlib import Path
from typing import Any

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import BadRequest
from app.db.base import utcnow
from app.db.models import Document, DocumentProcessingJob, ExtractedContent

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


def get_documents_storage_dir(project_id: int | None = None) -> Path:
    settings = get_settings()
    sub = str(project_id) if project_id is not None else "drafts"
    base_dir = settings.data_dir / "documents" / sub
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


def save_document_file(project_id: int | None, doc_id: int, filename: str, content: bytes) -> tuple[Path, str]:
    storage_dir = get_documents_storage_dir(project_id)
    safe_name = f"{doc_id}_{filename}"
    target_path = storage_dir / safe_name
    # Security check: ensure path stays within storage_dir
    resolved = target_path.resolve()
    if not str(resolved).startswith(str(storage_dir.resolve())):
        raise BadRequest("Invalid file path resolution detected")

    target_path.write_bytes(content)
    checksum = hashlib.sha256(content).hexdigest()
    return target_path, checksum


def parse_pdf(file_path: Path) -> dict[str, Any]:
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    pages_text: list[str] = []
    sections: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    warnings: list[str] = []

    current_section = "General Specification"
    for page_idx, page in enumerate(reader.pages, start=1):
        try:
            raw_txt = page.extract_text() or ""
            # AI-EXT-01: De-hyphenate broken words across line breaks in multi-column layouts
            clean_txt = re.sub(r"(\b[a-zA-Z]{2,})-\s*\n\s*([a-zA-Z]{2,}\b)", r"\1\2", raw_txt)

            pages_text.append(f"--- [Page {page_idx}] ---\n{clean_txt}")
            # Scan for headings and regulatory sections (§, Chapter, Section, numbered clauses)
            lines = [ln.strip() for ln in clean_txt.splitlines() if ln.strip()]
            potential_table_rows: list[list[str]] = []

            for line_idx, line in enumerate(lines):
                # Detect structured headings (including regulatory § 778.xxx, 1.2.3, uppercase headers)
                is_heading = (
                    re.match(r"^(\d+(\.\d+)*\.?|[A-Z]\.|§\s*\d+(\.\d+)*)\s+[A-Za-z0-9\s_\-\.]{3,90}$", line)
                    or re.match(r"^(Section|Chapter|Part|Clause|Subpart)\s+[0-9A-Z\.]+", line, re.IGNORECASE)
                    or (len(line) < 60 and line.isupper() and len(line.split()) <= 6)
                )

                if is_heading:
                    current_section = line
                    sections.append({
                        "title": line,
                        "page": f"Page {page_idx}",
                        "level": line.count(".") + 1 if "." in line else 1,
                        "line": line_idx + 1,
                    })
                    continue

                # AI-EXT-02: Scan for tabular data (delimited by tabs, pipes, or structured columnar spacing)
                if "|" in line and len(line.split("|")) >= 3:
                    cells = [c.strip() for c in line.split("|") if c.strip()]
                    if len(cells) >= 2:
                        potential_table_rows.append(cells)
                elif "\t" in line and len(line.split("\t")) >= 2:
                    cells = [c.strip() for c in line.split("\t") if c.strip()]
                    if len(cells) >= 2:
                        potential_table_rows.append(cells)

            if potential_table_rows:
                tables.append({
                    "title": f"Table on Page {page_idx} ({current_section})",
                    "headers": potential_table_rows[0],
                    "rows": potential_table_rows[1:15],
                    "page": page_idx,
                })

            if clean_txt.strip():
                items.append({
                    "content_type": "text",
                    "content": clean_txt.strip(),
                    "source_page": page_idx,
                    "source_section": current_section,
                    "source_location": f"Page {page_idx}",
                    "metadata": {"line_count": len(lines)},
                })
        except Exception as e:
            warnings.append(f"Failed to extract text from page {page_idx}: {e}")

    full_text = "\n\n".join(pages_text)
    return {
        "extracted_text": full_text,
        "sections": sections,
        "tables": tables,
        "pages_count": len(reader.pages),
        "items": items,
        "warnings": warnings,
    }


def parse_docx(file_path: Path) -> dict[str, Any]:
    import docx

    doc = docx.Document(str(file_path))
    paragraphs_text: list[str] = []
    sections: list[dict[str, Any]] = []
    tables_data: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    warnings: list[str] = []

    cur_sec = "General"
    cur_buf: list[str] = []

    for p_idx, p in enumerate(doc.paragraphs, start=1):
        txt = p.text.strip()
        if not txt:
            continue
        if p.style.name.startswith("Heading"):
            if cur_buf:
                items.append({
                    "content_type": "section",
                    "content": "\n".join(cur_buf).strip(),
                    "source_page": None,
                    "source_section": cur_sec,
                    "source_location": f"Paragraphs {max(1, p_idx - len(cur_buf))}-{p_idx - 1}",
                    "metadata": {},
                })
                cur_buf = []
            cur_sec = txt
            paragraphs_text.append(txt)
            try:
                level = int(p.style.name.replace("Heading", "").strip())
            except ValueError:
                level = 1
            sections.append({
                "title": txt,
                "level": level,
                "page": f"Paragraph {p_idx}",
            })
        else:
            cur_buf.append(txt)
            paragraphs_text.append(txt)

    if cur_buf:
        items.append({
            "content_type": "section",
            "content": "\n".join(cur_buf).strip(),
            "source_page": None,
            "source_section": cur_sec,
            "source_location": "Body",
            "metadata": {},
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
            table_repr = f"\n[Table {t_idx}]\n" + " | ".join(headers) + "\n"
            table_repr += "\n".join(" | ".join(r) for r in data[:20])
            paragraphs_text.append(table_repr)
            items.append({
                "content_type": "table",
                "content": table_repr.strip(),
                "source_page": None,
                "source_section": "Table",
                "source_location": f"Table {t_idx}",
                "metadata": {"headers": headers, "rows_count": len(data)},
            })

    return {
        "extracted_text": "\n\n".join(paragraphs_text),
        "sections": sections,
        "tables": tables_data,
        "items": items,
        "warnings": warnings,
    }


def parse_xlsx(file_path: Path) -> dict[str, Any]:
    import openpyxl

    wb = openpyxl.load_workbook(str(file_path), data_only=True)
    sheets_text: list[str] = []
    sections: list[dict[str, Any]] = []
    tables_data: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
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

            items.append({
                "content_type": "table",
                "content": text_block.strip(),
                "source_page": None,
                "source_section": f"Sheet: {sheet_name}",
                "source_location": f"Sheet {sheet_name}",
                "metadata": {"sheet_name": sheet_name, "headers": headers, "rows_count": len(data)},
            })

    return {
        "extracted_text": "\n\n".join(sheets_text),
        "sections": sections,
        "tables": tables_data,
        "items": items,
        "sheets_count": len(wb.sheetnames),
        "warnings": warnings,
    }


def parse_csv(file_path: Path) -> dict[str, Any]:
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    reader = csv.reader(io.StringIO(raw))
    rows = list(reader)
    if not rows:
        return {"extracted_text": "", "sections": [], "tables": [], "items": [], "warnings": ["Empty CSV file"]}

    headers = rows[0]
    data = rows[1:]
    text_block = f"--- [CSV Table: {file_path.name}] ---\n"
    text_block += " | ".join(headers) + "\n"
    text_block += "\n".join(" | ".join(r) for r in data)

    items = [{
        "content_type": "table",
        "content": text_block.strip(),
        "source_page": 1,
        "source_section": file_path.name,
        "source_location": f"CSV Table: {file_path.name}",
        "metadata": {"headers": headers, "rows_count": len(data)},
    }]

    return {
        "extracted_text": text_block,
        "sections": [{"title": file_path.name, "level": 1, "page": "CSV 1"}],
        "tables": [{
            "headers": headers,
            "rows_count": len(data),
            "sample_rows": data[:10],
        }],
        "items": items,
        "warnings": [],
    }


def parse_markdown(file_path: Path) -> dict[str, Any]:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    sections: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []

    cur_title = "Overview"
    cur_lines: list[str] = []
    start_line = 1

    for idx, line in enumerate(lines, start=1):
        line_s = line.strip()
        if line_s.startswith("#"):
            if cur_lines and any(ln.strip() for ln in cur_lines):
                items.append({
                    "content_type": "section",
                    "content": "\n".join(cur_lines).strip(),
                    "source_page": None,
                    "source_section": cur_title,
                    "source_location": f"Lines {start_line}-{idx - 1}",
                    "metadata": {},
                })
                cur_lines = []
            hashes = len(line_s) - len(line_s.lstrip("#"))
            cur_title = line_s.lstrip("#").strip()
            start_line = idx
            sections.append({
                "title": cur_title,
                "level": hashes,
                "page": f"Line {idx}",
                "line": idx,
            })
        else:
            cur_lines.append(line)

    if cur_lines and any(ln.strip() for ln in cur_lines):
        items.append({
            "content_type": "section",
            "content": "\n".join(cur_lines).strip(),
            "source_page": None,
            "source_section": cur_title,
            "source_location": f"Lines {start_line}-{len(lines)}",
            "metadata": {},
        })

    return {
        "extracted_text": text,
        "sections": sections,
        "tables": [],
        "items": items,
        "warnings": [],
    }


def parse_txt(file_path: Path) -> dict[str, Any]:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    sections: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []

    cur_title = "General"
    cur_lines: list[str] = []
    start_line = 1

    for idx, line in enumerate(lines, start=1):
        line_s = line.strip()
        # Heuristic for section titles: numbered or uppercase short lines
        if re.match(r"^(\d+(\.\d+)*\.?|[A-Z]\.)\s+[A-Za-z0-9\s_-]{3,80}$", line_s):
            if cur_lines and any(ln.strip() for ln in cur_lines):
                items.append({
                    "content_type": "section",
                    "content": "\n".join(cur_lines).strip(),
                    "source_page": None,
                    "source_section": cur_title,
                    "source_location": f"Lines {start_line}-{idx - 1}",
                    "metadata": {},
                })
                cur_lines = []
            cur_title = line_s
            start_line = idx
            sections.append({
                "title": line_s,
                "level": line_s.count(".") + 1 if "." in line_s else 1,
                "page": f"Line {idx}",
                "line": idx,
            })
        else:
            cur_lines.append(line)

    if cur_lines and any(ln.strip() for ln in cur_lines):
        items.append({
            "content_type": "section",
            "content": "\n".join(cur_lines).strip(),
            "source_page": None,
            "source_section": cur_title,
            "source_location": f"Lines {start_line}-{len(lines)}",
            "metadata": {},
        })

    return {
        "extracted_text": text,
        "sections": sections,
        "tables": [],
        "items": items,
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
    """Process uploaded document, extract text and metadata, update database record and job history."""
    doc = db.get(Document, document_id)
    if not doc:
        raise BadRequest(f"Document {document_id} not found")

    job = DocumentProcessingJob(
        document_id=doc.id,
        project_id=doc.project_id,
        job_status="processing",
        processing_stage="validation",
        started_at=utcnow(),
        retry_count=getattr(doc, "metadata_json", {}).get("retry_count", 0),
    )
    db.add(job)
    db.flush()

    file_path = Path(doc.file_path)
    if not file_path.exists():
        doc.status = "failed"
        doc.upload_status = "failed"
        doc.extraction_status = "failed"
        doc.error_message = f"Stored file not found at {file_path}"
        doc.updated_at = utcnow()
        job.job_status = "failed"
        job.completed_at = utcnow()
        job.error_message = doc.error_message
        db.commit()
        return doc

    doc.status = "processing"
    doc.extraction_status = "processing"
    doc.updated_at = utcnow()
    db.commit()

    try:
        job.processing_stage = "parsing"
        parsed = extract_document_content(file_path, doc.file_type)
        job.processing_stage = "text_extraction"
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

        # Clear existing extracted content records and persist newly parsed items
        db.execute(delete(ExtractedContent).where(ExtractedContent.document_id == doc.id))
        content_items = parsed.get("items", [])
        if not content_items and doc.extracted_text:
            content_items = [{
                "content_type": "text",
                "content": doc.extracted_text,
                "source_page": 1,
                "source_section": "Document Content",
                "source_location": "Full Document",
                "metadata": {},
            }]

        for it in content_items:
            content_str = str(it.get("content", "")).strip()
            if content_str:
                ec = ExtractedContent(
                    document_id=doc.id,
                    content_type=it.get("content_type", "text"),
                    content=content_str,
                    source_page=it.get("source_page"),
                    source_section=str(it.get("source_section", ""))[:250],
                    source_location=str(it.get("source_location", ""))[:250],
                    metadata_json=it.get("metadata", {}),
                )
                db.add(ec)

        doc.status = "completed"
        doc.upload_status = "completed"
        doc.extraction_status = "extracted"
        doc.error_message = None
        doc.updated_at = utcnow()

        job.job_status = "completed"
        job.processing_stage = "completed"
        job.completed_at = utcnow()
        job.extracted_content_reference = {
            "pages_count": parsed.get("pages_count"),
            "sections_count": len(parsed.get("sections", [])),
            "chars_count": len(doc.extracted_text),
        }
        db.commit()
        db.refresh(doc)
        log.info("Document %d ('%s') processed successfully (%d chars extracted)",
                 doc.id, doc.filename, len(doc.extracted_text))
        return doc
    except Exception as e:
        log.exception("Failed to process document %d: %s", document_id, e)
        doc.status = "failed"
        doc.extraction_status = "failed"
        doc.error_message = str(e)
        doc.updated_at = utcnow()

        job.job_status = "failed"
        job.completed_at = utcnow()
        job.error_message = str(e)
        db.commit()
        db.refresh(doc)
        return doc
