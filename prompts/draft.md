---
description: Turn research findings into a polished paper-style draft with equations, sections, and explicit claims.
args: <topic>
section: Research Workflows
topLevelCli: true
---
Write a paper-style draft for: $@

Derive a short slug from the topic (lowercase, hyphens, no filler words, ≤5 words). Use this slug for all files in this run.

Requirements:
- Before writing, outline the draft structure: proposed title, sections, key claims to make, source material to draw from, and a verification log for the critical claims, figures, and calculations. Write the outline to `outputs/.plans/<slug>.md`. Present the outline to the user. If this is an unattended or one-shot run, continue automatically. If the user is actively interacting, give them a brief chance to request changes before proceeding.
- Use the `writer` subagent when the draft should be produced from already-collected notes. Then use the `critic` subagent in a **Reflection/Debate loop** to vigorously cross-check the `writer`'s draft, flagging LLM hallucinations and forcing factual corrections. Only after the `critic` signals a pass, use the `verifier` subagent to add inline citations and verify sources.
- Include at minimum: title, abstract, problem statement, related work, method or synthesis, evidence or experiments, limitations, conclusion.
- Use clean Markdown with LaTeX where equations materially help.
- Follow the system prompt's provenance rules for all results, figures, charts, images, tables, benchmarks, and quantitative comparisons. If evidence is missing, leave a placeholder or proposed experimental plan instead of claiming an outcome.
- Generate charts with `pi-charts` only for source-backed quantitative data, benchmarks, and comparisons. Use Mermaid for architectures and pipelines only when the structure is supported by sources. Every figure needs a provenance-bearing caption.
- Before delivery, sweep the draft for any claim that sounds stronger than its support. Mark tentative results as tentative and remove unsupported numerics instead of letting the verifier discover them later.
- Save the final paper in two formats:
	- `papers/<slug>.md` (canonical editable source)
	- `papers/<slug>.tex` (Overleaf-ready LaTeX with equivalent structure/content)
- End with a `Sources` appendix with direct URLs for all primary references.
