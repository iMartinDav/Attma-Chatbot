# Rare disease benchmark

How well Attma's rare-disease tools find the cause of real, solved cases.

## Data

- **Cases:** [GA4GH phenopacket-store](https://github.com/monarch-initiative/phenopacket-store) 0.1.27 (BSD-3-Clause), published individuals with HPO phenotypes, a diagnosis and the causal variant on GRCh38.
- **Test set** (`cases.json`): 200 cases, one per gene, 200 genes drawn with seed 2026 from 676 eligible genes (one causal gene, ≥3 observed HPO terms).
- **Tuning set** (`cases-tune.json`): 150 cases from genes not in the test set (seed 7). Method choices are made here only.
- **Knowledge:** HPO release 2026-09-01 (`hp.obo`, `phenotype.hpoa`, `genes_to_disease.txt`), compiled by `../rare-disease-engine/build_hpo_index.py`.

## Tasks

1. **Phenotype → gene.** Rank all ~12,900 diseases by Resnik semantic similarity from the patient's observed HPO terms; a gene's score is its best disease. Metric: rank of the causal gene.
2. **Variant prioritization.** The causal variant is hidden among 19 decoys, which are causal variants from other patients, so "looks pathogenic" cannot separate them. Variants are annotated by Ensembl VEP (consequence, gnomAD, ClinVar, AlphaMissense, CADD) and ranked with and without phenotypes.

Ranks use the expected position under random tie-breaking, so ties neither help nor hurt.

## Leakage control

HPO's disease annotations are partly curated from published case reports. 169 of the 200 test cases come from a paper that HPO cites for that same disease, so scoring them against the full release lets a case be matched against knowledge curated from itself.

The **held-out** evaluation rebuilds the index without every annotation whose only reference is a benchmark case's own publication (7,027 annotations; 116 diseases lose all annotations). It is the leakage-free estimate; the full release is what production uses.

## Results (2026-10-26)

|                                                            | Full release        | Held-out          |
| ---------------------------------------------------------- | ------------------- | ----------------- |
| Causal gene, top-1 / top-5 / top-10                        | 72.5% / 88% / 90.5% | 20% / 31% / 38%   |
| Causal gene, MRR                                           | 0.809               | 0.264             |
| Causal variant of 20, with phenotypes: top-1 / top-5       | 82% / 87.5%         | **50.5% / 63%**   |
| Causal variant of 20, variant evidence only: top-1 / top-5 | 0% / 32%            | 0% / 32%          |
| Variant MRR, with / without phenotypes                     | 0.853 / 0.143       | **0.580 / 0.143** |
| Phenotype ranking time, median / p95                       | 53 / 175 ms         | 53 / 175 ms       |

The patient→disease similarity was selected on the tuning set (held-out MRR 0.278 against 0.271 for the symmetric best-match average). In the held-out run, 44 causal genes have no remaining annotated disease and cannot be ranked from phenotypes; for those, literature search is the only source.

Full per-case output: `results.json` (full release) and `results-held-out.json`.

## Reproduce

```bash
# phenopacket-store 0.1.27 and HPO v2026-09-01 release files, unpacked locally
python3 -I scripts/rare-disease-eval/prepare_cases.py <phenopackets>/0.1.27 scripts/rare-disease-eval/cases.json 200 2026
python3 -I scripts/rare-disease-eval/prepare_cases.py <phenopackets>/0.1.27 scripts/rare-disease-eval/cases-tune.json 150 7 scripts/rare-disease-eval/cases.json
python3 -I scripts/rare-disease-eval/flag_overlap.py <hpo>/phenotype.hpoa scripts/rare-disease-eval/cases.json
python3 -I scripts/rare-disease-eval/flag_overlap.py <hpo>/phenotype.hpoa scripts/rare-disease-eval/cases-tune.json
python3 -I scripts/rare-disease-engine/build_hpo_index.py <hpo> lib/rare-disease/data/hpo-index.json
python3 -I scripts/rare-disease-engine/build_hpo_index.py <hpo> /tmp/hpo-index.eval.json scripts/rare-disease-eval/cases.json scripts/rare-disease-eval/cases-tune.json

bun scripts/rare-disease-eval/run.ts                                           # full release
HPO_INDEX_PATH=/tmp/hpo-index.eval.json bun scripts/rare-disease-eval/run.ts   # held-out
```

Research use only. These numbers describe ranking quality on published cases, not clinical diagnostic accuracy.
