// 중개사 슈퍼앱 화면이 열려 있으면 모아 둔 매물을 자동으로 넘겨준다
(function () {
  if (!document.querySelector('meta[name="realtor-super-app"]')) return;
  async function send() {
    const { pending, collection } = await chrome.storage.local.get(['pending', 'collection']);
    if (pending && collection) window.postMessage({ type: 'rsa-collection', file: collection }, location.origin);
  }
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.type === 'rsa-collection-ack') chrome.storage.local.set({ pending: false });
  });
  chrome.storage.onChanged.addListener((c) => { if (c.pending || c.collection) send(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) send(); });
  send();
})();
