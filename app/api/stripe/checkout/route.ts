import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRICES = {
  monthly: 'price_1TLqgURbfuG8fe14BthQE2MU',
  yearly:  'price_1TLqgQRbfuG8fe14aNy12PHO',
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })

  const { plan } = await req.json() // 'monthly' | 'yearly'
  const priceId = PRICES[plan as keyof typeof PRICES]
  if (!priceId) return NextResponse.json({ error: 'Ogiltigt plan' }, { status: 400 })

  // Hämta användarprofil
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id, name')
    .eq('id', userId)
    .single()

  if (!profile?.email) return NextResponse.json({ error: 'Profil saknas' }, { status: 400 })

  // Hämta eller skapa Stripe-kund
  let customerId = profile.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.name || undefined,
      metadata: { supabase_user_id: userId },
    })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://normiq.se'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_user_id: userId },
    },
    success_url: `${appUrl}/app?checkout=success`,
    cancel_url:  `${appUrl}/priser?checkout=cancelled`,
    allow_promotion_codes: true,
    locale: 'sv',
  })

  return NextResponse.json({ url: session.url })
}