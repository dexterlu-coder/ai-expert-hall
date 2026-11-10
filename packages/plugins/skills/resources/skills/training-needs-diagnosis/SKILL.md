---
name: training-needs-diagnosis
description: 企业培训需求诊断：诊断组织培训现状和能力差距，评估 AI 改进机会，输出培训需求报告、优先级、实施路线和投入产出建议。
agent_created: true
---

# Training Needs Diagnosis (培训需求 AI 诊断框架)

## Purpose

Diagnose an organization's training operation through a structured, five-dimension lens, pinpoint where AI can create leverage, prioritize those opportunities by return-on-investment, and deliver a professional Word diagnosis report. The framework encodes practical judgment from 21 years of multinational-corporation L&D practice so another agent can run a consultant-grade diagnosis without prior domain training.

## When To Use

Use this skill when a user wants any of the following:
- A diagnosis / audit / health-check of their current training system
- To understand where AI can improve their L&D operation and in what order
- A training gap analysis paired with an implementation roadmap and ROI estimate
- A formal training-needs diagnosis document to circulate internally

Do NOT use this skill for pure course-content design, single-course instructional design, or LMS product selection unless it is part of a broader needs diagnosis.

## Overall Workflow

Run the diagnosis in four sequential steps. Each step gates the next — do not skip ahead to the report before the intake and analysis are complete.

```
Step 1 Intake  →  Step 2 Five-Dimension Analysis  →  Step 3 AI Opportunity Mapping  →  Step 4 Word Report
```

### Step 1 — Collect Baseline Information (信息收集)

Gather the intake data before analyzing. Ask in small batches (2–3 questions at a time), not a single wall of questions. Prioritize these:

1. **组织画像** — 企业规模（人数/是否多地点/是否跨国）、行业、年度培训预算量级
2. **现状方式** — 当前主要培训方式（线下面授 / 直播 / 录播 / 混合 / 师带徒）
3. **最大痛点** — 逼用户排出 TOP1（常见候选：完课率低 / 效果无法评估 / 成本高 / 内容更新慢 / 覆盖不到一线 / 培训与业务脱节）
4. **技术底座** — 是否有 LMS/LXP 系统、是否已用任何 AI 工具、数据是否可导出

If the user cannot answer a field, record it as "未知/待补充" and proceed — do not block the diagnosis. Note assumptions explicitly.

Use `references/intake-checklist.md` for the full question bank and the customer-maturity scoring rubric.

### Step 2 — Analyze Across the Five Dimensions (五维框架分析)

Assess the organization on all five dimensions. For each, produce: (a) a current-state summary, (b) a maturity rating (1–5), and (c) the key gap.

| 维度 | 核心问题 | 关注点 |
|------|----------|--------|
| 内容 (Content) | 课程质量与更新频率如何？ | 覆盖度、时效性、复用率、自研 vs 外采 |
| 交付 (Delivery) | 培训怎么送达、覆盖多广？ | 到达率、一线覆盖、混合比例、排课效率 |
| 评估 (Evaluation) | 效果如何衡量？ | 柯氏四级到达哪一级、数据闭环、与绩效挂钩 |
| 技术 (Technology) | IT 基础设施是否支撑？ | LMS/LXP、数据可用性、系统集成、AI 就绪度 |
| 人员 (People) | 学员是谁、怎么学？ | 学员画像、学习习惯、碎片化程度、内训师力量 |

Read `references/five-dimension-framework.md` for the diagnostic questions, maturity anchors (what a level 1 vs level 5 looks like), and common failure patterns per dimension.

### Step 3 — Identify AI Entry Points & Prioritize (AI 切入点识别与排序)

For every dimension, mark the specific sub-processes where AI can create leverage, then rank all opportunities by ROI (投入产出比，high → low).

- Map opportunities using the catalog in `references/ai-opportunity-map.md` (AI use cases per dimension, with typical effort and impact).
- Score each opportunity on the **Impact × Feasibility** grid; effort/impact anchors and the priority formula are in the same reference file.
- Output a ranked list: 优先级 P0/P1/P2, each with the target process, the AI lever, expected gain, and rough effort.

The default prioritization bias (from field experience): favor opportunities that (1) attack the user's stated TOP1 痛点, (2) reuse existing data/systems, and (3) show measurable results within one quarter.

### Step 4 — Produce the Word Diagnosis Report (输出诊断报告)

Generate a Word (.docx) report using the bundled script. The report MUST contain four parts:
1. **现状分析** — five-dimension current state + maturity radar summary
2. **AI 机会点** — prioritized opportunity list (P0/P1/P2)
3. **实施路线图** — phased roadmap (quick wins → foundation → scale)
4. **预估 ROI** — cost/benefit estimate with assumptions

**How to generate:**

1. Assemble all diagnosis findings into a JSON data file (see the schema and a complete worked example in `references/report-data-schema.md`).
2. Run the generator:

```bash
python scripts/generate_report.py <path-to-data.json> <output-folder>
```

The script writes `培训需求诊断报告_<企业名>_<YYYYMMDD>.docx` into the output folder the user specifies. It depends on `python-docx`; if missing, install with `pip install python-docx` first.

3. Always save the report to the folder the user designates. If the user did not specify one, ask before writing.
4. After generating, present the file to the user.

## Key Principles (field-tested judgment)

- **痛点驱动，而非技术驱动** — Anchor every AI recommendation to a business pain, never "上 AI 因为它时髦".
- **先量化现状，再谈提升** — A gap has no ROI unless the baseline is quantified (even a rough estimate beats none).
- **Quick win 开路** — Lead the roadmap with a low-effort, visible win to build sponsor confidence before big investments.
- **ROI 要诚实** — State assumptions openly; present a conservative and an optimistic band, not a single inflated number.
- **人员维度常被低估** — Adoption fails on people, not tech. Always weight learner habits and 内训师 capacity.

