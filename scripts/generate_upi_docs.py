#!/usr/bin/env python3
"""Generate authentic regulatory documents for the UPI Dispute & Customer Protection Platform.

Produces:
1. data/upi_sample_docs/RBI_Harmonisation_TAT_Failed_Transactions_Compensation.pdf (ReportLab binary PDF)
2. data/upi_sample_docs/RBI_Integrated_Ombudsman_Scheme_2026.docx (python-docx Word document)
3. data/upi_sample_docs/RBI_Commercial_Banks_Responsible_Business_Conduct_Directions.pdf (ReportLab binary PDF)
"""
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "upi_sample_docs"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def create_rbi_tat_circular_pdf():
    pdf_path = OUT_DIR / "RBI_Harmonisation_TAT_Failed_Transactions_Compensation.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        "GovHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        alignment=1,  # Center
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    sub_header = ParagraphStyle(
        "GovSubHeader",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=1,
        textColor=colors.HexColor("#475569"),
        spaceAfter=14,
    )
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1E3A8A"),
        spaceAfter=10,
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=8,
    )
    clause_title = ParagraphStyle(
        "ClauseTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=8,
        spaceAfter=4,
    )

    story = []

    story.append(Paragraph("RESERVE BANK OF INDIA", header_style))
    story.append(Paragraph("Department of Payment and Settlement Systems, Central Office, Mumbai", sub_header))
    story.append(Spacer(1, 6))

    meta_text = "<b>Notification No:</b> RBI/2019-20/67 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Ref:</b> DPSS.CO.PD No.629/02.01.014/2019-20<br/>" \
                "<b>Date:</b> September 20, 2019 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Effective Date:</b> October 15, 2019<br/>" \
                "<b>Target Entities:</b> All Scheduled Commercial Banks, Payments Banks, UPI System Participants, NPCI"
    story.append(Paragraph(meta_text, body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Harmonisation of Turn Around Time (TAT) and Customer Compensation for Failed Transactions using Authorised Payment Systems", title_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>1. Background and Objectives</b>", clause_title))
    story.append(Paragraph(
        "A large number of customer complaints accrue on account of failed transactions. In order to bring uniformity in the Turn Around Time (TAT) for reversal of failed transactions and to enhance customer confidence in electronic payment systems including Unified Payments Interface (UPI), the Reserve Bank of India, in exercise of its powers under Section 10(2) read with Section 18 of the Payment and Settlement Systems Act, 2007 (Act 51 of 2007), has determined the TAT and compensation framework detailed herein.",
        body_style
    ))

    story.append(Paragraph("<b>2. Definition of 'Failed Transaction' and General Principles</b>", clause_title))
    story.append(Paragraph(
        "A 'failed transaction' is a transaction which has not been fully completed owing to system failures, communication links timeout, or bank host unavailability, but where the customer's account has been debited. All transactions where financial debit has transpired from the customer's account without delivery of funds to the beneficiary or merchant shall qualify as failed transactions.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Clause 2.1:</b> The principle of customer protection dictates that wherever financial reversal is delayed beyond the prescribed TAT, the customer shall be compensated automatically without requiring the customer to lodge a claim or complaint.",
        body_style
    ))

    story.append(Paragraph("<b>3. Turn Around Time (TAT) and Compensation Schedule for UPI</b>", clause_title))

    # Table of TAT specifications
    table_data = [
        [
            Paragraph("<b>Sl. No.</b>", body_style),
            Paragraph("<b>Transaction Category & Scenario</b>", body_style),
            Paragraph("<b>Turn Around Time (TAT)</b>", body_style),
            Paragraph("<b>Mandatory Compensation for Delay</b>", body_style)
        ],
        [
            Paragraph("<b>1</b>", body_style),
            Paragraph("<b>UPI Person to Person (P2P):</b><br/>Account debited but beneficiary account not credited due to host timeout or network drop.", body_style),
            Paragraph("Auto-reversal by Remitter Bank within <b>T + 1 calendar day</b>.", body_style),
            Paragraph("<b>₹100 per day</b> of delay beyond T + 1 day payable directly to customer account.", body_style)
        ],
        [
            Paragraph("<b>2</b>", body_style),
            Paragraph("<b>UPI Person to Merchant (P2M):</b><br/>Account debited but payment confirmation not received at merchant checkout or POS terminal.", body_style),
            Paragraph("Auto-reversal by Remitter / Acquiring Bank within <b>T + 1 calendar day</b>.", body_style),
            Paragraph("<b>₹100 per day</b> of delay beyond T + 1 day payable directly to customer account.", body_style)
        ],
        [
            Paragraph("<b>3</b>", body_style),
            Paragraph("<b>UPI Auto-Pay / Recurring Mandate:</b><br/>Mandate execution debited without merchant acknowledgement or service delivery.", body_style),
            Paragraph("Auto-reversal within <b>T + 1 calendar day</b> from mandate trigger.", body_style),
            Paragraph("<b>₹100 per day</b> of delay beyond T + 1 day payable directly to customer account.", body_style)
        ],
        [
            Paragraph("<b>4</b>", body_style),
            Paragraph("<b>Beneficiary Bank Processing:</b><br/>Beneficiary Bank unable to credit customer due to dormant or frozen account.", body_style),
            Paragraph("Return funds to Remitter Bank within <b>T + 1 calendar day</b>.", body_style),
            Paragraph("Beneficiary Bank liable to pay compensation if return instruction is delayed beyond T+1.", body_style)
        ]
    ]

    table = Table(table_data, colWidths=[36, 210, 124, 134])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor("#0F172A")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>4. Mandatory Operational Invariants</b>", clause_title))
    story.append(Paragraph(
        "<b>Clause 4.1 (Proactive Credit):</b> Compensation must be calculated and credited to the customer's account automatically by the responsible bank without insisting on a customer complaint or grievance registration.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Clause 4.2 (Apportionment of Liability):</b> Where delay occurs between remitter, switch (NPCI), and beneficiary, compensation shall be initially settled by the remitter bank to the customer, followed by inter-bank netting and dispute settlement as per NPCI clearing rules.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Clause 4.3 (Reporting & Audit):</b> Banks shall maintain an immutable electronic ledger of all failed UPI transactions, auto-reversals, compensation calculations, and payment timestamps. Quarterly compliance reports must be submitted to the Board and the Reserve Bank.",
        body_style
    ))

    doc.build(story)
    print(f"Generated: {pdf_path}")


