# HumanStamp

HumanStamp is a browser extension that lets people voluntarily sign long-form content they have meaningfully engaged with while writing.

It is a **social signal of personal effort**, not AI detection. A HumanStamp means:

> I personally typed a majority of the final content.

## How it works

1. Open a supported writing surface (Gmail compose, LinkedIn post, etc.).
2. A small **HumanStamp** widget appears near the editor.
3. As you type and edit, the extension tracks whether characters were **typed** or **pasted**.
4. When more than 50% of the final body is typed, status becomes **Eligible**.
5. Click **Add Signature** to append: `✍ HumanStamped by Your Name`
6. If edits drop you below the threshold, the signature is removed automatically.

## Supported sites

- Gmail (web)
- Outlook Web

## Development

### Prerequisites

- Node.js 18+

### Setup

```bash
npm install
npm run build
```

Signing is handled by the hosted service at `https://human-stamp.vercel.app/api/v1/sign`. See [server/README.md](server/README.md) for deployment and local server setup.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository folder

### Watch mode

```bash
npm run watch
```

Reload the extension after changes.

### Configure your name

Click the HumanStamp toolbar icon and set the name shown on signatures.

## Architecture

```
src/
  background/     Service worker
  content/        Editor detection, provenance tracking, widget, signatures
  popup/          User settings (display name)
  shared/         Types and constants
```

- **Provenance tracker** — parallel character map (`typed` | `pasted`) updated on `beforeinput`
- **Eligibility** — `human_ratio > 0.50` on final body text (signature excluded)
- **Site adapters** — per-platform editor selectors and text extraction

## Philosophy

HumanStamp does not prove originality, authorship of ideas, or absence of AI. Users may paste drafts, use AI, and still earn a stamp by substantially retyping the final version.

## License

MIT
