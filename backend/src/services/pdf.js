// A small PDF writer: A4 pages, Helvetica text, rules and shaded bars. It is
// enough for invoices and receipts without pulling in a PDF dependency.

const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

export const PAGE = { width: 595.28, height: 841.89, margin: 40 };

const REPLACE = { '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...', '₨': 'Rs' };

function clean(value) {
  return String(value ?? '')
    .replace(/[—–‘’“”•…₨]/g, (char) => REPLACE[char])
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}

export function textWidth(value, size, bold = false) {
  let units = 0;
  for (const char of clean(value)) {
    const code = char.charCodeAt(0);
    units += code >= 32 && code <= 126 ? WIDTHS[code - 32] : 556;
  }
  return (units / 1000) * size * (bold ? 1.04 : 1);
}

const escape = (value) => clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const num = (value) => Number(value).toFixed(2);

export class PdfDoc {
  constructor() {
    this.pages = [];
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
  }

  // y is measured from the top of the page, which is how layouts are thought of.
  text(x, y, value, { size = 10, bold = false, align = 'left', color = [0.1, 0.12, 0.2] } = {}) {
    const width = textWidth(value, size, bold);
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.map(num).join(' ')} rg ${num(left)} ${num(PAGE.height - y)} Td (${escape(value)}) Tj ET`);
  }

  line(x1, y, x2, { width = 0.5, color = [0.8, 0.82, 0.86] } = {}) {
    this.ops.push(`${color.map(num).join(' ')} RG ${width} w ${num(x1)} ${num(PAGE.height - y)} m ${num(x2)} ${num(PAGE.height - y)} l S`);
  }

  bar(x, y, width, height, color) {
    this.ops.push(`${color.map(num).join(' ')} rg ${num(x)} ${num(PAGE.height - y - height)} ${num(width)} ${num(height)} re f`);
  }

  build() {
    const objects = [];
    const add = (body) => objects.push(body) && objects.length;
    const catalog = add('');
    const tree = add('');
    const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const ops of this.pages) {
      const stream = ops.join('\n');
      const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`));
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
    objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;

    let out = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(out, 'latin1'));
      out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, 'latin1');
  }
}
