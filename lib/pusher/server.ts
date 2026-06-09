import Pusher from "pusher"

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID ?? "0",
  key: process.env.PUSHER_KEY ?? "placeholder",
  secret: process.env.PUSHER_SECRET ?? "placeholder",
  cluster: process.env.PUSHER_CLUSTER ?? "eu",
  useTLS: true,
})

/** Notify a specific provider of a new job request or booking */
export async function notifyProvider(providerId: string, event: string, data: unknown) {
  return pusherServer.trigger(`private-provider-${providerId}`, event, data)
}

/** Notify a specific customer of a booking status change */
export async function notifyCustomer(customerId: string, event: string, data: unknown) {
  return pusherServer.trigger(`private-customer-${customerId}`, event, data)
}

/** Notify admin dashboard */
export async function notifyAdmin(event: string, data: unknown) {
  return pusherServer.trigger("private-admin", event, data)
}
