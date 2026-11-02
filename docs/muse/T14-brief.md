# Task T14: sandbox network allow-list (branch feat/trust-gate)

Do not edit other files in `docs/muse/`. Stay on `feat/trust-gate`, no commits. This closes the "sandbox egress is open" finding in `REVIEW-2026-11-02.md`.

## Change

1. **Allow-list.** In `lib/sandbox/python.ts`, give `Sandbox.getOrCreate` a `networkPolicy` with `allow` limited to the hosts the tools need. Confirm the option shape in `node_modules/@vercel/sandbox` (installed 3.9.0): an object with `allow` (domains, `*.` for subdomains) is deny-by-default for everything else. The list:
   - the AlphaGenome API host or hosts: find them in the installed `alphagenome` client inside the snapshot, or from a test run, not by guessing;
   - the public data hosts that `runPython`'s description promises: Ensembl REST, UniProt, NCBI E-utilities, and the scanpy dataset host;
   - nothing else.

   Keep the list in one exported constant with a one-line comment per host.
2. **Existing sandboxes.** Chats reuse persistent sandboxes (`resume: true`), which were created before the policy existed. Apply the same policy to a resumed sandbox with `sandbox.update({ networkPolicy })` if the SDK supports it. Otherwise state that old chats keep the old policy until their sandbox expires.
3. **Attachments.** Check how attached files reach `data/` (written by the app through the SDK, or fetched inside the sandbox). If the sandbox fetches them, add the Blob host to the list.
4. **Tool description.** Update the `runPython` tool description in `lib/ai/tools/compute.ts` so it names the allowed hosts instead of "Network access to public APIs and datasets is available". Remove the `requests` promise for arbitrary sites.
5. **Plan limits.** If the SDK or API rejects the policy on this team's plan, stop and report the exact error. Do not work around it.

## Verify

- Unit-test that the exported allow-list contains the AlphaGenome and Ensembl hosts and no wildcard for everything.
- One live check with `bun --env-file=.env.local`, a script under `scripts/sandbox/` (about a cent):
  - in a fresh sandbox from `ATTMA_SANDBOX_SNAPSHOT`, a request to an allowed host succeeds;
  - a request to `https://example.com` fails;
  - delete the sandbox afterwards.

  Paste the two outcomes in your report.
- Must pass: `timeout 1500 bun --env-file=.env.local run release-gate`.
- Finish with: files changed, the final host list with the reason for each, the live check output, anything unsure.
