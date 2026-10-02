/**
 * ისტორიის სტატისტიკა პერიოდისთვის [from, to). ერთი წყარო ეკრანისთვის, CSV-სთვის და PDF-ისთვის —
 * რომ ყველგან ერთი და იგივე რიცხვები ჩანდეს.
 *
 *  uptime %   = (მონიტორინგის დრო − ოფლაინ დრო) / მონიტორინგის დრო
 *               (მონიტორინგის დრო — როცა NetWatch მუშაობდა; კომპიუტრის გამორთვა/ძილი არ ითვლება)
 *  გათიშვები  = ვინც პერიოდს ეხება (თუნდაც ნაწილობრივ)
 *  დღეები     = ოფლაინ დრო და გათიშვები ყოველ კალენდარულ დღეზე (ლოკალური დრო)
 */
function queryHistory(data, { from, to, now = Date.now() }) {
  to = Math.min(to, now);
  const overlap = (a, b) => Math.max(0, Math.min(b, to) - Math.max(a, from));

  const outages = data.outages
    .map((o) => ({ ...o, ongoing: o.end === null, end: o.end ?? now }))
    .filter((o) => o.start < to && o.end > from)
    .map((o) => ({ ...o, durationMs: o.end - o.start }));

  const monitoredMs = data.sessions.reduce((sum, s) => sum + overlap(s.start, s.end), 0);
  // ოფლაინ დრო = გათიშვა ∩ სესია ∩ პერიოდი (თუ კომპიუტერს გათიშვისას ეძინა — ძილი არ ითვლება)
  const offline = (o, a, b) =>
    data.sessions.reduce(
      (sum, x) => sum + Math.max(0, Math.min(o.end, x.end, b) - Math.max(o.start, x.start, a)),
      0
    );
  const downtimeMs = outages.reduce((sum, o) => sum + offline(o, from, to), 0);
  const longest = outages.reduce((best, o) => (!best || o.durationMs > best.durationMs ? o : best), null);

  const summary = {
    from,
    to,
    monitoredMs,
    downtimeMs,
    uptimePct: monitoredMs ? ((monitoredMs - downtimeMs) / monitoredMs) * 100 : null,
    count: outages.length,
    longestMs: longest?.durationMs ?? 0,
    longestAt: longest?.start ?? null,
    avgMs: outages.length ? outages.reduce((s, o) => s + o.durationMs, 0) / outages.length : 0,
    // პროვაიდერის მხარეს (როუტერი მუშაობდა, ინტერნეტი — არა) — საჩივრისთვის ყველაზე მნიშვნელოვანი
    providerCount: outages.filter((o) => o.failedAt === 'internet').length,
    ongoing: outages.some((o) => o.ongoing),
  };

  const days = [];
  for (let d = startOfDay(from); d < to; d = nextDay(d)) {
    const end = nextDay(d);
    const clip = (a, b) => Math.max(0, Math.min(b, end, to) - Math.max(a, d));
    days.push({
      date: d,
      downtimeMs: outages.reduce((s, o) => s + offline(o, d, Math.min(end, to)), 0),
      count: outages.filter((o) => o.start >= d && o.start < end).length,
      monitoredMs: data.sessions.reduce((s, x) => s + clip(x.start, x.end), 0),
    });
  }

  return {
    summary,
    days,
    outages: outages
      .sort((a, b) => b.start - a.start)
      .map(({ start, end, durationMs, ongoing, reason, cause, failedAt, unknownEnd }) => ({
        start,
        end,
        durationMs,
        ongoing,
        reason,
        cause: cause ?? null,
        failedAt: failedAt ?? null,
        unknownEnd: !!unknownEnd,
      })),
  };
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** შემდეგი დღის დასაწყისი (ზაფხულის დროზე გადასვლისასაც სწორი — setDate, არა +24სთ) */
function nextDay(t) {
  const d = new Date(t);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

module.exports = { queryHistory };
