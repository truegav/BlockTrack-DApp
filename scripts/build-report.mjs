#!/usr/bin/env node
/**
 * Build the BlockTrack final report:
 *   1. render the cover (full-bleed A4, no header/footer)
 *   2. render a body draft with TOC placeholders
 *   3. locate section headings in the draft and inject printed page numbers
 *   4. render the final body with a running header/footer
 *   5. merge cover + body, add bookmarks and metadata
 *
 * Requires Chrome (via playwright-core) and Python + PyMuPDF.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'docs/report');
const BUILD = path.join(REPORT, '.build');
const OUT_PDF = path.join(REPORT, 'BlockTrack-Final-Report.pdf');
const OUT_HTML = path.join(REPORT, 'BlockTrack-Final-Report.html');

const sections = [
  { id: 'sec-1', title: 'Executive summary' },
  { id: 'sec-2', title: 'Introduction and problem statement' },
  { id: 'sec-3', title: 'Scope and changes from the synopsis' },
  { id: 'sec-4', title: 'Objectives and outcomes' },
  { id: 'sec-5', title: 'System architecture' },
  { id: 'sec-6', title: 'Smart contract design' },
  { id: 'sec-7', title: 'Privacy and encryption design' },
  { id: 'sec-8', title: 'Application and user experience' },
  { id: 'sec-9', title: 'Implementation and technology choices' },
  { id: 'sec-10', title: 'Key decisions and trade-offs' },
  { id: 'sec-11', title: 'Testing and quality assurance' },
  { id: 'sec-12', title: 'Benchmarking with Caliper' },
  { id: 'sec-13', title: 'Deployment and operations' },
  { id: 'sec-14', title: 'Team roles and work distribution' },
  { id: 'sec-15', title: 'Timeline and milestones' },
  { id: 'sec-16', title: 'Results and achievements' },
  { id: 'sec-17', title: 'Limitations and future work' },
  { id: 'sec-18', title: 'Conclusion' },
  { id: 'sec-19', title: 'References' },
  { id: 'app-a', title: 'Appendix A. Contract interface' },
  { id: 'app-b', title: 'Appendix B. Test inventory' },
  { id: 'app-c', title: 'Appendix C. Commands and demo accounts' },
  { id: 'app-d', title: 'Appendix D. Presentation summary' },
];

const headerTemplate = `<div style="width:100%;box-sizing:border-box;padding:0 18mm;font-family:-apple-system,Segoe UI,sans-serif;font-size:7pt;color:#8192a1;display:flex;justify-content:space-between;align-items:center;"><span>BlockTrack · Final implementation report</span><span>October 2026</span></div>`;
const footerTemplate = `<div style="width:100%;box-sizing:border-box;padding:0 18mm;font-family:-apple-system,Segoe UI,sans-serif;font-size:7pt;color:#8192a1;display:flex;justify-content:space-between;align-items:center;"><span>BlockTrack · Privacy-preserving parcel tracking</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

async function waitForDocument(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
      )
    );
  });
  await page.waitForTimeout(350);
}

async function renderPdf(page, fileUrl, out, options) {
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await waitForDocument(page);
  await page.pdf({ path: out, printBackground: true, ...options });
  const stat = await fs.stat(out);
  console.log(`  ${path.relative(ROOT, out)}  ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
}

async function main() {
  await fs.mkdir(BUILD, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    console.log('[report] cover');
    await renderPdf(page, `file://${path.join(REPORT, 'cover.html')}`, path.join(BUILD, 'cover.pdf'), {
      format: 'A4',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });

    console.log('[report] body draft');
    await renderPdf(page, `file://${path.join(REPORT, 'report.html')}`, path.join(BUILD, 'body-draft.pdf'), {
      format: 'A4',
      margin: { top: '16mm', right: '18mm', bottom: '16mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      preferCSSPageSize: false,
    });

    console.log('[report] map sections');
    const sectionsPath = path.join(BUILD, 'sections.json');
    await fs.writeFile(sectionsPath, JSON.stringify(sections, null, 2));
    const tocPath = path.join(BUILD, 'toc-pages.json');
    execFileSync('python3', [
      path.join(ROOT, 'scripts/report-pages.py'),
      'map',
      '--pdf',
      path.join(BUILD, 'body-draft.pdf'),
      '--sections',
      sectionsPath,
      '--out',
      tocPath,
    ], { stdio: 'inherit' });

    const toc = JSON.parse(await fs.readFile(tocPath, 'utf8'));
    let html = await fs.readFile(path.join(REPORT, 'report.html'), 'utf8');
    for (const [id, pageNumber] of Object.entries(toc)) {
      const pattern = new RegExp(`(data-toc="${id}">)[^<]*(</span>)`);
      if (!pattern.test(html)) {
        throw new Error(`TOC placeholder not found for ${id}`);
      }
      html = html.replace(pattern, `$1${pageNumber}$2`);
    }
    if (html.includes('data-toc="')) {
      // All placeholders must have been replaced; a remaining one means the map is incomplete.
      const leftover = [...html.matchAll(/data-toc="([^"]+)">([^<]*)</g)].filter((m) => m[2] === '—');
      if (leftover.length) throw new Error(`Unfilled TOC entries: ${leftover.map((m) => m[1]).join(', ')}`);
    }
    await fs.writeFile(OUT_HTML, html);
    const finalHtmlPath = path.join(BUILD, 'report-final.html');
    await fs.writeFile(finalHtmlPath, html);
    console.log(`[report] final HTML -> ${path.relative(ROOT, OUT_HTML)}`);

    console.log('[report] body final');
    await renderPdf(page, `file://${OUT_HTML}`, path.join(BUILD, 'body.pdf'), {
      format: 'A4',
      margin: { top: '16mm', right: '18mm', bottom: '16mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      preferCSSPageSize: false,
    });

    console.log('[report] merge');
    execFileSync('python3', [
      path.join(ROOT, 'scripts/report-pages.py'),
      'merge',
      '--cover',
      path.join(BUILD, 'cover.pdf'),
      '--body',
      path.join(BUILD, 'body.pdf'),
      '--toc',
      tocPath,
      '--sections',
      sectionsPath,
      '--out',
      OUT_PDF,
    ], { stdio: 'inherit' });

    const stat = await fs.stat(OUT_PDF);
    console.log(`[report] done: ${path.relative(ROOT, OUT_PDF)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
