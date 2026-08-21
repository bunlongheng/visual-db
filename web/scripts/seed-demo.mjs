// Seed the public demo sandbox database (visualdb_demo) with 10 clean synthetic
// tables whose distributions exercise every dashboard widget: line charts (time),
// calendar heatmap, doughnuts (<=6 categories), rainbow bars (8-15 categories),
// ordinals, histograms (log-normal amounts), email-domain charts, booleans, gauge.
//
// Usage: DEMO_DATABASE_URL=postgres://bheng:...@host/visualdb_demo node scripts/seed-demo.mjs
// Idempotent: drops + recreates all 10 tables. NEVER point this at a real database.

import { Pool } from "pg";

const url = process.env.DEMO_DATABASE_URL;
if (!url) {
  console.error("Set DEMO_DATABASE_URL (must point at the visualdb_demo database)");
  process.exit(1);
}
if (!/visualdb_demo/.test(url)) {
  console.error("Refusing: DEMO_DATABASE_URL does not point at visualdb_demo");
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 4 });

// ---- deterministic RNG (mulberry32) so reseeding gives the same pretty data ----
let s = 0x9e3779b9;
const rng = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const normal = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const logn = (mu, sigma) => Math.exp(mu + sigma * normal());
// weighted pick: [["gmail.com", 38], ...]
const pick = (pairs) => {
  const totalW = pairs.reduce((t, p) => t + p[1], 0);
  let r = rng() * totalW;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const uuid = () => {
  const h = () => Math.floor(rng() * 16).toString(16);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) =>
    c === "x" ? h() : ((Math.floor(rng() * 4) + 8).toString(16))
  );
};

// timestamp over the past `span` days: linear growth + weekly cycle + jitter,
// so monthly lines trend up and the calendar heatmap shows weekday texture
const NOW = Date.now();
const DAY = 86400000;
const grownDate = (span) => {
  let d;
  do { d = span * (1 - Math.sqrt(1 - rng())); } while (d < 0); // more mass near today
  const dt = new Date(NOW - d * DAY);
  const dow = dt.getDay();
  if ((dow === 0 || dow === 6) && rng() < 0.42) dt.setTime(dt.getTime() - DAY * ri(1, 2)); // quieter weekends
  dt.setHours(ri(0, 23), ri(0, 59), ri(0, 59), 0);
  return dt;
};
const iso = (d) => d.toISOString();

// ---- vocab ----
const FIRST = ["Ava","Liam","Mia","Noah","Zoe","Ethan","Ivy","Lucas","Nora","Owen","Ruby","Eli","June","Max","Lena","Theo","Isla","Finn","Cora","Jude","Elle","Kai","Faye","Rhys","Nina","Cole","Tess","Beau","Skye","Reed","Wren","Jack","Luna","Dean","Rose","Seth","Iris","Gage","Vera","Hugo"];
const LAST = ["Stone","Rivera","Chen","Patel","Kim","Novak","Silva","Moreau","Haas","Tanaka","Okafor","Larsen","Costa","Ivanov","Ali","Weber","Fontaine","Ross","Vargas","Nguyen","Berg","Diaz","Kowal","Sato","Reyes","Lund","Meyer","Duarte","Klein","Herrera","Fox","Bishop","Nakamura","Sorensen","Adeyemi","Marino","Petrov","Aoki","Delgado","Brandt"];
const name = () => `${FIRST[ri(0, FIRST.length - 1)]} ${LAST[ri(0, LAST.length - 1)]}`;
const EMAIL_DOMAINS = [["gmail.com",38],["yahoo.com",12],["outlook.com",10],["hotmail.com",8],["icloud.com",8],["proton.me",5],["aol.com",4],["fastmail.com",3],["hey.com",3],["zoho.com",3],["gmx.com",3],["pm.me",3]];
const email = (n) => `${n.toLowerCase().replace(/[^a-z]+/g, ".")}${ri(1, 999)}@${pick(EMAIL_DOMAINS)}`;
const COUNTRIES = [["United States",30],["United Kingdom",11],["Germany",9],["Canada",8],["France",7],["Australia",6],["Japan",6],["Brazil",5],["Netherlands",5],["India",5],["Sweden",4],["Singapore",4]];
const PLANS = [["free",44],["starter",27],["pro",19],["business",10]];

// ---- table builders: [name, ddl, rowCount, rowFn] ----
const ADJ = ["Aurora","Cobalt","Ember","Frost","Golden","Indigo","Jade","Lunar","Maple","Nimbus","Onyx","Prism","Quartz","Raven","Slate","Terra","Umber","Velvet","Willow","Zephyr"];
const NOUN = ["Lamp","Desk","Chair","Mug","Bottle","Backpack","Notebook","Keyboard","Speaker","Blanket","Candle","Planter","Clock","Poster","Rug","Kettle","Tray","Mirror","Shelf","Stool"];
const PRODUCT_CATS = [["Home & Living",20],["Electronics",16],["Kitchen",14],["Office",12],["Outdoor",10],["Lighting",8],["Textiles",7],["Decor",6],["Storage",4],["Wellness",3]];

