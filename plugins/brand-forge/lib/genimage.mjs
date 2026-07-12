// The ONLY networked module in brand-forge. Provider-agnostic image client.
// `fetchImpl` and `sleep` are injectable so the whole thing is unit-testable
// against a stub — no live API calls in the test suite. Opt-in at the skill level.
import { writeFileSync, renameSync } from 'node:fs';

// Provider table. Each entry knows its env var, default model, endpoint, headers,
// request body, and how to pull the base64 image out of the JSON response.
export const PROVIDERS = {
  gemini: {
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash-image',
    endpoint: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: (key) => ({ 'content-type': 'application/json', 'x-goog-api-key': key }),
    body: ({ prompt }) => JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    parse: (json) => json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data,
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-image-1',
    endpoint: () => 'https://api.openai.com/v1/images/generations',
    headers: (key) => ({ 'content-type': 'application/json', authorization: `Bearer ${key}` }),
    body: ({ prompt, size, model }) => JSON.stringify({ model, prompt, size, response_format: 'b64_json' }),
    parse: (json) => json?.data?.[0]?.b64_json,
  },
};

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeAtomic(path, buf) {
  const tmp = `${path}.part`;
  writeFileSync(tmp, buf);
  renameSync(tmp, path); // rename is atomic on the same filesystem → no half-written file
}

// Generate an image and write it to `outPath`. Returns { path, provider, model, bytes }.
export async function generateImage({
  prompt,
  outPath,
  provider = 'gemini',
  model,
  size = '1024x1024',
  apiKey,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  maxRetries = 3,
} = {}) {
  const prov = PROVIDERS[provider];
  if (!prov) {
    throw new Error(`Unknown provider "${provider}". Valid: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  const key = apiKey !== undefined ? apiKey : process.env[prov.envKey];
  if (!key) {
    throw new Error(`Missing API key: set ${prov.envKey} (or pass apiKey) to use the ${provider} provider.`);
  }
  if (!prompt) throw new Error('generateImage requires a `prompt`.');
  if (!outPath) throw new Error('generateImage requires an `outPath`.');

  const resolvedModel = model ?? prov.defaultModel;
  const url = prov.endpoint(resolvedModel);
  const headers = prov.headers(key);
  const body = prov.body({ prompt, size, model: resolvedModel });

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const res = await fetchImpl(url, { method: 'POST', headers, body });
    if (res.ok) {
      const json = await res.json();
      const data = prov.parse(json);
      if (!data) throw new Error(`genimage: no image data in ${provider} response`);
      const buf = Buffer.from(data, 'base64');
      writeAtomic(outPath, buf);
      return { path: outPath, provider, model: resolvedModel, bytes: buf.length };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < maxRetries) {
      await sleep(500 * 2 ** attempt);
      continue;
    }
    const text = await res.text().catch(() => '');
    throw new Error(`genimage: ${provider} request failed (${res.status})${text ? `: ${text}` : ''}`);
  }
  // Unreachable: the loop either returns or throws.
  throw new Error('genimage: exhausted retries');
}

// CLI: node lib/genimage.mjs --prompt "..." --out path [--provider gemini] [--model m] [--size 1024x1024]
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  try {
    const r = await generateImage({
      prompt: opt('prompt'),
      outPath: opt('out'),
      provider: opt('provider') ?? 'gemini',
      model: opt('model'),
      size: opt('size') ?? '1024x1024',
    });
    process.stdout.write(`wrote ${r.path} (${r.bytes} bytes via ${r.provider}/${r.model})\n`);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
