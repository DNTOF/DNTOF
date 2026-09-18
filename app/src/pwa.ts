import { isWallpaper } from "./wallpaper";

// PWA/SW disabled: this deployment shares one domain with static sub-pages
// (platform/, dnt-118/, redeem.html). A root-scope service worker would
// intercept those pages, so offline caching stays off.
let installPrompt: InstallPrompt | undefined;
let tell: (message: string) => void = () => {};

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const installed = () => matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  refresh();
});

export function pwaSettingsMarkup() {
  if (isWallpaper) return "";
  const guidance = installed() ? "已从主屏幕打开。"
    : ios() ? "在 Safari 中轻点“分享”→“添加到主屏幕”，然后从主屏幕图标打开。"
    : installPrompt ? "安装后可在独立窗口中打开档案。"
    : "可通过浏览器菜单安装或添加到主屏幕。";
  return `<section id="pwa-settings" class="pwa-settings" aria-label="主屏幕与离线使用"><h3>APP / 主屏幕与离线</h3><p>${guidance}</p><p class="pwa-status" role="status">离线副本已停用：本站与多个静态页面共用域名。</p></section>`;
}

function refresh() {
  const current = document.querySelector("#pwa-settings");
  if (current) current.outerHTML = pwaSettingsMarkup();
}

export async function initPwa(notify: (message: string) => void) {
  void notify;
  tell = notify;
  refresh();
}

document.addEventListener("click", async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-pwa-action]");
  if (!button) return;
  if (button.dataset.pwaAction === "install" && installPrompt) {
    const prompt = installPrompt; installPrompt = undefined;
    try { await prompt.prompt(); await prompt.userChoice; } catch { tell("请通过浏览器菜单添加到主屏幕"); }
    refresh();
  }
});
