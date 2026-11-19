// 네이버 부동산 창을 찾아(없으면 열어) 수집 작업을 시작시킨다
const NAVER = chrome.runtime.getManifest().host_permissions;

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m.cmd === 'start') start(m).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e) }));
  if (m.cmd === 'snapshot') toNaver({ cmd: 'snapshot' }).then((ok) => reply({ ok }));
  return true;
});

async function findTab() {
  const tabs = await chrome.tabs.query({ url: NAVER });
  return tabs.find((t) => t.active) || tabs[0];
}

async function toNaver(msg) {
  const tab = await findTab();
  if (!tab) return false;
  try { await chrome.tabs.sendMessage(tab.id, msg); return true; } catch (e) { return false; }
}

async function start(m) {
  const task = { id: Date.now(), state: 'locate', gu: m.gu, dong: m.dong, type: m.type };
  await chrome.storage.local.set({ task, status: { text: '네이버 부동산 창을 찾는 중…', busy: true } });
  const tab = await findTab();
  if (!tab) {
    // 창이 없으면 새로 연다. 화면이 뜨면 content.js 가 작업을 이어받는다.
    await chrome.tabs.create({ url: NAVER[0].replace('*', 'complexes') });
    return;
  }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  try { await chrome.tabs.sendMessage(tab.id, { cmd: 'run' }); } catch (e) { await chrome.tabs.reload(tab.id); }
}
