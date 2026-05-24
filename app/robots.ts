import { MetadataRoute } from 'next'

const BASE_URL = 'https://account-2.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Block all crawlers from authenticated pages
        userAgent: '*',
        allow: ['/', '/login'],
        disallow: [
          '/dashboard',
          '/dashboard/',
          '/dashboard/*',
          '/api/',
          '/api/*',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
