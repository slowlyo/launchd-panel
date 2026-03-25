package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	updateProgressEventName = "app:update-progress"
	updateLatestReleaseAPI  = "https://api.github.com/repos/slowlyo/launchd-panel/releases/latest"
	updateMetadataFileName  = "staged-update.json"
	updateUserAgentName     = "launchd-panel-updater"
)

// UpdateStatus 描述当前版本检查与安装准备状态。
type UpdateStatus struct {
	CurrentVersion      string `json:"currentVersion"`
	CurrentVersionLabel string `json:"currentVersionLabel"`
	LatestVersion       string `json:"latestVersion"`
	LatestVersionLabel  string `json:"latestVersionLabel"`
	LatestTag           string `json:"latestTag"`
	ReleaseURL          string `json:"releaseUrl"`
	PublishedAt         string `json:"publishedAt"`
	AssetName           string `json:"assetName"`
	AssetSize           int64  `json:"assetSize"`
	HasUpdate           bool   `json:"hasUpdate"`
	ReadyToInstall      bool   `json:"readyToInstall"`
	UpdateSupported     bool   `json:"updateSupported"`
	Status              string `json:"status"`
	Message             string `json:"message"`
	LastCheckedAt       string `json:"lastCheckedAt"`
	DownloadedAt        string `json:"downloadedAt"`
}

// UpdateProgress 描述更新下载与安装过程中的阶段性进度。
type UpdateProgress struct {
	Stage      string  `json:"stage"`
	Message    string  `json:"message"`
	Percent    float64 `json:"percent"`
	Downloaded int64   `json:"downloaded"`
	Total      int64   `json:"total"`
}

// Updater 封装 GitHub Release 检查与本地安装逻辑。
type Updater struct {
	currentVersion string
	httpClient     *http.Client

	mutex         sync.Mutex
	latestRelease *updateReleaseInfo
	stagedUpdate  *stagedUpdateMetadata
	lastCheckedAt time.Time
}

// updateReleaseInfo 保存筛选后的远端版本信息。
type updateReleaseInfo struct {
	Version     string
	Tag         string
	ReleaseURL  string
	PublishedAt string
	AssetName   string
	AssetSize   int64
	AssetURL    string
	Digest      string
	ChecksumURL string
}

// stagedUpdateMetadata 记录本地已下载待安装的更新包。
type stagedUpdateMetadata struct {
	Version       string `json:"version"`
	Tag           string `json:"tag"`
	ReleaseURL    string `json:"releaseUrl"`
	PublishedAt   string `json:"publishedAt"`
	AssetName     string `json:"assetName"`
	StageRoot     string `json:"stageRoot"`
	StagedAppPath string `json:"stagedAppPath"`
	PreparedAt    string `json:"preparedAt"`
}

// githubReleasePayload 对应 GitHub Releases API 返回结构。
type githubReleasePayload struct {
	TagName     string               `json:"tag_name"`
	HTMLURL     string               `json:"html_url"`
	PublishedAt string               `json:"published_at"`
	Assets      []githubReleaseAsset `json:"assets"`
}

