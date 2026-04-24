/**
 * agent/bdi.mjs
 *
 * BDI (Belief-Desire-Intention) cognitive architecture for skill selection.
 * Implements formal BDI deliberation: beliefs grounded in world state,
 * desires motivated by beliefs, intentions justified and ordered as plans.
 *
 * Reference: Rao & Georgeff "BDI agents: From theory to practice" (1995)
 *            Bratman "Intention, plans, and practical reason" (1987)
 */

// ---------------------------------------------------------------------------
// Built-in skill catalog — representative ECC + domain skills.
// Used as fallback when no external catalog is available.
// ---------------------------------------------------------------------------

export const DEFAULT_CATALOG = [
  {
    slug: '/everything-claude-code:planner',
    name: 'Planner',
    domains: ['api', 'saas', 'cli', 'data', 'agent', 'general'],
    tags: ['planning', 'decomposition', 'architecture', 'workflow', 'phases'],
    description: 'Decomposes complex goals into ordered, verifiable phases with explicit dependencies.',
  },
  {
    slug: '/everything-claude-code:tdd-guide',
    name: 'TDD Guide',
    domains: ['api', 'saas', 'cli', 'agent', 'library'],
    tags: ['testing', 'tdd', 'test-first', 'coverage', 'regression', 'quality'],
    description: 'Applies test-driven development discipline — tests written before implementation.',
  },
  {
    slug: '/everything-claude-code:code-reviewer',
    name: 'Code Reviewer',
    domains: ['api', 'saas', 'cli', 'agent', 'library', 'general'],
    tags: ['review', 'quality', 'code', 'standards', 'patterns', 'correctness'],
    description: 'Reviews code for production quality: error handling, patterns, maintainability.',
  },
  {
    slug: '/everything-claude-code:security-reviewer',
    name: 'Security Reviewer',
    domains: ['api', 'saas', 'agent', 'auth', 'payments'],
    tags: ['security', 'auth', 'injection', 'secrets', 'permissions', 'vulnerability'],
    description: 'Audits code and configs for security: secret handling, injection, permissions.',
  },
  {
    slug: '/everything-claude-code:typescript-reviewer',
    name: 'TypeScript Reviewer',
    domains: ['api', 'saas', 'cli', 'library'],
    tags: ['typescript', 'types', 'typed', 'ts', 'type-safety', 'inference'],
    description: 'Enforces TypeScript type safety, strict mode, and type-level correctness.',
  },
  {
    slug: '/everything-claude-code:api-design',
    name: 'API Design',
    domains: ['api', 'saas', 'backend'],
    tags: ['api', 'rest', 'openapi', 'endpoints', 'contract', 'versioning', 'http'],
    description: 'Designs RESTful APIs with proper contracts, versioning, and OpenAPI documentation.',
  },
  {
    slug: '/everything-claude-code:database-reviewer',
    name: 'Database Reviewer',
    domains: ['api', 'saas', 'data'],
    tags: ['database', 'sql', 'schema', 'migrations', 'postgres', 'orm', 'queries'],
    description: 'Reviews database schemas, migrations, query performance, and data integrity.',
  },
  {
    slug: '/everything-claude-code:backend-patterns',
    name: 'Backend Patterns',
    domains: ['api', 'saas', 'backend'],
    tags: ['backend', 'server', 'middleware', 'di', 'layered', 'patterns', 'architecture'],
    description: 'Applies production backend patterns: layered architecture, DI, middleware, error handling.',
  },
  {
    slug: '/everything-claude-code:deployment-patterns',
    name: 'Deployment Patterns',
    domains: ['api', 'saas', 'cli', 'agent'],
    tags: ['deployment', 'docker', 'ci', 'cd', 'pipeline', 'containerization', 'production'],
    description: 'Configures deployment pipelines: Docker, CI/CD, environment management.',
  },
  {
    slug: '/everything-claude-code:frontend-design',
    name: 'Frontend Design',
    domains: ['saas', 'dashboard'],
    tags: ['frontend', 'ui', 'ux', 'dashboard', 'react', 'components', 'design'],
    description: 'Designs frontend UIs with production-grade component architecture and UX patterns.',
  },
  {
    slug: '/everything-claude-code:python-testing',
    name: 'Python Testing',
    domains: ['python', 'cli', 'data'],
    tags: ['python', 'pytest', 'testing', 'fixtures', 'mocking'],
    description: 'Applies Python-specific testing patterns with pytest, fixtures, and mocking.',
  },
  {
    slug: '/everything-claude-code:go-review',
    name: 'Go Review',
    domains: ['go', 'api', 'cli'],
    tags: ['go', 'golang', 'idiomatic', 'goroutines', 'channels', 'interfaces'],
    description: 'Reviews Go code for idiomatic patterns, goroutine safety, and interface design.',
  },
  {
    slug: '/everything-claude-code:rust-patterns',
    name: 'Rust Patterns',
    domains: ['rust', 'cli', 'agent', 'systems'],
    tags: ['rust', 'ownership', 'lifetimes', 'cargo', 'traits', 'async'],
    description: 'Applies Rust ownership, trait, and async patterns for safe systems code.',
  },
  {
    slug: '/everything-claude-code:documentation-lookup',
    name: 'Documentation Lookup',
    domains: ['api', 'saas', 'cli', 'library', 'general'],
    tags: ['docs', 'documentation', 'readme', 'openapi', 'jsdoc', 'reference'],
    description: 'Generates and validates documentation: README, OpenAPI specs, code comments.',
  },
  {
    slug: '/everything-claude-code:postgres-patterns',
    name: 'Postgres Patterns',
    domains: ['api', 'saas', 'data'],
    tags: ['postgres', 'postgresql', 'sql', 'indexes', 'transactions', 'rls'],
    description: 'Applies production Postgres patterns: indexes, transactions, RLS, connection pooling.',
  },
  {
    slug: '/everything-claude-code:frontend-patterns',
    name: 'Frontend Patterns',
    domains: ['saas', 'dashboard', 'frontend'],
    tags: ['react', 'state', 'routing', 'forms', 'validation', 'patterns', 'hooks'],
    description: 'React/frontend production patterns: state management, routing, form validation.',
  },
  {
    slug: '/everything-claude-code:e2e-testing',
    name: 'E2E Testing',
    domains: ['saas', 'api', 'cli'],
    tags: ['e2e', 'integration', 'playwright', 'cypress', 'end-to-end', 'smoke'],
    description: 'Designs end-to-end test suites covering critical user journeys and API contracts.',
  },
  {
    slug: '/everything-claude-code:python-patterns',
    name: 'Python Patterns',
    domains: ['python', 'cli', 'data', 'agent'],
    tags: ['python', 'click', 'async', 'pydantic', 'patterns', 'packaging'],
    description: 'Applies production Python patterns: Click CLI, Pydantic models, async, packaging.',
  },
  {
    slug: '/everything-claude-code:mcp-server-patterns',
    name: 'MCP Server Patterns',
    domains: ['agent', 'tool', 'mcp'],
    tags: ['mcp', 'tool-server', 'agent-tools', 'protocol', 'stdio', 'sse'],
    description: 'Builds MCP tool servers: stdio/SSE transport, tool registration, typed schemas.',
  },
];

