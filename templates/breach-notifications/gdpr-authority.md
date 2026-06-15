# GDPR Article 33 — Personal data breach notification to supervisory authority

**Status:** template — fill bracketed fields, run through DPO + legal **before** sending.
**Statute:** GDPR Art.33 (notify supervisory authority within 72 hours).
**Recipient:** Lead supervisory authority (typically the DPA of the EU member
state where you have your main establishment, or where most affected data
subjects reside if you don't have an EU establishment).
**Form:** most DPAs accept submissions via their portal — many also accept
emailed PDF.

---

**Subject:** Personal data breach notification — Article 33 GDPR — Social Stats — Ref {{ incident.reference_number }}

## 1. Controller details

- **Legal entity:** {{ legal_entity_name }}
- **Establishment / address:** {{ address }}
- **Lead supervisory authority:** {{ DPA_name_per_one_stop_shop }}
- **DPO name + contact:** {{ dpo_name }} · {{ dpo_email }}

## 2. Nature of the breach (Art. 33(3)(a))

- **Date + time of breach (UTC):** {{ start_iso }} – {{ end_iso }}
- **Date + time of awareness (UTC):** {{ awareness_iso }}
- **Discovery method:** {{ how_we_found_out — e.g. anomaly alert, customer
  report, security researcher, scan }}
- **Categories of breach:** {{ confidentiality | integrity | availability | combination }}
- **Approximate number of data subjects concerned:** {{ count }}
- **Approximate number of personal data records concerned:** {{ count }}

## 3. Categories of personal data (Art. 33(3)(a))

- {{ category_1 — e.g. names + email addresses }}
- {{ category_2 — e.g. WhatsApp message content }}
- {{ category_3 — e.g. IP addresses + browser fingerprints }}

Special categories of personal data (Art. 9):
{{ none | enumerate }}.

Children's data:
{{ none | enumerate }}.

## 4. Likely consequences (Art. 33(3)(c))

{{ honest_assessment_of_likely_harm }}

Pseudonymisation / encryption status of the affected data:
{{ e.g. all field-level secrets are encrypted at rest with Fernet via
FIELD_ENCRYPTION_KEYS — keys not co-located with affected data. Passwords
are Argon2-hashed, never stored in plaintext. }}

## 5. Measures taken or proposed (Art. 33(3)(d))

### Already taken
- {{ contain_action_1 }} (at {{ utc }})
- {{ remediation_1 }}
- Affected data subjects notified via email at {{ utc }} ({{ count }} recipients)
- Engaged external forensics: {{ firm }}

### Proposed
- {{ proposed_1 }}
- {{ proposed_2 }}
- Re-test by {{ firm }} on {{ date }}

## 6. Cross-border transfer of breach data

{{ describe whether the personal data was being transferred outside the EU
at the time of the breach, the legal basis, and which sub-processors were
involved (e.g. Anthropic/USA under SCCs). }}

## 7. Communication with data subjects (Art. 34)

We assess the risk to data subjects as **{{ low | medium | high }}**.
Therefore, we have / have not communicated to data subjects under Art. 34.
Reasoning: {{ reasoning }}.

If we did notify: copy attached as `incident-{{ ref }}-customer.pdf`.

## 8. DPO + technical contacts

- DPO: {{ dpo_name }} · {{ dpo_email }} · {{ dpo_phone }}
- Engineering lead: {{ name }} · {{ email }}
- We will respond to follow-up questions within 24 hours business days.

—

{{ dpo_signature_block }}

**Attached:**
- Incident timeline ({{ ref }}-timeline.pdf)
- Sample of customer notification ({{ ref }}-customer.pdf)
- Risk assessment ({{ ref }}-risk.pdf)
