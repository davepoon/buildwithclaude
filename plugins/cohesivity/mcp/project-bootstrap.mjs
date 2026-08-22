#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  accessSync,
  constants as fsConstants,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, normalize, parse, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const QUICKSTART_URL = "https://cohesivity.ai/quickstart.sh";
export const MANAGEMENT_API_URL = "https://cohesivity.ai/api/";
export const REMOTE_MCP_URL = "https://cohesivity.ai/mcp/manage";

export const RESOURCE_NAMES = Object.freeze([
  "openweather-api",
  "google-geocoding-api",
  "openai-api",
  "ai-gateway",
  "deepgram-api",
  "exa-api",
  "steel-browser",
  "inbox",
  "postgres",
  "redis",
  "object-storage",
  "vector-database",
  "railway-hosting",
  "cloudflare-workers",
  "social-login",
  "realtime",
]);

const SERVER_NAME = "cohesivity-project-bootstrap";
export const SERVER_VERSION = "3.0.2";
const MAX_PROJECT_ROOT_LENGTH = 4096;
const MAX_CREDENTIAL_FILE_BYTES = 128 * 1024;
const MAX_QUICKSTART_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const USER_AGENT = `${SERVER_NAME}/${SERVER_VERSION}`;
const SECRET_VALUE = /(?:coh_(?:man|app)_[a-z0-9]+|Bearer\s+[^\s"']+)/gi;
const SECRET_DETECT = /(?:coh_(?:man|app)_[a-z0-9]+|Bearer\s+[^\s"']+)/i;
const SECRET_KEY = /(?:authorization|cookie|credential|password|secret|token|(?:^|_)key(?:$|_))/i;
const SAFE_RESOURCE_IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_RESOURCE_STATUS = /^[A-Za-z][A-Za-z0-9._ -]{0,79}$/u;
const SAFE_API_KEYS = new Set([
  "account",
  "active",
  "admission",
  "already_provisioned",
  "account_bucket_usage",
  "approval_url",
  "bucket_usage",
  "callback_urls",
  "capabilities",
  "code",
  "created",
  "created_at",
  "claimed_at",
  "compute_limits",
  "deleted",
  "deprovisioned",
  "deploy_endpoint",
  "deployment_url",
  "dimensions",
  "docs_url",
  "edge_url",
  "error",
  "events_endpoint",
  "events_table",
  "expires_at",
  "experiments",
  "failed_count",
  "gated_scopes",
  "kind",
  "lifecycle",
  "login_url",
  "message",
  "metric",
  "name",
  "notifications",
  "plan",
  "pause_reason",
  "paused",
  "provisioned",
  "requested_count",
  "recommended_action",
  "region",
  "remaining",
  "reset_at",
  "resource",
  "resources",
  "results",
  "runtime_profile",
  "runtime_is_latest_live",
  "runtime_is_stable",
  "runtime_notification",
  "runtime_supported",
  "runtime_version",
  "session_limits",
  "sessions_url",
  "severity",
  "secret_stored",
  "state",
  "status",
  "success",
  "tenant_id",
  "tenant_lifecycle",
  "upgrade_available",
  "upgrade_target_profile",
  "tools_url",
  "write_region",
]);

const jsonObjectSchema = {
  type: "object",
  additionalProperties: true,
};

const projectRootProperty = {
  type: "string",
  minLength: 1,
  maxLength: MAX_PROJECT_ROOT_LENGTH,
  description: "Absolute path to the existing project root that owns .cohesivity.",
};

const noConfigurationResources = RESOURCE_NAMES.filter(
  (name) => !["inbox", "postgres", "realtime", "social-login", "vector-database"].includes(name),
);
const POSTGRES_REGIONS = Object.freeze([
  "apac",
  "aws-us-east-1",
  "aws-us-east-2",
  "aws-us-west-2",
  "aws-eu-central-1",
  "aws-eu-west-2",
  "aws-ap-southeast-1",
  "aws-ap-southeast-2",
  "aws-sa-east-1",
]);
const REALTIME_REGIONS = Object.freeze(["wnam", "enam", "weur", "eeur", "apac", "oc"]);

const inboxConfigurationSchema = {
  type: "object",
  properties: {
    webhook_url: { type: "string", minLength: 1, maxLength: 2048 },
  },
  additionalProperties: false,
};

const postgresConfigurationSchema = {
  type: "object",
  properties: {
    region: { enum: POSTGRES_REGIONS },
  },
  additionalProperties: false,
};

const realtimeConfigurationSchema = {
  type: "object",
  properties: {
    write_region: { enum: REALTIME_REGIONS },
  },
  additionalProperties: false,
};

const socialLoginConfigurationSchema = {
  type: "object",
  properties: {
    callback_urls: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 2048 },
    },
  },
  required: ["callback_urls"],
  additionalProperties: false,
};

const vectorConfigurationSchema = {
  type: "object",
  properties: {
    dimensions: { enum: [384, 768, 1024, 1536, 3072] },
    metric: { enum: ["cosine", "euclidean", "dotproduct"] },
  },
  required: ["dimensions"],
  additionalProperties: false,
};

const bulkConfigurationsSchema = {
  type: "object",
  properties: {
    postgres: postgresConfigurationSchema,
    inbox: inboxConfigurationSchema,
    realtime: realtimeConfigurationSchema,
    "social-login": socialLoginConfigurationSchema,
    "vector-database": vectorConfigurationSchema,
  },
  additionalProperties: false,
};

const provisionInputSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      properties: {
        project_root: projectRootProperty,
        resource: { enum: noConfigurationResources },
      },
      required: ["project_root", "resource"],
      additionalProperties: false,
    },
    ...[
      ["postgres", postgresConfigurationSchema],
      ["inbox", inboxConfigurationSchema],
      ["realtime", realtimeConfigurationSchema],
      ["social-login", socialLoginConfigurationSchema],
      ["vector-database", vectorConfigurationSchema],
    ].map(([resource, configuration]) => ({
      type: "object",
      properties: {
        project_root: projectRootProperty,
        resource: { const: resource },
        configuration,
      },
      required:
        resource === "social-login" || resource === "vector-database"
          ? ["project_root", "resource", "configuration"]
          : ["project_root", "resource"],
      additionalProperties: false,
    })),
    {
      type: "object",
      properties: {
        project_root: projectRootProperty,
        resources: {
          type: "array",
          minItems: 1,
          maxItems: RESOURCE_NAMES.length,
          uniqueItems: true,
          items: { enum: RESOURCE_NAMES },
        },
        configurations: bulkConfigurationsSchema,
      },
      required: ["project_root", "resources"],
      additionalProperties: false,
    },
  ],
};

