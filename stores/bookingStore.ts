"use client"

import { create } from "zustand"
import type { Address } from "@/types"

interface BookingDraft {
  categoryId: string | null
  categoryName: string | null
  address: Address | null
  latitude: number | null
  longitude: number | null
  selectedProviderId: string | null
  scheduledAt: Date | null
  durationMinutes: number
  specialInstructions: string
  ecoOptions: string[]
  step: 1 | 2 | 3 | 4 | 5
}

interface BookingStore extends BookingDraft {
  setCategory: (id: string, name: string) => void
  setAddress: (address: Address, lat: number, lng: number) => void
  setProvider: (providerId: string) => void
  setSchedule: (date: Date, durationMinutes: number) => void
  setExtras: (instructions: string, ecoOptions: string[]) => void
  setStep: (step: BookingDraft["step"]) => void
  reset: () => void
}

const initialState: BookingDraft = {
  categoryId: null,
  categoryName: null,
  address: null,
  latitude: null,
  longitude: null,
  selectedProviderId: null,
  scheduledAt: null,
  durationMinutes: 120,
  specialInstructions: "",
  ecoOptions: [],
  step: 1,
}

export const useBookingStore = create<BookingStore>((set) => ({
  ...initialState,
  setCategory: (id, name) => set({ categoryId: id, categoryName: name, step: 2 }),
  setAddress: (address, latitude, longitude) => set({ address, latitude, longitude }),
  setProvider: (selectedProviderId) => set({ selectedProviderId, step: 3 }),
  setSchedule: (scheduledAt, durationMinutes) => set({ scheduledAt, durationMinutes, step: 4 }),
  setExtras: (specialInstructions, ecoOptions) => set({ specialInstructions, ecoOptions, step: 5 }),
  setStep: (step) => set({ step }),
  reset: () => set(initialState),
}))
