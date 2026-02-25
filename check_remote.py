import urllib.request
import xml.etree.ElementTree as ET
import sys

urls = [
    "https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=2196F3&center=true&vCenter=true&width=435&lines=Hi+there,+I'm+Yuki-zik+%F0%9F%91%8B;Automation+Enthusiast;Frontend%2FBackend+Engineer;Tool+Maker",
    "https://github-readme-streak-stats.herokuapp.com/?user=Yuki-zik&theme=buefy&hide_border=true",
    "https://raw.githubusercontent.com/Yuki-zik/Yuki-zik/output/github-contribution-grid-snake.svg"
]

for i, url in enumerate(urls):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=10)
        data = response.read()
        print(f"[{i}] Downloaded {len(data)} bytes from {url}")
        try:
            ET.fromstring(data)
            print(f"[{i}] Valid XML!")
        except ET.ParseError as e:
            print(f"[{i}] XML Parse Error: {e}")
            lines = data.decode('utf-8', errors='ignore').split('\n')
            if len(lines) >= 3:
                print(f"[{i}] Line 3: {lines[2][:150]}")
    except Exception as e:
        print(f"[{i}] Request Error: {e}")
