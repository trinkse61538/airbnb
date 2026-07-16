import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type UiLanguage = 'vi' | 'en';

interface LanguageContextValue {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  text: (vi: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const EN_TO_VI: Record<string, string> = {
  'Apartment Inventory': 'Quản lý căn hộ',
  'Aggregate status and dispatch alerts': 'Theo dõi tồn kho, Wi-Fi và hướng dẫn nhận phòng',
  'Apartment Control Center': 'Trung tâm quản lý căn hộ',
  'Apartment Control Center Tabs': 'Các mục quản lý căn hộ',
  'Main Management': 'Quản lý chính',
  'Inventory': 'Tồn kho',
  'Apartment Inventory Layout': 'Tồn kho căn hộ',
  'Alerts': 'Cảnh báo',
  'Notification & Push Alerts': 'Cảnh báo và thông báo',
  'Cleaner': 'Dọn phòng',
  'Remind Cleaner': 'Nhắc nhân viên dọn phòng',
  'Apartment WiFi': 'Wi-Fi căn hộ',
  'Apartment Wi-Fi': 'Wi-Fi căn hộ',
  'Check-In': 'Nhận phòng',
  'Apartment Check-In': 'Hướng dẫn nhận phòng',
  'Manage': 'Quản lý',
  'Manage Data & Access': 'Quản lý dữ liệu và quyền truy cập',
  'Wi-Fi name': 'Tên Wi-Fi',
  'Password': 'Mật khẩu',
  'Copy full Wi-Fi message': 'Sao chép đầy đủ thông tin Wi-Fi',
  'Copied': 'Đã sao chép',
  'Apartment': 'Căn hộ',
  'Not available': 'Chưa có',
  'network profiles': 'mạng Wi-Fi',
  'Check-in guides': 'Hướng dẫn nhận phòng',
  'Guest access': 'Thông tin cho khách',
  'Active guide': 'Hướng dẫn đang chọn',
  'Copy guest guide': 'Sao chép hướng dẫn cho khách',
  'Guide copied': 'Đã sao chép hướng dẫn',
  'Key collection': 'Nơi nhận chìa khóa',
  'Copy address': 'Sao chép địa chỉ',
  'Open map': 'Mở bản đồ',
  'Visual walkthrough': 'Hướng dẫn bằng hình ảnh',
  'Copy image': 'Sao chép hình ảnh',
  'Copying…': 'Đang sao chép…',
  'Image copied': 'Đã sao chép ảnh',
  'Image unavailable': 'Không tải được ảnh',
  'Step-by-step guest message': 'Nội dung hướng dẫn từng bước',
  'Choose one language before copying the guide.': 'Chọn một ngôn ngữ trước khi sao chép hướng dẫn.',
  'Original check-in details': 'Thông tin nhận phòng bản gốc',
  'Search apartments...': 'Tìm căn hộ...',
  'All Inventory Details': 'Chi tiết toàn bộ vật dụng',
  'Low Stock Items (Action Required):': 'Vật dụng sắp hết (cần xử lý):',
  'No data rows found. Please update your Google Sheets.': 'Không tìm thấy dòng dữ liệu. Hãy cập nhật Google Sheets.',
  'Try searching with another keyword or verify your spreadsheet.': 'Hãy thử từ khóa khác hoặc kiểm tra lại bảng tính.',
  'Great! No apartments are currently low on stock.': 'Tốt! Hiện không có căn hộ nào thiếu vật dụng.',
  'Checked row:': 'Dòng đã kiểm tra:',
  'Row': 'Dòng',
  'Secure': 'An toàn',
  'Column (Item Name)': 'Cột (Tên vật dụng)',
  'Status Value': 'Giá trị trạng thái',
  'Alert Status': 'Trạng thái cảnh báo',
  'Full': 'Đầy đủ',
  'Info': 'Thông tin',
  'All': 'Tất cả',
  'Low Stock': 'Sắp hết',
  'No apartments found': 'Không tìm thấy căn hộ',
  'Fully Stocked': 'Đầy đủ vật dụng',
  'No Data': 'Chưa có dữ liệu',
  'View row details': 'Xem chi tiết dòng',
  'Close': 'Đóng',
  'Loading room layouts and active stock inventory...': 'Đang tải bố cục phòng và dữ liệu tồn kho...',
  'Shortages': 'Căn hộ thiếu đồ',
  'Restock Items': 'Vật dụng cần bổ sung',
  'Data source settings': 'Cài đặt nguồn dữ liệu',
  'Refresh data': 'Làm mới dữ liệu',
  'Update now': 'Cập nhật ngay',
  'A new version is ready.': 'Đã có phiên bản mới.',
  'You are offline. Showing data saved on this device.': 'Bạn đang ngoại tuyến. Dữ liệu đã lưu trên thiết bị đang được hiển thị.',
  'Scroll Down': 'Cuộn xuống',
  'Scroll Up': 'Cuộn lên',
  'Sign out': 'Đăng xuất',
  'Use another account': 'Dùng tài khoản khác',
  'Sign in with Google': 'Đăng nhập bằng Google',
  'Connecting…': 'Đang kết nối…',
  'Checking account access and loading apartment data…': 'Đang kiểm tra quyền và tải dữ liệu căn hộ…',
  'Firebase database setup required': 'Cần hoàn tất thiết lập Firebase',
  'Reload app': 'Tải lại ứng dụng',
  'New apartment': 'Căn hộ mới',
  'Edit apartment': 'Sửa căn hộ',
  'Apartment details': 'Thông tin căn hộ',
  'Apartment name *': 'Tên căn hộ *',
  'Key collection address': 'Địa chỉ nhận chìa khóa',
  'Lockbox code': 'Mã hộp khóa',
  'Lockbox type': 'Loại hộp khóa',
  'Wi-Fi note': 'Ghi chú Wi-Fi',
  'Guest instructions': 'Hướng dẫn cho khách',
  'Check-in photos': 'Ảnh hướng dẫn nhận phòng',
  'Add photos': 'Thêm ảnh',
  'Photo caption': 'Chú thích ảnh',
  'Cancel': 'Hủy',
  'Save apartment': 'Lưu căn hộ',
  'Saving…': 'Đang lưu…',
  'Access control': 'Quyền truy cập',
  'Apartment list': 'Danh sách căn hộ',
  'Main information': 'Thông tin chính',
  'One-time existing data import': 'Nhập dữ liệu hiện tại một lần',
  'Download JSON backup': 'Tải bản sao lưu JSON',
  'Add apartment': 'Thêm căn hộ',
  'Edit': 'Sửa',
  'Delete': 'Xóa',
  'Internal notes': 'Ghi chú nội bộ',
  'General/original instructions': 'Thông tin hướng dẫn chung / bản gốc',
  'Add user': 'Thêm người dùng',
  'Primary admin · cannot be removed': 'Admin chính · không thể xóa',
  'Search apartment or Wi-Fi name…': 'Tìm căn hộ hoặc tên Wi-Fi…',
  'Find an apartment…': 'Tìm căn hộ…',
  'Copy': 'Sao chép',
  'Notification': 'Thông báo',
  'Live Message Preview': 'Xem trước nội dung tin nhắn',
  'Cleaner Information': 'Thông tin nhân viên dọn phòng',
  'Cleaner Handle / Name': 'Tên nhân viên dọn phòng',
  'Copy Message': 'Sao chép tin nhắn',
  'Send Notification': 'Gửi thông báo',
  'No inventory sync yet': 'Chưa đồng bộ tồn kho',
  'Firebase access control': 'Quyền truy cập Firebase',
};

const VI_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_VI).map(([en, vi]) => [vi, en]),
);

