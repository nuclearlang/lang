// Texts, written by hand in idiomatic TypeScript (the same program as ../texts.nuc).
export function main(): void {
  const parts: string[] = [];
  for (let i = 0; i < 200000; i++) parts.push(`item-${i % 1000}:${(i * 7) % 13}`);
  const text = parts.join(';');
  const fields = text.split(';');
  let upper = 0;
  let long = 0;
  for (const f of fields) {
    const [key, value] = f.split(':');
    const name = key.toUpperCase().replace('ITEM-', '');
    if (name.length === 3) long++;
    if (value === '0' && f.startsWith('item-1')) upper++;
  }
  console.log(fields.slice(0, 5).map((f) => f.padStart(12, '.')).join('|'));
  console.log(`length ${text.length} fields ${fields.length} long ${long} upper ${upper}`);
  console.log(`index ${text.indexOf('item-999')} last ${text.lastIndexOf('item-0:')} has ${text.includes('item-500:')}`);
  console.log(text.substring(0, 40).replaceAll('-', '_').trim());
}

main();
