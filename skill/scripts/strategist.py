# -*- coding: utf-8 -*-
"""
strategist.py — 单谋士独立咨询工具
===================================
用法:
    python strategist.py zhuge_liang  "我该不该跳槽到创业公司？"
    python strategist.py jia_xu       "竞争对手压价，如何应对？"
    python strategist.py zhou_yu     "团队士气低落怎么办？"
    python strategist.py guo_jia     "如何预判对手下一步？"
    python strategist.py si_ma_yi    "该不该现在出手反击？"
    python strategist.py xun_yu      "如何搭建人才梯队？"
    python strategist.py pang_tong    "业务陷入僵局如何破局？"

    python strategist.py --list       # 列出所有可用谋士
    python strategist.py --help       # 帮助

每位谋士有独立的性格、思维方式和说话风格，
会以该谋士的口吻给出针对性的献策。
"""

import sys
import os

# 确保能 import 同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from personas import ALL_STRATEGISTS, list_strategists
from llm_call import call_llm


# 谋士名号装饰（终端输出用）
BANNER = {
    "zhuge_liang":  "═══ 卧龙 · 诸葛亮 ═══",
    "jia_xu":       "═══ 毒士 · 贾诩 ═══",
    "zhou_yu":      "═══ 儒将 · 周瑜 ═══",
    "guo_jia":      "═══ 鬼才 · 郭嘉 ═══",
    "si_ma_yi":     "═══ 冢虎 · 司马懿 ═══",
    "xun_yu":       "═══ 王佐 · 荀彧 ═══",
    "pang_tong":    "═══ 凤雏 · 庞统 ═══",
}


def consult(strategist_key, question):
    """向指定谋士献策"""
    persona = ALL_STRATEGISTS.get(strategist_key)
    if not persona:
        print(f"[错误] 未知谋士: {strategist_key}")
        print("可用谋士请运行: python strategist.py --list")
        sys.exit(1)

    banner = BANNER.get(strategist_key, f"═══ {persona['name']} ═══")
    print()
    print(banner)
    print(f"定位：{persona['title']}")
    print(f"擅长：{persona['specialty']}")
    print("─" * 40)
    print(f"【主公所问】{question}")
    print("─" * 40)
    print("【谋士献策】")
    print()

    reply = call_llm(
        system_prompt=persona["system_prompt"],
        user_prompt=question,
    )
    print(reply)
    print()
    print("─" * 40)
    print(f"— {persona['name']}（{persona['alias']}）")
    print()


def show_list():
    """列出所有可用谋士"""
    print()
    print("╔══════════════════════════════════════════════════════╗")
    print("║        三国谋士独立咨询工具 · 可用谋士一览          ║")
    print("╚══════════════════════════════════════════════════════╝")
    print()
    for s in list_strategists():
        print(f"  {s['key']:14s}  {s['name']}（{s['alias']}）")
        print(f"  {'':14s}  {s['title']}")
        print(f"  {'':14s}  擅长：{s['specialty']}")
        print()
    print("用法示例：")
    print("  python strategist.py zhuge_liang \"我的问题……\"")
    print()


def main():
    args = sys.argv[1:]

    if not args or args[0] in ("--help", "-h", "help"):
        print(__doc__)
        return

    if args[0] in ("--list", "-l", "list"):
        show_list()
        return

    if len(args) < 2:
        print("[错误] 用法: python strategist.py <谋士key> \"你的问题\"")
        print("       查看可用谋士: python strategist.py --list")
        sys.exit(1)

    strategist_key = args[0]
    question = args[1]
    consult(strategist_key, question)


if __name__ == "__main__":
    main()
