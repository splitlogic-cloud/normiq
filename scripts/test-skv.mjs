import { config } from 'dotenv'
config({ path: '.env.local' })

const html = await fetch('https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/331518.html').then(r => r.text())
console.log('Längd:', html.length)
console.log(html.slice(0, 800))
