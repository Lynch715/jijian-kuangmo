"""重新生成海报二维码；使用 --fonts 更新海报所用的 Google Fonts 文字子集。"""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import re
import urllib.request
import urllib.parse
import qrcode
import qrcode.image.svg

root = Path(__file__).resolve().parent.parent
assets = root / 'posters/assets'
parser = argparse.ArgumentParser()
parser.add_argument('--fonts', action='store_true')
args = parser.parse_args()
url = 'https://lynch715.github.io/jijian-kuangmo/'
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=12, border=4)
qr.add_data(url)
qr.make(fit=True)
qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(assets / 'play-qr.svg')
qr.make_image(fill_color='#0E1419', back_color='#F6F8F8').save(assets / 'play-qr.png')
print(f'已生成二维码：{url}；码区 {qr.modules_count}×{qr.modules_count}，四周各 4 模块静区')

if args.fonts:
    class Text(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts = []
        def handle_data(self, data):
            self.parts.append(data)
    text_parser = Text()
    for name in ['poster.html', 'poster-qr.html']:
        text_parser.feed((root / 'posters' / name).read_text())
    chars = ''.join(sorted(set(''.join(text_parser.parts))))
    families = [('Noto Serif SC:wght@900', 'noto-serif-sc'), ('Noto Sans SC:wght@400;500;700', 'noto-sans-sc'), ('JetBrains Mono:wght@400;600', 'jetbrains-mono')]
    all_css = []
    fonts = assets / 'fonts'
    for family, filename in families:
        query = urllib.parse.urlencode({'family': family, 'display': 'swap', 'text': chars})
        request = urllib.request.Request('https://fonts.googleapis.com/css2?' + query, headers={'User-Agent': 'Mozilla/5.0'})
        css = urllib.request.urlopen(request, timeout=30).read().decode()
        for i, font_url in enumerate(dict.fromkeys(re.findall(r'url\(([^)]+)\)', css))):
            data = urllib.request.urlopen(font_url, timeout=30).read()
            name = f'{filename}-{i}.ttf'
            (fonts / name).write_bytes(data)
            css = css.replace(font_url, name)
        all_css.append(css)
    (fonts / 'fonts.css').write_text('\n'.join(all_css))
    print('已更新三款字体的海报文字子集')
