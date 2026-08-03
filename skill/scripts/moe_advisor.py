# -*- coding: utf-8 -*-
"""
moe_advisor.py — 三国谋士 MoE（混合专家）多专家咨询系统
=====================================================

架构:
    ┌─────────────┐
    │  用户问题   │
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │  路由器     │  ← 分析问题，选出 1-3 位最合适的谋士
    │  (Router)   │
    └──────┬──────┘
           ▼
    ┌─────┬─────┬─────┐
    │专家1│专家2│专家3│  ← 并行调用各谋士，各抒己见
    └──┬──┴──┬──┴──┬──┘
       ▼     ▼     ▼
    ┌─────────────┐
    │  综合器     │  ← 汇总各专家意见，去重补缺，形成最终方略
    │(Synthesizer)│
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │  最终献策   │
    └─────────────┘

用法:
    python moe_advisor.py "我该不该接受竞品的合并邀约？"
    python moe_advisor.py "团队核心成员要离职怎么办？" --verbose
    python moe_advisor.py "如何预判对手定价策略" --experts guo_jia,zhou_yu
"""

import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from personas import ALL_STRATEGISTS, ROUTING_MATRIX, list_strategists
from llm_call import call_llm, call_llm_json


# ============================================================
# 路由器系统提示词
# ============================================================
ROUTER_SYSTEM = """你是三国谋士 MoE 系统的路由器（Router）。
你的职责是：分析用户问题，从七位谋士中选出 1-3 位最适合回答此问题的专家。

七位谋士及其擅长领域：
1. 诸葛亮(zhuge_liang) — 长期战略规划、内政治理、后勤调度、制度建设、防守反击
2. 贾诩(jia_xu) — 危机生存、利益博弈、人性洞察、站队抉择、低成本颠覆
3. 周瑜(zhou_yu) — 果敢决断、以少胜多、团队凝聚、进攻型战术、商战
4. 郭嘉(guo_jia) — 心理分析、敌情预判、性格弱点洞察、预言式判断
5. 司马懿(si_ma_yi) — 长期博弈、隐忍待机、政变时机、权力斗争
6. 荀彧(xun_yu) — 组织建设、人才识别、大义名分、后方治理
7. 庞统(pang_tong) — 破局攻坚、激进战术、临场决断、速胜方案

路由规则:
- 简单明确的问题选 1 位专家即可
- 复杂多面的问题选 2-3 位，覆盖不同视角
- 必须从不同维度选人，避免视角重叠（如不要同时选周瑜+庞统，二者都偏激进）
- 优先选择"擅长领域"与问题最匹配的谋士

你必须只输出一个 JSON 对象，格式如下：
{
  "analysis": "对问题的简要分析（1-2句）",
  "selected": ["谋士key1", "谋士key2"],
  "reason": "为何选这几位，各自负责哪个视角（1-2句）"
}

不要输出任何 JSON 以外的内容。"""


# ============================================================
# 综合器系统提示词
# ============================================================
SYNTHESIZER_SYSTEM = """你是三国谋士 MoE 系统的综合器（Synthesizer）。
你的职责是：汇总多位谋士的意见，去重补缺，形成一份条理清晰、可执行的最终方略。

综合原则:
1. 保留各谋士的独到见解，不抹杀个性
2. 去除重复观点，合并相似建议
3. 指出各谋士意见的分歧点，并给出综合判断
4. 按优先级排列行动建议（立即做 / 短期做 / 长期做）
5. 标注风险点与备选方案

输出格式:
【局势研判】（1-2句点明问题本质）
【各方献策摘要】（每位谋士的核心主张，1-2句/人）
【综合方略】
  · 立即行动：……
  · 短期部署：……
  · 长期布局：……
【分歧与取舍】（各谋士意见不一处，及你的综合判断）
【风险提示】（最需警惕的1-2个风险）

语言风格：端方凝练，有谋略文告的质感，但务必现代可读。"""


# ============================================================
# MoE 主流程
# ============================================================
def route(question):
    """路由器：分析问题，选出合适的专家"""
    user_prompt = f"用户问题：{question}\n\n请分析此问题，选出最合适的1-3位谋士。只输出JSON。"
    result = call_llm_json(ROUTER_SYSTEM, user_prompt)

    if not result or "selected" not in result:
        # 兜底：关键词匹配
        selected = _keyword_fallback(question)
        return {
            "analysis": "（路由器降级为关键词匹配）",
            "selected": selected,
            "reason": "基于问题关键词的快速匹配",
        }

    # 校验 selected 中的 key 是否合法
    valid = [k for k in result["selected"] if k in ALL_STRATEGISTS]
    if not valid:
        valid = _keyword_fallback(question)
    result["selected"] = valid[:3]
    return result