export const TOOLS = Object.freeze([
  {
    name: "create_tenant",
    title: "Create or reuse a Cohesivity project tenant",
    description:
      "Fetches the canonical Cohesivity quickstart and runs it locally with --no-plugin in an explicitly supplied project root. Returns only non-secret tenant metadata.",
    inputSchema: {
      type: "object",
      properties: { project_root: projectRootProperty },
      required: ["project_root"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        expires_at: { type: "string" },
        tenant_lifecycle: { enum: ["ephemeral", "claimed"] },
        runtime_profile: { type: "string" },
      },
      required: ["tenant_id"],
      additionalProperties: false,
    },
  },
  {
    name: "claim_tenant",
    title: "Create a tenant claim approval URL",
    description:
      "Starts the Cohesivity claim handoff using the project credential internally. Claiming is a consent gate; call only after explicit user approval.",
    inputSchema: {
      type: "object",
      properties: { project_root: projectRootProperty },
      required: ["project_root"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        approval_url: { type: "string" },
      },
      required: ["tenant_id", "approval_url"],
      additionalProperties: false,
    },
  },
  {
    name: "tenant_status",
    title: "Read Cohesivity tenant status",
    description:
      "Reads current tenant status from the Cohesivity Management API using the project credential internally and redacts the response.",
    inputSchema: {
      type: "object",
      properties: { project_root: projectRootProperty },
      required: ["project_root"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        status: jsonObjectSchema,
      },
      required: ["tenant_id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "provision_resource",
    title: "Provision Cohesivity resources",
    description:
      "Provisions one resource with resource/configuration, or several with resources/configurations. Fetch every requested offering's live documentation and obtain any required user consent before calling.",
    inputSchema: provisionInputSchema,
    outputSchema: {
      type: "object",
      properties: {
        resource: { enum: RESOURCE_NAMES },
        resources: {
          type: "array",
          items: { enum: RESOURCE_NAMES },
        },
        result: jsonObjectSchema,
      },
      required: ["result"],
      oneOf: [
        { required: ["resource"] },
        { required: ["resources"] },
      ],
      additionalProperties: false,
    },
  },
]);

class SafeError extends Error {}

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function fail(message) {
  throw new SafeError(message);
}

function exactObject(value, required, optional = []) {
  if (!isRecord(value)) fail("Arguments must be an object.");
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`Unexpected argument: ${key}.`);
  }
  for (const key of required) {
    if (!(key in value)) fail(`Missing required argument: ${key}.`);
  }
  return value;
}

