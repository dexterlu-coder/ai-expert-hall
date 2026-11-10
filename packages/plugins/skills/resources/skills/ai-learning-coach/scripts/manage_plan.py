#!/usr/bin/env python3
"""
AI Learning Coach — Plan Management Script

Handles all data persistence operations for learning plans.
All data is stored as JSON files in the .ai-coach/ directory.

Usage:
    python3 manage_plan.py <command> [options]

Commands:
    init            Initialize a new learning plan
    update-tree     Save/update the knowledge tree
    update-node     Update a specific node's status
    record-score    Record an assessment score
    progress        Show current learning progress
    review-check    Check for nodes due for review
    report          Generate a detailed progress report
    session-start   Begin a new learning session (read session log + state)
    session-end     End a learning session (write session log + persist state)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

# Spaced repetition intervals (in days) indexed by consecutive_correct count
REVIEW_INTERVALS = {
    0: 0.04,   # ~1 hour (just failed)
    1: 1,
    2: 3,
    3: 7,
    4: 14,
    5: 30,
}
DEFAULT_INTERVAL = 60  # 6+ consecutive correct


def get_plan_dir(base_dir, plan_id):
    """Get the directory path for a plan."""
    return os.path.join(base_dir, "plans", plan_id)


def ensure_dir(path):
    """Create directory if it does not exist."""
    os.makedirs(path, exist_ok=True)


def load_json(filepath, default=None):
    """Load JSON file, return default if not found."""
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return default if default is not None else {}


def save_json(filepath, data):
    """Save data to JSON file with pretty printing."""
    ensure_dir(os.path.dirname(filepath))
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def now_iso():
    """Get current time as ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


# ──────────────────────────────────────────────
# Command: init
# ──────────────────────────────────────────────
def cmd_init(args):
    """Initialize a new learning plan."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)

    if os.path.exists(os.path.join(plan_dir, "plan.json")):
        print(f"⚠️  Plan '{args.plan_id}' already exists at {plan_dir}")
        print(json.dumps(load_json(os.path.join(plan_dir, "plan.json")), ensure_ascii=False, indent=2))
        return

    plan = {
        "plan_id": args.plan_id,
        "title": args.title,
        "level": args.level,
        "goal": args.goal or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "last_session_at": None,
        "total_sessions": 0,
        "total_study_minutes": 0,
    }

    save_json(os.path.join(plan_dir, "plan.json"), plan)
    save_json(os.path.join(plan_dir, "knowledge_tree.json"), {
        "plan_id": args.plan_id,
        "version": 1,
        "updated_at": now_iso(),
        "nodes": [],
    })
    save_json(os.path.join(plan_dir, "scores.json"), {
        "plan_id": args.plan_id,
        "records": [],
    })
    save_json(os.path.join(plan_dir, "references.json"), {
        "plan_id": args.plan_id,
        "references": [],
    })
    ensure_dir(os.path.join(plan_dir, "materials"))
    ensure_dir(os.path.join(plan_dir, "references"))

    print(f"✅ Plan '{args.plan_id}' initialized at {plan_dir}")
    print(json.dumps(plan, ensure_ascii=False, indent=2))


# ──────────────────────────────────────────────
# Command: update-tree
# ──────────────────────────────────────────────
def cmd_update_tree(args):
    """Save or update the knowledge tree."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    tree_path = os.path.join(plan_dir, "knowledge_tree.json")

    if args.tree_file:
        with open(args.tree_file, "r", encoding="utf-8") as f:
            tree_data = json.load(f)
    elif args.tree:
        tree_data = json.loads(args.tree)
    else:
        print("❌ Error: provide --tree (JSON string) or --tree-file (path)")
        sys.exit(1)

    # If raw nodes array is passed, wrap it
    if isinstance(tree_data, list):
        tree_data = {
            "plan_id": args.plan_id,
            "version": 1,
            "updated_at": now_iso(),
            "nodes": tree_data,
        }
    else:
        tree_data["updated_at"] = now_iso()

    save_json(tree_path, tree_data)
    node_count = len(tree_data.get("nodes", []))
    print(f"✅ Knowledge tree saved with {node_count} nodes")


