import * as path from "path";
import * as vscode from "vscode";

type SymbolNode = {
  symbol: vscode.DocumentSymbol;
  parent?: SymbolNode;
};

type CopySettings = {
  includeNamespace: boolean;
  includeFilePath: boolean;
  separator: string;
  dedupe: boolean;
};

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("copyReferenceCSharp.copyVariableContext", async () => {
      await copyVariableContext();
    }),
    vscode.commands.registerCommand("copyReferenceCSharp.copyPositionContext", async () => {
      await copyPositionContext();
    }),
  );
}

export function deactivate(): void {}

async function copyVariableContext(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isCSharpDocument(editor.document)) {
    void vscode.window.showWarningMessage("Copy Reference C# only supports .cs files.");
    return;
  }

  const symbols = await getFlattenedSymbols(editor.document);
  const entries = editor.selections
    .map((selection) => buildVariableEntry(editor.document, selection, symbols)
      ?? buildPositionEntry(editor.document, selection, symbols))
    .filter((entry): entry is string => Boolean(entry));

  await writeEntries(entries, getSettings());
}

async function copyPositionContext(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isCSharpDocument(editor.document)) {
    void vscode.window.showWarningMessage("Copy Reference C# only supports .cs files.");
    return;
  }

  const symbols = await getFlattenedSymbols(editor.document);
  const entries = editor.selections
    .map((selection) => buildPositionEntry(editor.document, selection, symbols))
    .filter((entry): entry is string => Boolean(entry));

  await writeEntries(entries, getSettings());
}

function isCSharpDocument(document: vscode.TextDocument): boolean {
  return path.extname(document.uri.fsPath).toLowerCase() === ".cs";
}

function getSettings(): CopySettings {
  const config = vscode.workspace.getConfiguration("copySymbolContext");
  return {
    includeNamespace: config.get<boolean>("includeNamespace", false),
    includeFilePath: config.get<boolean>("includeFilePath", false),
    separator: config.get<string>("separator", ".") || ".",
    dedupe: config.get<boolean>("dedupe", true),
  };
}

async function getFlattenedSymbols(document: vscode.TextDocument): Promise<SymbolNode[]> {
  const provided = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    document.uri,
  );

  if (!provided) {
    return [];
  }

  const flattened: SymbolNode[] = [];
  const visit = (symbol: vscode.DocumentSymbol, parent?: SymbolNode): void => {
    const node: SymbolNode = { symbol, parent };
    flattened.push(node);
    for (const child of symbol.children) {
      visit(child, node);
    }
  };

  for (const symbol of provided) {
    visit(symbol);
  }

  return flattened;
}

function buildVariableEntry(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  symbols: SymbolNode[],
): string | undefined {
  if (!selection.isEmpty && selection.start.line !== selection.end.line) {
    return buildPositionEntry(document, selection, symbols);
  }

  const position = getSelectionAnchor(selection);
  const symbolNode = findInnermostSymbolAtPosition(symbols, position);
  const settings = getSettings();
  if (symbolNode && isVariableLikeKind(symbolNode.symbol.kind)) {
    const container = findVariableContainer(symbolNode);
    const prefix = container
      ? buildVariablePrefix(document, container, settings)
      : buildFilePrefix(document, settings);

    return `${prefix}${settings.separator}${getVariableBaseName(symbolNode.symbol.name)}:line ${position.line + 1}`;
  }

  const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
  if (!wordRange) {
    return undefined;
  }

  const variableName = document.getText(wordRange);
  const methodNode = findMethodLikeContainer(symbols, position);
  if (methodNode) {
    return `${buildMethodScopedName(document, methodNode, settings, false)}${settings.separator}${variableName}:line ${position.line + 1}`;
  }

  const typeNode = findTypeLikeContainer(symbols, position);
  if (typeNode) {
    return `${buildTypeScopedName(document, typeNode, settings)}${settings.separator}${variableName}:line ${position.line + 1}`;
  }

  return `${buildFilePrefix(document, settings)}${settings.separator}${variableName}:line ${position.line + 1}`;
}

function buildPositionEntry(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  symbols: SymbolNode[],
): string {
  const settings = getSettings();
  if (!selection.isEmpty) {
    return buildRangePositionEntry(document, selection, symbols, settings);
  }

  const position = selection.active;
  const methodNode = findMethodLikeContainer(symbols, position);
  if (methodNode) {
    return `${buildMethodScopedName(document, methodNode, settings, false)}:line ${position.line + 1}`;
  }

  return `${buildFilePrefix(document, settings)}:line ${position.line + 1}`;
}

