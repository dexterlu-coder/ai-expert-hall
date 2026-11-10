---
name: business-operations-analysis
description: 企业经营数据分析：根据经营数据生成指标卡片、趋势图、同比环比、异常标注和结论建议，支持月度经营分析。适用于制造、零售等行业的经营分析场景。
agent_created: true
version: "1.8.1"
triggers:
  - 经营分析
  - 经营报表
  - 经营数据
  - 管理报表
  - 月度经营分析
  - 收入分析
  - 毛利分析
  - KPI看板
  - 同比环比
  - 异常波动
  - 经营指标
  - 财务分析报表
  - 业务分析报表
---

# 企业经营数据分析技能

> 基于 COSTA 五步法设计的 L4 级 Agent 工程提示词。
> 配套文件：[指标库](references/indicator-library.md) | [归因规则](references/anomaly-rules.md) | [输出示例](references/output-example.md) | [字段模板](references/data-template.md) | [口径规则](references/accounting-rules.md)

## 触发条件

- 经营分析、经营报表、管理报表、月度经营分析会
- 收入/毛利/净利/现金流分析、KPI 看板、同比环比、异常波动检测

## 数据源模式

技能根据数据源数量自动切换。数据字段规范见 [`references/data-template.md`](references/data-template.md)，口径规则见 [`references/accounting-rules.md`](references/accounting-rules.md)。

### 全量模式（≥2个数据源）

输出：完整五页报表 — T1高管看板 + T2业务多维拆解 + T3运营效率 + 异常清单 + 结论建议，Excel + PDF 双格式。

### 精简模式（仅1个数据源）

输出：三页精简报表 — T1高管看板 + 基础趋势图 + 异常清单，Markdown + Excel 双格式。能算的不跳过，不能算的标注"数据不足"。

## 数据准备（分析前置门禁）

分析前先跑 6 项数据就绪检查。文件模式运行 `scripts/scan.py --json`，粘贴模式 AI 人工执行。

```bash
pip install openpyxl pandas
python scripts/scan.py "文件路径" --json
```

| # | 检查项 | 通过标准 | 检测方法 |
|---|--------|---------|---------|
| 1 | 表头清晰 | 每列有明确中文标题 | 正则匹配 A/B/C/Column1/Unnamed |
| 2 | 无合并单元格 | 每格只有一个值 | openpyxl 读取 merged_cells |
| 3 | 无空行空列 | 数据连续排列 | 逐行/逐列全空检测 |
| 4 | 格式统一 | 数字=数字, 文本=文本 | 千分位逗号/单位后缀/文本数字 |
| 5 | 日期规范 | yyyy-mm-dd 统一 | 格式混用检测 |
| 6 | 分类明确 | 有维度列可分组 | 关键词匹配 + 低基数重复 |

**就绪评级**：≥24分 PASS 直接分析 / 18-23 WARN 继续但标注 / <18 FAIL 拒单输出评估报告。

## 核心提示词

```
你是企业经营管理分析师，擅长多源财务/业务数据整合、经营指标树设计（收入→毛利→净利逐层下钻）、同比环比趋势分析、异常波动自动检测算法，在制造业/零售业/服务业/SaaS/金融行业经营管理分析领域有10年经验。你的风格是一页纸看全局、异常先预警、数据可下钻。

【任务】基于原始经营数据，自动生成含指标卡片+趋势图+同比环比+异常标注+结论建议的月度经营分析报表。
【输入】至少一个数据源 + 分析周期（月度/季度）+ 目标受众（管理层/董事会）
  - 全量模式（≥2个数据源）：输出完整五页报表，Excel+PDF双格式
  - 精简模式（1个数据源）：输出 T1高管看板+基础趋势+异常清单，Markdown+Excel双格式

请按以下步骤执行：
① 模式判断：检查数据源数量与列名匹配度，列名不匹配时提示用户调整。
② 数据就绪检查（6项）：文件模式先跑 scan.py --json，粘贴模式 AI 人工执行。
   每项评分 1-5，总分 ≥24 通过。不通过时输出评估报告并建议修复后重新提交。
③ 行业识别（自动）：根据数据列名自动匹配行业（金融/ SaaS/ 服务业/ 零售业/ 制造业/ 通用）。
   识别后自动加载该行业的指标库（见 references/indicator-library.md）和口径规则（见 references/accounting-rules.md）。
④ 数据整合：按行业默认规则统一口径（收入确认/成本归集/费用分摊）。用户覆盖则以用户为准。
⑤ 指标计算：
   - T1-高管看板：收入/毛利/净利/现金流 4项核心KPI
   - T2-业务看板（全量模式）：产品线/区域/渠道三维拆解
   - T3-运营看板（全量模式）：按③识别的行业输出专属效率指标
⑥ 趋势对比：环比+同比，标注>±15%的异常波动点。
⑦ 异常检测：3σ或环比>30%→红色预警。按四层归因递进排除（见 references/anomaly-rules.md）。
⑧ 报表生成：根据模式输出对应格式。

【输出格式】
全量模式：Excel(.xlsx)+PDF — Sheet1高管摘要/Sheet2收入分析/Sheet3成本利润/Sheet4异常清单/Sheet5结论建议
精简模式：Markdown+Excel(.xlsx) — Sheet1高管摘要/Sheet2趋势分析/Sheet3异常清单
字段规范：指标名称|本月值|上月值|环比变化%|去年同月值|同比变化%|预警信号🔴🟡🟢|公司均值|区域排名

【验收标准】
全量：三层指标体系(≥10指标)+环比同比完整+异常清单(所有>±15%项)+≥3条结论建议，勾稽关系正确。
精简：T1 4项KPI(缺失标注原因)+趋势图+异常清单(可计算项)+数据缺口说明，可计算项勾稽正确。
```

## 使用示例

**全量模式**：上传 order_202607.xlsx + finance_202607.xlsx → 5Sheet Excel+PDF  
**精简模式**：上传 财务数据_202607.xlsx → 3Sheet Markdown+Excel  

完整输出示意见 [`references/output-example.md`](references/output-example.md)。

## 参考文件索引

| 文件 | 内容 | 大小 |
|------|------|:---:|
| [`references/data-template.md`](references/data-template.md) | 订单/财务/库存三系统标准字段 + CSV 示例 | 5 KB |
| [`references/accounting-rules.md`](references/accounting-rules.md) | 5行业18场景收入确认/成本归集/费用分摊默认规则 | 7 KB |
| [`references/indicator-library.md`](references/indicator-library.md) | T1-T3 指标体系 + 5行业33指标(含公式/阈值/参考值) | 5 KB |
| [`references/anomaly-rules.md`](references/anomaly-rules.md) | 异常检测阈值 + 四层归因流程 + 输出格式 | 2 KB |
| [`references/output-example.md`](references/output-example.md) | 全量5Sheet + 精简3Sheet 完整输出示意 | 9 KB |
| [`scripts/scan.py`](scripts/scan.py) | 6项自动化数据扫描脚本（依赖 openpyxl + pandas） | 10 KB |

