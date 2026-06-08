import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle, PageBreak, TableOfContents } from 'docx';
import { writeFileSync } from 'fs';

// 字号常量 (half-points)
const SIZE_2 = 44;       // 二号 22pt
const SIZE_3_SMALL = 30; // 小三 15pt
const SIZE_4 = 28;       // 四号 14pt
const SIZE_4_SMALL = 24; // 小四 12pt
const SIZE_5 = 21;       // 五号 10.5pt

// 字体
const FONT_HEI = 'SimHei';   // 黑体
const FONT_SONG = 'SimSun';  // 宋体
const FONT_KAI = 'KaiTi';    // 楷体

// 行距 (twips)
const LINE_SPACING_1_5 = 360;

// 工具函数
function p({ children, heading, alignment, spacing, indent, bold, font, size, color }) {
  const runs = children || [];
  return new Paragraph({
    heading,
    alignment,
    spacing: spacing || { line: LINE_SPACING_1_5, before: 0, after: 0 },
    indent,
    children: runs,
  });
}

function tr(title, content, fontTitle, fontContent) {
  const fTitle = fontTitle || FONT_SONG;
  const fContent = fontContent || FONT_SONG;
  return new TextRun({
    text: title,
    font: fTitle,
    size: SIZE_5,
    bold: true,
  });
}

function tc(text, font, size, bold, alignment, width) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: alignment || AlignmentType.LEFT,
        spacing: { line: LINE_SPACING_1_5, before: 40, after: 40 },
        children: [
          new TextRun({
            text: text || '',
            font: font || FONT_SONG,
            size: size || SIZE_5,
            bold: bold || false,
          }),
        ],
      }),
    ],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { line: LINE_SPACING_1_5, before: 240, after: 120 },
    children: [
      new TextRun({ text, font: FONT_HEI, size: SIZE_4, bold: true }),
    ],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { line: LINE_SPACING_1_5, before: 200, after: 100 },
    children: [
      new TextRun({ text, font: FONT_HEI, size: SIZE_4_SMALL, bold: true }),
    ],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { line: LINE_SPACING_1_5, before: 160, after: 80 },
    children: [
      new TextRun({ text, font: FONT_KAI, size: SIZE_4_SMALL, bold: true }),
    ],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING_1_5, before: 0, after: 0 },
    indent: { firstLine: 420 }, // 两个字符缩进
    children: [
      new TextRun({ text, font: FONT_SONG, size: SIZE_5 }),
    ],
  });
}

function bodyNoIndent(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING_1_5, before: 0, after: 0 },
    children: [
      new TextRun({ text, font: FONT_SONG, size: SIZE_5 }),
    ],
  });
}

function emptyLine() {
  return new Paragraph({
    spacing: { line: LINE_SPACING_1_5 },
    children: [new TextRun({ text: '', size: SIZE_5 })],
  });
}

// 封面段落
function coverLine(text, font, size, bold, spacing) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: spacing || { line: 360, before: 0, after: 0 },
    children: [
      new TextRun({ text, font, size, bold }),
    ],
  });
}

// 表格行
function dataRow(cells, headerRow) {
  return new TableRow({
    children: cells.map((c, i) => {
      const isHeader = headerRow === true || (headerRow === 'first' && i === 0);
      return tc(c, FONT_SONG, SIZE_5, isHeader, isHeader ? AlignmentType.CENTER : AlignmentType.LEFT);
    }),
  });
}

function headerRow(cells) {
  return new TableRow({
    children: cells.map(c => tc(c, FONT_SONG, SIZE_5, true, AlignmentType.CENTER)),
  });
}

// 构建文档内容
const sections = [];

// ========== 封面 Section ==========
const coverChildren = [
  emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
  coverLine('华云设计电网规划培训系统项目', FONT_SONG, SIZE_3_SMALL, false, { line: 360, before: 0, after: 200 }),
  coverLine('操作手册', FONT_HEI, SIZE_2, true, { line: 600, before: 0, after: 400 }),
  emptyLine(), emptyLine(),
  coverLine('XXX公司', FONT_SONG, SIZE_3_SMALL, false, { line: 360, before: 0, after: 100 }),
  coverLine('华云设计电网规划培训系统项目', FONT_SONG, SIZE_3_SMALL, false, { line: 360, before: 0, after: 100 }),
  coverLine('操作手册', FONT_SONG, SIZE_3_SMALL, false, { line: 360, before: 0, after: 400 }),
  emptyLine(), emptyLine(), emptyLine(),
  coverLine('XXX公司编制', FONT_SONG, SIZE_4, false, { line: 360, before: 0, after: 0 }),
];

