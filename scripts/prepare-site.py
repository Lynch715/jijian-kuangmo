"""补齐独立页面外壳，原始 style、script 与正文逐字保留。"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
source = (root / 'dongda-mvp.html').read_text()
assert '<title>基建狂魔</title>' in source, '请使用标题为「基建狂魔」的新版源文件'
assert 'function heroHTML()' in source, '新版源文件应包含开局横幅'
head, body = source.split('</style>', 1)
viewport_pattern = r'<meta\b[^>]*\bname=["\']viewport["\'][^>]*>'
viewports = re.findall(viewport_pattern, source, re.I)
assert len(viewports) == 1 and viewports[0] in head, '源文件的 head 区域必须自带且仅带一行 viewport'
url = 'https://lynch715.github.io/jijian-kuangmo/'
metadata = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="theme-color" content="#D9530E">
<meta name="theme-color" content="#FF7A2E" media="(prefers-color-scheme: dark)">
<meta name="description" content="从一支施工队，到特级资质、上市公司">
<meta property="og:type" content="website">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="基建狂魔">
<meta property="og:description" content="从一支施工队，到特级资质、上市公司">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{url}posters/poster.png">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1920">
<meta property="og:image:alt" content="基建狂魔宣传海报，展示真实游戏开局横幅、经营数据、天际线与市场版图">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
'''
result = metadata + head + '</style>\n</head>\n<body>' + body + '\n</body>\n</html>\n'
(root / 'index.html').write_text(result)
assert result.split('<style>', 1)[1].split('</style>', 1)[0] == source.split('<style>', 1)[1].split('</style>', 1)[0]
assert re.findall(r'<script\b[^>]*>[\s\S]*?</script>', result, re.I) == re.findall(r'<script\b[^>]*>[\s\S]*?</script>', source, re.I)
assert result.split('<body>', 1)[1].split('\n</body>', 1)[0] == body
assert re.findall(viewport_pattern, result, re.I) == viewports
print('已生成 index.html；原始样式、脚本、正文完全一致；仅保留源文件自带的唯一 viewport')
