#!/usr/bin/env node
/**
 * 扫描 posts/*.md，生成 posts/index.json，并据此写出仓库根目录的 sitemap.xml。
 *
 * 每篇文章的「最后修改日期」按以下顺序推断：
 *   1. 元数据里的 updated 字段（手动指定，优先级最高）
 *   2. 该文件最后一次 git 提交的时间
 *   3. 文件系统修改时间
 *   4. 元数据里的 date
 *
 * 站点地图只收录规范公开页。文章 lastmod 使用上面得到的 updated（YYYY-MM-DD）；
 * 没有这份日期的静态页不写 lastmod。
 *
 * 用法：node scripts/build-posts.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_FILE = path.join(POSTS_DIR, 'index.json');
const SITEMAP_FILE = path.join(ROOT, 'sitemap.xml');
const SITE = 'https://dntof.com';

const STATIC_PAGES = [
  { loc: `${SITE}/`, file: 'index.html' },
  { loc: `${SITE}/blog/`, file: 'blog/index.html' },
  { loc: `${SITE}/platform/`, file: 'platform/index.html' },
  { loc: `${SITE}/dnt-118/`, file: 'dnt-118/index.html' },
];

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?/;

function parseFrontMatter(raw) {
  const text = raw.replace(/\r\n?/g, '\n');
  const match = text.match(FRONT_MATTER);
  if (!match) return { data: {}, body: text };

  const data = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim().replace(/\//g, '-');
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function gitLastModified(relPath) {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', relPath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!iso) return null;
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function mtimeDate(filePath) {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(statSync(filePath).mtime);
  } catch {
    return null;
  }
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSummary(body) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let inCode = false;
  const parts = [];
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (!line.trim() || /^#/.test(line.trim())) {
      if (parts.length) break;
      continue;
    }
    parts.push(line);
    if (parts.join(' ').length > 140) break;
  }
  const text = stripMarkdown(parts.join(' '));
  if (!text) return '';
  return text.length > 110 ? text.slice(0, 110).replace(/[，。、\s]+$/, '') + '…' : text;
}

function readingMinutes(body) {
  const plain = stripMarkdown(body.replace(/```[\s\S]*?```/g, ' '));
  const cjk = (plain.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (plain.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 350 + words / 180));
}

function titleFromBody(body) {
  const text = body.replace(/```[\s\S]*?```/g, '');
  const heading = text.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : null;
}

function parseTags(value) {
  if (!value) return [];
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function collectPosts() {
  let files = [];
  try {
    files = readdirSync(POSTS_DIR);
  } catch {
    console.warn('posts/ 目录不存在，生成空索引。');
    return [];
  }

  return files
    .filter((name) => name.endsWith('.md'))
    .filter((name) => !name.startsWith('_'))
    .filter((name) => name.toLowerCase() !== 'readme.md')
    .sort()
    .map((name) => {
      const filePath = path.join(POSTS_DIR, name);
      const relPath = `posts/${name}`;
      const raw = readFileSync(filePath, 'utf8');
      const { data, body } = parseFrontMatter(raw);

      const slug = name.replace(/\.md$/i, '');
      const title = (data.title || titleFromBody(body) || slug).trim();
      const date =
        normalizeDate(data.date) || gitLastModified(relPath) || mtimeDate(filePath);
      const updated =
        normalizeDate(data.updated) ||
        gitLastModified(relPath) ||
        mtimeDate(filePath) ||
        date;

      return {
        slug,
        title,
        date,
        updated,
        summary: (data.summary || data.description || makeSummary(body)).trim(),
        tags: parseTags(data.tags),
        minutes: readingMinutes(body),
        path: relPath,
      };
    })
    .filter((post) => post.date)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.slug < b.slug ? 1 : -1;
    });
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function articleLoc(slug) {
  return `${SITE}/blog/post.html?slug=${encodeURIComponent(slug)}`;
}

function buildSitemap(postList) {
  for (const page of STATIC_PAGES) {
    if (!existsSync(path.join(ROOT, page.file))) {
      throw new Error(`站点地图引用了不存在的页面：${page.file}`);
    }
  }

  const urls = STATIC_PAGES.map((page) => ({ loc: page.loc }));
  for (const post of postList) {
    if (!existsSync(path.join(ROOT, post.path))) {
      throw new Error(`站点地图引用了不存在的文章：${post.path}`);
    }
    urls.push({
      loc: articleLoc(post.slug),
      lastmod: normalizeDate(post.updated),
    });
  }

  const body = urls
    .map((url) => {
      const lines = ['  <url>', `    <loc>${xmlEscape(url.loc)}</loc>`];
      if (url.lastmod) lines.push(`    <lastmod>${url.lastmod}</lastmod>`);
      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${body}\n` +
    '</urlset>\n';

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (locs.length !== urls.length) {
    throw new Error(`站点地图 URL 数量不符：${locs.length}，应为 ${urls.length}`);
  }
  const seen = new Set();
  for (const loc of locs) {
    if (!loc.startsWith(`${SITE}/`)) throw new Error(`站点地图含非规范地址：${loc}`);
    if (seen.has(loc)) throw new Error(`站点地图 URL 重复：${loc}`);
    seen.add(loc);
  }
  const lastmods = [...xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((match) => match[1]);
  if (lastmods.length !== postList.length) {
    throw new Error('静态页面不应写入 lastmod');
  }
  for (const value of lastmods) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`站点地图 lastmod 无效：${value}`);
    }
  }

  return xml;
}

const posts = collectPosts();

let previous = null;
try {
  previous = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
} catch {
  previous = null;
}

const unchanged =
  previous && JSON.stringify(previous.posts) === JSON.stringify(posts);

const index = {
  generated: unchanged ? previous.generated : new Date().toISOString(),
  posts,
};

writeFileSync(OUT_FILE, JSON.stringify(index, null, 2) + '\n', 'utf8');
const sitemap = buildSitemap(posts);
writeFileSync(SITEMAP_FILE, sitemap, 'utf8');
console.log(`已生成 posts/index.json：${posts.length} 篇文章`);
console.log(`已生成 sitemap.xml：${STATIC_PAGES.length + posts.length} 个地址`);
