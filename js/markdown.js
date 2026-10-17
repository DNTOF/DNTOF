/* markdown.js — 够用的 Markdown 渲染器
 * 支持：标题、段落、列表、引用、代码块、行内代码、粗斜体、删除线、
 *      链接、图片、分割线、表格。
 * 先把正文整体转义再套标签，所以 Markdown 里的原始 HTML 不会被执行。
 */
(function () {
  'use strict';

  var PLACEHOLDER = /\u0001(\d+)\u0001/g;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveUrl(url, base) {
    if (!url) return url;
    if (/^(https?:)?\/\//i.test(url)) return url;
    if (/^(mailto:|tel:|#|\/)/i.test(url)) return url;
    if (/^data:/i.test(url)) return url;
    return base ? base + url : url;
  }

  function inline(text, base) {
    var codes = [];
    var html = escapeHtml(text).replace(/`([^`]+)`/g, function (_, code) {
      codes.push(code);
      return '\u0001' + (codes.length - 1) + '\u0001';
    });

    html = html.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      function (_, alt, src, title) {
        var t = title ? ' title="' + title + '"' : '';
        return (
          '<img src="' + resolveUrl(src, base) + '" alt="' + alt + '"' + t +
          ' loading="lazy">'
        );
      }
    );

    html = html.replace(
      /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      function (_, label, href, title) {
        var url = resolveUrl(href, base);
        var external = /^https?:/i.test(url) ? ' target="_blank" rel="noreferrer"' : '';
        var t = title ? ' title="' + title + '"' : '';
        return '<a href="' + url + '"' + t + external + '>' + label + '</a>';
      }
    );

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    return html.replace(PLACEHOLDER, function (_, index) {
      return '<code>' + codes[+index] + '</code>';
    });
  }

  function splitRow(line) {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(function (cell) { return cell.trim(); });
  }

  function isTableSeparator(line) {
    if (line.indexOf('-') === -1) return false;
    var cells = splitRow(line);
    return cells.length >= 2 && cells.every(function (cell) {
      return /^:?-{2,}:?$/.test(cell.trim());
    });
  }

  function render(markdown, options) {
    options = options || {};
    var base = options.base || '';
    var text = String(markdown).replace(/\r\n?/g, '\n');
    text = text.replace(/^---\n[\s\S]*?\n---\n?/, '');

    var lines = text.split('\n');
    var out = [];
    var paragraph = [];
    var quote = [];
    var listType = null;
    var listItems = [];
    var i = 0;

    function flushParagraph() {
      if (!paragraph.length) return;
      out.push('<p>' + inline(paragraph.join('\n'), base) + '</p>');
      paragraph = [];
    }

    function flushList() {
      if (!listType) return;
      out.push(
        '<' + listType + '>' +
        listItems.map(function (item) { return '<li>' + inline(item, base) + '</li>'; }).join('') +
        '</' + listType + '>'
      );
      listType = null;
      listItems = [];
    }

    function flushQuote() {
      if (!quote.length) return;
      out.push('<blockquote><p>' + inline(quote.join('\n'), base) + '</p></blockquote>');
      quote = [];
    }

    function flushAll() {
      flushParagraph();
      flushList();
      flushQuote();
    }

    while (i < lines.length) {
      var line = lines[i];

      var fence = line.match(/^```([\w+#.-]*)\s*$/);
      if (fence) {
        flushAll();
        var lang = fence[1];
        var buffer = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          buffer.push(lines[i]);
          i++;
        }
        i++;
        out.push(
          '<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' +
          escapeHtml(buffer.join('\n')) +
          '</code></pre>'
        );
        continue;
      }

      if (/^\s*$/.test(line)) {
        flushAll();
        i++;
        continue;
      }

      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushAll();
        var level = heading[1].length;
        var content = heading[2].replace(/\s+#+\s*$/, '');
        out.push('<h' + level + '>' + inline(content, base) + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushAll();
        out.push('<hr>');
        i++;
        continue;
      }

      var quoteLine = line.match(/^>\s?(.*)$/);
      if (quoteLine) {
        flushParagraph();
        flushList();
        quote.push(quoteLine[1]);
        i++;
        continue;
      }
      if (quote.length) flushQuote();

      if (line.indexOf('|') !== -1 && lines[i + 1] && isTableSeparator(lines[i + 1])) {
        flushAll();
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1 && !/^\s*$/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        var table = '<table><thead><tr>' +
          head.map(function (cell) { return '<th>' + inline(cell, base) + '</th>'; }).join('') +
          '</tr></thead><tbody>';
        rows.forEach(function (row) {
          table += '<tr>' +
            head.map(function (_, index) {
              return '<td>' + inline(row[index] || '', base) + '</td>';
            }).join('') +
            '</tr>';
        });
        out.push(table + '</tbody></table>');
        continue;
      }

      var bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      var numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        flushParagraph();
        flushQuote();
        var type = bullet ? 'ul' : 'ol';
        if (listType && listType !== type) flushList();
        listType = type;
        listItems.push((bullet || numbered)[1]);
        i++;
        continue;
      }
      if (listType) flushList();

      paragraph.push(line);
      i++;
    }

    flushAll();
    return out.join('\n');
  }

  window.renderMarkdown = render;
})();
