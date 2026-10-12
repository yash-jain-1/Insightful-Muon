// Renders content/site.yml into a static site in public/.
// Usage: node scripts/build.mjs [--out public]
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const out = resolve(root, outArg > -1 ? process.argv[outArg + 1] : 'public');

// ── helpers ──────────────────────────────────────────────────

const errors = [];
const fail = (msg) => errors.push(msg);

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Inline Markdown: **bold**, `code`, [text](url). Everything else is escaped.
const md = (s = '') =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, text, url) => `<a href="${url}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`,
    );

const visible = (list = []) => (list || []).filter((item) => item && !item.hidden);
const ext = (url, label, cls = '') =>
  url ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>` : '';
const img = (path) => `assets/img/${path}`;
const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const need = (obj, keys, where) => {
  for (const k of keys) if (obj?.[k] === undefined || obj[k] === '') fail(`${where}: missing "${k}"`);
};

// ── load ─────────────────────────────────────────────────────

let data;
try {
  data = yaml.load(readFileSync(join(root, 'content/site.yml'), 'utf8'));
} catch (e) {
  console.error(`content/site.yml is not valid YAML:\n${e.message}`);
  process.exit(1);
}

const { site = {}, theme = {}, hero = {}, about = {}, contact = {} } = data;
need(site, ['name', 'title', 'email'], 'site');

const checkImage = (path, where) => {
  if (path && !existsSync(join(root, 'assets/img', path))) fail(`${where}: image assets/img/${path} not found`);
};

// ── sections ─────────────────────────────────────────────────

const sectionHead = (n, title) =>
  `<h2 class="section-title"><span class="num">${String(n).padStart(2, '0')}.</span> ${esc(title)}</h2>`;

const renderers = {
  about() {
    checkImage(about.photo, 'about.photo');
    const text = [].concat(about.text || []).map((p) => `<p>${md(p)}</p>`).join('');
    const skills = visible(about.skills).map((s) => `<li>${esc(s)}</li>`).join('');
    const photo = about.photo
      ? `<figure class="photo"><img class="pixelate" src="${img(about.photo)}" alt="${esc(site.name)}" width="320" height="320" loading="lazy"></figure>`
      : '';
    return `<div class="about-grid"><div>${text}${skills ? `<p>Things I work with:</p><ul class="skills">${skills}</ul>` : ''}</div>${photo}</div>`;
  },

  experience() {
    const jobs = visible(data.experience);
    return `<ol class="timeline">${jobs
      .map((job, i) => {
        need(job, ['role', 'company'], `experience[${i}]`);
        const company = job.url ? ext(job.url, esc(job.company)) : esc(job.company);
        const bullets = visible(job.bullets).map((b) => `<li>${md(b)}</li>`).join('');
        return `<li class="job">
  <div class="job-dates">${esc(job.dates || '')}</div>
  <div class="job-body">
    <h3>${esc(job.role)} <span class="at">@ ${company}</span></h3>
    ${job.location ? `<div class="job-loc">${esc(job.location)}</div>` : ''}
    ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
  </div>
</li>`;
      })
      .join('')}</ol>`;
  },

  projects() {
    const all = visible(data.projects);
    all.forEach((p, i) => {
      need(p, ['title', 'description'], `projects[${i}] (${p.title || 'untitled'})`);
      checkImage(p.image, `projects[${i}].image`);
    });
    const links = (p) =>
      `<div class="links">${ext(p.github, 'GitHub')}${ext(p.live, 'Live ↗')}${p.status ? `<span class="status">${esc(p.status)}</span>` : ''}</div>`;
    const tech = (p) =>
      p.tech?.length ? `<ul class="tech">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';

    const featured = all
      .filter((p) => p.featured && !p.archived)
      .map(
        (p) => `<article class="feature">
  ${
    p.image
      ? `<div class="feature-img"><img class="pixelate" src="${img(p.image)}" alt="" loading="lazy"></div>`
      : `<div class="feature-img gen" data-seed="${esc(p.title)}" aria-hidden="true"><span>${esc(p.cover || initials(p.title))}</span></div>`
  }
  <div class="feature-body">
    <h3>${esc(p.title)}</h3>
    <p>${md(p.description)}</p>
    ${tech(p)}
    ${links(p)}
  </div>
</article>`,
      )
      .join('');

    const card = (p) => `<article class="card">
  <h3>${esc(p.title)}</h3>
  <p>${md(p.description)}</p>
  ${tech(p)}
  ${links(p)}
</article>`;
    const regular = all.filter((p) => !p.featured && !p.archived).map(card).join('');
    const archived = all.filter((p) => p.archived).map(card).join('');

    return `${featured ? `<div class="features">${featured}</div>` : ''}
${regular ? `<h3 class="sub">Other projects</h3><div class="cards">${regular}</div>` : ''}
${archived ? `<details class="archive"><summary>Older projects (${all.filter((p) => p.archived).length})</summary><div class="cards">${archived}</div></details>` : ''}`;
  },

  education() {
    return `<ul class="plain">${visible(data.education)
      .map(
        (e) =>
          `<li><strong>${esc(e.degree)}</strong> · ${esc(e.school)}<span class="muted"> · ${esc(e.dates || '')}${e.note ? ` · ${esc(e.note)}` : ''}</span></li>`,
      )
      .join('')}</ul>`;
  },

  background() {
    const edu = renderers.education();
    const ach = renderers.achievements();
    return `<div class="two-col"><div><h3 class="sub tight">Education</h3>${edu}</div><div><h3 class="sub tight">Awards &amp; certs</h3>${ach}</div></div>`;
  },

  achievements() {
    return `<ul class="bullets">${visible(data.achievements)
      .map((a) => `<li>${md(typeof a === 'string' ? a : a.text)}</li>`)
      .join('')}</ul>`;
  },

  contact() {
    return `<div class="contact">
  <p>${md(contact.text || '')}</p>
  <a class="btn" href="mailto:${esc(site.email)}">${esc(contact.button || 'Say hello')}</a>
</div>`;
  },
};

