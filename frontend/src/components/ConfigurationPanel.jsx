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
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { GetServiceEditor, SaveServiceConfig, ValidateServiceConfig } from '../../wailsjs/go/main/App';
import PlistEditor from './PlistEditor';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const PANEL_MODES = ['麻瓜模式', '专业表单', '原始 plist'];
const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_DAILY_HOUR = 9;
const DEFAULT_DAILY_MINUTE = 0;
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
    value: 'interval',
    title: '固定间隔执行',
    description: '按固定分钟数重复执行。',
  },
  {
    value: 'daily',
    title: '每天固定时间',
    description: '每天在指定时刻运行。',
  },
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
const PROFESSIONAL_FIELD_HELP = {
  label: 'launchd 用它唯一识别任务。修改后会影响加载、重载和历史定位，建议长期保持稳定。',
  fileName: '最终写入 ~/Library/LaunchAgents 的 plist 文件名。通常与 Label 保持可对应，方便排查。',
  program: '明确指定要执行的二进制或解释器路径。留空时，launchd 会尝试从 ProgramArguments 第一项推断。',
  programArgumentsText: '按顺序传给进程的参数列表。每行一个参数，适合脚本路径、选项和运行参数分开维护。',
  workingDirectory: '进程启动时的当前目录。脚本依赖相对路径、读取本地配置或输出文件时通常要设置。',
  runAtLoad: '任务被 bootstrap、登录会话启动或配置重新加载时，是否立即执行一次。',
  keepAlive: '进程退出后是否自动拉起。守护服务适合开启，一次性脚本通常不要开启。',
  startInterval: '固定间隔调度，单位是秒。设置后会按周期重复执行，适合轮询类任务。',
  startCalendarIntervalJson: '日历调度规则，支持对象或对象数组。适合每天定时、每周定时等复杂计划。',
  standardOutPath: '标准输出写入的日志文件。配置后可直接在日志抽屉里查看程序正常输出。',
  standardErrorPath: '标准错误写入的日志文件。程序报错、异常堆栈通常会落到这里。',
  environmentVariablesText: '启动进程前注入的环境变量。每行一个 KEY=value，适合放运行时配置。',
  watchPathsText: '当这些路径发生变化时触发任务。适合文件监听、目录同步等被动触发场景。',
};

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
 * 解析 StartCalendarInterval，提取可映射的每日定时。
 */
