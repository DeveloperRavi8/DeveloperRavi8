# Handoff

- **Goal:** Keep Ravi's GitHub profile README accurate and make its contribution visuals render reliably.
- **Done:** Replaced the disabled Vercel graph embed with a README-hosted SVG design and links for 30-, 90-, and 365-day views. Confirmed the proposed chart action fails on this account because its overlapping GraphQL calendar reads disagree for 2025-11-19; retrying returns the same mismatch.
- **Remaining:** Run the updated workflow on GitHub and confirm all three chart files are available from the `output` branch.
- **Key decisions:** Keep the chart static and self-hosted so rendering does not rely on a third-party live endpoint. Use one GraphQL calendar query, then render dependency-free SVG bar and trend charts locally to avoid the upstream overlapping-window mismatch.
- **Files touched:** `README.md`, `.github/workflows/contribution-snake.yml`, `scripts/generate-activity-chart.mjs`, `HANDOFF.md`.
- **Next step:** Review the implementation diff, commit the generator and workflow changes, push `main`, and inspect the action result.
