import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const getUserId = async (customerId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    return data?.id || null
  }

  const setSubscriptionStatus = async (userId: string, status: string, data?: {
    stripe_subscription_id?: string
    subscription_period?: string
    subscription_current_period_end?: string | null
  }) => {
    await supabase.from('profiles').update({
      subscription_status: status,
      ...data,
    }).eq('id', userId)
  }

  switch (event.type) {

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = await getUserId(sub.customer as string)
      if (!userId) break

      const status = sub.status === 'trialing' ? 'trialing'
        : sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
        : sub.status === 'canceled' ? 'canceled'
        : sub.status

      const item = sub.items.data[0]
      const period = item?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      const periodEnd = sub.items.data[0]?.current_period_end ? new Date(sub.items.data[0].current_period_end * 1000).toISOString() : null

      await setSubscriptionStatus(userId, status, {
        stripe_subscription_id: sub.id,
        subscription_period: period,
        subscription_current_period_end: periodEnd,
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = await getUserId(sub.customer as string)
      if (!userId) break
      await setSubscriptionStatus(userId, 'canceled')
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserId(invoice.customer as string)
      if (!userId) break
      await setSubscriptionStatus(userId, 'past_due')
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserId(invoice.customer as string)
      if (!userId) break
      await setSubscriptionStatus(userId, 'active')
      break
    }
  }

  return NextResponse.json({ received: true })
}