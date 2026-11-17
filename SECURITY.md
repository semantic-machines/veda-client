# Security Best Practices

Security guidelines for Veda Client Framework applications.

## XSS Prevention

### Always Use `html` Template Tag

`html` values are written through the DOM API; they are never parsed as
markup. A `<script>` in a value becomes a text node:

```javascript
import { html } from 'veda-client';

// ✅ SAFE - the value is a DOM value, not markup
const userInput = '<script>alert("XSS")</script>';
const template = html`<div>${userInput}</div>`;
// <div> contains the literal text <script>alert("XSS")</script>
```

### Values Never Become Markup

This is the rule the template engine is built around (the same one lit-html
uses): a `${}` value can only be text, an attribute value, a spread entry or a
`ChildPart` value. It can never be a tag name, an attribute name, an
`{expression}` or an attribute snippet. The only way to put a value into the
template *source* is `unsafeStatic()`, which brands the value with a symbol so
ordinary data (including `JSON.parse` output) cannot produce it.

```javascript
// ❌ no way to express this from data: tag names are authored
html`<${this.state.tag}></${this.state.tag}>`;        // throws
html`<div ${this.state.attr}="x"></div>`;             // throws (name position)
html`<div ${this.state.snippet}></div>`;              // expects an object, not markup

// ✅ trusted static source, authored in code
const tag = unsafeStatic('my-row');
html`<${tag}></${tag}>`;
```

Note: HTML entities in the *authored* template source are decoded by the parser
before expression parsing, so `&#123;x&#125;` in a template behaves like
`{x}`. That is authored code, not data; never build expression braces from
entities or from strings.

### Spread (`${attrs}`) Is a Capability Boundary

`${attrs}` accepts an object (or `Map`) and applies it through `setAttribute`,
`toggleAttribute`, property assignment or `addEventListener` — it is never
parsed. Data may set ordinary attributes (`class`, `aria-*`, `data-*`, ...),
but not:

- `on*` content attributes (use `@event` with a function),
- `srcdoc`, `innerHTML`, `outerHTML`,
- framework attributes (`items`, `condition`, `key`, `as`, `item-key`,
  `height`, `item-height`, `overscan`, `bind`, `ref`, `about`, `property`,
  `rel`, `is`, `slot`),
- the reserved `data-veda-*` namespace (compiler markers).

`javascript:` and `vbscript:` URL values are refused in `href`, `src`,
`action`, `formaction`, `poster` and similar attributes, including values
written with `{expression}`. Other URLs (`https://`, relative, `mailto:`) are
the application's responsibility, as in any framework.

The guard lives in the Part writer, so it covers every value the marker engine
renders — including `${}` projected through `Slot` when the host content comes
from a compiled parent template.

### Never Use `raw` with User Input

`raw` still returns a plain string that is compiled as template source, so a
value containing `{...}` becomes an expression:

```javascript
import { raw } from 'veda-client';

// ❌ DANGEROUS
const userInput = '<script>alert("XSS")</script>';
const template = raw`<div>${userInput}</div>`;
```

**Rule:** Use `raw` only for content you control (templates, static HTML,
sanitized HTML). Use `${}` inside `html` for values.

### Expression Injection Protection

#### Simple Paths (no eval)

An expression that is a plain property path is evaluated by traversal, without
`eval`/`new Function`, so it stays CSP-compatible:

```javascript
// ✅ SAFE - property access only
<div>{this.model.title}</div>

// ✅ SAFE - even with malicious data
this.model.title = '<script>alert("XSS")</script>';
// Rendered as text, not executed
```

```javascript
// ✅ Simple paths (no eval)
{this.user.name}
{this.items.0.title}
```

The data is inserted as text or as an attribute value, so malicious model
content cannot become markup.

#### Complex Expressions (auto-detected)

Everything that is not a simple path — operators, ternaries, method calls —
is auto-detected and compiled once with `new Function()`. The same
`{expression}` braces are used for both forms. Function calls therefore **do**
work, which means the expression source itself is code:

**⚠️ IMPORTANT:** Complex expressions use `new Function()` internally (requires `unsafe-eval` in CSP).

**✅ SAFE - Templates written by developers:**

```javascript
// Templates in source code are safe
render() {
  return html`
    <span>{ this.state.count * 2 }</span>
    <span>{ this.state.name.toUpperCase() }</span>
  `;
}
```

**✅ SAFE - Reading user data through expressions:**