// githubReleaseAsset 对应单个 release 资产。
type githubReleaseAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	Digest             string `json:"digest"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// semanticVersion 描述一个可比较的语义化版本。
type semanticVersion struct {
	Major      int
	Minor      int
	Patch      int
	PreRelease string
}

// NewUpdater 创建更新服务实例。
func NewUpdater(currentVersion string) *Updater {
	return &Updater{
		currentVersion: normalizeCurrentVersion(currentVersion),
		httpClient: &http.Client{
			Timeout: 3 * time.Minute,
		},
	}
}

// GetStatus 返回当前已缓存的更新状态。
func (u *Updater) GetStatus() (UpdateStatus, error) {
	u.mutex.Lock()
	defer u.mutex.Unlock()

	if err := u.syncStagedUpdateLocked(); err != nil {
		return UpdateStatus{}, err
	}

	return u.buildStatusLocked(), nil
}

// CheckForUpdates 查询 GitHub 最新正式版并返回结果。
func (u *Updater) CheckForUpdates(ctx context.Context) (UpdateStatus, error) {
	u.emitProgress(ctx, UpdateProgress{
		Stage:   "checking",
		Message: "正在检查最新版本",
	})

	release, err := u.fetchLatestRelease(ctx)
	if err != nil {
		u.emitProgress(ctx, UpdateProgress{
			Stage:   "error",
			Message: "检查更新失败",
		})
		return UpdateStatus{}, err
	}

	u.mutex.Lock()
	defer u.mutex.Unlock()

	u.latestRelease = release
	u.lastCheckedAt = time.Now()

	if err := u.syncStagedUpdateLocked(); err != nil {
		return UpdateStatus{}, err
	}

	status := u.buildStatusLocked()
	u.emitProgress(ctx, UpdateProgress{
		Stage:   status.Status,
		Message: status.Message,
		Percent: 100,
	})

	return status, nil
}

// PrepareUpdate 下载并校验最新更新包，准备后续安装。
func (u *Updater) PrepareUpdate(ctx context.Context) (UpdateStatus, error) {
	u.mutex.Lock()
	if err := u.syncStagedUpdateLocked(); err != nil {
		u.mutex.Unlock()
		return UpdateStatus{}, err
	}

	release := u.latestRelease
	u.mutex.Unlock()

	// 还没有拉取远端信息时，先补一次版本检查。
	if release == nil {
		var err error
		release, err = u.fetchLatestRelease(ctx)
		if err != nil {
			u.emitProgress(ctx, UpdateProgress{
				Stage:   "error",
				Message: "获取更新信息失败",
			})
			return UpdateStatus{}, err
		}

		u.mutex.Lock()
		u.latestRelease = release
		u.lastCheckedAt = time.Now()
		u.mutex.Unlock()
	}

	// 当前已是最新版本时，不再重复下载。
	if compareVersions(release.Version, u.currentVersion) <= 0 {
		u.mutex.Lock()
		status := u.buildStatusLocked()
		u.mutex.Unlock()
		return status, nil
	}

	u.mutex.Lock()
	if u.stagedUpdate != nil && compareVersions(u.stagedUpdate.Version, release.Version) == 0 {
		status := u.buildStatusLocked()
		u.mutex.Unlock()
		return status, nil
	}
	u.mutex.Unlock()

	stageRoot, err := u.prepareStageRoot(release.Version)
	if err != nil {
		return UpdateStatus{}, err
	}

	// 切换版本时先清理旧缓存，避免混用旧包。
	if err := os.RemoveAll(stageRoot); err != nil {
		return UpdateStatus{}, err
	}
	if err := os.MkdirAll(stageRoot, 0o755); err != nil {
		return UpdateStatus{}, err
	}

	archivePath := filepath.Join(stageRoot, release.AssetName)
	extractRoot := filepath.Join(stageRoot, "bundle")

	u.emitProgress(ctx, UpdateProgress{
		Stage:   "downloading",
		Message: "正在下载更新包",
	})

	if err := u.downloadAsset(ctx, release, archivePath); err != nil {
		u.emitProgress(ctx, UpdateProgress{
			Stage:   "error",
			Message: "下载更新包失败",
		})
		return UpdateStatus{}, err
	}

	u.emitProgress(ctx, UpdateProgress{
		Stage:   "verifying",
		Message: "正在校验下载文件",
		Percent: 100,
	})

	expectedDigest, err := u.resolveExpectedDigest(ctx, release)
	if err != nil {
		u.emitProgress(ctx, UpdateProgress{
			Stage:   "error",
			Message: "获取校验摘要失败",
		})
		return UpdateStatus{}, err
	}

	if err := verifySHA256(archivePath, expectedDigest); err != nil {
		u.emitProgress(ctx, UpdateProgress{
			Stage:   "error",
			Message: "更新包校验失败",
		})
		return UpdateStatus{}, err
	}

	u.emitProgress(ctx, UpdateProgress{
		Stage:   "extracting",
		Message: "正在解压更新包",
	})

	if err := extractArchive(ctx, archivePath, extractRoot); err != nil {
		u.emitProgress(ctx, UpdateProgress{
			Stage:   "error",
			Message: "解压更新包失败",
		})
		return UpdateStatus{}, err
	}

	stagedAppPath, err := findAppBundle(extractRoot)
	if err != nil {
		return UpdateStatus{}, err
	}

	metadata := &stagedUpdateMetadata{
		Version:       release.Version,
		Tag:           release.Tag,
		ReleaseURL:    release.ReleaseURL,
		PublishedAt:   release.PublishedAt,
		AssetName:     release.AssetName,
		StageRoot:     stageRoot,
		StagedAppPath: stagedAppPath,
		PreparedAt:    time.Now().Format(time.RFC3339),
	}

	u.mutex.Lock()
	defer u.mutex.Unlock()

	if err := u.clearStagedUpdateLocked(); err != nil {
		return UpdateStatus{}, err
	}
	if err := saveStagedUpdateMetadata(metadata); err != nil {
		return UpdateStatus{}, err
	}

	u.stagedUpdate = metadata
	status := u.buildStatusLocked()

	u.emitProgress(ctx, UpdateProgress{
		Stage:   "ready",
		Message: "更新包已下载完成，重启后即可安装",
		Percent: 100,
	})

	return status, nil
}

// InstallPreparedUpdate 触发后台安装脚本并退出当前应用。
func (u *Updater) InstallPreparedUpdate(ctx context.Context) error {
	u.mutex.Lock()
	defer u.mutex.Unlock()

	if err := u.syncStagedUpdateLocked(); err != nil {
		return err
	}

	// 没有可安装的本地更新包时直接返回错误。
	if u.stagedUpdate == nil {
		return errors.New("当前没有可安装的更新包")
	}

	appPath, err := resolveCurrentAppBundlePath()
	if err != nil {
		return err
	}

	scriptPath, err := buildInstallScript(appPath, u.stagedUpdate)
	if err != nil {
		return err
	}

	u.emitProgress(ctx, UpdateProgress{
		Stage:   "installing",
		Message: "正在准备安装新版本",
	})

	if needsPrivilege(appPath) {
		if err := startPrivilegedInstall(scriptPath); err != nil {
			return err
		}
	} else {
		if err := startBackgroundInstall(scriptPath); err != nil {
			return err
		}
	}

	wailsruntime.Quit(ctx)
	return nil
}

// buildStatusLocked 根据当前缓存状态组装前端可展示信息。
func (u *Updater) buildStatusLocked() UpdateStatus {
	status := UpdateStatus{
		CurrentVersion:      u.currentVersion,
		CurrentVersionLabel: formatVersionLabel(u.currentVersion),
		UpdateSupported:     true,
		Status:              "idle",
		Message:             "尚未检查更新",
	}

	if !u.lastCheckedAt.IsZero() {
		status.LastCheckedAt = u.lastCheckedAt.Format(time.RFC3339)
	}

	// 已经预下载过的版本要优先展示，避免设置面板打开时看不到“可安装”状态。
	if u.stagedUpdate != nil {
		status.HasUpdate = compareVersions(u.stagedUpdate.Version, u.currentVersion) > 0
		status.ReadyToInstall = status.HasUpdate
		status.LatestVersion = u.stagedUpdate.Version
		status.LatestVersionLabel = formatVersionLabel(u.stagedUpdate.Version)
		status.LatestTag = u.stagedUpdate.Tag
		status.ReleaseURL = u.stagedUpdate.ReleaseURL
		status.PublishedAt = u.stagedUpdate.PublishedAt
		status.AssetName = u.stagedUpdate.AssetName
		status.DownloadedAt = u.stagedUpdate.PreparedAt
		status.Status = "ready"
		status.Message = "更新包已准备完成，安装时会自动退出并重启应用"
	}

	// 最新线上版本存在时，用它覆盖展示信息并决定最终状态。
	if u.latestRelease != nil {
		status.LatestVersion = u.latestRelease.Version
		status.LatestVersionLabel = formatVersionLabel(u.latestRelease.Version)
		status.LatestTag = u.latestRelease.Tag
		status.ReleaseURL = u.latestRelease.ReleaseURL
		status.PublishedAt = u.latestRelease.PublishedAt
		status.AssetName = u.latestRelease.AssetName
		status.AssetSize = u.latestRelease.AssetSize

		versionDelta := compareVersions(u.latestRelease.Version, u.currentVersion)
		if versionDelta > 0 {
			status.HasUpdate = true

			// 已缓存同版本更新包时，优先引导直接安装。
			if status.ReadyToInstall && compareVersions(u.stagedUpdate.Version, u.latestRelease.Version) == 0 {
				status.Status = "ready"
				status.Message = "更新包已准备完成，安装时会自动退出并重启应用"
			} else {
				status.ReadyToInstall = false
				status.Status = "available"
				status.Message = "发现新版本，可先下载并在空闲时安装"
			}
			return status
		}

		status.HasUpdate = false
		status.ReadyToInstall = false
		status.Status = "up-to-date"
		status.Message = "当前已是最新版本"
	}

	return status
}

// syncStagedUpdateLocked 同步本地缓存的待安装更新包状态。
func (u *Updater) syncStagedUpdateLocked() error {
	metadata, err := loadStagedUpdateMetadata()
	if err != nil {
		// 本地还没有更新缓存时直接清空内存态。
		if errors.Is(err, os.ErrNotExist) {
			u.stagedUpdate = nil
			return nil
		}
		return err
	}

	// 缓存目录被手动删除后，需要同步清理元数据。
	if _, err := os.Stat(metadata.StagedAppPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			u.stagedUpdate = nil
			return removeStagedUpdateMetadata()
		}
		return err
	}

	// 升级完成后不再展示旧的待安装状态。
	if compareVersions(metadata.Version, u.currentVersion) <= 0 {
		u.stagedUpdate = nil
		return clearStageArtifacts(metadata)
	}

	u.stagedUpdate = metadata
	return nil
}

// clearStagedUpdateLocked 清空当前缓存的待安装更新包。
func (u *Updater) clearStagedUpdateLocked() error {
	if u.stagedUpdate == nil {
		return nil
	}

	if err := clearStageArtifacts(u.stagedUpdate); err != nil {
		return err
	}

	u.stagedUpdate = nil
	return nil
}

// fetchLatestRelease 拉取并筛选 GitHub 最新 release。
func (u *Updater) fetchLatestRelease(ctx context.Context) (*updateReleaseInfo, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, updateLatestReleaseAPI, nil)
	if err != nil {
		return nil, err
	}

	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	request.Header.Set("User-Agent", fmt.Sprintf("%s/%s", updateUserAgentName, u.currentVersion))

	response, err := u.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回异常状态码: %d", response.StatusCode)
	}

	var payload githubReleasePayload
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}

	asset, ok := selectReleaseAssetFor(goruntime.GOOS, goruntime.GOARCH, payload.Assets)
	if !ok {
		return nil, fmt.Errorf("当前平台 %s/%s 暂无可用更新包", goruntime.GOOS, goruntime.GOARCH)
	}

	version, err := normalizeReleaseVersion(payload.TagName)
	if err != nil {
		return nil, err
	}

	checksumURL := ""
	for _, assetItem := range payload.Assets {
		if assetItem.Name == asset.Name+".sha256" {
			checksumURL = assetItem.BrowserDownloadURL
			break
		}
	}

	return &updateReleaseInfo{
		Version:     version,
		Tag:         payload.TagName,
		ReleaseURL:  payload.HTMLURL,
		PublishedAt: payload.PublishedAt,
		AssetName:   asset.Name,
		AssetSize:   asset.Size,
		AssetURL:    asset.BrowserDownloadURL,
		Digest:      asset.Digest,
		ChecksumURL: checksumURL,
	}, nil
}

// prepareStageRoot 返回指定版本的缓存目录。
func (u *Updater) prepareStageRoot(version string) (string, error) {
	cacheDir, err := resolveUpdaterCacheDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(cacheDir, "staged", version), nil
}

// downloadAsset 下载远端更新包并持续上报进度。
func (u *Updater) downloadAsset(ctx context.Context, release *updateReleaseInfo, destination string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, release.AssetURL, nil)
	if err != nil {
		return err
	}

	request.Header.Set("User-Agent", fmt.Sprintf("%s/%s", updateUserAgentName, u.currentVersion))

	response, err := u.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("下载更新包失败，状态码: %d", response.StatusCode)
	}

	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()

	var (
		written      int64
		total        = response.ContentLength
		lastReported = time.Now().Add(-time.Second)
		buffer       = make([]byte, 64*1024)
	)

	for {
		readBytes, readErr := response.Body.Read(buffer)
		if readBytes > 0 {
			if _, err := file.Write(buffer[:readBytes]); err != nil {
				return err
			}

			written += int64(readBytes)

			// 下载过程中按时间节流上报，避免前端收到过多事件。
			if time.Since(lastReported) >= 200*time.Millisecond || (total > 0 && written == total) {
				u.emitProgress(ctx, UpdateProgress{
					Stage:      "downloading",
					Message:    "正在下载更新包",
					Percent:    calculatePercent(written, total),
					Downloaded: written,
					Total:      total,
				})
				lastReported = time.Now()
			}
		}

		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				break
			}
			return readErr
		}
	}

	return nil
}

// resolveExpectedDigest 返回当前更新包应当匹配的 SHA-256。
func (u *Updater) resolveExpectedDigest(ctx context.Context, release *updateReleaseInfo) (string, error) {
	if strings.TrimSpace(release.Digest) != "" {
		return strings.TrimSpace(strings.TrimPrefix(release.Digest, "sha256:")), nil
	}

	if release.ChecksumURL == "" {
		return "", errors.New("当前 release 缺少可用的 SHA-256 信息")
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, release.ChecksumURL, nil)
	if err != nil {
		return "", err
	}

	request.Header.Set("User-Agent", fmt.Sprintf("%s/%s", updateUserAgentName, u.currentVersion))

	response, err := u.httpClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("下载校验文件失败，状态码: %d", response.StatusCode)
	}

	content, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	fields := strings.Fields(string(content))
	if len(fields) == 0 {
		return "", errors.New("校验文件内容为空")
	}

	return strings.TrimSpace(fields[0]), nil
}

// emitProgress 通过 Wails 事件把进度广播给前端。
func (u *Updater) emitProgress(ctx context.Context, progress UpdateProgress) {
	if ctx == nil {
		return
	}

	wailsruntime.EventsEmit(ctx, updateProgressEventName, progress)
}

// normalizeCurrentVersion 统一应用自身版本字符串。
func normalizeCurrentVersion(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "0.0.0-dev"
	}

	return strings.TrimPrefix(trimmed, "v")
}

// normalizeReleaseVersion 从 release tag 中提取可比较版本。
func normalizeReleaseVersion(tag string) (string, error) {
	version := strings.TrimPrefix(strings.TrimSpace(tag), "v")
	if _, err := parseSemanticVersion(version); err != nil {
		return "", fmt.Errorf("无法解析 release 版本 %q: %w", tag, err)
	}
	return version, nil
}

// formatVersionLabel 返回带 v 前缀的展示文本。
func formatVersionLabel(version string) string {
	if version == "" {
		return "未知版本"
	}

	return "v" + strings.TrimPrefix(version, "v")
}

// compareVersions 比较两个语义化版本的先后顺序。
func compareVersions(left string, right string) int {
	leftVersion, leftErr := parseSemanticVersion(left)
	rightVersion, rightErr := parseSemanticVersion(right)

	// 当前版本解析失败时，默认把它视为更旧版本，避免漏报更新。
	if leftErr != nil && rightErr != nil {
		return strings.Compare(left, right)
	}
	if leftErr != nil {
		return -1
	}
	if rightErr != nil {
		return 1
	}

	if leftVersion.Major != rightVersion.Major {
		return compareInt(leftVersion.Major, rightVersion.Major)
	}
	if leftVersion.Minor != rightVersion.Minor {
		return compareInt(leftVersion.Minor, rightVersion.Minor)
	}
	if leftVersion.Patch != rightVersion.Patch {
		return compareInt(leftVersion.Patch, rightVersion.Patch)
	}

	return comparePreRelease(leftVersion.PreRelease, rightVersion.PreRelease)
}

// parseSemanticVersion 解析简化语义化版本。
func parseSemanticVersion(version string) (semanticVersion, error) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(version, "v"))
	if trimmed == "" {
		return semanticVersion{}, errors.New("空版本号")
	}

	buildParts := strings.SplitN(trimmed, "+", 2)
	preReleaseParts := strings.SplitN(buildParts[0], "-", 2)
	segments := strings.Split(preReleaseParts[0], ".")
	if len(segments) == 0 || len(segments) > 3 {
		return semanticVersion{}, fmt.Errorf("非法版本号: %s", version)
	}

	parsed := semanticVersion{}
	var err error

	parsed.Major, err = strconv.Atoi(segments[0])
	if err != nil {
		return semanticVersion{}, err
	}

	if len(segments) > 1 {
		parsed.Minor, err = strconv.Atoi(segments[1])
		if err != nil {
			return semanticVersion{}, err
		}
	}

	if len(segments) > 2 {
		parsed.Patch, err = strconv.Atoi(segments[2])
		if err != nil {
			return semanticVersion{}, err
		}
	}

	if len(preReleaseParts) == 2 {
		parsed.PreRelease = preReleaseParts[1]
	}

	return parsed, nil
}

// compareInt 返回两个整数的比较结果。
func compareInt(left int, right int) int {
	switch {
	case left < right:
		return -1
	case left > right:
		return 1
	default:
		return 0
	}
}

// comparePreRelease 按语义化版本规则比较预发布标签。
func comparePreRelease(left string, right string) int {
	// 正式版优先级高于任何预发布版本。
	if left == "" && right == "" {
		return 0
	}
	if left == "" {
		return 1
	}
	if right == "" {
		return -1
	}

	leftParts := strings.Split(left, ".")
	rightParts := strings.Split(right, ".")
	maxLength := len(leftParts)
	if len(rightParts) > maxLength {
		maxLength = len(rightParts)
	}

	for index := 0; index < maxLength; index++ {
		if index >= len(leftParts) {
			return -1
		}
		if index >= len(rightParts) {
			return 1
		}

		leftValue, leftErr := strconv.Atoi(leftParts[index])
		rightValue, rightErr := strconv.Atoi(rightParts[index])

		// 数字段与文本段混排时，数字段优先级更低。
		if leftErr == nil && rightErr == nil {
			if leftValue != rightValue {
				return compareInt(leftValue, rightValue)
			}
			continue
		}
		if leftErr == nil {
			return -1
		}
		if rightErr == nil {
			return 1
		}

		if leftParts[index] != rightParts[index] {
			return strings.Compare(leftParts[index], rightParts[index])
		}
	}

	return 0
}

// selectReleaseAssetFor 按当前平台选出优先级最高的 release 资产。
func selectReleaseAssetFor(goos string, goarch string, assets []githubReleaseAsset) (githubReleaseAsset, bool) {
	bestAsset := githubReleaseAsset{}
	bestPriority := 0

	for _, asset := range assets {
		priority := assetPriority(asset.Name, goos, goarch)
		if priority > bestPriority {
			bestPriority = priority
			bestAsset = asset
		}
	}

	return bestAsset, bestPriority > 0
}

// assetPriority 返回指定资产在当前平台上的匹配优先级。
func assetPriority(name string, goos string, goarch string) int {
	lowerName := strings.ToLower(name)

	// 校验文件不参与可执行更新包匹配。
	if strings.HasSuffix(lowerName, ".sha256") {
		return 0
	}
	if !strings.HasSuffix(lowerName, ".zip") {
		return 0
	}

	switch goos {
	case "darwin":
		// 现有发布流程优先产出 universal 包。
		if strings.Contains(lowerName, "darwin_universal") {
			return 100
		}
		if strings.Contains(lowerName, "darwin_"+strings.ToLower(goarch)) {
			return 90
		}
		if strings.Contains(lowerName, "darwin") {
			return 80
		}
	case "windows":
		if strings.Contains(lowerName, "windows_"+strings.ToLower(goarch)) {
			return 90
		}
		if strings.Contains(lowerName, "windows") {
			return 80
		}
	case "linux":
		if strings.Contains(lowerName, "linux_"+strings.ToLower(goarch)) {
			return 90
		}
		if strings.Contains(lowerName, "linux") {
			return 80
		}
	}

	return 0
}

// verifySHA256 校验下载文件的 SHA-256 摘要。
func verifySHA256(path string, digest string) error {
	expectedDigest := strings.TrimSpace(strings.TrimPrefix(digest, "sha256:"))
	if expectedDigest == "" {
		return errors.New("缺少可用的 SHA-256 摘要")
	}

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}

	actualDigest := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actualDigest, expectedDigest) {
		return fmt.Errorf("SHA-256 不匹配，期望 %s，实际 %s", expectedDigest, actualDigest)
	}

	return nil
}

// extractArchive 使用系统 ditto 解压更新包，保留应用包权限与元数据。
func extractArchive(ctx context.Context, archivePath string, destination string) error {
	if err := os.RemoveAll(destination); err != nil {
		return err
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return err
	}

	command := exec.CommandContext(ctx, "ditto", "-x", "-k", archivePath, destination)
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ditto 解压失败: %w: %s", err, strings.TrimSpace(string(output)))
	}

	return nil
}

// findAppBundle 在解压目录中寻找 .app 包。
func findAppBundle(root string) (string, error) {
	var foundPath string

	walkErr := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// 找到第一个 .app 包后立即停止遍历。
		if entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".app") {
			foundPath = path
			return filepath.SkipDir
		}

		return nil
	})
	if walkErr != nil {
		return "", walkErr
	}
	if foundPath == "" {
		return "", errors.New("更新包中未找到可安装的 .app 文件")
	}

	return foundPath, nil
}

// resolveCurrentAppBundlePath 返回当前运行应用所在的 .app 目录。
func resolveCurrentAppBundlePath() (string, error) {
	executablePath, err := os.Executable()
	if err != nil {
		return "", err
	}

	resolvedPath, err := filepath.EvalSymlinks(executablePath)
	if err == nil && resolvedPath != "" {
		executablePath = resolvedPath
	}

	currentPath := executablePath
	for {
		// Wails 打包后的主程序总是位于 .app/Contents/MacOS 下。
		if strings.HasSuffix(strings.ToLower(currentPath), ".app") {
			return currentPath, nil
		}

		parentPath := filepath.Dir(currentPath)
		if parentPath == currentPath {
			break
		}
		currentPath = parentPath
	}

	return "", errors.New("当前运行环境不是打包后的 .app，开发模式请手动下载更新")
}

// buildInstallScript 生成退出后执行的后台安装脚本。
func buildInstallScript(appPath string, metadata *stagedUpdateMetadata) (string, error) {
	cacheDir, err := resolveUpdaterCacheDir()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return "", err
	}

	backupPath := filepath.Join(cacheDir, "backups", fmt.Sprintf("Launchd Panel-%s.app", time.Now().Format("20060102-150405")))
	if err := os.MkdirAll(filepath.Dir(backupPath), 0o755); err != nil {
		return "", err
	}

	scriptPath := filepath.Join(cacheDir, fmt.Sprintf("install-%s.sh", strings.ReplaceAll(metadata.Version, ".", "_")))
	scriptContent := fmt.Sprintf(`#!/bin/zsh
