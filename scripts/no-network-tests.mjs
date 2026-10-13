// The scoped UI release must never send a real provider request during tests.
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
const deny=()=>{throw new Error('External network disabled for the scoped UI release tests.');};
globalThis.fetch=deny;
http.request=deny;http.get=deny;https.request=deny;https.get=deny;
syncBuiltinESMExports();
