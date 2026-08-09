// Order status pipelines per channel + display labels.
// Shared by the customer tracking page, the (upcoming) manager console, and the API.

export const PIPELINES = {
  delivery: ['placed', 'received', 'processing', 'ready_for_delivery', 'out_for_delivery', 'delivered'],
  pickup: ['placed', 'received', 'processing', 'ready_for_collection'],
  table: ['placed', 'received', 'processing', 'ready', 'served']
}

export const STATUS_LABELS = {
  placed: 'Order Placed',
  received: 'Order Received',
  processing: 'Processing',
  ready_for_delivery: 'Ready for Delivery',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  ready_for_collection: 'Ready for Collection',
  ready: 'Ready',
  served: 'Served'
}

export const pipelineFor = (mode) => PIPELINES[mode] || PIPELINES.pickup
export const statusLabel = (s) => STATUS_LABELS[s] || s
export const statusIndex = (mode, status) => pipelineFor(mode).indexOf(status)
