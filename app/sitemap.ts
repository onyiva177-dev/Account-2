import { MetadataRoute } from 'next'

const BASE_URL = 'https://account-2.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Only public pages — dashboard pages require auth so
    // Google cannot index them and they waste crawl budget
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1.0,
    },
  ]
}
