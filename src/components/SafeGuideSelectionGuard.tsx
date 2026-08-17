import { useEffect } from 'react';

type Controller = {
  refresh: () => void;
  cleanup: () => void;
};

const GUIDE_PLACEHOLDER_HTML = `
  <div class="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-xl dark:bg-indigo-950/50">🔎</div>
    <p class="mt-3 text-sm font-extrabold text-slate-800 dark:text-slate-100">Select an apartment first</p>
    <p class="mt-1 max-w-md text-[10px] leading-5 text-slate-500 dark:text-slate-400">Search for an apartment or choose one from the list. If only one search result remains, it opens automatically.</p>
    <p class="mt-1 max-w-md text-[10px] leading-5 text-slate-400">Tìm hoặc chọn đúng căn hộ trước khi xem hướng dẫn. Khi chỉ còn 1 kết quả tìm kiếm, hệ thống sẽ tự mở căn đó.</p>
  </div>`;

const WIFI_PLACEHOLDER_HTML = `
  <div class="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-xl dark:bg-sky-950/50">📶</div>
    <p class="mt-3 text-sm font-extrabold text-slate-800 dark:text-slate-100">Search for an apartment first</p>
    <p class="mt-1 max-w-md text-[10px] leading-5 text-slate-500 dark:text-slate-400">Wi-Fi credentials stay hidden until you search for or select the correct apartment.</p>
    <p class="mt-1 max-w-md text-[10px] leading-5 text-slate-400">Thông tin Wi-Fi sẽ được ẩn cho tới khi bạn tìm hoặc chọn đúng căn hộ.</p>
  </div>`;

function findGuideRoot(input: HTMLInputElement): HTMLElement | null {
  let node: HTMLElement | null = input.parentElement;
  while (node && node !== document.body) {
    const hasDirectAside = Array.from(node.children).some(child => child.tagName === 'ASIDE');
    const hasDirectMain = Array.from(node.children).some(child => child.tagName === 'MAIN');
    if (hasDirectAside && hasDirectMain) return node;
    node = node.parentElement;
  }
  return null;
}

function createGuideController(root: HTMLElement): Controller | null {
  const aside = Array.from(root.children).find(child => child.tagName === 'ASIDE') as HTMLElement | undefined;
  const main = Array.from(root.children).find(child => child.tagName === 'MAIN') as HTMLElement | undefined;
  const input = aside?.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="apartment" i]');
  if (!aside || !main || !input) return null;

  root.dataset.safeGuideRoot = 'true';
  main.dataset.safeGuideMain = 'true';

  const placeholder = document.createElement('div');
  placeholder.dataset.safeGuidePlaceholder = 'true';
  placeholder.innerHTML = GUIDE_PLACEHOLDER_HTML;
  main.prepend(placeholder);

  let manualSelection = false;
  let autoSelecting = false;

  const setPending = (pending: boolean) => {
    root.dataset.safeSelectionPending = pending ? 'true' : 'false';
    main.dataset.safeSelectionPending = pending ? 'true' : 'false';
  };

  const optionButtons = () => Array.from(aside.querySelectorAll<HTMLButtonElement>('button'));

  const refresh = () => {
    const normalized = input.value.trim();
    const buttons = optionButtons();

    if (!normalized) {
      setPending(!manualSelection);
      return;
    }

    if (manualSelection) {
      setPending(false);
      return;
    }

    if (buttons.length === 1) {
      if (!autoSelecting) {
        autoSelecting = true;
        buttons[0].click();
        window.requestAnimationFrame(() => {
          autoSelecting = false;
        });
      }
      setPending(false);
      return;
    }

    setPending(true);
  };

  const onInput = () => {
    manualSelection = false;
    setPending(true);
    window.requestAnimationFrame(refresh);
  };

  const onAsideClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button');
    if (!button || !aside.contains(button)) return;
    manualSelection = true;
    setPending(false);
  };

  input.addEventListener('input', onInput);
  aside.addEventListener('click', onAsideClick);
  setPending(true);

  return {
    refresh,
    cleanup: () => {
      input.removeEventListener('input', onInput);
      aside.removeEventListener('click', onAsideClick);
      placeholder.remove();
      delete root.dataset.safeGuideRoot;
      delete root.dataset.safeSelectionPending;
      delete main.dataset.safeGuideMain;
      delete main.dataset.safeSelectionPending;
    },
  };
}