```javascript
// Even with malicious data in model, this is safe
this.state.userInput = '<script>alert(1)</script>';

// Expression READS the data, doesn't execute it
<span>{ this.state.userInput }</span>  // Displays as text
<span>{ this.state.userInput.length }</span>  // Shows length: 29
```

**❌ DANGEROUS - Templates from untrusted sources:**

```javascript
// ❌ DANGEROUS: Template from database/API
const template = await fetch('/api/template').then(r => r.text());
this.innerHTML = template;  // If contains { alert(1) } - XSS!

// ❌ DANGEROUS: Dynamic expression construction
const field = userInput;  // User entered: name; alert(1);//
const expr = `this.state.${field}`;
// If used in template: XSS!
```

**❌ DANGEROUS - String interpolation before template parsing:**

```javascript
// ❌ DANGEROUS: Interpolating user data into expression
const userValue = this.state.userInput;  // User entered: " + alert(1) + "

// This builds: { "" + alert(1) + "" } - XSS!
const template = `<span>{ "${userValue}" }</span>`;
```

**Security Rules for Complex Expressions:**

| Source | Safe? | Example |
|--------|-------|---------|
| Hardcoded templates | ✅ Yes | `render() { return html\`{ expr }\` }` |
| Expression reads user data | ✅ Yes | `{ this.state.userInput }` |
| Template from database | ❌ No | `innerHTML = dbTemplate` |
| Dynamic expression string | ❌ No | `` `{ this.${userField} }` `` |
| User input in expression | ❌ No | `` `{ "${userInput}" }` `` |

### CSP (Content Security Policy)

**Simple property paths** like `{this.model.title}` are CSP-compatible without `unsafe-eval`:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
```

**Complex expressions** like `{this.state.count > 0}` are auto-detected and require `unsafe-eval`:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
```

**Summary:**

| Expression Type | CSP Requirement | Why |
|-----------------|-----------------|-----|
| Simple path `{model.title}` | No `unsafe-eval` | Uses safe property traversal, no eval/Function |
| Complex (auto-detected) `{count > 0}` | Requires `unsafe-eval` | Auto-detected, uses `new Function()` internally |

**Recommendation:** If your application requires strict CSP without `unsafe-eval`, use only simple property path expressions `{expression}` with computed properties for complex logic.

### Sanitizing HTML

If you must display user HTML, sanitize it first:

```javascript
import DOMPurify from 'dompurify';
import { raw } from './src/components/Component.js';

// User-provided HTML
const userHTML = '<p>Safe content</p><script>alert("XSS")</script>';

// Sanitize before using raw
const sanitized = DOMPurify.sanitize(userHTML);
const template = raw`<div>${sanitized}</div>`;
// Result: <div><p>Safe content</p></div> // Script removed
```

**Install:**
```bash
npm install dompurify
```

---

## Attribute Injection

### Event Handlers

Handlers use `{expression}` and are resolved from the component/context when
the event fires. A method reference or a path to a function is expected:

```javascript
// ✅ SAFE - method or function path
<button onclick="{handleClick}">Click</button>
<button onclick="{this.handleClick}">Click</button>
<button onclick="{this.state.handler}">Click</button>
```

Call expressions are not evaluated as handlers: `{alert('XSS')}` does not run,
the framework warns instead. Static inline handlers (`onclick="alert(1)"`), the
`:onclick` property binding, `srcdoc` and `:srcdoc` are compile errors in 4.0;
use `{expression}`, `@event` for spread listeners and `unsafeHTML()` for
trusted markup.

### Data Attributes

Data attributes with reactive expressions are **safe**:

```javascript
// ✅ SAFE - automatically escaped
<div data-user="{this.userName}"></div>

// Even if userName contains quotes:
this.userName = '"; alert("XSS"); var x="';
// Rendered safely as attribute value
```

### href and src Attributes

Be cautious with `href` and `src` attributes:

```javascript
// ⚠️ DANGEROUS - can be javascript: URLs
<a href="{this.userProvidedURL}">Link</a>

// ✅ SAFE - validate protocol
get safeURL() {
  const url = this.userProvidedURL;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return '#';
}

<a href="{this.safeURL}">Link</a>
```

**Validation helper:**

```javascript
function isSafeURL(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

---

## Backend Security

### Authentication

Always use HTTPS in production:

```javascript
import Backend from './src/Backend.js';

// ✅ Production
Backend.init('https://api.example.com');

