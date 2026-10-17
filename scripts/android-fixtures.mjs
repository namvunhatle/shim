// Build only the deterministic A/B/C examples. This does not verify arbitrary plugin exports.
import { build } from 'esbuild';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
await build({stdin:{contents:"export { analyze,analyzeWithAssets } from './src/pipeline'; export { simpleComponent, nestedComponent, fullScreen,implementationScreen } from './tests/fixtures';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-build/android-input.mjs'});
const {analyze,analyzeWithAssets,simpleComponent,nestedComponent,fullScreen,implementationScreen}=await import('../.test-build/android-input.mjs');
const root=resolve('.android-verification');await mkdir(root,{recursive:true});
await writeFile(root+'/settings.gradle',`pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositories { google(); mavenCentral() } }\nrootProject.name = 'ShimVerification'\ninclude ':a', ':b', ':c', ':d'\n`);
await writeFile(root+'/build.gradle',`buildscript { repositories { google(); mavenCentral(); gradlePluginPortal() }; dependencies { classpath 'com.android.tools.build:gradle:8.7.3'; classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21'; classpath 'org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.0.21' } }\n`);
await writeFile(root+'/gradle.properties','android.useAndroidX=true\nkotlin.compiler.execution.strategy=in-process\norg.gradle.jvmargs=-Xmx2048m\norg.gradle.workers.max=2\n');
const sdk=process.env.ANDROID_SDK_ROOT??process.env.ANDROID_HOME??resolve(process.env.HOME,'Library/Android/sdk');
await writeFile(root+'/local.properties',`sdk.dir=${sdk}\n`);
for(const [module,fixture] of [['a',simpleComponent],['b',nestedComponent],['c',fullScreen],['d',implementationScreen]]){
 await rm(`${root}/${module}/src`,{recursive:true,force:true});
 const out=module==='d'?await analyzeWithAssets([fixture()],{},async()=>({bytes:new Uint8Array(await readFile('tests/fixtures/artwork.png')),bounds:{x:12,y:168,width:300,height:180}})):analyze([fixture()]);
 for(const file of [...out.compose.map(f=>({...f,path:'java/shim/generated/'+f.path})),...out.xml]){
  const path=`${root}/${module}/src/main/${file.path}`;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,file.encoding==='base64'?Buffer.from(file.content,'base64'):file.content);
 }
 await writeFile(`${root}/${module}/src/main/AndroidManifest.xml`,'<manifest xmlns:android="http://schemas.android.com/apk/res/android" />\n');
 await writeFile(`${root}/${module}/build.gradle`, `apply plugin: 'com.android.library'\napply plugin: 'org.jetbrains.kotlin.android'\napply plugin: 'org.jetbrains.kotlin.plugin.compose'\nandroid { namespace 'shim.generated'; compileSdk 35; defaultConfig { minSdk 28 }; buildFeatures { compose true }; compileOptions { sourceCompatibility JavaVersion.VERSION_17; targetCompatibility JavaVersion.VERSION_17 }; kotlinOptions { jvmTarget = '17' } }\ndependencies { implementation 'androidx.compose.foundation:foundation-android:1.7.5'; implementation 'androidx.compose.material3:material3-android:1.3.1' }\n`);
}
if(process.argv.includes('--prepare-only'))process.exit(0);
const result=spawnSync(process.env.SHIM_GRADLE??'gradle',['--offline','--no-daemon','--console=plain',':a:assembleDebug',':b:assembleDebug',':c:assembleDebug',':d:assembleDebug'],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;