# ──────────────────────────────────────────────
# Command: update-node
# ──────────────────────────────────────────────
def cmd_update_node(args):
    """Update a node's status and optionally unlock the next node."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    tree_path = os.path.join(plan_dir, "knowledge_tree.json")
    tree = load_json(tree_path)

    if not tree or "nodes" not in tree:
        print("❌ Knowledge tree not found")
        sys.exit(1)

    nodes = tree["nodes"]
    target = None
    for node in nodes:
        if node["id"] == args.node_id:
            target = node
            break

    if not target:
        print(f"❌ Node '{args.node_id}' not found")
        sys.exit(1)

    old_status = target["status"]
    target["status"] = args.status
    target["last_reviewed_at"] = now_iso()

    # If mastered, calculate next review time and unlock next sibling
    if args.status == "mastered":
        cc = target.get("consecutive_correct", 0)
        interval = REVIEW_INTERVALS.get(cc, DEFAULT_INTERVAL)
        target["next_review_at"] = (
            datetime.now(timezone.utc) + timedelta(days=interval)
        ).isoformat()

        # Unlock next sibling
        parent_id = target.get("parent_id")
        siblings = sorted(
            [n for n in nodes if n.get("parent_id") == parent_id],
            key=lambda n: n.get("order", 0),
        )
        found_current = False
        for sib in siblings:
            if sib["id"] == args.node_id:
                found_current = True
                continue
            if found_current and sib["status"] == "locked":
                sib["status"] = "learning"
                print(f"🔓 Unlocked next node: {sib['title']}")
                break

    tree["updated_at"] = now_iso()
    save_json(tree_path, tree)
    print(f"✅ Node '{target['title']}' status: {old_status} → {args.status}")


# ──────────────────────────────────────────────
# Command: record-score
# ──────────────────────────────────────────────
def cmd_record_score(args):
    """Record an assessment score for a node."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)

    # Update scores.json
    scores_path = os.path.join(plan_dir, "scores.json")
    scores = load_json(scores_path, {"plan_id": args.plan_id, "records": []})

    record = {
        "node_id": args.node_id,
        "timestamp": now_iso(),
        "score": args.score,
        "bloom_level": args.bloom_level or "remember",
        "question_summary": args.question or "",
        "is_review": args.is_review,
    }
    scores["records"].append(record)
    save_json(scores_path, scores)

    # Update node in knowledge tree
    tree_path = os.path.join(plan_dir, "knowledge_tree.json")
    tree = load_json(tree_path)
    if tree and "nodes" in tree:
        for node in tree["nodes"]:
            if node["id"] == args.node_id:
                node["attempts"] = node.get("attempts", 0) + 1
                node["total_score_sum"] = node.get("total_score_sum", 0) + args.score
                node["mastery_score"] = round(
                    node["total_score_sum"] / node["attempts"], 2
                )
                node["last_reviewed_at"] = now_iso()

                if args.score >= 4:
                    node["consecutive_correct"] = node.get("consecutive_correct", 0) + 1
                    node["consecutive_wrong"] = 0
                else:
                    node["consecutive_wrong"] = node.get("consecutive_wrong", 0) + 1
                    node["consecutive_correct"] = 0

                # Update review schedule
                cc = node["consecutive_correct"]
                interval = REVIEW_INTERVALS.get(cc, DEFAULT_INTERVAL)
                node["next_review_at"] = (
                    datetime.now(timezone.utc) + timedelta(days=interval)
                ).isoformat()

                break
        tree["updated_at"] = now_iso()
        save_json(tree_path, tree)

    print(f"✅ Score {args.score}/5 recorded for node '{args.node_id}'")


