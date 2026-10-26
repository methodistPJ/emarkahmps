from pathlib import Path
root=Path(__file__).resolve().parent.parent
client=root/'client'
h=(client/'template.html').read_text().replace('__STYLES__',(client/'style.css').read_text())
for name in ['reliability','admin-selectors','experience']:
    anchor='CHARTS' if name in ['reliability','experience'] else 'ADMIN'
    h=h.replace('<script>__'+anchor+'__','<script>'+(client/(name+'.js')).read_text()+'</script><script>__'+anchor+'__')
for name in ['zip-vendor','setup-contract','school-template','xlsx','onboarding','school-import']:
    h=h.replace('<script>__ADMIN__','<script>'+(client/(name+'.js')).read_text()+'</script><script>__ADMIN__')
for name in ['config','api','charts','marks','review','analytics','admin','app']:
    h=h.replace('__'+name.upper()+'__',(client/(name+'.js')).read_text())
(root/('src' if (root/'src').exists() else 'release')/'Workspace.html').write_text(h)
print('Built Workspace.html from baseline-derived modules.')
