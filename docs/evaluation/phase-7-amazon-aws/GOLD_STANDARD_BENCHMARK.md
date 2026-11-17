# Gold Standard Quality Benchmark
## Phase 7 — Amazon AWS Independent Real-World Document Evaluation

**Target Organization:** Amazon Web Services (AWS)  
**Evaluation Scope:** Cloud Security, Well-Architected Framework, S3 Storage Governance  
**Benchmark Version:** 1.0.0  
**Evaluator:** Principal QA Architect & AI Benchmark Auditor  
**Date:** November 17, 2026  
**Total Assertions:** 32 Ground-Truth Assertions  
**JSON Machine Ledger:** `docs/evaluation/phase-7-amazon-aws/gold_standard.json`  
**Adjudication Log:** `docs/evaluation/phase-7-amazon-aws/HUMAN_ADJUDICATION_LOG.md`

---

## 1. Benchmark Composition & Category Distribution

| Category | Assertions | Mandatory | Recommended | Optional | Minimum Requirement | Compliance Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **IAM & Access Control** | 6 | 6 | 0 | 0 | $\ge 6$ | **Exceeded** (6/6) |
| **Detection & Monitoring** | 6 | 4 | 2 | 0 | $\ge 5$ | **Exceeded** (6/5) |
| **Data Protection & S3 Security** | 10 | 6 | 3 | 1 | $\ge 9$ | **Exceeded** (10/9) |
| **Incident Response & Infrastructure** | 5 | 3 | 2 | 0 | $\ge 5$ | **Satisfied** (5/5) |
| **Audit & Governance** | 5 | 3 | 2 | 0 | $\ge 5$ | **Satisfied** (5/5) |
| **Total** | **32** | **22** | **9** | **1** | $\mathbf{\ge 30}$ | **Exceeded** (32/30) |

---

## 2. Assertion Catalog & Verbatim Grounding

### 2.1 Identity and Access Management (IAM)

#### `AWS-SEC-GS-001`: Centralized Identity Management
- **Category:** IAM & Access Control
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC01: Manage identity and permissions*
- **Verbatim Quote:**  
  > "Rely on a centralized identity provider: You should manage user identities centrally through an identity provider (IdP). This makes it easier to manage access across multiple applications and services."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Workloads must integrate with AWS IAM Identity Center or corporate SAML 2.0 / OIDC IdP rather than creating standalone IAM users with permanent access keys.
- **Expected Test Type:** Security / Boundary
- **Rationale:** Centralization enables instant employee offboarding, unified MFA policies, and eliminates orphaned credentials.

#### `AWS-SEC-GS-002`: Mandatory Multi-Factor Authentication
- **Category:** IAM & Access Control
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC02: Use temporary credentials*
- **Verbatim Quote:**  
  > "Require multi-factor authentication (MFA): Require MFA for all identities in your organization. MFA adds an extra layer of protection on top of a user name and password."
- **Normative Strength:** Mandatory
- **Verification Criteria:** All console and programmatic operator identities must enforce hardware token, TOTP, or FIDO2/WebAuthn second factor.
- **Expected Test Type:** Positive / Negative
- **Rationale:** Prevents credential stuffing and phishing-induced account takeover.

#### `AWS-SEC-GS-003`: Least Privilege Permissions Scoping
- **Category:** IAM & Access Control
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC03: Grant least privilege access*
- **Verbatim Quote:**  
  > "Grant least privilege: Enforce requirements across every interaction. Grant only the permissions required to perform a task."
- **Normative Strength:** Mandatory
- **Verification Criteria:** IAM policy statements must define specific Action and Resource ARNs; unrestricted wildcard `Action: "*"` on `Resource: "*"` is strictly prohibited.
- **Expected Test Type:** Boundary / Negative
- **Rationale:** Limits lateral movement and damages if an identity token is compromised.

#### `AWS-SEC-GS-004`: Short-Lived Temporary Credentials
- **Category:** IAM & Access Control
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC02: Manage temporary credentials*
- **Verbatim Quote:**  
  > "Use temporary credentials: Use temporary credentials instead of long-term access keys. AWS Security Token Service (AWS STS) provides short-term credentials."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Microservices, automated tasks, and CI/CD pipelines must assume IAM roles using AWS STS with session lifetimes $\le 1$ hour.
- **Expected Test Type:** Security
- **Rationale:** Completely eliminates persistent static access keys from source trees and server environments.

