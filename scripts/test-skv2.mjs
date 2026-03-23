import { config } from 'dotenv'
config({ path: '.env.local' })

const res = await fetch('https://www.skatteverket.se/rattsinformation/stallningstaganden/2024/stallningstaganden2024.4.1a098b6a1842dc49b885910.html', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html',
    'Accept-Language': 'sv-SE',
  }
})
console.log('Status:', res.status)
const text = await res.text()
console.log('Längd:', text.length)
console.log(text.slice(0, 500))