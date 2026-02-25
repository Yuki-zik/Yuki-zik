import os
import xml.etree.ElementTree as ET

for root_dir, _, files in os.walk('.'):
    for f in files:
        if f.endswith('.svg'):
            p = os.path.join(root_dir, f)
            try:
                ET.parse(p)
            except ET.ParseError as e:
                print(f"Error in {p}: {e}")