#### `AWS-SEC-GS-005`: Root Account Lockdown & Non-Usage
- **Category:** IAM & Access Control
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC01: Manage root user credentials*
- **Verbatim Quote:**  
  > "Protect root credentials: The root user has complete access to all AWS resources in the account. Do not use the root user for everyday tasks, and secure it with multi-factor authentication."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Root account must have zero active access keys, hardware MFA enabled, and CloudWatch alarm triggers on root login events.
- **Expected Test Type:** Negative / Security
- **Rationale:** Root identity possesses un-scopable authority; misuse can result in total account destruction.

#### `AWS-SEC-GS-006`: IAM Roles for Application & S3 Access
- **Category:** IAM & Access Control
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Identity and access management for Amazon S3*
- **Verbatim Quote:**  
  > "Use IAM roles for applications and AWS services that require Amazon S3 access: Do not embed AWS credentials in application code or on instances."
- **Normative Strength:** Mandatory
- **Verification Criteria:** EC2, ECS tasks, and EKS pods accessing S3 must utilize IAM instance profiles or IAM Roles for Service Accounts (IRSA).
- **Expected Test Type:** Security / Positive
- **Rationale:** Avoids plain-text credential storage in disk files, containers, or environment variables.

---

### 2.2 Detection and Monitoring

#### `AWS-SEC-GS-007`: Multi-Region CloudTrail Audit Logging
- **Category:** Detection & Monitoring
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC04: Configure service and application logging*
- **Verbatim Quote:**  
  > "Enable AWS CloudTrail: Enable AWS CloudTrail across all Regions to capture management and data events. Store log files in an S3 bucket that is dedicated to log storage and protected from tampering."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Multi-Region CloudTrail trail active in every account, log file integrity validation enabled, writing to a dedicated log bucket.
- **Expected Test Type:** Positive / Security
- **Rationale:** Fundamental evidentiary ledger for control-plane audits, forensics, and intrusion detection.

#### `AWS-SEC-GS-008`: Log Storage Tamper-Resistance & Immutability
- **Category:** Detection & Monitoring
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC04: Capture logs centrally*
- **Verbatim Quote:**  
  > "Protect log storage: Prevent modification or deletion of log files by using access control mechanisms, encryption, and object locking."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Central audit log bucket enforces S3 Object Lock (Compliance mode) or MFA Delete, denying `s3:DeleteObject` even to account admins.
- **Expected Test Type:** Security / Boundary
- **Rationale:** Prevents adversaries from erasing audit logs to conceal operational intrusion.

#### `AWS-SEC-GS-009`: Continuous Threat Detection with GuardDuty
- **Category:** Detection & Monitoring
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC05: Automate threat detection*
- **Verbatim Quote:**  
  > "Enable automated threat detection: Use services like Amazon GuardDuty to continuously monitor for malicious activity and unauthorized behavior."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Amazon GuardDuty enabled across all organizational accounts and active AWS Regions.
- **Expected Test Type:** Positive
- **Rationale:** Uses machine learning and DNS/flow log analysis to alert on compromised instances, anomalous IAM access, and crypto-mining activity.

#### `AWS-SEC-GS-010`: S3 Server Access Logging
- **Category:** Detection & Monitoring
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Logging and monitoring in Amazon S3*
- **Verbatim Quote:**  
  > "Enable server access logging: Server access logging provides detailed records for the requests that are made to a bucket."
- **Normative Strength:** Recommended
- **Verification Criteria:** S3 buckets housing sensitive production records must have Server Access Logging enabled, targeting a distinct logging bucket.
- **Expected Test Type:** Positive
- **Rationale:** Granular visibility into individual GET, PUT, and DELETE operations, client IPs, and HTTP response codes.

#### `AWS-SEC-GS-011`: Automated Real-Time S3 Event Notifications
- **Category:** Detection & Monitoring
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.11] S3 buckets should have event notifications enabled*
- **Verbatim Quote:**  
  > "This control checks whether an Amazon S3 bucket has event notifications enabled. The control fails if notifications are not configured."
- **Normative Strength:** Recommended
- **Verification Criteria:** Production S3 buckets publish event messages (SNS/SQS/EventBridge) for object lifecycle events.
- **Expected Test Type:** Positive
- **Rationale:** Enables instant, zero-delay security analysis pipelines and malware scanning triggers.

