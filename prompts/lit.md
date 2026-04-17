---
description: Run a literature review on a topic using paper search and primary-source synthesis.
args: <topic>
section: Research Workflows
topLevelCli: true
---
Investigate the following topic as a literature review: $@

Derive a short slug from the topic (lowercase, hyphens, no filler words, ≤5 words). Use this slug for all files in this run.

## Workflow

1. **Plan** — Outline the scope: key questions, source types to search (papers, web, repos), time period, expected sections, and a small task ledger plus verification log. Write the plan to `outputs/.plans/<slug>.md`. Present the plan to the user. If this is an unattended or one-shot run, continue automatically. If the user is actively interacting, give them a brief chance to request changes before proceeding.
2. **Gather** — Use the `researcher` subagent when the sweep is wide enough to benefit from delegated paper triage before synthesis. For narrow topics, search directly. Researcher outputs go to `<slug>-research-*.md`. Do not silently skip assigned questions; mark them `done`, `blocked`, or `superseded`.
3. **Synthesize & Reflect (Critic Loop)** — Spawn the `writer` subagent to synthesize research notes into an initial draft at `outputs/.drafts/<slug>-draft-v1.md`. Then initiate a **Self-Reflection Debate**:
   - Spawn the `critic` subagent to explicitly assess the draft. The `critic` flags any LLM hallucinations, missing evidence, or logical over-extrapolations.
   - Send the `critic`'s feedback back to the `writer` for a mandatory revision into `<slug>-draft-final.md`. This multi-agent reflection mechanism effectively lowers conclusion error rates and guarantees factual consistency. If major contradictions remain, run one more `critic` loop.
4. **Cite** — Spawn the `verifier` agent to add inline citations to `<slug>-draft-final.md` and verify every source URL.
5. **Verify** — Spawn the `reviewer` agent to check the cited draft for unsupported claims, logical gaps, zombie sections, and single-source critical findings. Fix FATAL issues before delivering. Note MAJOR issues in Open Questions. If FATAL issues were found, run one more verification pass after the fixes.
6. **Deliver** — Save the final literature review to `outputs/<slug>.md`. Write a provenance record alongside it as `outputs/<slug>.provenance.md` listing: date, sources consulted vs. accepted vs. rejected, verification status, and intermediate research files used. Before you stop, verify on disk that both files exist; do not stop at an intermediate cited draft alone.
