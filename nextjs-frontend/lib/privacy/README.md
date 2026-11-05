# Privacy guard

Patient identifiers never reach a model. Every model call in Attma (the agent, sub-agents, chat titles, tool-call repair and the biosecurity reviewer) goes through `myProvider`, and `privacyMiddleware` masks the prompt before it leaves: the researcher's messages, earlier answers, tool arguments and tool results.

```
researcher ──▶ chat route ──▶ [vault per request] ──▶ privacyMiddleware ──▶ Muse / fallback
   ▲                                │                     mask + outbound check
   └──── real values restored ◀─────┘ data-privacy part (tokens → values, this browser only)
```

## How it works

- **Detection** (`detect.ts`): deterministic rules, so every hit is explainable and nothing leaves the server to be detected.
  - Rules cover names after a cue (`Patient:`, `Mr.`, `paciente`), MRN and NHC, sample and biobank IDs, dates of birth, full dates, ages of 90 and over, phone numbers, email addresses, SSN, DNI/NIE and NHS numbers (all checksum-validated), IBAN (mod 97), insurance IDs, addresses and IPv4 addresses.
  - VCF sample columns are detected as sample IDs.
  - Public reference samples (NA, GM and HG numbers) are never masked.
- **Pseudonymization** (`vault.ts`): one token per value (`[[PERSON_1]]`, `[[MRN_1]]`), numbered by first appearance.
  - The history is replayed in the same order on every turn, so tokens stay stable across turns without storing anything new.
  - A surname mentioned later maps to the full name's token.
- **Outbound check** (`guard.ts`): after masking, the whole prompt is searched for any value the vault holds. If one survived, the call is refused and nothing is sent (`PrivacyLeakError`).
- **Tool results:** results from public databases (VEP, PubMed, UniProt and similar) are not scanned for new identifiers, but known values are still masked if a tool echoes them. Results from the Python sandbox and the document readers are scanned fully.
- **Restoring values:** the Python sandbox runs inside Attma, so it gets the real values back in its inputs. Tools that call outside services keep the tokens.
- **Display** (`components/chat/privacy.tsx`): the reply carries a `data-privacy` part. The browser puts the real values back and shows what was kept from the model as types and counts, never the values.

## Evaluation

`bun scripts/privacy-eval/run.ts`. The data is synthetic and seeded; no real patient data is used.

| Set                                                                                   | Result                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Cued identifiers: 300 notes (EN and ES), 1,983 values                                 | 0 full leaks, 0 partial leaks, 100% recall on 8 types |
| Research text with no identifiers: genes, HGVS, rsIDs, coordinates, versions, NA12878 | 0% over-masking                                       |
| Uncued names in free text: 100 names                                                  | 0% caught (known gap)                                 |

These are development numbers. The rules and the templates were written together, so they show that the patterns are covered, not how the guard performs on real clinical notes.

## Limits of this tier

- **Names without a cue are missed.** A name written in free text, with no `Patient:` or `Mr.` before it, passes through. The next tier is a local, open-weight NER model that runs next to the rules and never sends text out to detect it.
- **Images and PDFs reach a model as bytes and are not scanned.** The reply says how many attachments were sent unscanned.
- **This is pseudonymization, not anonymization.** Genomic data can identify a person by itself. Variant coordinates and rare variants are research content here and are not masked.
- **Documents the agent writes keep the tokens.**
