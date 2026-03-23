import Editor from '@monaco-editor/react';

/**
 * 返回当前编辑器应使用的主题。
 */
function getMonacoTheme(resolvedThemeMode) {
  return resolvedThemeMode === 'dark' ? 'vs-dark' : 'light';
}

/**
 * 渲染 plist 原始编辑器。
 */
function PlistEditor({ value, onChange, readOnly, resolvedThemeMode }) {
  return (
    <div className="plist-editor-shell">
      <Editor
        height="62vh"
        defaultLanguage="xml"
        language="xml"
        theme={getMonacoTheme(resolvedThemeMode)}
        value={value}
        onChange={(nextValue) => onChange(nextValue || '')}
        options={{
          automaticLayout: true,
          fontSize: 13,
          lineHeight: 22,
          minimap: { enabled: false },
          padding: { top: 16, bottom: 16 },
          readOnly,
          renderLineHighlight: 'all',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabSize: 2,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}

export default PlistEditor;
