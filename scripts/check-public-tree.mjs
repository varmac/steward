#!/usr/bin/env node
// Fails when a tracked or about-to-be-tracked file contains something that
// should not be public: a real-looking phone number or email address, a
// credential, a deployment URL or an absolute home-directory path.
// Run from the repository root: npm run check:public
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((file) => file && file !== "package-lock.json" && !file.startsWith("scripts/check-public-tree"));

const rules = [
  { name: "email address", pattern: /[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*\b(example|test|invalid|localhost)\b|users\.noreply\.github\.com\b)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  // E.164 numbers, except the fictional ranges used in tests: North American
  // 555-01xx and the UK drama range +44 20 7946 0xxx.
  { name: "phone number", pattern: /\+[1-9][\d ().-]{8,16}\d/g, allow: isFictionalNumber },
  { name: "credential", pattern: /\b(sk|rk|pk)[-_](live|test|proj)?[-_]?[A-Za-z0-9]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{30,}\b|\bxox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./g },
  { name: "database URL with password", pattern: /postgres(ql)?:\/\/[^\s:@/'"]+:[^\s@'"]+@/g },
  { name: "deployment URL", pattern: /\bhttps?:\/\/(?!<)[a-z0-9-]+\.vercel\.app\b/g },
  { name: "Vercel Connect connector id", pattern: /\bscl_[A-Za-z0-9]{12,}\b/g },
  { name: "workflow run id", pattern: /\bwrun_[A-Z0-9]{16,}\b/g },
  { name: "home-directory path", pattern: /\/(Users|home)\/[a-z][a-z0-9._-]+\//g },
];

// North American 555-01xx and the UK drama range +44 20 7946 0xxx are
// reserved for fiction, so tests may use them.
function isFictionalNumber(match) {
  const digits = match.replace(/\D/g, "");
  return /^1\d{3}55501\d\d$/.test(digits) || digits.startsWith("442079460");
}

let findings = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, index) => {
    for (const rule of rules) {
      for (const match of line.matchAll(rule.pattern)) {
        if (rule.allow?.(match[0])) continue;
        findings++;
        console.log(`${file}:${index + 1}  ${rule.name}: ${match[0]}`);
      }
    }
  });
}

if (findings > 0) {
  console.error(`\n${findings} finding(s). Replace them with synthetic values before committing.`);
  process.exit(1);
}
console.log(`Checked ${files.length} files: nothing that looks private.`);