sections.push({
  properties: {
    page: {
      margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
    },
  },
  children: coverChildren,
});

// ========== 正文 Section ==========
const mainChildren = [];

// 文档修改记录
mainChildren.push(heading1('文档修改记录'));
mainChildren.push(emptyLine());

const modifyTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    headerRow(['修改日期', '修改人', '修改说明', '版本号']),
    dataRow(['/', '/', '初稿整合：纳入管理端后台、学员前端全模块操作内容', 'V1.0']),
  ],
});
mainChildren.push(modifyTable);
mainChildren.push(emptyLine());

// ========== 目录 ==========
mainChildren.push(heading1('目  录'));
mainChildren.push(emptyLine());

const tocItems = [
  ['1 引言', ''],
  ['1.1 编写目的', ''],
  ['1.2 参考文献', ''],
  ['1.3 术语定义', ''],
  ['2 业务1：平台管理端（管理员后台）', ''],
  ['2.1 功能1：用户管理模块', ''],
  ['2.2 功能2：课程管理（创建课程）模块', ''],
  ['2.3 功能3：素材库管理模块', ''],
  ['2.4 功能4：通用设置（资源分类）模块', ''],
  ['2.5 功能5：试题管理（题库+试题录入）模块', ''],
  ['2.6 功能6：试卷管理模块', ''],
  ['2.7 功能7：考试管理模块', ''],
  ['2.8 功能8：平台数据统计（首页+分类数据）模块', ''],
  ['3 业务2：学员端（培训学习前台）', ''],
  ['3.1 功能1：课程学堂模块', ''],
  ['3.2 功能2：知识档案模块', ''],
  ['3.3 功能3：综合测试模块', ''],
  ['3.4 功能4：学员中心模块', ''],
  ['4 非常规操作过程', ''],
  ['5 应用维护帐号', ''],
];

for (const [title] of tocItems) {
  mainChildren.push(new Paragraph({
    spacing: { line: 360, before: 0, after: 0 },
    children: [
      new TextRun({ text: title, font: FONT_SONG, size: SIZE_4_SMALL }),
    ],
  }));
}

mainChildren.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 1 引言 ==========
mainChildren.push(heading1('1 引言'));

mainChildren.push(heading2('1.1 编写目的'));
mainChildren.push(body('本文档用于指导电网业务在线学习（电网规划培训）平台管理员、学员两类使用者进行系统全功能操作，分别说明管理后台配置维护流程、学员前端学习使用流程，明确各模块业务规则、页面操作步骤，方便运维、操作人员日常查阅与落地使用。'));

mainChildren.push(heading2('1.2 参考文献'));
mainChildren.push(body('1. 管理端操作手册、学员端操作手册原始业务文档'));
mainChildren.push(body('2. 本系统产品原型页面说明文档'));

mainChildren.push(heading2('1.3 术语定义'));
mainChildren.push(body('1. 题库：按部门、课程分类存储单选/多选/判断/填空/简答试题的资源库，是组卷数据源；'));
mainChildren.push(body('2. 固定试卷：手动选定具体题目组成，题目固定不变的试卷；'));
mainChildren.push(body('3. 随机试卷：按题型、题量、难度规则从题库自动抽取题目生成的试卷；'));
mainChildren.push(body('4. 课程任务：课程内部子单元，分为图文、视频、文档、PPT、练习、考试6种任务类型；'));
mainChildren.push(body('5. 素材库：存储课程附件、视频、文档、PPT等资源的公共/个人资源仓库。'));

// ========== 2 业务1：平台管理端 ==========
mainChildren.push(heading1('2 业务1：平台管理端（管理员后台）'));

// ---- 2.1 用户管理 ----
mainChildren.push(heading2('2.1 功能1：用户管理模块'));
mainChildren.push(heading3('2.1.1 功能定义'));
mainChildren.push(body('实现系统后台用户新增、编辑、删除、锁定、重置密码、批量导入导出，支持按部门、用户信息关键字检索用户，维护平台使用人员账号信息。'));