export function validateProjectRoot(value) {
  if (typeof value !== "string" || value.length === 0) {
    fail("project_root must be a non-empty absolute path.");
  }
  if (value.length > MAX_PROJECT_ROOT_LENGTH || value.includes("\0") || !isAbsolute(value)) {
    fail("project_root must be a valid absolute path.");
  }
  if (value.split(/[\\/]+/u).includes("..")) {
    fail("project_root must not contain parent-directory traversal.");
  }

  const normalized = normalize(value);
  let canonical;
  try {
    canonical = realpathSync.native(normalized);
    if (!statSync(canonical).isDirectory()) fail("project_root must name a directory.");
    if (parse(canonical).root === canonical) fail("project_root must not be the filesystem root.");
    accessSync(canonical, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);
  } catch (error) {
    if (error instanceof SafeError) throw error;
    fail("project_root must be an existing, accessible directory.");
  }
  return canonical.endsWith(sep) ? canonical.slice(0, -1) : canonical;
}

function credentialPath(projectRoot) {
  const path = resolve(projectRoot, ".cohesivity");
  if (path !== `${projectRoot}${sep}.cohesivity`) fail("Invalid credential file path.");
  return path;
}

function readCredentialFields(projectRoot, requireManagementKey = false) {
  const path = credentialPath(projectRoot);
  let contents;
  try {
    const status = lstatSync(path);
    if (status.isSymbolicLink() || !status.isFile()) fail(".cohesivity must be a regular file.");
    if (status.size > MAX_CREDENTIAL_FILE_BYTES) fail(".cohesivity is unexpectedly large.");
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof SafeError) throw error;
    fail("No readable .cohesivity file exists in project_root.");
  }

  const fields = Object.create(null);
  const allowedFields = new Set([
    "tenant_id",
    "expires_at",
    "tenant_lifecycle",
    "runtime_profile",
    ...(requireManagementKey ? ["coh_management_key"] : []),
  ]);
  for (const line of contents.split(/\r?\n/u)) {
    const match = /^([A-Za-z][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (match && allowedFields.has(match[1]) && fields[match[1]] === undefined) {
      fields[match[1]] = match[2].trim();
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/u.test(fields.tenant_id ?? "")) {
    fail(".cohesivity does not contain a valid tenant_id.");
  }
  if (
    requireManagementKey &&
    !/^coh_man_[a-z0-9]{20}$/u.test(fields.coh_management_key ?? "")
  ) {
    fail(".cohesivity does not contain a valid management credential.");
  }
  return fields;
}

function safeTenantMetadata(projectRoot) {
  const fields = readCredentialFields(projectRoot);
  const metadata = { tenant_id: fields.tenant_id };
  if (fields.expires_at) {
    const timestamp = Date.parse(fields.expires_at);
    if (Number.isFinite(timestamp)) metadata.expires_at = new Date(timestamp).toISOString();
  }
  if (["ephemeral", "claimed"].includes(fields.tenant_lifecycle)) {
    metadata.tenant_lifecycle = fields.tenant_lifecycle;
  }
  if (/^[A-Za-z0-9._-]{1,100}$/u.test(fields.runtime_profile ?? "")) {
    metadata.runtime_profile = fields.runtime_profile;
  }
  return metadata;
}

async function fetchQuickstart(fetchImpl) {
  let response;
  try {
    response = await fetchImpl(QUICKSTART_URL, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    fail("Could not fetch the canonical Cohesivity quickstart.");
  }
  if (!response.ok || response.url !== QUICKSTART_URL) {
    fail("Could not fetch the canonical Cohesivity quickstart.");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_QUICKSTART_BYTES) {
    fail("The canonical Cohesivity quickstart is unexpectedly large.");
  }
  const script = Buffer.from(await response.arrayBuffer());
  if (
    script.length === 0 ||
    script.length > MAX_QUICKSTART_BYTES ||
    script.includes(0) ||
    !script.subarray(0, 19).toString("utf8").startsWith("#!/usr/bin/env bash")
  ) {
    fail("The canonical Cohesivity quickstart is invalid.");
  }
  return script;
}

export function executeQuickstart(script, projectRoot, spawnImpl = spawn) {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let child;
    try {
      child = spawnImpl("bash", ["-s", "--", "--no-plugin"], {
        cwd: projectRoot,
        env: process.env,
        shell: false,
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true,
      });
    } catch {
      fail("Could not start the canonical Cohesivity quickstart.");
    }

    child.once("error", () => {
      if (settled) return;
      settled = true;
      rejectPromise(new SafeError("Could not start the canonical Cohesivity quickstart."));
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (code === 0 && signal === null) resolvePromise();
      else rejectPromise(new SafeError("The canonical Cohesivity quickstart did not complete successfully."));
    });
    child.stdin.once("error", () => {});
    child.stdin.end(script);
  });
}

function validateResource(value) {
  if (typeof value !== "string" || !RESOURCE_NAMES.includes(value)) {
    fail("resource must be a supported Cohesivity resource name.");
  }
  return value;
}

function validateCallbackUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    fail("callback_urls entries must be non-empty URLs.");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("callback_urls contains an invalid URL.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    fail("callback_urls contains an unsafe URL.");
  }
  if (parsed.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    fail("callback_urls permits plain HTTP only for localhost.");
  }
  return value;
}

