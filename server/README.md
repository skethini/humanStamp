# HumanStamp signing service

Signs content hashes with the HumanStamp private key. Deployed on Vercel at `https://human-stamp.vercel.app`.

## Vercel setup

1. Set the Vercel project **Root Directory** to `server`.
2. Add an environment variable in the [Vercel project settings](https://vercel.com/sumedha-s-projects1/human-stamp):
   - **Name:** `HUMANSTAMP_PRIVATE_JWK`
   - **Value:** contents of `server/keys/private.jwk` (single-line JSON string)
3. Redeploy after adding the variable.

Generate keys locally:

```bash
npm run generate-keys
```

The public key is written to `src/shared/public-key.ts` for the extension. Never commit `server/keys/private.jwk`.

Static pages in `server/public/` are served at the site root (e.g. `privacy.html`, `demo.html`). The extension welcome page embeds `demo.html` so YouTube receives a normal HTTPS referrer.

## API

`POST /api/v1/sign`

```json
{
  "contentHash": "<sha256 hex>",
  "eligible": true,
  "timestamp": "2026-06-21T00:00:00.000Z",
  "version": "2"
}
```

## Local development

```bash
npm run generate-keys   # once
npm run server          # http://localhost:3847
```

For local-only extension testing, temporarily point `HUMANSTAMP_API_URL` in `src/shared/constants.ts` to `http://localhost:3847/api/v1/sign` and add that host to `manifest.json`.
