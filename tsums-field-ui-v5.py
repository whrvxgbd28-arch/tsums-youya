#!/usr/bin/env python3
"""TSUMS Field Runtime Review UI P0 v5.

Only changes the Codespaces diagnostic candidate, never index.html/main.
Idempotent across both v3 and v4 diagnostic candidates.
No event, governance, audit, or protected logic is altered.
"""
from pathlib import Path
import os

page = Path('index.field-runtime-p0-debug.html')
if not page.is_file():
    raise SystemExit('STOP: review diagnostic page missing. No changes.')
source = page.read_text(encoding='utf-8')
marker = 'tsums-field-ui-p0-v5'
if marker in source:
    print('ALREADY APPLIED: FIELD UI P0 V5')
    raise SystemExit(0)
if 'tsums-field-ui-p0-v3' not in source:
    raise SystemExit('STOP: required v3 review baseline missing. No changes.')

# Preserve the pre-existing saved gear key; the entry is always visible,
# while its check state remains controlled only by the human user.
helmet = '岩盔／攀登頭盔（依路線暴露）'
base_old = "const V0646_BASE_GEAR=['頭燈＋備用電池','雨具','防風雨衣','保暖層'"
base_new = f"const V0646_BASE_GEAR=['頭燈＋備用電池','雨具','防風雨衣','{helmet}','保暖層'"
render_old = "renderPreparation=function(t){const exp=t.route?.exposure_profile?.exposures||{},conditional=!!(exp.geology||exp.fall||exp.technical||/落石|崩壁|拉繩|岩壁|碎石/.test(t.route?.terrain||''));const items=[...V0646_BASE_GEAR,...(conditional?['岩盔／攀登頭盔（依路線暴露）']:[])];"
render_new = 'renderPreparation=function(t){const items=[...V0646_BASE_GEAR];'
row_old = '''<div class="check"><span>${esc(x)}</span><input class="gearChk" data-k="${esc(x)}" type="checkbox" ${t.preparation?.gear?.[x]?'checked':''}></div>'''
row_new = '''<label class="check"><span>${esc(x)}</span><input class="gearChk" data-k="${esc(x)}" type="checkbox" ${t.preparation?.gear?.[x]?'checked':''}></label>'''

for label, old, new in (
    ('equipment baseline', base_old, base_new),
    ('equipment renderer', render_old, render_new),
    ('equipment click target', row_old, row_new),
):
    a, b = source.count(old), source.count(new)
    if (a, b) == (1, 0):
        source = source.replace(old, new, 1)
    elif (a, b) != (0, 1):
        raise SystemExit(f'STOP: {label} unexpected counts old={a} new={b}; no changes.')

css = '''<style id="tsums-field-ui-p0-v5">
/* P0 v5: make actual route numbers and their labels equally legible. */
html body #p3 .row3{gap:14px!important}
html body #p3 .metric{
  min-height:132px!important;
  padding:22px 16px!important;
  border:2px solid #96723d!important;
  border-radius:18px!important;
  background:#18130c!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:12px!important;
}
html body #p3 .metric b{
  font-size:36px!important;line-height:1.25!important;
  font-weight:900!important;color:#ffd782!important;
}
html body #p3 .metric span{
  display:block!important;font-size:24px!important;
  line-height:1.4!important;font-weight:800!important;
  color:#fff!important;text-align:center!important;
  overflow-wrap:anywhere!important;
}
/* Accessible exposure choices: large text + a separate checkbox. */
html body #exposureProfileCard .exposureItem{
  min-height:88px!important;font-size:20px!important;
  line-height:1.45!important;font-weight:800!important;
  color:#fff!important;padding:16px!important;
}
html body #exposureProfileCard .exposureItem input{
  width:30px!important;height:30px!important;
  flex:0 0 30px!important;
}
/* Gear labels and the full clickable row, not only the tiny checkbox. */
html body #p4 #gearList label.check{
  display:flex!important;align-items:center!important;
  justify-content:space-between!important;
  gap:14px!important;min-height:96px!important;
  padding:18px!important;margin-bottom:12px!important;
  border:2px solid #81673f!important;
  border-radius:16px!important;background:#18130c!important;
  color:#fff!important;cursor:pointer!important;
}
html body #p4 #gearList label.check span{
  font-size:22px!important;line-height:1.45!important;
  font-weight:750!important;color:#fff!important;
  overflow-wrap:anywhere!important;
}
html body #p4 #gearList label.check input{
  width:32px!important;height:32px!important;
  flex:0 0 32px!important;accent-color:#f4c66b!important;
}
html body #p4 #gearList label.check:focus-within{
  outline:3px solid #facc15!important;outline-offset:3px!important;
}
/* Adapt to the existing outdoor high-contrast light scheme. */
body.field #p3 .metric,
body.field #p4 #gearList label.check {background:#fff7dd!important;border-color:#775516!important}
body.field #p3 .metric span,
body.field #exposureProfileCard .exposureItem,
body.field #p4 #gearList label.check span {color:#111!important}
body.field #p3 .metric b {color:#694700!important}
</style>'''
if source.count('</head>') != 1:
    raise SystemExit('STOP: unexpected HTML head. No changes.')
source = source.replace('</head>', css + '\n</head>', 1)
if any((source.count(marker) != 1, source.count(helmet) != 1,
        source.count(render_new) != 1, source.count(row_new) != 1,
        source.count('font-size:24px!important') != 1)):
    raise SystemExit('STOP: post-patch invariant mismatch. No changes.')

backup = page.with_name(page.name + '.pre-ui-v5.bak')
if backup.exists():
    raise SystemExit('STOP: backup already exists while marker is missing; manual review required.')
backup.write_text(page.read_text(encoding='utf-8'), encoding='utf-8')
tmp = page.with_name(page.name + '.tmp-v5')
try:
    tmp.write_text(source, encoding='utf-8')
    os.replace(tmp, page)
except Exception:
    tmp.unlink(missing_ok=True)
    raise
print('PASS: FIELD UI P0 V5')
print('METRIC: 36px numbers; 24px labels; 132px cards')
print('HELMET: always in Step 4, never automatically checked; storage key retained')
print('EXPOSURE: 20px; GEAR: 22px; full-row target')
print('BACKUP:', backup)
