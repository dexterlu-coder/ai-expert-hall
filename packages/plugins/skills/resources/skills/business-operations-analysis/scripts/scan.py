#!/usr/bin/env python3
"""
数据就绪扫描脚本 — business-operations-analysis 前置门禁

功能：对用户上传的 Excel/CSV 文件执行 6 项自动化检查，
      输出 JSON 报告供 AI 读取并生成就绪评估。

用法：
    python scan.py <文件路径> [--json]
    python scan.py "C:\数据\财务数据.xlsx" --json

依赖：pip install openpyxl pandas
"""

import sys
import json
import os
import re
from datetime import datetime


def check_headers(df, file_path):
    """检查1: 表头清晰 — 每列有明确的中文标题"""
    columns = list(df.columns)
    bad_patterns = [
        r'^[A-Za-z]$',           # A, B, C
        r'^Column\d+$',          # Column1
        r'^Unnamed',             # Unnamed: 0
        r'^\d+$',                # 纯数字
    ]
    issues = []
    bad_count = 0
    for i, col in enumerate(columns):
        col_str = str(col)
        if any(re.match(p, col_str, re.IGNORECASE) for p in bad_patterns):
            issues.append(f"第{i+1}列表头为'{col_str}'，缺乏业务含义")
            bad_count += 1
    
    good_count = len(columns) - bad_count
    total = len(columns)
    ratio = good_count / total if total > 0 else 0
    
    if ratio >= 0.9:
        status = "PASS"
        score = 5
    elif ratio >= 0.7:
        status = "WARN"
        score = 3
    else:
        status = "FAIL"
        score = 1
    
    return {
        "check": "表头清晰",
        "status": status,
        "score": score,
        "total_columns": total,
        "bad_columns": bad_count,
        "issues": issues,
        "message": f"{good_count}/{total} 列表头清晰" + (f"，{bad_count}列需修复" if bad_count else "")
    }


def check_merged_cells(file_path, df):
    """检查2: 无合并单元格"""
    issues = []
    merged_count = 0
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ('.xlsx', '.xlsm'):
        try:
            from openpyxl import load_workbook
            wb = load_workbook(file_path, data_only=True)
            ws = wb.active
            merged = ws.merged_cells.ranges
            merged_count = len(merged)
            if merged_count > 0:
                sample = list(merged)[:3]
                issues.append(f"发现 {merged_count} 个合并单元格区域（如 {', '.join(str(m) for m in sample)}）")
            wb.close()
        except Exception as e:
            issues.append(f"无法读取合并单元格信息: {str(e)}")
            merged_count = -1
    elif ext == '.csv':
        # CSV 不支持合并单元格，跳过
        pass
    else:
        issues.append(f"不支持的文件格式: {ext}")
        merged_count = -1
    
    if merged_count == 0:
        status = "PASS"
        score = 5
    elif merged_count < 0:
        status = "WARN"
        score = 3
    elif merged_count <= 2:
        status = "WARN"
        score = 3
    else:
        status = "FAIL"
        score = 1
    
    return {
        "check": "无合并单元格",
        "status": status,
        "score": score,
        "merged_cells": merged_count if merged_count >= 0 else "unknown",
        "issues": issues,
        "message": f"合并单元格: {merged_count} 个" if merged_count >= 0 else "无法检测"
    }


def check_empty_rows_cols(df):
    """检查3: 无空行空列"""
    issues = []
    
    # 空行
    empty_rows = df.isna().all(axis=1).sum()
    # 空列
    empty_cols = df.isna().all(axis=0).sum()
    
    if empty_rows > 0:
        issues.append(f"{empty_rows} 行全为空")
    if empty_cols > 0:
        empty_col_names = [str(c) for c in df.columns[df.isna().all(axis=0)]]
        issues.append(f"{empty_cols} 列全为空: {', '.join(empty_col_names)}")
    
    total_issues = empty_rows + empty_cols
    if total_issues == 0:
        status = "PASS"
        score = 5
    elif total_issues <= 3:
        status = "WARN"
        score = 4
    elif total_issues <= 10:
        status = "WARN"
        score = 3
    else:
        status = "FAIL"
        score = 1
    
    return {
        "check": "无空行空列",
        "status": status,
        "score": score,
        "empty_rows": int(empty_rows),
        "empty_cols": int(empty_cols),
        "issues": issues,
        "message": f"空行: {empty_rows}, 空列: {empty_cols}"
    }


