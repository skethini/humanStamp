# HumanStamp

HumanStamp is a Chrome extension that lets you voluntarily sign email drafts you have meaningfully typed.

It is a **social signal of personal effort**, not AI detection. A HumanStamp means:

> I personally typed a majority of the final content.

## How it works

1. Open a compose or reply window in **Gmail** or **Outlook Web**.
2. A floating **HumanStamp** widget appears near the editor.
3. As you type and edit, the extension tracks whether characters were **typed** or **pasted**.
4. When more than 50% of the final body is typed, status becomes **Eligible**.
5. Click **Add Signature** to append `✍ HumanStamped`, or `✍ HumanStamped by Your Name` if you set a display name in the popup.
6. If you edit the body after signing in a way that invalidates the stamp, the signature is removed.

## Supported sites

- **Gmail** — [mail.google.com](https://mail.google.com)
- **Outlook Web** — outlook.com, outlook.live.com, and Microsoft 365 web mail

HumanStamp only runs on these sites, in compose and reply editors.

## Privacy

HumanStamp does not upload your full email text. When you sign a draft, only a SHA-256 hash of the message body is sent to the signing service.

Privacy policy: [https://human-stamp.vercel.app/privacy.html](https://human-stamp.vercel.app/privacy.html)

## Permissions

HumanStamp requests only:

| Permission | Purpose |
|------------|---------|
| `storage` | Save your optional display name and local draft typing state |
| Gmail / Outlook host access | Inject the widget and track compose editors only |
| `human-stamp.vercel.app` | Call the signing API when you click Add Signature |

HumanStamp does **not** request the `tabs` permission. The welcome page on first install is opened with `chrome.tabs.create()`, which Chrome allows without the `tabs` permission.

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

Reload the extension after changes, then refresh open Gmail/Outlook tabs so content scripts pick up updates.

### Configure your name (optional)

Click the HumanStamp toolbar icon to set an optional name shown on signatures. If left blank, signatures use `✍ HumanStamped` only.

## Architecture

```
src/
  background/     Service worker — signing proxy, display-name storage, welcome tab on install
  content/        Editor detection, provenance tracking, floating widget, signatures
  popup/          Optional display name settings
  onboarding/     First-run welcome page
  shared/         Types, crypto, constants, signature formatting
server/
  api/            Vercel serverless signing endpoint
  public/         Hosted privacy policy
```

- **Provenance tracker** — parallel character map (`typed` | `pasted`) updated on `beforeinput`
- **Eligibility** — `human_ratio > 0.50` on final body text (signature excluded)
- **Site adapters** — Gmail and Outlook editor selectors; floating widget on both
- **Display name** — stored in `chrome.storage.sync` via the background worker; content scripts read it through extension messages (not direct storage access in mail iframes)
- **Draft persistence** — typed/paste maps stored in `chrome.storage.local`, keyed by compose ID + subject + recipients

## Philosophy

HumanStamp does not prove originality, authorship of ideas, or absence of AI. Users may paste drafts, use AI, and still earn a stamp by substantially retyping the final version.

## License

MIT
