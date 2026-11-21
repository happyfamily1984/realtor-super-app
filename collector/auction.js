// 법원경매정보(courtauction.go.kr) 물건 검색·상세. 한국 안에서만 열리는 사이트라 깃허브 Actions에서 돎.
const BASE = 'https://www.courtauction.go.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const dash = (s) => (/^\d{8}$/.test(s || '') ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : '');
const hm = (s) => (/^\d{4}$/.test(s || '') ? `${s.slice(0, 2)}:${s.slice(2)}` : '');
const clean = (s) => String(s ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<br\s*\/?>/g, ' ').replace(/[ \t]+/g, ' ').trim();

async function post(path, body, fetchFn) {
  for (let tries = 0; ; tries++) {
    try {
      const res = await fetchFn(`${BASE}${path}`, {
        method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(40000),
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json', Referer: `${BASE}/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml`, Origin: BASE, 'SC-Userid': 'NONUSER' },
      });
      const j = JSON.parse(await res.text());
      if (res.status !== 200 || !j.data) throw new Error(j.errors?.errorMessage || j.message || `HTTP ${res.status}`);
      return j.data;
    } catch (e) {
      if (tries >= 2) throw new Error(`법원경매 요청 실패 (${path}): ${e.message}`);
      await sleep(2500 * (tries + 1));
    }
  }
}

/** 한 법원의 진행 중 부동산 물건 전부 (매각기일이 오늘~days일 뒤) */
export async function searchCourt(courtCode, { days = 120, now = new Date(), fetchFn = fetch, pause = 1200 } = {}) {
  const k = new Date(now.getTime() + 9 * 3600e3);
  const all = [];
  for (let page = 1; page <= 60; page++) {
    const data = await post('/pgj/pgjsearch/searchControllerMain.on', {
      dma_pageInfo: { pageNo: page, pageSize: 40, bfPageNo: '', startRowNo: '', totalCnt: '', totalYn: 'Y', groupTotalCount: '' },
      dma_srchGdsDtlSrchInfo: {
        rletDspslSpcCondCd: '', bidDvsCd: '000331', mvprpRletDvsCd: '00031R', cortAuctnSrchCondCd: '0004601',
        rprsAdongSdCd: '', rprsAdongSggCd: '', rprsAdongEmdCd: '', rdnmSdCd: '', rdnmSggCd: '', rdnmNo: '',
        mvprpDspslPlcAdongSdCd: '', mvprpDspslPlcAdongSggCd: '', mvprpDspslPlcAdongEmdCd: '', rdDspslPlcAdongSdCd: '', rdDspslPlcAdongSggCd: '', rdDspslPlcAdongEmdCd: '',
        cortOfcCd: courtCode, jdbnCd: '', execrOfcDvsCd: '', lclDspslGdsLstUsgCd: '', mclDspslGdsLstUsgCd: '', sclDspslGdsLstUsgCd: '', cortAuctnMbrsId: '',
        aeeEvlAmtMin: '', aeeEvlAmtMax: '', lwsDspslPrcRateMin: '', lwsDspslPrcRateMax: '', flbdNcntMin: '', flbdNcntMax: '', objctArDtsMin: '', objctArDtsMax: '',
        mvprpArtclKndCd: '', mvprpArtclNm: '', mvprpAtchmPlcTypCd: '', notifyLoc: 'off', lafjOrderBy: '', pgmId: 'PGJ151F01', csNo: '', cortStDvs: '1', statNum: 1,
        bidBgngYmd: ymd(k), bidEndYmd: ymd(new Date(k.getTime() + days * 86400e3)), dspslDxdyYmd: '', fstDspslHh: '', scndDspslHh: '', thrdDspslHh: '', fothDspslHh: '',
        dspslPlcNm: '', lwsDspslPrcMin: '', lwsDspslPrcMax: '', grbxTypCd: '', gdsVendNm: '', fuelKndCd: '', carMdyrMax: '', carMdyrMin: '', carMdlNm: '', sideDvsCd: '',
      },
    }, fetchFn);
    const list = data.dlt_srchResult ?? [];
    all.push(...list);
    if (list.length < 40) break;
    await sleep(pause);
  }
  return all;
}

const norm = (s) => String(s ?? '').replace(/[\s()·\-]/g, '');

