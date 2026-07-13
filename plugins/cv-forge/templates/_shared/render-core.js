// Shared résumé renderer — plain browser JS. Top-level function/var only (no const/let/
// export) so it works as a <script> global, when inlined into output, and in a node:vm test.
// renderResume(resume) -> HTML string. No dependencies, no DOM APIs at module top level.

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var CV_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(value) {
  if (!value) return '';
  var m = /^(\d{4})(?:-(\d{2}))?/.exec(String(value));
  if (!m) return String(value);
  if (!m[2]) return m[1];
  var monthName = CV_MONTHS[parseInt(m[2], 10) - 1];
  return monthName ? monthName + ' ' + m[1] : m[1];
}

function safeUrl(url) {
  var trimmed = String(url).trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : '';
}

function renderLink(url, label) {
  var safe = safeUrl(url);
  if (!safe) return escapeHtml(label);
  return '<a href="' + escapeHtml(safe) + '">' + escapeHtml(label) + '</a>';
}

// NOTE: opts.dates and opts.body are inserted RAW (not escaped here) — callers must
// pass already-escaped/trusted HTML (see dateRange(), renderHighlights(), etc.).
function renderEntry(opts) {
  opts = opts || {};
  var orgHtml = opts.org !== undefined ? '<span class="entry-org">' + escapeHtml(opts.org) + '</span>' : '';
  return '<div class="entry"><div class="entry-head">' +
    '<span class="entry-title">' + escapeHtml(opts.title || '') + '</span>' +
    orgHtml +
    '<span class="entry-dates">' + (opts.dates || '') + '</span></div>' +
    (opts.body || '') + '</div>';
}

function dateRange(startDate, endDate) {
  var s = formatDate(startDate);
  var e = endDate ? formatDate(endDate) : (startDate ? 'Present' : '');
  if (!s && !e) return '';
  return escapeHtml(s) + (s && e ? ' – ' : '') + escapeHtml(e);
}

function cvSection(title, inner) {
  if (!inner) return '';
  return '<section class="section"><h2>' + escapeHtml(title) + '</h2>' + inner + '</section>';
}

function renderHighlights(highlights) {
  if (!highlights || !highlights.length) return '';
  return '<ul class="highlights">' + highlights.map(function (h) {
    return '<li>' + escapeHtml(h) + '</li>';
  }).join('') + '</ul>';
}

function renderContact(basics) {
  var parts = [];
  if (basics.email) parts.push(renderLink('mailto:' + basics.email, basics.email));
  if (basics.phone) parts.push(escapeHtml(basics.phone));
  if (basics.url) parts.push(renderLink(basics.url, basics.url));
  var loc = basics.location || {};
  var locText = [loc.city, loc.region, loc.countryCode].filter(Boolean).join(', ');
  if (locText) parts.push(escapeHtml(locText));
  (basics.profiles || []).forEach(function (p) {
    if (p && p.url) parts.push(renderLink(p.url, p.network || p.url));
  });
  return parts.length ? '<p class="contact">' + parts.join(' <span class="sep">·</span> ') + '</p>' : '';
}

function renderWork(work) {
  if (!work || !work.length) return '';
  var items = work.map(function (job) {
    var body = (job.summary ? '<p class="entry-summary">' + escapeHtml(job.summary) + '</p>' : '') +
      renderHighlights(job.highlights);
    return renderEntry({
      title: job.position || '',
      org: job.name || '',
      dates: dateRange(job.startDate, job.endDate),
      body: body,
    });
  }).join('');
  return cvSection('Experience', items);
}

function renderEducation(education) {
  if (!education || !education.length) return '';
  var items = education.map(function (ed) {
    var degree = [ed.studyType, ed.area].filter(Boolean).join(', ');
    return renderEntry({
      title: ed.institution || '',
      org: degree,
      dates: dateRange(ed.startDate, ed.endDate),
    });
  }).join('');
  return cvSection('Education', items);
}

function renderSkills(skills) {
  if (!skills || !skills.length) return '';
  var items = skills.map(function (s) {
    var kw = (s.keywords || []).map(escapeHtml).join(', ');
    return '<li><span class="skill-name">' + escapeHtml(s.name || '') + '</span>' +
      (kw ? '<span class="skill-kw">' + kw + '</span>' : '') + '</li>';
  }).join('');
  return cvSection('Skills', '<ul class="skills">' + items + '</ul>');
}

function renderProjects(projects) {
  if (!projects || !projects.length) return '';
  var items = projects.map(function (p) {
    var body = (p.description ? '<p class="entry-summary">' + escapeHtml(p.description) + '</p>' : '') +
      renderHighlights(p.highlights);
    return renderEntry({
      title: p.name || '',
      dates: dateRange(p.startDate, p.endDate),
      body: body,
    });
  }).join('');
  return cvSection('Projects', items);
}

function renderPublications(pubs) {
  if (!pubs || !pubs.length) return '';
  var items = pubs.map(function (p) {
    return renderEntry({
      title: p.name || '',
      org: p.publisher || '',
      dates: escapeHtml(formatDate(p.releaseDate)),
    });
  }).join('');
  return cvSection('Publications', items);
}

function renderResume(resume) {
  resume = resume || {};
  var b = resume.basics || {};
  var header = '<header class="resume-header">' +
    '<h1>' + escapeHtml(b.name || 'Your Name') + '</h1>' +
    (b.label ? '<p class="label">' + escapeHtml(b.label) + '</p>' : '') +
    renderContact(b) +
    (b.summary ? '<p class="summary">' + escapeHtml(b.summary) + '</p>' : '') +
    '</header>';
  return header + renderWork(resume.work) + renderEducation(resume.education) +
    renderSkills(resume.skills) + renderProjects(resume.projects) + renderPublications(resume.publications);
}
