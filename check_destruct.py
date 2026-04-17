import os
for root, dirs, files in os.walk('c:/Users/k_jim/OneDrive/デスクトップ/suguvisa-mcp/src/tools'):
    for file in files:
        if file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'server.tool(' in content:
                    if 'destructiveHint' not in content or 'readOnlyHint' not in content:
                        print(path)
