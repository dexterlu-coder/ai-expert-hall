# Five-Dimension Diagnostic Framework (五维诊断框架详解)

Use in Step 2. For each dimension: ask the diagnostic questions, place the org on the 1–5 maturity anchor, and name the single biggest gap. Watch for the listed failure patterns.

---

## 1. 内容维度 (Content)

**Core question:** 现有课程质量和更新频率如何？

**Diagnostic questions**
- 课程库覆盖了哪些岗位/能力？有明显空白吗？
- 课程平均"保鲜期"多久？多久更新一次？谁负责更新？
- 自研 vs 外采比例？外采课程与本企业业务贴合度？
- 内容复用率如何（一次开发多处使用）？
- 有没有沉淀隐性知识（老师傅经验、案例库）？

**Maturity anchors**
- L1：临时找 PPT，无课程库
- L3：有结构化课程库，年度更新计划
- L5：模块化内容中台，按需组装，自动化更新提醒

**Common failure patterns**
- 课程一次开发后长期不更新，与业务脱节
- 重外采、轻自研，通用课"水土不服"
- 隐性经验无人沉淀，人走知识走

---

## 2. 交付维度 (Delivery)

**Core question:** 培训方式和覆盖范围如何？

**Diagnostic questions**
- 主要交付形式？各形式占比？
- 到达率/覆盖率如何？一线、异地、多语言人群能否覆盖？
- 排课、通知、签到是手工还是系统化？
- 混合式学习（线上+线下）是否成型？
- 讲师资源是否够用（内训师数量、外部讲师依赖度）？

**Maturity anchors**
- L1：纯线下、靠通知、覆盖窄
- L3：线上线下混合，系统排课，覆盖主要人群
- L5：多形态自适应交付，一线/多语言全覆盖，智能排课

**Common failure patterns**
- 过度依赖线下面授，成本高、覆盖窄
- 一线与异地人群长期被"漏掉"
- 排课/通知全手工，L&D 团队被事务性工作淹没

---

## 3. 评估维度 (Evaluation)

**Core question:** 效果如何衡量？

**Diagnostic questions**
- 评估到柯氏（Kirkpatrick）哪一级？
  - L1 反应（满意度问卷）
  - L2 学习（考试/测验）
  - L3 行为（回到岗位是否改变）
  - L4 结果（业务指标改善）
- 数据是否闭环（学—考—用—评）？
- 培训是否与绩效、晋升挂钩？
- 能否说清任一门课的 ROI？

**Maturity anchors**
- L1：只有满意度问卷（柯氏 1 级）
- L3：到柯氏 2 级，有考试与完课数据
- L5：到柯氏 3–4 级，行为与业务指标可归因

**Common failure patterns**
- 止步于"满意度五星"，说不清真实效果
- 有数据但不分析，无闭环
- 评估与业务脱钩，无法向管理层证明价值

---

## 4. 技术维度 (Technology)

**Core question:** 现有 IT 基础设施是否支撑？

**Diagnostic questions**
- 有无 LMS/LXP？活跃度、数据完整度如何？
- 学习数据能否导出、能否与 HR/绩效系统打通？
- 是否已用任何 AI 能力（出题、字幕、翻译、陪练）？
- 企业 IM（企微/钉钉/飞书）能否作为学习触点？
- IT 对新系统/AI 的开放度与合规约束？

**Maturity anchors**
- L1：无系统，Excel + 群通知
- L3：有 LMS，数据可导出，未打通其他系统
- L5：LMS/LXP + 数据中台 + AI 能力已接入，多系统集成

**Common failure patterns**
- 买了 LMS 但只当"点名工具"，数据不用
- 数据孤岛，学习数据与业务数据不通
- 合规/数据安全约束未提前评估，AI 落地受阻

---

## 5. 人员维度 (People)

**Core question:** 学员画像和学习习惯如何？

**Diagnostic questions**
- 主要学员群体及其差异（新员工/一线/管理/技术）？
- 学习设备与场景（PC/手机、脱产/碎片化）？
- 学习动机（强制合规 vs 自主发展）？
- 内训师队伍规模与能力？
- 是否多语种、多地域？

**Maturity anchors**
- L1：不了解学员，一刀切培训
- L3：有基本学员分层，按群体设计
- L5：个性化学习画像，千人千面路径

**Common failure patterns**
- "一刀切"培训，忽视群体差异
- 忽视碎片化学习现实，硬塞长课
- 内训师青黄不接，过度依赖外部

---

## Output of Step 2

For each dimension record:
```
维度 | 现状摘要 | 成熟度(1-5) | 最大缺口
```
Aggregate the five scores into a maturity profile (radar-style). The lowest-scoring dimensions that also connect to the user's TOP1 痛点 become the primary targets for Step 3.