function parseCalendarPlan(calendarJSON) {
  const content = String(calendarJSON || '').trim();

  if (!content) {
    return {
      supported: false,
      hour: DEFAULT_DAILY_HOUR,
      minute: DEFAULT_DAILY_MINUTE,
      warning: '',
    };
  }

  try {
    const parsed = JSON.parse(content);
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;

    // 数组或复杂对象只在最简单的“每日固定时刻”下做映射。
    if (Array.isArray(parsed) && parsed.length !== 1) {
      return {
        supported: false,
        hour: DEFAULT_DAILY_HOUR,
        minute: DEFAULT_DAILY_MINUTE,
        warning: '当前任务使用了多段定时，麻瓜模式会改写为单次每日执行。',
      };
    }

    if (!candidate || typeof candidate !== 'object') {
      return {
        supported: false,
        hour: DEFAULT_DAILY_HOUR,
        minute: DEFAULT_DAILY_MINUTE,
        warning: '当前任务的定时结构较特殊，建议用专业表单或原始 plist 维护。',
      };
    }

    const keys = Object.keys(candidate);
    const hour = Number(candidate.Hour);
    const minute = Number(candidate.Minute);
    const unsupportedKeys = keys.filter((key) => !['Hour', 'Minute'].includes(key));

    // 出现周、月、日等额外键时，不再尝试映射到简化模式。
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || unsupportedKeys.length > 0) {
      return {
        supported: false,
        hour: DEFAULT_DAILY_HOUR,
        minute: DEFAULT_DAILY_MINUTE,
        warning: '当前任务使用了高级日历规则，麻瓜模式无法完整表达。',
      };
    }

    return {
      supported: true,
      hour: clampNumber(hour, 0, 23),
      minute: clampNumber(minute, 0, 59),
      warning: '',
    };
  } catch {
    return {
      supported: false,
      hour: DEFAULT_DAILY_HOUR,
      minute: DEFAULT_DAILY_MINUTE,
      warning: '当前任务的日历配置不是合法 JSON，建议先用专业表单修正。',
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
 * 根据用户输入推导内部标识。
 */
function buildGeneratedIdentity(values = {}) {
  const fileName = ensurePlistFileName(values.fileName);

  if (values.label && fileName) {
    return {
      label: String(values.label).trim(),
      fileName,
    };
  }

  const seed = values.friendlyName || values.label || fileName.replace(/\.plist$/i, '') || 'task';
  const slug = buildSlug(seed);

  return {
    label: String(values.label || `com.launchd-panel.${slug}`).trim(),
    fileName: fileName || `${slug}.plist`,
  };
}

/**
 * 将编辑器表单数据转成页面表单值。
 */
function buildFormValues(editor) {
  const form = editor?.form || {};
  const calendarPlan = parseCalendarPlan(form.startCalendarIntervalJson);
  let scheduleType = 'manual';

  // 先用更明确的日历和轮询规则判断，再回退到登录执行。
  if (calendarPlan.supported) {
    scheduleType = 'daily';
  } else if (Number(form.startInterval || 0) > 0) {
    scheduleType = 'interval';
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
    intervalMinutes: Number(form.startInterval || 0) > 0
      ? Math.max(1, Math.round(Number(form.startInterval || 0) / 60))
      : DEFAULT_INTERVAL_MINUTES,
    dailyHour: calendarPlan.hour,
    dailyMinute: calendarPlan.minute,
    guideRunAtLoad: scheduleType === 'login' ? true : Boolean(form.runAtLoad),
    restartPolicy: form.keepAlive ? 'always' : 'none',
  };
}

/**
 * 将麻瓜模式字段回写为真正的 launchd 表单字段。
 */
function normalizeGuideValues(values) {
  const identity = buildGeneratedIdentity(values);
  const scheduleType = String(values.scheduleType || 'manual');
  let runAtLoad = false;
  let startInterval = 0;
  let startCalendarIntervalJson = '';

  switch (scheduleType) {
    case 'login':
      runAtLoad = true;
      break;
    case 'interval':
      runAtLoad = Boolean(values.guideRunAtLoad);
      startInterval = clampNumber(values.intervalMinutes || DEFAULT_INTERVAL_MINUTES, 1, 1440) * 60;
      break;
    case 'daily':
      runAtLoad = Boolean(values.guideRunAtLoad);
      startCalendarIntervalJson = JSON.stringify(
        {
          Hour: clampNumber(values.dailyHour, 0, 23),
          Minute: clampNumber(values.dailyMinute, 0, 59),
        },
        null,
        2,
      );
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
 * 根据当前模式构造保存补丁。
 */
function buildFormPatch(values, panelMode) {
  const normalizedValues = panelMode === '麻瓜模式' ? normalizeGuideValues(values) : {
    ...values,
    ...buildGeneratedIdentity(values),
  };

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
function buildScheduleSummary(values, panelMode) {
  const normalizedValues = panelMode === '麻瓜模式' ? normalizeGuideValues(values) : values;
  const calendarPlan = parseCalendarPlan(normalizedValues.startCalendarIntervalJson);

  if (calendarPlan.supported) {
    return `每天 ${String(calendarPlan.hour).padStart(2, '0')}:${String(calendarPlan.minute).padStart(2, '0')}`;
  }

  if (Number(normalizedValues.startInterval || 0) > 0) {
    return `每 ${Math.round(Number(normalizedValues.startInterval || 0) / 60)} 分钟`;
  }

  if (normalizedValues.runAtLoad) {
    return '登录或加载后执行';
  }

  return '按需执行';
}

/**
 * 汇总麻瓜模式的兼容性提示。
 */
function buildGuideWarnings(editor) {
  const warnings = [];
  const form = editor?.form;

  if (!form) {
    return warnings;
  }

  const calendarPlan = parseCalendarPlan(form.startCalendarIntervalJson);
  if (calendarPlan.warning) {
    warnings.push(calendarPlan.warning);
  }

  // 秒级轮询在麻瓜模式会折算成分钟。
  if (Number(form.startInterval || 0) > 0 && Number(form.startInterval || 0) % 60 !== 0) {
    warnings.push('当前任务使用秒级轮询，麻瓜模式会按分钟显示和保存。');
  }

  return warnings;
}

/**
 * 渲染带帮助提示的字段标题。
 */
function renderFieldLabel(title, description) {
  return (
    <span className="field-help-label">
      <span>{title}</span>
      <Tooltip title={description}>
        <QuestionCircleOutlined className="field-help-trigger" />
      </Tooltip>
    </span>
  );
}

/**
 * 渲染麻瓜模式的分段选择器。
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
 * 渲染配置抽屉中的编辑内容。
 */
function ConfigurationPanel({ taskId, resolvedThemeMode, onSaved }) {
  const [editor, setEditor] = useState(null);
  const [form] = Form.useForm();
  const [panelMode, setPanelMode] = useState(taskId ? '专业表单' : '麻瓜模式');
  const [rawXML, setRawXML] = useState('');
  const [validation, setValidation] = useState([]);
  const [submitting, setSubmitting] = useState('');
  const [switchingMode, setSwitchingMode] = useState(false);
  const formValues = Form.useWatch([], form);

  useEffect(() => {
    let cancelled = false;
    setPanelMode(taskId ? '专业表单' : '麻瓜模式');

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
        form.setFieldsValue(buildFormValues(response));
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || '加载编辑器失败');
        }
      }
    }

    loadEditor();

    return () => {
      cancelled = true;
    };
  }, [form, taskId]);

  /**
   * 返回当前编辑请求体。
   */
  async function buildRequest(options = {}) {
    const { validateForm = true } = options;
    let values = form.getFieldsValue(true);

    // 切模式只做同步，不强制阻塞用户；保存和校验仍然执行完整校验。
    if (validateForm && panelMode !== '原始 plist') {
      await form.validateFields();
      values = form.getFieldsValue(true);
    }

    return {
      id: editor?.serviceId || '',
      scope: editor?.scopeKey || 'user-agent',
      fileName: buildFormPatch(values, panelMode).fileName || editor?.fileName || '',
      rawXML,
      formPatch: buildFormPatch(values, panelMode),
      mode: panelMode === '原始 plist' ? 'raw' : 'form',
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
   * 切换编辑模式前先同步当前草稿，确保三种模式数据实时流通。
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
      message.error(error?.message || '模式切换同步失败');
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
      message.error(error?.message || '校验失败');
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
      message.error(error?.message || '保存失败');
    } finally {
      setSubmitting('');
    }
  }

  const issueSummary = useMemo(() => {
    if (validation.length === 0) {
      return '当前未发现额外校验问题。';
    }

    return validation.map((issue) => `${issue.field || '配置'}：${issue.message}`).join('；');
  }, [validation]);

  const currentValues = formValues || buildFormValues(editor);
  const previewPatch = useMemo(() => buildFormPatch(currentValues || {}, panelMode), [currentValues, panelMode]);
  const guideWarnings = useMemo(() => buildGuideWarnings(editor), [editor]);
  const scheduleType = String(currentValues?.scheduleType || 'manual');
  const summaryItems = useMemo(() => {
    return [
      { label: '内部标识', value: previewPatch.label || '保存时自动生成' },
      { label: '配置文件', value: previewPatch.fileName || '保存时自动生成' },
      { label: '执行程序', value: previewPatch.program || '未设置' },
      { label: '运行方式', value: buildScheduleSummary(currentValues || {}, panelMode) },
      { label: '异常处理', value: previewPatch.keepAlive ? '异常退出后自动拉起' : '执行完后结束' },
      { label: '工作目录', value: previewPatch.workingDirectory || '跟随系统默认目录' },
    ];
  }, [currentValues, panelMode, previewPatch]);

  /**
   * 渲染麻瓜模式主表单。
   */
  function renderGuideForm() {
    return (
      <Space direction="vertical" size={16} className="full-width">
        {guideWarnings.map((warning) => (
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
            <Paragraph type="secondary">选最接近你需求的方式即可，系统会自动映射成 launchd 配置。</Paragraph>
          </div>
          <div className="guide-schedule-stack">
            <GuideChoiceGroup name="scheduleType" options={SCHEDULE_OPTIONS} />

            {scheduleType === 'interval' ? (
              <Row gutter={[16, 0]} className="guide-schedule-fields">
                <Col xs={24} md={12}>
                  <Form.Item label="执行间隔（分钟）" name="intervalMinutes">
                    <InputNumber min={1} max={1440} className="full-width" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="加载后立即执行一次" name="guideRunAtLoad" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            ) : null}

            {scheduleType === 'daily' ? (
              <Row gutter={[16, 0]} className="guide-schedule-fields">
                <Col xs={12} md={6}>
                  <Form.Item label="小时" name="dailyHour">
                    <InputNumber min={0} max={23} className="full-width" />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item label="分钟" name="dailyMinute">
                    <InputNumber min={0} max={59} className="full-width" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="加载后立即执行一次" name="guideRunAtLoad" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
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
          items={[
            {
              key: 'advanced',
              label: '可选高级项',
              children: (
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="输出日志路径"
                      name="standardOutPath"
                      extra="填写后，便于在日志抽屉直接查看执行输出。"
                    >
                      <Input placeholder="/Users/me/Library/Logs/task.out.log" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="错误日志路径"
                      name="standardErrorPath"
                      extra="没有单独错误日志时，也可以和输出日志写成同一路径。"
                    >
                      <Input placeholder="/Users/me/Library/Logs/task.err.log" />
                    </Form.Item>
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
                </Row>
              ),
            },
          ]}
        />
      </Space>
    );
  }

  /**
   * 渲染专业表单。
   */
  function renderProfessionalForm() {
    return (
      <Space direction="vertical" size={16} className="full-width">
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card size="small" className="inner-card config-section-card">
              <div className="config-section-heading">
                <Text className="config-section-eyebrow">基础字段</Text>
                <Title level={5}>任务标识</Title>
                <Paragraph type="secondary">`Label` 和 plist 文件名决定 launchd 中的唯一身份，建议保持稳定。</Paragraph>
              </div>
              <Row gutter={[16, 0]}>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('Label', PROFESSIONAL_FIELD_HELP.label)}
                    name="label"
                    rules={[{ required: true, message: '请输入 Label' }]}
                    extra="建议使用反向域名，例如 com.example.daily-backup。"
                  >
                    <Input placeholder="com.example.demo" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('文件名', PROFESSIONAL_FIELD_HELP.fileName)}
                    name="fileName"
                    rules={[{ required: true, message: '请输入文件名' }]}
                    extra="保存到当前用户 LaunchAgents 目录时会自动清洗非法字符。"
                  >
                    <Input placeholder="com.example.demo.plist" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" className="inner-card config-section-card">
              <div className="config-section-heading">
                <Text className="config-section-eyebrow">命令配置</Text>
                <Title level={5}>程序与参数</Title>
                <Paragraph type="secondary">`Program` 适合单独指定可执行文件，参数按行维护更方便 diff 和排查。</Paragraph>
              </div>
              <Row gutter={[16, 0]}>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('Program', PROFESSIONAL_FIELD_HELP.program)}
                    name="program"
                    extra="可留空，仅使用 ProgramArguments 的第一项作为执行程序。"
                  >
                    <Input placeholder="/usr/local/bin/task" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('ProgramArguments', PROFESSIONAL_FIELD_HELP.programArgumentsText)}
                    name="programArgumentsText"
                    extra="每行一个参数。"
                  >
                    <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="每行一个参数" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label={renderFieldLabel('WorkingDirectory', PROFESSIONAL_FIELD_HELP.workingDirectory)} name="workingDirectory">
                    <Input placeholder="/Users/me/workspace" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" className="inner-card config-section-card">
              <div className="config-section-heading">
                <Text className="config-section-eyebrow">调度配置</Text>
                <Title level={5}>执行时机</Title>
                <Paragraph type="secondary">这里保留原生 launchd 语义，`StartInterval` 单位为秒。</Paragraph>
              </div>
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item label={renderFieldLabel('RunAtLoad', PROFESSIONAL_FIELD_HELP.runAtLoad)} name="runAtLoad" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={renderFieldLabel('KeepAlive', PROFESSIONAL_FIELD_HELP.keepAlive)} name="keepAlive" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label={renderFieldLabel('StartInterval', PROFESSIONAL_FIELD_HELP.startInterval)} name="startInterval">
                    <InputNumber min={0} className="full-width" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('StartCalendarInterval(JSON)', PROFESSIONAL_FIELD_HELP.startCalendarIntervalJson)}
                    name="startCalendarIntervalJson"
                    extra="支持对象或对象数组，适合复杂日历调度。"
                  >
                    <TextArea autoSize={{ minRows: 5, maxRows: 9 }} placeholder='{"Hour":2,"Minute":30}' />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card size="small" className="inner-card config-section-card">
              <div className="config-section-heading">
                <Text className="config-section-eyebrow">输出与环境</Text>
                <Title level={5}>日志、环境变量、监听路径</Title>
                <Paragraph type="secondary">日志路径能直接影响日志抽屉可读性，建议尽量配置。</Paragraph>
              </div>
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item label={renderFieldLabel('StandardOutPath', PROFESSIONAL_FIELD_HELP.standardOutPath)} name="standardOutPath">
                    <Input placeholder="/Users/me/Library/Logs/task.out.log" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label={renderFieldLabel('StandardErrorPath', PROFESSIONAL_FIELD_HELP.standardErrorPath)} name="standardErrorPath">
                    <Input placeholder="/Users/me/Library/Logs/task.err.log" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('EnvironmentVariables', PROFESSIONAL_FIELD_HELP.environmentVariablesText)}
                    name="environmentVariablesText"
                    extra="每行一个 KEY=value。"
                  >
                    <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="KEY=value" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label={renderFieldLabel('WatchPaths', PROFESSIONAL_FIELD_HELP.watchPathsText)}
                    name="watchPathsText"
                    extra="每行一个路径。"
                  >
                    <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="每行一个路径" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Space>
    );
  }

  /**
   * 渲染主编辑区域。
   */
  function renderMainContent() {
    if (panelMode === '原始 plist') {
      return (
        <Card size="small" className="inner-card config-section-card full-height-card">
          <div className="config-section-heading">
            <Text className="config-section-eyebrow">权威源</Text>
            <Title level={5}>原始 plist</Title>
            <Paragraph type="secondary">使用 Monaco Editor 直接维护 XML，适合复杂 `KeepAlive`、`MachServices` 和自定义键。</Paragraph>
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
      <Form layout="vertical" form={form} disabled={editor?.readOnly}>
        {panelMode === '麻瓜模式' ? renderGuideForm() : renderProfessionalForm()}
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
              麻瓜模式面向普通用户，专业表单保留完整字段，原始 plist 用于处理高级键和精细 diff。
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
