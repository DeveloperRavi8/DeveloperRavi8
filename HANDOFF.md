# Handoff

- **Goal:** Keep Ravi's GitHub profile README accurate and make its contribution visuals render reliably.
- **Done:** Replaced the disabled Vercel graph embed with a README-hosted SVG design and links for 30-, 90-, and 365-day views. Added a dependency-free local SVG generator. GitHub's long calendar response omits the first partial week, so the generator makes a short boundary query only to fill missing dates and preserves the long-window counts for overlaps.
- **Remaining:** Run the updated workflow on GitHub and confirm all three chart files are available from the `output` branch.
- **Key decisions:** Keep the chart static and self-hosted so rendering does not rely on a third-party live endpoint. Avoid the upstream chart action because it rejects mismatched values for overlapping calendar windows; resolve missing dates from a short query without comparing already-present days.
- **Files touched:** `README.md`, `.github/workflows/contribution-snake.yml`, `scripts/generate-activity-chart.mjs`, `HANDOFF.md`.
- **Next step:** Review the implementation diff, commit the generator and workflow changes, push `main`, and inspect the action result.