function getSelectionAnchor(selection: vscode.Selection): vscode.Position {
  if (!selection.isEmpty) {
    return selection.start;
  }

  return selection.active;
}

function findInnermostSymbolAtPosition(symbols: SymbolNode[], position: vscode.Position): SymbolNode | undefined {
  const matching = symbols.filter((node) => node.symbol.selectionRange.contains(position));
  return matching.sort(compareBySelectionSpecificity)[0];
}

function findMethodLikeContainer(symbols: SymbolNode[], position: vscode.Position): SymbolNode | undefined {
  const matching = symbols
    .filter((node) => isMethodLikeKind(node.symbol.kind) && node.symbol.range.contains(position))
    .sort(compareByRangeSpecificity);

  return matching[0];
}

function findVariableContainer(symbolNode: SymbolNode): SymbolNode | undefined {
  let current = symbolNode.parent;
  while (current) {
    if (isMethodLikeKind(current.symbol.kind) || isTypeLikeKind(current.symbol.kind)) {
      return current;
    }

    current = current.parent;
  }

  return undefined;
}

function findTypeLikeContainer(symbols: SymbolNode[], position: vscode.Position): SymbolNode | undefined {
  const matching = symbols
    .filter((node) => isTypeLikeKind(node.symbol.kind) && node.symbol.range.contains(position))
    .sort(compareByRangeSpecificity);

  return matching[0];
}

function compareBySelectionSpecificity(a: SymbolNode, b: SymbolNode): number {
  const aSpan = a.symbol.selectionRange.end.character - a.symbol.selectionRange.start.character
    + (a.symbol.selectionRange.end.line - a.symbol.selectionRange.start.line) * 10000;
  const bSpan = b.symbol.selectionRange.end.character - b.symbol.selectionRange.start.character
    + (b.symbol.selectionRange.end.line - b.symbol.selectionRange.start.line) * 10000;

  return aSpan - bSpan;
}

function compareByRangeSpecificity(a: SymbolNode, b: SymbolNode): number {
  const aSpan = a.symbol.range.end.character - a.symbol.range.start.character
    + (a.symbol.range.end.line - a.symbol.range.start.line) * 10000;
  const bSpan = b.symbol.range.end.character - b.symbol.range.start.character
    + (b.symbol.range.end.line - b.symbol.range.start.line) * 10000;

  return aSpan - bSpan;
}

function isVariableLikeKind(kind: vscode.SymbolKind): boolean {
  return [
    vscode.SymbolKind.Field,
    vscode.SymbolKind.Property,
    vscode.SymbolKind.Variable,
  ].includes(kind);
}

function isMethodLikeKind(kind: vscode.SymbolKind): boolean {
  return [
    vscode.SymbolKind.Method,
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Constructor,
  ].includes(kind);
}

function isTypeLikeKind(kind: vscode.SymbolKind): boolean {
  return [
    vscode.SymbolKind.Class,
    vscode.SymbolKind.Struct,
    vscode.SymbolKind.Interface,
    vscode.SymbolKind.Enum,
  ].includes(kind);
}

function buildScopedName(document: vscode.TextDocument, node: SymbolNode, settings: CopySettings): string {
  const chain: string[] = [];
  let current: SymbolNode | undefined = node;

  while (current) {
    if (shouldIncludeInScope(current.symbol.kind)) {
      chain.unshift(stripSymbolDetail(current.symbol.name));
    }
    current = current.parent;
  }

  const filePrefix = buildFilePrefix(document, settings);
  if (chain.length === 0) {
    return filePrefix;
  }

  if (isMethodLikeKind(node.symbol.kind)) {
    return [filePrefix, ...chain].join(settings.separator);
  }

  return [filePrefix, chain[chain.length - 1]].join(settings.separator);
}

function buildVariablePrefix(document: vscode.TextDocument, node: SymbolNode, settings: CopySettings): string {
  if (isMethodLikeKind(node.symbol.kind)) {
    return buildMethodScopedName(document, node, settings, false);
  }

  if (isTypeLikeKind(node.symbol.kind)) {
    return buildTypeScopedName(document, node, settings);
  }

  return buildScopedName(document, node, settings);
}