def check_format_consistency(df):
    """检查4: 格式统一 — 数字=数字, 文本=文本"""
    issues = []
    bad_cols = []
    
    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) == 0:
            continue
        
        # Check for mixed types
        sample = col_data.head(100)
        types = set(type(v).__name__ for v in sample)
        
        # Check for number-as-text patterns
        text_with_number = 0
        text_with_unit = 0
        text_with_comma = 0
        
        for v in sample:
            s = str(v).strip()
            # Numbers stored as text with comma (1,234)
            if re.match(r'^\d{1,3}(,\d{3})+$', s):
                text_with_comma += 1
            # Numbers with unit suffix (5000万, 120元, 35%)
            elif re.match(r'^\d+(\.\d+)?[万亿元%只件个]$', s):
                text_with_unit += 1
                text_with_number += 1
            # Plain numbers stored as text
            elif re.match(r'^\d+(\.\d+)?$', s) and not isinstance(v, (int, float)):
                text_with_number += 1
        
        col_issues = []
        if len(types) > 2:
            col_issues.append(f"列'{col}'数据类型混用: {', '.join(types)}")
        if text_with_comma > 0:
            col_issues.append(f"列'{col}'有{text_with_comma}个含千分位逗号的文本数字（如1,234）")
        if text_with_unit > 0:
            col_issues.append(f"列'{col}'有{text_with_unit}个含单位后缀的值（如5000万）")
        if text_with_number > 0 and text_with_unit == 0:
            col_issues.append(f"列'{col}'有{text_with_number}个数字存为文本格式")
        
        if col_issues:
            issues.extend(col_issues)
            bad_cols.append(str(col))
    
    good_ratio = 1 - (len(bad_cols) / max(len(df.columns), 1))
    
    if good_ratio >= 0.9:
        status = "PASS"
        score = 5
    elif good_ratio >= 0.7:
        status = "WARN"
        score = 3
    else:
        status = "FAIL"
        score = 1
    
    return {
        "check": "格式统一",
        "status": status,
        "score": score,
        "bad_columns": bad_cols,
        "issues": issues,
        "message": f"{len(bad_cols)} 列存在格式问题" if bad_cols else "所有列格式统一"
    }


def check_date_format(df):
    """检查5: 日期规范 — yyyy-mm-dd 或统一格式"""
    issues = []
    date_cols_found = []
    bad_date_cols = []
    
    date_keywords = {'日期', '时间', 'date', 'time', '月份', '月份', '期间', 'period'}
    
    for col in df.columns:
        col_lower = str(col).lower()
        is_likely_date = any(kw in col_lower for kw in date_keywords)
        
        if not is_likely_date:
            continue
        
        date_cols_found.append(str(col))
        sample = df[col].dropna().head(20)
        if len(sample) == 0:
            continue
        
        formats = set()
        for v in sample:
            s = str(v).strip()
            if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
                formats.add('YYYY-MM-DD')
            elif re.match(r'^\d{4}/\d{1,2}/\d{1,2}$', s):
                formats.add('YYYY/M/D')
            elif re.match(r'^\d{4}\d{2}$', s):
                formats.add('YYYYMM')
            elif re.match(r'^\d{4}-\d{2}$', s):
                formats.add('YYYY-MM')
            elif re.match(r'\d+月\d+[日号]', s):
                formats.add('中文日期')
            elif re.match(r'^\d{4}\d{2}\d{2}$', s):
                formats.add('YYYYMMDD')
            else:
                formats.add(f'其他: {s}')
        
        if len(formats) > 1:
            issues.append(f"日期列'{col}'格式混用: {', '.join(formats)}")
            bad_date_cols.append(str(col))
        elif '中文日期' in str(formats) or '其他' in str(formats):
            issues.append(f"日期列'{col}'使用非标准格式: {', '.join(formats)}")
            bad_date_cols.append(str(col))
    
    if not date_cols_found:
        return {
            "check": "日期规范",
            "status": "WARN",
            "score": 3,
            "date_columns": [],
            "issues": ["未检测到明显的日期列（列名中不含'日期/时间/期间'关键词）"],
            "message": "未找到日期列，跳过检查"
        }
    
    if len(bad_date_cols) == 0:
        status = "PASS"
        score = 5
    elif len(bad_date_cols) <= 1:
        status = "WARN"
        score = 3
    else:
        status = "FAIL"
        score = 1
    
    return {
        "check": "日期规范",
        "status": status,
        "score": score,
        "date_columns": date_cols_found,
        "bad_columns": bad_date_cols,
        "issues": issues,
        "message": f"日期列: {len(date_cols_found)} 个, 格式问题: {len(bad_date_cols)} 个"
    }


