// version: finance-v0.1b3
// date: 2025-08-27 15:03 Europe/London
// changelog: amazon net overlay loader

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export type AmazonNet = Record<number, Record<string, number>>; // month -> category -> amount

export function loadAmazonNetOverride(repoRoot: string): AmazonNet | null {
  const p = path.join(repoRoot, 'config', 'overrides', 'amazon_net_2024.yaml');
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  return yaml.load(raw) as AmazonNet;
}

export function buildAmazonNetFromObject(obj: any): AmazonNet {
  const net: AmazonNet = {};
  for (const [m, cats] of Object.entries(obj||{})) {
    const month = Number(m);
    net[month] = {};
    for (const [cat, val] of Object.entries(cats as any)) {
      net[month][cat] = Number(val);
    }
  }
  return net;
}
