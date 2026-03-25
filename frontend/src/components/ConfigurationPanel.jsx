import {
  Alert,
  Button,
  Card,
  Collapse,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GetServiceEditor, SaveServiceConfig, ValidateServiceConfig } from '../../wailsjs/go/main/App';
import PlistEditor from './PlistEditor';
import { getErrorMessage } from '../utils/errors';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const FORM_MODE = '表单';
const RAW_MODE = '原始 plist';
const PANEL_MODES = [FORM_MODE, RAW_MODE];
const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_INTERVAL_UNIT = 'minute';
const DEFAULT_DAILY_HOUR = 9;
const DEFAULT_DAILY_MINUTE = 0;
const DEFAULT_WEEKLY_WEEKDAY = 5;
const DEFAULT_MONTHLY_DAY = 1;
const SCHEDULE_OPTIONS = [
  {
    value: 'manual',
    title: '仅手动触发',
    description: '适合临时任务，不自动启动。',
  },
  {
    value: 'login',
    title: '登录后执行',
    description: '用户登录或加载后运行一次。',
  },
  {
    value: 'timed',
    title: '定时执行',
    description: '固定间隔、每天、每周、每月都归到这里。',
  },
];
const TIMED_RULE_OPTIONS = [
  {
    value: 'interval',
    title: '固定间隔执行',
    description: '按固定分钟数重复执行。',
  },
  {
    value: 'daily',
    title: '每天固定时间',
    description: '每天在指定时刻运行。',
  },
  {
    value: 'weekly',
    title: '每周固定时间',
    description: '适合每周例行任务，例如每周五 17:50。',
  },
  {
    value: 'monthly',
    title: '每月固定日期',
    description: '适合月结、账单、报表这类固定日期任务。',
  },
];
const CALENDAR_RULE_OPTIONS = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];
const INTERVAL_UNIT_OPTIONS = [
  { value: 'second', label: '秒' },
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
];
const WEEKDAY_OPTIONS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
];
const RESTART_OPTIONS = [
  {
    value: 'none',
    title: '执行完就结束',
    description: '适合一次性脚本或定时任务。',
  },
  {
    value: 'always',
    title: '异常退出后自动拉起',
    description: '适合需要持续驻留的守护服务。',
  },
];

/**
 * 将多行文本转成数组。
 */
