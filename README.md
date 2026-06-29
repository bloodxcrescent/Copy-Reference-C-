# Copy Reference C#

Copy compact C# references from VS Code for Unity workflows, AI prompts, bug reports, code reviews, logs, and docs.

Designed for quickly sharing exact code locations without manually typing file, method, variable, and line information.

## Why

When working in Unity or C#, it is common to paste references into:

- AI chats
- bug reports
- pull request comments
- logs
- technical docs

This extension turns a cursor position or variable selection into a short, readable reference that can be pasted immediately.

## Examples

Variable context examples:

```text
BattleResult.HeroId:line 7
BuildRoundStats.damage:line 12
```

Position context examples:

```text
BattleResult.BuildRoundStats:line 10
BattleResult.OnBattleFinish():line 18-20
BattleResult:line 3
```

## Install

### From Marketplace

Search for `Copy Reference C#` in the VS Code Extensions view.

### From VSIX

Download the packaged extension and install it with:

```powershell
code --install-extension .\copy-reference-csharp-0.0.1.vsix
```

## Commands

- `Copy Variable Context`
- `Copy Position Context`

## Default Shortcuts

- `Ctrl+Alt+C`: Copy variable context
- `Alt+Shift+1`: Copy position context

These shortcuts can be changed in VS Code `Keyboard Shortcuts`.

## Features

- Supports `.cs` files
- Supports fields, properties, parameters, and local variables
- Supports method and line context copying
- Supports multi-cursor
- Supports multi-line selections
- Falls back to line context when variable context cannot be resolved
- Adds commands to the editor right-click menu
- Copies directly to the clipboard

## Settings

```json
{
  "copySymbolContext.includeNamespace": false,
  "copySymbolContext.includeFilePath": false,
  "copySymbolContext.separator": ".",
  "copySymbolContext.dedupe": true
}
```

## Development

```powershell
npm install
npm run build
```

Run the extension in a development host with `F5`.

## Packaging

```powershell
npx @vscode/vsce package
```

This creates a `.vsix` file that can be installed with:

```powershell
code --install-extension .\copy-reference-csharp-0.0.1.vsix
```

## Repository

GitHub: https://github.com/bloodxcrescent/Copy-Reference-C-
