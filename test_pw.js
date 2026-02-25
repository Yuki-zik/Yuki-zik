const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const markdown = fs.readFileSync('README.md', 'utf8');
        // Let's create an HTML file with the markdown body
        // We'll just put the exact HTML from the README (which has mostly raw HTML tags for SVGs)
        fs.writeFileSync('test.html', `<!DOCTYPE html><html><body>${markdown}</body></html>`);

        page.on('console', msg => {
            console.log('Browser Console:', msg.type(), msg.text());
        });
        page.on('pageerror', err => {
            console.log('Page Error:', err);
        });

        await page.goto('file://' + __dirname + '/test.html');
        // Let it load external SVGs
        await page.waitForTimeout(5000);
        console.log('Done checking test.html');
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
