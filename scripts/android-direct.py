"""Compile A/B/C/D fixture XML (and an imported H handoff with --handoff) with AAPT2 and Kotlin with the actual Compose compiler.
Uses explicit versions already installed in Gradle's local cache; no downloads, daemon or APK build.
Run `node scripts/android-fixtures.mjs --prepare-only` before this script.
"""
import json, os, shutil, subprocess, zipfile, sys, hashlib
from pathlib import Path
root=Path('.android-verification').resolve()
(root/'direct-results.json').unlink(missing_ok=True)
cache=Path.home()/'.gradle/caches/modules-2/files-2.1'
sdk=Path(os.environ.get('ANDROID_SDK_ROOT',os.environ.get('ANDROID_HOME',str(Path.home()/'Library/Android/sdk'))))
java_home=Path(os.environ.get('JAVA_HOME') or subprocess.check_output(['/usr/libexec/java_home'],text=True).strip())
def artifact(group,name,version):
    files=list((cache/group/name/version).glob('*/*.jar'))
    if not files: raise RuntimeError(f'Missing cached artifact: {group}:{name}:{version}')
    return files[0]
def run(args): subprocess.run([str(a) for a in args],check=True)
compiler=[artifact('org.jetbrains.kotlin',n,v) for n,v in [('kotlin-compiler-embeddable','2.0.21'),('kotlin-stdlib','2.0.21'),('kotlin-script-runtime','2.0.21'),('kotlin-reflect','1.6.10'),('kotlin-daemon-embeddable','2.0.21')]]
compiler += [artifact('org.jetbrains.intellij.deps','trove4j','1.0.20200330'),artifact('org.jetbrains.kotlinx','kotlinx-coroutines-core-jvm','1.6.4')]
annotations=list((cache/'org.jetbrains/annotations').glob('*/*/*.jar'))
if not annotations: raise RuntimeError('Missing JetBrains annotations jar')
compiler.append(annotations[0])
plugin=artifact('org.jetbrains.kotlin','kotlin-compose-compiler-plugin-embeddable','2.0.21')
classpath=[artifact('org.jetbrains.kotlin','kotlin-stdlib','2.0.21'),annotations[0],sdk/'platforms/android-35/android.jar']
jar_dir=root/'direct-libs';jar_dir.mkdir(exist_ok=True)
for pattern in ['androidx.compose.*/*/1.7.5/*/*.aar','androidx.compose.material3/*/1.3.1/*/*.aar']:
    for file in cache.glob(pattern):
        with zipfile.ZipFile(file) as z:
            if 'classes.jar' in z.namelist():
                target=jar_dir/(file.stem+'.jar');target.write_bytes(z.read('classes.jar'));classpath.append(target)
# Android annotations used in library signatures.
for file in (cache/'androidx.annotation/annotation-jvm').glob('*/*/*.jar'):
    classpath.append(file);break
reports=[]
for module in ['a','b','c','d']+(['h'] if '--handoff' in sys.argv else []):
    base=root/module;out=base/'direct';shutil.rmtree(out,ignore_errors=True);out.mkdir()
    manifest=out/'AndroidManifest.xml';manifest.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="shim.generated"><uses-sdk android:minSdkVersion="28" /></manifest>')
    aapt=sdk/'build-tools/34.0.0/aapt2'
    run([aapt,'compile','--dir',base/'src/main/res','-o',out/'compiled.zip'])
    run([aapt,'link','-I',sdk/'platforms/android-35/android.jar','--manifest',manifest,'--java',out/'java','-o',out/'resources.ap_',out/'compiled.zip'])
    classes=out/'classes';classes.mkdir(exist_ok=True)
    run([java_home/'bin/javac','-cp',sdk/'platforms/android-35/android.jar','-d',classes,*list((out/'java').rglob('*.java'))])
    cp=os.pathsep.join(str(p) for p in [*classpath,classes])
    run([java_home/'bin/java','-Xmx2g','-cp',os.pathsep.join(str(p) for p in compiler),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-jvm-target','17','-classpath',cp,'-Xplugin='+str(plugin),'-d',classes,*list((base/'src/main/java').rglob('*.kt'))])
    assert list(classes.rglob('*Kt.class'))
    reports.append({'fixture':module.upper(),'generatedSha256':{str(p.relative_to(base/'src/main')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((base/'src/main').rglob('*')) if p.is_file()},'xml':'AAPT2 compile + link passed','compose':'Kotlin 2.0.21 + Compose compiler passed','apkBuild':'Not build verified','visualFidelity':'Not rendered or compared'})
(root/'direct-results.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps([{k:v for k,v in report.items() if k!='generatedSha256'} for report in reports],indent=2))
