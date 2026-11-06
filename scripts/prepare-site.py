"""补齐独立页面外壳，原始 style、script 与正文逐字保留。"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = (root / 'dongda-mvp.html').read_text()
head, body = source.split('</style>', 1)
url = 'https://Lynch715.github.io/dongda-construction-sim/'
metadata = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#D9530E">
<meta name="theme-color" content="#FF7A2E" media="(prefers-color-scheme: dark)">
<meta name="description" content="从一支施工队，到特级资质、上市公司。投标算账，守住现金流，在江州的天际线上留下你的地标。免费在线游玩，手机电脑都能玩。">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="东大建筑经营台账">
<meta property="og:description" content="从一支施工队，到特级资质、上市公司。投标算账，守住现金流，在江州留下你的地标。">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{url}posters/poster.png">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1920">
<meta property="og:image:alt" content="东大建筑经营台账宣传海报，展示真实游戏经营数据、天际线与市场版图">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
'''
result = metadata + head + '</style>\n</head>\n<body>' + body + '\n</body>\n</html>\n'
(root / 'index.html').write_text(result)
assert result.split('<style>', 1)[1].split('</style>', 1)[0] == source.split('<style>', 1)[1].split('</style>', 1)[0]
assert result.split('<script>', 1)[1].split('</script>', 1)[0] == source.split('<script>', 1)[1].split('</script>', 1)[0]
assert result.split('<body>', 1)[1].split('\n</body>', 1)[0] == body
print('已生成 index.html；原始样式、脚本、正文完全一致')