mainChildren.push(heading3('2.1.2 业务逻辑'));
mainChildren.push(body('1. 管理员新增用户时，配置用户名、姓名、邮箱、手机号、所属部门、岗位、角色；'));
mainChildren.push(body('2. 账号状态分为正常/锁定，锁定账号无法登录系统；'));
mainChildren.push(body('3. 支持批量导入用户信息、导出全量用户台账；'));
mainChildren.push(body('4. 部门、岗位、角色信息依赖【部门管理/岗位管理/角色管理】基础配置。'));

mainChildren.push(heading3('2.1.3 操作指南'));
mainChildren.push(body('1. 登录管理端→首页→用户→用户管理，进入用户列表页；'));
mainChildren.push(body('2. 顶部搜索框输入关键字、筛选所属部门进行用户查询；'));
mainChildren.push(body('3. 点击【新增】，弹窗填写用户名、真实姓名、邮箱、手机号、角色、所属部门、岗位，保存完成创建；'));
mainChildren.push(body('4. 列表每条数据支持：编辑信息、锁定账号、重置登录密码、删除用户；'));
mainChildren.push(body('5. 页面提供导入、导出按钮，批量维护用户数据；'));
mainChildren.push(body('6. 分页展示用户数据，支持切换页码。'));

// ---- 2.2 课程管理 ----
mainChildren.push(heading2('2.2 功能2：课程管理（创建课程）模块'));
mainChildren.push(heading3('2.2.1 功能定义'));
mainChildren.push(body('管理员创建线上培训课程，配置课程基础信息、学习规则、课程任务、查看学员学习统计数据，课程任务支持图文/视频/文档/PPT/练习/考试六种内容形式。'));

mainChildren.push(heading3('2.2.2 业务逻辑'));
mainChildren.push(body('1. 课程由基本信息、学习设置、课程任务、课程数据四大板块组成；'));
mainChildren.push(body('2. 课程可见范围支持仅创建人可见、指定部门可见；'));
mainChildren.push(body('3. 学习模式分为自由学习、顺序解锁，任务完成规则全局管控；'));
mainChildren.push(body('4. 课程任务素材可本地上传或从个人/公共素材库选取，考试、练习任务关联试卷管理模块已创建试卷；'));
mainChildren.push(body('5. 课程发布后学员可在学员端课程学堂查看学习，课程数据自动汇总学员学习进度。'));

mainChildren.push(heading3('2.2.3 操作指南'));
mainChildren.push(body('1. 路径：首页→培训→课程知识→线上课程，进入课程列表；'));
mainChildren.push(body('2. 点击【创建课程】，依次维护四大配置板块：'));
mainChildren.push(body('   - 基本信息：填写课程名称、选择分类、所属部门、课程简介、上传封面图、配置发布范围，支持存草稿/直接发布；'));
mainChildren.push(body('   - 学习设置：选定学习模式（自由学习/顺序解锁）、任务完成规则；'));
mainChildren.push(body('   - 课程任务：点击新增任务，选择任务类型（图文/视频/文档/PPT/练习/考试），填写任务标题，文件类任务上传文件或选取素材库资源，考试类任务绑定已有试卷、配置考试时长、作答次数、答案查看权限，设置任务完成条件；'));
mainChildren.push(body('   - 课程数据：查看课程总学习人数、已完成/未完成人数、完成率、播放点赞数据，明细展示每位学员部门、岗位、学习时间、学习进度，支持数据查询与导出。'));

// ---- 2.3 素材库管理 ----
mainChildren.push(heading2('2.3 功能3：素材库管理模块'));
mainChildren.push(heading3('2.3.1 功能定义'));
mainChildren.push(body('统一管理课程配套素材（文档、视频、PPT、图片），支持文件上传、文件夹分类、资源借阅，课程上传附件自动存入创建人个人素材库。'));

mainChildren.push(heading3('2.3.2 业务逻辑'));
mainChildren.push(body('1. 素材默认可见范围为仅创建人，符合权限用户可跨用户选用素材；'));
mainChildren.push(body('2. 课程任务上传的文件自动备份至上传者个人素材库；'));
mainChildren.push(body('3. 支持新建文件夹分类归档素材、批量删除、批量移动文件。'));