def check_category_clarity(df):
    """检查6: 分类明确 — 有可分组维度列"""
    category_keywords = {'区域', '地区', 'region', 'area', '部门', 'dept',
                          '产品', 'product', '品类', 'category', '类型', 'type',
                          '渠道', 'channel', '类', '组'}
    
    found_categories = []
    for col in df.columns:
        col_str = str(col)
        if any(kw in col_str for kw in category_keywords):
            # Check cardinality (should have 2-50 unique values)
            n_unique = df[col].nunique()
            if 2 <= n_unique <= 100:
                found_categories.append({
                    "column": col_str,
                    "unique_values": int(n_unique),
                    "sample": list(df[col].dropna().unique()[:5])
                })
    
    if len(found_categories) >= 2:
        status = "PASS"
        score = 5
        msg = f"找到 {len(found_categories)} 个分类维度"
    elif len(found_categories) == 1:
        status = "WARN"
        score = 3
        msg = f"仅 1 个分类维度（{found_categories[0]['column']}），建议补充更多维度以支持多维分析"
    else:
        status = "FAIL"
        score = 1
        msg = "未找到分类维度列，所有列均为指标，无法按维度分组分析"
    
    return {
        "check": "分类明确",
        "status": status,
        "score": score,
        "categories": found_categories,
        "issues": [] if found_categories else ["缺少可分组维度列（区域/产品/部门等），建议添加至少1个分类列"],
        "message": msg
    }


def scan_file(file_path):
    """执行完整 6 项扫描"""
    
    if not os.path.exists(file_path):
        return {"error": f"文件不存在: {file_path}"}
    
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext in ('.xlsx', '.xlsm'):
            df = pd.read_excel(file_path, engine='openpyxl')
        elif ext in ('.csv', '.tsv'):
            sep = '\t' if ext == '.tsv' else ','
            df = pd.read_csv(file_path, sep=sep, encoding='utf-8')
        else:
            return {"error": f"不支持的文件格式: {ext}，仅支持 .xlsx .xlsm .csv .tsv"}
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(file_path, encoding='gbk')
        except Exception as e:
            return {"error": f"编码读取失败: {str(e)}，请确保文件为 UTF-8 或 GBK 编码"}
    except Exception as e:
        return {"error": f"文件读取失败: {str(e)}"}
    
    if df.empty:
        return {"error": "文件为空或无法解析"}
    
    # Run all 6 checks
    results = []
    
    results.append(check_headers(df, file_path))
    results.append(check_merged_cells(file_path, df))
    results.append(check_empty_rows_cols(df))
    results.append(check_format_consistency(df))
    results.append(check_date_format(df))
    results.append(check_category_clarity(df))
    
    total_score = sum(r['score'] for r in results)
    
    if total_score >= 24:
        readiness = " OK  就绪"
        action = "数据干净，可直接进入经营分析"
    elif total_score >= 18:
        readiness = "WARN 基本可用"
        action = "部分问题不影响核心分析，但建议标注'数据质量影响准确性'"
    else:
        readiness = "FAIL 不可用"
        action = "数据存在严重结构问题，建议修复后重新提交"
    
    report = {
        "file": os.path.basename(file_path),
        "path": file_path,
        "scanned_at": datetime.now().isoformat(),
        "shape": {"rows": len(df), "columns": len(df.columns)},
        "columns": list(df.columns),
        "checks": results,
        "summary": {
            "total_score": total_score,
            "readiness_rating": readiness,
            "action": action,
            "passed": sum(1 for r in results if r['score'] >= 4),
            "warning": sum(1 for r in results if r['score'] == 3),
            "failed": sum(1 for r in results if r['score'] <= 2)
        },
        "data_preview": {
            "head": df.head(5).to_dict(orient='records'),
            "dtypes": {str(k): str(v) for k, v in df.dtypes.items()}
        }
    }
    
    return report


def print_human_report(report):
    """人类可读的报告输出"""
    if "error" in report:
        print(f"FAIL 错误: {report['error']}")
        return
    
    s = report["summary"]
    print(f"\n{'='*60}")
    print(f"  数据就绪扫描报告: {report['file']}")
    print(f"{'='*60}")
    print(f"  数据规模: {report['shape']['rows']} 行 × {report['shape']['columns']} 列")
    print(f"  扫描时间: {report['scanned_at']}")
    print()
    
    for i, check in enumerate(report["checks"], 1):
        print(f"  [{i}] {check['check']}  {check['status']}  ({check['score']}/5)")
        print(f"      {check['message']}")
        for issue in check.get("issues", []):
            print(f"      !   {issue}")
        print()
    
    print(f"  {'─'*50}")
    print(f"  总分: {s['total_score']}/30  |  评级: {s['readiness_rating']}")
    print(f"  通过: {s['passed']}项  |  警告: {s['warning']}项  |  失败: {s['failed']}项")
    print(f"  → {s['action']}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    import pandas as pd
    
    if len(sys.argv) < 2:
        print("用法: python scan.py <文件路径> [--json]")
        print("示例: python scan.py C:\\数据\\财务数据.xlsx --json")
        sys.exit(1)
    
    file_path = sys.argv[1]
    output_json = "--json" in sys.argv
    
    report = scan_file(file_path)
    
    if output_json:
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    else:
        print_human_report(report)
