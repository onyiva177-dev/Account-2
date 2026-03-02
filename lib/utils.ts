import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency: string = 'KES',
  locale: string = 'en-KE'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-KE').format(num)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    paid: 'text-success-600 bg-green-50',
    posted: 'text-success-600 bg-green-50',
    active: 'text-success-600 bg-green-50',
    draft: 'text-gray-600 bg-gray-100',
    pending: 'text-warning-600 bg-amber-50',
    overdue: 'text-danger-600 bg-red-50',
    partial: 'text-brand-600 bg-blue-50',
    voided: 'text-gray-400 bg-gray-50',
    cancelled: 'text-gray-400 bg-gray-50',
  }
  return map[status] ?? 'text-gray-600 bg-gray-100'
}

export const CURRENCIES = [
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'ZAR', name: 'South African Rand' },
]

export const SECTORS = [
  { value: 'business', label: 'Business / SME', icon: '🏢' },
  { value: 'education', label: 'Educational Institution', icon: '🎓' },
  { value: 'healthcare', label: 'Healthcare / Hospital', icon: '🏥' },
  { value: 'retail', label: 'Retail / POS', icon: '🛍️' },
  { value: 'ngo', label: 'NGO / Nonprofit', icon: '🤝' },
  { value: 'government', label: 'Government Entity', icon: '🏛️' },
]