mainChildren.push(heading3('2.3.3 操作指南'));
mainChildren.push(body('1. 首页→培训→素材库进入列表；'));
mainChildren.push(body('2. 可新建文件夹，筛选文件类型、搜索素材名称/创建人；'));
mainChildren.push(body('3. 点击上传，选择本地文件存入素材库；'));
mainChildren.push(body('4. 单素材操作：删除、查看更多配置；支持批量勾选素材进行删除、移动。'));

// ---- 2.4 通用设置 ----
mainChildren.push(heading2('2.4 功能4：通用设置（资源分类）模块'));
mainChildren.push(heading3('2.4.1 功能定义'));
mainChildren.push(body('统一维护课程、试题、试卷、考试的资源分类，分类全局同步至课程创建、题库创建页面。'));

mainChildren.push(heading3('2.4.2 业务逻辑'));
mainChildren.push(body('后台配置一级资源分类，所有课程、题库、试卷创建时可直接选用预设分类，实现资源归类管理。'));

mainChildren.push(heading3('2.4.3 操作指南'));
mainChildren.push(body('首页→培训→通用设置→资源分类，新增一级分类、搜索分类节点，维护分类名称。'));

// ---- 2.5 试题管理 ----
mainChildren.push(heading2('2.5 功能5：试题管理（题库+试题录入）模块'));
mainChildren.push(heading3('2.5.1 功能定义'));
mainChildren.push(body('创建题库，在题库下录入单选、多选、判断、填空、简答五类试题，支持单题手动录入、Excel批量导入试题，标注题目难度（简单/一般/较难/困难）。'));

mainChildren.push(heading3('2.5.2 业务逻辑'));
mainChildren.push(body('1. 题库绑定所属部门，分启用/停用两种状态；'));
mainChildren.push(body('2. 录入试题必须配置题型、难度、题干、答案，选择题补充选项内容，支持题干附件配图；'));
mainChildren.push(body('3. 批量导入需使用系统标准Excel模板，限制文件大小与试题条数上限。'));

mainChildren.push(heading3('2.5.3 操作指南'));
mainChildren.push(body('1. 首页→培训→学习测试→试题管理，筛选部门、关键词检索题库；'));
mainChildren.push(body('2. 【新建题库】填写题库名称、归属部门，保存；'));
mainChildren.push(body('3. 进入题库详情：手动新增试题（选择题型、难度、题干、答案、附件），或点击导入→下载模板、上传Excel批量导入题目；'));
mainChildren.push(body('4. 列表可对题库执行编辑、启用/停用、删除操作。'));

// ---- 2.6 试卷管理 ----
mainChildren.push(heading2('2.6 功能6：试卷管理模块'));
mainChildren.push(heading3('2.6.1 功能定义'));
mainChildren.push(body('创建固定试卷/随机试卷，从选定题库按题型配置出题数量、单题分值，随机试卷按题型数量+难度规则自动抽题。'));

mainChildren.push(heading3('2.6.2 业务逻辑'));
mainChildren.push(body('1. 试卷绑定分类、所属部门，区分固定、随机两种出卷类型；'));
mainChildren.push(body('2. 可多选来源题库，分别配置单选/多选/判断/填空/简答抽取数量，每题独立设置分数；'));
mainChildren.push(body('3. 试卷状态启用/停用，支持复制已有试卷快速创建新卷。'));

mainChildren.push(heading3('2.6.3 操作指南'));
mainChildren.push(body('1. 首页→培训→学习测试→试卷管理，筛选部门、试卷类型、名称查询；'));
mainChildren.push(body('2. 【新建试卷】填写试卷名称、说明、分类、出卷方式、所属部门，保存进入抽题配置页；'));
mainChildren.push(body('3. 选择题库，设置各题型抽取题数、单题分值，完成后保存、发布试卷。'));

// ---- 2.7 考试管理 ----
mainChildren.push(heading2('2.7 功能7：考试管理模块'));
mainChildren.push(heading3('2.7.1 功能定义'));
mainChildren.push(body('引用已有试卷创建正式考试，配置考试时间、参与学员范围，考试结束后查看参与数据、学员作答明细、成绩统计（及格/不及格/缺考）。'));

mainChildren.push(heading3('2.7.2 业务逻辑'));
mainChildren.push(body('1. 考试关联试卷，配置起止时间，考试状态：未开始/进行中/已结束；'));
mainChildren.push(body('2. 自动统计参考率、及格率、缺考率，支持查看单人答题详情与得分。'));

