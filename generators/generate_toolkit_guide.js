// 三国谋士工具包使用说明 - DOCX 生成脚本
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

// ---- Cover ----
function buildCover() {
  const titleRuns = [
    new TextRun({ text: "三国谋士工具包", bold: true, size: 84, color: P.titleColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
  ];
  const subtitleRuns = [
    new TextRun({ text: "七位独立谋士工具 · MoE 多专家献策系统", size: 32, color: P.subtitleColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
  ];
  const metaRuns = [
    new TextRun({ text: "基于《三国演义》与《三国志》正史", size: 22, color: P.metaColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    new TextRun({ text: "版本 1.0 · 2026年8月", size: 22, color: P.metaColor,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
  ];
  return [
    new Paragraph({ spacing: { before: 3200, after: 200 }, alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "THREE KINGDOMS", size: 18, color: P.accent, bold: true,
        font: { ascii: "Calibri" }, characterSpacing: 60 })] }),
    new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.LEFT,
      children: titleRuns, lineSpacing: 920 }),
    new Paragraph({ spacing: { before: 0, after: 400 }, alignment: AlignmentType.LEFT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 8 } },
      children: [] }),
    new Paragraph({ spacing: { before: 0, after: 1200 }, alignment: AlignmentType.LEFT,
      children: subtitleRuns, lineSpacing: 360 }),
    ...metaRuns.map((r, i) => new Paragraph({
      spacing: { before: i === 0 ? 0 : 100, after: 0 }, alignment: AlignmentType.LEFT,
      children: [r] })),
  ];
}

// ---- Body helpers ----
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 240 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 26, color: P.primary,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3, spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 22, color: P.accent,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function p(text) {
  return new Paragraph({
    spacing: { before: 0, after: 120, lineSpacing: 312 }, alignment: AlignmentType.LEFT,
    children: [new TextRun({ text, size: 21, color: P.body,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function pRich(runs) {
  return new Paragraph({
    spacing: { before: 0, after: 120, lineSpacing: 312 }, alignment: AlignmentType.LEFT,
    children: runs,
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { before: 0, after: 60, lineSpacing: 312 }, alignment: AlignmentType.LEFT,
    bullet: { level }, indent: { left: 360 + level * 360 },
    children: [new TextRun({ text, size: 21, color: P.body,
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { before: 80, after: 120, lineSpacing: 280 }, alignment: AlignmentType.LEFT,
    shading: { type: ShadingType.CLEAR, color: P.surface },
    indent: { left: 200, right: 200 },
    children: [new TextRun({ text, size: 19, color: P.primary,
      font: { ascii: "Consolas", eastAsia: "Microsoft YaHei" } })],
  });
}

// ---- Table helpers ----
function makeCell(text, opts = {}) {
  const isHeader = opts.header || false;
  return new TableCell({
    width: { size: opts.width || 25, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, color: isHeader ? P.accent : P.surface },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: 0, after: 0, lineSpacing: 280 },
      children: [new TextRun({
        text, size: 19, bold: isHeader, color: isHeader ? "FFFFFF" : P.body,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
      })],
    })],
  });
}
function makeTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => makeCell(h, { header: true, width: widths ? widths[i] : undefined })),
  });
  const dataRows = rows.map(row => new TableRow({
    children: row.map((cell, i) => makeCell(cell, { width: widths ? widths[i] : undefined })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D4C9BC" },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================
// Body content
// ============================================================
const bodyChildren = [
  // ---- 卷首语 ----
  h1("卷首语：何为谋士工具包"),
  p("本工具包将《三国演义》与《三国志》中七位顶级谋士的性格、思维方式与献策风格，封装为可独立运行的软件工具。每位谋士是一个独立的命令行程序，内嵌该谋士的完整人设（性格内核、思维特征、说话风格、回答要求），通过大模型以该谋士的口吻给出针对性献策。"),
  p("在此基础上，工具包还提供 MoE（Mixture of Experts，混合专家）多专家综合系统：路由器分析用户问题，从七位谋士中选出 1-3 位视角互补的专家，各以独立人设献策，再由综合器去重补缺，形成可执行方略。这一架构模拟了真实谋士团「各抒己见、主公决断」的决策模式。"),
  p("工具包已通过实际测试验证：诸葛亮会以「亮以为」自称给出上中下三策，贾诩会从人性利弊角度冷峻分析，郭嘉会精准预判对手心理，庞统会催促「机不可失」的激进破局。每位谋士风格鲜明、互不混淆。"),

  // ---- 工具一览 ----
  h1("一、工具一览"),
  p("工具包共包含 9 个文件：7 个独立谋士工具、1 个 MoE 综合系统、1 个共享人设库。所有工具仅使用 Python 标准库，无需额外安装包，依赖预装的 z-ai CLI 调用大模型。"),
  makeTable(
    ["文件", "谋士", "定位", "擅长领域"],
    [
      ["zhuge_liang.py", "诸葛亮（卧龙）", "全能统帅·战略规划", "长期战略、内政后勤、制度建设"],
      ["jia_xu.py", "贾诩（毒士）", "生存大师·局势把控", "危机生存、利益博弈、人性洞察"],
      ["zhou_yu.py", "周瑜（公瑾）", "大都督·儒将", "果敢决断、以少胜多、团队凝聚"],
      ["guo_jia.py", "郭嘉（奉孝）", "鬼才·预言家", "心理分析、敌情预判、性格洞察"],
      ["si_ma_yi.py", "司马懿（仲达）", "冢虎·隐忍", "长期博弈、政变时机、权力斗争"],
      ["xun_yu.py", "荀彧（文若）", "王佐之才", "组织建设、人才识别、大义名分"],
      ["pang_tong.py", "庞统（士元）", "凤雏·激进", "破局攻坚、连环计策、速胜方案"],
      ["moe_advisor.py", "MoE 系统", "多专家综合", "路由+并行献策+综合方略"],
      ["personas.py", "人设库", "共享模块", "七位谋士的系统提示词"],
    ],
    [18, 18, 22, 42]
  ),

  // ---- 快速开始 ----
  h1("二、快速开始"),
  h2("2.1 单谋士独立咨询"),
  p("每位谋士是一个独立的 Python 脚本，可直接运行。只需将你的问题作为参数传入，谋士便会以该角色的口吻献策。以下是各谋士的典型调用示例："),
  code('# 诸葛亮献策（战略规划视角）\npython zhuge_liang.py "我该不该从大厂跳槽到创业公司？"'),
  code('# 贾诩献策（生存博弈视角）\npython jia_xu.py "竞争对手突然压价30%，如何应对？"'),
  code('# 郭嘉献策（心理预判视角）\npython guo_jia.py "如何预判谈判对手的底线？"'),
  code('# 庞统献策（激进破局视角）\npython pang_tong.py "业务增长停滞，如何破局？"'),
  p("每位谋士的输出包含：谋士名号横幅、定位与擅长领域、你的问题、谋士献策正文、署名落款。输出格式统一，便于阅读与归档。"),

  h2("2.2 MoE 多专家综合咨询"),
  p("当问题复杂、需要多视角权衡时，使用 MoE 系统。路由器会自动分析问题，选出 1-3 位视角互补的专家，各以独立人设献策，再由综合器汇总成可执行方略。"),
  code('# 自动路由 + 多专家献策 + 综合方略\npython moe_advisor.py "核心团队成员提出离职，我该怎么办？"'),
  code('# 显示完整献策过程（各专家原文）\npython moe_advisor.py "该不该接受竞品的合并邀约？" --verbose'),
  code('# 手动指定专家（跳过路由）\npython moe_advisor.py "如何搭建人才梯队" --experts xun_yu,zhuge_liang'),
  p("MoE 系统的输出包含：路由结果（选中的专家及理由）、各专家献策（verbose 模式下显示原文）、综合方略（立即行动/短期部署/长期布局三层结构）、分歧标注与取舍建议。"),

  h2("2.3 查看可用谋士"),
  code('python strategist.py --list'),
  p("此命令会列出所有可用谋士的 key、名号、定位与擅长领域，方便你选择合适的谋士或指定 MoE 专家。"),

  // ---- 架构说明 ----
  h1("三、MoE 架构说明"),
  p("MoE（Mixture of Experts）是一种多专家混合架构，核心思想是：不同问题由不同专家回答，而非一个模型包揽一切。本系统的 MoE 架构分为三层："),

  h2("3.1 路由器（Router）"),
  p("路由器是 MoE 的「调度官」。它接收用户问题，分析问题属于哪类决策（战略规划、危机应对、竞争博弈、组织管理、破局攻坚、心理预判等），然后从七位谋士中选出 1-3 位最适合回答此问题的专家。路由器的设计原则是「视角互补」：选出的专家应提供不同角度的洞察，而非重复同一观点。"),
  p("路由器使用较低的温度参数（0.3）以保证分析稳定性，输出结构化的 JSON 结果，包含选中的专家 key、选择理由、各专家的分工侧重。默认选 2 位专家以平衡速度与视角多样性，复杂问题可选 3 位。"),

  h2("3.2 专家（Expert）"),
  p("每位专家是一位独立的「谋士模型」。各专家拥有完整的 system_prompt（性格内核、思维特征、说话风格、回答要求），以该谋士的口吻独立献策。专家之间不通信、不要求一致，保留个性与分歧——这正是多专家架构的价值所在。"),
  p("例如，面对「核心成员离职」的问题，荀彧会从制度与自省角度分析（是否管理失当、激励不足），贾诩会从人性与利益角度分析（对方真实诉求、挽留的代价与收益）。两份献策视角不同、甚至可能矛盾，但都有价值。专家使用较高温度（0.8）以保留个性表达。"),

  h2("3.3 综合器（Synthesizer）"),
  p("综合器是 MoE 的「主公决断」环节。它汇总各专家的意见，执行三步操作：去重（相同观点强化）、补缺（各专家未覆盖的盲点补充）、排序（按「立即行动/短期部署/长期布局」三层结构重新组织）。综合器还会标注各专家的分歧点与取舍建议，帮助用户理解不同立场的利弊。"),
  p("综合器使用中等温度（0.5）以平衡创意与准确。最终输出是一份结构化的可执行方略，而非简单的「各专家意见拼接」。"),

  // ---- 人设设计 ----
  h1("四、人设设计依据"),
  p("每位谋士的人设融合了《三国演义》的文学形象与《三国志》的正史记载，刻意避免刻板印象，力求还原一个更立体、更真实的谋士形象。以下是七位谋士的人设修正要点："),

  h2("4.1 诸葛亮 — 从「近妖」到「治实」"),
  p("演义中的诸葛亮呼风唤雨、近乎妖道，空城计、借东风等情节将其神化。但正史记载其「奇谋为短」——奇谋诡计并非其所长，其真正强项是内政治理与后勤调度。因此人设中，诸葛亮偏稳健而非奇谋，重视制度与后勤，回答时会先看大势再定方略，给出上中下三策并说明各策代价。"),

  h2("4.2 贾诩 — 从「阴狠」到「冷静利己」"),
  p("演义中的贾诩算无遗策但有些阴狠，「文和乱武」的毒计形象深入人心。但正史中的贾诩极具洞察人性，一生唯求自保，易主多次却能善终，太尉之位寿终正寝——这是一个极度理性的生存大师，而非纯粹的阴毒之徒。人设中，贾诩的献策冷静利己，先算利害再论是非，但绝不无谓作恶。"),

  h2("4.3 周瑜 — 从「气量狭小」到「雅量高致」"),
  p("演义中周瑜被诸葛亮三气而死，气量狭小的形象广为流传。但正史记载周瑜「性度恢廓，雅量高致」，老将程普被其折服，说出「与公瑾交，若饮醇醪，不觉自醉」。人设中，周瑜是雅量高致的儒将，果敢决断、善于凝聚团队，而非嫉妒狭隘之辈。"),

  h2("4.4 郭嘉 — 从「遗计定辽东」到「心理分析宗师」"),
  p("演义中郭嘉遗计定辽东的情节广为流传，但正史中其核心能力是极强的洞察力——善于分析对手性格与行事风格，精准预言孙策死于匹夫之手、袁绍迟疑不进等。人设中，郭嘉以心理分析为核心能力，不靠占卜纯靠逻辑，能精准预判敌方主帅的性格弱点。"),

  h2("4.5 司马懿 — 从「被压制」到「攻守兼备」"),
  p("演义中司马懿被诸葛亮压制，但防守无敌。正史中司马懿其实是军事天才——平定辽东、擒孟达，八日行军一千二百里急袭上庸，令敌军根本来不及反应。人设中，司马懿攻守兼备，既善千里奔袭的雷霆一击，也善五丈原对峙的隐忍消耗，更精于诈病赚曹爽式的政治伪装。"),

  h2("4.6 荀彧 — 从「忧愤死」到「王佐之才」"),
  p("演义中荀彧因反对曹操称公而忧愤死，形象偏悲情。但正史中荀彧是「王佐之才」，曹操的「吾之子房」，负责镇守后方与推荐人才，一生举荐了郭嘉、钟繇、陈群、司马懿等无数顶级人才。人设中，荀彧以组织建设与人才识别为核心，自带「人才雷达」，重视大义名分与后方治理。"),

  h2("4.7 庞统 — 从「貌丑才高」到「激进破局」"),
  p("演义中庞统貌丑才高、急于立功，落凤坡中伏而亡。正史中庞统善于军略，是入川之战的主要策划者，与诸葛亮并为军师中郎将，献上中下三策取益州。人设中，庞统以激进破局为核心，锋芒急促、语带锋芒，给出上中下三策时明确推荐最激进的上策，催促「机不可失」。"),

  // ---- 调用指南 ----
  h1("五、问题类型与谋士匹配指南"),
  p("不同类型的问题，适合不同性格的谋士献策。以下是基于问题类型的谋士匹配建议，供你选择单谋士工具或手动指定 MoE 专家时参考："),

  makeTable(
    ["问题类型", "推荐谋士", "理由"],
    [
      ["长期战略规划", "诸葛亮、荀彧", "隆中对式的全局视野 + 王佐之才的组织保障"],
      ["危机生存应对", "贾诩、司马懿", "冷静利己的生存大师 + 隐忍待机的博弈高手"],
      ["竞争博弈分析", "郭嘉、贾诩", "心理预判 + 利益博弈，双视角互补"],
      ["团队管理建设", "荀彧、周瑜", "举贤任能 + 雅量高致，组织与凝聚双修"],
      ["破局攻坚转型", "庞统、周瑜", "激进破局 + 果敢决断，速胜方案"],
      ["对手心理分析", "郭嘉、贾诩", "洞察人心 + 算无遗策，精准预判"],
      ["权力斗争站队", "司马懿、贾诩", "隐忍深沉 + 明哲保身，长期博弈"],
      ["人才识别招募", "荀彧、郭嘉", "人才雷达 + 洞察人心，识人用人"],
    ],
    [22, 22, 56]
  ),

  p("当然，最简单的方式是直接使用 MoE 系统，让路由器自动为你匹配最合适的专家组合。路由器经过专门设计，能够根据问题语义智能选择视角互补的谋士组合。"),

  // ---- 文件清单 ----
  h1("六、文件清单与目录结构"),
  p("工具包的完整目录结构如下，所有文件均已包含在下载的 zip 压缩包中："),
  code('三国谋士工具包/\n├── README.md              # 使用说明\n├── personas.py            # 七位谋士人设库（系统提示词）\n├── llm_call.py            # z-ai CLI 调用封装\n├── strategist.py          # 单谋士咨询主程序\n├── zhuge_liang.py         # 诸葛亮独立工具\n├── jia_xu.py              # 贾诩独立工具\n├── zhou_yu.py             # 周瑜独立工具\n├── guo_jia.py             # 郭嘉独立工具\n├── si_ma_yi.py            # 司马懿独立工具\n├── xun_yu.py              # 荀彧独立工具\n├── pang_tong.py           # 庞统独立工具\n├── moe_advisor.py         # MoE 多专家综合系统\n└── personas/             # 人设文件目录（预留扩展）'),

  // ---- MoE Skill ----
  h1("七、MoE Skill 说明"),
  p("除独立工具包外，本系统还以 Skill 形式注册，供 agent 在对话中直接调用。Skill 路径为：/home/z/my-project/skills/three-kingdoms-moe/，包含以下文件："),
  bullet("SKILL.md — Skill 描述文件，含 frontmatter（name、description）与使用指南"),
  bullet("scripts/personas.py — 七位谋士人设库"),
  bullet("scripts/llm_call.py — z-ai CLI 调用封装"),
  bullet("scripts/strategist.py — 单谋士咨询工具"),
  bullet("scripts/moe_advisor.py — MoE 路由+专家+综合主程序"),
  bullet("references/strategist_profiles.md — 七位谋士详细档案（技能设定）"),
  p("当用户提出决策类问题时，agent 可通过 Skill 系统自动调用 MoE，无需用户手动运行命令。Skill 的 description 字段已明确标注适用场景（战略规划、危机应对、团队管理、竞争博弈、人才决策、破局攻坚等），agent 会根据用户问题语义自动判断是否调用。"),

  // ---- 测试验证 ----
  h1("八、实测验证"),
  p("工具包已通过实际调用验证，以下是两个真实测试案例的输出摘要："),

  h2("8.1 诸葛亮独立咨询测试"),
  p("问题：创业公司融资困难，是该继续坚持还是转型？"),
  p("诸葛亮以「亮以为」自称，先从大势切入分析（融资环境、行业周期、团队状态），给出上中下三策：上策为「转型求存」（断臂求生，保留火种）、中策为「双线并行」（主业求存+新线试探）、下策为「死守待援」（坚守主业等待转机）。每策均标注代价与风险，末尾以「亮以为，存地失人，人地皆存；存人失地，人地皆得」收束，点明核心主张。"),

  h2("8.2 MoE 多专家综合测试"),
  p("问题：核心团队成员提出离职，我该怎么办？"),
  p("路由器分析后选中荀彧（组织建设）与贾诩（人性洞察）两位专家。荀彧从制度与自省角度献策：先查管理是否失当、激励是否不足、沟通是否缺位，建议建立离职面谈机制与人才梯队。贾诩从人性与利益角度献策：先判对方真实诉求（钱/权/情/路），再算挽留的代价与收益，警惕「强留生怨」。综合器将两份献策汇总为三层方略：立即行动（48小时内一对一沟通）、短期部署（一个月内完成制度复盘）、长期布局（建立人才梯队与预警机制），并标注分歧（荀彧重自省、贾诩重算账）与取舍建议。"),

  // ---- 结语 ----
  h1("九、结语"),
  p("三国谋士工具包不仅是一组软件工具，更是一种决策思维的封装。七位谋士代表了七种典型的决策视角：诸葛亮的稳健全局、贾诩的冷静利己、周瑜的果敢凝聚、郭嘉的洞察预判、司马懿的隐忍博弈、荀彧的组织建设、庞统的激进破局。面对复杂决策时，让多位谋士各抒己见，再由你这位「主公」决断，远比依赖单一视角更稳妥。"),
  p("正如荀彧举贤任能、曹操从谏如流——善用谋士者，得天下。愿这套工具包能在你需要决断时，为你献上一份来自千年前的智慧。"),
];

// ============================================================
// Build document
// ============================================================
const doc = new Document({
  creator: "Qingyan Agent",
  title: "三国谋士工具包使用说明",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 21, color: P.body },
        paragraph: { spacing: { lineSpacing: 312 } },
      },
    },
  },
  numbering: {
    config: [{
      reference: "default-numbering",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 260 } } },
      }],
    }],
  },
  sections: [
    // Cover section
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      children: buildCover(),
    },
    // TOC section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 400 },
          children: [new TextRun({ text: "目  录", bold: true, size: 36, color: P.primary,
            font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
          alignment: AlignmentType.CENTER,
        }),
        new TableOfContents("目录", {
          hyperlink: true, headingStyleRange: "1-3",
        }),
      ],
    },
    // Body section
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
            children: [new TextRun({ text: "三国谋士工具包使用说明", size: 18, color: P.secondary,
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

const outputPath = "/home/z/my-project/download/三国谋士工具包使用说明.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outputPath, buf);
  console.log("✅ Document generated:");
  console.log("   " + outputPath);
  console.log("   Size: " + (buf.length / 1024).toFixed(1) + " KB");
});
