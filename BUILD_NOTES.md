# Troika Build and Deployment Notes

## Continuous Integration

All pushes to the GitHub repository's master branch, as well as all PRs, will be automatically built and tested by [Github Actions](https://github.com/protectwise/troika/actions).

Documentation will also be built and deployed to the docs site for every push to the master branch.

## Publishing New Versions

When the master branch is to a point where a new release is needed, execute the following from your local repository root directory:

First, validate it's releasable:

```bash
npm run build
npm run test
npm run lint
npm run build-examples
```

Then:

```bash
npx lerna version
```

This will prompt you for the new version number, perform all the required updates to the various `package.json` files including cross-referenced dependency versions, create a new Git tag for that version, and push the result to GitHub.

If you don't want it to push to GitHub yet, use:

```bash
npx lerna version --no-push
```

...and then manually push to GitHub when you're ready (don't forget to push the tag!)

At this point the CI will build and test the new tagged version, but it is _not_ currently set up to publish the results to the NPM registry; for the time being that will be a manual process. To do that:

- Make sure the tagged commit is checked out, with no extra files hanging around

- Run:

  ```bash
  npm run build
  ```

- Make sure you're logged in to an NPM account with permissions to publish to the various troika packages (`npm login`)

- Run:

  ```bash
  npx lerna publish from-git
  ```

## Examples

- Run the dev server: `npm run examples`
- Build the examples: `npm run build-examples`
- React/Three alignment: Examples track React/ReactDOM ^19.2.1 and Three ^0.182.0; keep any new example-specific deps in sync with root versions.
- react-dat-gui CSS is vendored at `packages/troika-examples/_shared/react-dat-gui.css`; import that file in new examples instead of the package CSS path to avoid export-map resolution issues.

## VS Code Workspace Setup

This repository uses a **multi-root workspace** for better monorepo isolation and IntelliSense.

### Opening the Workspace

Instead of opening the repository folder directly, open the workspace file:

```bash
code troika.code-workspace
```

Or from VS Code: **File → Open Workspace from File** → `troika.code-workspace`

### Benefits

1. **Per-package IntelliSense**: Each package has its own `jsconfig.json` with correct dependency paths
2. **Isolated settings**: Package-specific ESLint/formatter configs when needed
3. **Focused navigation**: Search/files scoped to the active package in the sidebar
4. **Build tasks**: Use **Terminal → Run Task** to build specific packages or all
5. **Debugging**: Preconfigured launch configs for Jest and Examples dev server

### Package Structure

Each package has:

- **jsconfig.json** - TypeScript/JavaScript project config with path mappings to sibling packages
- **src/** - Source code (resolved via "module:src" field in package.json during dev)
- **dist/** - Built outputs (UMD, ESM)

### Adding New Packages

When creating a new package:

1. Add it to `lerna.json` if outside `packages/` directory
2. Create `packages/your-package/jsconfig.json` with correct paths to dependencies
3. Add a folder entry in `troika.code-workspace`:
   ```json
   {
     "name": "📦 your-package",
     "path": "packages/your-package"
   }
   ```
4. Run `npm run bootstrap` to create Lerna symlinks

### Switching Between Workspace and Folder Mode

- **Workspace mode** (recommended): Better for monorepo development with package isolation
- **Folder mode**: Open just the root folder if you prefer simpler setup

The workspace settings are compatible with folder mode; you can switch between them freely.
