import { renderDropzone, bindDropzone } from "../components/dropzone.js";
import { renderWelcomeGuide } from "../components/welcome-guide.js";

export function renderWelcomeView({ container, onFiles, onSample }) {
  container.innerHTML = renderDropzone() + renderWelcomeGuide();
  bindDropzone({ onFiles, onSample });
}
