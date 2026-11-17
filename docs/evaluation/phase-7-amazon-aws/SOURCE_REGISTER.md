# Source Document Register & Provenance Ledger
## Phase 7 — Amazon AWS Independent Real-World Document Evaluation

**Target Organization:** Amazon Web Services (AWS)  
**Evaluation Type:** Independent Empirical QA Benchmark  
**Date of Acquisition:** November 17, 2026  
**Storage Directory:** `docs/evaluation/phase-7-amazon-aws/source-documents/`  
**Manifest:** `docs/evaluation/phase-7-amazon-aws/source_manifest.json`

---

## 1. Document Inventory & Cryptographic Hashes

| Document ID | Official Title | File Format | File Size | SHA-256 Checksum | Origin URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DOC-AWS-01** | AWS Well-Architected Framework — Security Pillar | PDF (240 pages) | 2,854,291 bytes | `7e2a463a43b6f3bfb94776512845203254e220b88fbe36d88158c8c7a169a382` | `https://docs.aws.amazon.com/pdfs/wellarchitected/latest/security-pillar/wellarchitected-security-pillar.pdf` |
| **DOC-AWS-02** | Security Best Practices for Amazon S3 | HTML (18 sections) | 73,549 bytes | `3b6def5e219dc2b38041e775d2910853736935b23cb0dc4544e6b8557b0b68a8` | `https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html` |
| **DOC-AWS-03** | Security Hub CSPM Controls for Amazon S3 | HTML (42 controls) | 75,915 bytes | `991e147461b865628514666c1ee66a7f6815dea836b9a5563551d7a36118523f` | `https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html` |

---

## 2. Document Descriptions & Scope

### 2.1 DOC-AWS-01: AWS Well-Architected Framework — Security Pillar
- **Publication Authority:** Amazon Web Services, Inc.
- **Coverage:** Architectural principles and best practice questions spanning the five foundational disciplines of cloud security:
  - **SEC01–SEC03:** Identity and Access Management (Least privilege, emergency access, temporary credentials).
  - **SEC04–SEC05:** Detection & Monitoring (Centralized logging, GuardDuty threat detection, automated alerting).
  - **SEC06:** Infrastructure Protection (Boundary protection, network segregation, ingress/egress filtering).
  - **SEC07–SEC09:** Data Protection (Encryption in transit, encryption at rest, data classification, tokenization).
  - **SEC10–SEC11:** Incident Response (Preparation, automated containment, post-incident forensic analysis).

### 2.2 DOC-AWS-02: Security Best Practices for Amazon S3
- **Publication Authority:** Amazon Web Services Amazon Simple Storage Service User Guide.
- **Coverage:** Prescriptive guidelines for preventing accidental data exposure, implementing access control lists (ACLs) deprecation, enforcing Amazon S3 Block Public Access (BPA) at account and bucket level, implementing Bucket Policies with TLS-only enforcement (`aws:SecureTransport`), MFA Delete, object lifecycle policies, and AWS KMS Customer Managed Keys (CMK).

### 2.3 DOC-AWS-03: Security Hub CSPM Controls for Amazon S3
- **Publication Authority:** AWS Security Hub User Guide.
- **Coverage:** 42 codified Cloud Security Posture Management (CSPM) control definitions, rule logic, remediation steps, and evaluation criteria for compliance standards (AWS Foundational Security Best Practices v1.0.0, CIS AWS Foundations Benchmark, and PCI DSS v3.2.1).

---

## 3. Provenance & Integrity Statement

All documents in this register are authentic, public, unmodified original files fetched directly from Amazon Web Services documentation endpoints on November 17, 2026. Cryptographic SHA-256 checksums are recorded prior to any ingestion and verified across repeated executions to ensure complete evaluation reproducibility.
