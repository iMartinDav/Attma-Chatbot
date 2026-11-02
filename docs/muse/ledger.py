"""Sum Muse Code token usage from exec --json logs and price it at Meta Model API Standard rates."""
import glob
import json
import sys

# USD per 1M tokens (dev.meta.ai pricing, 2026-11-02). Reasoning tokens are billed as output.
PRICES = {
    "muse-wonder-1.0": (4.00, 0.20, 20.00),
    "muse-spark-1.3": (1.25, 0.15, 4.25),
}

total = 0.0
for path in sorted(glob.glob(sys.argv[1] + "/*.jsonl")):
    cost = 0.0
    for line in open(path, encoding="utf-8"):
        if '"run_usage"' not in line:
            continue
        payload = json.loads(line)["payload"]
        for m in payload.get("models", []):
            inp, cached_p, out = PRICES.get(m["model"], PRICES["muse-wonder-1.0"])
            cached = m.get("cached_tokens", 0)
            uncached = m.get("input_tokens", 0) - cached
            output = m.get("output_tokens", 0) + m.get("reasoning_tokens", 0)
            cost += (uncached * inp + cached * cached_p + output * out) / 1e6
    total += cost
    print(f"{path.rsplit('/', 1)[-1]:32s} ${cost:7.3f}")
print(f"{'TOTAL':32s} ${total:7.3f}")
