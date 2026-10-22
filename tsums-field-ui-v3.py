#!/usr/bin/env python3
"""TSUMS Field UI P0 v3. Review-only page. Does not alter app state or official main."""
from pathlib import Path
import re
import html

p = Path('index.field-runtime-p0-debug.html')
original = p.read_text(encoding='utf-8')
marker = 'tsums-field-ui-p0-v3'
if marker in original:
    print('ALREADY APPLIED: FIELD UI P0 V3')
    raise SystemExit(0)

s = original
# One canonical portal list in Step 5; Step 3 source-recording controls remain intact.
geo = re.compile(r'(<div class="card" id="geologyRiskCard">[\s\S]*?)<details class="officialPortalDisclosure" open>[\s\S]*?</details>')
def compact_geo(m):
    return m.group(1) + '<div class="boundaryNote tsumsPortalReference">官方查核網站集中於 Step 5「行前確認」。此處仍需獨立保存地質查核的來源、圖層、時間及判斷；開啟網站不等於完成查核。</div>'
s, removed = geo.subn(compact_geo, s, count=1)
if removed != 1:
    raise SystemExit('STOP: expected exactly one Step 3 duplicate portal; no files changed')

# Preserve portal IDs on the actual clickable links for existing click handlers.
link = re.compile(r'<a\s+href="([^"]+)"\s+target="_blank"\s+rel="noopener"\s+data-portal-id="([^"]+)">\s*<b>(.*?)</b>\s*<span>(.*?)</span>\s*<em>(.*?)</em>\s*</a>', re.S)
def split(m):
    url, portal_id, title, description, action = [x.strip() for x in m.groups()]
    return (f'<div class="tsumsPortalEntry"><b>{title}</b>'
            f'<span>{description}</span>'
            f'<a class="tsumsPortalAction" href="{url}" target="_blank" '
            f'rel="noopener noreferrer" data-portal-id="{portal_id}" '
            f'aria-label="開啟{html.escape(title, quote=True)}官方來源">{action}</a></div>')
s, rebuilt = link.subn(split, s)
if rebuilt != 8:
    raise SystemExit(f'STOP: expected 8 official links, found {rebuilt}; no files changed')

s, nav_count = re.subn(r'id="journeyHomeBtn"', 'id="journeyHomeBtn" aria-label="返回行動總覽"', s)
if nav_count != 1:
    raise SystemExit(f'STOP: journey home control count {nav_count}; no files changed')

css = '''<style id="tsums-field-ui-p0-v3">
/* Canonical official portal: title and explanation are not themselves links. */
.officialPortalMatrix {display:grid!important;grid-template-columns:1fr!important;gap:14px!important}
.officialPortalMatrix .tsumsPortalEntry {
  display:flex;flex-direction:column;gap:10px;min-width:0;
  padding:20px;border:1px solid #75603b;border-radius:14px;background:#100e0a;
}
.officialPortalMatrix .tsumsPortalEntry>b {
  display:block;font-size:20px!important;line-height:1.5!important;
  font-weight:800!important;color:#fff!important;overflow-wrap:anywhere;
}
.officialPortalMatrix .tsumsPortalEntry>span {
  display:block;font-size:18px!important;line-height:1.6!important;
  font-weight:550!important;color:#e6e0d7!important;overflow-wrap:anywhere;
}
.officialPortalMatrix .tsumsPortalEntry>.tsumsPortalAction {
  display:flex!important;align-items:center!important;justify-content:center!important;
  width:100%!important;min-height:76px!important;margin-top:8px!important;
  padding:15px 18px!important;border:2px solid #e4b956!important;
  border-radius:12px!important;background:#352408!important;
  color:#ffe3a0!important;font-size:20px!important;font-weight:800!important;
  line-height:1.45!important;text-decoration:none!important;text-align:center;
}
.officialPortalMatrix .tsumsPortalAction:focus-visible {
  outline:3px solid #fff!important;outline-offset:3px!important;
}
#geologyRiskCard .tsumsPortalReference {font-size:17px!important;line-height:1.55!important}
/* Journey Home is a navigation control, not a new decision-state button. */
.journeyTopNav {display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important}
.journeyTopNav #journeyHomeBtn {
  grid-column:1!important;grid-row:1!important;justify-self:stretch!important;
  display:flex!important;align-items:center!important;justify-content:center!important;
  width:100%!important;min-height:80px!important;padding:16px 20px!important;
  border:2px solid #e4b956!important;border-radius:14px!important;
  background:#352408!important;color:#ffe3a0!important;
  font-size:22px!important;line-height:1.3!important;font-weight:900!important;
}
.journeyTopNav #journeyHomeBtn:before {content:'←';margin-right:10px;font-size:26px}
.journeyTopNav #journeyHomeBtn:focus-visible {outline:3px solid #fff!important;outline-offset:3px!important}
.journeyTopNav #journeyPhaseBadge {grid-column:2!important;grid-row:1!important;justify-self:end!important;margin-left:0!important}
.journeyTopNav #journeyRuntimeBtn {grid-column:1!important;grid-row:2!important}
.journeyTopNav #journeyReplayBtn {grid-column:2!important;grid-row:2!important}
body.field .tsumsPortalEntry {background:#fff8e8!important}
body.field .tsumsPortalEntry>b,body.field .tsumsPortalEntry>span {color:#111!important}
body.field .tsumsPortalAction,body.field #journeyHomeBtn {
  background:#fff1b8!important;color:#151515!important;border-color:#775516!important;
}
</style>'''
if '</head>' not in s:
    raise SystemExit('STOP: missing </head>; no files changed')
s = s.replace('</head>', css + '\n</head>', 1)
backup = p.with_suffix(p.suffix + '.pre-ui-v3.bak')
backup.write_text(original, encoding='utf-8')
p.write_text(s, encoding='utf-8')
assert s.count('class="tsumsPortalEntry"') == 8
assert s.count('data-portal-id=') == 8
assert s.count('class="officialPortalMatrix"') == 1
assert s.count('id="journeyHomeBtn"') == 1
print('PASS: FIELD UI P0 V3')
print('Step 3 duplicate removed:', removed, '| Step 5 links preserved:', rebuilt, '| Home control:',nav_count)
print('Backup:', backup)
