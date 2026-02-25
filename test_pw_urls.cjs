const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const urls = [
        "https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=2196F3&center=true&vCenter=true&width=435&lines=Hi+there,+I'm+Yuki-zik+%F0%9F%91%8B;Automation+Enthusiast;Frontend%2FBackend+Engineer;Tool+Maker",
        "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/0-profile-details.svg?raw=true",
        "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/4-productive-time.svg?raw=true",
        "https://github-readme-streak-stats.herokuapp.com/?user=Yuki-zik&theme=buefy&hide_border=true",
        "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/3-stats.svg?raw=true",
        "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/1-repos-per-language.svg?raw=true",
        "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/2-most-commit-language.svg?raw=true",
        "file://" + path.resolve("assets/github-annual-report.svg"),
        "https://raw.githubusercontent.com/Yuki-zik/Yuki-zik/output/github-contribution-grid-snake.svg"
    ];

    const browser = await chromium.launch();

    for (const url of urls) {
        console.log(`Navigating to ${url.substring(0, 50)}...`);
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            // The browser shows an error div if parsing fails
            const errorElement = await page.$('div[header="This page contains the following errors:"]');
            if (errorElement) {
                console.log(`!!!! XML PARSE ERROR ON: ${url}`);
                const text = await page.evaluate(() => document.body.innerText);
                console.log(text);
            } else {
                // some browsers render it differently, look for text
                const text = await page.evaluate(() => document.body.innerText);
                if (text.includes('This page contains the following errors:')) {
                    console.log(`!!!! XML PARSE ERROR ON: ${url}`);
                    console.log(text);
                }
            }
        } catch (e) {
            console.log(`Failed loading ${url}: ${e.message}`);
        }
        await page.close();
    }
    await browser.close();
})();
