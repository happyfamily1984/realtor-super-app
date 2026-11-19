// extension/ 폴더를 public/collector-extension.zip 으로 묶는다 (앱에서 내려받기용)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'

const zip = new JSZip()
for (const f of readdirSync('extension')) zip.file(`realtor-collector/${f}`, readFileSync(`extension/${f}`))
writeFileSync('public/collector-extension.zip', await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
