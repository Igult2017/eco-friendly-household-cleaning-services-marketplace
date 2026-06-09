import { relations } from "drizzle-orm"
import { users } from "./users"
import { providers } from "./providers"
import { serviceCategories, providerServices, providerAvailability, providerBlackoutDates } from "./services"
import { bookings } from "./bookings"
import { jobPosts } from "./jobs"
import { bids } from "./bids"
import { payments, payouts } from "./payments"
import { reviews } from "./reviews"
import { disputes, disputeMessages } from "./disputes"
import { notifications } from "./notifications"
import { ecoCertifications, providerIdentityVerifications } from "./eco"
import { blogPosts, blogComments } from "./blog"

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings, { relationName: "customerBookings" }),
  notifications: many(notifications),
  reviews: many(reviews, { relationName: "customerReviews" }),
  jobPosts: many(jobPosts),
}))

export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, { fields: [providers.userId], references: [users.id] }),
  services: many(providerServices),
  availability: many(providerAvailability),
  blackoutDates: many(providerBlackoutDates),
  bookings: many(bookings, { relationName: "providerBookings" }),
  bids: many(bids),
  reviews: many(reviews, { relationName: "providerReviews" }),
  payouts: many(payouts),
  ecoCertifications: many(ecoCertifications),
  identityVerification: many(providerIdentityVerifications),
}))

export const providerServicesRelations = relations(providerServices, ({ one }) => ({
  provider: one(providers, { fields: [providerServices.providerId], references: [providers.id] }),
  category: one(serviceCategories, { fields: [providerServices.categoryId], references: [serviceCategories.id] }),
}))

export const providerAvailabilityRelations = relations(providerAvailability, ({ one }) => ({
  provider: one(providers, { fields: [providerAvailability.providerId], references: [providers.id] }),
}))

export const bookingsRelations = relations(bookings, ({ one }) => ({
  customer: one(users, { fields: [bookings.customerId], references: [users.id], relationName: "customerBookings" }),
  provider: one(providers, { fields: [bookings.providerId], references: [providers.id], relationName: "providerBookings" }),
  service: one(providerServices, { fields: [bookings.serviceId], references: [providerServices.id] }),
  payment: one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
  review: one(reviews, { fields: [bookings.id], references: [reviews.bookingId] }),
  dispute: one(disputes, { fields: [bookings.id], references: [disputes.bookingId] }),
}))

export const jobPostsRelations = relations(jobPosts, ({ one, many }) => ({
  customer: one(users, { fields: [jobPosts.customerId], references: [users.id] }),
  category: one(serviceCategories, { fields: [jobPosts.categoryId], references: [serviceCategories.id] }),
  bids: many(bids),
}))

export const bidsRelations = relations(bids, ({ one }) => ({
  jobPost: one(jobPosts, { fields: [bids.jobPostId], references: [jobPosts.id] }),
  provider: one(providers, { fields: [bids.providerId], references: [providers.id] }),
  booking: one(bookings, { fields: [bids.bookingId], references: [bookings.id] }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
  customer: one(users, { fields: [payments.customerId], references: [users.id] }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
  customer: one(users, { fields: [reviews.customerId], references: [users.id], relationName: "customerReviews" }),
  provider: one(providers, { fields: [reviews.providerId], references: [providers.id], relationName: "providerReviews" }),
}))

export const disputesRelations = relations(disputes, ({ one, many }) => ({
  booking: one(bookings, { fields: [disputes.bookingId], references: [bookings.id] }),
  opener: one(users, { fields: [disputes.openedBy], references: [users.id] }),
  messages: many(disputeMessages),
}))

export const disputeMessagesRelations = relations(disputeMessages, ({ one }) => ({
  dispute: one(disputes, { fields: [disputeMessages.disputeId], references: [disputes.id] }),
  sender: one(users, { fields: [disputeMessages.senderId], references: [users.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))

export const ecoCertificationsRelations = relations(ecoCertifications, ({ one }) => ({
  provider: one(providers, { fields: [ecoCertifications.providerId], references: [providers.id] }),
}))

export const providerIdentityVerificationsRelations = relations(providerIdentityVerifications, ({ one }) => ({
  provider: one(providers, { fields: [providerIdentityVerifications.providerId], references: [providers.id] }),
}))

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  author: one(users, { fields: [blogPosts.authorId], references: [users.id] }),
  comments: many(blogComments),
}))

export const blogCommentsRelations = relations(blogComments, ({ one }) => ({
  post: one(blogPosts, { fields: [blogComments.postId], references: [blogPosts.id] }),
  user: one(users, { fields: [blogComments.userId], references: [users.id] }),
}))
