# Handoff

- **Goal:** Keep Ravi's GitHub profile README accurate and make its contribution visuals render reliably.
- **Done:** Replaced the disabled Vercel activity graph embed with generated 30-, 90-, and 365-day SVG charts. The existing GitHub Actions workflow now generates charts alongside the contribution snake and publishes both to the `output` branch. The README displays the 365-day chart and links to each range.
- **Remaining:** The workflow must complete successfully once on GitHub before the new SVG links render. The existing snake asset is also published by that workflow.
- **Key decisions:** Use a static, repository-hosted SVG rather than a live chart service so README rendering does not depend on the disabled Vercel deployment. Keep the existing publishing branch and workflow.
- **Files touched:** `README.md`, `.github/workflows/contribution-snake.yml`, `HANDOFF.md`.
- **Next step:** Review the diff, commit the three scoped files, push `main`, then confirm the workflow publishes the chart assets.
