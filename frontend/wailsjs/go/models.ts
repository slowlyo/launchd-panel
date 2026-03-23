export namespace launchd {
	
	export class ValidationIssue {
	    level: string;
	    field: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ValidationIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.field = source["field"];
	        this.message = source["message"];
	    }
	}
	export class BatchActionResult {
	    id: string;
	    label: string;
	    success: boolean;
	    message: string;
	    issues: ValidationIssue[];
	
	    static createFrom(source: any = {}) {
	        return new BatchActionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.success = source["success"];
	        this.message = source["message"];
	        this.issues = this.convertValues(source["issues"], ValidationIssue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BatchExecuteRequest {
	    ids: string[];
	    action: string;
	
	    static createFrom(source: any = {}) {
	        return new BatchExecuteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ids = source["ids"];
	        this.action = source["action"];
	    }
	}
	export class CapabilityFlags {
	    canStart: boolean;
	    canStop: boolean;
	    canEdit: boolean;
	    canDelete: boolean;
	    canEnable: boolean;
	    canDisable: boolean;
	    canReload: boolean;
	    canReadLogs: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CapabilityFlags(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.canStart = source["canStart"];
	        this.canStop = source["canStop"];
	        this.canEdit = source["canEdit"];
	        this.canDelete = source["canDelete"];
	        this.canEnable = source["canEnable"];
	        this.canDisable = source["canDisable"];
	        this.canReload = source["canReload"];
	        this.canReadLogs = source["canReadLogs"];
	    }
	}
	export class ServiceSummary {
	    id: string;
	    status: string;
	    statusText: string;
	    statusDetail: string;
	    label: string;
	    file: string;
	    scopeKey: string;
	    scope: string;
	    type: string;
	    command: string;
	    args: string;
	    schedule: string;
	    result: string;
	    path: string;
	    readOnly: boolean;
	    disabled: boolean;
	    invalid: boolean;
	    hasLogs: boolean;
	    historyCount: number;
	    capabilities: CapabilityFlags;
	
	    static createFrom(source: any = {}) {
	        return new ServiceSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.status = source["status"];
	        this.statusText = source["statusText"];
	        this.statusDetail = source["statusDetail"];
	        this.label = source["label"];
	        this.file = source["file"];
	        this.scopeKey = source["scopeKey"];
	        this.scope = source["scope"];
	        this.type = source["type"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.schedule = source["schedule"];
	        this.result = source["result"];
	        this.path = source["path"];
	        this.readOnly = source["readOnly"];
	        this.disabled = source["disabled"];
	        this.invalid = source["invalid"];
	        this.hasLogs = source["hasLogs"];
	        this.historyCount = source["historyCount"];
	        this.capabilities = this.convertValues(source["capabilities"], CapabilityFlags);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SummaryCard {
	    label: string;
	    value: number;
	    suffix: string;
	    note: string;
	
	    static createFrom(source: any = {}) {
	        return new SummaryCard(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.value = source["value"];
	        this.suffix = source["suffix"];
	        this.note = source["note"];
	    }
	}
	export class NavigationItem {
	    key: string;
	    label: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new NavigationItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.count = source["count"];
	    }
	}
	export class NavigationGroup {
	    key: string;
	    title: string;
	    items: NavigationItem[];
	
	    static createFrom(source: any = {}) {
	        return new NavigationGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.title = source["title"];
	        this.items = this.convertValues(source["items"], NavigationItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorkspaceSnapshot {
	    refreshedAt: string;
	    navigationGroups: NavigationGroup[];
	    summaryCards: SummaryCard[];
	    tasks: ServiceSummary[];
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.refreshedAt = source["refreshedAt"];
	        this.navigationGroups = this.convertValues(source["navigationGroups"], NavigationGroup);
	        this.summaryCards = this.convertValues(source["summaryCards"], SummaryCard);
	        this.tasks = this.convertValues(source["tasks"], ServiceSummary);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BatchExecuteResponse {
	    results: BatchActionResult[];
	    snapshot: WorkspaceSnapshot;
	
	    static createFrom(source: any = {}) {
	        return new BatchExecuteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = this.convertValues(source["results"], BatchActionResult);
	        this.snapshot = this.convertValues(source["snapshot"], WorkspaceSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ClearServiceLogsRequest {
	    id: string;
	    stream: string;
	
	    static createFrom(source: any = {}) {
	        return new ClearServiceLogsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.stream = source["stream"];
	    }
	}
	export class ClearServiceLogsResponse {
	    serviceId: string;
	    stream: string;
	    clearedPaths: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClearServiceLogsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serviceId = source["serviceId"];
	        this.stream = source["stream"];
	        this.clearedPaths = source["clearedPaths"];
	    }
	}
	export class DetailAlert {
	    type: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new DetailAlert(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.message = source["message"];
	    }
	}
	export class DetailItem {
	    label: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new DetailItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.value = source["value"];
	    }
	}
	export class DetailGroup {
	    key: string;
	    title: string;
	    items: DetailItem[];
	
	    static createFrom(source: any = {}) {
	        return new DetailGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.title = source["title"];
	        this.items = this.convertValues(source["items"], DetailItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ExecuteServiceActionRequest {
	    id: string;
	    action: string;
	
	    static createFrom(source: any = {}) {
	        return new ExecuteServiceActionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.action = source["action"];
	    }
	}
	export class HistoryEntry {
	    id: string;
	    serviceId: string;
	    label: string;
	    action: string;
	    success: boolean;
	    message: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.serviceId = source["serviceId"];
	        this.label = source["label"];
	        this.action = source["action"];
	        this.success = source["success"];
	        this.message = source["message"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceDetail {
	    id: string;
	    status: string;
	    statusText: string;
	    statusDetail: string;
	    label: string;
	    file: string;
	    scopeKey: string;
	    scope: string;
	    type: string;
	    command: string;
	    args: string;
	    schedule: string;
	    result: string;
	    path: string;
	    readOnly: boolean;
	    disabled: boolean;
	    invalid: boolean;
	    hasLogs: boolean;
	    historyCount: number;
	    capabilities: CapabilityFlags;
	    alerts: DetailAlert[];
	    groups: DetailGroup[];
	    validation: ValidationIssue[];
	    runtimeDump: string;
	    lastAction?: HistoryEntry;
	    availableStream: string[];
	
	    static createFrom(source: any = {}) {
	        return new ServiceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.status = source["status"];
	        this.statusText = source["statusText"];
	        this.statusDetail = source["statusDetail"];
	        this.label = source["label"];
	        this.file = source["file"];
	        this.scopeKey = source["scopeKey"];
	        this.scope = source["scope"];
	        this.type = source["type"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.schedule = source["schedule"];
	        this.result = source["result"];
	        this.path = source["path"];
	        this.readOnly = source["readOnly"];
	        this.disabled = source["disabled"];
	        this.invalid = source["invalid"];
	        this.hasLogs = source["hasLogs"];
	        this.historyCount = source["historyCount"];
	        this.capabilities = this.convertValues(source["capabilities"], CapabilityFlags);
	        this.alerts = this.convertValues(source["alerts"], DetailAlert);
	        this.groups = this.convertValues(source["groups"], DetailGroup);
	        this.validation = this.convertValues(source["validation"], ValidationIssue);
	        this.runtimeDump = source["runtimeDump"];
	        this.lastAction = this.convertValues(source["lastAction"], HistoryEntry);
	        this.availableStream = source["availableStream"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ExecuteServiceActionResponse {
	    success: boolean;
	    message: string;
	    detail: ServiceDetail;
	    snapshot: WorkspaceSnapshot;
	
	    static createFrom(source: any = {}) {
	        return new ExecuteServiceActionResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.detail = this.convertValues(source["detail"], ServiceDetail);
	        this.snapshot = this.convertValues(source["snapshot"], WorkspaceSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class LogLine {
	    source: string;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new LogLine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.text = source["text"];
	    }
	}
	
	
	export class ReadServiceLogsRequest {
	    id: string;
	    stream: string;
	    limit: number;
	
	    static createFrom(source: any = {}) {
	        return new ReadServiceLogsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.stream = source["stream"];
	        this.limit = source["limit"];
	    }
	}
	export class ReadServiceLogsResponse {
	    serviceId: string;
	    stream: string;
	    lines: LogLine[];
	    warnings: DetailAlert[];
	    paths: string[];
	
	    static createFrom(source: any = {}) {
	        return new ReadServiceLogsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serviceId = source["serviceId"];
	        this.stream = source["stream"];
	        this.lines = this.convertValues(source["lines"], LogLine);
	        this.warnings = this.convertValues(source["warnings"], DetailAlert);
	        this.paths = source["paths"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceFormData {
	    label: string;
	    fileName: string;
	    program: string;
	    programArguments: string[];
	    workingDirectory: string;
	    runAtLoad: boolean;
	    keepAlive: boolean;
	    startInterval: number;
	    startCalendarIntervalJson: string;
	    standardOutPath: string;
	    standardErrorPath: string;
	    environmentVariables: Record<string, string>;
	    watchPaths: string[];
	
	    static createFrom(source: any = {}) {
	        return new ServiceFormData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.fileName = source["fileName"];
	        this.program = source["program"];
	        this.programArguments = source["programArguments"];
	        this.workingDirectory = source["workingDirectory"];
	        this.runAtLoad = source["runAtLoad"];
	        this.keepAlive = source["keepAlive"];
	        this.startInterval = source["startInterval"];
	        this.startCalendarIntervalJson = source["startCalendarIntervalJson"];
	        this.standardOutPath = source["standardOutPath"];
	        this.standardErrorPath = source["standardErrorPath"];
	        this.environmentVariables = source["environmentVariables"];
	        this.watchPaths = source["watchPaths"];
	    }
	}
	export class SaveServiceConfigRequest {
	    id: string;
	    scope: string;
	    fileName: string;
	    rawXML: string;
	    formPatch: ServiceFormData;
	    mode: string;
	    applyLoad: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SaveServiceConfigRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.scope = source["scope"];
	        this.fileName = source["fileName"];
	        this.rawXML = source["rawXML"];
	        this.formPatch = this.convertValues(source["formPatch"], ServiceFormData);
	        this.mode = source["mode"];
	        this.applyLoad = source["applyLoad"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceEditorState {
	    serviceId: string;
	    mode: string;
	    readOnly: boolean;
	    scopeKey: string;
	    scope: string;
	    fileName: string;
	    rawXML: string;
	    form: ServiceFormData;
	    editableFields: string[];
	    validation: ValidationIssue[];
	
	    static createFrom(source: any = {}) {
	        return new ServiceEditorState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serviceId = source["serviceId"];
	        this.mode = source["mode"];
	        this.readOnly = source["readOnly"];
	        this.scopeKey = source["scopeKey"];
	        this.scope = source["scope"];
	        this.fileName = source["fileName"];
	        this.rawXML = source["rawXML"];
	        this.form = this.convertValues(source["form"], ServiceFormData);
	        this.editableFields = source["editableFields"];
	        this.validation = this.convertValues(source["validation"], ValidationIssue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SaveServiceConfigResponse {
	    serviceId: string;
	    detail: ServiceDetail;
	    editor: ServiceEditorState;
	    snapshot: WorkspaceSnapshot;
	    validation: ValidationIssue[];
	
	    static createFrom(source: any = {}) {
	        return new SaveServiceConfigResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serviceId = source["serviceId"];
	        this.detail = this.convertValues(source["detail"], ServiceDetail);
	        this.editor = this.convertValues(source["editor"], ServiceEditorState);
	        this.snapshot = this.convertValues(source["snapshot"], WorkspaceSnapshot);
	        this.validation = this.convertValues(source["validation"], ValidationIssue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	export class ValidateServiceConfigRequest {
	    id: string;
	    scope: string;
	    fileName: string;
	    rawXML: string;
	    formPatch: ServiceFormData;
	    mode: string;
	
	    static createFrom(source: any = {}) {
	        return new ValidateServiceConfigRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.scope = source["scope"];
	        this.fileName = source["fileName"];
	        this.rawXML = source["rawXML"];
	        this.formPatch = this.convertValues(source["formPatch"], ServiceFormData);
	        this.mode = source["mode"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ValidateServiceConfigResponse {
	    ok: boolean;
	    rawXML: string;
	    form: ServiceFormData;
	    validation: ValidationIssue[];
	
	    static createFrom(source: any = {}) {
	        return new ValidateServiceConfigResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.rawXML = source["rawXML"];
	        this.form = this.convertValues(source["form"], ServiceFormData);
	        this.validation = this.convertValues(source["validation"], ValidationIssue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

