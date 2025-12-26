# VS Code Workspace Migration Guide

This document explains the VS Code workspace setup for the Troika monorepo.

## What Changed

### Before (Single Folder)

- One root `jsconfig.json` covering all packages
- Empty `.vscode/` directory
- Global settings apply to everything
- IntelliSense can't distinguish between sibling packages and node_modules

### After (Multi-Root Workspace)

- `troika.code-workspace` defines 14 workspace folders (root + 13 packages)
- Each package has its own `jsconfig.json` with path mappings
- `.vscode/` contains shared settings and tasks
- Better IntelliSense, debugging, and navigation per package

## Files Created

### Root Level

- **troika.code-workspace** - Multi-root workspace definition

  - 14 folders: 🏠 Root + 13 package folders with emoji icons
  - Shared settings (editor, ESLint, search exclusions)
  - Extension recommendations (ESLint, Prettier, Jest, etc.)
  - Debug launch configs (Jest tests, Chrome for examples)

- **.vscode/settings.json** - Shared editor settings

  - Format on save
  - ESLint auto-fix
  - Relative import preferences
  - Search/file exclusions

- **.vscode/tasks.json** - Build and test tasks
  - "Build All Packages" (Ctrl+Shift+B)
  - "Build Examples"
  - "Test All" (Ctrl+Shift+T)
  - "Lint All"
  - "Run Examples Dev Server"
  - "Bootstrap (Lerna)"

### Per-Package jsconfig.json

Each package now has its own JavaScript project configuration:

#### Library Packages

- **troika-core** - Foundation library
- **troika-animation** - Animation system (depends on troika-core)
- **troika-worker-utils** - Web Worker utilities (standalone, uses WebWorker lib)
- **troika-flex-layout** - Flexbox layout (pure computation, no DOM APIs)

#### Rendering Packages

- **troika-2d** - 2D canvas framework
- **troika-3d** - Three.js 3D framework
- **troika-three-utils** - Three.js utilities
- **troika-three-text** - SDF text rendering (uses WebWorker lib)
- **troika-3d-text** - 3D text facade
- **troika-3d-ui** - Flexbox-based 3D UI
- **troika-xr** - WebXR support

#### Standalone Packages

- **three-instanced-uniforms-mesh** - Instancing utility
- **troika-examples** - Examples app (uses JSX, depends on all packages)

Each `jsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "baseUrl": ".",
    "paths": {
      "troika-*": ["../troika-*/src"], // Map to sibling source
      "specific-dep": ["../specific-dep/src"] // Explicit deps
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## What Was Migrated

### From Root jsconfig.json

The original root `jsconfig.json` settings were distributed:

- **target: ES2020** → all packages
- **module: ES2020** → all packages
- **lib: ES2020, DOM, DOM.Iterable** → most packages
  - troika-worker-utils uses WebWorker instead of DOM
  - troika-flex-layout omits DOM (pure computation)
  - troika-three-text uses both DOM and WebWorker
- **moduleResolution: node** → all packages
- **allowSyntheticDefaultImports: true** → all packages
- **experimentalDecorators: true** → packages using facades (troika-core, troika-3d, etc.)

### New Per-Package Features

Each `jsconfig.json` now specifies:

1. **Correct lib arrays** for the package's environment
2. **Path mappings** to sibling packages (resolves to `/src` during dev)
3. **Include/exclude** patterns specific to package structure
4. **jsx: react** for troika-examples only

## How to Use the Workspace

### Opening

```bash
# From terminal
code troika.code-workspace

