import { chromium } from 'playwright';
import path from 'path';

const FILE = 'file://' + path.resolve('/home/user/SkyLab/job-estimates/index.html');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(FILE);
await page.waitForTimeout(300);

console.log('\n── 1. Boot & seed ──');
ok('no JS errors on load', errors.length === 0, errors.join(' | '));
ok('job view visible', await page.locator('#jobView').isVisible());
ok('empty state hidden when a job is open', await page.locator('#emptyState').isHidden());
ok('seeded 1 job', (await page.locator('.job-item').count()) === 1);
ok('name is Dennis Dr', (await page.locator('.name-input').inputValue()) === 'Dennis Dr');
ok('PM is Keri', (await page.locator('#f-pm').inputValue()) === 'Keri');

console.log('\n── 2. Seeded math ──');
const sum = async (k) => (await page.locator(`[data-sum="${k}"]`).textContent()).trim();
ok('subtotal $3,949.00', await sum('subtotal') === '$3,949.00', await sum('subtotal'));
ok('materials total $5,239.00', await sum('materialsTotal') === '$5,239.00', await sum('materialsTotal'));
ok('labor revenue $12,000.00', await sum('laborRevenue') === '$12,000.00', await sum('laborRevenue'));
ok('grand total $17,239.00', await sum('grandTotal') === '$17,239.00', await sum('grandTotal'));
ok('expenses $9,879.00', await sum('expenses') === '$9,879.00', await sum('expenses'));
ok('profit $7,360.00', await sum('profit') === '$7,360.00', await sum('profit'));
ok('margin 42.7%', await sum('margin') === '42.7%', await sum('margin'));

console.log('\n── 3. Section + line totals render ──');
const secTotals = await page.locator('[data-section-total]').allTextContents();
ok('3 section totals', secTotals.length === 3, JSON.stringify(secTotals));
ok('supplier section = $3,949.00', secTotals[2] === '$3,949.00', secTotals[2]);
ok('line totals populated', (await page.locator('[data-line-total]').first().textContent()) === '$0.00');

console.log('\n── 4. Typing does NOT destroy the UI (the old bug) ──');
await page.locator('.name-input').fill('Dennis Drive Rebuild');
await page.waitForTimeout(100);
ok('sections still present after typing name', (await page.locator('.section').count()) >= 6,
   'count=' + await page.locator('.section').count());
ok('summary still present', await page.locator('[data-sum="grandTotal"]').count() === 1);
ok('sidebar name updated live', (await page.locator('[data-job-name]').first().textContent()) === 'Dennis Drive Rebuild');
ok('no JS errors after typing', errors.length === 0, errors.join(' | '));

console.log('\n── 5. Focus is retained while typing (no re-render) ──');
await page.locator('#f-pm').click();
await page.keyboard.type('Keri Smith', { delay: 10 });
const focusId = await page.evaluate(() => document.activeElement.id);
ok('focus stayed in PM field', focusId === 'f-pm', 'focus=' + focusId);
ok('full text typed', (await page.locator('#f-pm').inputValue()) === 'KeriKeri Smith',
   await page.locator('#f-pm').inputValue());

console.log('\n── 6. Live recalculation ──');
const priceInput = page.locator('[data-si="0"][data-ii="0"][data-k="price"]');
await priceInput.fill('10');
await page.waitForTimeout(60);
ok('line total = $250.00 (25 x 10)',
   (await page.locator('[data-line-total="0-0"]').textContent()) === '$250.00',
   await page.locator('[data-line-total="0-0"]').textContent());
ok('lumber section total = $250.00',
   (await page.locator('[data-section-total="0"]').textContent()) === '$250.00');
ok('grand total now $17,489.00', await sum('grandTotal') === '$17,489.00', await sum('grandTotal'));
ok('profit unchanged $7,360.00 (materials pass through)', await sum('profit') === '$7,360.00', await sum('profit'));
await priceInput.fill('0');
await page.waitForTimeout(60);
ok('reverts to $17,239.00', await sum('grandTotal') === '$17,239.00');

console.log('\n── 7. Tax / delivery toggles ──');
const taxCb = page.locator('[data-bind="taxIncluded"]');
ok('tax rate input disabled initially', await page.locator('[data-bind="taxRate"]').isDisabled());
ok('tax summary row hidden initially', await page.locator('[data-row="tax"]').isHidden());
await taxCb.uncheck();
await page.waitForTimeout(60);
ok('tax input enabled after uncheck', await page.locator('[data-bind="taxRate"]').isEnabled());
ok('tax row now visible', await page.locator('[data-row="tax"]').isVisible());
await page.locator('[data-bind="taxRate"]').fill('7.75');
await page.waitForTimeout(60);
ok('tax = $306.05 (3949 x 7.75%)', await sum('tax') === '$306.05', await sum('tax'));
ok('grand total w/ tax $17,545.05', await sum('grandTotal') === '$17,545.05', await sum('grandTotal'));
await taxCb.check();
await page.waitForTimeout(60);
ok('tax removed again', await sum('grandTotal') === '$17,239.00', await sum('grandTotal'));

