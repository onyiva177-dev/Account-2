import { MetadataRoute } from 'next'

const base = 'https://account-2.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${base}/`,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${base}/login`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/dashboard`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${base}/dashboard/accounting`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/dashboard/transactions`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/dashboard/contacts`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/inventory`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/pos`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/payroll`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/tax`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/banking`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/analytics`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/budgeting`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${base}/dashboard/reports`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/dashboard/settings`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
