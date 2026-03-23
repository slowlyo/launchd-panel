package launchd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const maxHistoryEntries = 1000

// HistoryStore 负责持久化应用内操作历史。
type HistoryStore struct {
	mu   sync.Mutex
	path string
}

// NewHistoryStore 创建历史存储实例。
func NewHistoryStore() (*HistoryStore, error) {
	// 优先使用用户配置目录，避免污染项目工作区。
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	dir := filepath.Join(configDir, "launchd-panel")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	return &HistoryStore{
		path: filepath.Join(dir, "history.json"),
	}, nil
}

// Append 追加一条历史记录并回写到磁盘。
func (h *HistoryStore) Append(entry HistoryEntry) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	entries, err := h.readAllLocked()
	if err != nil {
		return err
	}

	entries = append(entries, entry)

	// 超出保留上限时只保留最新记录，避免文件无限增长。
	if len(entries) > maxHistoryEntries {
		entries = entries[len(entries)-maxHistoryEntries:]
	}

	return h.writeAllLocked(entries)
}

// ListByService 返回指定服务的最近历史记录。
func (h *HistoryStore) ListByService(serviceID string, limit int) ([]HistoryEntry, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	entries, err := h.readAllLocked()
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 50
	}

	results := make([]HistoryEntry, 0, limit)

	for index := len(entries) - 1; index >= 0; index-- {
		entry := entries[index]

		// 只返回目标服务对应的记录，保证详情面板聚焦。
		if entry.ServiceID != serviceID {
			continue
		}

		results = append(results, entry)
		if len(results) >= limit {
			break
		}
	}

	return results, nil
}

// CountMap 返回每个服务对应的历史数量。
func (h *HistoryStore) CountMap() (map[string]int, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	entries, err := h.readAllLocked()
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int, len(entries))

	for _, entry := range entries {
		counts[entry.ServiceID]++
	}

	return counts, nil
}

// NewEntry 构造一条标准历史记录。
func (h *HistoryStore) NewEntry(serviceID string, label string, action string, success bool, message string) HistoryEntry {
	now := time.Now()

	return HistoryEntry{
		ID:        now.Format("20060102150405.000000000"),
		ServiceID: serviceID,
		Label:     label,
		Action:    action,
		Success:   success,
		Message:   message,
		CreatedAt: now.Format(time.RFC3339Nano),
	}
}

// readAllLocked 读取全部历史记录。
func (h *HistoryStore) readAllLocked() ([]HistoryEntry, error) {
	data, err := os.ReadFile(h.path)
	if err != nil {
		// 首次启动没有历史文件时返回空列表。
		if os.IsNotExist(err) {
			return []HistoryEntry{}, nil
		}
		return nil, err
	}

	if len(data) == 0 {
		return []HistoryEntry{}, nil
	}

	var entries []HistoryEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, err
	}

	return entries, nil
}

// writeAllLocked 将历史记录原子写回磁盘。
func (h *HistoryStore) writeAllLocked(entries []HistoryEntry) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}

	tempPath := h.path + ".tmp"
	if err := os.WriteFile(tempPath, data, 0o644); err != nil {
		return err
	}

	return os.Rename(tempPath, h.path)
}