mainChildren.push(heading3('2.7.3 操作指南'));
mainChildren.push(body('1. 首页→培训→学习测试→考试管理，筛选条件查询考试列表；'));
mainChildren.push(body('2. 【新建考试】绑定试卷、设置考试起止时间、选择参考学员范围；'));
mainChildren.push(body('3. 列表编辑考试信息，进入考试详情查看全部/及格/不及格/缺考学员清单；'));
mainChildren.push(body('4. 点击学员【查看详情】，查看单学员每题作答、得分、题型明细。'));

// ---- 2.8 平台数据统计 ----
mainChildren.push(heading2('2.8 功能8：平台数据统计（首页+分类数据）模块'));
mainChildren.push(heading3('2.8.1 功能定义'));
mainChildren.push(body('首页展示平台整体汇总数据，拆分课程数据、学员数据、考试数据三大统计看板，直观展示各项指标与排行。'));

mainChildren.push(heading3('2.8.2 业务逻辑'));
mainChildren.push(body('系统自动汇总课程创建量、学习人次、试题总量、考试场次、学员通过率、部门排名等数据，实时更新。'));

mainChildren.push(heading3('2.8.3 操作指南'));
mainChildren.push(body('1. 系统首页查看概览：平台总用户、课程总数、试题总数、考试创建数、本周新增数据、完成率合格率；'));
mainChildren.push(body('2. 分别进入【课程数据/学员数据/考试数据】，查看细分指标、部门TOP排行、素材分布、通过率排名。'));

// ========== 3 业务2：学员端 ==========
mainChildren.push(heading1('3 业务2：学员端（培训学习前台）'));

// ---- 3.1 课程学堂 ----
mainChildren.push(heading2('3.1 功能1：课程学堂模块'));
mainChildren.push(heading3('3.1.1 功能定义'));
mainChildren.push(body('学员在线选课学习，按分类浏览课程，完成课程内图文、视频、文档、练习、考试各类任务，记录学习进度。'));

mainChildren.push(heading3('3.1.2 业务逻辑'));
mainChildren.push(body('1. 课程分为电网规划课程、电网知识学习两大分类，细分多级子目录；'));
mainChildren.push(body('2. 课程包含多个任务，完成对应条件（读完图文、看完视频、做完习题/试卷）标记任务完成；'));
mainChildren.push(body('3. 课程可收藏，收藏内容在学员中心-我的收藏查看。'));

mainChildren.push(heading3('3.1.3 操作指南'));
mainChildren.push(body('1. 学员账号登录→首页【课程学堂】，选择课程分类，点击目标课程进入详情；'));
mainChildren.push(body('2. 页面查看课程简介、整体学习进度、下一待学任务，点击继续学习跳转任务；'));
mainChildren.push(body('3. 目录点开对应任务：图文阅读、视频播放、练习作答、正式考试；'));
mainChildren.push(body('4. 课程点击收藏，存入个人收藏夹。'));

// ---- 3.2 知识档案 ----
mainChildren.push(heading2('3.2 功能2：知识档案模块'));
mainChildren.push(heading3('3.2.1 功能定义'));
mainChildren.push(body('浏览公共知识库文档资料，支持文档预览、点赞、收藏，统一管理个人收藏文档。'));

mainChildren.push(heading3('3.2.2 业务逻辑'));
mainChildren.push(body('公共知识库由管理员后台维护文档资源，学员仅预览查看，收藏文档归集至我的收藏。'));

mainChildren.push(heading3('3.2.3 操作指南'));
mainChildren.push(body('1. 首页→知识档案，分为公共知识库、我的收藏；'));
mainChildren.push(body('2. 搜索文档名称，点击文档在线预览，执行点赞、收藏；'));
mainChildren.push(body('3. 我的收藏内查看所有已收藏文档。'));

// ---- 3.3 综合测试 ----
mainChildren.push(heading2('3.3 功能3：综合测试模块'));
mainChildren.push(heading3('3.3.1 功能定义'));
mainChildren.push(body('学员参与管理员发布的正式线上考试，限时作答、提交后查看得分、答案解析、考试详情。'));

