import urllib.request
import sys

url = "https://github.com/Yuki-zik/Yuki-zik/blob/main/profile-summary-card-output/buefy/0-profile-details.svg?raw=true"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    print("Content-Type:", response.headers.get('Content-Type'))
    data = response.read().decode('utf-8')
    print("Content starts with:\n", data[:200])
except Exception as e:
    print(f"ERROR: {e}")
