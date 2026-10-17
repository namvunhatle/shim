import { parseSelection, DesignNode } from './parser';
import { validate, passedChecks } from './validator';
import { generateCompose } from './compose';
import { generateXML } from './xml';
import { buildReadiness } from './readiness';
import {collectAssets,AssetExporter} from './assets';
import {reconcileCapabilities} from './capabilities';
import {AndroidUISchema, overview, SelectionMode } from './schema';
export function analyze(nodes:readonly DesignNode[],options:{mode?:SelectionMode}={}){
 return analyzeSchema(parseSelection(nodes,options));
}
export function analyzeSchema(schema:AndroidUISchema){
 reconcileCapabilities(schema);const issues=validate(schema);
 return {schema,overview:overview(schema),issues,readiness:buildReadiness(schema,issues),passed:passedChecks(schema),verification:{status:'Not build verified',visualFidelity:'Not rendered or compared'},compose:generateCompose(schema),xml:generateXML(schema)};
}
export type Analysis=ReturnType<typeof analyze>;

export async function analyzeWithAssets(nodes:readonly DesignNode[],options:{mode?:SelectionMode},exporter:AssetExporter){const schema=parseSelection(nodes,options),before=JSON.stringify(schema);await collectAssets(schema,exporter);if(JSON.stringify(parseSelection(nodes,options))!==before)throw new Error('Design changed during artwork export. Analyze again for a consistent snapshot.');return analyzeSchema(schema);}
