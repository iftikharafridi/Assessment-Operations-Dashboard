import {
  emit,
  getState,
  setFilters,
  setInvigilation,
  setProject,
  setTab,
  setCalendarLayout,
  setTrackerShowAll,
  setClassTestScheduleView,
  setClassTestScheduleFilters,
  setClassTestScheduleWeekOffset,
  adjustClassTestScheduleWeekOffset,
  setAssessmentScheduleView,
  setAssessmentScheduleFilters,
  setAssessmentScheduleWeekOffset,
  adjustAssessmentScheduleWeekOffset,
  setAssessmentSubView,
  setTimetableCampus,
  setLastExportAt,
  navigateTo,
  resetFilters,
  subscribe,
} from "./state/store.js";
import { filterTimetableRows, sanitizeFilters } from "./analytics/filters.js";
import { ingestWorkbooks, readWorkbook } from "./excel/reader.js";
import { finalizeProject } from "./model/finalize.js";
import { downloadProjectExcel } from "./excel/writer.js";
import { isExcelReaderReady, isStyledExcelReady, EXCEL_STYLE_ERROR_MSG } from "./excel/xlsx.js";
import { renderExportMenu, bindExportMenu } from "./components/export-menu.js";
import { loadSampleTimetable } from "./data/sample-loader.js";
import { renderFiltersPanel, applyFiltersToDom, bindFilterEvents, readFiltersFromDom, bindFiltersPanel } from "./components/filters.js";
import { renderTabs, bindTabs, normalizeTabId } from "./components/tabs.js";
import { renderProjectFiles, renderImportWarnings } from "./components/dropzone.js";
import { renderExcelReaderError } from "./components/excel-error.js";
import { renderUserGuideButton, bindUserGuide } from "./components/user-guide.js";
import { renderWelcomeView } from "./views/welcome.js";
import { renderDashboardView } from "./views/dashboard.js";
import { renderTrackerView } from "./views/tracker.js";
import { renderAssessmentView } from "./views/assessment.js";
import { renderTimetableView } from "./views/timetable-tab.js";
import { renderInvigilationTabView } from "./views/invigilation-tab.js";
import { renderReportsView } from "./views/reports.js";
import { renderSettingsView } from "./views/settings.js";
import { countOpenIssues } from "./views/issues.js";
import { APP_VERSION } from "./config/constants.js";
import { clearChildren, unique } from "./utils/dom.js";
import {
  setRenderFlushHandler,
  shouldDeferShellRender,
  isShellRenderPaused,
} from "./ui/render-guard.js";
import { bindInlineFieldEditing } from "./ui/inline-edit.js";

const filtersEl = () => document.getElementById("filters");
const tabsEl = () => document.getElementById("tabs");
const mainEl = () => document.getElementById("main");
const headerActionsEl = () => document.getElementById("header-actions");
const projectInfoEl = () => document.getElementById("project-info");
const alertsEl = () => document.getElementById("alerts");
const footerEl = () => document.getElementById("footer-content");

function requireExcelReader() {
  if (isExcelReaderReady()) return true;
  const alerts = alertsEl();
  if (alerts) alerts.innerHTML = renderExcelReaderError();
  return false;
}

function runExport(project, presetId, extraOptions = {}) {
  const state = getState();
  const options = {
    preset: presetId,
    ...extraOptions,
    filters: state.filters,
    activeTab: state.activeTab,
  };
  if (safeDownloadExcel(project, options)) {
    setLastExportAt(new Date().toLocaleString());
    if (presetId === "full" || presetId === "bundleFull") emit({ dirty: false });
  }
}

function safeDownloadExcel(project, options = {}) {
  if (!requireExcelReader()) return false;
  if (!isStyledExcelReady()) {
    if (alertsEl()) {
      alertsEl().innerHTML = `<div class="alert alert-error" role="alert">
        <strong>Excel colours unavailable</strong>
        <p>${EXCEL_STYLE_ERROR_MSG}</p>
      </div>`;
    }
    return false;
  }
  try {
    downloadProjectExcel(project, options);
    return true;
  } catch (err) {
    console.error("Export failed:", err);
    if (alertsEl()) {
      alertsEl().innerHTML = `<div class="alert alert-error" role="alert">
        <strong>Could not export workbook</strong>
        <p>${err?.message || "Something went wrong while building the Excel file."}</p>
        <p class="muted">Try refreshing the page. If the problem continues, use Reports &amp; Export for partial exports.</p>
      </div>`;
    }
    return false;
  }
}

