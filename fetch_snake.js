const https = require('https');
https.get('https://raw.githubusercontent.com/Yuki-zik/Yuki-zik/output/github-contribution-grid-snake.svg', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data.slice(0, 500)));
});
