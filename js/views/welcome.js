import { renderDropzone, bindDropzone } from "../components/dropzone.js";
import { renderWelcomeGuide } from "../components/welcome-guide.js";
import { renderBeginnerWorkflow } from "../components/beginner-workflow.js";

export function renderWelcomeView({ container, onFiles, onSample }) {
  container.innerHTML =
    renderDropzone() +
    renderBeginnerWorkflow(null) +
    renderWelcomeGuide();
  bindDropzone({ onFiles, onSample });
}
