import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            if (f !== 'node_modules' && f !== '.git') walk(p);
        } else if (p.endsWith('.svg')) {
            const xmlData = fs.readFileSync(p, 'utf8');
            const parser = new XMLParser({
                ignoreAttributes: false,
                allowBooleanAttributes: true,
            });
            try {
                // If you do not provide error handler or something that throws, fast-xml-parser 
                // usually logs or fails silently unless configured to throw on error, but let's check basic stuff.
                // Another way: use xmldom. Let's just Regex check like the browser error said.
                // "Opening and ending tag mismatch: svg line 1 and rect"
                // This means there is a <rect> that is neither closing with </rect> nor self-closing />
                console.log(`Checking ${p}...`);
            } catch (err) {
                console.error(`Error parsing ${p}:`, err.message);
            }
        }
    }
}
walk('.');
