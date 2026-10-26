"""Flag benchmark cases whose source publication is cited in HPO's annotations.

HPO disease annotations are partly curated from published case reports. A case
whose paper (PMID) is cited for its own disease in phenotype.hpoa may have
informed the very annotations it is scored against, so the eval reports the
held-out subset (no such citation) separately. Usage:

    python3 -I flag_overlap.py <phenotype.hpoa> <cases.json>
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path


def main():
    hpoa, cases_path = Path(sys.argv[1]), Path(sys.argv[2])
    cited = defaultdict(set)
    with hpoa.open() as handle:
        header = None
        for line in handle:
            if line.startswith("#"):
                continue
            cols = line.rstrip("\n").split("\t")
            if header is None:
                header = {name: i for i, name in enumerate(cols)}
                continue
            for ref in cols[header["reference"]].split(";"):
                if ref.startswith("PMID:"):
                    cited[cols[header["database_id"]]].add(ref.removeprefix("PMID:"))

    data = json.loads(cases_path.read_text())
    for case in data["cases"]:
        match = re.match(r"PMID_(\d+)", case["id"])
        case["pmid"] = match.group(1) if match else None
        case["citedInHpoAnnotations"] = bool(
            case["pmid"] and case["pmid"] in cited.get(case["disease"]["id"], set())
        )
    cases_path.write_text(json.dumps(data, indent=1))
    flagged = sum(c["citedInHpoAnnotations"] for c in data["cases"])
    print(f"{cases_path.name}: {flagged}/{len(data['cases'])} cases cited in HPO annotations")


if __name__ == "__main__":
    main()
