// SkillHub 上传指引文档 - DOCX 生成脚本
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, TableLayoutType, WidthType,
  BorderStyle, ShadingType, TableOfContents, LevelFormat,
  NumberFormat, SectionType,
} = require("docx");
const fs = require("fs");

const P = {
  primary: "28201C", body: "36302C", secondary: "6E6560",
  accent: "7A5C3A", surface: "FBF9F7", bg: "F5F0E8",
  titleColor: "28201C", subtitleColor: "6E6560",
  metaColor: "5A4A38", footerColor: "8A7A68",
};
const c = (hex) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function buildCover() {
  const titleRuns = [
    new TextRun({ text: "SkillHub 上传指引", bold: true, size: 84, color: P.titleColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
  ];
  const subtitleRuns = [
    new TextRun({ text: "三国谋士 MoE Skill 发布手册", size: 32, color: P.subtitleColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
  ];
  const metaRuns = [
    new TextRun({ text: "Skill: three-kingdoms-moe v1.0.0", size: 22, color: P.metaColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    new TextRun({ text: "目标平台: skillhub.cn / clawhub.ai", size: 22, color: P.metaColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
  ];
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const thickBorder = { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 4 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: 3600 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT, indent: { left: 1200, right: 800 },
    border: { left: accentLeft },
    children: titleRuns,
  }));
  children.push(new Paragraph({ spacing: { before: 400 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.LEFT, indent: { left: 1200, right: 800 },
    children: subtitleRuns,
  }));
  children.push(new Paragraph({ spacing: { before: 1200 } }));
  for (const run of metaRuns) {
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT, indent: { left: 1200, right: 800 },
      spacing: { after: 100 },
      children: [run],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 2400 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, indent: { left: 800, right: 400 },
    border: { bottom: thickBorder },
    children: [new TextRun({ text: "2026年8月", size: 18, color: P.footerColor, font: { ascii: "Arial" } })],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        children: children,
      })],
    })],
  })];
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: P.primary,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: P.accent,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function p(text) {
  return new Paragraph({
    spacing: { line: 312, before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, color: P.body,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { line: 276, before: 60, after: 60 },
    shading: { type: ShadingType.CLEAR, fill: P.surface },
    children: [new TextRun({ text, size: 20, color: P.body,
      font: { ascii: "Consolas", eastAsia: "Microsoft YaHei" } })],
  });
}
function bullet(text) {
  return new Paragraph({
    spacing: { line: 312, before: 40, after: 40 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 22, color: P.body,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function makeTable(headers, rows) {
  const headerCells = headers.map(t => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 21, color: "FFFFFF",
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
    shading: { type: ShadingType.CLEAR, fill: P.accent },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  }));
  const dataRows = rows.map((cells, idx) => new TableRow({
    children: cells.map(t => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: t, size: 20, color: P.body,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
      shading: idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: P.surface } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: headerCells }), ...dataRows],
  });
}

const bodyChildren = [
  h1("一、发布前准备"),

  h2("1.1 Skill 包已完成"),
  p("三国谋士 MoE Skill 已完成全部开发与测试，包结构符合 ClawHub/SkillHub 发布规范。以下文件已就绪："),
  bullet("SKILL.md — Skill 主文件，含 frontmatter 元数据（name/description/version/license/categories/topics）"),
  bullet("LICENSE — MIT-0 许可证（自由使用、修改、分发，无需署名）"),
  bullet("README.md — GitHub 风格的项目说明文档"),
  bullet("scripts/ — 四个 Python 脚本（personas.py / llm_call.py / strategist.py / moe_advisor.py）"),
  bullet("references/ — 七位谋士详细档案（strategist_profiles.md）"),
  p("已通过 clawhub publish --dry-run 验证，输出「Would publish three-kingdoms-moe@1.0.0」，确认包结构正确。"),

  h2("1.2 Skill 元数据"),
  makeTable(
    ["字段", "值", "说明"],
    [
      ["name", "three-kingdoms-moe", "Skill 唯一标识符"],
      ["display name", "三国谋士MoE多专家献策系统", "展示名称"],
      ["version", "1.0.0", "语义化版本号"],
      ["license", "MIT-0", "零署名 MIT 许可证"],
      ["categories", "decision-support, productivity", "决策支持、效率工具"],
      ["topics", "三国,谋士,MoE,多专家,决策,战略,博弈,献策", "主题标签"],
      ["slug", "three-kingdoms-moe", "URL 友好名称"],
    ]
  ),

  h1("二、登录 ClawHub"),

  h2("2.1 为什么需要登录"),
  p("发布 Skill 到 SkillHub/ClawHub 需要身份认证。平台使用 device flow（设备授权流）登录，需要您在浏览器中完成 GitHub OAuth 或 ClawHub 账号授权。这一步涉及您的个人账号凭据，无法由 AI 代为完成。"),

  h2("2.2 登录步骤"),
  p("第一步：在终端运行以下命令启动 device flow 登录："),
  code("clawhub login --device --no-browser"),
  p("第二步：命令会输出一个验证 URL 和验证码，例如："),
  code("Device code received\n\n  To authenticate, visit:\n  https://clawhub.ai/cli/device?user_code=XXXX-XXXX\n\n  And enter code: XXXX-XXXX\n\n  Code expires in 15 minutes."),
  p("第三步：在浏览器中打开该 URL，输入验证码（或直接访问带 user_code 参数的链接），完成 GitHub 登录或 ClawHub 账号登录。"),
  p("第四步：授权完成后，终端会显示登录成功，可运行以下命令验证："),
  code("clawhub whoami"),
  p("该命令会显示您的用户名和登录状态。"),

  h1("三、发布 Skill"),

  h2("3.1 一键发布命令"),
  p("登录成功后，运行以下命令即可发布："),
  code("clawhub publish /home/z/my-project/skills/three-kingdoms-moe \\\n  --name \"三国谋士MoE多专家献策系统\" \\\n  --slug three-kingdoms-moe \\\n  --categories decision-support,productivity \\\n  --topics \"三国,谋士,MoE,多专家,决策,战略,博弈,献策\" \\\n  --version 1.0.0"),
  p("发布成功后，终端会输出 Skill 的访问地址，格式类似："),
  code("Published three-kingdoms-moe@1.0.0\n  https://clawhub.ai/skills/three-kingdoms-moe"),

  h2("3.2 发布参数说明"),
  makeTable(
    ["参数", "必填", "说明"],
    [
      ["path", "是", "Skill 文件夹路径（绝对路径）"],
      ["--name", "否", "展示名称（默认取 SKILL.md 的 name 字段）"],
      ["--slug", "否", "URL 友好名称（默认取 name 字段）"],
      ["--version", "否", "版本号（默认 1.0.0，更新时自动递增 patch）"],
      ["--categories", "否", "分类 slug，逗号分隔"],
      ["--topics", "否", "主题标签，逗号分隔"],
      ["--changelog", "否", "版本更新日志文本"],
      ["--dry-run", "否", "预览发布，不实际提交（用于验证）"],
      ["--json", "否", "输出 JSON 格式结果"],
    ]
  ),

  h2("3.3 发布后验证"),
  p("发布成功后，可通过以下方式验证："),
  bullet("访问 https://clawhub.ai/skills/three-kingdoms-moe 查看 Skill 详情页"),
  bullet("访问 https://skillhub.cn/skills 搜索「三国谋士」确认已收录"),
  bullet("运行 clawhub inspect three-kingdoms-moe 查看元数据"),
  bullet("运行 clawhub search 谋士 确认可被搜索到"),

  h1("四、Skill 介绍文案"),

  h2("4.1 一句话简介（用于列表页）"),
  p("三国谋士 MoE 多专家献策系统：路由器从七位谋士（诸葛亮/贾诩/周瑜/郭嘉/司马懿/荀彧/庞统）中选出 1-3 位视角互补的专家，各以独立人设献策，再由综合器汇总成可执行方略。"),

  h2("4.2 详细介绍（用于详情页）"),
  p("基于《三国演义》文学形象与《三国志》正史记载，将三国时期七位顶级谋士封装为各具性格的专家模型。这不是简单的多轮对话，而是真正的 Mixture-of-Experts 架构："),
  bullet("路由器（Router）：分析用户问题，从七位谋士中选出 1-3 位视角互补的专家"),
  bullet("专家（Expert）：各谋士以独立人设献策，保留个性与分歧，不要求一致"),
  bullet("综合器（Synthesizer）：汇总各专家意见，去重补缺，按优先级形成可执行方略"),
  p("每位谋士的人设融合了演义与正史，避免刻板印象：诸葛亮偏稳健而非奇谋（正史「奇谋为短」），周瑜雅量高致而非嫉妒（正史「性度恢廓」），司马懿攻守兼备而非纯防守（正史军事天才）。七种视角覆盖战略规划、危机生存、果敢决断、心理预判、隐忍博弈、组织建设、激进破局等典型决策维度。"),

  h2("4.3 适用场景"),
  bullet("战略规划与长期布局 — 诸葛亮、荀彧"),
  bullet("危机应对与生存博弈 — 贾诩、司马懿"),
  bullet("团队管理与人才决策 — 荀彧、诸葛亮"),
  bullet("竞争博弈与对手分析 — 郭嘉、周瑜"),
  bullet("破局攻坚与业务转型 — 庞统、周瑜"),
  bullet("任何需要多视角权衡的复杂决策 — MoE 自动路由"),

  h2("4.4 标签关键词"),
  p("三国、谋士、MoE、混合专家、多专家、决策支持、战略规划、危机应对、团队管理、竞争博弈、人才决策、破局攻坚、诸葛亮、贾诩、周瑜、郭嘉、司马懿、荀彧、庞统"),

  h1("五、更新与维护"),

  h2("5.1 发布新版本"),
  p("如需更新 Skill（修复 bug、新增功能、优化人设），修改脚本后重新发布："),
  code("clawhub publish /home/z/my-project/skills/three-kingdoms-moe \\\n  --version 1.1.0 \\\n  --changelog \"优化路由器匹配逻辑，新增 --experts 手动指定参数\""),
  p("版本号遵循语义化版本规范：主版本.次版本.修订号。修复 bug 递增修订号，新增功能递增次版本，不兼容改动递增主版本。"),

  h2("5.2 Fork 与协作"),
  p("其他用户可 Fork 本 Skill 进行二次开发："),
  code("clawhub install three-kingdoms-moe  # 安装到本地\n# 修改后发布为 Fork\nclawhub publish ./my-version --fork-of three-kingdoms-moe@1.0.0"),

  h1("六、常见问题"),

  h3("Q1: 发布时提示「Not logged in」怎么办？"),
  p("运行 clawhub login --device --no-browser，按提示在浏览器中完成授权。验证码 15 分钟内有效，过期需重新运行。"),

  h3("Q2: 发布时提示「Path must be a folder」怎么办？"),
  p("确保 path 参数是文件夹路径而非文件路径。应使用 clawhub publish /path/to/skill-folder 而非指向 SKILL.md 文件。"),

  h3("Q3: 如何查看已发布的 Skill？"),
  p("访问 https://clawhub.ai/skills/three-kingdoms-moe 或 https://skillhub.cn/skills 搜索名称。也可运行 clawhub inspect three-kingdoms-moe 查看元数据。"),

  h3("Q4: Skill 需要审核吗？"),
  p("SkillHub 平台有内容审核机制。发布后状态可能显示为「Moderate CLEAN」表示审核通过。如审核未通过，会显示原因，按提示修改后重新发布即可。"),

  h3("Q5: 如何删除已发布的 Skill？"),
  p("目前 ClawHub CLI 暂不支持删除已发布的 Skill。如需下架，请联系平台管理员或在 Skill 详情页提交下架申请。"),

  h1("七、快速发布清单"),

  p("按以下清单依次执行即可完成发布："),
  bullet("□ 1. 确认 skill 包结构完整（SKILL.md + LICENSE + scripts/ + references/）"),
  bullet("□ 2. 运行 clawhub publish --dry-run 验证包结构"),
  bullet("□ 3. 运行 clawhub login --device --no-browser 登录"),
  bullet("□ 4. 在浏览器中完成 GitHub/ClawHub 授权"),
  bullet("□ 5. 运行 clawhub whoami 确认登录成功"),
  bullet("□ 6. 运行 clawhub publish 命令发布 Skill"),
  bullet("□ 7. 访问 clawhub.ai/skills/three-kingdoms-moe 确认上线"),
  bullet("□ 8. 在 skillhub.cn 搜索确认收录"),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: P.body },
        paragraph: { spacing: { before: 480, after: 200 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 36, bold: true, color: P.primary },
        paragraph: { spacing: { before: 480, after: 200 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 160 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, bold: true, color: P.accent },
        paragraph: { spacing: { before: 280, after: 120 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCover(),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent, space: 4 } },
            children: [new TextRun({ text: "SkillHub 上传指引", size: 18, color: P.secondary,
              font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary,
              font: { ascii: "Calibri" } })],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

const outputPath = "/home/z/my-project/download/SkillHub上传指引.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outputPath, buf);
  console.log("✅ Document generated:");
  console.log("   " + outputPath);
  console.log("   Size: " + (buf.length / 1024).toFixed(1) + " KB");
});
