# DPDP Act 2023 — Data Protection Board notification

**Status:** template — fill bracketed fields, run through DPO + legal **before** sending.
**Statute:** Section 8(6) of the Digital Personal Data Protection Act, 2023.
**Recipient:** Data Protection Board of India (channels per DPB website).
**Window:** within 72 hours of becoming aware of the breach.

---

**To:** Data Protection Board of India
**Subject:** Personal Data Breach Notification — Social Stats Inc. — Reference {{ incident.reference_number }}

## 1. Identity of the Data Fiduciary

- **Legal entity:** {{ legal_entity_name }}
- **CIN:** {{ cin_number }}
- **Registered address:** {{ registered_address }}
- **DPO name + contact:** {{ dpo_name }} · {{ dpo_email }} · {{ dpo_phone }}
- **Significant data fiduciary status:** {{ yes | no }}

## 2. Nature of the breach

- **Date + time of incident:** {{ incident.start_iso }} — {{ incident.end_iso }} (IST)
- **Date + time we became aware:** {{ awareness.iso }} (IST)
- **Type of breach:**
  - [ ] Confidentiality (unauthorised disclosure / access)
  - [ ] Integrity (unauthorised alteration)
  - [ ] Availability (loss of access for legitimate users)
- **Vector / root cause:** {{ root_cause_short }}
  ({{ technical_detail_1 }}, {{ technical_detail_2 }}).
- **Incident reference number (internal):** {{ incident.reference_number }}

## 3. Categories of personal data + data principals affected

| Category | # of data principals | Sensitive? |
|---|---|---|
| Names + email addresses | {{ count }} | No |
| Phone numbers | {{ count }} | Yes (per DPDP rules) |
| WhatsApp message content | {{ count }} | Yes |
| Passwords (Argon2-hashed) | {{ count }} | Hashes only, not plaintext |
| ... | | |

**Total data principals affected:** {{ total_count }}
**Of which Indian residents:** {{ indian_count }}

## 4. Likely consequences

{{ honest_assessment_of_likely_harm — e.g. potential phishing of affected
users; no card details exposed; Argon2 hashing makes password compromise
extremely unlikely. }}

## 5. Measures already taken

- {{ contain_action_1 }} (at {{ time }} UTC)
- {{ contain_action_2 }}
- Engaged external forensics: {{ firm_name }}
- Affected users notified via email at {{ time }} UTC ({{ count }} recipients)
- Internal post-mortem scheduled for {{ date }}

## 6. Measures proposed

- {{ remediation_1 — e.g. rotate FIELD_ENCRYPTION_KEYS and force re-encryption }}
- {{ remediation_2 — e.g. hardening sweep on the affected endpoint }}
- Pentest re-test scheduled for {{ date }} ({{ firm_name }})
- {{ remediation_3 }}

## 7. Cooperation undertaking

We commit to providing the Board with any further information requested,
making available our DPO + technical leads for interview, and complying
with any directives.

—

{{ dpo_signature_block }}

**Attached:**
- Forensic timeline (incident-{{ ref }}-timeline.pdf)
- Customer notification template + sample (incident-{{ ref }}-customer.pdf)
- SecurityAuditLog excerpt for the affected window (incident-{{ ref }}-audit.csv)
