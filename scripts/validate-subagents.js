#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const Ajv = require('ajv').default || require('ajv');
const { globSync } = require('glob');

// Initialize AJV for JSON schema validation
const ajv = new Ajv({ allErrors: true });

// Load the schemas
const subagentSchema = require('./subagent-schema.json');
const commandSchema = require('./command-schema.json');

// Compile the schemas
const validateSubagent = ajv.compile(subagentSchema);
const validateCommand = ajv.compile(commandSchema);

// Track validation results
let hasErrors = false;
const errors = [];
const warnings = [];

// Directory that holds the bundled subagent files; command files live alongside
// them in the same glob, so path checks below key off this prefix.
const SUBAGENT_DIR = 'plugins/all-agents/agents/';

// Find all subagent and command markdown files
const subagentFiles = globSync([`${SUBAGENT_DIR}*.md`, 'plugins/all-commands/commands/*.md'])
  .filter(file => !file.endsWith('README.md') && !file.endsWith('INDEX.md'));

console.log(`\n\x1b[34mValidating ${subagentFiles.length} subagent files...\x1b[0m\n`);

// Validate each file
subagentFiles.forEach(file => {
  console.log(`\x1b[90mChecking ${file}...\x1b[0m`);
  
  try {
    // Read file content
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    
    // Parse frontmatter
    const parsed = matter(content);
    
    // Check if frontmatter exists
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      errors.push({
        file,
        message: 'No frontmatter found'
      });
      hasErrors = true;
      return;
    }
    
    // Validate against appropriate schema
    const isCommand = file.includes('/commands/');
    const validator = isCommand ? validateCommand : validateSubagent;
    const valid = validator(parsed.data);
    
    if (!valid) {
      validator.errors.forEach(error => {
        let message = error.message;
        if (error.instancePath) {
          message = `Field '${error.instancePath.replace('/', '')}' ${error.message}`;
        } else if (error.schemaPath.includes('/description/')) {
          message = `Description ${error.message}`;
        } else if (error.schemaPath.includes('/category/')) {
          if (isCommand) {
            message = `Category ${error.message}. Valid categories for commands: ci-deployment, code-analysis-testing, context-loading-priming, documentation-changelogs, project-task-management, version-control-git, miscellaneous`;
          } else {
            message = `Category ${error.message}. Valid categories for subagents: development-architecture, language-specialists, infrastructure-operations, quality-security, data-ai, ai-agents, specialized-domains, crypto-trading, business-finance, design-experience, blockchain-web3, sales-marketing, research, media-content, documentation`;
          }
        } else if (error.schemaPath.includes('/required') && error.params.missingProperty === 'category') {
          if (isCommand) {
            message = `Missing required field 'category'. Valid categories for commands: ci-deployment, code-analysis-testing, context-loading-priming, documentation-changelogs, project-task-management, version-control-git, miscellaneous`;
          } else {
            message = `Missing required field 'category'. Valid categories for subagents: development-architecture, language-specialists, infrastructure-operations, quality-security, data-ai, ai-agents, specialized-domains, crypto-trading, business-finance, design-experience, blockchain-web3, sales-marketing, research, media-content, documentation`;
          }
        }
        errors.push({
          file,
          message: message,
          details: error
        });
      });
      hasErrors = true;
    }
    
    // Additional custom validations
    
    // 1. Check file name matches name field (only for subagents)
    if (file.startsWith(SUBAGENT_DIR)) {
      const fileName = path.basename(file);
      const expectedFileName = `${parsed.data.name}.md`;
      if (fileName !== expectedFileName) {
        errors.push({
          file,
          message: `File name '${fileName}' doesn't match name field '${parsed.data.name}'. Expected '${expectedFileName}'`
        });
        hasErrors = true;
      }
    }
    
    // 2. Check description length
    if (parsed.data.description && parsed.data.description.length > 500) {
      warnings.push({
        file,
        message: `Description is ${parsed.data.description.length} characters (recommended: under 500)`
      });
    }
    
    // 3. Check for required content sections
    const contentLower = parsed.content.toLowerCase();
    
    // Only check for "you are" in subagent files, not command files
    if (file.startsWith(SUBAGENT_DIR) && !contentLower.includes('you are')) {
      warnings.push({
        file,
        message: 'Missing opening statement "You are a..."'
      });
    }
    
    // 4. Check for duplicate names across subagent files only
    if (file.startsWith(SUBAGENT_DIR) && parsed.data.name) {
      const allSubagentNames = subagentFiles
        .filter(f => f.startsWith(SUBAGENT_DIR))
        .map(f => {
          try {
            const content = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
            const parsed = matter(content);
            return { file: f, name: parsed.data.name };
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
      
      const duplicates = allSubagentNames.filter(item => 
        item.name === parsed.data.name && item.file !== file
      );
      
      if (duplicates.length > 0) {
        errors.push({
          file,
          message: `Duplicate name '${parsed.data.name}' found in: ${duplicates.map(d => d.file).join(', ')}`
        });
        hasErrors = true;
      }
    }
    
    // 5. Check tools field if present
    if (parsed.data.tools) {
      const validTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'WebSearch', 'WebFetch', 'Task', 'TodoWrite', 'Grep', 'Glob', 'LS', 'NotebookRead', 'NotebookEdit'];
      const toolsList = parsed.data.tools.split(',').map(t => t.trim());
      
      toolsList.forEach(tool => {
        if (!validTools.includes(tool)) {
          warnings.push({
            file,
            message: `Unknown tool '${tool}'. Valid tools: ${validTools.join(', ')}`
          });
        }
      });
    }
    
    // 6. Check for markdown formatting issues
    if (content.includes('```') && !content.match(/```[\w-]*\n/)) {
      warnings.push({
        file,
        message: 'Code blocks should specify a language after the backticks'
      });
    }
    
  } catch (error) {
    errors.push({
      file,
      message: `Failed to parse file: ${error.message}`
    });
    hasErrors = true;
  }
});

// Generate report
console.log('\n\x1b[1mValidation Report\x1b[0m');
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
  totalFiles: subagentFiles.length,
  errors: errors.length,
  warnings: warnings.length,
  details: {
    errors,
    warnings
  }
};

fs.writeFileSync('validation-report.txt', JSON.stringify(report, null, 2));

// Exit with error code if validation failed
if (hasErrors) {
  console.log('\x1b[31m\n❌ Validation failed!\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m\n✅ Validation successful!\x1b[0m');
  process.exit(0);
}