const sections = visible(data.sections);
sections.forEach((s, i) => {
  if (!renderers[s.id]) fail(`sections[${i}]: unknown section id "${s.id}" (known: ${Object.keys(renderers).join(', ')})`);
});

const body = sections
  .filter((s) => renderers[s.id])
  .map(
    (s, i) => `<section id="${esc(s.id)}" class="section">
${s.id === 'contact' ? `<h2 class="section-title center">${esc(contact.title || s.title)}</h2>` : sectionHead(i + 1, s.title)}
${renderers[s.id]()}
</section>`,
  )
  .join('\n');

if (errors.length) {
  console.error(`content/site.yml has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

// ── page ─────────────────────────────────────────────────────

const nav = sections
  .filter((s) => s.nav)
  .map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`)
  .join('');
const socials = visible(data.socials).map((s) => `<li>${ext(s.url, esc(s.name))}</li>`).join('');
const fire = theme.fire || {};
const term = visible(hero.terminal);
const terminal = term.length
  ? `<div class="term" aria-label="Quick facts">
  <div class="term-bar"><i></i><i></i><i></i><span>${esc(hero.terminalTitle || 'whoami')}</span></div>
  <dl>${term.map((t) => `<div><dt>${esc(t.key)}</dt><dd>${md(String(t.value))}</dd></div>`).join('')}</dl>
  <p class="prompt"><span>$</span> <span class="cursor">█</span></p>
</div>`
  : '';
const fireOn = fire.enabled !== false;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title)}</title>
<meta name="description" content="${esc(site.description || '')}">
<meta property="og:title" content="${esc(site.title)}">
<meta property="og:description" content="${esc(site.description || '')}">
${site.url ? `<meta property="og:url" content="${esc(site.url)}"><link rel="canonical" href="${esc(site.url)}">` : ''}
<link rel="icon" href="assets/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/styles.css">
<style>:root{--accent:${esc(theme.accent || '#ff6a1a')}}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <a class="logo" href="#top" aria-label="Back to top">${esc(
    (site.name || '')
      .split(/\s+/)
      .map((w) => w[0])
      .join(''),
  )}</a>
  <nav aria-label="Sections"><ul>${nav}${site.resume ? `<li><a class="btn small" href="${esc(site.resume)}" target="_blank" rel="noopener">Résumé</a></li>` : ''}</ul></nav>
</header>

<main id="main">
<section id="top" class="hero">
<div class="hero-grid">
<div>
  <p class="kicker">${esc(hero.kicker || '')}</p>
  <h1 class="name">${esc(site.name)}<span class="cursor" aria-hidden="true">_</span></h1>
  <p class="headline">${esc(hero.headline || '')}</p>
  <p class="tagline">${esc(hero.tagline || '')}</p>
  ${hero.blurb ? `<p class="blurb">${md(hero.blurb)}</p>` : ''}
  <div class="hero-cta"><a class="btn" href="mailto:${esc(site.email)}">${esc(contact.button || 'Say hello')}</a>${
    site.location ? `<span class="muted">📍 ${esc(site.location)}</span>` : ''
  }</div>
</div>
${terminal}
</div>
  ${fireOn ? `<canvas class="fire" aria-hidden="true" data-pixel="${Number(fire.pixel) || 6}" data-wind="${esc(fire.wind || 'none')}" style="height:${Number(fire.height) || 180}px"></canvas>` : ''}
</section>
${body}
</main>

<footer class="footer">
  <ul class="socials">${socials}</ul>
  <p class="muted">© ${new Date().getFullYear()} ${esc(site.name)} · built from one YAML file</p>
</footer>
<script src="assets/main.js" defer></script>
</body>
</html>
`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
if (existsSync(join(root, 'static'))) cpSync(join(root, 'static'), out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Built ${sections.length} sections → ${out}/index.html`);
