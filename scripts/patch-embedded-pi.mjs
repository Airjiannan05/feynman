import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const piPackageRoot = resolve(appRoot, "node_modules", "@mariozechner", "pi-coding-agent");
const packageJsonPath = resolve(piPackageRoot, "package.json");
const cliPath = resolve(piPackageRoot, "dist", "cli.js");
const bunCliPath = resolve(piPackageRoot, "dist", "bun", "cli.js");
const interactiveModePath = resolve(piPackageRoot, "dist", "modes", "interactive", "interactive-mode.js");
const interactiveThemePath = resolve(piPackageRoot, "dist", "modes", "interactive", "theme", "theme.js");
const piTuiRoot = resolve(appRoot, "node_modules", "@mariozechner", "pi-tui");
const editorPath = resolve(piTuiRoot, "dist", "components", "editor.js");
const workspaceRoot = resolve(appRoot, ".pi", "npm", "node_modules");
const webAccessPath = resolve(workspaceRoot, "pi-web-access", "index.ts");
const sessionSearchIndexerPath = resolve(
	workspaceRoot,
	"@kaiserlich-dev",
	"pi-session-search",
	"extensions",
	"indexer.ts",
);
const piMemoryPath = resolve(workspaceRoot, "@samfp", "pi-memory", "src", "index.ts");
const settingsPath = resolve(appRoot, ".pi", "settings.json");
const workspaceDir = resolve(appRoot, ".pi", "npm");
const workspacePackageJsonPath = resolve(workspaceDir, "package.json");

function ensurePackageWorkspace() {
	if (!existsSync(settingsPath)) {
		return;
	}

	const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
	const packageSpecs = Array.isArray(settings.packages)
		? settings.packages
			.filter((value) => typeof value === "string" && value.startsWith("npm:"))
			.map((value) => value.slice(4))
		: [];

	if (packageSpecs.length === 0) {
		return;
	}

	mkdirSync(workspaceDir, { recursive: true });

	writeFileSync(
		workspacePackageJsonPath,
		JSON.stringify(
			{
				name: "pi-extensions",
				private: true,
				dependencies: Object.fromEntries(packageSpecs.map((spec) => [spec, "latest"])),
			},
			null,
			2,
		) + "\n",
		"utf8",
	);

	const npmExec = process.env.npm_execpath;
	const install = npmExec
		? spawnSync(process.execPath, [npmExec, "install", "--prefix", workspaceDir, ...packageSpecs], {
				stdio: "inherit",
			})
		: spawnSync("npm", ["install", "--prefix", workspaceDir, ...packageSpecs], {
				stdio: "inherit",
			});

	if (install.status !== 0) {
		console.warn("[feynman] warning: failed to preinstall default Pi packages into .pi/npm");
	}
}

ensurePackageWorkspace();

if (existsSync(packageJsonPath)) {
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	if (pkg.piConfig?.name !== "feynman") {
		pkg.piConfig = {
			...(pkg.piConfig || {}),
			name: "feynman",
		};
		writeFileSync(packageJsonPath, JSON.stringify(pkg, null, "\t") + "\n", "utf8");
	}
}

for (const entryPath of [cliPath, bunCliPath]) {
	if (!existsSync(entryPath)) {
		continue;
	}

	const cliSource = readFileSync(entryPath, "utf8");
	if (cliSource.includes('process.title = "pi";')) {
		writeFileSync(entryPath, cliSource.replace('process.title = "pi";', 'process.title = "feynman";'), "utf8");
	}
}

if (existsSync(interactiveModePath)) {
	const interactiveModeSource = readFileSync(interactiveModePath, "utf8");
	if (interactiveModeSource.includes("`π - ${sessionName} - ${cwdBasename}`")) {
		writeFileSync(
			interactiveModePath,
			interactiveModeSource
				.replace("`π - ${sessionName} - ${cwdBasename}`", "`feynman - ${sessionName} - ${cwdBasename}`")
				.replace("`π - ${cwdBasename}`", "`feynman - ${cwdBasename}`"),
			"utf8",
		);
	}
}