async function loadFiles(fileList, merge = false) {
  if (!requireExcelReader()) return;

  try {
    const parsed = await Promise.all(
      [...fileList].map(async (file) => {
        const buffer = await file.arrayBuffer();
        return readWorkbook(buffer, file.name);
      })
    );

    const incoming = ingestWorkbooks(parsed);
    const state = getState();

    if (merge && state.project) {
      for (const type of Object.keys(incoming.datasets)) {
        for (const ds of incoming.datasets[type]) {
          state.project.addDataset(type, ds);
        }
      }
      Object.assign(state.project.plans, incoming.plans);
      state.project.importWarnings = [...new Set([...(state.project.importWarnings || []), ...incoming.importWarnings])];
      finalizeProject(state.project);
      state.project.touch();
      emit({ project: state.project });
    } else {
      setProject(incoming);
    }
  } catch (err) {
    console.error("Upload failed:", err);
    if (alertsEl()) {
      alertsEl().innerHTML = `<div class="alert alert-error" role="alert">
        <strong>Could not read your file</strong>
        <p>${err?.message || "Something went wrong while opening the Excel file."}</p>
        <p class="muted">Check that the file is a valid .xlsx timetable export, then try again.</p>
      </div>`;
    }
  }
}

async function loadSample() {
  const project = await loadSampleTimetable();
  setProject(project);
}

function renderAlerts(project) {
  const parts = [];
  if (!isExcelReaderReady()) parts.push(renderExcelReaderError());
  if (project?.importWarnings?.length) parts.push(renderImportWarnings(project.importWarnings));
  return parts.join("");
}

function updateDirtyBadge() {
  const state = getState();
  const project = state.project;
  if (projectInfoEl()) {
    projectInfoEl().innerHTML = project
      ? `<span class="project-name">${project.name}</span>${state.dirty ? '<span class="dirty-badge">Unsaved changes</span>' : ""}`
      : "";
  }
}

function renderShell() {
  if (shouldDeferShellRender()) return;
  const state = getState();
  const project = state.project;
  const hasData = project?.getTimetableRows().length;

  if (headerActionsEl()) {
    const helpBtn = renderUserGuideButton();
    headerActionsEl().innerHTML = hasData
      ? `${helpBtn}${renderExportMenu(project)}<button class="btn" id="add-files-btn">Add another file</button>
         <input type="file" id="add-file-input" accept=".xlsx,.xls" multiple hidden>`
      : helpBtn;
    bindUserGuide();
    if (hasData) {
      bindExportMenu({
        project,
        onExport: (presetId) => runExport(project, presetId),
        onSave: () => runExport(project, "full"),
      });
    }
    document.getElementById("add-files-btn")?.addEventListener("click", () => {
      document.getElementById("add-file-input")?.click();
    });
    document.getElementById("add-file-input")?.addEventListener("change", (e) => {
      if (e.target.files?.length) loadFiles(e.target.files, true);
    });
  }

  if (projectInfoEl()) {
    projectInfoEl().innerHTML = project
      ? `<span class="project-name">${project.name}</span>${state.dirty ? '<span class="dirty-badge">Unsaved changes</span>' : ""}`
      : "";
  }

  if (alertsEl()) {
    alertsEl().innerHTML =
      hasData || !isExcelReaderReady() || project?.importWarnings?.length ? renderAlerts(project) : "";
  }

  if (filtersEl()) {
    if (hasData) {
      filtersEl().innerHTML = renderFiltersPanel(project.getTimetableRows(), project, state.filters);
      applyFiltersToDom(state.filters);
      bindFilterEvents(
        () => {
          const next = sanitizeFilters(project.getTimetableRows(), readFiltersFromDom(), project);
          setFilters(next);
        },
        () => resetFilters()
      );
      bindFiltersPanel(project, () => renderShell());
    } else {
      clearChildren(filtersEl());
    }
  }

  if (tabsEl()) {
    tabsEl().innerHTML = hasData ? renderTabs(state.activeTab, { issueCount: countOpenIssues(project) }) : "";
    bindTabs(setTab);
  }

  if (footerEl()) {
    footerEl().innerHTML = `<span>Version ${APP_VERSION}</span> · <span>Your files stay on your computer — nothing is uploaded to the internet.</span>`;
  }

  renderMain();
}

