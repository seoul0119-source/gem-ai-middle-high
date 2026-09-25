// Test fixture only. This module is never copied into the deployed classroom.
import {fixture} from './fixture.mjs';
export function workbookFixture(seed=2){const result=fixture();let n=seed;for(const stage of result.steps){if(stage.kind!=='question')continue;for(const t of Object.values(stage.text)){t.board=[`${n} + 1 = ?`];t.options=[String(n),String(n+1),String(n+2)];t.explanation=`${n} + 1 = ${n+1}.`;}stage.answerIndex=1;n++;}return result;}
