// Web Worker: hospeda o wasm, o interpretador e o grafo reativo.
// Protocolo (main → worker):
//   {type:'init', wasmUrl}
//   {type:'update', changes:[{id, src, widgets?}], skip?:[id]}
//   {type:'widget', id, index, value}
// (worker → main):
//   {type:'ready', version, docs} | {type:'start', id} | {type:'result', ...}
//   {type:'done'} | {type:'fatal', message}

import { loadFlint } from '../runtime/flint.js';
import { setFlint } from '../runtime/rings.js';
import { Notebook } from './notebook.js';
import { DOCS } from '../lang/builtins.js';

let nb = null;

const post = (msg) => self.postMessage(msg);

async function init(wasmUrl) {
  // No bundle, o glue do Emscripten define createCauchy no escopo do módulo.
  // eslint-disable-next-line no-undef
  const factory = createCauchy;
  const F = await loadFlint(factory, { locateFile: () => wasmUrl });
  setFlint(F);
  nb = new Notebook({
    onStart: (id) => post({ type: 'start', id }),
    onResult: (r) => post({ type: 'result', ...r }),
  });
  post({ type: 'ready', version: F.version(), docs: [...DOCS], sigs: F.signatures() });
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init':
        await init(msg.wasmUrl);
        return;
      case 'update':
        nb.update(msg.changes, { skip: msg.skip ?? [] });
        break;
      case 'widget':
        nb.setWidget(msg.id, msg.index, msg.value);
        break;
    }
    post({ type: 'done', live: nb.liveCount() });
  } catch (e) {
    post({ type: 'fatal', message: String(e?.stack ?? e) });
  }
};