function validateConfiguration(resource, value, optional) {
  if (value === undefined) {
    if (optional) return undefined;
    fail(`configuration is required for ${resource}.`);
  }
  if (resource === "postgres") {
    const config = exactObject(value, [], ["region"]);
    if (config.region !== undefined && !POSTGRES_REGIONS.includes(config.region)) {
      fail("region must be a supported Cohesivity Postgres region.");
    }
    return config.region === undefined ? {} : { region: config.region };
  }
  if (resource === "inbox") {
    const config = exactObject(value, [], ["webhook_url"]);
    if (config.webhook_url === undefined) return {};
    const webhookUrl = validateCallbackUrl(config.webhook_url);
    if (!webhookUrl.startsWith("https://")) fail("webhook_url must use HTTPS.");
    return { webhook_url: webhookUrl };
  }
  if (resource === "realtime") {
    const config = exactObject(value, [], ["write_region"]);
    if (config.write_region !== undefined && !REALTIME_REGIONS.includes(config.write_region)) {
      fail("write_region must be a documented Cohesivity Realtime region.");
    }
    return config.write_region === undefined
      ? {}
      : { write_region: config.write_region };
  }
  if (resource === "social-login") {
    const config = exactObject(value, ["callback_urls"]);
    if (
      !Array.isArray(config.callback_urls) ||
      config.callback_urls.length === 0 ||
      config.callback_urls.length > 50
    ) {
      fail("callback_urls must contain between 1 and 50 URLs.");
    }
    const callbackUrls = config.callback_urls.map(validateCallbackUrl);
    if (new Set(callbackUrls).size !== callbackUrls.length) fail("callback_urls must be unique.");
    return { callback_urls: callbackUrls };
  }
  if (resource === "vector-database") {
    const config = exactObject(value, ["dimensions"], ["metric"]);
    if (![384, 768, 1024, 1536, 3072].includes(config.dimensions)) {
      fail("dimensions must be one of 384, 768, 1024, 1536, or 3072.");
    }
    if (config.metric !== undefined && !["cosine", "euclidean", "dotproduct"].includes(config.metric)) {
      fail("metric must be cosine, euclidean, or dotproduct.");
    }
    return {
      dimensions: config.dimensions,
      ...(config.metric === undefined ? {} : { metric: config.metric }),
    };
  }
  if (value !== undefined) fail(`${resource} does not accept configuration fields.`);
  return undefined;
}

