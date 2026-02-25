import urllib.request
import sys

urls = [
    "https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=2196F3&center=true&vCenter=true&width=435&lines=Hi+there,+I'm+Yuki-zik+%F0%9F%91%8B;Automation+Enthusiast;Frontend%2FBackend+Engineer;Tool+Maker",
    "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/0-profile-details.svg?raw=true",
    "https://github-readme-streak-stats.herokuapp.com/?user=Yuki-zik&theme=buefy&hide_border=true",
    "https://raw.githubusercontent.com/Yuki-zik/Yuki-zik/output/github-contribution-grid-snake.svg"
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        data = response.read().decode('utf-8')
        if 'error on line' in data or 'rect' in data:
            print(f"URL: {url}\nHas rect/error: YES\nStart: {data[:100]}")
        else:
            print(f"URL: {url} OK")
    except Exception as e:
        print(f"URL: {url} ERROR: {e}")