def create_rbi_ombudsman_scheme_docx():
    docx_path = OUT_DIR / "RBI_Integrated_Ombudsman_Scheme_2026.docx"
    doc = docx.Document()

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_org = p_title.add_run("RESERVE BANK OF INDIA\n")
    run_org.bold = True
    run_org.font.size = Pt(13)
    run_org.font.color.rgb = RGBColor(15, 23, 42)

    run_sub = p_title.add_run("Consumer Education and Protection Department, Central Office, Mumbai\n")
    run_sub.font.size = Pt(10)
    run_sub.font.color.rgb = RGBColor(71, 85, 105)

    run_name = p_title.add_run("The Reserve Bank - Integrated Ombudsman Scheme, 2026 (Consolidated Framework)\n")
    run_name.bold = True
    run_name.font.size = Pt(14)
    run_name.font.color.rgb = RGBColor(30, 58, 138)

    # Metadata
    p_meta = doc.add_paragraph()
    p_meta.add_run("Framework Version: 2.1 | Applicable from: January 1, 2026 | Authority: Section 35A Banking Regulation Act, 1949\n").italic = True
    p_meta.add_run("Regulated Entities Covered: All Commercial Banks, Payments Banks, Small Finance Banks, NBFCs, System Participants\n")

    # Section 1
    doc.add_heading("CHAPTER I — PRELIMINARY", level=2)
    p = doc.add_paragraph()
    p.add_run("Clause 1.1: Short Title and Commencement — This Scheme shall be called the Reserve Bank - Integrated Ombudsman Scheme, 2026. It integrates and supersedes the Banking Ombudsman Scheme, 2006, the Ombudsman Scheme for NBFCs, 2018, and the Ombudsman Scheme for Digital Transactions, 2019.")

    doc.add_heading("CHAPTER II — GROUNDS OF COMPLAINT AND JURISDICTION", level=2)
    p = doc.add_paragraph()
    p.add_run("Clause 8.1: Grounds for Filing Complaint — Any customer may file a complaint before the Ombudsman against a Regulated Entity (RE) for deficiency in service, including:\n")
    p.add_run("  (a) Non-adherence to RBI directives on failed digital transactions, delay in reversal beyond T+1, or non-payment of mandated compensation of ₹100/day under the Harmonisation TAT circular;\n")
    p.add_run("  (b) Unauthorized electronic banking or UPI debits where the bank has failed to apply the Zero Liability or Limited Liability framework;\n")
    p.add_run("  (c) Refusal or failure to provide shadow credit or provisional reversal within 10 working days of complaint;\n")
    p.add_run("  (d) Lack of adequate electronic response channel to block UPI handles or report unauthorized transactions;\n")
    p.add_run("  (e) Unreasonable delay or rejection of dispute without reasoned communication from the Internal Ombudsman.")

    doc.add_heading("CHAPTER III — PROCEDURE FOR LODGING COMPLAINTS", level=2)
    p = doc.add_paragraph()
    p.add_run("Clause 10.1: Preconditions for Approaching Ombudsman —\n")
    p.add_run("  (i) The complainant had, before making a complaint to the Ombudsman, made a written or electronic complaint to the Regulated Entity concerned;\n")
    p.add_run("  (ii) The complaint was wholly or partly rejected by the Regulated Entity, OR the complainant had not received any reply within thirty (30) calendar days from the date of receipt of the complaint by the RE;\n")
    p.add_run("  (iii) The complaint is made to the Ombudsman within one (1) year after the complainant receives the reply from the RE or within one year and thirty days if no reply was received;\n")
    p.add_run("  (iv) The complaint is not subject to ongoing judicial proceedings or arbitration.")

    doc.add_heading("CHAPTER IV — INTERNAL OMBUDSMAN (IO) GOVERNANCE IN COMMERCIAL BANKS", level=2)
    p = doc.add_paragraph()
    p.add_run("Clause 12.1: Mandatory Internal Ombudsman Concurrence — All Commercial Banks and Payments Banks operating UPI infrastructure shall appoint an independent Internal Ombudsman (IO).\n")
    p.add_run("Clause 12.2: The bank shall NOT reject or partly reject any customer grievance involving failed transactions or unauthorized electronic transactions without prior submission to and formal concurrence from the Internal Ombudsman.\n")
    p.add_run("Clause 12.3: The Principal Nodal Officer (PNO) shall ensure all decisions of the Internal Ombudsman are logged in the central regulatory audit database.")

    doc.add_heading("CHAPTER V — AWARD AND COMPENSATION LIMITS", level=2)
    p = doc.add_paragraph()
    p.add_run("Clause 14.1: Financial Award — The Ombudsman shall have the power to award compensation to the complainant for actual financial loss suffered up to ₹20,00,000 (Twenty Lakhs) or the actual disputed amount, whichever is lower.\n")
    p.add_run("Clause 14.2: Consequential Distress and Harassment Award — In addition to financial loss, the Ombudsman may award an amount not exceeding ₹1,00,000 (One Lakh) for loss of customer's time, harassment, and mental anguish caused by deficient bank operations.\n")
    p.add_run("Clause 14.3: Binding Nature — An Award issued by the Ombudsman shall be binding on the Regulated Entity within thirty (30) days unless an appeal is filed before the Appellate Authority.")

    doc.save(str(docx_path))
    print(f"Generated: {docx_path}")