function buildMethodScopedName(
  document: vscode.TextDocument,
  node: SymbolNode,
  settings: CopySettings,
  includeMethodSignature: boolean,
): string {
  const methodName = includeMethodSignature
    ? getMethodSignatureName(node.symbol.name)
    : getMethodBaseName(node.symbol.name);
  const typeNode = findNearestTypeAncestor(node.parent);
  const filePrefix = buildFilePrefix(document, settings);

  if (!typeNode) {
    return [filePrefix, methodName].join(settings.separator);
  }

  const typeName = stripSymbolDetail(typeNode.symbol.name);
  const parts = filePrefix === typeName
    ? [filePrefix, methodName]
    : [filePrefix, typeName, methodName];

  return parts.join(settings.separator);
}

function buildTypeScopedName(document: vscode.TextDocument, node: SymbolNode, settings: CopySettings): string {
  const filePrefix = buildFilePrefix(document, settings);
  const typeName = stripSymbolDetail(node.symbol.name);

  if (filePrefix === typeName) {
    return filePrefix;
  }

  return [filePrefix, typeName].join(settings.separator);
}

function findNearestTypeAncestor(node?: SymbolNode): SymbolNode | undefined {
  let current = node;
  while (current) {
    if (isTypeLikeKind(current.symbol.kind)) {
      return current;
    }
    current = current.parent;
  }

  return undefined;
}

function buildRangePositionEntry(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  symbols: SymbolNode[],
  settings: CopySettings,
): string {
  const methodNode = findMethodLikeContainer(symbols, selection.start)
    ?? findMethodLikeContainer(symbols, selection.end);
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;

  if (methodNode) {
    return `${buildMethodScopedName(document, methodNode, settings, true)}:line ${startLine}-${endLine}`;
  }

  return `${buildFilePrefix(document, settings)}:line ${startLine}-${endLine}`;
}

function shouldIncludeInScope(kind: vscode.SymbolKind): boolean {
  return isTypeLikeKind(kind) || isMethodLikeKind(kind);
}

function stripSymbolDetail(name: string): string {
  return name.replace(/\(.*\)$/, "").trim();
}

function getMethodBaseName(name: string): string {
  const trimmed = name.trim();
  const parenIndex = trimmed.indexOf("(");
  if (parenIndex >= 0) {
    return trimmed.slice(0, parenIndex).trim();
  }

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex >= 0) {
    return trimmed.slice(0, colonIndex).trim();
  }

  return trimmed;
}

function getMethodSignatureName(name: string): string {
  const trimmed = name.trim();
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex >= 0) {
    return trimmed.slice(0, colonIndex).trim();
  }

  return trimmed;
}

function getVariableBaseName(name: string): string {
  const trimmed = name.trim();
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex >= 0) {
    return trimmed.slice(0, colonIndex).trim();
  }

  return trimmed;
}

function buildFilePrefix(document: vscode.TextDocument, settings: CopySettings): string {
  const fileName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
  const pieces: string[] = [];

  if (settings.includeFilePath) {
    const relative = vscode.workspace.asRelativePath(document.uri, false);
    const withoutExtension = relative.replace(/\.[^./\\]+$/, "");
    const normalized = withoutExtension.replace(/[\\/]/g, settings.separator);
    pieces.push(normalized);
    return pieces.join(settings.separator);
  }

  if (settings.includeNamespace) {
    const namespace = extractNamespace(document);
    if (namespace) {
      pieces.push(...namespace.split("."));
    }
  }

  pieces.push(fileName);
  return pieces.join(settings.separator);
}

function extractNamespace(document: vscode.TextDocument): string | undefined {
  const text = document.getText();
  const blockMatch = text.match(/\bnamespace\s+([A-Za-z_][\w.]*)\s*\{/);
  if (blockMatch) {
    return blockMatch[1];
  }

  const fileScopedMatch = text.match(/\bnamespace\s+([A-Za-z_][\w.]*)\s*;/);
  return fileScopedMatch?.[1];
}

async function writeEntries(entries: string[], settings: CopySettings): Promise<void> {
  const output = settings.dedupe ? Array.from(new Set(entries)) : entries;
  if (output.length === 0) {
    void vscode.window.showWarningMessage("No C# symbol context found at the current selection.");
    return;
  }

  await vscode.env.clipboard.writeText(output.join("\n"));
  void vscode.window.showInformationMessage(`Copied ${output.length} entr${output.length === 1 ? "y" : "ies"} to clipboard.`);
}