#### `AWS-SEC-GS-012`: VPC Flow Log Telemetry Capture
- **Category:** Detection & Monitoring
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC04: Capture network telemetry*
- **Verbatim Quote:**  
  > "Capture VPC Flow Logs: Enable VPC Flow Logs to monitor IP traffic going to and from network interfaces in your VPC."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Flow logging active for all production subnets and ENIs, logging ACCEPT and REJECT IP traffic.
- **Expected Test Type:** Positive
- **Rationale:** Allows network incident investigation, port-scan detection, and data exfiltration path verification.

---

### 2.3 Data Protection & S3 Security

#### `AWS-SEC-GS-013`: Universal S3 Block Public Access (BPA)
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Block Public Access (BPA)*
- **Verbatim Quote:**  
  > "Use Amazon S3 Block Public Access: Amazon S3 Block Public Access settings override any other S3 permissions, allowing you to limit public access to your buckets and objects."
- **Normative Strength:** Mandatory
- **Verification Criteria:** All 4 BPA flags enabled at both AWS account and individual bucket levels: `BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`.
- **Expected Test Type:** Security / Boundary
- **Rationale:** Universal safety net preventing inadvertent public exposure of corporate data.

#### `AWS-SEC-GS-014`: Security Hub S3.1 Public Access Compliance
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.1] S3 general purpose buckets should have block public access settings enabled*
- **Verbatim Quote:**  
  > "This control checks whether your Amazon S3 general purpose buckets have block public access settings enabled."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Security Hub automated scanner registers PASS for control S3.1 on all general-purpose buckets.
- **Expected Test Type:** Negative / Compliance
- **Rationale:** Standardized benchmark requirement across CIS AWS Foundations and AWS FSBP.

#### `AWS-SEC-GS-015`: Mandatory In-Transit Encryption via TLS
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.5] S3 general purpose buckets should require requests to use TLS*
- **Verbatim Quote:**  
  > "This control checks whether Amazon S3 general purpose buckets require requests to use Transport Layer Security (TLS). The control fails if the bucket policy does not require HTTPS."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Bucket policy includes explicit Deny statement where `"aws:SecureTransport": "false"`.
- **Expected Test Type:** Security / Negative
- **Rationale:** Rejects unencrypted HTTP connections, preventing network eavesdropping or session tampering.

#### `AWS-SEC-GS-016`: Server-Side Encryption at Rest (SSE)
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Protecting data with encryption*
- **Verbatim Quote:**  
  > "Encrypt data at rest: Encrypt data stored in Amazon S3 using server-side encryption with Amazon S3 managed keys (SSE-S3), AWS KMS keys (SSE-KMS), or customer-provided keys (SSE-C)."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Default bucket encryption is active using AES-256 (SSE-S3) or AWS KMS with customer-managed keys (CMK).
- **Expected Test Type:** Positive
- **Rationale:** Ensures data cannot be read directly from raw storage drives without cryptographic keys.

#### `AWS-SEC-GS-017`: Block Public Write Access to S3
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.8] S3 general purpose buckets should block public write access*
- **Verbatim Quote:**  
  > "This control checks whether your Amazon S3 general purpose buckets block public write access."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Anonymous HTTP PUT, POST, or DELETE requests are rejected with HTTP 403 Forbidden.
- **Expected Test Type:** Negative / Boundary
- **Rationale:** Blocks unauthorized actors from planting ransomware or staging malicious payloads.

#### `AWS-SEC-GS-018`: S3 Object Versioning for Recovery
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Using Amazon S3 versioning*
- **Verbatim Quote:**  
  > "Enable versioning: Versioning protects against accidental overwrites and deletions by keeping multiple variants of an object in the same bucket."
- **Normative Strength:** Recommended
- **Verification Criteria:** Bucket versioning status is `Enabled`; overwritten or deleted objects maintain historical versions.
- **Expected Test Type:** Positive
- **Rationale:** Instant rollback from accidental deletion, application logic errors, or malicious overwrites.

#### `AWS-SEC-GS-019`: MFA Delete for Versioned Buckets
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Using MFA delete*
- **Verbatim Quote:**  
  > "Enable MFA Delete: MFA Delete adds another layer of security if your bucket versioning is enabled. It requires authentication with an MFA device to change bucket versioning or permanently delete an object version."
- **Normative Strength:** Recommended
- **Verification Criteria:** Attempting to purge an object version without passing MFA tokens fails with AccessDenied.
- **Expected Test Type:** Security / Boundary
- **Rationale:** Thwarts rogue administrators or compromised privileged tokens from destroying backup history.

