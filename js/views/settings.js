import { esc } from "../utils/dom.js";
import { intro } from "../components/table.js";
import { renderUserGuideButton, bindUserGuide } from "../components/user-guide.js";
import { renderWelcomeGuide } from "../components/welcome-guide.js";
import { APP_VERSION } from "../config/constants.js";
import { renderGroupManager, bindGroupManager } from "../components/group-manager.js";

export function renderSettingsView({ project, container, onUpdate }) {
  container.innerHTML =
    intro("Help, version information, and dashboard settings.") +
    `<section class="panel-section">
      <h3 class="section-heading">Help</h3>
      ${renderUserGuideButton()}
      ${renderWelcomeGuide()}
    </section>` +
    `<section class="panel-section">
      <h3 class="section-heading">About</h3>
      <p>Version <strong>${esc(APP_VERSION)}</strong></p>
      <p class="muted">Your files stay on your computer — nothing is uploaded to the internet.</p>
    </section>` +
    (project
      ? `<section class="panel-section">
          <h3 class="section-heading">Manage student groups</h3>
          ${renderGroupManager(project)}
        </section>`
      : "");

  bindUserGuide();
  if (project) bindGroupManager(project, () => onUpdate?.());
}
