# Report Data Schema (报告数据结构)

Assemble Step 1–3 findings into a JSON file with this structure, then pass it to `scripts/generate_report.py`. All fields are optional except `company` and `date` — missing sections are skipped gracefully. Keep Chinese text in the values.

## Schema

```json
{
  "company": "企业名称（用于标题，必填）",
  "date": "YYYYMMDD（必填，用于文件名与页眉）",
  "industry": "行业",
  "scale": "规模描述，如 500-2000 人",
  "consultant": "诊断顾问/团队署名（可选）",
  "maturity_level": 3,
  "top_pain": "用户自述的 TOP1 痛点",
  "executive_summary": "一段话结论：现状定性 + 核心机会 + 建议动作",

  "dimensions": [
    {
      "name": "内容",
      "current_state": "现状摘要文字",
      "score": 3,
      "gap": "最大缺口一句话"
    }
  ],

  "opportunities": [
    {
      "priority": "P0",
      "name": "AI 辅助课件生成",
      "target": "课程开发环节",
      "benefit": "备课工时下降 60%",
      "effort": "低",
      "payback": "即时"
    }
  ],

  "roadmap": [
    {
      "phase": "第一阶段（0-3 月）Quick Win",
      "focus": "AI 出题 + 课件生成落地",
      "deliverables": ["自动题库上线", "3 门核心课 AI 重制"],
      "milestone": "备课工时下降 50%"
    }
  ],

  "roi": {
    "assumptions": ["每年 200 场培训", "每场备课省 3 小时", "L&D 时薪 100 元"],
    "cost": [
      {"item": "AI 工具年订阅", "amount": "5 万元/年"},
      {"item": "内容迁移一次性", "amount": "3 万元"}
    ],
    "benefit": [
      {"item": "备课工时节省", "amount": "18 万元/年"},
      {"item": "差旅/讲师费节省", "amount": "12 万元/年"}
    ],
    "summary": {
      "conservative": "年化净收益约 20 万元，ROI 约 250%，回收周期 <4 个月",
      "optimistic": "年化净收益约 30 万元，ROI 约 375%"
    }
  }
}
```

## Notes for filling
- `dimensions` should contain all five (内容/交付/评估/技术/人员) for a complete radar.
- `score` is 1–5 per the maturity anchors in `five-dimension-framework.md`.
- `opportunities` should be pre-sorted P0 → P2.
- Keep `benefit`/`amount` strings human-readable (include units).
- If a section's data is unknown, omit the key — do not fill placeholders.

## Worked example
A complete, ready-to-run example lives at `assets/example_data.json`. Use it to preview the report output or as a template to copy from.