const customers = [];
const products = [];
const orders = [];

const TABLES = [
  ["customers", `id uuid PRIMARY KEY, full_name text NOT NULL, email text NOT NULL, country text NOT NULL,
    plan text NOT NULL, signup_source text NOT NULL, lifetime_value numeric(10,2) NOT NULL,
    is_active boolean NOT NULL, created_at timestamptz NOT NULL`, 5200, () => {
    const n = name();
    const row = [uuid(), n, email(n), pick(COUNTRIES), pick(PLANS),
      pick([["organic",26],["referral",18],["google-ads",14],["social",12],["newsletter",10],["partner",8],["podcast",7],["event",5]]),
      Math.min(24000, logn(4.4, 1.25)).toFixed(2), rng() < 0.83, iso(grownDate(540))];
    customers.push(row[0]);
    return row;
  }],
  ["products", `id uuid PRIMARY KEY, name text NOT NULL, category text NOT NULL, price numeric(8,2) NOT NULL,
    stock integer NOT NULL, rating numeric(2,1), is_featured boolean NOT NULL, created_at timestamptz NOT NULL`, 240, () => {
    const row = [uuid(), `${ADJ[ri(0, 19)]} ${NOUN[ri(0, 19)]}`, pick(PRODUCT_CATS),
      Math.max(4.5, logn(3.4, 0.8)).toFixed(2), ri(0, 950),
      rng() < 0.07 ? null : (3 + rng() * 2).toFixed(1), rng() < 0.14, iso(grownDate(700))];
    products.push(row[0]);
    return row;
  }],
  ["orders", `id uuid PRIMARY KEY, customer_id uuid NOT NULL, status text NOT NULL, channel text NOT NULL,
    total numeric(10,2) NOT NULL, items integer NOT NULL, discount_pct integer NOT NULL, created_at timestamptz NOT NULL`, 12400, () => {
    const row = [uuid(), customers[ri(0, customers.length - 1)],
      pick([["delivered",46],["shipped",17],["paid",14],["pending",11],["cancelled",7],["refunded",5]]),
      pick([["web",47],["ios",24],["android",19],["api",10]]),
      Math.max(6, logn(4.1, 0.95)).toFixed(2), Math.min(12, 1 + Math.floor(logn(0.45, 0.7))),
      pick([[0,55],[5,15],[10,13],[15,9],[20,5],[25,3]]), iso(grownDate(540))];
    orders.push(row[0]);
    return row;
  }],
  ["payments", `id uuid PRIMARY KEY, order_id uuid NOT NULL, method text NOT NULL, status text NOT NULL,
    currency text NOT NULL, amount numeric(10,2) NOT NULL, fee numeric(8,2) NOT NULL, paid_at timestamptz NOT NULL`, 11600, () => {
    const amt = Math.max(6, logn(4.1, 0.95));
    return [uuid(), orders[ri(0, orders.length - 1)],
      pick([["card",52],["paypal",17],["apple-pay",14],["google-pay",9],["bank-transfer",8]]),
      pick([["succeeded",88],["failed",7],["refunded",5]]),
      pick([["USD",44],["EUR",20],["GBP",13],["CAD",9],["AUD",8],["JPY",6]]),
      amt.toFixed(2), (amt * 0.029 + 0.3).toFixed(2), iso(grownDate(540))];
  }],
  ["subscriptions", `id uuid PRIMARY KEY, customer_id uuid NOT NULL, plan text NOT NULL, status text NOT NULL,
    billing_cycle text NOT NULL, seats integer NOT NULL, mrr numeric(8,2) NOT NULL, started_at timestamptz NOT NULL`, 6100, () => {
    const plan = pick(PLANS);
    const seats = plan === "business" ? ri(5, 25) : plan === "pro" ? ri(2, 10) : ri(1, 3);
    const per = { free: 0, starter: 9, pro: 29, business: 79 }[plan];
    return [uuid(), customers[ri(0, customers.length - 1)], plan,
      pick([["active",62],["trialing",14],["past-due",8],["canceled",16]]),
      pick([["monthly",68],["annual",32]]), seats, (per * seats).toFixed(2), iso(grownDate(540))];
  }],
  ["page_views", `id uuid PRIMARY KEY, path text NOT NULL, device text NOT NULL, browser text NOT NULL,
    country text NOT NULL, duration_ms integer NOT NULL, viewed_at timestamptz NOT NULL`, 46000, () => [
    uuid(),
    pick([["/",24],["/pricing",14],["/products",13],["/blog",10],["/docs",9],["/signup",8],["/login",7],["/about",5],["/changelog",4],["/careers",3],["/contact",2],["/status",1]]),
    pick([["desktop",54],["mobile",38],["tablet",8]]),
    pick([["chrome",49],["safari",21],["firefox",10],["edge",9],["samsung-internet",5],["opera",3],["brave",3]]),
    pick(COUNTRIES), Math.min(600000, Math.floor(logn(9.6, 1.1))), iso(grownDate(210)),
  ]],
  ["reviews", `id uuid PRIMARY KEY, product_id uuid NOT NULL, rating integer NOT NULL, sentiment text NOT NULL,
    source text NOT NULL, helpful_votes integer NOT NULL, verified boolean NOT NULL, created_at timestamptz NOT NULL`, 7900, () => {
    const rating = pick([[5,42],[4,28],[3,14],[2,9],[1,7]]);
    return [uuid(), products[ri(0, products.length - 1)], rating,
      rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative",
      pick([["web",46],["ios",26],["android",20],["email",8]]),
      Math.floor(logn(1.2, 1.4)), rng() < 0.71, iso(grownDate(540))];
  }],
  ["support_tickets", `id uuid PRIMARY KEY, customer_id uuid NOT NULL, priority text NOT NULL, status text NOT NULL,
    channel text NOT NULL, topic text NOT NULL, first_response_min integer NOT NULL,
    satisfaction integer, opened_at timestamptz NOT NULL`, 3150, () => [
    uuid(), customers[ri(0, customers.length - 1)],
    pick([["low",34],["medium",38],["high",20],["urgent",8]]),
    pick([["resolved",48],["closed",26],["open",16],["pending",10]]),
    pick([["email",40],["chat",32],["phone",16],["twitter",12]]),
    pick([["billing",22],["bug-report",19],["how-to",17],["account",13],["feature-request",11],["shipping",9],["refund",6],["integration",3]]),
    Math.max(1, Math.floor(logn(3.6, 1.0))), rng() < 0.2 ? null : pick([[5,38],[4,30],[3,15],[2,9],[1,8]]),
    iso(grownDate(540)),
  ]],
  ["employees", `id uuid PRIMARY KEY, full_name text NOT NULL, department text NOT NULL, level text NOT NULL,
    office text NOT NULL, salary numeric(9,2) NOT NULL, remote boolean NOT NULL, hired_at timestamptz NOT NULL`, 140, () => [
    uuid(), name(),
    pick([["engineering",34],["sales",16],["support",13],["marketing",11],["product",10],["design",7],["finance",5],["people-ops",4]]),
    pick([["junior",18],["mid",34],["senior",28],["staff",12],["lead",8]]),
    pick([["san-francisco",26],["new-york",21],["london",17],["berlin",13],["singapore",9],["remote",14]]),
    Math.min(340000, logn(11.6, 0.35)).toFixed(2), rng() < 0.36, iso(grownDate(1500)),
  ]],
  ["campaigns", `id uuid PRIMARY KEY, name text NOT NULL, channel text NOT NULL, status text NOT NULL,
    budget numeric(10,2) NOT NULL, impressions integer NOT NULL, clicks integer NOT NULL,
    conversion_rate numeric(5,2) NOT NULL, launched_at timestamptz NOT NULL`, 96, () => {
    const impressions = Math.floor(logn(11.2, 1.0));
    return [uuid(), `${ADJ[ri(0, 19)]} ${pick([["Launch",3],["Push",2],["Promo",3],["Drop",2],["Week",2]])}`,
      pick([["email",24],["social",20],["search",18],["display",14],["podcast",10],["influencer",8],["affiliate",6]]),
      pick([["completed",44],["running",28],["scheduled",16],["paused",12]]),
      logn(7.6, 0.9).toFixed(2), impressions, Math.floor(impressions * (0.005 + rng() * 0.06)),
      (0.4 + rng() * 7.2).toFixed(2), iso(grownDate(540))];
  }],
];

async function seed() {
  const t0 = Date.now();
  for (const [table, ddl, count, rowFn] of TABLES) {
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
    await pool.query(`CREATE TABLE ${table} (${ddl})`);
    // split on comma+whitespace only, so numeric(10,2) inside a type stays intact
    const cols = ddl.split(/,\s+/).map((c) => c.trim().split(/\s+/)[0]);
    const rows = Array.from({ length: count }, rowFn);
    const B = 500;
    for (let i = 0; i < rows.length; i += B) {
      const batch = rows.slice(i, i + B);
      const params = [];
      const values = batch
        .map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(",")})`)
        .join(",");
      await pool.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${values}`, params);
    }
    console.log(`${table.padEnd(16)} ${count.toLocaleString("en-US").padStart(7)} rows`);
  }
  await pool.query(`GRANT USAGE ON SCHEMA public TO visualdb_demo`);
  await pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO visualdb_demo`);
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
