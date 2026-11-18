import pytest
from app.services.project_onboarding import (
    normalize_heading_capitalization,
    find_quote_provenance,
    calculate_rule_confidence,
    _synthesize_grounded_rules_from_text,
)


def test_heading_capitalization_and_ligature_normalization():
    # Test ligature normalization (fi, fl) and Title Case with acronym preservation
    raw_heading_1 = "account-level separation is strongly recommended"
    normalized_1 = normalize_heading_capitalization(raw_heading_1)
    assert normalized_1 == "Account-Level Separation Is Strongly Recommended"

    raw_heading_2 = "establish emergency access process with iam and mfa"
    normalized_2 = normalize_heading_capitalization(raw_heading_2)
    assert "IAM" in normalized_2
    assert "MFA" in normalized_2
    assert normalized_2.startswith("Establish Emergency Access")

    # AWS and CISO acronym preservation
    raw_heading_3 = "aws organizations and ciso governance policies"
    normalized_3 = normalize_heading_capitalization(raw_heading_3)
    assert "AWS" in normalized_3
    assert "CISO" in normalized_3

    # Unicode ligatures: \ufb01 (fi) and \ufb02 (fl)
    raw_ligature = "\ufb01xing \ufb02aws in iam security"
    normalized_ligature = normalize_heading_capitalization(raw_ligature)
    assert "Fixing" in normalized_ligature
    assert "Flaws" in normalized_ligature
    assert "IAM" in normalized_ligature


def test_source_page_provenance_physical_vs_printed():
    # Authentic AWS quote for BR-001
    quote_br1 = "Account-level separation is strongly recommended, as it provides a boundary for permissions"
    dummy_text = f"--- [Page 13] ---\nPrinted Page 7\nAWS Account Management and Separation\n{quote_br1}"
    doc_dict = {
        "filename": "wellarchitected-security-pillar.pdf",
        "extracted_text": dummy_text,
        "id": 1067,
    }
    
    prov = find_quote_provenance(quote_br1, doc_dict, [dummy_text])
    assert prov["physical_page_number"] == 13
    assert prov["printed_page_number"] == 7
    assert "Account Management" in prov["section_title"]

    # Authentic AWS quote for BR-007 (Emergency Access SEC03-BP03)
    quote_br7 = "Create a process that allows for emergency access to your workloads in the unlikely event"
    dummy_text_7 = f"--- [Page 73] ---\nPrinted Page 67\nSEC03-BP03 Establish emergency access process\n{quote_br7}"
    doc_dict_7 = {
        "filename": "wellarchitected-security-pillar.pdf",
        "extracted_text": dummy_text_7,
        "id": 1067,
    }
    prov_7 = find_quote_provenance(quote_br7, doc_dict_7, [dummy_text_7])
    assert prov_7["physical_page_number"] == 73
    assert prov_7["printed_page_number"] == 67
    assert "SEC03-BP03" in prov_7["section_title"]


def test_multi_factor_confidence_calculation_no_static_92():
    # Verbatim match on high-confidence rule
    quote = "Account-level separation is strongly recommended"
    doc_text = f"AWS Whitepaper: {quote} for workload isolation."
    
    res = calculate_rule_confidence(
        quote=quote,
        title="Account-Level Separation",
        description="Account-level separation provides a boundary for permissions and billing.",
        rule_type="security_standard",
        is_verified=True,
        source_text=doc_text,
    )

    score = res["confidence"]
    breakdown = res["breakdown"]
    rationale = res["rationale"]

    # Must be transparent 5-factor scoring
    assert "quotation_match" in breakdown
    assert "semantic_support" in breakdown
    assert "classification_certainty" in breakdown
    assert "context_clarity" in breakdown
    assert "extraction_ambiguity" in breakdown
    
    # Must NOT be hardcoded 0.92
    assert score != 0.92
    assert 0.90 <= score <= 0.99
    assert "verbatim grounded" in rationale

    # Non-verbatim or inferred rule score must be capped and lower
    res_inferred = calculate_rule_confidence(
        quote="Non-existent quote that cannot be found in document",
        title="Derived Security Policy",
        description="A synthesized deduction not directly quoted.",
        rule_type="business_rule",
        is_verified=False,
        source_text=doc_text,
    )
    assert res_inferred["confidence"] <= 0.65


def test_synthesized_grounded_rules_and_scenario_traceability():
    # Test on AWS sample text containing account separation and emergency access
    aws_text = """
    AWS Well-Architected Framework Security Pillar
    --- [Page 13] ---
    Account-level separation is strongly recommended, as it provides a boundary for permissions, billing, and isolation.
    --- [Page 73] ---
    SEC03-BP03 Establish emergency access process
    Create a process that allows for emergency access to your workloads in the unlikely event of an issue with your centralized identity provider.
    --- [Page 11] ---
    While AWS manages security OF the cloud, security IN the cloud is the customer's responsibility.
    """
    parsed_docs = [{
        "id": 1067,
        "filename": "wellarchitected-security-pillar.pdf",
        "sha256_hash": "abc123sha",
        "extracted_text": aws_text,
    }]
    
    rules = _synthesize_grounded_rules_from_text(
        parsed_docs=parsed_docs,
        all_source_texts=[aws_text],
    )

    # 1. Check that rules are extracted
    rule_ids = [r["rule_id"] for r in rules]
    assert "BR-001" in rule_ids
    assert "BR-007" in rule_ids

    # 2. Check no titles are truncated with ellipses
    for r in rules:
        assert not r["title"].endswith("...")
        assert not r["title"].endswith("…")
        assert len(r["title"]) > 10

    # 3. Check confidences are varied and not all 0.92
    confidences = [r["confidence"] for r in rules]
    assert len(set(confidences)) > 1  # Not all identical
    assert all(c != 0.92 for c in confidences)

    # 4. Check Emergency Access grounding (BR-007)
    br7 = next(r for r in rules if r["rule_id"] == "BR-007")
    assert "Emergency Access" in br7["title"]
    assert "SEC03-BP03" in br7["clause_ref"] or "SEC03-BP03" in (br7["section_title"] or "")
    assert br7["physical_page_number"] == 73
    assert br7["printed_page_number"] == 67
