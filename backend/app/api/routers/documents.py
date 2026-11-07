"""Documents API router: file upload, listing, details, download, and processing."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.api.deps import (
    Principal,
    current_principal,
    get_project_checked,
    require,
)
from app.core.errors import BadRequest, NotFound
from app.db.base import get_db
from app.db.models import Document, Project
from app.services import audit
from app.services.document_processor import (
    process_document,
    save_document_file,
    validate_file_upload,
)

router = APIRouter(tags=["documents"])

VALID_PURPOSES = {
    "prd": "Product Requirements Document (PRD)",
    "srs": "Software Requirements Specification (SRS)",
    "brd": "Business Requirements Document (BRD)",
    "functional_spec": "Functional Specification",
    "technical_spec": "Technical Specification",
    "api_doc": "API Documentation",
    "business_rules": "Business Rules",
    "user_stories": "User Stories",
    "acceptance_criteria": "Acceptance Criteria",
    "other": "Other supporting documentation",
}


@router.get("/projects/{project_id}/documents")
def list_project_documents(
    project_id: int,
    db: Session = Depends(get_db),
    p: Principal = Depends(current_principal),
):
    get_project_checked(db, p, project_id)
    docs = db.execute(
        select(Document).where(Document.project_id == project_id).order_by(Document.created_at.desc())
    ).scalars().all()
    return [S.document(d) for d in docs]


@router.post("/projects/{project_id}/documents", status_code=201)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    purpose: str = Form(default="prd"),
    description: str = Form(default=""),
    auto_process: bool = Form(default=True),
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    get_project_checked(db, p, project_id)
    purpose_clean = purpose.lower().strip()
    if purpose_clean not in VALID_PURPOSES:
        valid_opts = ", ".join(sorted(VALID_PURPOSES.keys()))
        raise BadRequest(f"Invalid purpose '{purpose}'. Allowed: {valid_opts}")

    raw_bytes = await file.read()
    filename = file.filename or "uploaded_document"
    safe_name, file_type, size = validate_file_upload(filename, raw_bytes)

    doc = Document(
        project_id=project_id,
        filename=safe_name,
        file_path="",  # Filled once doc.id is generated
        file_type=file_type,
        file_size_bytes=size,
        purpose=purpose_clean,
        description=description.strip(),
        status="uploaded",
        metadata_json={},
    )
    db.add(doc)
    db.flush()

    # Save content to disk with doc.id prefix
    saved_path = save_document_file(project_id, doc.id, safe_name, raw_bytes)
    doc.file_path = str(saved_path)
    db.commit()
    db.refresh(doc)

    audit.record(db, p.id, "document.uploaded", "document", doc.id, doc.filename, project_id)

    if auto_process:
        doc = process_document(db, doc.id)

    return S.document(doc)


@router.get("/documents/{document_id}")
def get_document_details(
    document_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    res = S.document(doc)
    res["extracted_text"] = doc.extracted_text  # Return full extracted text in detail view
    res["sections"] = doc.metadata_json.get("sections", []) if doc.metadata_json else []
    res["tables"] = doc.metadata_json.get("tables", []) if doc.metadata_json else []
    return res


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    target_path = Path(doc.file_path)
    if not target_path.exists():
        raise NotFound("Document file not found on disk")

    media_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv",
        "txt": "text/plain",
        "md": "text/markdown",
    }
    media_type = media_types.get(doc.file_type, "application/octet-stream")
    return FileResponse(
        path=str(target_path),
        filename=doc.filename,
        media_type=media_type,
    )


@router.post("/documents/{document_id}/process")
def trigger_document_process(
    document_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    updated_doc = process_document(db, doc.id)
    audit.record(db, p.id, "document.processed", "document", doc.id, doc.filename, doc.project_id)
    return S.document(updated_doc)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    # Clean up disk file
    try:
        fp = Path(doc.file_path)
        if fp.exists():
            fp.unlink(missing_ok=True)
    except Exception:
        pass

    project_id = doc.project_id
    filename = doc.filename
    db.delete(doc)
    audit.record(db, p.id, "document.deleted", "document", document_id, filename, project_id)
    db.commit()
    return None
