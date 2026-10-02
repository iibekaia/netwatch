const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { i18n, SUPPORTED, LOCALES } = require('../electron/i18n');

const ROOT = path.join(__dirname, '..');
const isPlural = (v) => v && typeof v === 'object' && 'other' in v;

/** { 'diag.title': 'Where…', 'lan.devices': { one, other } } — meta გამოტოვებულია */
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!prefix && k === 'meta') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !isPlural(v)) Object.assign(out, flatten(v, `${prefix}${k}.`));
    else out[prefix + k] = v;
  }
  return out;
}

const placeholders = (v) =>
  [...new Set((isPlural(v) ? Object.values(v).join(' ') : String(v)).match(/\{\w+\}/g) ?? [])].sort();

const base = flatten(LOCALES.en);

for (const lang of SUPPORTED.filter((l) => l !== 'en')) {
  test(`${lang}: იგივე გასაღებები, რაც en-ში`, () => {
    const dict = flatten(LOCALES[lang]);
    const missing = Object.keys(base).filter((k) => !(k in dict));
    const extra = Object.keys(dict).filter((k) => !(k in base));
    assert.deepEqual(missing, [], `${lang}-ს აკლია`);
    assert.deepEqual(extra, [], `${lang}-ს ზედმეტი აქვს`);
  });

  test(`${lang}: იგივე ჩასასმელები ({count}, {time} …)`, () => {
    const dict = flatten(LOCALES[lang]);
    for (const [key, value] of Object.entries(base)) {
      assert.deepEqual(placeholders(dict[key]), placeholders(value), `${lang}: ${key}`);
    }
  });

  test(`${lang}: მრავლობითს აქვს ყველა ფორმა, რასაც ენა იყენებს`, () => {
    const needed = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    for (const [key, value] of Object.entries(flatten(LOCALES[lang]))) {
      if (!isPlural(value)) continue;
      for (const form of needed) assert.ok(form in value, `${lang}: ${key} — აკლია "${form}"`);
    }
  });
}

test('უკრაინული მრავლობითი: 1 / 3 / 5 / 21', () => {
  i18n.set('uk');
  assert.deepEqual(
    [1, 3, 5, 21].map((count) => i18n.t('lan.devices', { count })),
    ['1 пристрій', '3 пристрої', '5 пристроїв', '21 пристрій']
  );
  i18n.set('en');
});

test('კოდში გამოყენებული ყველა გასაღები არსებობს', () => {
  // სტრიქონები, რომლებიც თარგმანის გასაღებს ჰგავს: 'namespace.key…', namespace — en.json-ის ზედა დონე
  const namespaces = Object.keys(LOCALES.en).filter((k) => k !== 'meta');
  const re = new RegExp(`['"\`]((?:${namespaces.join('|')})\\.[a-zA-Z0-9_.-]+)['"\`]`, 'g');
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [...walk(path.join(ROOT, 'src', 'app')), ...walk(path.join(ROOT, 'electron'))].filter((f) =>
    /\.(ts|html|js)$/.test(f)
  );

  const unknown = [];
  for (const file of files) {
    for (const [, key] of fs.readFileSync(file, 'utf8').matchAll(re)) {
      if (key.endsWith('.')) continue; // დინამიკური: 'diag.step.' + id
      if (/\.(json|db|js|ts|html|css|png|ico|yml)$/.test(key)) continue; // ფაილის სახელი ('history.json')
      if (!(key in base) && !Object.keys(base).some((k) => k.startsWith(key + '.'))) {
        unknown.push(`${path.relative(ROOT, file)}: ${key}`);
      }
    }
  }
  assert.deepEqual(unknown, []);
});
