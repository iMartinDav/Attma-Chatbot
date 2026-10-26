"""Build the compact HPO index the rare-disease engine loads at runtime.

Inputs come from one official HPO release (https://github.com/obophenotype/human-phenotype-ontology):
hp.obo, phenotype.hpoa and genes_to_disease.txt. Output is a single JSON file with:

- terms: live HPO terms with names, synonyms and is_a parents (indices)
- alias: obsolete and alternative IDs mapped to their live term
- ic: information content per term, -ln(fraction of diseases annotated with the term
  or a descendant), computed over all diseases in phenotype.hpoa
- diseases: OMIM, Orphanet and DECIPHER diseases with their phenotype terms (NOT-qualified
  annotations excluded) and causal genes (MENDELIAN or UNKNOWN associations)

Usage:
    python3 -I build_hpo_index.py <release dir> <out.json> [cases.json ...]

With benchmark case files, builds an evaluation index instead: every annotation whose
only supporting reference is a case's own publication (for that case's disease) is
dropped, so no case is scored against knowledge curated from itself.
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

PHENOTYPIC_ABNORMALITY = "HP:0000118"


def parse_obo(path: Path):
    terms, current = {}, None
    for line in path.read_text().splitlines():
        if line == "[Term]":
            current = {"parents": [], "synonyms": [], "alt_ids": [], "obsolete": False}
            continue
        if line.startswith("[") or current is None:
            if line.startswith("["):
                current = None
            continue
        key, _, value = line.partition(": ")
        if key == "id":
            current["id"] = value
            terms[value] = current
        elif key == "name":
            current["name"] = value
        elif key == "is_a":
            current["parents"].append(value.split(" ")[0])
        elif key == "synonym" and ('" EXACT' in value or '" RELATED' in value):
            current["synonyms"].append(value.split('"')[1])
        elif key == "alt_id":
            current["alt_ids"].append(value)
        elif key == "is_obsolete" and value == "true":
            current["obsolete"] = True
        elif key == "replaced_by":
            current["replaced_by"] = value
    return terms


def main():
    release, out = Path(sys.argv[1]), Path(sys.argv[2])
    held_out = set()
    for cases_file in sys.argv[3:]:
        for case in json.loads(Path(cases_file).read_text())["cases"]:
            if case.get("pmid"):
                held_out.add((case["disease"]["id"], f"PMID:{case['pmid']}"))
    dropped = 0
    version = next(
        line.split(": ", 1)[1]
        for line in (release / "hp.obo").read_text().splitlines()
        if line.startswith("data-version:")
    )
    raw = parse_obo(release / "hp.obo")
    live = sorted(t for t, v in raw.items() if not v["obsolete"])
    index = {t: i for i, t in enumerate(live)}

    alias = {}
    for term_id, term in raw.items():
        target = term_id if not term["obsolete"] else term.get("replaced_by")
        if target in index:
            if term["obsolete"]:
                alias[term_id] = index[target]
            for alt in term["alt_ids"]:
                alias[alt] = index[target]

    def resolve(term_id):
        return index.get(term_id, alias.get(term_id))

    parents = [[index[p] for p in raw[t]["parents"] if p in index] for t in live]

    ancestors_cache = {}

    def ancestors(i):
        if i not in ancestors_cache:
            closure = {i}
            for p in parents[i]:
                closure |= ancestors(p)
            ancestors_cache[i] = frozenset(closure)
        return ancestors_cache[i]

    sys.setrecursionlimit(10000)
    abnormality = index[PHENOTYPIC_ABNORMALITY]

    disease_terms, disease_names = defaultdict(set), {}
    with (release / "phenotype.hpoa").open() as handle:
        header = None
        for line in handle:
            if line.startswith("#"):
                continue
            cols = line.rstrip("\n").split("\t")
            if header is None:
                header = {name: i for i, name in enumerate(cols)}
                continue
            if cols[header["aspect"]] != "P" or cols[header["qualifier"]] == "NOT":
                continue
            term = resolve(cols[header["hpo_id"]])
            if term is None or abnormality not in ancestors(term):
                continue
            disease = cols[header["database_id"]]
            references = set(cols[header["reference"]].split(";"))
            if held_out and all((disease, r) in held_out for r in references):
                dropped += 1
                continue
            disease_terms[disease].add(term)
            disease_names[disease] = cols[header["disease_name"]]

    disease_genes = defaultdict(set)
    with (release / "genes_to_disease.txt").open() as handle:
        next(handle)
        for line in handle:
            _, symbol, association, disease, _ = line.rstrip("\n").split("\t")
            if association in ("MENDELIAN", "UNKNOWN"):
                disease_genes[disease].add(symbol)

    diseases = sorted(disease_terms)
    counts = [0] * len(live)
    for disease in diseases:
        closure = set()
        for term in disease_terms[disease]:
            closure |= ancestors(term)
        for term in closure:
            counts[term] += 1
    total = len(diseases)
    max_ic = -math.log(1 / total)
    ic = [round(-math.log(c / total), 4) if c else round(max_ic, 4) for c in counts]

    payload = {
        "version": version,
        "source": "Human Phenotype Ontology (hpo.jax.org), https://hpo.jax.org/license",
        "terms": live,
        "names": [raw[t]["name"] for t in live],
        "synonyms": ["|".join(raw[t]["synonyms"]) for t in live],
        "parents": parents,
        "ic": ic,
        "alias": alias,
        "diseases": [
            {
                "id": d,
                "name": disease_names[d],
                "terms": sorted(disease_terms[d]),
                "genes": sorted(disease_genes.get(d, ())),
            }
            for d in diseases
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":")))
    with_genes = sum(1 for d in diseases if disease_genes.get(d))
    print(
        f"{version}: {len(live)} terms, {len(alias)} aliases, {total} diseases "
        f"({with_genes} with genes), {out.stat().st_size / 1e6:.1f} MB"
        + (f"; {dropped} annotations held out" if held_out else "")
    )


if __name__ == "__main__":
    main()