# Or in VS Code
File → Open Workspace from File → troika.code-workspace
```

### Navigation

The sidebar now shows 14 workspace folders. Click any folder to focus on that package:

```
🏠 Root                  # Repository root (lerna, rollup configs)
📦 troika-core          # Core library
📦 troika-animation     # Animation system
... (11 more packages)
🎬 Examples             # Examples app
```

### IntelliSense Improvements

**Before**: Importing from sibling packages showed `node_modules/troika-3d` paths

**After**: IntelliSense resolves to the actual source:

```javascript
import { Object3DFacade } from "troika-3d";
// Resolves to: ../troika-3d/src/facade/Object3DFacade.js
```

Hover over imports to see the correct file path.

### Tasks

Press **Ctrl+Shift+P** → **Tasks: Run Task** to access:

- **Build All Packages** - Runs lerna build (default build task)
- **Build Examples** - Builds examples bundle
- **Test All** - Runs Jest across all packages (default test task)
- **Lint All** - ESLint across all packages
- **Run Examples Dev Server** - Starts dev server on port 10001
- **Bootstrap (Lerna)** - Re-symlink packages after `npm install`

Or use keyboard shortcuts:

- **Ctrl+Shift+B** → Build All Packages
- **Ctrl+Shift+T** → Test All

### Debugging

**F5** or **Run → Start Debugging** provides:

1. **Jest All** - Debug all tests across packages
2. **Jest Current File** - Debug just the open test file
3. **Launch Examples in Chrome** - Opens http://localhost:10001 with debugger attached

### Search

Search is now **scoped to the active workspace folder**:

- Open a file in troika-three-text
- Press **Ctrl+Shift+F** to search
- Results limited to troika-three-text by default
- Use "files to include" field to search across multiple packages

## Workspace vs Folder Mode

### Workspace Mode (Recommended for Developers)

**Pros**:

- Per-package IntelliSense
- Better import resolution
- Package-specific settings
- Organized sidebar
- Preconfigured tasks/debugging

**Cons**:

- More complex setup
- Slightly slower initial load

**Best for**: Active development, debugging, refactoring

### Folder Mode (Single Root)

**Pros**:

- Simpler setup
- Faster initial load
- Works with existing `.vscode/` configs

**Cons**:

- No per-package isolation
- IntelliSense confusion with sibling imports
- Harder to focus on specific packages

**Best for**: Quick edits, CI/CD, read-only exploration

## Troubleshooting

### "Cannot find module 'troika-core'"

1. Ensure Lerna symlinks exist: `npm run bootstrap`
2. Check `jsconfig.json` in the current package has correct `paths`
3. Reload VS Code window: **Ctrl+Shift+P** → **Developer: Reload Window**

### IntelliSense Not Working

1. Check the active folder in sidebar (click the package folder)
2. Verify `jsconfig.json` exists in that package
3. Restart TypeScript server: **Ctrl+Shift+P** → **TypeScript: Restart TS Server**

### Tasks Not Found

1. Ensure you opened via `troika.code-workspace`, not just the folder
2. Check `.vscode/tasks.json` exists in root
3. Reload window if tasks were just added

### Wrong Package in Debugger

Launch configs use `${workspaceFolder:🏠 Root}` to always reference the root. If debugging fails:

1. Check `node_modules/.bin/jest` exists (run `npm install` in root)
2. Ensure dev server is running for Chrome debugging

## Migration Checklist

If you were previously using folder mode:

- [ ] Close the current folder in VS Code
- [ ] Open `troika.code-workspace` instead
- [ ] Verify all 14 folders appear in sidebar
- [ ] Test IntelliSense by opening a file and hovering over imports
- [ ] Run a build task: **Ctrl+Shift+B**
- [ ] Run tests: **Ctrl+Shift+T**
- [ ] Start examples dev server: **Terminal → Run Task → Run Examples Dev Server**
- [ ] Debug examples: **F5 → Launch Examples in Chrome**

## Adding New Packages

When creating a new package:

1. **Create package directory**: `packages/my-new-package/`

2. **Add package.json**:

   ```json
   {
     "name": "troika-my-new-package",
     "main": "dist/troika-my-new-package.umd.js",
     "module": "dist/troika-my-new-package.esm.js",
     "module:src": "src/index.js"
   }
   ```

3. **Create jsconfig.json**:

   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ES2020",
       "lib": ["ES2020", "DOM"],
       "moduleResolution": "node",
       "baseUrl": ".",
       "paths": {
         "troika-core": ["../troika-core/src"],
         "troika-*": ["../*"]
       }
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

4. **Add to workspace**: Edit `troika.code-workspace`:

   ```json
   {
     "folders": [
       // ... existing folders ...
       {
         "name": "📦 my-new-package",
         "path": "packages/troika-my-new-package"
       }
     ]
   }
   ```

5. **Bootstrap**: `npm run bootstrap`

6. **Reload VS Code**: **Ctrl+Shift+P** → **Developer: Reload Window**

## Rollback (If Needed)

If you want to revert to single folder mode:

1. Close the workspace
2. Open just the root folder: **File → Open Folder** → `troika/`
3. The root `jsconfig.json` still exists and will work in folder mode
4. Per-package `jsconfig.json` files don't interfere with folder mode

**Note**: You can keep both the workspace file and per-package configs; VS Code will use whichever mode you're in.

## Additional Resources

- [VS Code Multi-Root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)
- [jsconfig.json Reference](https://code.visualstudio.com/docs/languages/jsconfig)
- [VS Code Tasks](https://code.visualstudio.com/docs/editor/tasks)
- [Debugging in VS Code](https://code.visualstudio.com/docs/editor/debugging)

---

**Created**: During 2025 Troika modernization (Rollup v4, React 19, Three.js r182 upgrade)
