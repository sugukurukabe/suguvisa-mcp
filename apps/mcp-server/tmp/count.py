import os

count_tool = 0
count_opts = 0
for root, dirs, files in os.walk('c:/Users/k_jim/OneDrive/デスクトップ/suguvisa-mcp/src/tools'):
    for file in files:
        if file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                t = content.count('server.tool(')
                o = content.count('readOnlyHint')
                count_tool += t
                count_opts += o
                if t > o:
                    print(f'MISSING in {file}: {t} tools, {o} options')
print(f'Total tools: {count_tool}, Total opts: {count_opts}')