def _keyword_fallback(question):
    """关键词兜底匹配"""
    scores = {k: 0 for k in ALL_STRATEGISTS}
    for key, keywords in ROUTING_MATRIX.items():
        for kw in keywords:
            if kw in question:
                scores[key] += 1
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    top = [k for k, s in ranked if s > 0][:3]
    if not top:
        top = ["zhuge_liang"]  # 最终兜底
    return top


def call_expert(strategist_key, question, context=""):
    """调用单个谋士专家"""
    persona = ALL_STRATEGISTS[strategist_key]
    user_prompt = question
    if context:
        user_prompt = f"背景信息：{context}\n\n主公所问：{question}"
    reply = call_llm(
        system_prompt=persona["system_prompt"],
        user_prompt=user_prompt,
    )
    return {
        "key": strategist_key,
        "name": persona["name"],
        "alias": persona["alias"],
        "title": persona["title"],
        "reply": reply,
    }


def synthesize(question, expert_replies, routing_info):
    """综合器：汇总各专家意见"""
    # 构建各专家意见摘要
    expert_summaries = []
    for er in expert_replies:
        expert_summaries.append(
            f"【{er['name']}（{er['alias']}）— {er['title']}】\n{er['reply']}"
        )
    expert_block = "\n\n---\n\n".join(expert_summaries)

    user_prompt = f"""用户原始问题：{question}

路由分析：{routing_info.get('analysis', '')}
选用专家：{', '.join(routing_info.get('selected', []))}
选用理由：{routing_info.get('reason', '')}

以下是各谋士的献策原文：

{expert_block}

请综合以上各谋士意见，形成最终方略。"""

    final = call_llm(
        system_prompt=SYNTHESIZER_SYSTEM,
        user_prompt=user_prompt,
        temperature=0.6,
    )
    return final


def run(question, verbose=False, force_experts=None):
    """MoE 主流程"""
    # ---- Step 1: 路由 ----
    if force_experts:
        routing_info = {
            "analysis": "（用户指定专家）",
            "selected": force_experts,
            "reason": "用户手动指定",
        }
    else:
        routing_info = route(question)

    selected = routing_info["selected"]

    if verbose:
        print("\n" + "═" * 56)
        print("  三国谋士 MoE 多专家咨询系统")
        print("═" * 56)
        print(f"\n【主公所问】{question}")
        print(f"\n【路由分析】{routing_info.get('analysis', '')}")
        print(f"【选用专家】{', '.join(selected)}")
        print(f"【选用理由】{routing_info.get('reason', '')}")
        print("\n" + "─" * 56)
        print("【各专家献策】\n")
    else:
        print(f"\n🔀 路由完成，选用专家：{', '.join(selected)}")
        print("⏳ 各专家献策中...\n")

    # ---- Step 2: 并行调用各专家（串行实现，避免并发限制）----
    expert_replies = []
    for key in selected:
        if verbose:
            persona = ALL_STRATEGISTS[key]
            print(f"\n{'─'*20} {persona['name']}（{persona['alias']}）{'─'*20}")
            print(f"定位：{persona['title']}")
            print()
        er = call_expert(key, question)
        expert_replies.append(er)
        if verbose:
            print(er["reply"])
            print(f"\n— {er['name']}")

    # ---- Step 3: 综合 ----
    if verbose:
        print("\n" + "═" * 56)
        print("【综合方略】")
        print("═" * 56 + "\n")
    else:
        print("🧠 综合各专家意见...\n")

    final = synthesize(question, expert_replies, routing_info)
    print(final)
    print("\n" + "═" * 56)
    print("  — 三国谋士 MoE 系统献策完毕")
    print("═" * 56 + "\n")

    return final


def main():
    parser = argparse.ArgumentParser(
        description="三国谋士 MoE 多专家咨询系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python moe_advisor.py "我该不该接受竞品的合并邀约？"
  python moe_advisor.py "团队核心成员要离职怎么办？" --verbose
  python moe_advisor.py "如何预判对手定价" --experts guo_jia,zhou_yu
  python moe_advisor.py --list
""",
    )
    parser.add_argument("question", nargs="*", help="你的问题")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="显示各专家的完整献策过程")
    parser.add_argument("--experts", "-e", type=str,
                        help="手动指定专家（逗号分隔），跳过路由")
    parser.add_argument("--list", "-l", action="store_true",
                        help="列出所有可用谋士")
    args = parser.parse_args()

    if args.list:
        from strategist import show_list
        show_list()
        return

    question = " ".join(args.question).strip()
    if not question:
        # 从 stdin 读
        question = sys.stdin.read().strip()
    if not question:
        parser.print_help()
        sys.exit(1)

    force = None
    if args.experts:
        force = [e.strip() for e in args.experts.split(",") if e.strip() in ALL_STRATEGISTS]
        if not force:
            print("[错误] 指定的专家均无效，请用 --list 查看")
            sys.exit(1)

    run(question, verbose=args.verbose, force_experts=force)


if __name__ == "__main__":
    main()