if (existsSync(interactiveThemePath)) {
	let themeSource = readFileSync(interactiveThemePath, "utf8");
	const desiredGetEditorTheme = [
		"export function getEditorTheme() {",
		"    return {",
		'        borderColor: (text) => " ".repeat(text.length),',
		'        bgColor: (text) => theme.bg("userMessageBg", text),',
		'        placeholderText: "Type your message",',
		'        placeholder: (text) => theme.fg("dim", text),',
		"        selectList: getSelectListTheme(),",
		"    };",
		"}",
	].join("\n");
	themeSource = themeSource.replace(
		/export function getEditorTheme\(\) \{[\s\S]*?\n\}\nexport function getSettingsListTheme\(\) \{/m,
		`${desiredGetEditorTheme}\nexport function getSettingsListTheme() {`,
	);
	writeFileSync(interactiveThemePath, themeSource, "utf8");
}

if (existsSync(editorPath)) {
	let editorSource = readFileSync(editorPath, "utf8");
	const importOriginal =
		'import { getSegmenter, isPunctuationChar, isWhitespaceChar, truncateToWidth, visibleWidth } from "../utils.js";';
	const importReplacement =
		'import { applyBackgroundToLine, getSegmenter, isPunctuationChar, isWhitespaceChar, truncateToWidth, visibleWidth } from "../utils.js";';
	if (editorSource.includes(importOriginal)) {
		editorSource = editorSource.replace(importOriginal, importReplacement);
	}
	const desiredRender = [
		"    render(width) {",
		"        const maxPadding = Math.max(0, Math.floor((width - 1) / 2));",
		"        const paddingX = Math.min(this.paddingX, maxPadding);",
		"        const contentWidth = Math.max(1, width - paddingX * 2);",
		"        // Layout width: with padding the cursor can overflow into it,",
		"        // without padding we reserve 1 column for the cursor.",
		"        const layoutWidth = Math.max(1, contentWidth - (paddingX ? 0 : 1));",
		"        // Store for cursor navigation (must match wrapping width)",
		"        this.lastWidth = layoutWidth;",
		'        const horizontal = this.borderColor("─");',
		"        const bgColor = this.theme.bgColor;",
		"        // Layout the text",
		"        const layoutLines = this.layoutText(layoutWidth);",
		"        // Calculate max visible lines: 30% of terminal height, minimum 5 lines",
		"        const terminalRows = this.tui.terminal.rows;",
		"        const maxVisibleLines = Math.max(5, Math.floor(terminalRows * 0.3));",
		"        // Find the cursor line index in layoutLines",
		"        let cursorLineIndex = layoutLines.findIndex((line) => line.hasCursor);",
		"        if (cursorLineIndex === -1)",
		"            cursorLineIndex = 0;",
		"        // Adjust scroll offset to keep cursor visible",
		"        if (cursorLineIndex < this.scrollOffset) {",
		"            this.scrollOffset = cursorLineIndex;",
		"        }",
		"        else if (cursorLineIndex >= this.scrollOffset + maxVisibleLines) {",
		"            this.scrollOffset = cursorLineIndex - maxVisibleLines + 1;",
		"        }",
		"        // Clamp scroll offset to valid range",
		"        const maxScrollOffset = Math.max(0, layoutLines.length - maxVisibleLines);",
		"        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScrollOffset));",
		"        // Get visible lines slice",
		"        const visibleLines = layoutLines.slice(this.scrollOffset, this.scrollOffset + maxVisibleLines);",
		"        const result = [];",
		'        const leftPadding = " ".repeat(paddingX);',
		"        const rightPadding = leftPadding;",
		"        const renderBorderLine = (indicator) => {",
		"            const remaining = width - visibleWidth(indicator);",
		"            if (remaining >= 0) {",
		'                return this.borderColor(indicator + "─".repeat(remaining));',
		"            }",
		"            return this.borderColor(truncateToWidth(indicator, width));",
		"        };",
		"        // Render top padding row. When background fill is active, mimic the user-message block",
		"        // instead of the stock editor chrome.",
		"        if (bgColor) {",
		"            if (this.scrollOffset > 0) {",
		"                const indicator = `  ↑ ${this.scrollOffset} more`;",
		"                result.push(applyBackgroundToLine(indicator, width, bgColor));",
		"            }",
		"            else {",
		'                result.push(applyBackgroundToLine("", width, bgColor));',
		"            }",
		"        }",
		"        else if (this.scrollOffset > 0) {",
		"            const indicator = `─── ↑ ${this.scrollOffset} more `;",
		"            result.push(renderBorderLine(indicator));",
		"        }",
		"        else {",
		"            result.push(horizontal.repeat(width));",
		"        }",
		"        // Render each visible layout line",
		"        // Emit hardware cursor marker only when focused and not showing autocomplete",
		"        const emitCursorMarker = this.focused && !this.autocompleteState;",
		"        const showPlaceholder = this.state.lines.length === 1 &&",
		'            this.state.lines[0] === "" &&',
		'            typeof this.theme.placeholderText === "string" &&',
		"            this.theme.placeholderText.length > 0;",
		"        for (let visibleIndex = 0; visibleIndex < visibleLines.length; visibleIndex++) {",
		"            const layoutLine = visibleLines[visibleIndex];",
		"            const isFirstLayoutLine = this.scrollOffset + visibleIndex === 0;",
		"            let displayText = layoutLine.text;",
		"            let lineVisibleWidth = visibleWidth(layoutLine.text);",
		"            let cursorInPadding = false;",
		"            const isPlaceholderLine = showPlaceholder && isFirstLayoutLine;",
		"            // Add cursor if this line has it",
		"            if (isPlaceholderLine) {",
		"                const marker = emitCursorMarker ? CURSOR_MARKER : \"\";",
		"                const rawPlaceholder = this.theme.placeholderText;",
		"                const graphemes = [...this.segment(rawPlaceholder)];",
		'                const firstGrapheme = graphemes[0]?.segment ?? " ";',
		"                const restRaw = rawPlaceholder.slice(firstGrapheme.length);",
		'                const restStyled = typeof this.theme.placeholder === "function"',
		"                    ? this.theme.placeholder(restRaw)",
		"                    : restRaw;",
		'                displayText = marker + `\\x1b[7m${firstGrapheme}\\x1b[27m` + restStyled;',
		"                lineVisibleWidth = visibleWidth(rawPlaceholder);",
		"            }",
		"            else if (layoutLine.hasCursor && layoutLine.cursorPos !== undefined) {",
		"                const before = displayText.slice(0, layoutLine.cursorPos);",
		"                const after = displayText.slice(layoutLine.cursorPos);",
		"                // Hardware cursor marker (zero-width, emitted before fake cursor for IME positioning)",
		'                const marker = emitCursorMarker ? CURSOR_MARKER : "";',
		"                if (after.length > 0) {",
		"                    // Cursor is on a character (grapheme) - replace it with highlighted version",
		"                    // Get the first grapheme from 'after'",
		"                    const afterGraphemes = [...this.segment(after)];",
		'                    const firstGrapheme = afterGraphemes[0]?.segment || "";',
		"                    const restAfter = after.slice(firstGrapheme.length);",
		'                    const cursor = `\\x1b[7m${firstGrapheme}\\x1b[27m`;',
		"                    displayText = before + marker + cursor + restAfter;",
		"                    // lineVisibleWidth stays the same - we're replacing, not adding",
		"                }",
		"                else {",
		"                    // Cursor is at the end - add highlighted space",
		'                    const cursor = "\\x1b[7m \\x1b[27m";',
		"                    displayText = before + marker + cursor;",
		"                    lineVisibleWidth = lineVisibleWidth + 1;",
		"                    // If cursor overflows content width into the padding, flag it",
		"                    if (lineVisibleWidth > contentWidth && paddingX > 0) {",
		"                        cursorInPadding = true;",
		"                    }",
		"                }",
		"            }",
		"            // Calculate padding based on actual visible width",
		'            const padding = " ".repeat(Math.max(0, contentWidth - lineVisibleWidth));',
		"            const lineRightPadding = cursorInPadding ? rightPadding.slice(1) : rightPadding;",
		"            const renderedLine = `${leftPadding}${displayText}${padding}${lineRightPadding}`;",
		"            result.push(bgColor ? applyBackgroundToLine(renderedLine, width, bgColor) : renderedLine);",
		"        }",
		"        // Render bottom padding row. When background fill is active, mimic the user-message block",
		"        // instead of the stock editor chrome.",
		"        const linesBelow = layoutLines.length - (this.scrollOffset + visibleLines.length);",
		"        if (bgColor) {",
		"            if (linesBelow > 0) {",
		"                const indicator = `  ↓ ${linesBelow} more`;",
		"                result.push(applyBackgroundToLine(indicator, width, bgColor));",
		"            }",
		"            else {",
		'                result.push(applyBackgroundToLine("", width, bgColor));',
		"            }",
		"        }",
		"        else if (linesBelow > 0) {",
		"            const indicator = `─── ↓ ${linesBelow} more `;",
		"            const bottomLine = renderBorderLine(indicator);",
		"            result.push(bottomLine);",
		"        }",
		"        else {",
		"            const bottomLine = horizontal.repeat(width);",
		"            result.push(bottomLine);",
		"        }",
		"        // Add autocomplete list if active",
		"        if (this.autocompleteState && this.autocompleteList) {",
		"            const autocompleteResult = this.autocompleteList.render(contentWidth);",
		"            for (const line of autocompleteResult) {",
		"                const lineWidth = visibleWidth(line);",
		'                const linePadding = " ".repeat(Math.max(0, contentWidth - lineWidth));',
		"                const autocompleteLine = `${leftPadding}${line}${linePadding}${rightPadding}`;",
		"                result.push(bgColor ? applyBackgroundToLine(autocompleteLine, width, bgColor) : autocompleteLine);",
		"            }",
		"        }",
		"        return result;",
		"    }",
	].join("\n");
	editorSource = editorSource.replace(
		/    render\(width\) \{[\s\S]*?\n    handleInput\(data\) \{/m,
		`${desiredRender}\n    handleInput(data) {`,
	);
	writeFileSync(editorPath, editorSource, "utf8");
}

if (existsSync(webAccessPath)) {
	const source = readFileSync(webAccessPath, "utf8");
	if (source.includes('pi.registerCommand("search",')) {
		writeFileSync(
			webAccessPath,
			source.replace('pi.registerCommand("search",', 'pi.registerCommand("web-results",'),
			"utf8",
		);
	}
}

if (existsSync(sessionSearchIndexerPath)) {
	const source = readFileSync(sessionSearchIndexerPath, "utf8");
	const original = 'const sessionsDir = path.join(os.homedir(), ".pi", "agent", "sessions");';
	const replacement =
		'const sessionsDir = process.env.FEYNMAN_SESSION_DIR ?? process.env.PI_SESSION_DIR ?? path.join(os.homedir(), ".pi", "agent", "sessions");';
	if (source.includes(original)) {
		writeFileSync(sessionSearchIndexerPath, source.replace(original, replacement), "utf8");
	}
}

if (existsSync(piMemoryPath)) {
	let source = readFileSync(piMemoryPath, "utf8");
	const memoryOriginal = 'const MEMORY_DIR = join(homedir(), ".pi", "memory");';
	const memoryReplacement =
		'const MEMORY_DIR = process.env.FEYNMAN_MEMORY_DIR ?? process.env.PI_MEMORY_DIR ?? join(homedir(), ".pi", "memory");';
	if (source.includes(memoryOriginal)) {
		source = source.replace(memoryOriginal, memoryReplacement);
	}
	const execOriginal = 'const result = await pi.exec("pi", ["-p", prompt, "--print"], {';
	const execReplacement = [
		'const execBinary = process.env.FEYNMAN_NODE_EXECUTABLE || process.env.FEYNMAN_EXECUTABLE || "pi";',
		'      const execArgs = process.env.FEYNMAN_BIN_PATH',
		'        ? [process.env.FEYNMAN_BIN_PATH, "--prompt", prompt]',
		'        : ["-p", prompt, "--print"];',
		'      const result = await pi.exec(execBinary, execArgs, {',
	].join("\n");
	if (source.includes(execOriginal)) {
		source = source.replace(execOriginal, execReplacement);
	}
	writeFileSync(piMemoryPath, source, "utf8");
}
