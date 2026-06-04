#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const Ajv = require('ajv').default || require('ajv');
const { globSync } = require('glob');

// Initialize AJV for JSON schema validation
const ajv = new Ajv({ allErrors: true });

// Load and compile the skill schema
const skillSchema = require('./skill-schema.json');
const validateSkill = ajv.compile(skillSchema);

const VALID_CATEGORIES = skillSchema.properties.category.enum.join(', ');

// Track validation results
let hasErrors = false;
const errors = [];
const warnings = [];

// Validate the curated skills collection — the documented contribution location
// (plugins/all-skills/skills/<slug>/SKILL.md, per CLAUDE.md and /contribute).
// Other plugins bundle their own skills with different frontmatter conventions
// and are out of scope for this contribution gate.
const skillFiles = globSync('plugins/all-skills/skills/*/SKILL.md');

console.log(`\n\x1b[34mValidating ${skillFiles.length} skill files...\x1b[0m\n`);

// Collect names for duplicate detection
const namesByFile = [];

skillFiles.forEach(file => {
  console.log(`\x1b[90mChecking ${file}...\x1b[0m`);

  try {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    const parsed = matter(content);

    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      errors.push({ file, message: 'No frontmatter found' });
      hasErrors = true;
      return;
    }

    namesByFile.push({ file, name: parsed.data.name });

    // Validate against schema
    const valid = validateSkill(parsed.data);
    if (!valid) {
      validateSkill.errors.forEach(error => {
        let message = error.message;
        if (error.instancePath) {
          message = `Field '${error.instancePath.replace('/', '')}' ${error.message}`;
        }
        if (error.schemaPath.includes('/category/')) {
          message = `Category ${error.message}. Valid skill categories: ${VALID_CATEGORIES}`;
        } else if (error.keyword === 'required' && error.params.missingProperty === 'category') {
          message = `Missing required field 'category'. Valid skill categories: ${VALID_CATEGORIES}`;
        } else if (error.keyword === 'additionalProperties') {
          message = `Unexpected field '${error.params.additionalProperty}'. Allowed: ${Object.keys(skillSchema.properties).join(', ')}`;
        }
        errors.push({ file, message, details: error });
      });
      hasErrors = true;
    }

    // Custom check 1: directory name must equal the name field
    // (skills-server.ts derives the slug from the directory name).
    const dirName = path.basename(path.dirname(file));
    if (parsed.data.name && dirName !== parsed.data.name) {
      errors.push({
        file,
        message: `Directory '${dirName}' doesn't match name field '${parsed.data.name}'. Rename the directory or the name so they match.`,
      });
      hasErrors = true;
    }

    // Warning: very long description
    if (parsed.data.description && parsed.data.description.length > 1024) {
      warnings.push({
        file,
        message: `Description is ${parsed.data.description.length} characters (recommended: under 1024)`,
      });
    }
  } catch (error) {
    errors.push({ file, message: `Failed to parse file: ${error.message}` });
    hasErrors = true;
  }
});

// Custom check 2: duplicate name detection across all skill files
const seen = new Map();
namesByFile.forEach(({ file, name }) => {
  if (!name) return;
  if (!seen.has(name)) seen.set(name, []);
  seen.get(name).push(file);
});
for (const [name, files] of seen.entries()) {
  if (files.length > 1) {
    errors.push({
      file: files.join(', '),
      message: `Duplicate skill name '${name}' found in ${files.length} files`,
    });
    hasErrors = true;
  }
}

// Generate report
console.log('\n\x1b[1mSkill Validation Report\x1b[0m');
console.log('='.repeat(50));

if (errors.length > 0) {
  console.log(`\x1b[31m\n❌ Errors (${errors.length}):\x1b[0m`);
  errors.forEach(error => {
    console.log(`\x1b[31m  - ${error.file}: ${error.message}\x1b[0m`);
  });
}

if (warnings.length > 0) {
  console.log(`\x1b[33m\n⚠️  Warnings (${warnings.length}):\x1b[0m`);
  warnings.forEach(warning => {
    console.log(`\x1b[33m  - ${warning.file}: ${warning.message}\x1b[0m`);
  });
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\x1b[32m\n✅ All validations passed!\x1b[0m');
}

// Write detailed report
const report = {
  timestamp: new Date().toISOString(),
  totalFiles: skillFiles.length,
  errors: errors.length,
  warnings: warnings.length,
  details: { errors, warnings },
};
fs.writeFileSync('skill-validation-report.txt', JSON.stringify(report, null, 2));

if (hasErrors) {
  console.log('\x1b[31m\n❌ Skill validation failed!\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m\n✅ Skill validation successful!\x1b[0m');
  process.exit(0);
}
