#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(__filename), "..", "..");

const args = process.argv.slice(2);
const argv = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name) => args.includes(`--${name}`);

const phase = argv("phase") || "release"; // release | post
const bump = argv("bump"); // patch | minor | major
const explicit = argv("version");
const dryRun = hasFlag("dry-run");

const versionRe = /^(\d+)\.(\d+)\.(\d+)(?:-dev)?$/;

function parseVersion(v) {
  const m = v.match(versionRe);
  if (!m) throw new Error(`not a valid version: ${v}`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    isDev: v.endsWith("-dev"),
  };
}

function fmtBase({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function computeNextRelease(current, bumpKind, explicitVersion) {
  if (explicitVersion) {
    if (!versionRe.test(explicitVersion) || explicitVersion.endsWith("-dev")) {
      throw new Error(`explicit version must be X.Y.Z, got: ${explicitVersion}`);
    }
    return explicitVersion;
  }
  const b = parseVersion(current);
  if (b.isDev) {
    if (bumpKind === "patch") return fmtBase(b);
    if (bumpKind === "minor")
      return fmtBase({ major: b.major, minor: b.minor + 1, patch: 0 });
    if (bumpKind === "major")
      return fmtBase({ major: b.major + 1, minor: 0, patch: 0 });
  } else {
    if (bumpKind === "patch")
      return fmtBase({ ...b, patch: b.patch + 1 });
    if (bumpKind === "minor")
      return fmtBase({ ...b, minor: b.minor + 1, patch: 0 });
    if (bumpKind === "major")
      return fmtBase({ major: b.major + 1, minor: 0, patch: 0 });
  }
  throw new Error("must pass --bump <patch|minor|major> or --version <X.Y.Z>");
}

function computeNextDev(releaseVersion) {
  const b = parseVersion(releaseVersion);
  return `${b.major}.${b.minor}.${b.patch + 1}-dev`;
}

function updateRootVersion(newVersion) {
  const file = join(repoRoot, "package.json");
  const raw = readFileSync(file, "utf8");
  const pkg = JSON.parse(raw);
  pkg.version = newVersion;
  const next = JSON.stringify(pkg, null, 2) + (raw.endsWith("\n") ? "\n" : "");
  if (!dryRun) writeFileSync(file, next);
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function rewriteChangelog(version) {
  const changelogPath = join(repoRoot, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");
  if (!/^## \[Unreleased\]\s*$/m.test(changelog)) {
    throw new Error("CHANGELOG.md must contain a '## [Unreleased]' heading");
  }
  const date = isoDate();
  const rewritten = changelog.replace(
    /^## \[Unreleased\]\s*$/m,
    `## [Unreleased]\n\n## [${version}] - ${date}`,
  );
  if (!dryRun) writeFileSync(changelogPath, rewritten);
  return rewritten;
}

function extractReleaseNotes(changelog, version) {
  const re = new RegExp(
    `## \\[${version.replace(/\./g, "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}\\s*\\n([\\s\\S]*?)(?=\\n## \\[|$)`,
  );
  const m = changelog.match(re);
  if (!m) return "";
  return m[1].trim();
}

const rootPkgPath = join(repoRoot, "package.json");
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
const current = rootPkg.version;

if (phase === "release") {
  const releaseVersion = computeNextRelease(current, bump, explicit);
  const nextDev = computeNextDev(releaseVersion);
  updateRootVersion(releaseVersion);
  const rewritten = rewriteChangelog(releaseVersion);
  const notes = extractReleaseNotes(rewritten, releaseVersion);
  const notesPath = join(repoRoot, "RELEASE_NOTES.md");
  if (!dryRun) writeFileSync(notesPath, notes + "\n");
  process.stdout.write(
    JSON.stringify({
      phase: "release",
      previous: current,
      version: releaseVersion,
      nextDev,
      notesPath: "RELEASE_NOTES.md",
      dryRun,
    }) + "\n",
  );
} else if (phase === "post") {
  const target = explicit || computeNextDev(current);
  updateRootVersion(target);
  process.stdout.write(
    JSON.stringify({ phase: "post", previous: current, version: target, dryRun }) +
      "\n",
  );
} else {
  throw new Error(`unknown --phase: ${phase}`);
}