console.log('\n── 8. Add / delete lines ──');
const lumberRows = () => page.locator('[data-section="0"] tbody tr').count();
const before = await lumberRows();
await page.locator('[data-action="add-item"][data-si="0"]').click();
await page.waitForTimeout(60);
ok('row added', (await lumberRows()) === before + 1);
const focusedAttr = await page.evaluate(() => document.activeElement.getAttribute('data-k'));
ok('new row description focused', focusedAttr === 'desc', 'got ' + focusedAttr);
await page.keyboard.type('Test board');
await page.waitForTimeout(60);
await page.locator(`[data-action="del-item"][data-si="0"][data-ii="${before}"]`).click();
await page.waitForTimeout(60);
ok('row deleted', (await lumberRows()) === before);

console.log('\n── 9. Enter key adds next line ──');
await page.locator('[data-si="0"][data-ii="0"][data-k="desc"]').click();
await page.keyboard.press('Enter');
await page.waitForTimeout(60);
const f2 = await page.evaluate(() => document.activeElement.getAttribute('data-ii'));
ok('Enter moves to next row', f2 === '1', 'ii=' + f2);

console.log('\n── 10. Persistence across reload ──');
await page.waitForTimeout(500);
await page.reload();
await page.waitForTimeout(300);
ok('name persisted', (await page.locator('.name-input').inputValue()) === 'Dennis Drive Rebuild');
ok('PM persisted', (await page.locator('#f-pm').inputValue()) === 'KeriKeri Smith');
ok('totals persisted', await sum('grandTotal') === '$17,239.00', await sum('grandTotal'));
ok('still exactly 1 job (no double-seed)', (await page.locator('.job-item').count()) === 1);
ok('no errors after reload', errors.length === 0, errors.join(' | '));

console.log('\n── 11. New / duplicate / delete job ──');
await page.locator('.sidebar .new-btn').click();
await page.waitForTimeout(100);
ok('2 jobs now', (await page.locator('.job-item').count()) === 2);
ok('new job is blank', (await page.locator('.name-input').inputValue()) === 'New Estimate');
ok('new job totals $0.00', await sum('grandTotal') === '$0.00');
ok('empty section shows placeholder', (await page.locator('.rows-empty').count()) === 2);

await page.locator('[data-action="duplicate"]').click();
await page.waitForTimeout(100);
ok('3 jobs after duplicate', (await page.locator('.job-item').count()) === 3);
ok('copy name', (await page.locator('.name-input').inputValue()) === 'New Estimate (copy)');

page.on('dialog', d => d.accept());
await page.locator('[data-action="delete-job"]').click();
await page.waitForTimeout(150);
ok('2 jobs after delete', (await page.locator('.job-item').count()) === 2);

console.log('\n── 12. Search ──');
await page.locator('#searchInput').fill('dennis');
await page.waitForTimeout(80);
ok('search filters to 1', (await page.locator('.job-item').count()) === 1);
await page.locator('#searchInput').fill('4206');
await page.waitForTimeout(80);
ok('search matches address', (await page.locator('.job-item').count()) === 1);
await page.locator('#searchInput').fill('zzzz');
await page.waitForTimeout(80);
ok('no match shows message', (await page.locator('.list-empty').count()) === 1);
await page.locator('#searchInput').fill('');
await page.waitForTimeout(80);

console.log('\n── 13. Switching jobs ──');
await page.locator('.job-item').first().click();
await page.waitForTimeout(100);
const active = await page.locator('.job-item.active').count();
ok('exactly one active row', active === 1);
ok('no errors overall', errors.length === 0, errors.join(' | '));

console.log('\n── 14. Status change ──');
await page.locator('[data-bind="status"]').selectOption('yellow');
await page.waitForTimeout(80);
const dotCls = await page.locator('.job-item.active .status-dot').getAttribute('class');
ok('sidebar dot turns yellow', dotCls.includes('status-yellow'), dotCls);

console.log('\n── 15. Negative profit styling ──');
await page.locator('.job-item').filter({ hasText: 'Dennis' }).first().click();
await page.waitForTimeout(100);
await page.locator('[data-bind="labor.subContractorCost"]').fill('99999');
await page.waitForTimeout(80);
ok('profit is negative', (await sum('profit')).startsWith('-'), await sum('profit'));
ok('negative class applied', await page.locator('[data-row="profit"].negative').count() === 1);
await page.locator('[data-bind="labor.subContractorCost"]').fill('4500');
await page.waitForTimeout(80);
ok('back to $7,360.00', await sum('profit') === '$7,360.00', await sum('profit'));

console.log('\n── 16. Mobile layout ──');
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(150);
ok('sidebar hidden on mobile', !(await page.locator('#sidebar').isVisible()) ||
   (await page.locator('#sidebar').boundingBox()).x < 0);
