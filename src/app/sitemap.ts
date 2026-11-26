import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-meta';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/signup', '/help'].map((path) => ({ url: `${SITE_URL}${path}` }));
}