// ❌ Development only
Backend.init('http://localhost:8080');
```

### Credentials

Never hardcode credentials:

```javascript
// ❌ NEVER do this
await Backend.authenticate('admin', 'password123');

// ✅ Use environment variables or secure storage
const username = import.meta.env.VITE_USERNAME;
const password = sessionStorage.getItem('password');
await Backend.authenticate(username, password);
```

### Token Storage

Store authentication tokens securely:

```javascript
// ✅ httpOnly cookies (server-side)
// Best: server sets HttpOnly, Secure, SameSite cookies

// ✅ sessionStorage (client-side)
sessionStorage.setItem('token', token);

// ⚠️ localStorage (persistent but vulnerable to XSS)
localStorage.setItem('token', token);

// ❌ NEVER in regular JavaScript variables
window.authToken = token; // Accessible to all scripts!
```

---

## Model Security

### Property Validation

Validate data before saving:

```javascript
async save() {
  // ✅ Validate input
  const title = this.model['v-s:title']?.[0]?.data;

  if (!title || title.length > 200) {
    throw new Error('Invalid title');
  }

  if (typeof title !== 'string') {
    throw new Error('Title must be string');
  }

  await this.model.save();
}
```

### Prototype Pollution Prevention

Veda Client automatically blocks dangerous property names:

```javascript
// ✅ Blocked automatically
model['__proto__'] = 'evil';     // Ignored with warning
model['constructor'] = 'evil';   // Ignored with warning
model['prototype'] = 'evil';     // Ignored with warning
```

This prevents prototype pollution attacks.

### Access Control

Check permissions before operations:

```javascript
async deleteModel() {
  // ✅ Check permissions first
  const rights = await Backend.get_rights(this.model.id);

  if (!rights.canDelete) {
    throw new Error('Permission denied');
  }

  await this.model.remove();
}
```

---

## Component Security

### Shadow DOM Isolation

Use Shadow DOM for untrusted content isolation:

```javascript
class IsolatedWidget extends Component(HTMLElement) {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  render() {
    return html`
      <style>
        /* Scoped styles */
      </style>
      <div>Isolated content</div>
    `;
  }
}
```

### Sandboxed iframes

For highly untrusted content, use sandboxed iframes:

```javascript
render() {
  return html`
    <iframe
      sandbox="allow-scripts"
      src="{this.trustedURL}"
      style="width: 100%; height: 400px; border: none;">
    </iframe>
  `;
}
```

---

## Common Vulnerabilities

### ❌ DOM-Based XSS

```javascript
// ❌ DANGEROUS
element.innerHTML = userInput;

// ✅ SAFE
element.textContent = userInput;
```

### ❌ Open Redirect

```javascript
// ❌ DANGEROUS
location.href = userProvidedURL;

// ✅ SAFE
if (isSafeURL(userProvidedURL)) {
  location.href = userProvidedURL;
}
```

### ❌ CSRF

Use CSRF tokens for state-changing operations:

```javascript
async save() {
  const csrf = document.querySelector('meta[name="csrf-token"]').content;

  await fetch('/api/save', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrf,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(this.model)
  });
}
```

---

## Security Checklist

### Development

- [ ] All user input escaped (use `html` template tag)
- [ ] No `raw` with user data
- [ ] URLs validated before use in href/src
- [ ] Credentials not hardcoded
- [ ] CSP headers configured
- [ ] HTTPS in production
- [ ] Input validation on frontend
- [ ] Access control checks

### Testing

- [ ] Test with malicious input (`<script>alert(1)</script>`)
- [ ] Test XSS payloads in all inputs
- [ ] Test CSRF protection
- [ ] Test authentication/authorization
- [ ] Penetration testing performed

### Deployment

- [ ] CSP enabled
- [ ] HTTPS enforced
- [ ] Security headers set (X-Frame-Options, etc.)
- [ ] Rate limiting enabled
- [ ] Monitoring and logging active

---

## Reporting Security Issues

If you discover a security vulnerability in Veda Client Framework, please report it responsibly:

**Email:** info@semantic-machines.com

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Suggested fix (if any)

**Response time:** We aim to respond within 48 hours.

**Do NOT:**
- Open public issues for security vulnerabilities
- Disclose vulnerabilities before a fix is available
- Exploit vulnerabilities in production systems

We appreciate responsible disclosure and will acknowledge security researchers in our release notes (unless you prefer to remain anonymous).

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSP Reference](https://content-security-policy.com/)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Web Security](https://web.dev/security/)

---

**Remember:** Security is a process, not a product. Stay vigilant!

