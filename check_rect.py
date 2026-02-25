import os
for root, _, files in os.walk('.'):
    for f in files:
        if f.endswith('.svg') and 'node_modules' not in root:
            try:
                content = open(os.path.join(root, f), 'r', encoding='utf-8').read()
                idx = 0
                while '<rect' in content[idx:]:
                    idx = content.find('<rect', idx)
                    tag_end = content.find('>', idx)
                    if tag_end == -1:
                        print('Malformed rect tag (no closing >) found in:', os.path.join(root, f))
                        break
                    
                    tag_content = content[idx:tag_end+1]
                    
                    # check if the tag is self-closing
                    if not tag_content.endswith('/>'):
                        # it's not self closing, so there MUST be a </rect> later
                        end_tag_idx = content.find('</rect>', tag_end)
                        if end_tag_idx == -1:
                            print('Malformed rect tag (no </rect> found) in:', os.path.join(root, f))
                            print('Tag:', tag_content)
                            break
                    
                    idx = tag_end + 1
            except Exception as e:
                pass