function redactString(value) {
  const redacted = value.replace(SECRET_VALUE, "[REDACTED]");
  if (redacted.length > 2000) return `${redacted.slice(0, 2000)}…`;
  return redacted;
}

export function redactApiOutput(value, depth = 0) {
  if (depth > 8) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((child) => redactApiOutput(child, depth + 1));
  if (!isRecord(value)) return undefined;

  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (SECRET_KEY.test(key) || !SAFE_API_KEYS.has(key)) continue;
    const child = redactApiOutput(value[key], depth + 1);
    if (child !== undefined) output[key] = child;
  }
  return output;
}

function projectTenantStatus(value) {
  if (!isRecord(value)) return redactApiOutput(value);

  const outer = { ...value };
  delete outer.resources;
  const output = redactApiOutput(outer);
  if (!Array.isArray(value.resources)) return output;

  output.resources = value.resources.slice(0, 200).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const projected = {};
    for (const key of ["name", "resource", "resource_name", "service"]) {
      if (
        typeof entry[key] === "string" &&
        entry[key].length <= 80 &&
        SAFE_RESOURCE_IDENTIFIER.test(entry[key])
      ) {
        projected[key] = entry[key];
      }
    }
    if (typeof entry.status === "string" && SAFE_RESOURCE_STATUS.test(entry.status)) {
      projected.status = entry.status;
    }
    return Object.keys(projected).length === 0 ? [] : [projected];
  });
  return output;
}

async function managementRequest(
  projectRoot,
  method,
  path,
  body,
  fetchImpl,
  projectOutput = redactApiOutput,
) {
  const credentials = readCredentialFields(projectRoot, true);
  const url = new URL(path, MANAGEMENT_API_URL);
  if (url.origin !== new URL(MANAGEMENT_API_URL).origin || !url.pathname.startsWith("/api/")) {
    fail("Invalid Cohesivity Management API path.");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method,
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.coh_management_key}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        "User-Agent": USER_AGENT,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    fail("The Cohesivity Management API request failed.");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    fail("The Cohesivity Management API response is unexpectedly large.");
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
    fail("The Cohesivity Management API response is unexpectedly large.");
  }
  let document = {};
  if (text.length > 0) {
    try {
      document = JSON.parse(text);
    } catch {
      fail("The Cohesivity Management API returned an invalid response.");
    }
  }
  if (!response.ok) {
    const code =
      isRecord(document) && typeof document.error === "string" && /^[a-z0-9_-]{1,80}$/u.test(document.error)
        ? ` (${document.error})`
        : "";
    fail(`The Cohesivity Management API returned HTTP ${response.status}${code}.`);
  }
  return projectOutput(document);
}

