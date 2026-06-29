# Copy Reference C#

Copy compact C# references from VS Code for Unity workflows, AI prompts, bug reports, code reviews, logs, and docs.

## What It Copies

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
- Supports multi-cursor
- Supports multi-line selections
- Falls back to line context when variable context cannot be resolved
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

## Packaging

```powershell
npm install
npm run build
npx @vscode/vsce package
```

This creates a `.vsix` file that can be installed with:

```powershell
code --install-extension .\copy-reference-csharp-0.0.1.vsix
```
