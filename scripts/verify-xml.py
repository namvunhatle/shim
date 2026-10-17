"""Check XML syntax, resource references and source-node hierarchy (not Android compilation)."""
import json, re, sys
import xml.etree.ElementTree as ET
payload=json.load(sys.stdin)
files={f['path']:f['content'] for f in payload['files']}
parsed={path:ET.fromstring(content) for path,content in files.items() if path.endswith('.xml')}
resources=set()
for path,root in parsed.items():
    if '/values/' in path:
        for child in root:
            resources.add((child.tag,child.attrib['name']))
    elif '/drawable/' in path:
        resources.add(('drawable',path.rsplit('/',1)[-1][:-4]))
for path in files:
    if path.startswith('res/drawable') and not path.endswith('.xml'):
        resources.add(('drawable',path.rsplit('/',1)[-1].rsplit('.',1)[0]))
for path,root in parsed.items():
    for element in root.iter():
        for value in element.attrib.values():
            if re.fullmatch(r'@(color|dimen|string|drawable)/[a-z0-9_]+',value):
                kind,name=value[1:].split('/')
                assert (kind,name) in resources,(path,value)
layout=next(root for path,root in parsed.items() if '/layout/' in path)
actual=[]
aid='{http://schemas.android.com/apk/res/android}id'
def visit(element,parent_id=None):
    node_id=element.attrib.get(aid)
    if node_id:
        actual.append((node_id,parent_id))
    for child in element:
        visit(child,node_id or parent_id)
visit(layout)
expected=[]
def schema_visit(n,parent_id=None):
    node_id='@+id/dr_'+str(len(expected)+1)
    expected.append((node_id,parent_id))
    for child in n['children']:
        schema_visit(child,node_id)
schema_visit(payload['schema']['root'])
assert actual==expected,('Source node hierarchy changed',actual,expected)
print(json.dumps({'xmlFiles':len(parsed),'sourceNodes':len(actual),'references':'resolved','hierarchy':'preserved'}))
