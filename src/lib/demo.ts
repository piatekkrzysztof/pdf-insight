// An original synthetic document; no recruitment PDF content is distributed.
export function demoPdf(): File {
  const lines = [
    'DEMO INVOICE - PDF INSIGHT',
    'Invoice DEMO/2026/001. Issued: 2026-10-01.',
    'Seller: Maple Studio Ltd. Buyer: River Books Ltd.',
    'Service: Website accessibility review.',
    'Net amount: 1000.00 EUR. VAT: 230.00 EUR.',
    'Gross amount payable: 1230.00 EUR.',
    'Payment deadline: 2026-10-15.',
    'This document is fictional and provided for demonstration only.',
  ]
  const stream = `BT /F1 14 Tf 50 780 Td 24 TL ${lines.map((line, i) => `${i ? 'T* ' : ''}(${line}) Tj`).join('\n')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new File([pdf], 'pdf-insight-demo.pdf', { type: 'application/pdf' })
}
