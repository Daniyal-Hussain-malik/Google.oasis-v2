import { resolveRouteSeo, SITE_NAME, type RouteSeoMeta } from '@/src/lib/seoData';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function applyDocumentSeo(pathname: string, override?: Partial<RouteSeoMeta>) {
  const base = resolveRouteSeo(pathname);
  const seo: RouteSeoMeta = {
    ...base,
    ...(override?.title ? { title: override.title } : {}),
    ...(override?.description ? { description: override.description } : {}),
    ...(override?.image ? { image: override.image } : {}),
    ...(override?.imageAlt ? { imageAlt: override.imageAlt } : {}),
    ...(override?.type ? { type: override.type } : {}),
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const canonicalUrl = `${origin}${cleanPath}`;
  const imageUrl = seo.image.startsWith('http') ? seo.image : `${origin}${seo.image}`;

  document.title = seo.title;
  upsertCanonical(canonicalUrl);
  upsertMeta('name', 'description', seo.description);

  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:type', seo.type || 'website');
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:title', seo.title);
  upsertMeta('property', 'og:description', seo.description);
  upsertMeta('property', 'og:image', imageUrl);
  upsertMeta('property', 'og:image:alt', seo.imageAlt);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', seo.title);
  upsertMeta('name', 'twitter:description', seo.description);
  upsertMeta('name', 'twitter:image', imageUrl);
  upsertMeta('name', 'twitter:image:alt', seo.imageAlt);
}
