import { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Code, 
  Copy, 
  Check, 
  Clock, 
  ArrowUpRight, 
  HelpCircle,
  Building2,
  Lock,
  Compass,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

interface SetupGuideProps {
  currentSpreadsheetId: string;
}

export default function SetupGuide({ currentSpreadsheetId }: SetupGuideProps) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeMobileOS, setActiveMobileOS] = useState<'ios' | 'android'>('ios');
  const appUrl = new URL(import.meta.env.BASE_URL, window.location.href).href;
  
  // Retrieve saved credentials (if available in localStorage) to pre-populate their Google Apps Script template!
  const [savedSettings, setSavedSettings] = useState({
    telegramBotToken: '',
    telegramChatId: '',
    discordWebhookUrl: '',
    shortageTerms: 'low, empty, 0, shortage, critical'
  });

  useEffect(() => {
    try {
      const notifStr = localStorage.getItem('inventory_notif_configs');
      const termsStr = localStorage.getItem('inventory_shortage_terms');
      if (notifStr) {
        const parsed = JSON.parse(notifStr);
        setSavedSettings(prev => ({
          ...prev,
          telegramBotToken: parsed?.telegram?.botToken || '',
          telegramChatId: parsed?.telegram?.chatId || '',
          discordWebhookUrl: parsed?.discord?.webhookUrl || '',
          shortageTerms: termsStr || 'low, empty, 0, shortage, critical'
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const shortageTermsArray = savedSettings.shortageTerms
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  // Generate customized Google Apps Script code to run completely headlessly and securely in Google Cloud servers at 15:00!
  const generatedAppsScriptCode = `/**
 * APARTMENT INVENTORY TRACKER - AUTOMATED DAILY DISPATCH (15:00 GMT+7)
 * 
 * 💡 Instructions:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/${currentSpreadsheetId || '1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE'}
 * 2. In the top menu, go to "Extensions" -> "Apps Script".
 * 3. Delete any default code in Code.gs, paste this entire custom script.
 * 4. Fill in your token configurations below.
 * 5. Run the "checkInventoryAndNotify" function once to test. (Authorize permissions if prompted by Google).
 * 6. Click the clock icon "Triggers" in the left panel, add a trigger:
 *    - Function: "checkInventoryAndNotify"
 *    - Event source: "Time-driven"
 *    - Timer type: "Day timer"
 *    - Time: "3 PM to 4 PM" (representing 15:00 GMT+7).
 */

const CONFIG = {
  // Google Spreadsheet ID being parsed
  SPREADSHEET_ID: "${currentSpreadsheetId || '1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE'}",

  // Telegram Alert configuration
  TELEGRAM_BOT_TOKEN: "${savedSettings.telegramBotToken || 'YOUR_TELEGRAM_BOT_TOKEN_HERE'}",
  TELEGRAM_CHAT_ID: "${savedSettings.telegramChatId || 'YOUR_TELEGRAM_CHAT_ID_HERE'}",

  // Discord Alert Webhook (Optional fallback)
  DISCORD_WEBHOOK_URL: "${savedSettings.discordWebhookUrl || ''}",

  // Stock terms indicating shortages
  SHORTAGE_TERMS: [${shortageTermsArray.map(t => `"${t}"`).join(', ') || '"low", "empty", "0", "shortage", "critical"'}]
};

function checkInventoryAndNotify() {
  if (!CONFIG.SPREADSHEET_ID) {
    Logger.log("Error: Spreadsheet ID is currently empty.");
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  
  Logger.log("Connecting to spreadsheet: " + ss.getName() + " with " + sheets.length + " tabs.");

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    // Fetch all values starting from Row 1
    const values = sheet.getDataRange().getValues();
    
    // Check if Sheets has at least Row 3 (Index 2 in Apps Script) representing headers
    if (values.length < 3) {
      Logger.log("Skipping tab [" + sheetName + "]: insufficient total rows.");
      return;
    }

    // Row 3 item names/headers (Index 2 in 0-based layout)
    const headers = values[2].map(h => String(h || '').trim());
    
    // Find last index containing any data (skipping everything at Row 3 and prior)
    let lastRowIndex = -1;
    let lastRowCells = [];
    
    for (let r = values.length - 1; r > 2; r--) {
      const row = values[r];
      if (row && row.some(cell => cell && String(cell).trim() !== '')) {
        lastRowIndex = r + 1; // 1-based coordinates
        lastRowCells = row;
        break;
      }
    }

    // No rows updated below headers
    if (lastRowIndex <= 0) {
      Logger.log("Skipping tab [" + sheetName + "]: No inventory reports recorded below Row 3.");
      return;
    }

    // Check shortage items
    let lowItems = [];
    headers.forEach((header, idx) => {
      if (!header) return;
      const cellVal = String(lastRowCells[idx] || '').trim().toLowerCase();
      
      const isLow = CONFIG.SHORTAGE_TERMS.some(term => cellVal === term);
      if (isLow) {
        lowItems.push({ name: header, value: lastRowCells[idx] });
      }
    });

    if (lowItems.length > 0) {
      const listItems = lowItems.map(item => item.name).join(', ');
      
      // Frame the exact template requested by the user
      const message = "⚠️ Apartment " + sheetName + " is low on: " + listItems + ".\\n\\n" +
        "Could you please help me buy the items and remember to keep the receipt so Nathan can transfer the money back to you?\\n\\n" +
        "Also, for the apartments you worked on today, please fill in the inventory status in the stocktracker file here: " +
        "https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit?usp=sharing";

      Logger.log("Low stock found in [" + sheetName + "]: " + listItems + " -> Dispatching notifications.");

      // 1. Dispatch to Telegram
      if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE' && CONFIG.TELEGRAM_CHAT_ID) {
        try {
          const url = "https://api.telegram.org/bot" + CONFIG.TELEGRAM_BOT_TOKEN + "/sendMessage";
          const res = UrlFetchApp.fetch(url, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify({
              chat_id: CONFIG.TELEGRAM_CHAT_ID,
              text: message
            }),
            muteHttpExceptions: true
          });
          Logger.log("Telegram dispatch result code: " + res.getResponseCode());
        } catch(e) {
          Logger.log("Telegram Error: " + e.toString());
        }
      }

      // 2. Dispatch to Discord Webhook
      if (CONFIG.DISCORD_WEBHOOK_URL) {
        try {
          UrlFetchApp.fetch(CONFIG.DISCORD_WEBHOOK_URL, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify({
              content: message
            }),
            muteHttpExceptions: true
          });
          Logger.log("Discord webhook dispatched.");
        } catch(e) {
          Logger.log("Discord Error: " + e.toString());
        }
      }
    } else {
      Logger.log("Status [" + sheetName + "]: Fully Stocked. (No message sent).");
    }
  });
}`;

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(generatedAppsScriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Installation Guide section */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-50">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-slate-800 font-bold text-base font-display">Install App on Phone</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">Transform this dashboard into a fullscreen app on your phone</p>
            </div>
          </div>

          {/* OS Switcher Tab */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveMobileOS('ios')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMobileOS === 'ios'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              🍎 Apple iOS (iPhone/iPad)
            </button>
            <button
              onClick={() => setActiveMobileOS('android')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMobileOS === 'android'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              🤖 Google Android
            </button>
          </div>

          {/* Instructions checklist */}
          {activeMobileOS === 'ios' ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 font-mono text-[11px] text-indigo-900 leading-relaxed flex items-start gap-2.5">
                <span className="text-base">📌</span>
                <p><strong>Note:</strong> On iOS, Apple requires using the built-in <strong>Safari</strong> browser to install websites onto the Home Screen.</p>
              </div>

              <ol className="relative border-l border-slate-100 ml-3.5 pl-6 space-y-6 text-xs text-slate-600">
                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">1</span>
                  <h4 className="font-bold text-slate-800 text-sm">Open Safari</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    Scan the QR code or copy and open the shared web link below on your iPhone's Safari app:
                  </p>
                  <code className="inline-block bg-slate-100 p-1.5 rounded-lg font-mono text-[10px] text-indigo-700 mt-1 px-2.5 break-all">
                    {appUrl}
                  </code>
                </li>

                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">2</span>
                  <h4 className="font-bold text-slate-800 text-sm">Tap "Share" Button</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    At the bottom bar of Safari, tap the <strong>Share</strong> icon (a blue square box with an arrow pointing upwards 📤).
                  </p>
                </li>

                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">3</span>
                  <h4 className="font-bold text-slate-800 text-sm">Select "Add to Home Screen"</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    Scroll down the pop-up options menu and select <strong>"Add to Home Screen"</strong>.
                  </p>
                </li>

                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">✓</span>
                  <h4 className="font-bold text-slate-800 text-sm">Launch and Enjoy!</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    This adds a customized icon to your phone screen. Tap it to load the dashboard in gorgeous full-screen immersive view!
                  </p>
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 font-mono text-[11px] text-indigo-900 leading-relaxed flex items-start gap-2.5">
                <span className="text-base">📌</span>
                <p><strong>Note:</strong> Open this page in your phone's default browser (e.g. <strong>Google Chrome</strong> or standard browser) to easily install.</p>
              </div>

              <ol className="relative border-l border-slate-100 ml-3.5 pl-6 space-y-6 text-xs text-slate-600">
                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">1</span>
                  <h4 className="font-bold text-slate-800 text-sm">Open in Android Chrome</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    Load the follow web address on your Chrome app:
                  </p>
                  <code className="inline-block bg-slate-100 p-1.5 rounded-lg font-mono text-[10px] text-indigo-700 mt-1 px-2.5 break-all">
                    {appUrl}
                  </code>
                </li>

                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">2</span>
                  <h4 className="font-bold text-slate-800 text-sm">Tap Options Menu</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    Tap the <strong>three dots vertical menu</strong> icon (⋮) at the top right of the screen.
                  </p>
                </li>

                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">3</span>
                  <h4 className="font-bold text-slate-800 text-sm">Select "Add to Home Screen"</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    Tap <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong> from the list.
                  </p>
                </li>

                <li className="relative">
                  <span className="absolute -left-[30px] rounded-full w-[20px] h-[20px] bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">✓</span>
                  <h4 className="font-bold text-slate-800 text-sm">Launch standalone app!</h4>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    Chrome will install the app. You can now access it securely without browser address banners!
                  </p>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Daily schedule automation Google Apps Script generator section */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-slate-800 font-bold text-base font-display">Automated Daily Trigger (15:00 GMT+7)</h3>
                <p className="text-slate-500 text-[11px] mt-0.5">Let your Google Sheet run background automated checks autonomously</p>
              </div>
            </div>
            
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
              100% Free & No Hosting Required
            </span>
          </div>

          <div className="text-xs text-slate-600 leading-relaxed space-y-3">
            <p>
              Because your inventory levels are updated inside Google Sheets, we can run check-ins directly inside Google's own secure servers using <strong>Google Apps Script</strong>. 
            </p>
            <p className="font-semibold text-slate-800">Why are we doing this?</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[11px]">
              <li><strong>Zero user interactions:</strong> Run checks automatically at exactly 15:00 GMT+7 even if your phone and computer are completely off or asleep.</li>
              <li><strong>Perfect Privacy:</strong> Secure Google authorization token constraints prevent client web apps from running headlessly without user consent. Google Apps Script bypasses this securely.</li>
              <li><strong>Only Alert Shortages:</strong> Just as requested, fully-stocked apartments are completely ignored. You will only receive notifications for rooms requiring restock attention.</li>
            </ul>
          </div>

          {/* Code block output */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded-t-xl border-t border-x border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Custom Apps Script Code (.gs)</span>
              
              <button
                onClick={handleCopyScript}
                className={`py-1 px-3 text-xs font-semibold rounded-lg border transition duration-150 flex items-center gap-1 cursor-pointer select-none ${
                  copiedScript 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedScript ? 'Copied script to clipboard!' : 'Copy Script'}
              </button>
            </div>

            <pre className="bg-slate-950 text-slate-200 p-4 border-b border-x border-slate-900 rounded-b-xl text-[10px] font-mono whitespace-pre overflow-x-auto max-h-[220px] shadow-inner select-all leading-relaxed">
              {generatedAppsScriptCode}
            </pre>
          </div>

          {/* Quick Step-by-Setup in Apps Script */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl space-y-3.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">⚙️ Easy 2-Minute Installation Instructions</h4>
            
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex gap-2.5 items-start">
                <span className="w-4.5 h-4.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="font-semibold text-slate-800">Paste Script into your Spreadsheet</p>
                  <p className="text-[11px] text-slate-500">
                    Open your inventory Sheet, click <strong>Extensions</strong> → <strong>Apps Script</strong>. Clear any existing code, paste the copied script above, and press the <strong>Save</strong> button (💾).
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="w-4.5 h-4.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="font-semibold text-slate-800">Authorize Google Scope once</p>
                  <p className="text-[11px] text-slate-500">
                    Press <strong>Run</strong> at the top of the Apps Script dashboard. Google will prompt a security popup; click <strong>"Review permissions"</strong> → select your Google Account → click <strong>Advanced</strong> → then <strong>"Go to Untitled project (unsafe)"</strong> to authorize the script to fetch your Sheet. It will run one initial test and trigger Telegram notifications instantly!
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="w-4.5 h-4.5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="font-semibold text-slate-800">Set Timer to 15:00 ICT Daily</p>
                  <p className="text-[11px] text-slate-500">
                    In the left panel of Apps Script, click the **clock icon** (🔒 Triggers) → click <strong>"+ Add Trigger"</strong> in the bottom right:
                  </p>
                  <ul className="list-disc pl-4 mt-1 text-[11px] text-slate-500 space-y-0.5">
                    <li>Function: <code className="bg-slate-100 font-mono px-1 rounded text-indigo-600">checkInventoryAndNotify</code></li>
                    <li>Deployment: <code className="bg-slate-100 font-mono px-1 rounded text-slate-600">Head</code></li>
                    <li>Event source: <strong className="text-slate-700">Time-driven</strong></li>
                    <li>Type of trigger: <strong className="text-slate-700">Day timer</strong></li>
                    <li>Time of day: Select <strong className="text-slate-700">3 PM to 4 PM</strong> (which matches 15:00 GMT+7 ICT!)</li>
                  </ul>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Done! Your automated message loop is now running without intervention.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
