# -*- coding: utf-8 -*-
"""
llm_call.py — 统一的 z-ai CLI 调用封装
=====================================
所有谋士工具与 MoE 路由器都通过此模块调用大模型，
确保调用方式一致、错误处理统一。
"""

import json
import os
import shutil
import subprocess
import sys
import re


def _resolve_z_ai_cmd():
    """
    跨平台定位 z-ai CLI。

    Windows 上 npm 全局安装生成的是 .cmd/.ps1 shim，
    Python subprocess 无法直接执行，因此退回用 node 直接调用 cli.js。
    返回可直接传给 subprocess.run 的命令列表。
    """
    exe = shutil.which("z-ai")
    if exe and not exe.lower().endswith((".cmd", ".bat", ".ps1")):
        return ["z-ai"]

    candidates = []
    if os.name == "nt":
        candidates.append(
            os.path.join(
                os.environ.get("APPDATA", ""),
                "npm",
                "node_modules",
                "z-ai-web-dev-sdk",
                "dist",
                "cli.js",
            )
        )
        try:
            root = subprocess.run(
                ["npm", "root", "-g"],
                capture_output=True,
                text=True,
                timeout=15,
            ).stdout.strip()
            if root:
                candidates.append(
                    os.path.join(root, "z-ai-web-dev-sdk", "dist", "cli.js")
                )
        except Exception:
            pass

    for cli in candidates:
        if os.path.exists(cli):
            node = shutil.which("node") or "node"
            return [node, cli]

    return ["z-ai"]


def call_llm(system_prompt, user_prompt, temperature=0.8, timeout=120):
    """
    调用 z-ai chat CLI，返回纯文本回复。

    参数:
        system_prompt: 系统提示词（人设）
        user_prompt:   用户问题
        temperature:   采样温度（0.7-0.9 适合创意，0.3-0.5 适合分析）
        timeout:       超时秒数

    返回:
        str: 模型回复的纯文本内容
    """
    cmd = [
        *_resolve_z_ai_cmd(),
        "chat",
        "--system", system_prompt,
        "--prompt", user_prompt,
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode != 0:
            return f"[调用失败] {result.stderr.strip()[:200]}"

        # 解析 JSON 输出，提取 content
        output = result.stdout.strip()
        # 去掉初始化日志行
        lines = output.split("\n")
        json_start = 0
        for i, line in enumerate(lines):
            if line.strip().startswith("{"):
                json_start = i
                break
        json_str = "\n".join(lines[json_start:])

        try:
            data = json.loads(json_str)
            return data["choices"][0]["message"]["content"].strip()
        except (json.JSONDecodeError, KeyError, IndexError):
            # 如果 JSON 解析失败，尝试直接提取文本
            return _extract_text_fallback(output)

    except subprocess.TimeoutExpired:
        return "[调用超时] 请稍后重试"
    except FileNotFoundError:
        return "[错误] 未找到 z-ai 命令，请确认环境已安装 z-ai-web-dev-sdk"
    except Exception as e:
        return f"[调用异常] {str(e)[:200]}"


def _extract_text_fallback(output):
    """JSON 解析失败时的兜底文本提取"""
    # 尝试匹配 "content": "..." 模式
    match = re.search(r'"content"\s*:\s*"((?:[^"\\]|\\.)*)"', output, re.DOTALL)
    if match:
        return match.group(1).encode().decode('unicode_escape')
    return output[-500:] if len(output) > 500 else output


def call_llm_json(system_prompt, user_prompt, timeout=120):
    """
    调用 LLM 并期望返回 JSON 格式结果。
    用于 MoE 路由器（需要结构化的专家选择结果）。
    """
    raw = call_llm(system_prompt, user_prompt, temperature=0.3, timeout=timeout)
    # 尝试从回复中提取 JSON
    # 先找 ```json ... ``` 代码块
    match = re.search(r'```json\s*(.*?)\s*```', raw, re.DOTALL)
    if match:
        raw = match.group(1)
    else:
        # 找第一个 { 到最后一个 }
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            raw = raw[start:end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


if __name__ == "__main__":
    # 快速自测
    print("=== LLM 调用自测 ===")
    reply = call_llm(
        system_prompt="你是一个测试助手，只回复'收到'两个字。",
        user_prompt="测试",
    )
    print("回复:", reply)
