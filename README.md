# launchd-panel

<p align="center">
  <img src="./build/appicon.png" alt="launchd-panel logo" width="160" />
</p>

A macOS desktop app for inspecting and managing `launchd` jobs and plist files, built with Wails, Go, and React.

[简体中文](./README.zh-CN.md)

## Install

Download the latest `darwin_universal.zip` from [GitHub Releases](https://github.com/slowlyo/launchd-panel/releases), extract it, and move `launchd-panel.app` into your Applications folder.

The current build is not Apple-signed or notarized yet. If macOS blocks the first launch:

- right-click `launchd-panel.app` in Finder and choose `Open`
- or allow it from `System Settings -> Privacy & Security`

## Overview

`launchd-panel` is a macOS desktop app for inspecting and managing `launchd` jobs.

It is built with Wails, uses Go for `launchctl`, plist, and log handling, and uses React for the desktop workspace. The current product focuses on:

- browsing user, local, and system `launchd` jobs from one place
- providing real management actions for user-scoped `LaunchAgent` jobs
- editing plist data through a friendlier UI instead of raw XML only
- combining logs, runtime status, validation, and action history in one workspace

## Current Features

### Workspace Snapshot

- Scans the following locations into one unified workspace
  - `~/Library/LaunchAgents`
  - `/Library/LaunchAgents`
  - `/Library/LaunchDaemons`
  - `/System/Library/LaunchAgents`
  - `/System/Library/LaunchDaemons`
- Merges runtime data from `launchctl print` and `launchctl print-disabled`
- Shows job status, exit code, disabled state, schedule, command summary, log availability, and history count
- Provides summary cards and navigation counters
- Supports filtering by navigation group, search keyword, and current selection state

### Job Management

- Real write operations are available for `~/Library/LaunchAgents`
- Supported per-job actions
  - start
  - stop
  - enable
  - disable
  - reload
  - validate
  - delete
- Supported batch actions
  - batch validate
  - batch disable
- System and global jobs are shown with real data but remain read-only

### Configuration Editing

- Creating and editing jobs uses the same configuration drawer
- Three editing modes are available
  - guided mode
  - professional form
  - raw plist
- Structured editing is supported for
  - `Label`
  - `Program`
  - `ProgramArguments`
  - `WorkingDirectory`
  - `RunAtLoad`
  - `KeepAlive`
  - `StartInterval`
  - `StartCalendarInterval`
  - `StandardOutPath`
  - `StandardErrorPath`
  - `EnvironmentVariables`
  - `WatchPaths`
- Unmodified plist keys are preserved when saving from form mode
- New jobs can auto-fill friendly file names and suggested log paths
- You can save only, or save and immediately reload the job

### Details, Logs, and History

- The detail drawer shows
  - status highlights
  - alerts and validation results
  - plist-derived fields
  - `launchctl print` runtime output
  - recent action history
- The log drawer supports
  - `stdout`
  - `stderr`
  - combined view
  - auto refresh
  - live tracking
  - downloading the current log view
  - clearing the current log file
- Action history is persisted locally and remains available after app restarts

### Workspace Settings

- Theme modes
  - light
  - dark
  - follow system
- Remembers whether system jobs should be shown
- Settings are persisted in the local config directory

## Management Scope

| Scope | Path | Capability |
| --- | --- | --- |
| Current user agent | `~/Library/LaunchAgents` | full management |
| Local agent | `/Library/LaunchAgents` | read-only |
| Local daemon | `/Library/LaunchDaemons` | read-only |
| System agent | `/System/Library/LaunchAgents` | read-only |
| System daemon | `/System/Library/LaunchDaemons` | read-only |

## UI Structure

- The main screen uses a compact summary plus job table layout
- The left navigation switches between scope, status, logs, history, and related views
- Clicking a row opens the detail drawer by default
- The context menu and action dropdown can open details, editing, logs, or run actions directly
- Details, configuration, and logs all stay in the right-side drawer so the main table remains the primary workspace

## Tech Stack

### Backend

- Go 1.23
- Wails v2
- `howett.net/plist`

### Frontend

- React 18
- Vite
- Ant Design
- Monaco Editor
- simplebar-react
- Tailwind CSS v4

## Project Structure

```text
launchd-panel/
├── .github/
│   └── workflows/
│       └── release.yml
├── app.go
├── main.go
├── settings.go
├── internal/
│   └── launchd/
│       ├── history.go
│       ├── service.go
│       ├── service_test.go
│       └── types.go
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── style.css
│   │   └── components/
│   │       ├── ConfigurationPanel.jsx
│   │       ├── DetailPanel.jsx
│   │       ├── LogHistoryPanel.jsx
│   │       ├── Navigation.jsx
│   │       ├── PlistEditor.jsx
│   │       ├── ScrollArea.jsx
│   │       ├── SettingsPanel.jsx
│   │       ├── StatusTag.jsx
│   │       ├── SummarySection.jsx
│   │       └── TasksTable.jsx
├── build/
├── README.md
├── README.zh-CN.md
└── wails.json
```

## Development

### Requirements

- macOS
- Go 1.23 or later
- Node.js 18 or later
- `pnpm`
- Wails CLI

### Install Dependencies

```bash
cd "frontend"
pnpm install
```

### Frontend Development

```bash
cd "frontend"
pnpm dev
```

### Desktop Development

```bash
wails dev
```

## Build

### Frontend Build

```bash
cd "frontend"
pnpm build
```

### Desktop App Build

```bash
wails build
```

### Tag Release

Push any tag, for example `v0.1.0`, to trigger GitHub Actions.

The workflow will:

- build the macOS app with `wails build -clean -platform darwin/universal`
- package `build/bin/launchd-panel.app` into a zip archive
- publish a GitHub Release and upload the zip plus SHA-256 checksum

## Notes

- The current version only allows write operations for user-scoped `LaunchAgent` jobs
- System and local jobs are hidden by default and can be enabled from settings
- Log viewing depends on configured `StandardOutPath` and `StandardErrorPath` values
