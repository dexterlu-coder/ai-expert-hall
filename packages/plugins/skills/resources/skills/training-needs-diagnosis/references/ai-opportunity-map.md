# AI Opportunity Map & Prioritization (AI 切入点目录与排序)

Use in Step 3. This catalogs where AI creates leverage per dimension, how to score opportunities, and how to rank them by ROI.

---

## AI Use-Case Catalog (按维度)

Effort: 低/中/高 (typical build effort). Impact: 低/中/高 (business leverage). Payback: 见效周期.

### 内容维度 (Content)
| AI 切入点 | 说明 | Effort | Impact | Payback |
|-----------|------|--------|--------|---------|
| AI 辅助课件生成 | 从文档/SOP 一键生成课程大纲、PPT、讲义 | 低 | 高 | 即时 |
| AI 出题与题库 | 自动生成测验、随机组卷、难度分级 | 低 | 中 | 即时 |
| 内容自动更新提醒 | 监测业务/政策变化，标记待更新课程 | 中 | 中 | 1 季度 |
| 隐性知识萃取 | 访谈转写 + AI 结构化为可复用案例库 | 中 | 高 | 1–2 季度 |
| 多语言课程翻译 | 一键本地化字幕/讲义，覆盖多语种人群 | 低 | 中 | 即时 |

### 交付维度 (Delivery)
| AI 切入点 | 说明 | Effort | Impact | Payback |
|-----------|------|--------|--------|---------|
| AI 陪练/角色扮演 | 销售话术、客服、管理对话的 AI 模拟演练 | 中 | 高 | 1 季度 |
| 智能排课/推送 | 按角色与进度自动排课、精准推送 | 中 | 中 | 1 季度 |
| 视频自动加工 | 长视频自动切片、生成字幕/摘要/章节 | 低 | 中 | 即时 |
| IM 内学习触点 | 企微/钉钉/飞书内的微学习与提醒机器人 | 中 | 中 | 1 季度 |
| 一线移动微课 | 手机端碎片化推送，覆盖一线/异地 | 中 | 高 | 1–2 季度 |

### 评估维度 (Evaluation)
| AI 切入点 | 说明 | Effort | Impact | Payback |
|-----------|------|--------|--------|---------|
| AI 自动阅卷/评分 | 主观题、开放题 AI 评分与反馈 | 低 | 中 | 即时 |
| 学习行为分析 | 完课/停留/薄弱点分析与预警 | 中 | 高 | 1 季度 |
| 柯氏 3 级行为评估 | AI 分析行为数据/绩效数据，做归因 | 高 | 高 | 2+ 季度 |
| 培训效果归因报告 | 自动生成 ROI 与效果报告 | 中 | 中 | 1–2 季度 |

### 技术维度 (Technology)
| AI 切入点 | 说明 | Effort | Impact | Payback |
|-----------|------|--------|--------|---------|
| LMS AI 助手 | 在现有 LMS 上叠加问答/推荐层 | 中 | 中 | 1 季度 |
| 数据打通与看板 | 学习数据 + 业务数据统一看板 | 高 | 高 | 2+ 季度 |
| 知识库 RAG 问答 | 企业知识库 AI 检索问答（随岗支持） | 中 | 高 | 1 季度 |

### 人员维度 (People)
| AI 切入点 | 说明 | Effort | Impact | Payback |
|-----------|------|--------|--------|---------|
| 个性化学习路径 | 按画像/岗位/短板生成千人千面路径 | 高 | 高 | 2+ 季度 |
| AI 学习助手/答疑 | 7×24 学员答疑与学习陪伴 | 中 | 中 | 1 季度 |
| 内训师 AI 助手 | 帮内训师快速备课、生成教案 | 低 | 中 | 即时 |

---

## Prioritization Method (排序方法)

### Impact × Feasibility 打分
For each candidate opportunity, score two axes 1–5:
- **Impact（影响）**: 对业务痛点的杠杆有多大（是否直击 TOP1 痛点，受益人数，可量化收益）
- **Feasibility（可行性）**: 落地容易度（复用现有数据/系统？effort 低？合规无障碍？季度内见效？）

**Priority Score = Impact × Feasibility**

Map to tiers:
- **P0 (Quick Win / 必做)**: Impact≥4 且 Feasibility≥4 —— 高杠杆且好落地，优先启动
- **P1 (重点投入)**: 高 Impact 但 Feasibility 中等，或需一定投入的战略项
- **P2 (后续规划)**: Impact 或 Feasibility 偏低，纳入长期路线

### Default field bias (经验偏好)
When scores tie, prefer opportunities that:
1. 直击用户自述的 TOP1 痛点
2. 复用已有数据/系统（不必先补基建）
3. 一个季度内能拿出可见成果（先建立发起人信心）

Present the result as a ranked table: 优先级 | AI 机会点 | 目标环节 | 预期收益 | Effort | 见效周期.

---

## ROI Estimation (预估 ROI 方法)

Estimate honestly with stated assumptions. Present a **conservative–optimistic band**, never a single inflated number.

### 成本 (Cost) 项
- 一次性：工具/平台采购或搭建、内容迁移、集成开发
- 经常性：订阅费、维护、内容更新工时
- 隐性：变革管理、培训 L&D 团队使用新工具的时间

### 收益 (Benefit) 项，尽量量化
- **降本**：讲师费/差旅/场地节省、L&D 事务性工时节省（如 AI 出题省下的备课工时 × 时薪）
- **提效**：完课率提升、培训周期缩短、新员工上手周期缩短（天数 × 人数 × 日成本）
- **增效**：业务指标改善（销售转化、合规通过率、故障率下降）—— 需与业务方共同估算

### 计算模板
```
年化净收益 = 年化收益 - 年化成本
ROI (%)   = 年化净收益 / 总投入 × 100%
回收周期  = 总投入 / 月均净收益
```

### 表达规范
- 每个数字都附假设（如"假设每年 200 场培训，每场备课省 3 小时"）
- 给保守 / 乐观两档区间
- 优先展示"季度内可验证"的 quick win ROI，建立信心后再谈大项目
