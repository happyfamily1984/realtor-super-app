const $ = (id) => document.getElementById(id);

async function show() {
  const { status, collection } = await chrome.storage.local.get(['status', 'collection']);
  $('status').textContent = (status && status.text) || '대기 중';
  $('status').className = status && status.error ? 'error' : '';
  $('go').disabled = !!(status && status.busy);
  $('save').disabled = !collection;
}

chrome.storage.local.get(['form']).then(({ form }) => {
  if (form) { $('gu').value = form.gu || ''; $('dong').value = form.dong || ''; $('type').value = form.type || 'apt'; }
});
chrome.storage.onChanged.addListener(show);
show();

$('go').onclick = async () => {
  const form = { gu: $('gu').value.trim(), dong: $('dong').value.trim(), type: $('type').value };
  if (!/^\d{5}$/.test(form.gu)) return void ($('status').textContent = '시군구 코드 5자리를 입력해 주세요. (앱의 홈 > 설정에서 확인)');
  if (!form.dong) return void ($('status').textContent = '동 이름을 입력해 주세요.');
  await chrome.storage.local.set({ form });
  chrome.runtime.sendMessage(Object.assign({ cmd: 'start' }, form));
};

$('snap').onclick = () => chrome.runtime.sendMessage({ cmd: 'snapshot' }, (r) => {
  if (!r || !r.ok) $('status').textContent = '열려 있는 네이버 부동산 창이 없습니다.';
});

$('save').onclick = async () => {
  const { collection } = await chrome.storage.local.get('collection');
  if (!collection) return;
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(collection)], { type: 'application/json' }));
  a.download = `naver_매물_${collection.regionName || ''}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
  a.click();
};
