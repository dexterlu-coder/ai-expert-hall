/** Stable build-time contract for方案 B packaged expert snapshots. */
export const EXPERT_PACKAGE_SCHEMA_VERSION = 1 as const;
export const EXPERT_SNAPSHOT_BUILD_VERSION = 'workdsh-expert-snapshot/1' as const;

export type EmbeddedSkillReadiness = 'ready' | 'failed';

export interface EmbeddedSkillMetadata {
  readonly slug: string;
  readonly sourceDigest: string;
  readonly snapshotDigest: string;
  readonly buildVersion: string;
  readonly resourcesRoot: string;
  readonly readiness: EmbeddedSkillReadiness;
  readonly errorCode?: string;
  readonly resourceClosure: readonly string[];
}

export interface ExpertPackageManifest {
  readonly schemaVersion: typeof EXPERT_PACKAGE_SCHEMA_VERSION;
  readonly name: string;
  readonly expertType: 'agent' | 'team';
  readonly agentName: string;
  readonly agents: readonly string[];
  readonly skills: readonly string[];
  readonly embeddedSkills: readonly EmbeddedSkillMetadata[];
  readonly buildVersion: string;
}

const slugPattern = /^[a-z][a-z0-9-]{1,63}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const relativePathPattern = /^(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[a-zA-Z0-9._/-]+$/;

function invalid(message: string): never { throw new Error(`experts/invalid-package-schema: ${message}`); }

export function parseExpertPackageManifest(text: string): ExpertPackageManifest {
  let value: unknown;
  try { value = JSON.parse(text); } catch { invalid('plugin.json 不是有效 JSON。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('plugin.json 必须是对象。');
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== EXPERT_PACKAGE_SCHEMA_VERSION) invalid('schemaVersion 必须为 1。');
  if (typeof row.name !== 'string' || !row.name.trim()) invalid('name 不能为空。');
  if (row.expertType !== 'agent' && row.expertType !== 'team') invalid('expertType 无效。');
  if (typeof row.agentName !== 'string' || !slugPattern.test(row.agentName)) invalid('agentName 无效。');
  const strings = (key: string): string[] => {
    const list = row[key];
    if (!Array.isArray(list) || list.some(item => typeof item !== 'string')) invalid(`${key} 必须是字符串数组。`);
    return list as string[];
  };
  const agents = strings('agents');
  const skills = strings('skills');
  if (!agents.length || !agents.includes(`agents/${row.agentName}.md`)) invalid('agents 必须包含默认 Agent 文档。');
  if (skills.some(path => !/^skills\/[a-z][a-z0-9-]{1,63}$/.test(path))) invalid('skills 路径必须是规范化相对路径。');
  if (!Array.isArray(row.embeddedSkills) || row.embeddedSkills.length !== skills.length) invalid('embeddedSkills 必须逐项对应 skills。');
  const embeddedSkills = row.embeddedSkills.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid(`embeddedSkills[${index}] 必须是对象。`);
    const entry = item as Record<string, unknown>;
    for (const key of ['slug', 'sourceDigest', 'snapshotDigest', 'buildVersion', 'resourcesRoot', 'readiness']) {
      if (typeof entry[key] !== 'string' || !(entry[key] as string).trim()) invalid(`embeddedSkills[${index}].${key} 不能为空。`);
    }
    if (!slugPattern.test(entry.slug as string) || !digestPattern.test(entry.sourceDigest as string) || !digestPattern.test(entry.snapshotDigest as string)) invalid(`embeddedSkills[${index}] slug 或 digest 无效。`);
    if (entry.resourcesRoot !== `skills/${entry.slug}` || !skills.includes(entry.resourcesRoot as string)) invalid(`embeddedSkills[${index}] resourcesRoot 未绑定 skills。`);
    if (entry.readiness !== 'ready' && entry.readiness !== 'failed') invalid(`embeddedSkills[${index}].readiness 无效。`);
    if (entry.readiness === 'failed' && (typeof entry.errorCode !== 'string' || !entry.errorCode.trim())) invalid(`embeddedSkills[${index}] 失败时必须有 errorCode。`);
    if (!Array.isArray(entry.resourceClosure) || entry.resourceClosure.some(path => typeof path !== 'string' || !relativePathPattern.test(path))) invalid(`embeddedSkills[${index}].resourceClosure 无效。`);
    return entry as unknown as EmbeddedSkillMetadata;
  });
  const slugs = embeddedSkills.map(item => item.slug);
  if (new Set(slugs).size !== slugs.length || slugs.some(slug => !skills.includes(`skills/${slug}`))) invalid('embeddedSkills 与 skills 顺序或名称不一致。');
  if (typeof row.buildVersion !== 'string' || !row.buildVersion.trim()) invalid('buildVersion 不能为空。');
  return Object.freeze({
    schemaVersion: EXPERT_PACKAGE_SCHEMA_VERSION,
    name: row.name as string,
    expertType: row.expertType as 'agent' | 'team',
    agentName: row.agentName as string,
    agents: Object.freeze([...agents]),
    skills: Object.freeze([...skills]),
    embeddedSkills: Object.freeze(embeddedSkills),
    buildVersion: row.buildVersion as string,
  });
}

