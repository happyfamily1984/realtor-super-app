// 지역 부동산 뉴스 (구글 뉴스 RSS, 제목·언론사·링크만 사용)
// GET /api/news?q=마포구 아현동 부동산
import { handler, HttpError, q, xmlItems, xmlTag } from './_lib.js'

export function parseNews(xml: string) {
  return xmlItems(xml)
    .map((it, i) => {
      const source = xmlTag(it, 'source')
      let title = xmlTag(it, 'title')
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3)
      const t = new Date(xmlTag(it, 'pubDate'))
      const kst = isNaN(+t) ? new Date() : new Date(+t + 9 * 3600_000)
      return { id: `n${i}`, title, source, date: kst.toISOString().slice(0, 10), summary: '', link: xmlTag(it, 'link'), ts: +t || 0 }
    })
    .filter((n) => n.title)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ ts, ...n }) => n)
}

export default handler(async (req) => {
  const query = q(req, 'q').trim()
  if (!query) throw new HttpError(400, '검색어가 없습니다')
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:7d')}&hl=ko&gl=KR&ceid=KR:ko`)
  if (!r.ok) throw new HttpError(502, `뉴스 조회 실패 (${r.status})`)
  return { news: parseNews(await r.text()) }
}, 900)
