# AI Learning Coach — Data Schemas Reference

This document defines the complete JSON schemas for all data structures used by the AI Learning Coach skill.

## plan.json

Stores plan-level metadata.

```json
{
  "plan_id": "golang",
  "title": "Go语言从入门到精通",
  "level": "beginner",
  "goal": "Master Go for backend development",
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-20T14:00:00Z",
  "last_session_at": "2025-01-20T14:00:00Z",
  "total_sessions": 12,
  "total_study_minutes": 360
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `plan_id` | string | yes | URL-safe slug identifier |
| `title` | string | yes | Human-readable plan title |
| `level` | enum | yes | One of: `beginner`, `intermediate`, `advanced` |
| `goal` | string | no | User's learning goal description |
| `created_at` | ISO 8601 | yes | Plan creation timestamp |
| `updated_at` | ISO 8601 | yes | Last modification timestamp |
| `last_session_at` | ISO 8601 | no | Last learning session timestamp |
| `total_sessions` | integer | yes | Number of completed sessions |
| `total_study_minutes` | integer | yes | Estimated total study time |

## knowledge_tree.json

Stores the hierarchical knowledge tree with all node states.

```json
{
  "plan_id": "golang",
  "version": 1,
  "updated_at": "2025-01-20T14:00:00Z",
  "nodes": [
    {
      "id": "node_001",
      "parent_id": null,
      "title": "Go 基础语法",
      "description": "Go语言的基本语法和数据类型",
      "depth": 0,
      "order": 1,
      "status": "mastered",
      "bloom_level": "remember",
      "mastery_score": 4.5,
      "consecutive_correct": 3,
      "consecutive_wrong": 0,
      "next_review_at": "2025-01-27T10:00:00Z",
      "last_reviewed_at": "2025-01-20T10:00:00Z",
      "attempts": 5,
      "total_score_sum": 22,
      "material_generated": false
    }
  ]
}
```

### Node Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique node identifier (e.g., `node_001`) |
| `parent_id` | string\|null | yes | Parent node ID, `null` for root nodes |
| `title` | string | yes | Node title |
| `description` | string | yes | Brief description of the concept |
| `depth` | integer | yes | Tree depth (0 = root chapter) |
| `order` | integer | yes | Display order among siblings |
| `status` | enum | yes | Node status (see State Machine below) |
| `bloom_level` | enum | yes | Cognitive level for questioning |
| `mastery_score` | float | yes | Average score across all attempts (0-5) |
| `consecutive_correct` | integer | yes | Streak of correct answers (score ≥ 4) |
| `consecutive_wrong` | integer | yes | Streak of wrong answers (score < 4) |
| `next_review_at` | ISO 8601\|null | yes | Next spaced repetition review time |
| `last_reviewed_at` | ISO 8601\|null | yes | Last assessment timestamp |
| `attempts` | integer | yes | Total number of assessment attempts |
| `total_score_sum` | float | yes | Sum of all scores (for average calculation) |
| `material_generated` | boolean | yes | Whether remediation material exists |

### Node Status State Machine

```
locked ──(previous sibling mastered)──→ learning
learning ──(score ≥ 4)──→ mastered
learning ──(score < 4)──→ learning (stay, trigger remediation)
mastered ──(review interval elapsed)──→ reviewing
reviewing ──(score ≥ 4)──→ mastered (extend interval)
reviewing ──(score < 4)──→ reviewing (reset interval)
```

Valid status values:
- `locked` — Not yet accessible
- `learning` — Currently being studied
- `mastered` — Successfully demonstrated understanding
- `reviewing` — Due for spaced repetition review

### Bloom Level Values

Ordered from lowest to highest cognitive demand:
1. `remember` — Recall facts and basic concepts
2. `understand` — Explain ideas, interpret meaning
3. `apply` — Use information in new situations
4. `analyze` — Draw connections, compare, debug
5. `create` — Design, build, produce new work

## scores.json

Stores the complete scoring history for analytics.

```json
{
  "plan_id": "golang",
  "records": [
    {
      "node_id": "node_003",
      "timestamp": "2025-01-20T14:30:00Z",
      "score": 4,
      "dimensions": {
        "correctness": 4,
        "completeness": 3,
        "depth": 4,
        "clarity": 5
      },
      "bloom_level": "understand",
      "question_summary": "Explain goroutines vs threads",
      "is_review": false,
      "session_id": "session_012"
    }
  ]
}
```

### Score Record Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `node_id` | string | yes | The assessed node |
| `timestamp` | ISO 8601 | yes | When the assessment occurred |
| `score` | integer | yes | Overall score 0-5 |
| `dimensions` | object | yes | Multi-dimensional scoring |
| `dimensions.correctness` | integer | yes | Factual accuracy (0-5) |
| `dimensions.completeness` | integer | yes | Coverage of key points (0-5) |
| `dimensions.depth` | integer | yes | Depth of understanding (0-5) |
| `dimensions.clarity` | integer | yes | Clarity of expression (0-5) |
| `bloom_level` | enum | yes | Bloom level of the question asked |
| `question_summary` | string | yes | Brief summary of the question |
| `is_review` | boolean | yes | Whether this was a spaced review |
| `session_id` | string | no | Session identifier for grouping |

## references.json

Stores the registry of user-uploaded reference materials.

```json
{
  "plan_id": "golang",
  "references": [
    {
      "id": "ref_001",
      "title": "The Go Programming Language (Donovan & Kernighan)",
      "source_type": "file",
      "source_path": "/Users/mike/books/go-programming-language.pdf",
      "stored_path": ".ai-coach/plans/golang/references/go-programming-language.md",
      "description": "Comprehensive Go textbook covering basics, types, functions, methods, interfaces, goroutines, channels, and testing.",
      "added_at": "2025-01-15T10:30:00Z",
      "word_count": 15000,
      "has_index": true
    },
    {
      "id": "ref_002",
      "title": "My Go Notes",
      "source_type": "pasted",
      "source_path": "",
      "stored_path": ".ai-coach/plans/golang/references/pasted_20250115.md",
      "description": "Personal notes about Go concurrency patterns and common pitfalls.",
      "added_at": "2025-01-16T09:00:00Z",
      "word_count": 800,
      "has_index": false
    }
  ]
}
```

### Reference Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique reference identifier (e.g., `ref_001`) |
| `title` | string | yes | Descriptive title for the material |
| `source_type` | enum | yes | One of: `file`, `directory`, `pasted`, `url` |
| `source_path` | string | yes | Original file path, directory path, or URL (empty for pasted) |
| `stored_path` | string | yes | Local path where the processed content is stored |
| `description` | string | yes | AI-generated brief summary of the material content |
| `added_at` | ISO 8601 | yes | When the reference was added |
| `word_count` | integer | yes | Approximate word count of the stored content |
| `has_index` | boolean | yes | Whether a section index has been generated (for large files) |

### Reference Content Index (for large materials)

For materials exceeding 5000 words, a content index file is created at the same location with `_index.json` suffix.

```json
{
  "ref_id": "ref_001",
  "stored_path": ".ai-coach/plans/golang/references/go-programming-language.md",
  "total_words": 15000,
  "total_sections": 12,
  "sections": [
    {
      "title": "Chapter 1: Tutorial",
      "start_line": 1,
      "end_line": 150,
      "word_count": 1200,
      "summary": "Hello World, command-line arguments, finding duplicate lines, animated GIFs, fetching URLs, concurrency.",
      "keywords": ["hello world", "command line", "fmt", "os.Args"],
      "related_nodes": ["node_001", "node_002"]
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `ref_id` | string | yes | Reference ID this index belongs to |
| `stored_path` | string | yes | Path to the full content file |
| `total_words` | integer | yes | Total word count |
| `total_sections` | integer | yes | Number of sections identified |
| `sections[].title` | string | yes | Section heading |
| `sections[].start_line` | integer | yes | Starting line number in the stored file |
| `sections[].end_line` | integer | yes | Ending line number |
| `sections[].word_count` | integer | yes | Word count of this section |
| `sections[].summary` | string | yes | Brief summary of section content |
| `sections[].keywords` | array | yes | Key terms for matching to knowledge nodes |
| `sections[].related_nodes` | array | yes | Knowledge tree node IDs this section maps to |

## config.json

Global configuration.

```json
{
  "version": 1,
  "default_language": "zh-CN",
  "review_notification": true,
  "difficulty_auto_adjust": true
}
```

## Spaced Repetition Interval Table

| consecutive_correct | Interval (days) |
|---|---|
| 0 (just failed) | 0.04 (≈1 hour) |
| 1 | 1 |
| 2 | 3 |
| 3 | 7 |
| 4 | 14 |
| 5 | 30 |
| 6+ | 60 |

Calculation formula: On review success, `next_review_at = now + interval_days[consecutive_correct]`.
On review failure, reset `consecutive_correct = 0` and `next_review_at = now + 1 hour`.