/** 이 물건이 어느 메인 단지인지 (법정동+지번, 아니면 이름 낱말) */
export function matchComplex(raw, complexes) {
  const text = norm(`${raw.buldNm} ${raw.printSt} ${raw.rdAddrSub}`);
  return complexes.find((c) =>
    (c.umdNm && raw.hjguDong === c.umdNm && [c.jibun, ...(c.jibunAlt ?? [])].filter(Boolean).includes(String(raw.daepyoLotno).trim())) ||
    (c.words ?? []).some((ws) => ws.every((w) => text.includes(norm(w))))) ?? null;
}

/** 검색 결과 한 줄 → 앱·보고서에서 쓰는 꼴 (금액은 원) */
export function normalizeItem(raw) {
  const area = Number(String(raw.areaList || raw.pjbBuldList || '').match(/([\d.]+)\s*㎡/)?.[1]) || null;
  return {
    id: `${raw.boCd}-${raw.saNo}-${raw.maemulSer}`,
    courtCode: raw.boCd, saNo: raw.saNo, seq: Number(raw.maemulSer) || 1,
    caseNo: raw.srnSaNo, court: raw.jiwonNm, dept: raw.jpDeptNm, tel: clean(raw.tel),
    usage: raw.dspslUsgNm, address: clean(raw.printSt), building: raw.buldNm ?? '', unit: clean(raw.buldList), area,
    appraisal: Number(raw.gamevalAmt) || 0, minPrice: Number(raw.minmaePrice) || 0,
    minRate: Number(raw.gamevalAmt) ? Math.round((Number(raw.minmaePrice) / Number(raw.gamevalAmt)) * 100) : 0,
    failCount: Number(raw.yuchalCnt) || 0, saleDate: dash(raw.maeGiil), saleTime: hm(raw.maeHh1), place: raw.maePlace ?? '',
    decisionDate: dash(raw.maegyuljGiil), remark: clean(raw.mulBigo),
  };
}

const DXDY_KIND = { '01': '매각기일', '02': '매각결정기일', '03': '대금지급기한', '04': '대금지급 및 배당기일', '05': '배당기일' };
const DXDY_RESULT = { '001': '매각', '002': '유찰', '003': '변경', '004': '취소', '005': '추후지정' };

/** 물건 상세: 사건 정보, 인수 권리, 기일 내역, 감정평가 요점 (사진은 받지 않음) */
export async function fetchDetail(item, { fetchFn = fetch } = {}) {
  const data = await post('/pgj/pgj15B/selectAuctnCsSrchRslt.on', { dma_srchGdsDtlSrch: { csNo: item.saNo, cortOfcCd: item.courtCode, dspslGdsSeq: String(item.seq), pgmId: 'PGJ15BA00', srchInfo: {} } }, fetchFn);
  return parseDetail(data.dma_result ?? {});
}

export function parseDetail(r) {
  const b = r.csBaseInfo ?? {}, g = r.dspslGdsDxdyInfo ?? {};
  return {
    caseName: b.csNm ?? '', receivedDate: dash(b.csRcptYmd), startDate: dash(b.csCmdcYmd), claim: Number(b.clmAmt) || 0,
    demandDeadline: dash(r.dstrtDemnInfo?.[0]?.dstrtDemnLstprdYmd),
    rights: clean(g.ndstrcRghCtt), surface: clean(g.sprfcExstcDts), topPriority: clean(g.tprtyRnkHypthcStngDts),
    specRemark: clean([g.gdsSpcfcRmk, g.dspslGdsRmk].filter(Boolean).join(' / ')),
    schedule: (r.gdsDspslDxdyLst ?? []).map((d) => ({
      date: dash(d.dxdyYmd), time: hm(d.dxdyHm), kind: DXDY_KIND[d.auctnDxdyKndCd] ?? '기일', place: d.dxdyPlcNm ?? '',
      result: DXDY_RESULT[d.auctnDxdyRsltCd] ?? '', minPrice: Number(d.tsLwsDspslPrc) || 0, soldPrice: Number(d.dspslAmt) || 0,
    })),
    landShare: (r.rgltLandLstAll ?? []).flat().map((l) => `${clean(l.landLdcgDts)} ${clean(l.landArDts)} 중 ${l.rgltRateNmrtVal}`).join(', '),
    appraisalNotes: (r.aeeWevlMnpntLst ?? []).map((a) => clean(a.aeeWevlMnpntCtt)).filter(Boolean).slice(0, 8),
  };
}
