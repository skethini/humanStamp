# Chrome Web Store listing copy

Use this text when publishing HumanStamp to the Chrome Web Store.

## Extension name

HumanStamp

## Short description (132 characters max)

Voluntarily sign Gmail and Outlook drafts you mostly typed yourself. A social signal of personal effort—not AI detection.

## Detailed description

HumanStamp is a voluntary social signal for email writers. It lets you sign a draft when you personally typed more than half of the final message body.

**Supported sites**
- Gmail (web)
- Outlook Web (outlook.com, outlook.live.com, Microsoft 365 web)

**How it works**
1. Open a compose or reply window in Gmail or Outlook.
2. A floating HumanStamp widget appears near the editor.
3. As you type and edit, the extension tracks whether text was typed or pasted.
4. When more than 50% of the body is typed, you become eligible to sign.
5. Click **Add Signature** to append `✍ HumanStamped`. Optionally set a display name in the popup to sign as `✍ HumanStamped by Your Name`.
6. Recipients can hover the signature to verify it matches the message content.

**What HumanStamp is**
- A signal that you meaningfully engaged with the final text
- A voluntary, good-faith indicator—not a guarantee of originality or authorship

**What HumanStamp is not**
- AI detection
- Proof that ideas are original
- A replacement for normal email security or authentication

**Privacy**
- Your full email text stays on your device
- Only a SHA-256 hash of the message body is sent when you choose to sign
- See our privacy policy: https://human-stamp.vercel.app/privacy.html

## Single purpose

Help users voluntarily sign email drafts they mostly typed themselves in Gmail and Outlook Web.

## Permission justifications

| Permission | Justification |
|------------|---------------|
| `storage` | Stores your optional display name and local draft typing state so eligibility persists across sessions. |
| Gmail / Outlook host permissions | Required to inject a content script, detect compose editors, and show the HumanStamp widget only while you write email. |
| `human-stamp.vercel.app` | Hosts the signing API used when you click Add Signature. Only a content hash is transmitted—not your full email. |

### Permissions not requested

| Permission | Why it is not needed |
|------------|----------------------|
| `tabs` | HumanStamp does not read, query, or monitor open tabs. A one-time welcome page on install uses `chrome.tabs.create()`, which does not require the `tabs` permission. |

When the Chrome Web Store asks about host permissions, explain that HumanStamp only runs on Gmail and Outlook compose pages and on the signing API domain—nowhere else.

## Privacy policy URL

https://human-stamp.vercel.app/privacy.html

## Category suggestion

Productivity

## Language

English