set -euo pipefail

APP_PATH=%s
STAGED_APP_PATH=%s
BACKUP_PATH=%s
APP_PID=%d

for _ in {1..120}; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

if kill -0 "$APP_PID" 2>/dev/null; then
  exit 1
fi

if [ -d "$APP_PATH" ]; then
  mv "$APP_PATH" "$BACKUP_PATH"
fi

if ! ditto "$STAGED_APP_PATH" "$APP_PATH"; then
  if [ -d "$BACKUP_PATH" ] && [ ! -d "$APP_PATH" ]; then
    mv "$BACKUP_PATH" "$APP_PATH"
  fi
  exit 1
fi

open "$APP_PATH"
`, shellAssign(appPath), shellAssign(metadata.StagedAppPath), shellAssign(backupPath), os.Getpid())

	if err := os.WriteFile(scriptPath, []byte(scriptContent), 0o755); err != nil {
		return "", err
	}

	return scriptPath, nil
}

// startBackgroundInstall 在当前用户权限下启动安装脚本。
func startBackgroundInstall(scriptPath string) error {
	command := exec.Command("/bin/zsh", scriptPath)
	return command.Start()
}

// startPrivilegedInstall 使用管理员权限启动安装脚本。
func startPrivilegedInstall(scriptPath string) error {
	shellCommand := "/bin/zsh " + shellQuote(scriptPath)
	appleScript := fmt.Sprintf("do shell script %q with administrator privileges", shellCommand)
	command := exec.Command("osascript", "-e", appleScript)
	return command.Start()
}

// needsPrivilege 判断当前应用目录是否需要管理员权限才能写入。
func needsPrivilege(appPath string) bool {
	parentDir := filepath.Dir(appPath)

	testFile, err := os.CreateTemp(parentDir, ".launchd-panel-write-test-*")
	if err != nil {
		return true
	}

	testFile.Close()
	_ = os.Remove(testFile.Name())
	return false
}

// shellAssign 生成 shell 变量赋值字面量。
func shellAssign(value string) string {
	return shellQuote(value)
}

// shellQuote 对 shell 参数做单引号转义。
func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

// calculatePercent 计算下载进度百分比。
func calculatePercent(current int64, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return (float64(current) / float64(total)) * 100
}

// resolveUpdaterCacheDir 返回更新器缓存目录。
func resolveUpdaterCacheDir() (string, error) {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(cacheDir, "launchd-panel", "updater"), nil
}

// resolveStagedUpdateMetadataPath 返回更新元数据文件路径。
func resolveStagedUpdateMetadataPath() (string, error) {
	cacheDir, err := resolveUpdaterCacheDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(cacheDir, updateMetadataFileName), nil
}

// loadStagedUpdateMetadata 读取本地待安装更新元数据。
func loadStagedUpdateMetadata() (*stagedUpdateMetadata, error) {
	metadataPath, err := resolveStagedUpdateMetadataPath()
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(metadataPath)
	if err != nil {
		return nil, err
	}

	var metadata stagedUpdateMetadata
	if err := json.Unmarshal(content, &metadata); err != nil {
		return nil, err
	}

	return &metadata, nil
}

// saveStagedUpdateMetadata 保存待安装更新元数据。
func saveStagedUpdateMetadata(metadata *stagedUpdateMetadata) error {
	metadataPath, err := resolveStagedUpdateMetadataPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(metadataPath), 0o755); err != nil {
		return err
	}

	content, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(metadataPath, content, 0o644)
}

// removeStagedUpdateMetadata 删除本地待安装更新元数据。
func removeStagedUpdateMetadata() error {
	metadataPath, err := resolveStagedUpdateMetadataPath()
	if err != nil {
		return err
	}

	if err := os.Remove(metadataPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return nil
}

// clearStageArtifacts 清理指定待安装更新的缓存目录与元数据。
func clearStageArtifacts(metadata *stagedUpdateMetadata) error {
	if metadata != nil && metadata.StageRoot != "" {
		if err := os.RemoveAll(metadata.StageRoot); err != nil {
			return err
		}
	}

	return removeStagedUpdateMetadata()
}
