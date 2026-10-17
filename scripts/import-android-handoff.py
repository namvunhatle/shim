"""Stage a plugin-exported handoff ZIP for the direct Android compiler (no APK/render claim)."""
import sys,zipfile,json,hashlib,shutil
from pathlib import Path,PurePosixPath
archive=Path(sys.argv[1]);root=Path('.android-verification/h');src=root/'src/main'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None,'ZIP CRC failure'
    names=z.namelist();assert len(names)==len(set(names)),'Duplicate ZIP entries'
    report=json.loads(z.read('readiness.json'));schema=json.loads(z.read('android-ui-schema.json'))
    files=[n for n in names if n.startswith('res/') or n.endswith('.kt')]
    assert sum(z.getinfo(n).file_size for n in files)<64_000_000,'Package too large'
    for name in files:
        assert not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts,'Unsafe path'
    shutil.rmtree(src,ignore_errors=True)
    hashes={}
    for name in files:
        data=z.read(name);target=src/('java/shim/generated/'+name if name.endswith('.kt') else name)
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);hashes[name]=hashlib.sha256(data).hexdigest()
    (root/'source.json').write_text(json.dumps({'source':archive.name,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'screen':schema['root']['name'],'generatedSha256':hashes,'pngAssets':len([n for n in files if n.endswith('.png')]),'observations':len(report['issues']),'readiness':{f:v['status'] for f,v in report['handoff']['frameworks'].items()}},indent=2)+'\n')
    print(json.dumps({'source':archive.name,'pngAssets':len([n for n in files if n.endswith('.png')]),'files':len(files),'observations':len(report['issues']),'status':{f:v['status'] for f,v in report['handoff']['frameworks'].items()}},indent=2))
