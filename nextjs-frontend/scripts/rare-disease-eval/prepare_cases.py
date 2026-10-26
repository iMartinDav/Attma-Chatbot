"""Sample benchmark cases from GA4GH phenopacket-store.

One case per gene for a seeded random set of genes, so no single gene dominates.
Keeps cases with one causal gene, at least three observed HPO terms and a GRCh38
causal variant. Usage:

    python3 -I prepare_cases.py <extracted phenopacket-store dir> <out.json> [n_genes] [seed] [exclude.json]

Pass the test set as exclude.json to draw a tuning set from different genes.
"""

import json
import random
import sys
from pathlib import Path


def load_case(path: Path):
    packet = json.loads(path.read_text())
    features = packet.get("phenotypicFeatures", [])
    observed = [f["type"] for f in features if not f.get("excluded")]
    excluded = [f["type"] for f in features if f.get("excluded")]
    interpretations = packet.get("interpretations", [])
    if len(observed) < 3 or len(interpretations) != 1:
        return None

    diagnosis = interpretations[0]["diagnosis"]
    genes, variants = set(), []
    for genomic in diagnosis.get("genomicInterpretations", []):
        descriptor = genomic.get("variantInterpretation", {}).get("variationDescriptor", {})
        symbol = descriptor.get("geneContext", {}).get("symbol")
        vcf = descriptor.get("vcfRecord")
        if not symbol or not vcf or vcf.get("genomeAssembly") not in ("hg38", "GRCh38"):
            return None
        genes.add(symbol)
        chrom = vcf["chrom"].removeprefix("chr")
        variants.append(f"{chrom}-{vcf['pos']}-{vcf['ref']}-{vcf['alt']}")
    if len(genes) != 1:
        return None

    return {
        "id": packet["id"],
        "gene": genes.pop(),
        "disease": diagnosis["disease"],
        "hpo": [{"id": t["id"], "label": t["label"]} for t in observed],
        "excludedHpo": [{"id": t["id"], "label": t["label"]} for t in excluded],
        "variants": sorted(set(variants)),
    }


def main():
    root, out = Path(sys.argv[1]), Path(sys.argv[2])
    n_genes = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    rng = random.Random(int(sys.argv[4]) if len(sys.argv) > 4 else 2026)

    by_gene = {}
    for path in sorted(root.rglob("*.json")):
        case = load_case(path)
        if case:
            by_gene.setdefault(case["gene"], []).append(case)

    if len(sys.argv) > 5:
        excluded = {c["gene"] for c in json.loads(Path(sys.argv[5]).read_text())["cases"]}
        by_gene = {g: v for g, v in by_gene.items() if g not in excluded}
    genes = sorted(by_gene)
    picked = rng.sample(genes, min(n_genes, len(genes)))
    cases = [rng.choice(by_gene[g]) for g in sorted(picked)]
    out.write_text(json.dumps({
        "source": "GA4GH phenopacket-store 0.1.27 (Monarch Initiative, BSD-3-Clause)",
        "eligibleGenes": len(genes),
        "eligibleCases": sum(len(v) for v in by_gene.values()),
        "cases": cases,
    }, indent=1))
    print(f"{len(cases)} cases from {len(genes)} eligible genes "
          f"({sum(len(v) for v in by_gene.values())} eligible cases)")


if __name__ == "__main__":
    main()
