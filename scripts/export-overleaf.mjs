#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  console.log("Usage: npm run export:overleaf -- <input.md> [output-dir]");
  console.log("Example: npm run export:overleaf -- papers/my-paper.md papers/my-paper-overleaf");
}

function latexEscape(text) {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function convertInline(text) {
  let out = latexEscape(text);
  out = out.replace(/`([^`]+)`/g, "\\texttt{$1}");
  out = out.replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}");
  out = out.replace(/\*([^*]+)\*/g, "\\emph{$1}");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\\href{$2}{$1}");
  return out;
}

function extractTitle(markdown, fallback) {
  const lines = markdown.split(/\r?\n/);
  const heading = lines.find((line) => /^#\s+/.test(line));
  if (!heading) return fallback;
  return heading.replace(/^#\s+/, "").trim();
}

function markdownToLatex(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];

  let inCodeBlock = false;
  let inItemize = false;
  let inEnumerate = false;

  function closeLists() {
    if (inItemize) {
      out.push("\\end{itemize}");
      inItemize = false;
    }
    if (inEnumerate) {
      out.push("\\end{enumerate}");
      inEnumerate = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```") || line.startsWith("~~~")) {
      closeLists();
      if (!inCodeBlock) {
        out.push("\\begin{lstlisting}");
        inCodeBlock = true;
      } else {
        out.push("\\end{lstlisting}");
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(rawLine);
      continue;
    }

    if (!line) {
      closeLists();
      out.push("");
      continue;
    }

    if (/^######\s+/.test(line)) {
      closeLists();
      out.push(`\\paragraph{${convertInline(line.replace(/^######\s+/, ""))}}`);
      continue;
    }

    if (/^#####\s+/.test(line)) {
      closeLists();
      out.push(`\\subparagraph{${convertInline(line.replace(/^#####\s+/, ""))}}`);
      continue;
    }

    if (/^####\s+/.test(line)) {
      closeLists();
      out.push(`\\subsubsection{${convertInline(line.replace(/^####\s+/, ""))}}`);
      continue;
    }

    if (/^###\s+/.test(line)) {
      closeLists();
      out.push(`\\subsection{${convertInline(line.replace(/^###\s+/, ""))}}`);
      continue;
    }

    if (/^##\s+/.test(line)) {
      closeLists();
      out.push(`\\section{${convertInline(line.replace(/^##\s+/, ""))}}`);
      continue;
    }

    if (/^#\s+/.test(line)) {
      // Use the document title instead of duplicating H1 inside body.
      continue;
    }

    if (/^-\s+/.test(line)) {
      if (inEnumerate) {
        out.push("\\end{enumerate}");
        inEnumerate = false;
      }
      if (!inItemize) {
        out.push("\\begin{itemize}");
        inItemize = true;
      }
      out.push(`  \\item ${convertInline(line.replace(/^-\s+/, ""))}`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inItemize) {
        out.push("\\end{itemize}");
        inItemize = false;
      }
      if (!inEnumerate) {
        out.push("\\begin{enumerate}");
        inEnumerate = true;
      }
      out.push(`  \\item ${convertInline(line.replace(/^\d+\.\s+/, ""))}`);
      continue;
    }

    if (/^>\s*/.test(line)) {
      closeLists();
      out.push(`\\begin{quote}${convertInline(line.replace(/^>\s*/, ""))}\\end{quote}`);
      continue;
    }

    if (/^\$\$/.test(line) || /^\\\[/.test(line)) {
      closeLists();
      out.push(line);
      continue;
    }

    closeLists();
    out.push(convertInline(line));
  }

  closeLists();

  if (inCodeBlock) {
    out.push("\\end{lstlisting}");
  }

  return out.join("\n");
}

function buildLatexDocument(title, body) {
  return `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{listings}

\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  columns=fullflexible,
  frame=single,
  framerule=0.2pt,
  rulecolor=\\color{gray!40}
}

\\title{${latexEscape(title)}}
\\date{}

\\begin{document}
\\maketitle

${body}

\\end{document}
`;
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    usage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const exists = await fs
    .access(inputPath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    console.error(`Input file not found: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

  if (path.extname(inputPath).toLowerCase() !== ".md") {
    console.error("Input must be a Markdown file (.md).");
    process.exitCode = 1;
    return;
  }

  const inputContent = await fs.readFile(inputPath, "utf8");
  const slug = path.basename(inputPath, ".md");
  const defaultOutDir = path.join(path.dirname(inputPath), `${slug}-overleaf`);
  const outDir = outputArg ? path.resolve(process.cwd(), outputArg) : defaultOutDir;

  await fs.mkdir(outDir, { recursive: true });

  const title = extractTitle(inputContent, slug);
  const body = markdownToLatex(inputContent);
  const latexDoc = buildLatexDocument(title, body);

  const mainTexPath = path.join(outDir, "main.tex");
  const readmePath = path.join(outDir, "README.txt");
  const sourceCopyPath = path.join(outDir, `${slug}.md`);

  await fs.writeFile(mainTexPath, latexDoc, "utf8");
  await fs.writeFile(sourceCopyPath, inputContent, "utf8");
  await fs.writeFile(
    readmePath,
    [
      "Overleaf quick start:",
      "1) Create a new blank project in Overleaf.",
      "2) Upload main.tex (and optional assets) from this folder.",
      "3) Compile with pdfLaTeX.",
      "",
      `Source markdown: ${path.basename(sourceCopyPath)}`,
      "If your paper includes local images, upload those image files to Overleaf as well.",
    ].join("\n"),
    "utf8"
  );

  console.log(`Overleaf project exported to: ${outDir}`);
  console.log(`Main LaTeX file: ${mainTexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
