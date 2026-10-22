#!/usr/bin/env python3
"""TSUMS P0 v4: scoped Step 3 metrics, exposure and Step 4 helmet UX.
Review page only. Does not alter main, IndexedDB, protected rules, or decision logic.
"""
from pathlib import Path
import os

p = Path('index.field-runtime-p0-debug.html')
if not p.is_file():
    raise SystemExit('STOP: diagnostic HTML missing; no files changed')
s = p.read_text(encoding='utf-8')
marker = 'tsums-field-ui-p0-v4'
if marker in s:
    print('ALREADY APPLIED: FIELD UI P0 V4')
    raise SystemExit(0)
if 'tsums-field-ui-p0-v3' not in s:
    raise SystemExit('STOP: v3 baseline missing; no files changed')

# Keep existing equipment storage keys: add the EXACT already-used conditional key
# to the ordinary visible list. NEVER auto-check or declare a universal requirement.
helmet = '岩盔／攀登頭盔（依路線暴露）'
old_gear = "const V0646_BASE_GEAR=['頭燈＋備用電池','雨具','防風雨衣','保暖層'"
new_gear = f"const V0646_BASE_GEAR=['頭燈＋備用電池','雨具','防風雨衣','{helmet}','保暖層'"
old_renderer = "renderPreparation=function(t){const exp=t.route?.exposure_profile?.exposures||{},conditional=!!(exp.geology||exp.fall||exp.technical||/落石|崩壁|拉繩|岩壁|碎石/.test(t.route?.terrain||''));const items=[...V0646_BASE_GEAR,...(conditional?['岩盔／攀登頭盔（依路線暴露）']:[])];"
new_renderer = 'renderPreparation=function(t){const items=[...V0646_BASE_GEAR];'
old_row = '''<div class="check"><span>${esc(x)}</span><input class="gearChk" data-k="${esc(x)}" type="checkbox" ${t.preparation?.gear?.[x]?'checked':''}></div>'''
new_row = '''<label class="check"><span>${esc(x)}</span><input class="gearChk" data-k="${esc(x)}" type="checkbox" ${t.preparation?.gear?.[x]?'checked':''}></label>'''

for name, old in [('base gear', old_gear), ('gear renderer', old_renderer), ('gear clickable row', old_row)]:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'STOP: {name} match count {count} instead of 1; no files changed')
s = s.replace(old_gear, new_gear, 1).replace(old_renderer, new_renderer, 1).replace(old_row, new_row, 1)

css = '''<style id="tsums-field-ui-p0-v4">
/* Route metrics: numbers and units are not tiny decorative text. */
#p3 .row3 {gap:14px!important}
#p3 .metric {
  min-height:110px!important; padding:20px 14px!important;
  border:2px solid #77613c!important; border-radius:16px!important;
  background:#17130c!important; display:flex!important;
  flex-direction:column!important;justify-content:center!important;gap:8px!important;
}
#p3 .metric b {
  font-size:30px!important;line-height:1.25!important;font-weight:900!important;
  color:#f6cc72!important;overflow-wrap:anywhere!important;
}
#p3 .metric span {
  font-size:18px!important;line-height:1.45!important;font-weight:750!important;
  color:#f5ede0!important;overflow-wrap:anywhere!important;
}
/* Exposure remains an observation, NOT an automatic GO/WAIT/RETREAT decision. */
#exposureProfileCard .exposureGrid {gap:12px!important}
#exposureProfileCard .exposureItem {
  min-width:0!important;min-height:82px!important;
  padding:16px 14px!important;gap:12px!important;
  border:2px solid #77613c!important;border-radius:14px!important;
  font-size:18px!important;line-height:1.45!important;font-weight:800!important;
  color:#fff!important;background:#15120d!important;
  overflow-wrap:anywhere!important;cursor:pointer!important;
}
#exposureProfileCard .exposureItem input {
  width:28px!important;height:28px!important;
  flex:0 0 28px!important;accent-color:#e4b956!important;
}
/* The full equipment ROW is now a <label>, not merely a decorative div. */
#p4 #gearList .check {
  display:flex!important;align-items:center!important;justify-content:space-between!important;
  gap:14px!important;min-height:80px!important;padding:16px 18px!important;
  margin:0 0 12px!important;border:2px solid #655235!important;
  border-radius:14px!important;background:#14110c!important;
  color:#fff!important;cursor:pointer!important;
}
#p4 #gearList .check span {
  font-size:20px!important;line-height:1.45!important;
  font-weight:700!important;overflow-wrap:anywhere!important;
}
#p4 #gearList .check input {
  width:30px!important;height:30px!important;
  flex:0 0 30px!important;accent-color:#e4b956!important;
}
#p4 #gearList .check:focus-within,
#exposureProfileCard .exposureItem:focus-within {
  outline:3px solid #facc15!important;outline-offset:3px!important;
}
body.field #p3 .metric, body.field #exposureProfileCard .exposureItem,
body.field #p4 #gearList .check {background:#fff7dd!important;border-color:#775516!important}
body.field #p3 .metric b,body.field #p3 .metric span,
body.field #exposureProfileCard .exposureItem,
body.field #p4 #gearList .check,body.field #p4 #gearList .check span {color:#111!important}
@media(max-width:360px){#exposureProfileCard .exposureGrid{grid-template-columns:1fr!important}}
</style>'''
if s.count('</head>') != 1:
    raise SystemExit('STOP: unexpected </head> count; no files changed')
s = s.replace('</head>', css + '\n</head>', 1)
if s.count(helmet) != 1 or s.count(new_row) != 1 or s.count(marker) != 1:
    raise SystemExit('STOP: post-change invariant failed; no files changed')
backup = p.with_name(p.name + '.pre-ui-v4.bak')
if backup.exists():
    raise SystemExit('STOP: existing v4 backup found; no files changed')
backup.write_text(p.read_text(encoding='utf-8'), encoding='utf-8')
temp = p.with_name(p.name + '.tmp-v4')
try:
    temp.write_text(s, encoding='utf-8')
    os.replace(temp, p)
except Exception:
    temp.unlink(missing_ok=True)
    raise
print('PASS: FIELD UI P0 V4')
print('Route metric size: 30px numbers / 18px labels')
print('Exposure choices: 18px / 82px minimum')
print('Helmet always visible, unchecked by default; original gear storage key preserved')
print('Full equipment row tappable; existing saved values retained')
print('Backup:', backup)