#### `AWS-SEC-GS-020`: S3 Object Lock for WORM Compliance
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Using Amazon S3 Object Lock*
- **Verbatim Quote:**  
  > "Use Amazon S3 Object Lock: Object Lock can help you meet regulatory requirements that require Write Once, Read Many (WORM) storage, or add an extra layer of protection against object changes and deletions."
- **Normative Strength:** Recommended
- **Verification Criteria:** Buckets holding statutory financial or health records have Object Lock configured in Compliance mode with retention schedules.
- **Expected Test Type:** Boundary / Positive
- **Rationale:** Meets SEC 17a-4, CFTC, and FINRA compliance requirements for non-rewritable storage.

#### `AWS-SEC-GS-021`: Disabling Legacy S3 Access Control Lists (ACLs)
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Managing access with ACLs*
- **Verbatim Quote:**  
  > "Disable access control lists (ACLs): AWS recommends that you disable ACLs and use bucket policies to control access to your buckets and objects."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Bucket ownership controls specify `ObjectOwnership: BucketOwnerEnforced`, disabling object ACLs entirely.
- **Expected Test Type:** Security
- **Rationale:** Unifies security controls under IAM and Bucket Policies, removing ACL privilege escalation risks.

#### `AWS-SEC-GS-022`: S3 Cross-Region Replication (CRR)
- **Category:** Data Protection & S3 Security
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.17] S3 general purpose buckets should have cross-Region replication enabled*
- **Verbatim Quote:**  
  > "This control checks whether cross-Region replication is enabled for your Amazon S3 general purpose buckets."
- **Normative Strength:** Optional
- **Verification Criteria:** Replicated objects are automatically synchronized to a geographically separated target bucket in another AWS Region with re-encryption.
- **Expected Test Type:** Positive
- **Rationale:** Ensures disaster recovery continuity and compliance with regional sovereignty requirements.

---

### 2.4 Incident Response & Infrastructure Protection

#### `AWS-SEC-GS-023`: Documented Incident Response Playbooks
- **Category:** Incident Response & Infrastructure Protection
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC10: Prepare for incident response*
- **Verbatim Quote:**  
  > "Develop incident response playbooks: Create step-by-step playbooks for your organization's most common security incidents to ensure consistent, effective response."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Runbooks exist for credential compromise, S3 data exfiltration, and ransomware alerts with clear escalation steps.
- **Expected Test Type:** Positive
- **Rationale:** Drastically reduces MTTR and prevents panic-induced operational mistakes during an incident.

#### `AWS-SEC-GS-024`: Automated Incident Containment & Isolation
- **Category:** Incident Response & Infrastructure Protection
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC10: Isolate compromised resources*
- **Verbatim Quote:**  
  > "Automate containment: Use automated scripts or AWS Step Functions to quarantine compromised resources, revoke credentials, and isolate network segments."
- **Normative Strength:** Recommended
- **Verification Criteria:** Automated EventBridge rules trigger Step Functions to quarantine instances, invalidate IAM sessions, and take EBS snapshots upon high-severity alert.
- **Expected Test Type:** Security / Boundary
- **Rationale:** Stops active exfiltration within seconds without waiting for human triage.

#### `AWS-SEC-GS-025`: Private Network Connectivity via VPC Endpoints
- **Category:** Incident Response & Infrastructure Protection
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC06: Protect compute and network boundaries*
- **Verbatim Quote:**  
  > "Implement layered defense: Apply security controls at multiple layers of your workload, such as edge networks, VPC endpoints, and compute instances."
- **Normative Strength:** Mandatory
- **Verification Criteria:** VPC S3 Gateway Endpoints configured with Endpoint Policies; internal services communicate with S3 without public internet routing.
- **Expected Test Type:** Security / Positive
- **Rationale:** Eliminates public internet traversal, MitM vectors, and internet gateway dependency.

#### `AWS-SEC-GS-026`: Edge & Web Application Firewall (WAF) Inspection
- **Category:** Incident Response & Infrastructure Protection
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC06: Reduce attack surface*
- **Verbatim Quote:**  
  > "Enforce inspection and protection: Use network firewalls, such as AWS Network Firewall or web application firewalls like AWS WAF, to inspect incoming and outgoing traffic."
- **Normative Strength:** Mandatory
- **Verification Criteria:** CloudFront distributions and ALBs have AWS WAF WebACLs attached with Core Rule Set (CRS) and IP rate-limiting rules.
- **Expected Test Type:** Positive / Boundary
- **Rationale:** Protects against OWASP Top 10 vulnerabilities, automated scanners, and DDoS attempts.

