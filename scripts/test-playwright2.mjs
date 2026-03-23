import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()
// Besök startsidan först för att få session-cookie
await page.goto('https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/')
await page.waitForLoadState('networkidle')
await page.waitForTimeout(2000)
// Försök sedan avsnittssidan
await page.goto('https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/331518.html')
await page.waitForLoadState('networkidle')
const title = await page.title()
const text = await page.innerText('body')
console.log('Titel:', title)
console.log('Text:', text.slice(0, 300))
await browser.close()