// ---------------------------------------------------------------------------
// Mental state constructors
// ---------------------------------------------------------------------------

/**
 * Create a Belief — what the agent knows to be true about the world.
 *
 * @param {string} content - The propositional content of the belief
 * @param {object} worldState - Structured world state this belief refers to
 * @param {string} justification - Evidence or reasoning that grounds this belief
 * @returns {{ type: 'belief', content: string, worldState: object, justification: string, createdAt: string }}
 */
export function createBelief(content, worldState = {}, justification = '') {
  return {
    type: 'belief',
    content,
    worldState,
    justification,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a Desire — what the agent wants to bring about.
 *
 * @param {string} content - Description of the desired world state
 * @param {string[]} motivatedBy - Slugs/IDs of beliefs that motivate this desire
 * @returns {{ type: 'desire', content: string, motivatedBy: string[], createdAt: string }}
 */
export function createDesire(content, motivatedBy = []) {
  return {
    type: 'desire',
    content,
    motivatedBy,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create an Intention — a committed plan the agent will execute.
 *
 * @param {{ slug: string, role: string, causalChain: string }[]} plan - Ordered skill steps
 * @param {string} fulfils - Which desire this intention fulfils
 * @param {string} justification - Why this plan is the right way to fulfil the desire
 * @returns {{ type: 'intention', plan: object[], fulfils: string, justification: string, createdAt: string }}
 */
export function createIntention(plan, fulfils, justification = '') {
  return {
    type: 'intention',
    plan,
    fulfils,
    justification,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Domain classification helpers
// ---------------------------------------------------------------------------

/**
 * Classify a goal string into a domain category and extract quality signals.
 *
 * @param {string} goal
 * @returns {{ domain: string, qualitySignals: string[], languages: string[], goalType: string }}
 */
function classifyGoal(goal) {
  const lower = goal.toLowerCase();

  let domain = 'general';
  let goalType = 'general';

  if (/\brest api\b|restful api|\bhttp api\b|\bapi server\b|\bweb api\b/.test(lower)) {
    domain = 'api';
    goalType = 'api';
  } else if (/\bsaas\b|\bsoftware.as.a.service\b|\bmulti.tenant\b|\bsubscription\b/.test(lower)) {
    domain = 'saas';
    goalType = 'saas';
  } else if (/\bcli tool\b|\bcommand.line\b|\bcli app\b|\bnpm package\b|\bpublish.*npm\b/.test(lower)) {
    domain = 'cli';
    goalType = 'cli';
  } else if (/\bdata pipeline\b|\betl\b|\bdata processing\b|\bdata ingestion\b/.test(lower)) {
    domain = 'data';
    goalType = 'data';
  } else if (/\bagent\b|\bmcp server\b|\btool server\b|\bagentic\b/.test(lower)) {
    domain = 'agent';
    goalType = 'agent';
  } else if (/\blibrary\b|\bpackage\b|\bsdk\b|\bnpm module\b/.test(lower)) {
    domain = 'library';
    goalType = 'library';
  } else if (/\bdashboard\b|\bfront.?end\b|\breact app\b|\bweb app\b/.test(lower)) {
    domain = 'saas';
    goalType = 'saas';
  }

  const languages = [];
  if (/typescript|\.ts\b/.test(lower)) languages.push('typescript');
  if (/\bjavascript\b|\.js\b/.test(lower)) languages.push('javascript');
  if (/\bpython\b|\.py\b/.test(lower)) languages.push('python');
  if (/\bgo\b|golang/.test(lower)) languages.push('go');
  if (/\brust\b/.test(lower)) languages.push('rust');
  if (/\bjava\b/.test(lower)) languages.push('java');

  const qualitySignals = [];
  if (/production.ready|production.grade|production-ready/.test(lower)) qualitySignals.push('production-explicit');
  if (/well.tested|fully.tested|test.coverage/.test(lower)) qualitySignals.push('testing-explicit');
  if (/\bauth(entication)?\b/.test(lower)) qualitySignals.push('auth-required');
  if (/\bpayment|\bstripe\b/.test(lower)) qualitySignals.push('payments-required');
  if (/\bdeploy|\bdeployable\b/.test(lower)) qualitySignals.push('deployment-required');
  if (/\bdocument|\bswagger|\bopenapi\b/.test(lower)) qualitySignals.push('documentation-required');
  if (/\bdatabase|\bpostgres|\bsql\b/.test(lower)) qualitySignals.push('database-required');
  if (/\bdashboard\b/.test(lower)) qualitySignals.push('dashboard-required');
  if (/\bpublish|\bnpm\b/.test(lower)) qualitySignals.push('publish-required');

  return { domain, goalType, languages, qualitySignals };
}

/**
 * Define what "production" means for a given goal type.
 * Production requirements are domain-specific — this is the BDI-critical insight.
 *
 * @param {string} goalType
 * @param {string[]} qualitySignals
 * @returns {string[]}
 */
function productionRequirementsFor(goalType, qualitySignals) {
  const base = ['type-safe or idiomatically safe', 'tested with meaningful coverage', 'documented at entry points'];

  const byType = {
    api: [
      'typed request/response contracts',
      'authentication and authorization',
      'input validation and sanitization',
      'error handling with consistent error shapes',
      'rate limiting awareness',
      'OpenAPI or equivalent documentation',
      'tested routes with integration tests',
      'deployable via container or platform',
    ],
    saas: [
      'multi-tenant data isolation',
      'authentication (session or JWT)',
      'payment integration if billing required',
      'dashboard UI with meaningful data display',
      'tested critical paths',
      'deployable with environment config',
      'security hardened (CSRF, XSS, injection)',
    ],
    cli: [
      'ergonomic argument parsing with help text',
      'tested with unit and integration tests',
      'published to npm with semantic versioning',
      'documented with README and examples',
      'handles errors gracefully with useful messages',
      'works cross-platform (Node/Bun/Deno if applicable)',
    ],
    data: [
      'idempotent pipeline stages',
      'error recovery and dead-letter handling',
      'schema validation at boundaries',
      'tested with realistic data samples',
      'observable (logging, metrics)',
    ],
    agent: [
      'typed tool interfaces',
      'permission-scoped operations',
      'tested tool behavior',
      'MCP-compatible if tool-server',
      'observable reasoning trace',
    ],
    library: [
      'public API documented and stable',
      'typed exports',
      'tested with comprehensive suite',
      'semantic versioning',
      'published to package registry',
    ],
    general: base,
  };

  const requirements = [...(byType[goalType] || base)];

  if (qualitySignals.includes('auth-required') && !requirements.some(r => r.includes('auth'))) {
    requirements.push('authentication layer fully implemented');
  }
  if (qualitySignals.includes('payments-required')) {
    requirements.push('payment processing with webhook handling');
  }
  if (qualitySignals.includes('deployment-required')) {
    requirements.push('deployment pipeline configured and documented');
  }
  if (qualitySignals.includes('database-required')) {
    requirements.push('database schema with migrations');
  }

  return requirements;
}

/**
 * Evaluate whether a catalog skill has a causal path to the desired outcome.
 * Returns a causal chain object if yes, null if no causal path exists.
 *
 * @param {object} skill
 * @param {string} domain
 * @param {string[]} productionReqs
 * @param {string[]} qualitySignals
 * @param {string[]} languages
 * @returns {{ causalChain: string, role: 'core'|'supporting'|'optional' } | null}
 */
function evaluateCausality(skill, domain, productionReqs, qualitySignals, languages) {
  const skillDomains = skill.domains || [];
  const slug = skill.slug;

  const matchesLanguage = (lang) =>
    (skill.tags || []).includes(lang) || slug.includes(lang) || skillDomains.includes(lang);

  const languageMatch = languages.length === 0 || languages.some(matchesLanguage);
  const domainMatch = skillDomains.includes(domain) || skillDomains.includes('general');

  const languageSpecificSlugs = ['go-review', 'python-testing', 'python-patterns', 'rust-patterns'];
  const isLanguageSpecific = languageSpecificSlugs.some(m => slug.includes(m));

  if (isLanguageSpecific && !languageMatch) {
    return null;
  }

  if (slug === '/everything-claude-code:planner') {
    if (!domainMatch) return null;
    return {
      causalChain: `The planner skill causes goal decomposition into ordered, verifiable phases. This is required because production ${domain} projects have multiple dependent phases (setup → implementation → testing → deployment) that must execute in the right order. Without systematic decomposition, the workspace produces an ambiguous task list instead of an executable plan.`,
      role: 'core',
    };
  }

  if (slug === '/everything-claude-code:tdd-guide') {
    if (!domainMatch) return null;
    return {
      causalChain: `The TDD guide causes tests to be written before implementation code, establishing a regression safety net. This is required because production ${domain} projects must be verifiable — unverified code that ships to production creates silent failure risk. TDD also forces interface design before implementation, which improves ergonomics.`,
      role: 'core',
    };
  }

  if (slug === '/everything-claude-code:code-reviewer') {
    return {
      causalChain: `Code review causes production quality standards to be enforced at the artifact level — catching error handling gaps, anti-patterns, and maintainability issues. Required for any production ${domain} project because code not reviewed against production standards is not production-grade by definition.`,
      role: 'core',
    };
  }

  if (slug === '/everything-claude-code:security-reviewer') {
    if (['api', 'saas', 'agent'].includes(domain)) {
      return {
        causalChain: `Security review causes authentication, authorization, injection, and secret-handling vulnerabilities to be identified and fixed before deployment. Required because ${domain} projects are networked and user-facing — security defects in production cause data breaches and legal liability that cannot be patched retroactively.`,
        role: 'core',
      };
    }
    if (qualitySignals.includes('auth-required') || qualitySignals.includes('payments-required')) {
      return {
        causalChain: `Security review is required because the goal includes authentication and/or payment processing. These components handle credentials and financial data where vulnerabilities cause direct user harm. Security review causes these to be validated against known attack patterns (OWASP Top 10) before handling real user data.`,
        role: 'core',
      };
    }
    return {
      causalChain: `Security review causes input validation, dependency vulnerabilities, and permission issues to be identified. Relevant as a supporting check even for ${domain} projects, though not the primary focus.`,
      role: 'supporting',
    };
  }

  if (slug === '/everything-claude-code:typescript-reviewer') {
    if (languages.includes('typescript') || domain === 'api' || domain === 'saas') {
      return {
        causalChain: `TypeScript review causes the type system to be used correctly: strict mode, no implicit any, typed function signatures, narrowing at boundaries. Required because TypeScript's value is entirely realized at compile time — loose typing causes TypeScript to behave identically to untyped JavaScript, removing all production safety guarantees.`,
        role: languages.includes('typescript') ? 'core' : 'supporting',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:api-design') {
    if (['api', 'saas', 'backend'].includes(domain)) {
      return {
        causalChain: `API design causes the HTTP interface to have a well-defined contract: consistent URL structure, proper HTTP semantics, versioning strategy, and OpenAPI documentation. Required because production APIs are consumed by external clients who depend on the contract being stable and predictable — poor design causes breaking changes that propagate to all consumers.`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:database-reviewer') {
    if (qualitySignals.includes('database-required') || ['api', 'saas', 'data'].includes(domain)) {
      return {
        causalChain: `Database review causes schema design, migrations, query performance, and data integrity constraints to be validated. Required because production ${domain} projects with persistent data must have a schema that handles the write/read patterns the application generates — poor indexing and missing constraints cause performance degradation and data corruption.`,
        role: qualitySignals.includes('database-required') ? 'core' : 'supporting',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:backend-patterns') {
    if (['api', 'saas', 'backend'].includes(domain)) {
      return {
        causalChain: `Backend patterns cause the server architecture to use proven production structures: layered architecture (controller/service/repository), dependency injection, middleware composition, and graceful error propagation. Required because ad hoc backend code becomes unmaintainable quickly — pattern-based code is testable, replaceable, and has predictable behavior under failure.`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:deployment-patterns') {
    if (qualitySignals.includes('deployment-required') || qualitySignals.includes('production-explicit')) {
      return {
        causalChain: `Deployment patterns cause the project to have a working CI/CD pipeline, Dockerfile, and environment configuration. Required because "production-ready" means deployable, not just runnable locally. Without deployment patterns, the project works on the developer's machine but fails in the first real deployment.`,
        role: 'supporting',
      };
    }
    if (['api', 'saas'].includes(domain)) {
      return {
        causalChain: `Deployment patterns cause the server application to have container and pipeline configuration. Relevant for ${domain} projects that will be hosted.`,
        role: 'optional',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:frontend-design') {
    if (['saas', 'dashboard'].includes(domain) || qualitySignals.includes('dashboard-required')) {
      return {
        causalChain: `Frontend design causes the user-facing interface to have a coherent component architecture, accessibility, and UX patterns. Required because a SaaS product's value is experienced through its UI — a poorly structured frontend causes user abandonment even when the backend is correct.`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:frontend-patterns') {
    if (['saas', 'dashboard'].includes(domain) || qualitySignals.includes('dashboard-required')) {
      return {
        causalChain: `Frontend patterns cause the React/frontend codebase to use production-grade structures: state management, routing, form validation with server-side sync, and component composition. Required because pattern-less frontend code becomes impossible to maintain and test as feature count grows.`,
        role: 'supporting',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:postgres-patterns') {
    if (qualitySignals.includes('database-required') || ['api', 'saas', 'data'].includes(domain)) {
      return {
        causalChain: `Postgres patterns cause the database layer to use production-grade features: proper indexing for query patterns, row-level security for multi-tenancy, connection pooling, and migration tooling. Required because naive Postgres usage causes performance collapse at scale and security issues in multi-tenant contexts.`,
        role: qualitySignals.includes('database-required') ? 'supporting' : 'optional',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:e2e-testing') {
    if (['saas', 'api'].includes(domain)) {
      return {
        causalChain: `E2E testing causes critical user journeys and API contracts to be verified against a running system. Required for ${domain} projects because unit tests cannot catch integration failures — authentication flows, payment processing, and multi-step workflows only fail in ways that E2E tests detect.`,
        role: 'supporting',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:python-testing') {
    if (languages.includes('python')) {
      return {
        causalChain: `Python testing causes the codebase to have a structured pytest suite with fixtures and mocking. Required because the goal is implemented in Python — language-idiomatic testing is more effective than generic patterns at catching Python-specific failure modes (import errors, type coercion, async issues).`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:python-patterns') {
    if (languages.includes('python')) {
      return {
        causalChain: `Python patterns cause the codebase to follow production Python conventions: Pydantic for data validation, Click/Typer for CLI interfaces, async with asyncio, and proper package structure. Required because Python has significant footguns (dynamic typing, mutable defaults, GIL) that production patterns mitigate.`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:go-review') {
    if (languages.includes('go')) {
      return {
        causalChain: `Go review causes the codebase to follow idiomatic Go: proper error handling (not panic), goroutine safety, interface-based design, and standard library preference. Required because Go has idioms that, when violated, cause subtle concurrency bugs and resource leaks that are hard to debug in production.`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:rust-patterns') {
    if (languages.includes('rust')) {
      return {
        causalChain: `Rust patterns cause the codebase to leverage Rust's ownership system correctly: avoiding unnecessary clones, using trait objects appropriately, and structuring async correctly. Required because Rust's safety guarantees only hold when patterns are correct — fighting the borrow checker with workarounds produces unsafe code that defeats Rust's purpose.`,
        role: 'core',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:documentation-lookup') {
    if (['api', 'library', 'cli'].includes(domain) || qualitySignals.includes('documentation-required')) {
      return {
        causalChain: `Documentation causes the project's public interface to be discoverable and usable by others. Required for ${domain} projects because code without documentation has zero adoption surface — users cannot use what they cannot understand. For APIs, documentation is part of the product contract.`,
        role: qualitySignals.includes('documentation-required') ? 'core' : 'supporting',
      };
    }
    return null;
  }

  if (slug === '/everything-claude-code:mcp-server-patterns') {
    if (domain === 'agent' || (skill.tags || []).some(t => t === 'mcp')) {
      return {
        causalChain: `MCP server patterns cause the tool server to implement the Model Context Protocol correctly: typed tool schemas, proper stdio/SSE transport, and error-safe tool execution. Required because MCP tools that violate the protocol spec cause silent failures in the calling agent — it receives malformed responses and cannot reason about the failure.`,
        role: 'core',
      };
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core deliberation function
// ---------------------------------------------------------------------------

/**
 * Deliberate over a goal and catalog to produce a full BDI trace.
 *
 * Implements the perception → belief formation → desire formation →
 * intention commitment cycle from BDI cognitive architecture.
 *
 * @param {string} goal - Natural language goal string
 * @param {object[]} [catalog] - Skill catalog entries (defaults to DEFAULT_CATALOG)
 * @returns {{
 *   goal: string,
 *   beliefs: object[],
 *   desires: object[],
 *   intentions: { selected: object[], rejected: object[] },
 *   trace: string
 * }}
 */
export function deliberate(goal, catalog = DEFAULT_CATALOG) {
  const { domain, goalType, languages, qualitySignals } = classifyGoal(goal);
  const productionReqs = productionRequirementsFor(goalType, qualitySignals);

  // --- Phase 1: Form beliefs ---

  const beliefs = [
    createBelief(
      `The goal "${goal}" is a ${goalType} project`,
      { domain, goalType, languages, qualitySignals },
      'Goal text was parsed for domain keywords (API, SaaS, CLI, etc.) and language markers (TypeScript, Go, Python, Rust).',
    ),
    createBelief(
      `The skill catalog contains ${catalog.length} available skills`,
      { catalogSize: catalog.length, slugs: catalog.map(s => s.slug) },
      'The catalog was provided as input to the deliberation call.',
    ),
    createBelief(
      `Production for a ${goalType} means: ${productionReqs.slice(0, 3).join(', ')}${productionReqs.length > 3 ? ` (and ${productionReqs.length - 3} more)` : ''}`,
      { productionRequirements: productionReqs },
      'Production requirements are domain-specific, not generic. A CLI has different production requirements than a SaaS or an API.',
    ),
  ];

  if (languages.length > 0) {
    beliefs.push(createBelief(
      `The goal requires language-specific skills for: ${languages.join(', ')}`,
      { languages },
      'Language markers detected in goal text. Language-specific review skills are only causally relevant when the language matches.',
    ));
  }

  if (qualitySignals.length > 0) {
    beliefs.push(createBelief(
      `Explicit quality signals detected: ${qualitySignals.join(', ')}`,
      { qualitySignals },
      'These signals were parsed from the goal text and raise the priority of the corresponding skill categories.',
    ));
  }

  // --- Phase 2: Form desires ---

  const desires = [
    createDesire(
      'A workspace where every included skill has a written causal chain back to a production requirement',
      ['belief-0', 'belief-1'],
    ),
    createDesire(
      `Production ${goalType} requirements are all addressed: ${productionReqs.join('; ')}`,
      ['belief-2'],
    ),
    createDesire(
      'Rejected skills are documented with explicit reasons, not silently excluded',
      ['belief-1'],
    ),
  ];

  if (languages.length > 0) {
    desires.push(createDesire(
      `Language-specific quality for ${languages.join(', ')} is enforced by the right specialist skills`,
      ['belief-3'],
    ));
  }

  // --- Phase 3: Form intentions — evaluate each skill causally ---

  const selected = [];
  const rejected = [];

  for (const skill of catalog) {
    const causalResult = evaluateCausality(skill, domain, productionReqs, qualitySignals, languages);

    if (causalResult) {
      selected.push({
        slug: skill.slug,
        name: skill.name,
        role: causalResult.role,
        causalChain: causalResult.causalChain,
      });
    } else {
      const languageSpecificMarkers = ['go-review', 'python-testing', 'python-patterns', 'rust-patterns'];
      const isLangSpecific = languageSpecificMarkers.some(m => skill.slug.includes(m));
      let reason = '';

      if (isLangSpecific) {
        const skillLang = skill.slug.includes('python') ? 'Python'
          : skill.slug.includes('go-') ? 'Go'
          : skill.slug.includes('rust') ? 'Rust'
          : 'a different language';
        reason = `Language mismatch: this skill is for ${skillLang} projects. The goal targets ${languages.length > 0 ? languages.join(', ') : 'no specific language'} — including it would add overhead without causally improving the ${goalType} outcome.`;
      } else if (!skill.domains.includes(domain) && !skill.domains.includes('general')) {
        reason = `Domain mismatch: this skill targets [${skill.domains.join(', ')}] domains. The goal is a ${domain} project — this skill has no causal path to the required ${domain} production properties.`;
      } else {
        reason = `No causal path identified: evaluated against ${productionReqs.length} production requirements for ${goalType} and found no skill output that causes a required property to be satisfied.`;
      }

      rejected.push({ slug: skill.slug, name: skill.name, reason });
    }
  }

  // Sort: core first, then supporting, then optional
  const roleOrder = { core: 0, supporting: 1, optional: 2 };
  selected.sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));

  const intentions = { selected, rejected };

  // --- Phase 4: Build human-readable trace ---

  const trace = buildTrace(goal, domain, goalType, languages, productionReqs, beliefs, desires, intentions);

  return { goal, beliefs, desires, intentions, trace };
}

/**
 * Build a human-readable reasoning trace string for inclusion in REASONING.md.
 */
function buildTrace(goal, domain, goalType, languages, productionReqs, beliefs, desires, intentions) {
  const lines = [];
  lines.push(`Goal: "${goal}"`);
  lines.push(`Domain: ${domain} | Type: ${goalType} | Languages: ${languages.length > 0 ? languages.join(', ') : 'none detected'}`);
  lines.push('');
  lines.push('--- BELIEFS ---');
  for (const b of beliefs) {
    lines.push(`  [BELIEF] ${b.content}`);
    lines.push(`           Justified by: ${b.justification}`);
  }
  lines.push('');
  lines.push('--- DESIRES ---');
  for (const d of desires) {
    lines.push(`  [DESIRE] ${d.content}`);
  }
  lines.push('');
  lines.push('--- INTENTIONS (selected) ---');
  for (const s of intentions.selected) {
    lines.push(`  [${s.role.toUpperCase()}] ${s.slug}`);
    lines.push(`    Causal chain: ${s.causalChain.slice(0, 220)}...`);
  }
  lines.push('');
  lines.push('--- REJECTED SKILLS ---');
  for (const r of intentions.rejected) {
    lines.push(`  [REJECTED] ${r.slug}`);
    lines.push(`    Reason: ${r.reason}`);
  }
  lines.push('');
  lines.push(`Production requirements for ${goalType}:`);
  for (const req of productionReqs) {
    lines.push(`  - ${req}`);
  }

  return lines.join('\n');
}
