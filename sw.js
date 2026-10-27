// Service worker do app Gastos.
// - Guarda a interface no aparelho (abre rápido e sem internet).
// - Recebe arquivos do "Compartilhar" do Android.
// Os dados nunca passam por aqui: as chamadas ao servidor (script.google.com) vão direto pela rede.

const VERSAO = 'gastos-56827c1ae9'; // trocado automaticamente pelo tools/build-pwa.mjs
const ARQUIVOS = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO && n !== 'compartilhado').map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method === 'POST' && url.pathname.endsWith('/compartilhar')) {
    e.respondWith(
      (async () => {
        const form = await e.request.formData();
        const arquivo = form.get('arquivo');
        if (arquivo && arquivo.size) {
          const cache = await caches.open('compartilhado');
          await cache.put(
            new URL('arquivo-compartilhado', self.registration.scope).href,
            new Response(arquivo, {
              headers: { 'Content-Type': arquivo.type || 'application/octet-stream', 'X-Nome': encodeURIComponent(arquivo.name || 'arquivo') },
            })
          );
        }
        return Response.redirect(new URL('./?compartilhado=1', self.registration.scope).href, 303);
      })()
    );
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Interface: responde do cache na hora e atualiza em segundo plano (vale na próxima abertura).
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const pagina = e.request.mode === 'navigate';
      const chave = pagina ? 'index.html' : e.request;
      const guardado = await cache.match(chave);
      const daRede = fetch(e.request)
        .then((r) => {
          if (r.ok) cache.put(chave, r.clone());
          return r;
        })
        .catch(() => guardado);
      return guardado || daRede;
    })
  );
});
