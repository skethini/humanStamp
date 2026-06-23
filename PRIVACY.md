# HumanStamp Privacy Policy

**Last updated:** June 21, 2026

HumanStamp (“we”, “the extension”) is a Chrome browser extension that helps you voluntarily sign email drafts you have mostly typed yourself. This policy explains what information the extension handles and how.

## Summary

- HumanStamp runs **only on Gmail and Outlook Web** when you are composing email.
- Your **full email text is not uploaded** to our servers.
- When you sign a draft, only a **SHA-256 hash** of the message body is sent to our signing service.
- Typing/paste tracking and draft metadata are stored **locally in your browser**.
- HumanStamp requests **only the `storage` permission** plus host access to supported mail sites and our signing API. It does **not** request the `tabs` permission.

## Information the extension accesses

While you use a supported compose editor, HumanStamp reads:

- **Message body text** — to track whether characters were typed or pasted, determine eligibility, and insert or verify signatures.
- **Compose metadata** — such as subject and recipient fields, used only to identify drafts locally so eligibility state can be restored when you return to a draft.
- **Display name (optional)** — if you set one in the extension popup, it appears in signatures as `✍ HumanStamped by Your Name`. If you leave it blank, signatures use `✍ HumanStamped` only.

HumanStamp does **not** read your inbox, sent mail, contacts, or email content outside active compose/reply editors.

## Information stored on your device

The extension uses Chrome’s built-in storage:

| Storage | What is stored | Purpose |
|---------|----------------|---------|
| `chrome.storage.sync` | Optional display name | Sync your chosen signature name across Chrome profiles where sync is enabled |
| `chrome.storage.local` | Typed/paste maps for recent drafts, compose session IDs | Restore eligibility when switching drafts, refreshing, or returning later |

Local draft data is kept for up to **64 recent drafts** and is removed when you uninstall the extension or clear extension data.

Display name and draft provenance are read and written by the **background service worker**. Content scripts on mail pages request your display name through extension messages rather than accessing storage directly.

## Information sent to our servers

When you click **Add Signature**, the extension sends a **POST request** to our signing service at:

`https://human-stamp.vercel.app/api/v1/sign`

The request contains:

- A **SHA-256 hash** of your normalized message body (signature block excluded)
- A fixed `eligible: true` flag, timestamp, and version field required by the signing format

It does **not** include:

- Your full email text
- Recipient addresses, subject lines, or account identifiers
- Email passwords or OAuth tokens
- Your display name

The server returns a cryptographic signature embedded in your draft. We do not use signing requests to build user profiles or for advertising.

## Information we do not collect

HumanStamp does **not**:

- Sell personal data
- Use advertising or analytics trackers
- Collect browsing history outside supported mail compose pages
- Access Gmail or Outlook account credentials
- Request permission to read or manage browser tabs

## Permissions

HumanStamp declares these permissions in its manifest:

| Permission | Why it is used |
|------------|----------------|
| `storage` | Save your optional display name and local draft provenance |
| Host access to Gmail / Outlook | Inject a content script and show the widget in compose editors only |
| Host access to `human-stamp.vercel.app` | Request cryptographic signatures from the signing service |

### Permissions HumanStamp does not use

| Permission | Notes |
|------------|-------|
| `tabs` | **Not requested.** HumanStamp does not read, query, or monitor your open tabs. On first install, the extension may open a one-time welcome page using `chrome.tabs.create()`, which Chrome allows without the `tabs` permission. |

No other broad permissions (such as `activeTab`, `scripting`, or `cookies`) are requested.

## Data retention and deletion

- **Local data** — Uninstalling HumanStamp or clearing its data in `chrome://extensions` removes stored draft provenance and settings from your browser.
- **Signing service** — The signing API processes each request to produce a signature and does not need to retain email content because it never receives it. Operational logs on the hosting provider may exist briefly for reliability and security.

## Children’s privacy

HumanStamp is not directed at children under 13, and we do not knowingly collect information from them.

## Changes to this policy

We may update this policy from time to time. The “Last updated” date at the top will change when we do. Continued use of the extension after changes means you accept the revised policy.

## Contact

For privacy questions or requests, open an issue on the HumanStamp GitHub repository for this project.

---

**Hosted copy:** [https://human-stamp.vercel.app/privacy.html](https://human-stamp.vercel.app/privacy.html)