ok('hamburger visible', await page.locator('[data-action="menu"]').isVisible());
await page.locator('[data-action="menu"]').click();
await page.waitForTimeout(300);
const box = await page.locator('#sidebar').boundingBox();
ok('sidebar slides in', box.x >= 0, JSON.stringify(box));
await page.mouse.click(350, 400);   // tap the exposed strip right of the drawer
await page.waitForTimeout(300);
ok('backdrop closes sidebar', (await page.locator('#sidebar').boundingBox()).x < 0);
const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
ok('no horizontal page overflow', scrollW <= 391, 'scrollWidth=' + scrollW);
await page.setViewportSize({ width: 1280, height: 900 });

console.log('\n── 17. Corrupt-data resilience ──');
await page.evaluate(() => localStorage.setItem('skylab.estimates.v1', '{ broken json'));
await page.reload();
await page.waitForTimeout(300);
ok('recovers by re-seeding', (await page.locator('.job-item').count()) === 1);
ok('app still functional', await page.locator('#jobView').isVisible());

await page.evaluate(() => localStorage.setItem('skylab.estimates.v1',
  JSON.stringify({ jobs: [{ name: 'Sparse Job' }] })));
await page.reload();
await page.waitForTimeout(300);
ok('sparse job migrated without crashing', (await page.locator('.name-input').inputValue()) === 'Sparse Job');
ok('missing fields defaulted', await sum('grandTotal') === '$0.00');
ok('no unexpected errors from migration', errors.length === 0, errors.join(' | '));
const kept = await page.evaluate(() => localStorage.getItem('skylab.estimates.v1.prev'));
ok('corrupt blob preserved for recovery', kept === '{ broken json', String(kept));

console.log('\n── 18. XSS safety ──');
await page.locator('.name-input').fill('<img src=x onerror="window.__xss=1">');
await page.waitForTimeout(100);
await page.reload();
await page.waitForTimeout(300);
const xss = await page.evaluate(() => window.__xss);
ok('script in job name not executed', xss === undefined);
ok('name round-trips as text',
   (await page.locator('.name-input').inputValue()) === '<img src=x onerror="window.__xss=1">');

console.log('\n── 19. Print rendering ──');
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(100);
ok('sidebar hidden in print', !(await page.locator('#sidebar').isVisible()));
ok('action buttons hidden in print', !(await page.locator('[data-action="duplicate"]').isVisible()));
ok('summary visible in print', await page.locator('[data-sum="grandTotal"]').isVisible());
await page.emulateMedia({ media: 'screen' });

console.log('\n── 20. Customer vs internal print copy ──');
// Sections 17-18 left a fixture job with no line items; reset to the real seed.
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(300);
ok('reset back to seeded Dennis Dr', (await page.locator('.name-input').inputValue()) === 'Dennis Dr');
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(100);
ok('profit hidden on customer copy',     await page.locator('[data-sum="profit"]').isHidden());
ok('margin hidden on customer copy',     await page.locator('[data-sum="margin"]').isHidden());
ok('subcontractor cost hidden',          await page.locator('[data-bind="labor.subContractorCost"]').isHidden());
ok('upcharge line hidden',               await page.locator('[data-sum="upcharge"]').isHidden());
ok('unit prices hidden',                 await page.locator('[data-si="0"][data-ii="0"][data-k="price"]').isHidden());
ok('grand total still shown',            await page.locator('[data-sum="grandTotal"]').isVisible());
ok('materials total still shown',        await page.locator('[data-sum="materialsTotal"]').isVisible());
ok('labor charge still shown',           await page.locator('[data-sum="laborRevenue2"]').isVisible());
ok('descriptions still shown',           await page.locator('[data-si="0"][data-ii="0"][data-k="desc"]').isVisible());
ok('quantities still shown',             await page.locator('[data-si="0"][data-ii="0"][data-k="qty"]').isVisible());

await page.emulateMedia({ media: 'screen' });
await page.locator('[data-print-internal]').check();
await page.waitForTimeout(100);
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(100);
ok('profit shown on internal copy',      await page.locator('[data-sum="profit"]').isVisible());
ok('subcontractor cost shown',           await page.locator('[data-bind="labor.subContractorCost"]').isVisible());
ok('unit prices shown',                  await page.locator('[data-si="0"][data-ii="0"][data-k="price"]').isVisible());
await page.emulateMedia({ media: 'screen' });
await page.waitForTimeout(400);
await page.reload(); await page.waitForTimeout(300);
ok('print preference persists', await page.locator('[data-print-internal]').isChecked());
ok('everything visible on screen regardless',
   await page.locator('[data-sum="profit"]').isVisible() &&
   await page.locator('[data-si="0"][data-ii="0"][data-k="price"]').isVisible());
ok('no errors in print tests', errors.length === 0, errors.join(' | '));

console.log(`\n${'='.repeat(46)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(46)}`);
if (errors.length) console.log('\nCaptured errors:\n' + errors.join('\n'));

await browser.close();
process.exit(fail ? 1 : 0);
