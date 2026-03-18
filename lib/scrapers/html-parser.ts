import * as cheerio from 'cheerio';

export interface ParsedContent {
  title: string;
  description: string;
  markdown: string;
  html: string;
  links: string[];
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    canonicalUrl?: string;
    language?: string;
    statusCode?: number;
  };
  rawHtml: string;
}

export interface ContentSelector {
  selectors: string[];
  excludeSelectors?: string[];
}

const DEFAULT_MAIN_CONTENT_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '.content',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.page-content',
  '#content',
  '#main-content',
];

const DEFAULT_EXCLUDE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'header:not(article header)',
  'footer:not(article footer)',
  'aside',
  '.sidebar',
  '.advertisement',
  '.ad',
  '.ads',
  '.social-share',
  '.comments',
  '.related-posts',
  '.newsletter',
  '.popup',
  '.modal',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="complementary"]',
  '[aria-hidden="true"]',
];

function sanitizeText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetadata($: cheerio.CheerioAPI): Record<string, any> {
  const metadata: Record<string, any> = {};

  const getMetaContent = (name: string): string | undefined => {
    return (
      $(`meta[name="${name}"]`).attr('content') ||
      $(`meta[property="${name}"]`).attr('content') ||
      undefined
    );
  };

  const getOgContent = (property: string): string | undefined => {
    return $(`meta[property="og:${property}"]`).attr('content');
  };

  const getTwitterContent = (name: string): string | undefined => {
    return $(`meta[name="twitter:${name}"]`).attr('content');
  };

  metadata.title = getMetaContent('title') || $('title').text().trim();
  metadata.description = getMetaContent('description');
  metadata.author = getMetaContent('author');
  metadata.keywords = getMetaContent('keywords');

  metadata.ogTitle = getOgContent('title');
  metadata.ogDescription = getOgContent('description');
  metadata.ogImage = getOgContent('image');
  metadata.ogType = getOgContent('type');
  metadata.ogUrl = getOgContent('url');

  metadata.twitterCard = getTwitterContent('card');
  metadata.twitterTitle = getTwitterContent('title');
  metadata.twitterDescription = getTwitterContent('description');
  metadata.twitterImage = getTwitterContent('image');

  metadata.canonicalUrl = $('link[rel="canonical"]').attr('href');
  metadata.language = $('html').attr('lang') || $('meta[charset]').attr('charset');

  return metadata;
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: Set<string> = new Set();

  try {
    const urlObj = new URL(baseUrl);
    const baseHost = urlObj.hostname;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        if (href.startsWith('http')) {
          links.add(href);
        } else if (href.startsWith('/')) {
          links.add(`${urlObj.protocol}//${baseHost}${href}`);
        }
      } catch {
        // Ignore invalid URLs
      }
    });
  } catch {
    // Ignore URL parsing errors
  }

  return Array.from(links).slice(0, 100);
}

function extractMainContent(
  $: cheerio.CheerioAPI,
  onlyMainContent: boolean = true
): { html: string; text: string } {
  if (!onlyMainContent) {
    const html = $('body').html() || '';
    const text = $('body').text() || '';
    return { html, text };
  }

  for (const selector of DEFAULT_MAIN_CONTENT_SELECTORS) {
    const mainContent = $(selector).first();
    if (mainContent.length > 0) {
      const html = mainContent.html() || '';
      const text = mainContent.text() || '';
      return { html, text };
    }
  }

  const body = $('body').clone();

  for (const selector of DEFAULT_EXCLUDE_SELECTORS) {
    body.find(selector).remove();
  }

  const html = body.html() || '';
  const text = body.text() || '';

  return { html, text };
}

function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);

  let markdown = '';

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName[1]);
    const text = $(el).text().trim();
    markdown += `${'#'.repeat(level)} ${text}\n\n`;
  });

  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) markdown += `${text}\n\n`;
  });

  $('ul, ol').each((_, el) => {
    const $list = $(el);
    const tag = el.tagName.toLowerCase();

    $list.find('li').each((_, li) => {
      const text = $(li).text().trim();
      const prefix = tag === 'ol' ? '1.' : '-';
      markdown += `${prefix} ${text}\n`;
    });

    markdown += '\n';
  });

  $('blockquote').each((_, el) => {
    const text = $(el).text().trim();
    markdown += `> ${text}\n\n`;
  });

  $('pre code').each((_, el) => {
    const text = $(el).text().trim();
    markdown += '```\n' + text + '\n```\n\n';
  });

  $('table').each((_, el) => {
    const $table = $(el);

    $table.find('tr').each((rowIndex, tr) => {
      const cells: string[] = [];
      $(tr).find('th, td').each((_, cell) => {
        cells.push($(cell).text().trim());
      });
      markdown += `| ${cells.join(' | ')} |\n`;

      if (rowIndex === 0) {
        markdown += `| ${cells.map(() => '---').join(' | ')} |\n`;
      }
    });

    markdown += '\n';
  });

  $('img').each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') || '';
    if (src) markdown += `![${alt}](${src})\n`;
  });

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && text && !href.startsWith('#')) {
      markdown += `[${text}](${href})\n`;
    }
  });

  return markdown.trim();
}

export function parseHtml(
  html: string,
  baseUrl: string,
  options: { onlyMainContent?: boolean } = {}
): ParsedContent {
  const { onlyMainContent = true } = options;

  const $ = cheerio.load(html);

  for (const selector of DEFAULT_EXCLUDE_SELECTORS) {
    $(selector).remove();
  }

  const { html: cleanedHtml, text: cleanedText } = extractMainContent($, onlyMainContent);

  const metadata = extractMetadata($);
  const links = extractLinks($, baseUrl);
  const markdown = htmlToMarkdown(cleanedHtml);

  return {
    title: metadata.title || '',
    description: metadata.description || '',
    markdown: sanitizeText(markdown),
    html: cleanedHtml,
    links,
    metadata,
    rawHtml: html,
  };
}

export function quickParse(html: string): { text: string; title: string } {
  const $ = cheerio.load(html);

  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim() || $('h1').first().text().trim();

  return { text, title };
}

export default {
  parseHtml,
  quickParse,
  extractMetadata,
  extractLinks,
  htmlToMarkdown,
};
