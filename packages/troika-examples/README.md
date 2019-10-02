# `troika-examples`

> A collection of examples demonstrating various Troika features and patterns.

## Usage

### Running as a local web server:

From the repository root, run:

```bash
npm install
npm run examples
```

Then point your browser to [http://localhost:10001](http://localhost:10001)

Changes to the source files will be detected and a rebuild will occur automatically. Live reload of the browser is not currently implemented though.

By default this web server will only be accessible via `localhost` from the same machine. If you want to make the server reachable from other devices on the network, run it like this:

```bash
SERVER_HOST=0.0.0.0 npm run examples
```

### Building a bundle for deployment:

From the repository root, run:

```bash
npm install
npm run build-examples
```
