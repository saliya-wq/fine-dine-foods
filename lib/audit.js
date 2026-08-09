// Append-only record of who did what to an order.
//
// Every write is best-effort and swallows its own errors: an audit failure
// must never fail the operation it is describing, and a half-written trail is
// better than a refused status change during service.

/** The customer themselves, for the initial `placed` event. */
export const customerActor = (name) => ({ id: 'customer', role: 'customer', name: name || 'Customer' })

export async function logOrderEvent(supabase, { orderId, actor, event, fromStatus, toStatus, detail }) {
  try {
    await supabase.from('order_events').insert({
      order_id: orderId,
      actor_id: actor?.id || null,
      actor_name: actor?.name || null,
      actor_role: actor?.role || null,
      event,
      from_status: fromStatus || null,
      to_status: toStatus || null,
      detail: detail || null
    })
  } catch (err) {
    console.warn('audit write failed:', orderId, event, err?.message)
  }
}
