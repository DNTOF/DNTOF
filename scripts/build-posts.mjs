#!/usr/bin/env node
/**
 * 扫描 posts/*.md，生成 posts/index.json。
 *
 * 每篇文章的「最后修改日期」按以下顺序推断：
 *   1. 元数据里的 updated 字段（手动指定，优先级最高）
 *   2. 该文件最后一次 git 提交的时间
 *   3. 文件系统修改时间
 *   4. 元数据里的 date
 *
 * 用法：node scripts/build-posts.mjs
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_FILE = path.join(POSTS_DIR, 'index.json');

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
console.log(`已生成 posts/index.json：${posts.length} 篇文章`);