const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const renderedAttributes = new WeakMap<Element, Map<string, string>>();
const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;

function translateFragment(value: string, language: UiLanguage): string {
  const dictionary = language === 'vi' ? EN_TO_VI : VI_TO_EN;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  const core = value.trim();
  if (!core) return value;
  if (dictionary[core]) return `${leading}${dictionary[core]}${trailing}`;

  let translated = core;
  for (const [source, target] of Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length)) {
    if (translated.includes(source)) translated = translated.split(source).join(target);
  }
  return `${leading}${translated}${trailing}`;
}

function translateNode(node: Node, language: UiLanguage) {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    const current = textNode.nodeValue || '';
    const lastRendered = renderedText.get(textNode);
    if (!originalText.has(textNode) || current !== lastRendered) originalText.set(textNode, current);
    const next = translateFragment(originalText.get(textNode) || '', language);
    renderedText.set(textNode, next);
    if (current !== next) textNode.nodeValue = next;
    return;
  }

  if (!(node instanceof Element)) return;
  const tag = node.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'code' || tag === 'pre') return;

  let originals = originalAttributes.get(node);
  let rendered = renderedAttributes.get(node);
  if (!originals) {
    originals = new Map();
    originalAttributes.set(node, originals);
  }
  if (!rendered) {
    rendered = new Map();
    renderedAttributes.set(node, rendered);
  }
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    const current = node.getAttribute(attribute);
    if (current === null) continue;
    if (!originals.has(attribute) || current !== rendered.get(attribute)) originals.set(attribute, current);
    const next = translateFragment(originals.get(attribute) || '', language);
    rendered.set(attribute, next);
    if (current !== next) node.setAttribute(attribute, next);
  }
  node.childNodes.forEach(child => translateNode(child, language));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(() => {
    const saved = localStorage.getItem('ui_language');
    return saved === 'en' ? 'en' : 'vi';
  });

  const setLanguage = (nextLanguage: UiLanguage) => {
    localStorage.setItem('ui_language', nextLanguage);
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    translateNode(document.body, language);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateNode(mutation.target, language);
        mutation.addedNodes.forEach(node => translateNode(node, language));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    text: (vi, en) => language === 'vi' ? vi : en,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useUiLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useUiLanguage must be used inside LanguageProvider.');
  return context;
}