function renderMain() {
  if (shouldDeferShellRender()) return;
  const state = getState();
  const project = state.project;
  const main = mainEl();
  if (!main) return;

  if (!project?.getTimetableRows().length) {
    document.body.classList.add("is-welcome");
    renderWelcomeView({
      container: main,
      onFiles: (files) => loadFiles(files, false),
      onSample: () => loadSample(),
    });
    return;
  }

  document.body.classList.remove("is-welcome");

  const rows = filterTimetableRows(project.getTimetableRows(), state.filters, project);
  const campuses = unique(project.getTimetableRows().map((r) => r.Campus)).sort();
  if (!state.invigCampus && campuses.length) setInvigilation(campuses[0], state.invigDay);

  const ctx = {
    project,
    rows,
    container: main,
    state,
    onNavigate: (tab, partialFilters = {}) => {
      if (partialFilters.campus) setTimetableCampus(partialFilters.campus);
      navigateTo(tab, partialFilters);
    },
    onUpdate: (full = true, kind) => {
      if (kind === "showAll") {
        setTrackerShowAll(full);
        return;
      }
      if (kind === "classTestView") {
        setClassTestScheduleView(full);
        return;
      }
      if (kind === "classTestFilters") {
        setClassTestScheduleFilters(full);
        return;
      }
      if (kind === "classTestWeek") {
        if (full === "reset") setClassTestScheduleWeekOffset(0);
        else adjustClassTestScheduleWeekOffset(full);
        return;
      }
      if (kind === "assessmentScheduleView") {
        setAssessmentScheduleView(full);
        return;
      }
      if (kind === "assessmentScheduleFilters") {
        setAssessmentScheduleFilters(full);
        return;
      }
      if (kind === "assessmentScheduleWeek") {
        if (full === "reset") setAssessmentScheduleWeekOffset(0);
        else adjustAssessmentScheduleWeekOffset(full);
        return;
      }
      if (full === false) {
        updateDirtyBadge();
        return;
      }
      if (isShellRenderPaused()) return;
      renderShell();
    },
    onClear: () => renderShell(),
    onExport: () => runExport(project, "full"),
    onInvigChange: (campus, day) => {
      setInvigilation(campus, day);
    },
    onCalendarLayoutChange: (layout) => {
      setCalendarLayout(layout);
    },
  };

  main.innerHTML = renderProjectFiles(project);

  const viewHost = document.createElement("div");
  viewHost.className = "view-host";
  main.appendChild(viewHost);

  const tab = normalizeTabId(state.activeTab);
  const filterIndependentTabs = ["dashboard", "assessment", "reports", "settings", "invigilation"];

  if (!rows.length && !filterIndependentTabs.includes(tab)) {
    viewHost.innerHTML = `<div class="alert alert-warning" role="status">
      <strong>No sessions match your filters</strong>
      <p>Try clearing one or more filters, or choose <strong>London (all sites)</strong> to include both London RAV and London IH.</p>
    </div>`;
    return;
  }

  const viewCtx = { ...ctx, container: viewHost };

  switch (tab) {
    case "dashboard":
      renderDashboardView(viewCtx);
      break;
    case "tests":
      renderTrackerView(viewCtx);
      break;
    case "assessment":
      renderAssessmentView(viewCtx);
      break;
    case "timetable":
      renderTimetableView({
        ...viewCtx,
        onSelectCampus: (campus) => {
          setTimetableCampus(campus);
          if (campus) setFilters({ ...state.filters, campus });
          renderShell();
        },
      });
      break;
    case "invigilation":
      renderInvigilationTabView(viewCtx);
      break;
    case "reports":
      renderReportsView({
        ...viewCtx,
        onExport: (presetId, extra = {}) => runExport(project, presetId, extra),
        onSave: () => runExport(project, "full"),
      });
      break;
    case "settings":
      renderSettingsView(viewCtx);
      break;
    default:
      setTab("dashboard");
  }
}

export function initApp({ excelReaderReady = true } = {}) {
  setRenderFlushHandler(() => renderShell());
  bindInlineFieldEditing({
    getProject: () => getState().project,
    onDirty: updateDirtyBadge,
  });
  emit({ excelReaderReady });
  subscribe(() => {
    if (!isShellRenderPaused()) renderShell();
    else shouldDeferShellRender();
  });
  renderShell();

  document.body.addEventListener("dragover", (e) => e.preventDefault());
  document.body.addEventListener("drop", (e) => {
    e.preventDefault();
    const state = getState();
    const files = [...e.dataTransfer.files].filter((f) => /\.xlsx?$/i.test(f.name));
    if (!files.length) return;
    loadFiles(files, Boolean(state.project));
  });
}