#### `AWS-SEC-GS-027`: Security Simulation & Game Days
- **Category:** Incident Response & Infrastructure Protection
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC11: Simulate incident response*
- **Verbatim Quote:**  
  > "Run game days: Regularly test your incident response procedures through simulated events and game days to identify gaps in tools and processes."
- **Normative Strength:** Recommended
- **Verification Criteria:** Scheduled security game days and breach simulations documented with post-mortem gap analysis.
- **Expected Test Type:** Positive
- **Rationale:** Ensures personnel, telemetry alerts, and automated playbooks execute reliably under real pressure.

---

### 2.5 Audit & Governance

#### `AWS-SEC-GS-028`: IAM Credential Lifecycle & Stale Key Rotation
- **Category:** Audit & Governance
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC01: Manage identity lifecycle*
- **Verbatim Quote:**  
  > "Regularly audit credentials: Audit and rotate credentials periodically. Identify and deactivate unused credentials to reduce the risk of compromised credentials."
- **Normative Strength:** Mandatory
- **Verification Criteria:** IAM credential report audit flags any active access key older than 90 days or unused for $\ge 45$ days for automatic deactivation.
- **Expected Test Type:** Boundary / Positive
- **Rationale:** Shrinks the vulnerability window for forgotten or exfiltrated API keys.

#### `AWS-SEC-GS-029`: S3 Lifecycle Configuration Policies
- **Category:** Audit & Governance
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.13] S3 general purpose buckets should have lifecycle policies configured*
- **Verbatim Quote:**  
  > "This control checks whether an Amazon S3 general purpose bucket has a lifecycle configuration rule. The control fails if no lifecycle rules are active."
- **Normative Strength:** Recommended
- **Verification Criteria:** S3 buckets implement lifecycle transitions (Standard $\to$ Infrequent Access $\to$ Glacier) and abort incomplete multipart uploads after 7 days.
- **Expected Test Type:** Positive
- **Rationale:** Enforces corporate retention limits and purges abandoned multipart data.

#### `AWS-SEC-GS-030`: Multi-Account Guardrails via Service Control Policies (SCPs)
- **Category:** Audit & Governance
- **Source Document:** `DOC-AWS-01` (Security Pillar), Section: *SEC01: Enforce organizational policies*
- **Verbatim Quote:**  
  > "Use service control policies (SCPs): Use SCPs in AWS Organizations to enforce central permission guardrails across all accounts in your organization."
- **Normative Strength:** Mandatory
- **Verification Criteria:** Root SCP denies member accounts from disabling CloudTrail, modifying GuardDuty detectors, or removing S3 Block Public Access.
- **Expected Test Type:** Security / Boundary
- **Rationale:** Prevents sub-account compromise from eroding organization-wide governance controls.

#### `AWS-SEC-GS-031`: Automated Sensitive Data Discovery with Amazon Macie
- **Category:** Audit & Governance
- **Source Document:** `DOC-AWS-02` (S3 Best Practices), Section: *Classifying sensitive data with Amazon Macie*
- **Verbatim Quote:**  
  > "Use Amazon Macie to discover sensitive data: Amazon Macie uses machine learning and pattern matching to discover and protect sensitive data in Amazon S3."
- **Normative Strength:** Recommended
- **Verification Criteria:** Automated Macie discovery jobs actively scan S3 buckets and alert upon finding PII, credit cards, or credentials.
- **Expected Test Type:** Positive
- **Rationale:** Discovers shadow sensitive data before regulators or malicious actors do.

#### `AWS-SEC-GS-032`: Elimination of S3 Access Control Lists (Security Hub S3.12)
- **Category:** Audit & Governance
- **Source Document:** `DOC-AWS-03` (Security Hub S3 Controls), Section: *[S3.12] S3 general purpose buckets should prohibit ACLs*
- **Verbatim Quote:**  
  > "This control checks whether Amazon S3 general purpose buckets prohibit access control lists (ACLs). The control passes if Object Ownership is set to Bucket owner enforced."
- **Normative Strength:** Mandatory
- **Verification Criteria:** S3 bucket configuration returns PASS for S3.12; attempts to write object ACLs return `AccessControlListNotSupported`.
- **Expected Test Type:** Negative / Compliance
- **Rationale:** Ensures ownership of all objects defaults to bucket owner, ending split-ownership vulnerabilities.

