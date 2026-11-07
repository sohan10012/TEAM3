"""Documents API router: file upload, listing, details, download, metadata updates, and processing."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.api.deps import (
    Principal,
    current_principal,
    get_project_checked,
    require,
)
from app.core.errors import NotFound
from app.db.base import get_db, utcnow
from app.db.models import Document, DocumentProcessingJob, ExtractedContent, Requirement
from app.services import audit
from app.services.document_processor import (
    process_document,
    save_document_file,
    validate_file_upload,
)
from app.services.requirement_intelligence import (
    process_all_project_documents_and_requirements,
    reprocess_document_and_requirements,
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
    "architecture": "Architecture Documentation",
    "compliance": "Compliance Documentation",
    "other": "Other supporting documentation",
}


class DocumentUpdateIn(BaseModel):
    display_name: str | None = None
    document_type: str | None = None
    description: str | None = None
    version: str | None = None
    owner: str | None = None
    document_date: str | None = None
    related_module: str | None = None
    priority: str | None = None
    processing_instructions: str | None = None


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

    # Pre-fetch requirement counts per document
    counts = {
        row[0]: row[1]
        for row in db.execute(
            select(Requirement.document_id, func.count(Requirement.id))
            .where(Requirement.project_id == project_id, Requirement.document_id.isnot(None))
            .group_by(Requirement.document_id)
        ).all()
    }

    return [S.document(d, requirements_count=counts.get(d.id, 0)) for d in docs]


async def _do_upload_document(
    project_id: int | None,
    file: UploadFile,
    display_name: str,
    purpose: str,
    document_type: str,
    description: str,
    version: str,
    owner: str,
    document_date: str,
    related_module: str,
    priority: str,
    processing_instructions: str,
    auto_process: bool,
    p: Principal,
    db: Session,
):
    if project_id is not None:
        get_project_checked(db, p, project_id)
    doc_type = (document_type or purpose).lower().strip()
    if doc_type not in VALID_PURPOSES:
        doc_type = "prd"

    raw_bytes = await file.read()
    filename = file.filename or "uploaded_document"
    safe_name, file_type, size = validate_file_upload(filename, raw_bytes)

    doc = Document(
        project_id=project_id,
        filename=safe_name,
        display_name=display_name.strip() or safe_name,
        file_path="",  # Filled once doc.id is generated
        file_type=file_type,
        document_type=doc_type,
        file_size_bytes=size,
        purpose=doc_type,
        description=description.strip(),
        version=version.strip() or "1.0",
        owner=owner.strip(),
        document_date=document_date.strip(),
        related_module=related_module.strip(),
        priority=priority.lower().strip() if priority.lower().strip() in ("critical", "high", "medium", "low") else "medium",
        processing_instructions=processing_instructions.strip(),
        status="uploaded",
        upload_status="uploaded",
        extraction_status="queued" if auto_process else "uploaded",
        metadata_json={},
    )
    db.add(doc)
    db.flush()

    # Save content to disk with doc.id prefix and calculate SHA-256
    saved_path, checksum = save_document_file(project_id, doc.id, safe_name, raw_bytes)
    doc.file_path = str(saved_path)
    doc.checksum = checksum
    db.commit()
    db.refresh(doc)

    audit.record(db, p.id, "document.uploaded", "document", doc.id, doc.filename, project_id)

    if auto_process:
        doc = process_document(db, doc.id)

    req_count = db.execute(
        select(func.count(Requirement.id)).where(Requirement.document_id == doc.id)
    ).scalar() or 0

    return S.document(doc, requirements_count=req_count)


@router.post("/projects/{project_id}/documents", status_code=201)
@router.post("/projects/{project_id}/documents/upload", status_code=201)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    display_name: str = Form(default=""),
    purpose: str = Form(default="prd"),
    document_type: str = Form(default=""),
    description: str = Form(default=""),
    version: str = Form(default="1.0"),
    owner: str = Form(default=""),
    document_date: str = Form(default=""),
    related_module: str = Form(default=""),
    priority: str = Form(default="medium"),
    processing_instructions: str = Form(default=""),
    auto_process: bool = Form(default=True),
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    return await _do_upload_document(
        project_id=project_id,
        file=file,
        display_name=display_name,
        purpose=purpose,
        document_type=document_type,
        description=description,
        version=version,
        owner=owner,
        document_date=document_date,
        related_module=related_module,
        priority=priority,
        processing_instructions=processing_instructions,
        auto_process=auto_process,
        p=p,
        db=db,
    )


@router.post("/documents", status_code=201)
async def upload_document_standalone(
    file: UploadFile = File(...),
    project_id: int | None = Form(default=None),
    display_name: str = Form(default=""),
    purpose: str = Form(default="prd"),
    document_type: str = Form(default=""),
    description: str = Form(default=""),
    version: str = Form(default="1.0"),
    owner: str = Form(default=""),
    document_date: str = Form(default=""),
    related_module: str = Form(default=""),
    priority: str = Form(default="medium"),
    processing_instructions: str = Form(default=""),
    auto_process: bool = Form(default=False),
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    return await _do_upload_document(
        project_id=project_id,
        file=file,
        display_name=display_name,
        purpose=purpose,
        document_type=document_type,
        description=description,
        version=version,
        owner=owner,
        document_date=document_date,
        related_module=related_module,
        priority=priority,
        processing_instructions=processing_instructions,
        auto_process=auto_process,
        p=p,
        db=db,
    )


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

    req_count = db.execute(
        select(func.count(Requirement.id)).where(Requirement.document_id == doc.id)
    ).scalar() or 0

    res = S.document(doc, requirements_count=req_count)
    res["extracted_text"] = doc.extracted_text  # Return full extracted text in detail view
    res["sections"] = doc.metadata_json.get("sections", []) if doc.metadata_json else []
    res["tables"] = doc.metadata_json.get("tables", []) if doc.metadata_json else []
    return res


@router.patch("/documents/{document_id}")
def update_document_metadata(
    document_id: int,
    body: DocumentUpdateIn,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    if body.display_name is not None:
        doc.display_name = body.display_name.strip()
    if body.document_type is not None:
        doc.document_type = body.document_type.lower().strip()
        doc.purpose = doc.document_type
    if body.description is not None:
        doc.description = body.description.strip()
    if body.version is not None:
        doc.version = body.version.strip()
    if body.owner is not None:
        doc.owner = body.owner.strip()
    if body.document_date is not None:
        doc.document_date = body.document_date.strip()
    if body.related_module is not None:
        doc.related_module = body.related_module.strip()
    if body.priority is not None:
        doc.priority = body.priority.lower().strip()
    if body.processing_instructions is not None:
        doc.processing_instructions = body.processing_instructions.strip()

    doc.updated_at = utcnow()
    db.commit()
    db.refresh(doc)

    audit.record(db, p.id, "document.updated", "document", doc.id, doc.filename, doc.project_id)

    req_count = db.execute(
        select(func.count(Requirement.id)).where(Requirement.document_id == doc.id)
    ).scalar() or 0
    return S.document(doc, requirements_count=req_count)


@router.post("/documents/{document_id}/retry")
def retry_document_process(
    document_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    # Increment retry count
    meta = dict(doc.metadata_json or {})
    meta["retry_count"] = meta.get("retry_count", 0) + 1
    doc.metadata_json = meta
    doc.upload_status = "queued"
    doc.extraction_status = "queued"
    db.commit()

    reprocess_res = reprocess_document_and_requirements(db, doc.id, author_id=p.id)
    updated_doc = db.get(Document, doc.id) or doc
    audit.record(db, p.id, "document.retried", "document", doc.id, doc.filename, doc.project_id, reprocess_res)

    req_count = db.execute(
        select(func.count(Requirement.id)).where(Requirement.document_id == doc.id)
    ).scalar() or 0
    return S.document(updated_doc, requirements_count=req_count)


@router.get("/documents/{document_id}/jobs")
def list_document_jobs(
    document_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    get_project_checked(db, p, doc.project_id)

    jobs = db.execute(
        select(DocumentProcessingJob)
        .where(DocumentProcessingJob.document_id == document_id)
        .order_by(DocumentProcessingJob.created_at.desc())
    ).scalars().all()
    return [S.document_processing_job(j) for j in jobs]


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
        filename=doc.display_name or doc.filename,
        media_type=media_type,
    )


@router.get("/documents/{document_id}/extracted-content")
def get_document_extracted_content(
    document_id: int,
    db: Session = Depends(get_db),
    p: Principal = Depends(current_principal),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise NotFound(f"Document {document_id} not found")
    if doc.project_id is not None:
        get_project_checked(db, p, doc.project_id)

    items = db.execute(
        select(ExtractedContent)
        .where(ExtractedContent.document_id == document_id)
        .order_by(ExtractedContent.id.asc())
    ).scalars().all()

    return [S.extracted_content(it) for it in items]


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

    reprocess_res = reprocess_document_and_requirements(db, doc.id, author_id=p.id)
    updated_doc = db.get(Document, doc.id) or doc
    audit.record(db, p.id, "document.processed", "document", doc.id, doc.filename, doc.project_id, reprocess_res)

    req_count = db.execute(
        select(func.count(Requirement.id)).where(Requirement.document_id == doc.id)
    ).scalar() or 0
    return S.document(updated_doc, requirements_count=req_count)


@router.post("/projects/{project_id}/process-all", status_code=200)
@router.post("/projects/{project_id}/documents/process-all", status_code=200)
def process_all_documents(
    project_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    get_project_checked(db, p, project_id)
    return process_all_project_documents_and_requirements(db, project_id, author_id=p.id)


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
