// 확장 프로그램 ↔ 네이버 화면(page.js) 사이의 연결. 작업 상태를 저장해 화면 이동 뒤에도 이어서 한다.
(function () {
  const toPage = (m) => window.postMessage(Object.assign({ __rsa: 'to-page' }, m), location.origin);
  const save = (o) => chrome.storage.local.set(o);

  async function run() {
    const { task } = await chrome.storage.local.get('task');
    if (!task || task.state === 'done' || task.state === 'error') return;
    if (Date.now() - task.id > 15 * 60 * 1000) return; // 오래된 작업은 버린다
    toPage({ cmd: task.state, task });
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.__rsa !== 'to-ext') return;
    const d = e.data;
    const { task } = await chrome.storage.local.get('task');
    if (d.type === 'status') save({ status: { text: d.text, busy: true } });
    if (d.type === 'located' && task) {
      const next = Object.assign({}, task, { state: 'collect', region: d.region });
      await save({ task: next, status: { text: d.region.name + ' 화면으로 이동합니다…', busy: true } });
      if (d.url && d.url !== location.href) location.assign(d.url); // 이동 후 load 에서 run() 이 이어받는다
      else toPage({ cmd: 'collect', task: next });
    }
    if (d.type === 'done') {
      await save({ collection: d.file, pending: true, status: { text: d.text, busy: false, done: true } });
      if (task) save({ task: Object.assign({}, task, { state: 'done' }) });
    }
    if (d.type === 'error') {
      await save({ status: { text: d.text, busy: false, error: true } });
      if (task) save({ task: Object.assign({}, task, { state: 'error' }) });
    }
  });

  chrome.runtime.onMessage.addListener((m) => {
    if (m.cmd === 'run') run();
    if (m.cmd === 'snapshot') toPage({ cmd: 'snapshot' });
  });
  window.addEventListener('load', () => setTimeout(run, 2500));
})();
