# HumanStamp

HumanStamp is a Chrome extension that lets you voluntarily sign email drafts you have meaningfully typed.

It is a **social signal of personal effort**, not AI detection. A HumanStamp means:

> I personally typed a majority of the final content.

## How it works

1. Open a compose or reply window in **Gmail** or **Outlook Web**.
2. A small **HumanStamp** widget appears near the editor.
3. As you type and edit, the extension tracks whether characters were **typed** or **pasted**.
4. When more than 50% of the final body is typed, status becomes **Eligible**.
5. Click **Add Signature** to append: `✍ HumanStamped by Your Name`
6. If you edit the body after signing in a way that invalidates the stamp, the signature is removed.

## Supported sites

- **Gmail** — [mail.google.com](https://mail.google.com)
- **Outlook Web** — outlook.com, outlook.live.com, and Microsoft 365 web mail

HumanStamp only runs on these sites, in compose and reply editors.

## Privacy

HumanStamp does not upload your full email text. When you sign a draft, only a SHA-256 hash of the message body is sent to the signing service.

Privacy policy: [https://human-stamp.vercel.app/privacy.html](https://human-stamp.vercel.app/privacy.html)

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
  background/     Service worker (signing proxy)
  content/        Editor detection, provenance tracking, widget, signatures
  popup/          User settings (display name)
  shared/         Types, crypto, constants
server/
  api/            Vercel serverless signing endpoint
```

- **Provenance tracker** — parallel character map (`typed` | `pasted`) updated on `beforeinput`
- **Eligibility** — `human_ratio > 0.50` on final body text (signature excluded)
- **Site adapters** — Gmail and Outlook editor selectors and text extraction

## Philosophy

HumanStamp does not prove originality, authorship of ideas, or absence of AI. Users may paste drafts, use AI, and still earn a stamp by substantially retyping the final version.

## License

MIT