export async function callTool(name, argumentsValue, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const spawnImpl = dependencies.spawn ?? spawn;

  if (name === "create_tenant") {
    const args = exactObject(argumentsValue, ["project_root"]);
    const projectRoot = validateProjectRoot(args.project_root);
    const path = credentialPath(projectRoot);
    try {
      if (lstatSync(path).isSymbolicLink()) fail(".cohesivity must not be a symbolic link.");
    } catch (error) {
      if (error instanceof SafeError) throw error;
      if (error?.code !== "ENOENT") fail("Could not validate the project credential path.");
    }
    const script = await fetchQuickstart(fetchImpl);
    await executeQuickstart(script, projectRoot, spawnImpl);
    return safeTenantMetadata(projectRoot);
  }

  if (name === "claim_tenant") {
    const args = exactObject(argumentsValue, ["project_root"]);
    const projectRoot = validateProjectRoot(args.project_root);
    const credentials = readCredentialFields(projectRoot, true);
    const response = await managementRequest(projectRoot, "POST", "claim/url", undefined, fetchImpl);
    const approvalUrl = response.approval_url;
    let parsed;
    try {
      parsed = new URL(approvalUrl);
    } catch {
      fail("The Cohesivity Management API did not return a safe approval URL.");
    }
    if (
      parsed.origin !== "https://cohesivity.ai" ||
      !/^\/c\/[A-Za-z0-9_-]+$/u.test(parsed.pathname) ||
      parsed.search ||
      parsed.hash
    ) {
      fail("The Cohesivity Management API did not return a safe approval URL.");
    }
    return { tenant_id: credentials.tenant_id, approval_url: approvalUrl };
  }

  if (name === "tenant_status") {
    const args = exactObject(argumentsValue, ["project_root"]);
    const projectRoot = validateProjectRoot(args.project_root);
    const credentials = readCredentialFields(projectRoot, true);
    const status = await managementRequest(
      projectRoot,
      "GET",
      "status",
      undefined,
      fetchImpl,
      projectTenantStatus,
    );
    return { tenant_id: credentials.tenant_id, status };
  }

  if (name === "provision_resource") {
    const hasResource =
      isRecord(argumentsValue) && Object.prototype.hasOwnProperty.call(argumentsValue, "resource");
    const hasResources =
      isRecord(argumentsValue) && Object.prototype.hasOwnProperty.call(argumentsValue, "resources");
    if (hasResource === hasResources) {
      fail("Provide exactly one of resource or resources.");
    }
    if (hasResources) {
      const args = exactObject(argumentsValue, ["project_root", "resources"], ["configurations"]);
      const projectRoot = validateProjectRoot(args.project_root);
      if (
        !Array.isArray(args.resources) ||
        args.resources.length === 0 ||
        args.resources.length > RESOURCE_NAMES.length
      ) {
        fail("resources must be a non-empty array of supported resource names.");
      }
      const resources = args.resources.map(validateResource);
      if (new Set(resources).size !== resources.length) fail("resources must be unique.");

      const configurations = exactObject(args.configurations ?? {}, [], [
        "postgres",
        "inbox",
        "realtime",
        "social-login",
        "vector-database",
      ]);
      const body = { resources };
      for (const [resource, configuration] of Object.entries(configurations)) {
        if (!resources.includes(resource)) fail(`Configuration supplied for unrequested resource: ${resource}.`);
        body[resource] = validateConfiguration(resource, configuration, false);
      }
      for (const required of ["social-login", "vector-database"]) {
        if (resources.includes(required) && configurations[required] === undefined) {
          fail(`configurations.${required} is required when ${required} is requested.`);
        }
      }

      const result = await managementRequest(projectRoot, "POST", "resources", body, fetchImpl);
      return { resources, result };
    }

    const args = exactObject(argumentsValue, ["project_root", "resource"], ["configuration"]);
    const projectRoot = validateProjectRoot(args.project_root);
    const resource = validateResource(args.resource);
    const configurable = ["inbox", "postgres", "realtime", "social-login", "vector-database"].includes(
      resource,
    );
    const configuration = validateConfiguration(
      resource,
      args.configuration,
      configurable && !["social-login", "vector-database"].includes(resource),
    );
    const result = await managementRequest(
      projectRoot,
      "POST",
      `resources/${resource}`,
      configuration,
      fetchImpl,
    );
    return { resource, result };
  }

  fail(`Unknown tool: ${name}.`);
}

function safeErrorMessage(error) {
  return error instanceof SafeError ? redactString(error.message) : "The tool call failed safely.";
}

export async function handleRequest(request, dependencies = {}) {
  if (!isRecord(request) || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return { jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
  }
  if (request.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      },
    };
  }
  if (request.method === "ping") {
    return { jsonrpc: "2.0", id: request.id, result: {} };
  }
  if (request.method === "tools/list") {
    return { jsonrpc: "2.0", id: request.id, result: { tools: TOOLS } };
  }
  if (request.method === "tools/call") {
    try {
      const params = exactObject(request.params, ["name"], ["arguments"]);
      if (typeof params.name !== "string") fail("Tool name must be a string.");
      const result = await callTool(params.name, params.arguments ?? {}, dependencies);
      const text = JSON.stringify(result);
      if (SECRET_DETECT.test(text)) throw new Error("secret reached the MCP output boundary");
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [{ type: "text", text }],
          structuredContent: result,
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          isError: true,
          content: [{ type: "text", text: safeErrorMessage(error) }],
        },
      };
    }
  }
  if (request.method.startsWith("notifications/")) return undefined;
  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    error: { code: -32601, message: "Method not found" },
  };
}

export async function runServer(input = process.stdin, output = process.stdout) {
  const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      continue;
    }
    const response = await handleRequest(request);
    if (response !== undefined && request.id !== undefined) output.write(`${JSON.stringify(response)}\n`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runServer().catch(() => {
    process.exitCode = 1;
  });
}
