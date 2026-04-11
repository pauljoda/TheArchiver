import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
const versionPattern = /^\d+\.\d+\.\d+(-dev)?$/;
const releaseHeadingPattern = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm;
const requireReleaseHeading = process.argv.includes("--release");

if (!changelog.includes("## [Unreleased]")) {
  console.error("CHANGELOG.md must contain an [Unreleased] section.");
  process.exit(1);
}

if (!versionPattern.test(pkg.version)) {
  console.error(`package.json version "${pkg.version}" is not valid (expected X.Y.Z or X.Y.Z-dev).`);
  process.exit(1);
}

const releaseHeadings = [...changelog.matchAll(releaseHeadingPattern)].map(
  ([, version]) => version,
);

if (releaseHeadings.length === 0) {
  console.error("CHANGELOG.md must contain at least one versioned release heading.");
  process.exit(1);
}

if (!requireReleaseHeading) {
  process.exit(0);
}

if (pkg.version.endsWith("-dev")) {
  console.error(
    `Release builds require a released version, but package.json is "${pkg.version}". Run the Release workflow to cut a version first.`,
  );
  process.exit(1);
}

const expectedHeading = `## [${pkg.version}]`;
if (!changelog.includes(expectedHeading)) {
  console.error(`CHANGELOG.md is missing a release heading for version ${pkg.version}.`);
  process.exit(1);
}