mainChildren.push(heading3('3.3.2 业务逻辑'));
mainChildren.push(body('后台创建的考试统一展示在此，在考试有效期内可进入作答，交卷即时出成绩与错题解析。'));

mainChildren.push(heading3('3.3.3 操作指南'));
mainChildren.push(body('1. 首页→综合测试，查看所有有效考试清单；'));
mainChildren.push(body('2. 点击参与考试，进入答题页，限时完成全部题目后提交试卷；'));
mainChildren.push(body('3. 交卷后查看总分、正确率、错题、答案解析、考试详情。'));

// ---- 3.4 学员中心 ----
mainChildren.push(heading2('3.4 功能4：学员中心模块'));
mainChildren.push(heading3('3.4.1 功能定义'));
mainChildren.push(body('汇总个人全量学习数据：待办任务、历史学习记录、收藏课程/文档，统计课程参与数量、学习时长。'));

mainChildren.push(heading3('3.4.2 业务逻辑'));
mainChildren.push(body('自动同步课程学习、考试、收藏全量数据，区分学习项目任务、考试任务、题库练习。'));

mainChildren.push(heading3('3.4.3 操作指南'));
mainChildren.push(body('1. 点击头像进入学员中心；'));
mainChildren.push(body('2. 我的任务：查看学习任务、历史考试任务、题库练习及成绩；'));
mainChildren.push(body('3. 学习记录：按时间查看每一次课程学习时间、学习时长；'));
mainChildren.push(body('4. 我的收藏：查看收藏课程、知识库文档。'));

// ========== 4 非常规操作过程 ==========
mainChildren.push(heading1('4 非常规操作过程'));
mainChildren.push(body('1. 题库/试卷资源异常：题库题目不足导致随机试卷无法抽题时，管理员返回试题管理补充对应题型、难度试题，重新编辑试卷；'));
mainChildren.push(body('2. 学员无法打开课程：检查课程发布范围配置、课程任务素材是否失效，重新上传素材或修改课程可见部门；'));
mainChildren.push(body('3. 考试无法作答：核对管理员配置的考试起止时间，不在有效期则由管理员调整考试时间；'));
mainChildren.push(body('4. 素材上传失败：校验文件格式（视频/doc/ppt等）、文件大小，压缩资源后重新上传。'));

// ========== 5 应用维护帐号 ==========
mainChildren.push(heading1('5 应用维护帐号'));
mainChildren.push(emptyLine());

const accountTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    headerRow(['账号类型', '应用维护账号', '权限配置策略', '权限最小化和职责不相容原则']),
    dataRow([
      '系统管理员',
      '超级管理员账号',
      '拥有系统全模块（用户、课程、试题、考试、数据）所有操作权限',
      '仅故障维护、版本更新时登录使用，日常业务禁止使用；不兼任业务管理员、账号管理员工作',
    ]),
    dataRow([
      '应用管理员',
      '业务运维管理员',
      '负责课程、试题、试卷、考试、素材库业务配置；无用户角色、账号锁定/重置权限',
      '不能操作用户权限管理，与工号管理员权限隔离，互不交叉',
    ]),
    dataRow([
      '工号管理员',
      '用户管理员',
      '仅管理后台用户新增、角色分配、账号启停；无课程/题库创建编辑权限',
      '无任何业务资源配置权限，和应用管理员岗位职责分离',
    ]),
    dataRow([
      '测试人员',
      '测试专用账号',
      '单独配置测试角色，仅测试环境可用；上线生产环境仅开放查询权限，禁止新增/删除数据',
      '测试角色与业务管理员、系统管理员角色互斥，不可同时赋权',
    ]),
  ],
});
mainChildren.push(accountTable);

sections.push({
  properties: {
    page: {
      margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
    },
  },
  children: mainChildren,
});

// 生成文档
const doc = new Document({
  title: '华云设计电网规划培训系统项目操作手册',
  description: '华云设计电网规划培训系统项目操作手册 V1.0',
  sections,
  styles: {
    default: {
      document: {
        run: { font: FONT_SONG, size: SIZE_5 },
      },
    },
  },
});

const buffer = await Packer.toBuffer(doc);
const desktopPath = 'C:\\Users\\PC\\Desktop\\华云设计电网规划培训系统项目操作手册v1.0.docx';
writeFileSync(desktopPath, buffer);
console.log(`文档已生成: ${desktopPath}`);