def create_rbi_conduct_circular_pdf():
    pdf_path = OUT_DIR / "RBI_Commercial_Banks_Responsible_Business_Conduct_Directions.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        "GovHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        alignment=1,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    sub_header = ParagraphStyle(
        "GovSubHeader",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=1,
        textColor=colors.HexColor("#475569"),
        spaceAfter=14,
    )
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1E3A8A"),
        spaceAfter=10,
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=8,
    )
    clause_title = ParagraphStyle(
        "ClauseTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=8,
        spaceAfter=4,
    )

    story = []

    story.append(Paragraph("RESERVE BANK OF INDIA", header_style))
    story.append(Paragraph("Department of Banking Regulation, Central Office, Mumbai", sub_header))
    story.append(Spacer(1, 6))

    meta_text = "<b>Circular Ref:</b> DBR.No.Leg.BC.78/09.07.005/2017-18 & Master Direction 2026<br/>" \
                "<b>Subject:</b> Customer Protection — Limiting Liability of Customers in Unauthorised Electronic Banking Transactions<br/>" \
                "<b>Date:</b> July 6, 2017 (As Updated for Commercial Banks 2026) &nbsp;&nbsp;|&nbsp;&nbsp; <b>Status:</b> Mandatory Regulatory Direction"
    story.append(Paragraph(meta_text, body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Master Direction on Responsible Business Conduct and Customer Liability Limits in Electronic Payment Systems", title_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>1. Framework for Limiting Customer Liability</b>", clause_title))
    story.append(Paragraph(
        "With increased reliance on electronic and mobile payment systems including UPI, banks must establish systems to limit customer liability in unauthorized electronic transactions. Transactions are categorized under three distinct liability regimes:",
        body_style
    ))

    # Table of Liability
    table_data = [
        [
            Paragraph("<b>Category</b>", body_style),
            Paragraph("<b>Trigger & Reporting Condition</b>", body_style),
            Paragraph("<b>Customer Liability Limit</b>", body_style),
            Paragraph("<b>Bank Obligation & Timelines</b>", body_style)
        ],
        [
            Paragraph("<b>Zero Liability</b>", body_style),
            Paragraph("<b>(a) Contributory Fraud:</b> Fraud, negligence, or deficiency on the part of the bank (whether reported by customer or not).<br/>"
                      "<b>(b) Third-Party Breach:</b> Deficiency lies neither with bank nor customer, and customer notifies bank within <b>three (3) working days</b> of receiving communication.", body_style),
            Paragraph("<b>Zero (₹0) Liability</b><br/>Customer suffers no loss.", body_style),
            Paragraph("Shadow reversal / credit to customer account within <b>10 working days</b> of notification.", body_style)
        ],
        [
            Paragraph("<b>Limited Liability</b>", body_style),
            Paragraph("<b>Third-Party Breach with Delayed Reporting:</b> Deficiency lies elsewhere in the system, and customer reporting delay is within <b>four (4) to seven (7) working days</b>.", body_style),
            Paragraph("Capped at:<br/>"
                      "• Basic Savings / UPI: <b>₹5,000</b><br/>"
                      "• Regular Savings / Accounts: <b>₹10,000</b><br/>"
                      "• Credit Card (limit > ₹5L): <b>₹25,000</b>", body_style),
            Paragraph("Excess amount over the capped liability must be credited within <b>10 working days</b>.", body_style)
        ],
        [
            Paragraph("<b>Customer Negligence</b>", body_style),
            Paragraph("Customer has shared payment credentials (OTP, UPI PIN, password).", body_style),
            Paragraph("Customer bears <b>entire loss</b> until unauthorized transaction is reported to the bank.", body_style),
            Paragraph("Any unauthorized transaction occurring <i>after</i> reporting shall be borne 100% by the bank.", body_style)
        ]
    ]

    table = Table(table_data, colWidths=[80, 180, 120, 124])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor("#0F172A")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>2. Mandatory SMS and Email Alerts & Reporting Mechanism</b>", clause_title))
    story.append(Paragraph(
        "<b>Clause 2.1:</b> Banks must provide mandatory SMS and Email alerts for all debit transactions. The alert must carry an immediate response facility (such as a 24x7 toll-free helpline, direct interactive SMS shortcode, or in-app emergency toggle) allowing customers to instantly report unauthorized transactions and block UPI handles.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Clause 2.2:</b> The date and timestamp of receiving customer notification through any channel shall be recorded as the official reporting timestamp for determining whether the 3-day or 4-7 day liability threshold applies.",
        body_style
    ))

    story.append(Paragraph("<b>3. Reversal Timelines and Dispute Resolution</b>", clause_title))
    story.append(Paragraph(
        "<b>Clause 3.1 (Shadow Credit within 10 Days):</b> On reporting of an unauthorized electronic transaction, the bank shall credit the customer's account (shadow credit) within ten (10) working days, without awaiting outcome of insurance claim or external investigation.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Clause 3.2 (90-Day Maximum Resolution Time):</b> The overall dispute investigation and final resolution must not exceed ninety (90) calendar days from the date of customer complaint.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Clause 3.3 (Burden of Proof):</b> The burden of proving customer negligence or credential sharing shall solely lie on the bank. In the absence of conclusive audit logs proving negligence, customer entitlement to Zero/Limited liability stands.",
        body_style
    ))

    doc.build(story)
    print(f"Generated: {pdf_path}")


if __name__ == "__main__":
    create_rbi_tat_circular_pdf()
    create_rbi_ombudsman_scheme_docx()
    create_rbi_conduct_circular_pdf()
    print("All UPI/RBI regulatory documents successfully created in data/upi_sample_docs/")