# ──────────────────────────────────────────────
# Command: progress
# ──────────────────────────────────────────────
def cmd_progress(args):
    """Show current learning progress."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    plan = load_json(os.path.join(plan_dir, "plan.json"))
    tree = load_json(os.path.join(plan_dir, "knowledge_tree.json"))

    if not plan:
        print(f"❌ Plan '{args.plan_id}' not found")
        sys.exit(1)

    nodes = tree.get("nodes", [])
    total = len(nodes)
    mastered = sum(1 for n in nodes if n["status"] == "mastered")
    learning = sum(1 for n in nodes if n["status"] == "learning")
    reviewing = sum(1 for n in nodes if n["status"] == "reviewing")
    locked = sum(1 for n in nodes if n["status"] == "locked")

    # Find current active node
    active_node = None
    for n in nodes:
        if n["status"] == "learning":
            active_node = n
            break

    progress_pct = round(mastered / total * 100, 1) if total > 0 else 0

    result = {
        "plan": plan,
        "stats": {
            "total": total,
            "mastered": mastered,
            "learning": learning,
            "reviewing": reviewing,
            "locked": locked,
            "progress_percent": progress_pct,
        },
        "active_node": active_node,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


# ──────────────────────────────────────────────
# Command: review-check
# ──────────────────────────────────────────────
def cmd_review_check(args):
    """Check for nodes that are due for spaced repetition review."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    tree = load_json(os.path.join(plan_dir, "knowledge_tree.json"))

    if not tree or "nodes" not in tree:
        print("❌ Knowledge tree not found")
        sys.exit(1)

    now = datetime.now(timezone.utc)
    due_nodes = []

    for node in tree["nodes"]:
        if node["status"] in ("mastered", "reviewing") and node.get("next_review_at"):
            review_time = datetime.fromisoformat(node["next_review_at"])
            # Handle naive datetimes
            if review_time.tzinfo is None:
                review_time = review_time.replace(tzinfo=timezone.utc)
            if review_time <= now:
                due_nodes.append({
                    "id": node["id"],
                    "title": node["title"],
                    "status": node["status"],
                    "next_review_at": node["next_review_at"],
                    "consecutive_correct": node.get("consecutive_correct", 0),
                    "mastery_score": node.get("mastery_score", 0),
                })

    # Also transition mastered nodes to reviewing if they're due
    if due_nodes:
        updated = False
        for node in tree["nodes"]:
            for due in due_nodes:
                if node["id"] == due["id"] and node["status"] == "mastered":
                    node["status"] = "reviewing"
                    updated = True
        if updated:
            tree["updated_at"] = now_iso()
            save_json(os.path.join(plan_dir, "knowledge_tree.json"), tree)

    result = {
        "due_count": len(due_nodes),
        "due_nodes": due_nodes,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


# ──────────────────────────────────────────────
# Command: add-reference
# ──────────────────────────────────────────────
def cmd_add_reference(args):
    """Register a user-uploaded reference material."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    refs_path = os.path.join(plan_dir, "references.json")
    refs = load_json(refs_path, {"plan_id": args.plan_id, "references": []})

    # Generate reference ID
    existing_ids = [r["id"] for r in refs["references"]]
    ref_num = len(existing_ids) + 1
    ref_id = f"ref_{ref_num:03d}"
    while ref_id in existing_ids:
        ref_num += 1
        ref_id = f"ref_{ref_num:03d}"

    # Ensure references directory exists
    refs_dir = os.path.join(plan_dir, "references")
    ensure_dir(refs_dir)

    reference = {
        "id": ref_id,
        "title": args.title,
        "source_type": args.source_type,
        "source_path": args.source_path or "",
        "stored_path": args.stored_path or "",
        "description": args.description or "",
        "added_at": now_iso(),
        "word_count": 0,
        "has_index": False,
    }

    # Try to count words in stored file
    if args.stored_path and os.path.exists(args.stored_path):
        try:
            with open(args.stored_path, "r", encoding="utf-8") as f:
                content = f.read()
                reference["word_count"] = len(content.split())
        except Exception:
            pass

    refs["references"].append(reference)
    save_json(refs_path, refs)

    print(f"✅ Reference '{args.title}' registered as {ref_id}")
    print(json.dumps(reference, ensure_ascii=False, indent=2))


# ──────────────────────────────────────────────
# Command: list-references
# ──────────────────────────────────────────────
def cmd_list_references(args):
    """List all reference materials for a plan."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    refs_path = os.path.join(plan_dir, "references.json")
    refs = load_json(refs_path, {"plan_id": args.plan_id, "references": []})

    ref_list = refs.get("references", [])
    if not ref_list:
        print(json.dumps({"count": 0, "references": [], "message": "No reference materials uploaded yet"}, ensure_ascii=False, indent=2))
        return

    result = {
        "count": len(ref_list),
        "references": [
            {
                "id": r["id"],
                "title": r["title"],
                "source_type": r["source_type"],
                "stored_path": r["stored_path"],
                "description": r.get("description", ""),
                "word_count": r.get("word_count", 0),
                "added_at": r["added_at"],
            }
            for r in ref_list
        ],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


# ──────────────────────────────────────────────
# Command: report
# ──────────────────────────────────────────────
def cmd_report(args):
    """Generate a detailed progress report."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    plan = load_json(os.path.join(plan_dir, "plan.json"))
    tree = load_json(os.path.join(plan_dir, "knowledge_tree.json"))
    scores = load_json(os.path.join(plan_dir, "scores.json"), {"records": []})

    if not plan:
        print(f"❌ Plan '{args.plan_id}' not found")
        sys.exit(1)

    nodes = tree.get("nodes", [])
    total = len(nodes)
    mastered = sum(1 for n in nodes if n["status"] == "mastered")
    learning = sum(1 for n in nodes if n["status"] == "learning")
    reviewing = sum(1 for n in nodes if n["status"] == "reviewing")
    locked = sum(1 for n in nodes if n["status"] == "locked")

    # Recent scores
    records = scores.get("records", [])
    recent_scores = [r["score"] for r in records[-10:]] if records else []
    avg_score = round(sum(recent_scores) / len(recent_scores), 2) if recent_scores else 0

    # Weak nodes (lowest mastery scores)
    weak_nodes = sorted(
        [n for n in nodes if n.get("attempts", 0) > 0 and n.get("mastery_score", 5) < 4],
        key=lambda n: n.get("mastery_score", 0),
    )[:5]

    # Review check
    now = datetime.now(timezone.utc)
    due_reviews = []
    for node in nodes:
        if node.get("next_review_at"):
            review_time = datetime.fromisoformat(node["next_review_at"])
            if review_time.tzinfo is None:
                review_time = review_time.replace(tzinfo=timezone.utc)
            if review_time <= now:
                due_reviews.append(node)

    # Build tree visualization
    tree_viz = build_tree_visualization(nodes)

    report = {
        "plan": {
            "title": plan.get("title", args.plan_id),
            "level": plan.get("level", "unknown"),
            "created_at": plan.get("created_at", "unknown"),
            "total_sessions": plan.get("total_sessions", 0),
        },
        "stats": {
            "total_nodes": total,
            "mastered": mastered,
            "learning": learning,
            "reviewing": reviewing,
            "locked": locked,
            "progress_percent": round(mastered / total * 100, 1) if total > 0 else 0,
        },
        "recent_performance": {
            "last_10_scores": recent_scores,
            "average_score": avg_score,
            "total_assessments": len(records),
        },
        "weak_nodes": [
            {"id": n["id"], "title": n["title"], "mastery_score": n.get("mastery_score", 0)}
            for n in weak_nodes
        ],
        "due_reviews": [
            {"id": n["id"], "title": n["title"]}
            for n in due_reviews
        ],
        "tree_visualization": tree_viz,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


# ──────────────────────────────────────────────
# Command: session-start
# ──────────────────────────────────────────────
def cmd_session_start(args):
    """Begin a new learning session: read session log + state for resumption."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    plan = load_json(os.path.join(plan_dir, "plan.json"))

    if not plan:
        print(f"❌ Plan '{args.plan_id}' not found")
        sys.exit(1)

    # Load session log
    session_log_path = os.path.join(plan_dir, "session-log.md")
    session_log_content = ""
    if os.path.exists(session_log_path):
        with open(session_log_path, "r", encoding="utf-8") as f:
            session_log_content = f.read()

    # Load knowledge tree for current state
    tree = load_json(os.path.join(plan_dir, "knowledge_tree.json"))
    nodes = tree.get("nodes", []) if tree else []

    total = len(nodes)
    mastered = sum(1 for n in nodes if n["status"] == "mastered")
    learning = [n for n in nodes if n["status"] == "learning"]
    reviewing = [n for n in nodes if n["status"] == "reviewing"]

    # Check due reviews
    now = datetime.now(timezone.utc)
    due_reviews = []
    for node in nodes:
        if node.get("next_review_at") and node["status"] in ("mastered", "reviewing"):
            review_time = datetime.fromisoformat(node["next_review_at"])
            if review_time.tzinfo is None:
                review_time = review_time.replace(tzinfo=timezone.utc)
            if review_time <= now:
                due_reviews.append({
                    "id": node["id"],
                    "title": node["title"],
                    "bloom_level": node.get("bloom_level", "remember"),
                })

    # Recent scores (last 5)
    scores = load_json(os.path.join(plan_dir, "scores.json"), {"records": []})
    recent = scores.get("records", [])[-5:]

    # Increment session count
    plan["total_sessions"] = plan.get("total_sessions", 0) + 1
    plan["last_session_at"] = now_iso()
    plan["updated_at"] = now_iso()
    save_json(os.path.join(plan_dir, "plan.json"), plan)

    result = {
        "session_number": plan["total_sessions"],
        "plan_title": plan.get("title", args.plan_id),
        "progress_percent": round(mastered / total * 100, 1) if total > 0 else 0,
        "mastered_count": mastered,
        "total_nodes": total,
        "active_nodes": [{"id": n["id"], "title": n["title"], "bloom_level": n.get("bloom_level", "remember")} for n in learning],
        "due_reviews": due_reviews,
        "recent_scores": [{"node_id": r["node_id"], "score": r["score"]} for r in recent],
        "session_log_tail": _tail_lines(session_log_content, 30),
        "has_session_log": bool(session_log_content.strip()),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


def _tail_lines(text, n):
    """Return the last n lines of text."""
    lines = text.strip().split("\n") if text.strip() else []
    return "\n".join(lines[-n:]) if lines else ""


# ──────────────────────────────────────────────
# Command: session-end
# ──────────────────────────────────────────────
def cmd_session_end(args):
    """End a learning session: append to session log and persist state."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    plan = load_json(os.path.join(plan_dir, "plan.json"))

    if not plan:
        print(f"❌ Plan '{args.plan_id}' not found")
        sys.exit(1)

    session_log_path = os.path.join(plan_dir, "session-log.md")

    # Build session entry
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    session_num = plan.get("total_sessions", 0)

    entry_lines = [
        f"\n## Session #{session_num} — {now_str}\n",
    ]

    if args.nodes_studied:
        entry_lines.append(f"**Nodes studied**: {args.nodes_studied}")
    if args.nodes_mastered:
        entry_lines.append(f"**Nodes mastered**: {args.nodes_mastered}")
    if args.reviews_done:
        entry_lines.append(f"**Reviews completed**: {args.reviews_done}")
    if args.summary:
        entry_lines.append(f"**Summary**: {args.summary}")
    if args.next_step:
        entry_lines.append(f"**Next step**: {args.next_step}")
    if args.blockers:
        entry_lines.append(f"**Blockers**: {args.blockers}")

    entry_lines.append("")  # blank line at end

    entry = "\n".join(entry_lines)

    # Append to session log (create if not exists)
    if not os.path.exists(session_log_path):
        header = f"# Session Log — {plan.get('title', args.plan_id)}\n\n"
        header += "This file records what happened in each learning session for cross-session continuity.\n"
        with open(session_log_path, "w", encoding="utf-8") as f:
            f.write(header)

    with open(session_log_path, "a", encoding="utf-8") as f:
        f.write(entry)

    # Update plan metadata
    plan["updated_at"] = now_iso()
    if args.minutes:
        plan["total_study_minutes"] = plan.get("total_study_minutes", 0) + int(args.minutes)
    save_json(os.path.join(plan_dir, "plan.json"), plan)

    print(f"✅ Session #{session_num} logged for plan '{args.plan_id}'")
    print(f"📝 Session log updated at: {session_log_path}")


# ──────────────────────────────────────────────
# Command: session-log
# ──────────────────────────────────────────────
def cmd_session_log(args):
    """Read the session log for a plan."""
    plan_dir = get_plan_dir(args.base_dir, args.plan_id)
    session_log_path = os.path.join(plan_dir, "session-log.md")

    if not os.path.exists(session_log_path):
        print(json.dumps({"has_log": False, "message": "No session log yet. This is the first session."}, ensure_ascii=False, indent=2))
        return

    with open(session_log_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Return last N lines if specified
    if args.tail:
        lines = content.strip().split("\n")
        content = "\n".join(lines[-args.tail:])

    print(json.dumps({
        "has_log": True,
        "path": session_log_path,
        "content": content,
    }, ensure_ascii=False, indent=2))


def build_tree_visualization(nodes):
    """Build an ASCII tree visualization."""
    if not nodes:
        return "(empty)"

    lines = []
    # Build parent-children map
    children_map = {}
    for node in nodes:
        pid = node.get("parent_id")
        if pid not in children_map:
            children_map[pid] = []
        children_map[pid].append(node)

    # Sort children by order
    for pid in children_map:
        children_map[pid].sort(key=lambda n: n.get("order", 0))

    status_icons = {
        "locked": "🔒",
        "learning": "📖",
        "mastered": "✅",
        "reviewing": "🔄",
    }

    def render_node(node, prefix="", is_last=True):
        connector = "└── " if is_last else "├── "
        icon = status_icons.get(node["status"], "❓")
        score_str = f" ({node.get('mastery_score', 0):.1f}/5)" if node.get("attempts", 0) > 0 else ""
        lines.append(f"{prefix}{connector}{icon} {node['title']}{score_str}")

        child_nodes = children_map.get(node["id"], [])
        for i, child in enumerate(child_nodes):
            child_prefix = prefix + ("    " if is_last else "│   ")
            render_node(child, child_prefix, i == len(child_nodes) - 1)

    roots = children_map.get(None, [])
    for i, root in enumerate(roots):
        render_node(root, "", i == len(roots) - 1)

    return "\n".join(lines)


# ──────────────────────────────────────────────
# CLI Argument Parser
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="AI Learning Coach — Plan Manager")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Common arguments added to each subparser for flexibility
    def add_common_args(subparser):
        subparser.add_argument("--base-dir", default=".ai-coach", help="Base data directory")

    # init
    p_init = subparsers.add_parser("init", help="Initialize a new plan")
    add_common_args(p_init)
    p_init.add_argument("--plan-id", required=True, help="Plan identifier slug")
    p_init.add_argument("--title", required=True, help="Plan title")
    p_init.add_argument("--level", default="beginner", choices=["beginner", "intermediate", "advanced"])
    p_init.add_argument("--goal", default="", help="Learning goal")

    # update-tree
    p_tree = subparsers.add_parser("update-tree", help="Save/update knowledge tree")
    add_common_args(p_tree)
    p_tree.add_argument("--plan-id", required=True)
    p_tree.add_argument("--tree", default=None, help="JSON string of tree data")
    p_tree.add_argument("--tree-file", default=None, help="Path to tree JSON file")

    # update-node
    p_node = subparsers.add_parser("update-node", help="Update a node's status")
    add_common_args(p_node)
    p_node.add_argument("--plan-id", required=True)
    p_node.add_argument("--node-id", required=True)
    p_node.add_argument("--status", required=True, choices=["locked", "learning", "mastered", "reviewing"])

    # record-score
    p_score = subparsers.add_parser("record-score", help="Record assessment score")
    add_common_args(p_score)
    p_score.add_argument("--plan-id", required=True)
    p_score.add_argument("--node-id", required=True)
    p_score.add_argument("--score", required=True, type=int, choices=range(0, 6))
    p_score.add_argument("--bloom-level", default="remember")
    p_score.add_argument("--question", default="")
    p_score.add_argument("--is-review", action="store_true")

    # progress
    p_prog = subparsers.add_parser("progress", help="Show progress")
    add_common_args(p_prog)
    p_prog.add_argument("--plan-id", required=True)

    # review-check
    p_review = subparsers.add_parser("review-check", help="Check due reviews")
    add_common_args(p_review)
    p_review.add_argument("--plan-id", required=True)

    # report
    p_report = subparsers.add_parser("report", help="Generate report")
    add_common_args(p_report)
    p_report.add_argument("--plan-id", required=True)

    # add-reference
    p_addref = subparsers.add_parser("add-reference", help="Register a reference material")
    add_common_args(p_addref)
    p_addref.add_argument("--plan-id", required=True)
    p_addref.add_argument("--title", required=True, help="Descriptive title for the material")
    p_addref.add_argument("--source-type", required=True, choices=["file", "directory", "pasted", "url"])
    p_addref.add_argument("--source-path", default="", help="Original file path or URL")
    p_addref.add_argument("--stored-path", default="", help="Path where content is stored locally")
    p_addref.add_argument("--description", default="", help="Brief summary of the material")

    # list-references
    p_listref = subparsers.add_parser("list-references", help="List reference materials")
    add_common_args(p_listref)
    p_listref.add_argument("--plan-id", required=True)

    # session-start
    p_sstart = subparsers.add_parser("session-start", help="Begin a new learning session")
    add_common_args(p_sstart)
    p_sstart.add_argument("--plan-id", required=True)

    # session-end
    p_send = subparsers.add_parser("session-end", help="End a learning session")
    add_common_args(p_send)
    p_send.add_argument("--plan-id", required=True)
    p_send.add_argument("--nodes-studied", default="", help="Nodes studied this session")
    p_send.add_argument("--nodes-mastered", default="", help="Nodes mastered this session")
    p_send.add_argument("--reviews-done", default="", help="Reviews completed this session")
    p_send.add_argument("--summary", default="", help="Session summary")
    p_send.add_argument("--next-step", default="", help="Recommended next step")
    p_send.add_argument("--blockers", default="", help="Any blockers encountered")
    p_send.add_argument("--minutes", default=0, type=int, help="Estimated study minutes")

    # session-log
    p_slog = subparsers.add_parser("session-log", help="Read session log")
    add_common_args(p_slog)
    p_slog.add_argument("--plan-id", required=True)
    p_slog.add_argument("--tail", type=int, default=0, help="Show only last N lines")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "init": cmd_init,
        "update-tree": cmd_update_tree,
        "update-node": cmd_update_node,
        "record-score": cmd_record_score,
        "progress": cmd_progress,
        "review-check": cmd_review_check,
        "report": cmd_report,
        "add-reference": cmd_add_reference,
        "list-references": cmd_list_references,
        "session-start": cmd_session_start,
        "session-end": cmd_session_end,
        "session-log": cmd_session_log,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
