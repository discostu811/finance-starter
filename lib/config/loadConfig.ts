// version: finance-v0.1b3
// date: 2025-08-27 15:03 Europe/London
// changelog: config loaders for yaml

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export type SourcesConfig = { version: number; sources: Record<string, any>; };
export type CategoriesConfig = {
  version: number;
  rollup: {
    exclude: string[];
    normalize: Record<string,string>;
    drop_if_source?: string[];
    unify_signs: 'household';
    income_categories: string[];
    amazon_adjustments?: { use_net_from_pivot?: boolean; net_rules?: string; };
  };
};

export function loadYaml<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw) as T;
}

export function loadConfigs(repoRoot: string) {
  const sourcesPath = path.join(repoRoot, 'config', 'sources.yaml');
  const categoriesPath = path.join(repoRoot, 'config', 'categories.yaml');
  if (!fs.existsSync(sourcesPath)) throw new Error(`Missing config: ${sourcesPath}`);
  if (!fs.existsSync(categoriesPath)) throw new Error(`Missing config: ${categoriesPath}`);
  const sources = loadYaml<SourcesConfig>(sourcesPath);
  const categories = loadYaml<CategoriesConfig>(categoriesPath);
  return { sources, categories };
}