function createWifiController(input: HTMLInputElement): Controller | null {
  const section = input.closest('section');
  const root = section?.parentElement as HTMLElement | null;
  if (!section || !root) return null;

  root.dataset.safeWifiRoot = 'true';

  const placeholder = document.createElement('div');
  placeholder.dataset.safeWifiPlaceholder = 'true';
  placeholder.innerHTML = WIFI_PLACEHOLDER_HTML;
  section.insertAdjacentElement('afterend', placeholder);

  const clearSelectedCards = () => {
    root.querySelectorAll<HTMLElement>('article[data-safe-wifi-selected="true"]').forEach(article => {
      delete article.dataset.safeWifiSelected;
    });
  };

  const refresh = () => {
    const normalized = input.value.trim();
    root.dataset.safeWifiEmpty = normalized ? 'false' : 'true';

    const articles = Array.from(root.querySelectorAll<HTMLElement>('article'));
    const grid = articles[0]?.parentElement as HTMLElement | null;

    root.querySelectorAll<HTMLElement>('[data-safe-wifi-multiple]').forEach(element => {
      delete element.dataset.safeWifiMultiple;
    });

    articles.forEach(article => {
      delete article.dataset.safeWifiCard;
      article.removeAttribute('role');
      article.removeAttribute('tabindex');
      article.removeAttribute('title');
    });

    if (!normalized || !grid || articles.length <= 1) return;

    grid.dataset.safeWifiMultiple = 'true';
    articles.forEach(article => {
      article.dataset.safeWifiCard = 'true';
      article.setAttribute('role', 'button');
      article.setAttribute('tabindex', '0');
      article.setAttribute('title', 'Select this apartment to reveal Wi-Fi details');
    });
  };

  const selectCard = (article: HTMLElement) => {
    clearSelectedCards();
    article.dataset.safeWifiSelected = 'true';
  };

  const onInput = () => {
    clearSelectedCards();
    root.dataset.safeWifiEmpty = input.value.trim() ? 'false' : 'true';
    window.requestAnimationFrame(refresh);
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const article = target?.closest<HTMLElement>('article[data-safe-wifi-card="true"]');
    if (!article || !root.contains(article)) return;
    selectCard(article);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement | null;
    const article = target?.closest<HTMLElement>('article[data-safe-wifi-card="true"]');
    if (!article || !root.contains(article)) return;
    event.preventDefault();
    selectCard(article);
  };

  input.addEventListener('input', onInput);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  refresh();

  return {
    refresh,
    cleanup: () => {
      input.removeEventListener('input', onInput);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      placeholder.remove();
      clearSelectedCards();
      delete root.dataset.safeWifiRoot;
      delete root.dataset.safeWifiEmpty;
      root.querySelectorAll<HTMLElement>('[data-safe-wifi-multiple]').forEach(element => {
        delete element.dataset.safeWifiMultiple;
      });
    },
  };
}

export default function SafeGuideSelectionGuard() {
  useEffect(() => {
    const controllers = new Map<HTMLElement, Controller>();

    const registerGuide = (root: HTMLElement | null) => {
      if (!root || controllers.has(root)) return;
      const controller = createGuideController(root);
      if (controller) controllers.set(root, controller);
    };

    const registerWifi = (input: HTMLInputElement | null) => {
      if (!input) return;
      const section = input.closest('section');
      const root = section?.parentElement as HTMLElement | null;
      if (!root || controllers.has(root)) return;
      const controller = createWifiController(input);
      if (controller) controllers.set(root, controller);
    };

    const scan = () => {
      const parkingWrapper = document.querySelector<HTMLElement>('[data-parking-panel="true"]');
      const parkingInput = parkingWrapper?.querySelector<HTMLInputElement>('aside input');
      registerGuide(parkingInput ? findGuideRoot(parkingInput) : null);

      document.querySelectorAll<HTMLInputElement>('input[placeholder="Find an apartment…"]').forEach(input => {
        if (input.closest('[data-parking-panel="true"]')) return;
        registerGuide(findGuideRoot(input));
      });

      registerWifi(document.querySelector<HTMLInputElement>('input[placeholder^="Search apartment or Wi-Fi"]'));

      controllers.forEach(controller => controller.refresh());
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
      observer.disconnect();
      controllers.forEach(controller => controller.cleanup());
      controllers.clear();
    };
  }, []);

  return (
    <style>{`
      [data-safe-guide-main='true'] > [data-safe-guide-placeholder='true']{display:none}
      [data-safe-guide-main='true'][data-safe-selection-pending='true'] > :not([data-safe-guide-placeholder='true']){display:none!important}
      [data-safe-guide-main='true'][data-safe-selection-pending='true'] > [data-safe-guide-placeholder='true']{display:block!important}
      [data-safe-guide-root='true'][data-safe-selection-pending='true'] aside button{background:transparent!important;border-color:transparent!important}

      [data-safe-wifi-root='true'] > [data-safe-wifi-placeholder='true']{display:none}
      [data-safe-wifi-root='true'][data-safe-wifi-empty='true'] > :not(section):not([data-safe-wifi-placeholder='true']){display:none!important}
      [data-safe-wifi-root='true'][data-safe-wifi-empty='true'] > [data-safe-wifi-placeholder='true']{display:block!important}
      [data-safe-wifi-multiple='true'] > article{cursor:pointer}
      [data-safe-wifi-multiple='true'] > article > div:nth-child(n+2){display:none!important}
      [data-safe-wifi-multiple='true'] > article[data-safe-wifi-selected='true'] > div:nth-child(n+2){display:block!important}
      [data-safe-wifi-multiple='true'] > article[data-safe-wifi-selected='true']{border-color:rgb(165 180 252)!important;box-shadow:0 0 0 1px rgb(199 210 254)}
    `}</style>
  );
}
