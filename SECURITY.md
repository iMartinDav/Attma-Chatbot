# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue.

Include what you found, how to reproduce it and the impact you expect. You will get a reply within a few days.

## Scope

In scope: this repository and the deployment at chat.attma.bio, in particular authentication, access to other users' chats or files, the Python sandbox and its network policy, and the biosecurity reviewer.

Out of scope: denial of service, automated scanner output without a working proof, and issues in third-party services (Meta, Vercel, Neon, Ensembl, NCBI).

## Design notes

- Each chat's Python runs in its own Vercel Sandbox microVM with outbound network limited to an allow-list (`lib/sandbox/network-policy.ts`).
- Requests, model-written code and reports are screened by a biosecurity reviewer before they run or are shown (`lib/biosecurity/`).
- Secrets live only in environment variables; `.env.example` lists their names.
