export type Category = {
  id: number
  name: string
  slug?: string
}

export type Product = {
  id: number
  name: string
  price: number | string
  description?: string
  image_url?: string
  category_id?: number
  active?: boolean
}

export type BusinessHoursDay = {
  closed: boolean
  open: string // HH:MM ("00:00" a "23:59"); 00:00~00:00 = 24h
  close: string
}

export type BusinessHours = {
  monday: BusinessHoursDay
  tuesday: BusinessHoursDay
  wednesday: BusinessHoursDay
  thursday: BusinessHoursDay
  friday: BusinessHoursDay
  saturday: BusinessHoursDay
  sunday: BusinessHoursDay
}

export type PauseState = {
  paused: boolean
  message: string
}