function textToLines(text) {
  return String(text || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 将环境变量对象转成文本。
 */
function envMapToText(map = {}) {
  return Object.entries(map)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/**
 * 将环境变量文本转成对象。
 */
function textToEnvMap(text) {
  return String(text || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, line) => {
      const [key, ...rest] = line.split('=');

      // 键名为空时直接丢弃，避免污染配置。
      if (!key) {
        return accumulator;
      }

      accumulator[key.trim()] = rest.join('=').trim();
      return accumulator;
    }, {});
}

/**
 * 限制数值在给定范围内。
 */
function clampNumber(value, min, max) {
  const numeric = Number(value);

  // 非法数值直接回退到最小值，避免产生空调度。
  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.min(Math.max(numeric, min), max);
}

/**
 * 返回格式化后的时间文本。
 */
function formatClock(hour, minute) {
  return `${String(clampNumber(hour, 0, 23)).padStart(2, '0')}:${String(clampNumber(minute, 0, 59)).padStart(2, '0')}`;
}

/**
 * 返回周几文案。
 */
function getWeekdayLabel(weekday) {
  return WEEKDAY_OPTIONS.find((option) => option.value === clampNumber(weekday, 0, 6))?.label || '周五';
}

/**
 * 构造可视化日历规则对象。
 */
function buildCalendarRule(kind, values = {}) {
  const hour = clampNumber(values.calendarHour ?? DEFAULT_DAILY_HOUR, 0, 23);
  const minute = clampNumber(values.calendarMinute ?? DEFAULT_DAILY_MINUTE, 0, 59);

  switch (kind) {
    case 'weekly':
      return {
        Weekday: clampNumber(values.calendarWeekday ?? DEFAULT_WEEKLY_WEEKDAY, 0, 6),
        Hour: hour,
        Minute: minute,
      };
    case 'monthly':
      return {
        Day: clampNumber(values.calendarMonthDay ?? DEFAULT_MONTHLY_DAY, 1, 31),
        Hour: hour,
        Minute: minute,
      };
    case 'daily':
      return {
        Hour: hour,
        Minute: minute,
      };
    default:
      return null;
  }
}

/**
 * 将可视化规则转成 JSON 文本。
 */
function buildCalendarRuleJSON(kind, values = {}) {
  const rule = buildCalendarRule(kind, values);

  // 未启用可视化规则时直接返回空串，避免误写入调度字段。
  if (!rule) {
    return '';
  }

  return JSON.stringify(rule, null, 2);
}

/**
 * 生成日历规则摘要。
 */
function buildCalendarPlanSummary(plan) {
  if (!plan?.hasValue || !plan.supported) {
    return '';
  }

  const clockText = formatClock(plan.hour, plan.minute);

  switch (plan.kind) {
    case 'weekly':
      return `每${getWeekdayLabel(plan.weekday)} ${clockText}`;
    case 'monthly':
      return `每月 ${clampNumber(plan.monthDay, 1, 31)} 日 ${clockText}`;
    case 'daily':
      return `每天 ${clockText}`;
    default:
      return '';
  }
}

/**
 * 将秒数拆成更适合展示的间隔单位。
 */
function splitInterval(seconds) {
  const normalizedSeconds = Math.max(1, Number(seconds || 0));

  // 优先使用能整除的更大单位，减少用户手动换算。
  if (normalizedSeconds % 86400 === 0) {
    return { value: normalizedSeconds / 86400, unit: 'day' };
  }
  if (normalizedSeconds % 3600 === 0) {
    return { value: normalizedSeconds / 3600, unit: 'hour' };
  }
  if (normalizedSeconds % 60 === 0) {
    return { value: normalizedSeconds / 60, unit: 'minute' };
  }

  return { value: normalizedSeconds, unit: 'second' };
}

/**
 * 将间隔值和单位转成秒。
 */
function intervalToSeconds(value, unit) {
  const normalizedValue = clampNumber(value, 1, 999999);

  switch (unit) {
    case 'day':
      return normalizedValue * 86400;
    case 'hour':
      return normalizedValue * 3600;
    case 'second':
      return normalizedValue;
    case 'minute':
    default:
      return normalizedValue * 60;
  }
}

/**
 * 将秒数格式化成更自然的间隔文案。
 */
function formatIntervalSummary(seconds) {
  const interval = splitInterval(seconds);
  const unitLabel = INTERVAL_UNIT_OPTIONS.find((option) => option.value === interval.unit)?.label || '分钟';

  return `每 ${interval.value} ${unitLabel}`;
}

/**
 * 解析 StartCalendarInterval，提取可映射的常见定时。
 */
function parseCalendarPlan(calendarJSON) {
  const content = String(calendarJSON || '').trim();

  if (!content) {
    return {
      hasValue: false,
      supported: true,
      kind: 'daily',
      hour: DEFAULT_DAILY_HOUR,
      minute: DEFAULT_DAILY_MINUTE,
      weekday: DEFAULT_WEEKLY_WEEKDAY,
      monthDay: DEFAULT_MONTHLY_DAY,
      warning: '',
    };
  }

  try {
    const parsed = JSON.parse(content);
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;

    // 数组或复杂对象只在最简单的“每日固定时刻”下做映射。
    if (Array.isArray(parsed) && parsed.length !== 1) {
      return {
        hasValue: true,
        supported: false,
        kind: 'daily',
        hour: DEFAULT_DAILY_HOUR,
        minute: DEFAULT_DAILY_MINUTE,
        weekday: DEFAULT_WEEKLY_WEEKDAY,
        monthDay: DEFAULT_MONTHLY_DAY,
        warning: '当前任务使用了多段定时，表单模式无法完整维护，请改用原始 plist。',
      };
    }

    if (!candidate || typeof candidate !== 'object') {
      return {
        hasValue: true,
        supported: false,
        kind: 'daily',
        hour: DEFAULT_DAILY_HOUR,
        minute: DEFAULT_DAILY_MINUTE,
        weekday: DEFAULT_WEEKLY_WEEKDAY,
        monthDay: DEFAULT_MONTHLY_DAY,
        warning: '当前任务的定时结构较特殊，建议改用原始 plist 维护。',
      };
    }

    const keys = Object.keys(candidate);
    const hour = Number(candidate.Hour);
    const minute = Number(candidate.Minute);
    const weekday = Number(candidate.Weekday);
    const monthDay = Number(candidate.Day);
    const isDaily = ['Hour', 'Minute'].every((key) => keys.includes(key)) && keys.length === 2;
    const isWeekly = ['Weekday', 'Hour', 'Minute'].every((key) => keys.includes(key)) && keys.length === 3;
    const isMonthly = ['Day', 'Hour', 'Minute'].every((key) => keys.includes(key)) && keys.length === 3;

    // 只映射固定时刻的日、周、月三类规则，其余复杂组合继续交给 JSON 编辑。
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return {
        hasValue: true,
        supported: false,
        kind: 'daily',
        hour: DEFAULT_DAILY_HOUR,
        minute: DEFAULT_DAILY_MINUTE,
        weekday: DEFAULT_WEEKLY_WEEKDAY,
        monthDay: DEFAULT_MONTHLY_DAY,
        warning: '当前任务使用了高级日历规则，基础表单无法完整表达。',
      };
    }

    if (isDaily) {
      return {
        hasValue: true,
        supported: true,
        kind: 'daily',
        hour: clampNumber(hour, 0, 23),
        minute: clampNumber(minute, 0, 59),
        weekday: DEFAULT_WEEKLY_WEEKDAY,
        monthDay: DEFAULT_MONTHLY_DAY,
        warning: '',
      };
    }

    if (isWeekly && Number.isFinite(weekday)) {
      return {
        hasValue: true,
        supported: true,
        kind: 'weekly',
        hour: clampNumber(hour, 0, 23),
        minute: clampNumber(minute, 0, 59),
        weekday: clampNumber(weekday, 0, 6),
        monthDay: DEFAULT_MONTHLY_DAY,
        warning: '',
      };
    }

    if (isMonthly && Number.isFinite(monthDay)) {
      return {
        hasValue: true,
        supported: true,
        kind: 'monthly',
        hour: clampNumber(hour, 0, 23),
        minute: clampNumber(minute, 0, 59),
        weekday: DEFAULT_WEEKLY_WEEKDAY,
        monthDay: clampNumber(monthDay, 1, 31),
        warning: '',
      };
    }

    return {
      hasValue: true,
      supported: false,
      kind: 'daily',
      hour: DEFAULT_DAILY_HOUR,
      minute: DEFAULT_DAILY_MINUTE,
      weekday: DEFAULT_WEEKLY_WEEKDAY,
      monthDay: DEFAULT_MONTHLY_DAY,
      warning: '当前任务使用了高级日历规则，基础表单无法完整表达。',
    };
  } catch {
    return {
      hasValue: true,
      supported: false,
      kind: 'daily',
      hour: DEFAULT_DAILY_HOUR,
      minute: DEFAULT_DAILY_MINUTE,
      weekday: DEFAULT_WEEKLY_WEEKDAY,
      monthDay: DEFAULT_MONTHLY_DAY,
        warning: '当前任务的日历配置不是合法 JSON，建议改用原始 plist 修正。',
    };
  }
}

/**
 * 从已有标识中提取更易读的任务名称。
 */
function buildFriendlyName(label, fileName) {
  const source = String(label || fileName || '')
    .replace(/\.plist$/i, '')
    .trim();

  if (!source) {
    return '';
  }

  const fragments = source.split(/[./_-]+/).filter(Boolean);
  return fragments[fragments.length - 1] || source;
}

/**
 * 生成适合作为文件名的片段。
 */
function buildSlug(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'task';
}

/**
 * 补齐 plist 文件后缀。
 */
function ensurePlistFileName(value) {
  const content = String(value || '').trim();

  if (!content) {
    return '';
  }

  return content.toLowerCase().endsWith('.plist') ? content : `${content}.plist`;
}

/**
 * 生成日志文件名片段。
 */
function buildLogFileStem(value) {
  const content = String(value || '')
    .trim()
    .replace(/\.plist$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  return content || 'task';
}

/**
 * 根据当前任务身份推导日志文件名。
 */
function buildSuggestedLogStem(values = {}, preferredIdentity = '') {
  const identity = buildGeneratedIdentity(values);
  return buildLogFileStem(preferredIdentity || identity.fileName || identity.label || values.friendlyName);
}

/**
 * 根据任务名称生成自动 Label。
 */
function buildAutoLabelFromFriendlyName(value) {
  return `com.launchd-panel.${buildSlug(value || 'task')}`;
}

/**
 * 根据当前输入生成自动文件名。
 */
function buildAutoFileName(values = {}, preferLabel = false) {
  if (preferLabel && String(values.label || '').trim()) {
    return ensurePlistFileName(String(values.label || '').trim());
  }

  if (String(values.label || '').trim()) {
    return ensurePlistFileName(String(values.label || '').trim());
  }

  const seed = String(values.friendlyName || 'task').trim();
  return ensurePlistFileName(`com.launchd-panel.${buildSlug(seed)}`);
}

/**
 * 保持原目录，仅替换日志文件名。
 */
function replaceLogFileName(path, stem, stream) {
  const content = String(path || '').trim();

  if (!content) {
    return '';
  }

  const lastSlashIndex = content.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? content.slice(0, lastSlashIndex + 1) : '';
  return `${directory}${stem}.${stream}.log`;
}

/**
 * 选择可复用的日志目录基准路径。
 */
function pickLogSeedPath(values = {}, stream, fallbackPaths = {}) {
  const currentPath = String((stream === 'stdout' ? values.standardOutPath : values.standardErrorPath) || '').trim();
  const siblingPath = String((stream === 'stdout' ? values.standardErrorPath : values.standardOutPath) || '').trim();
  const fallbackPath = String((stream === 'stdout' ? fallbackPaths.stdout : fallbackPaths.stderr) || '').trim();
  const fallbackSiblingPath = String((stream === 'stdout' ? fallbackPaths.stderr : fallbackPaths.stdout) || '').trim();

  return currentPath || siblingPath || fallbackPath || fallbackSiblingPath;
}

/**
 * 根据当前任务标识生成日志路径。
 */
function buildSuggestedLogPath(values = {}, stream, fallbackPaths = {}) {
  const seedPath = pickLogSeedPath(values, stream, fallbackPaths);

  // 没有目录基准时不强行拼接，避免生成无效路径。
  if (!seedPath) {
    return '';
  }

  return replaceLogFileName(seedPath, buildSuggestedLogStem(values), stream);
}

/**
 * 从当前用户任务 plist 路径推导默认日志目录。
 */
function inferLogDirectoryFromServiceId(serviceId = '') {
  const content = String(serviceId || '').trim();
  const marker = '/Library/LaunchAgents/';
  const markerIndex = content.indexOf(marker);

  // 只有当前用户任务能稳定反推出家目录，其他范围保持空值。
  if (markerIndex <= 0) {
    return '';
  }

  return `${content.slice(0, markerIndex)}/Library/Logs/launchd-panel`;
}

/**
 * 根据用户输入推导内部标识。
 */
function buildGeneratedIdentity(values = {}) {
  const fileName = ensurePlistFileName(values.fileName);
  const label = String(values.label || '').trim();

  if (label && fileName) {
    return {
      label,
      fileName,
    };
  }

  const seed = values.friendlyName || values.label || fileName.replace(/\.plist$/i, '') || 'task';
  const slug = buildSlug(seed);
  const resolvedLabel = label || `com.launchd-panel.${slug}`;

  return {
    label: resolvedLabel,
    fileName: fileName || ensurePlistFileName(resolvedLabel),
  };
}

/**
 * 将编辑器表单数据转成页面表单值。
 */
function buildFormValues(editor) {
  const form = editor?.form || {};
  const calendarPlan = parseCalendarPlan(form.startCalendarIntervalJson);
  const intervalPlan = splitInterval(Number(form.startInterval || 0) || DEFAULT_INTERVAL_MINUTES * 60);
  let scheduleType = 'manual';
  let timedRuleType = 'interval';

  // 先判断是否存在定时规则，再回退到登录执行。
  if (calendarPlan.hasValue) {
    scheduleType = 'timed';
    timedRuleType = calendarPlan.supported ? calendarPlan.kind : 'daily';
  } else if (Number(form.startInterval || 0) > 0) {
    scheduleType = 'timed';
    timedRuleType = 'interval';
  } else if (form.runAtLoad) {
    scheduleType = 'login';
  }

  return {
    ...form,
    friendlyName: buildFriendlyName(form.label, editor?.fileName || form.fileName),
    programArgumentsText: (form.programArguments || []).join('\n'),
    watchPathsText: (form.watchPaths || []).join('\n'),
    environmentVariablesText: envMapToText(form.environmentVariables),
    scheduleType,
    timedRuleType,
    intervalValue: intervalPlan.value,
    intervalUnit: intervalPlan.unit || DEFAULT_INTERVAL_UNIT,
    calendarHour: calendarPlan.hour,
    calendarMinute: calendarPlan.minute,
    calendarWeekday: calendarPlan.weekday,
    calendarMonthDay: calendarPlan.monthDay,
    guideRunAtLoad: scheduleType === 'login' ? true : Boolean(form.runAtLoad),
    restartPolicy: form.keepAlive ? 'always' : 'none',
  };
}

/**
 * 将基础表单字段回写为真正的 launchd 表单字段。
 */
function normalizeGuideValues(values) {
  const identity = buildGeneratedIdentity(values);
  const scheduleType = String(values.scheduleType || 'manual');
  const timedRuleType = String(values.timedRuleType || 'interval');
  let runAtLoad = false;
  let startInterval = 0;
  let startCalendarIntervalJson = '';

  switch (scheduleType) {
    case 'login':
      runAtLoad = true;
      break;
    case 'timed':
      runAtLoad = Boolean(values.guideRunAtLoad);

      // 间隔执行与日历执行共用“定时执行”入口，再按子类型决定实际字段。
      if (timedRuleType === 'interval') {
        startInterval = intervalToSeconds(values.intervalValue || DEFAULT_INTERVAL_MINUTES, values.intervalUnit || DEFAULT_INTERVAL_UNIT);
      } else {
        startCalendarIntervalJson = buildCalendarRuleJSON(timedRuleType, values);
      }
      break;
    default:
      runAtLoad = false;
      break;
  }

  return {
    ...values,
    label: identity.label,
    fileName: identity.fileName,
    runAtLoad,
    keepAlive: values.restartPolicy === 'always',
    startInterval,
    startCalendarIntervalJson,
  };
}

/**
 * 根据当前表单构造保存补丁。
 */
function buildFormPatch(values) {
  const normalizedValues = normalizeGuideValues(values);

  return {
    label: normalizedValues.label || '',
    fileName: normalizedValues.fileName || '',
    program: normalizedValues.program || '',
    programArguments: textToLines(normalizedValues.programArgumentsText || ''),
    workingDirectory: normalizedValues.workingDirectory || '',
    runAtLoad: Boolean(normalizedValues.runAtLoad),
    keepAlive: Boolean(normalizedValues.keepAlive),
    startInterval: Number(normalizedValues.startInterval || 0),
    startCalendarIntervalJson: normalizedValues.startCalendarIntervalJson || '',
    standardOutPath: normalizedValues.standardOutPath || '',
    standardErrorPath: normalizedValues.standardErrorPath || '',
    environmentVariables: textToEnvMap(normalizedValues.environmentVariablesText || ''),
    watchPaths: textToLines(normalizedValues.watchPathsText || ''),
  };
}

/**
 * 生成简洁的调度摘要。
 */
function buildScheduleSummary(values) {
  const normalizedValues = buildFormPatch(values);
  const calendarPlan = parseCalendarPlan(normalizedValues.startCalendarIntervalJson);
  const calendarSummary = buildCalendarPlanSummary(calendarPlan);

  if (calendarSummary) {
    return calendarSummary;
  }

  // 可视化表单无法完整表达的规则，至少要明确告诉用户仍存在复杂调度。
  if (calendarPlan.hasValue) {
    return '复杂日历规则';
  }

  if (Number(normalizedValues.startInterval || 0) > 0) {
    return formatIntervalSummary(normalizedValues.startInterval);
  }

  if (normalizedValues.runAtLoad) {
    return '登录或加载后执行';
  }

  return '按需执行';
}

/**
 * 汇总表单模式的兼容性提示。
 */
function buildFormWarnings(values = {}) {
  const warnings = [];
  const calendarPlan = parseCalendarPlan(values.startCalendarIntervalJson);

  if (Number(values.startInterval || 0) > 0 && calendarPlan.hasValue) {
    warnings.push('当前任务同时使用固定间隔和日历规则，表单模式无法完整维护，请改用原始 plist。');
  }
  if (calendarPlan.warning) {
    warnings.push(calendarPlan.warning);
  }

  return warnings;
}

/**
 * 渲染基础表单的分段选择器。
 */
function GuideChoiceGroup({ name, options }) {
  const selectedValue = Form.useWatch(name);
  const currentOption = options.find((option) => option.value === selectedValue) || options[0];

  return (
    <div className="guide-choice-block">
      <Form.Item name={name} className="guide-choice-form-item">
        <Segmented
          className="guide-segmented"
          options={options.map((option) => ({
            label: option.title,
            value: option.value,
          }))}
        />
      </Form.Item>
      <div className="guide-choice-hint">
        <Text className="guide-choice-hint-title">{currentOption.title}</Text>
        <Text type="secondary">{currentOption.description}</Text>
      </div>
    </div>
  );
}

/**
 * 渲染日历规则表单字段。
 */
function CalendarRuleFields({
  typeFieldName = 'calendarRuleType',
  hourFieldName = 'calendarHour',
  minuteFieldName = 'calendarMinute',
  weekdayFieldName = 'calendarWeekday',
  monthDayFieldName = 'calendarMonthDay',
  forcedRuleType = '',
  showRuleType = true,
}) {
  const watchedRuleType = String(Form.useWatch(typeFieldName) || 'daily');
  const ruleType = String(forcedRuleType || watchedRuleType || 'daily');

  return (
    <Row gutter={[16, 0]}>
      {showRuleType ? (
        <Col xs={24}>
          <Form.Item label="规则类型" name={typeFieldName}>
            <Segmented
              block
              options={CALENDAR_RULE_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
            />
          </Form.Item>
        </Col>
      ) : null}

      {ruleType === 'weekly' ? (
        <Col xs={24} md={10}>
          <Form.Item label="周几" name={weekdayFieldName}>
            <Select options={WEEKDAY_OPTIONS} />
          </Form.Item>
        </Col>
      ) : null}

      {ruleType === 'monthly' ? (
        <Col xs={24} md={10}>
          <Form.Item label="日期" name={monthDayFieldName} extra="按自然月日期执行，例如每月 1 日。">
            <InputNumber min={1} max={31} className="full-width" />
          </Form.Item>
        </Col>
      ) : null}

      <Col xs={12} md={ruleType === 'daily' ? 12 : 7}>
        <Form.Item label="小时" name={hourFieldName}>
          <InputNumber min={0} max={23} className="full-width" />
        </Form.Item>
      </Col>
      <Col xs={12} md={ruleType === 'daily' ? 12 : 7}>
        <Form.Item label="分钟" name={minuteFieldName}>
          <InputNumber min={0} max={59} className="full-width" />
        </Form.Item>
      </Col>
    </Row>
  );
}

/**
 * 渲染配置抽屉中的编辑内容。
 */
function ConfigurationPanel({ taskId, resolvedThemeMode, onSaved }) {
  const [editor, setEditor] = useState(null);
  const [form] = Form.useForm();
  const autoManagedRef = useRef({ label: true, fileName: true, stdout: true, stderr: true });
  const autoIdentityRef = useRef({ label: '', fileName: '' });
  const autoLogPathsRef = useRef({ stdout: '', stderr: '' });
  const [panelMode, setPanelMode] = useState(FORM_MODE);
  const [expandedSections, setExpandedSections] = useState([]);
  const [rawXML, setRawXML] = useState('');
  const [validation, setValidation] = useState([]);
  const [submitting, setSubmitting] = useState('');
  const [switchingMode, setSwitchingMode] = useState(false);
  const formValues = Form.useWatch([], form);

  useEffect(() => {
    let cancelled = false;
    autoManagedRef.current = { label: true, fileName: true, stdout: true, stderr: true };
    autoIdentityRef.current = { label: '', fileName: '' };
    autoLogPathsRef.current = { stdout: '', stderr: '' };
    setPanelMode(FORM_MODE);
    setExpandedSections([]);

    /**
     * 拉取编辑器数据。
     */
    async function loadEditor() {
      try {
        const response = await GetServiceEditor(taskId || '');

        if (cancelled) {
          return;
        }

        setEditor(response);
        setRawXML(response.rawXML || '');
        setValidation(response.validation || []);
        const nextFormValues = buildFormValues(response);
        form.setFieldsValue(nextFormValues);

        // 新建任务时记录一份系统建议值，后续只在用户未手改时跟随身份字段更新。
        if (!taskId) {
          autoIdentityRef.current = {
            label: nextFormValues.label || '',
            fileName: ensurePlistFileName(nextFormValues.fileName || ''),
          };
          autoLogPathsRef.current = {
            stdout: nextFormValues.standardOutPath || '',
            stderr: nextFormValues.standardErrorPath || '',
          };
        }
      } catch (error) {
        if (!cancelled) {
          message.error(getErrorMessage(error, '加载编辑器失败'));
        }
      }
    }

    loadEditor();

    return () => {
      cancelled = true;
    };
  }, [form, taskId]);

  /**
   * 在表单模式下自动维护名称、标识、文件名与日志路径。
   */
  function handleFormValuesChange(changedValues) {
    if (taskId || !editor || panelMode !== FORM_MODE) {
      return;
    }

    const values = form.getFieldsValue(true);
    const currentLabel = String(values.label || '').trim();
    const currentFileName = ensurePlistFileName(values.fileName || '');
    const currentStandardOutPath = String(values.standardOutPath || '').trim();
    const currentStandardErrorPath = String(values.standardErrorPath || '').trim();
    const updates = {};

    // 用户直接改 Label 时，只有改回自动值才恢复托管。
    if (Object.prototype.hasOwnProperty.call(changedValues, 'label')) {
      autoManagedRef.current.label = currentLabel === autoIdentityRef.current.label;
    }

    // 用户直接改文件名时，同样按“是否仍等于自动值”判断是否继续托管。
    if (Object.prototype.hasOwnProperty.call(changedValues, 'fileName')) {
      autoManagedRef.current.fileName = currentFileName === autoIdentityRef.current.fileName;
    }

    // 日志路径被用户手改后，后续不再自动覆盖。
    if (Object.prototype.hasOwnProperty.call(changedValues, 'standardOutPath')) {
      autoManagedRef.current.stdout = currentStandardOutPath === autoLogPathsRef.current.stdout;
    }

    // 错误日志沿用相同托管策略。
    if (Object.prototype.hasOwnProperty.call(changedValues, 'standardErrorPath')) {
      autoManagedRef.current.stderr = currentStandardErrorPath === autoLogPathsRef.current.stderr;
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'friendlyName') && autoManagedRef.current.label) {
      updates.label = buildAutoLabelFromFriendlyName(values.friendlyName);
    }

    if (autoManagedRef.current.fileName) {
      if (Object.prototype.hasOwnProperty.call(changedValues, 'label')) {
        updates.fileName = buildAutoFileName({ ...values, label: currentLabel }, true);
      } else if (Object.prototype.hasOwnProperty.call(changedValues, 'friendlyName')) {
        updates.fileName = buildAutoFileName({ ...values, label: updates.label || currentLabel }, false);
      }
    }

    let logSeed = '';
    if (Object.prototype.hasOwnProperty.call(changedValues, 'fileName')) {
      logSeed = currentFileName;
    } else if (Object.prototype.hasOwnProperty.call(changedValues, 'label')) {
      logSeed = currentLabel;
    } else if (Object.prototype.hasOwnProperty.call(changedValues, 'friendlyName')) {
      logSeed = updates.label || currentLabel || updates.fileName || currentFileName;
    }

    const nextStandardOutPath = logSeed
      ? replaceLogFileName(autoLogPathsRef.current.stdout, buildSuggestedLogStem(values, logSeed), 'stdout')
      : '';
    const nextStandardErrorPath = logSeed
      ? replaceLogFileName(autoLogPathsRef.current.stderr, buildSuggestedLogStem(values, logSeed), 'stderr')
      : '';

    // 只有日志路径仍等于系统建议值时才联动，避免覆盖用户手填路径。
    if (autoManagedRef.current.stdout && nextStandardOutPath && currentStandardOutPath !== nextStandardOutPath) {
      updates.standardOutPath = nextStandardOutPath;
    }

    // 错误日志保持同样的自动维护策略。
    if (autoManagedRef.current.stderr && nextStandardErrorPath && currentStandardErrorPath !== nextStandardErrorPath) {
      updates.standardErrorPath = nextStandardErrorPath;
    }

    if (Object.keys(updates).length > 0) {
      form.setFieldsValue(updates);
    }

    autoIdentityRef.current = {
      label: updates.label || currentLabel,
      fileName: ensurePlistFileName(updates.fileName || currentFileName),
    };
    autoLogPathsRef.current = {
      stdout: updates.standardOutPath || currentStandardOutPath,
      stderr: updates.standardErrorPath || currentStandardErrorPath,
    };
  }

  /**
   * 返回当前编辑请求体。
   */
  async function buildRequest(options = {}) {
    const { validateForm = true } = options;
    let values = form.getFieldsValue(true);

    // 切模式只做同步，不强制阻塞用户；保存和校验仍然执行完整校验。
    if (validateForm && panelMode !== RAW_MODE) {
      await form.validateFields();
      values = form.getFieldsValue(true);
    }

    return {
      id: editor?.serviceId || '',
      scope: editor?.scopeKey || 'user-agent',
      fileName: buildFormPatch(values).fileName || editor?.fileName || '',
      rawXML,
      formPatch: buildFormPatch(values),
      mode: panelMode === RAW_MODE ? 'raw' : 'form',
    };
  }

  /**
   * 将当前草稿同步成统一的表单和 XML 结构。
   */
  async function syncDraftState() {
    const request = await buildRequest({ validateForm: false });
    const response = await ValidateServiceConfig(request);
    setValidation(response.validation || []);
    setRawXML(response.rawXML || request.rawXML || '');
    form.setFieldsValue(buildFormValues({ form: response.form, fileName: request.fileName }));
  }

  /**
   * 切换编辑模式前先同步当前草稿，确保表单和 plist 数据实时流通。
   */
  async function handleModeChange(nextMode) {
    if (nextMode === panelMode || switchingMode) {
      return;
    }

    setSwitchingMode(true);

    try {
      await syncDraftState();
      setPanelMode(nextMode);
    } catch (error) {
      message.error(getErrorMessage(error, '模式切换同步失败'));
    } finally {
      setSwitchingMode(false);
    }
  }

  /**
   * 执行校验。
   */
  async function handleValidate() {
    setSubmitting('validate');

    try {
      const request = await buildRequest();
      const response = await ValidateServiceConfig(request);
      setValidation(response.validation || []);
      setRawXML(response.rawXML || rawXML);
      form.setFieldsValue(buildFormValues({ form: response.form, fileName: request.fileName }));
      message.success(response.ok ? '配置校验通过' : '配置存在问题，请先修复');
    } catch (error) {
      message.error(getErrorMessage(error, '校验失败'));
    } finally {
      setSubmitting('');
    }
  }

  /**
   * 执行保存。
   */
  async function handleSave(applyLoad) {
    setSubmitting(applyLoad ? 'save-load' : 'save');

    try {
      const request = await buildRequest();
      const response = await SaveServiceConfig({
        ...request,
        applyLoad,
      });

      setEditor(response.editor);
      setRawXML(response.editor.rawXML || response.detail.rawXML || rawXML);
      setValidation(response.validation || []);
      form.setFieldsValue(buildFormValues(response.editor));
      onSaved(response);
      message.success(applyLoad ? '配置已保存并加载' : '配置已保存');
    } catch (error) {
      message.error(getErrorMessage(error, '保存失败'));
    } finally {
      setSubmitting('');
    }
  }

  /**
   * 根据任务标识手动生成日志路径。
   */
  function handleGenerateLogPath(fieldName, stream) {
    const values = form.getFieldsValue(true);
    const inferredLogDirectory = inferLogDirectoryFromServiceId(editor?.serviceId);
    const nextPath = buildSuggestedLogPath(values, stream, {
      stdout: autoLogPathsRef.current.stdout || editor?.form?.standardOutPath || (inferredLogDirectory ? `${inferredLogDirectory}/task.stdout.log` : ''),
      stderr: autoLogPathsRef.current.stderr || editor?.form?.standardErrorPath || (inferredLogDirectory ? `${inferredLogDirectory}/task.stderr.log` : ''),
    });

    // 仍然拿不到目录时再提示用户，避免旧任务无日志配置时无法生成。
    if (!nextPath) {
      message.warning('当前无法推断日志目录，请先手填一条日志路径。');
      return;
    }

    form.setFieldsValue({ [fieldName]: nextPath });

    // 用户主动采用建议值后，恢复该字段的自动托管。
    if (stream === 'stdout') {
      autoManagedRef.current.stdout = true;
      autoLogPathsRef.current.stdout = nextPath;
      return;
    }

    autoManagedRef.current.stderr = true;
    autoLogPathsRef.current.stderr = nextPath;
  }

  /**
   * 渲染带生成按钮的日志路径字段。
   */
  function renderLogPathField({ label, name, stream, extra, placeholder }) {
    return (
      <Form.Item label={label} extra={extra}>
        <Space.Compact block>
          <Form.Item name={name} noStyle>
            <Input placeholder={placeholder} />
          </Form.Item>
          <Button type="default" onClick={() => handleGenerateLogPath(name, stream)}>
            按标识生成
          </Button>
        </Space.Compact>
      </Form.Item>
    );
  }

  const issueSummary = useMemo(() => {
    if (validation.length === 0) {
      return '当前未发现额外校验问题。';
    }

    return validation.map((issue) => `${issue.field || '配置'}：${issue.message}`).join('；');
  }, [validation]);

  const currentValues = formValues || buildFormValues(editor);
  const previewPatch = useMemo(() => buildFormPatch(currentValues || {}), [currentValues]);
  const formWarnings = useMemo(() => buildFormWarnings(currentValues || {}), [currentValues]);
  const scheduleType = String(currentValues?.scheduleType || 'manual');
  const timedRuleType = String(currentValues?.timedRuleType || 'interval');
  const summaryItems = useMemo(() => {
    return [
      { label: '内部标识', value: previewPatch.label || '保存时自动生成' },
      { label: '配置文件', value: previewPatch.fileName || '保存时自动生成' },
      { label: '执行程序', value: previewPatch.program || '未设置' },
      { label: '运行方式', value: buildScheduleSummary(currentValues || {}) },
      { label: '异常处理', value: previewPatch.keepAlive ? '异常退出后自动拉起' : '执行完后结束' },
      { label: '工作目录', value: previewPatch.workingDirectory || '跟随系统默认目录' },
    ];
  }, [currentValues, previewPatch]);

  /**
   * 维护折叠面板展开状态，避免表单重渲染时丢失。
   */
  function handleCollapseChange(nextKeys) {
    setExpandedSections(Array.isArray(nextKeys) ? nextKeys : [nextKeys]);
  }

  /**
   * 渲染表单模式主表单。
   */
  function renderFormContent() {
    return (
      <Space direction="vertical" size={16} className="full-width">
        {formWarnings.map((warning) => (
          <Alert key={warning} type="warning" showIcon message={warning} />
        ))}

        <Card size="small" className="inner-card config-section-card">
          <div className="config-section-heading">
            <Text className="config-section-eyebrow">一步一项</Text>
            <Title level={5}>先告诉系统这是什么任务</Title>
            <Paragraph type="secondary">
              只填你真正关心的信息，内部 `Label` 和文件名可以先留空，保存时会自动生成。
            </Paragraph>
          </div>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="任务名称"
                name="friendlyName"
                rules={[{ required: true, message: '请输入任务名称' }]}
              >
                <Input placeholder="例如：每天备份下载目录" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="工作目录" name="workingDirectory" extra="留空时由脚本自行决定运行目录。">
                <Input placeholder="/Users/me/workspace" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                label="执行程序"
                name="program"
                extra="通常填写脚本解释器或可执行文件，例如 /bin/zsh、/usr/bin/python3。"
              >
                <Input placeholder="/usr/local/bin/task" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                label="附加参数"
                name="programArgumentsText"
                extra="每行一个参数，第一行不要重复填写上面的程序路径。"
              >
                <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="每行一个参数" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card size="small" className="inner-card config-section-card">
          <div className="config-section-heading">
            <Text className="config-section-eyebrow">运行规则</Text>
            <Title level={5}>它应该在什么时候运行</Title>
            <Paragraph type="secondary">先决定是不是定时执行；如果是，再补充具体的间隔或时间规则。</Paragraph>
          </div>
          <div className="guide-schedule-stack">
            <GuideChoiceGroup name="scheduleType" options={SCHEDULE_OPTIONS} />

            {scheduleType === 'timed' ? (
              <div className="guide-schedule-fields">
                <GuideChoiceGroup name="timedRuleType" options={TIMED_RULE_OPTIONS} />

                {timedRuleType === 'interval' ? (
                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="执行间隔" extra="支持秒、分钟、小时、天。">
                        <Space.Compact block>
                          <Form.Item name="intervalValue" noStyle>
                            <InputNumber min={1} max={999999} className="full-width" />
                          </Form.Item>
                          <Form.Item name="intervalUnit" noStyle>
                            <Select options={INTERVAL_UNIT_OPTIONS} style={{ width: 110 }} />
                          </Form.Item>
                        </Space.Compact>
                      </Form.Item>
                    </Col>
                  </Row>
                ) : (
                  <CalendarRuleFields showRuleType={false} forcedRuleType={timedRuleType} />
                )}

                <Form.Item label="加载后立即执行一次" name="guideRunAtLoad" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
            ) : null}

            {scheduleType === 'manual' ? (
              <Alert
                className="guide-manual-alert"
                type="info"
                showIcon
                message="手动模式不会自动启动，适合只想临时运行或手动加载的任务。"
              />
            ) : null}
          </div>
        </Card>

        <Card size="small" className="inner-card config-section-card">
          <div className="config-section-heading">
            <Text className="config-section-eyebrow">异常处理</Text>
            <Title level={5}>程序退出后要不要自动再拉起</Title>
            <Paragraph type="secondary">如果这是守护型服务，建议开启自动拉起；如果只是定时脚本，通常保持关闭。</Paragraph>
          </div>
          <GuideChoiceGroup name="restartPolicy" options={RESTART_OPTIONS} />
        </Card>

        <Collapse
          className="config-collapse"
          activeKey={expandedSections}
          onChange={handleCollapseChange}
          items={[
            {
              key: 'advanced',
              label: '高级设置',
              children: (
                <Space direction="vertical" size={16} className="full-width">
                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item label="内部 Label" name="label" extra="留空时自动生成，例如 com.launchd-panel.daily-backup。">
                        <Input placeholder="com.example.demo" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="plist 文件名" name="fileName" extra="留空时自动生成，例如 daily-backup.plist。">
                        <Input placeholder="daily-backup.plist" />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      {renderLogPathField({
                        label: '输出日志路径',
                        name: 'standardOutPath',
                        stream: 'stdout',
                        extra: '填写后，便于在日志抽屉直接查看执行输出。',
                        placeholder: '/Users/me/Library/Logs/task.out.log',
                      })}
                    </Col>
                    <Col xs={24}>
                      {renderLogPathField({
                        label: '错误日志路径',
                        name: 'standardErrorPath',
                        stream: 'stderr',
                        extra: '没有单独错误日志时，也可以和输出日志写成同一路径。',
                        placeholder: '/Users/me/Library/Logs/task.err.log',
                      })}
                    </Col>
                    <Col xs={24}>
                      <Form.Item label="环境变量" name="environmentVariablesText" extra="每行一个 KEY=value。">
                        <TextArea autoSize={{ minRows: 4, maxRows: 6 }} placeholder="KEY=value" />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item label="监听路径" name="watchPathsText" extra="每行一个路径，文件变化时会触发任务。">
                        <TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="每行一个路径" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    );
  }

  /**
   * 渲染主编辑区域。
   */
  function renderMainContent() {
    if (panelMode === RAW_MODE) {
      return (
        <Card size="small" className="inner-card config-section-card full-height-card">
          <div className="config-section-heading">
            <Text className="config-section-eyebrow">权威源</Text>
            <Title level={5}>原始 plist</Title>
            <Paragraph type="secondary">直接维护 XML 内容，适合复杂 `KeepAlive`、`MachServices` 和自定义键。</Paragraph>
          </div>
          <PlistEditor
            value={rawXML}
            onChange={setRawXML}
            readOnly={editor?.readOnly}
            resolvedThemeMode={resolvedThemeMode}
          />
        </Card>
      );
    }

    return (
      <Form layout="vertical" form={form} disabled={editor?.readOnly} onValuesChange={handleFormValuesChange}>
        {renderFormContent()}
      </Form>
    );
  }

  return (
    <Card bordered={false} className="surface-card editor-card">
      <Space direction="vertical" size={16} className="full-width">
        <div className="editor-hero">
          <div className="editor-hero-copy">
            <Tag color="processing">{taskId ? '编辑现有任务' : '创建新任务'}</Tag>
            <Title level={4}>{taskId ? editor?.form?.label || '未命名任务' : '创建 / 编辑配置'}</Title>
            <Paragraph type="secondary">
              默认只保留一套易用表单；低频字段收进高级设置，原始 plist 继续保留给复杂场景。
            </Paragraph>
          </div>
          <Segmented
            options={PANEL_MODES}
            value={panelMode}
            onChange={handleModeChange}
            disabled={switchingMode}
            className="editor-mode-switcher"
          />
        </div>

        {editor?.readOnly ? (
          <Alert type="warning" showIcon message="当前任务属于只读范围，仅支持查看，不允许保存。" />
        ) : null}

        <div className="config-editor-layout">
          <div className="config-editor-main">{renderMainContent()}</div>

          <Space direction="vertical" size={16} className="config-editor-side">
            <Card size="small" className="inner-card config-side-card">
              <div className="config-section-heading compact">
                <Text className="config-section-eyebrow">当前预览</Text>
                <Title level={5}>保存后大致会变成这样</Title>
              </div>
              <List
                size="small"
                dataSource={summaryItems}
                renderItem={(item) => (
                  <List.Item className="config-summary-item">
                    <Text type="secondary">{item.label}</Text>
                    <Text className="config-summary-value">{item.value}</Text>
                  </List.Item>
                )}
              />
            </Card>

            <Card size="small" className="inner-card config-side-card">
              <div className="config-section-heading compact">
                <Text className="config-section-eyebrow">校验反馈</Text>
                <Title level={5}>问题汇总</Title>
                <Paragraph type="secondary">{issueSummary}</Paragraph>
              </div>
              <Space direction="vertical" size={12} className="full-width">
                {validation.length === 0 ? (
                  <Alert type="success" showIcon message="当前没有发现新的校验问题。" />
                ) : null}
                {validation.map((issue) => (
                  <Alert
                    key={`${issue.field}-${issue.message}`}
                    type={issue.level === 'error' ? 'error' : 'warning'}
                    showIcon
                    message={`${issue.field || '配置'}：${issue.message}`}
                  />
                ))}
              </Space>
            </Card>

            <Card size="small" className="inner-card config-side-card">
              <div className="config-section-heading compact">
                <Text className="config-section-eyebrow">提交动作</Text>
                <Title level={5}>保存前可先校验</Title>
              </div>
              <Flex vertical gap={12} className="config-action-stack">
                <Button
                  type="primary"
                  className="config-action-primary"
                  block
                  disabled={editor?.readOnly}
                  loading={submitting === 'save-load'}
                  onClick={() => handleSave(true)}
                >
                  保存并加载
                </Button>
                <Flex gap={10} className="config-action-row">
                  <Button
                    className="config-action-secondary"
                    disabled={editor?.readOnly}
                    loading={submitting === 'save'}
                    onClick={() => handleSave(false)}
                  >
                    保存草稿
                  </Button>
                  <Button
                    className="config-action-secondary"
                    loading={submitting === 'validate'}
                    onClick={handleValidate}
                  >
                    校验
                  </Button>
                </Flex>
                <Text type="secondary" className="config-action-tip">
                  先校验再保存更稳妥；确认无误后再执行加载。
                </Text>
              </Flex>
            </Card>
          </Space>
        </div>
      </Space>
    </Card>
  );
}

export default ConfigurationPanel;
