const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const markdown = fs.readFileSync('README.md', 'utf8');
        fs.writeFileSync('test.html', `<!DOCTYPE html><html><body>${markdown}</body></html>`);

        page.on('console', msg => {
            console.log('Browser Console:', msg.type(), msg.text());
        });
        page.on('pageerror', err => {
            console.log('Page Error:', err);
        });
        page.on('response', async res => {
            if (res.url().includes('.svg') || res.url().includes('stats') || res.url().includes('typing-svg')) {
                const text = await res.text().catch(() => '');
                if (text.includes('error on line 3 at column 111') || text.includes('Opening and ending tag mismatch: svg line 1 and rect')) {
                    console.log('FOUND BAD SVG URL:', res.url());
                } else if (text.includes('<rect') && !text.includes('</rect>') && !text.includes('/>')) {
                    console.log('FOUND UNCLOSED RECT IN:', res.url());
                }
            }
        });

        await page.goto('file://' + path.resolve('test.html'));
        await page.waitForTimeout(5000);
        console.log('Done checking test.html');
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
