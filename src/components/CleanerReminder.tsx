import { useState, useEffect } from 'react';
import { SheetReport, NotificationConfigs } from '../types';
import { 
  UserCheck, 
  Send, 
  Copy, 
  Check, 
  Search, 
  Sparkles, 
  Clock,
  Building2,
  Users
} from 'lucide-react';

interface CleanerReminderProps {
  reports: SheetReport[];
}

const DEFAULT_CONFIGS: NotificationConfigs = {
  telegram: { botToken: '', chatId: '', enabled: false },
  discord: { webhookUrl: '', enabled: false },
  webhook: { url: '', enabled: false },
  pushover: { userKey: '', apiToken: '', enabled: false },
};

export default function CleanerReminder({ reports }: CleanerReminderProps) {
  // Load integration configs from NotificationCenter's localStorage item
  const [configs, setConfigs] = useState<NotificationConfigs>(() => {
    try {
      const saved = localStorage.getItem('inventory_notif_configs');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          telegram: { ...DEFAULT_CONFIGS.telegram, ...parsed.telegram },
          discord: { ...DEFAULT_CONFIGS.discord, ...parsed.discord },
          webhook: { ...DEFAULT_CONFIGS.webhook, ...parsed.webhook },
          pushover: { ...DEFAULT_CONFIGS.pushover, ...parsed.pushover },
        };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CONFIGS;
  });

  // Hot reloading configs if local storage updates
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('inventory_notif_configs');
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfigs({
            telegram: { ...DEFAULT_CONFIGS.telegram, ...parsed.telegram },
            discord: { ...DEFAULT_CONFIGS.discord, ...parsed.discord },
            webhook: { ...DEFAULT_CONFIGS.webhook, ...parsed.webhook },
            pushover: { ...DEFAULT_CONFIGS.pushover, ...parsed.pushover },
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [cleanerHandle, setCleanerHandle] = useState('');
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  // Generate the formatted notification message
  const getReminderMessage = (selectedRooms: string[]) => {
    const handlePlaceholder = cleanerHandle.trim() 
      ? (cleanerHandle.startsWith('@') ? cleanerHandle.trim() : `@${cleanerHandle.trim()}`)
      : '@';

    if (selectedRooms.length === 0) {
      return `Hi ${handlePlaceholder}\nJust a quick reminder that you have cleaned [No units selected] today:\n\nCould you please fill in the missing supplies/amenities in the "Stock Tracker" file here?\n👉https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit?usp=sharing\n\nThank you so much for your help! 🙏`;
    }

    const unitList = selectedRooms.map((name, index) => `${index + 1}. Apartment ${name}`).join('\n');
    const unitCountWord = selectedRooms.length === 1 ? 'this unit' : `these ${selectedRooms.length} units`;

    return `Hi ${handlePlaceholder}\nJust a quick reminder that you have cleaned ${unitCountWord} today:\n\n${unitList}\n\nCould you please fill in the missing supplies/amenities in the "Stock Tracker" file here?\n👉https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit?usp=sharing\n\nThank you so much for your help! 🙏`;
  };

  const currentPreviewMessage = getReminderMessage(selectedSheetNames);

  // Toggle selection
  const toggleRoomSelection = (sheetName: string) => {
    setSelectedSheetNames(prev => 
      prev.includes(sheetName)
        ? prev.filter(name => name !== sheetName)
        : [...prev, sheetName]
    );
  };

  // Select all / deselect all based on filtered list
  const filteredReports = reports.filter(r => 
    r.sheetName.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelectAll = () => {
    const allFilteredNames = filteredReports.map(r => r.sheetName);
    setSelectedSheetNames(prev => {
      const merged = Array.from(new Set([...prev, ...allFilteredNames]));
      return merged;
    });
  };

  const handleDeselectAll = () => {
    const allFilteredNames = filteredReports.map(r => r.sheetName);
    setSelectedSheetNames(prev => prev.filter(name => !allFilteredNames.includes(name)));
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(currentPreviewMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSendNotification = async () => {
    setSending(true);
    setStatusMsg({ type: '', text: '' });
    
    const targets: string[] = [];
    const errors: string[] = [];

    // 1. Telegram Dispatch
    if (configs.telegram.enabled && configs.telegram.botToken && configs.telegram.chatId) {
      try {
        const url = `https://api.telegram.org/bot${configs.telegram.botToken.trim()}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: configs.telegram.chatId.trim(),
            text: currentPreviewMessage
          })
        });
        if (res.ok) {
          targets.push('Telegram');
        } else {
          const errData = await res.json().catch(() => ({}));
          errors.push(`Telegram: ${errData?.description || 'Error'}`);
        }
      } catch (e: any) {
        errors.push(`Telegram: ${e.message}`);
      }
    }

    // 2. Discord Dispatch
    if (configs.discord.enabled && configs.discord.webhookUrl) {
      try {
        const res = await fetch(configs.discord.webhookUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: currentPreviewMessage
          })
        });
        if (res.ok) {
          targets.push('Discord');
        } else {
          errors.push(`Discord: Status ${res.status}`);
        }
      } catch (e: any) {
        errors.push(`Discord: ${e.message}`);
      }
    }

    // 3. Custom Webhook Dispatch
    if (configs.webhook.enabled && configs.webhook.url) {
      try {
        const res = await fetch(configs.webhook.url.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: currentPreviewMessage
          })
        });
        if (res.ok) {
          targets.push('Custom Webhook');
        } else {
          errors.push(`Webhook: Status ${res.status}`);
        }
      } catch (e: any) {
        errors.push(`Webhook: ${e.message}`);
      }
    }

    // 4. Pushover Dispatch
    if (configs.pushover.enabled && configs.pushover.userKey && configs.pushover.apiToken) {
      try {
        const res = await fetch('https://api.pushover.net/1/messages.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: configs.pushover.apiToken.trim(),
            user: configs.pushover.userKey.trim(),
            message: currentPreviewMessage,
            title: `Cleaner Work Reminder`,
            priority: 1
          })
        });
        if (res.ok) {
          targets.push('Pushover');
        } else {
          errors.push(`Pushover: HTTP ${res.status}`);
        }
      } catch (e: any) {
        errors.push(`Pushover: ${e.message}`);
      }
    }

    setSending(false);

    if (targets.length > 0) {
      setStatusMsg({
        type: 'success',
        text: `Cleaner work reminder sent successfully to: ${targets.join(', ')}!`
      });
    } else {
      if (errors.length > 0) {
        setStatusMsg({
          type: 'error',
          text: `Failed to deliver reminder:\n${errors.join('\n')}`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: 'Please configure and enable at least one notification channel in the "Notification & Push Alerts" tab first.'
        });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
      
      {/* Visual Live Mobile Preview Column */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <div className="w-[305px] h-[585px] bg-slate-900 rounded-[48px] p-4.5 shadow-2xl border-4 border-slate-800 relative flex shrink-0">
          {/* Speaker & camera notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 h-6 w-32 rounded-b-2xl z-10 flex items-center justify-center">
            <span className="w-10 h-1 bg-slate-800 rounded-full" />
            <span className="w-2.5 h-2.5 bg-slate-800 rounded-full ml-3" />
          </div>

          {/* Screen Content */}
          <div className="w-full h-full bg-slate-950 rounded-[30px] overflow-hidden relative flex flex-col justify-between p-3 pt-8 font-sans text-white">
            {/* Lock Screen Status Bar */}
            <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium px-2">
              <span>9:41 AM</span>
              <div className="flex items-center gap-1">
                <span>📶</span>
                <span>🔋 99%</span>
              </div>
            </div>

            {/* Notification Card */}
            <div className="flex-1 mt-6 overflow-y-auto no-scrollbar space-y-3.5 px-1 py-1">
              <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-slate-800 text-left shadow-lg">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800 w-full">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
                      <UserCheck className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[8px] uppercase font-bold tracking-wider text-indigo-400 truncate max-w-[150px]">
                      Remind Cleaner ({selectedSheetNames.length} selected)
                    </span>
                  </div>
                  <span className="text-[8px] text-slate-400 shrink-0">Telegram Preview</span>
                </div>
                
                <p className="text-[10px] leading-relaxed text-slate-200 mt-2 font-mono whitespace-pre-line bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 max-h-[300px] overflow-y-auto no-scrollbar">
                  {currentPreviewMessage}
                </p>
              </div>
            </div>

            {/* Action buttons on Phone Screen */}
            <div className="pb-3 px-2">
              <button 
                onClick={handleSendNotification}
                disabled={sending || selectedSheetNames.length === 0}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-[11px] font-bold rounded-xl text-white transition flex items-center justify-center gap-1 border border-indigo-500/30 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending...' : 'Send Reminder'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selector & Options Column */}
      <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
        
        {/* State Banner */}
        {statusMsg.text && (
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-3 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            <span className="text-sm shrink-0">{statusMsg.type === 'success' ? '✅' : '❌'}</span>
            <span className="whitespace-pre-line font-medium">{statusMsg.text}</span>
          </div>
        )}

        {/* Cleaner Detail Settings Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h4 className="text-slate-800 font-bold text-sm">Cleaner Information</h4>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 block">Cleaner Handle / Name</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
              <input 
                type="text" 
                value={cleanerHandle}
                onChange={(e) => setCleanerHandle(e.target.value.replace(/^@/, ''))}
                placeholder="cleaner_username (e.g. nathan, thanh)"
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-xl text-slate-700 text-[16px] md:text-xs font-medium outline-hidden transition placeholder:text-slate-400"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Tag username or type a name to customize the greeting in the template. If left as is, it'll default to "Hi @".
            </p>
          </div>
        </div>

        {/* Apartments checklist selector */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3.5 shadow-xs flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2.5 border-b border-slate-100">
            <div>
              <h4 className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-500" /> Select Cleaned Apartments ({selectedSheetNames.length})
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Check all the units completed by the cleaner today. These will be automatically numbered in the template.
              </p>
              
              {reports.length > 0 && (
                <div className="flex gap-2 text-[11px] mt-1.5">
                  <button onClick={handleSelectAll} className="text-indigo-600 hover:underline font-semibold bg-transparent border-0 cursor-pointer p-0">Select all shown</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={handleDeselectAll} className="text-slate-500 hover:underline font-semibold bg-transparent border-0 cursor-pointer p-0">Deselect all shown</button>
                </div>
              )}
            </div>

            {selectedSheetNames.length > 0 && (
              <button
                onClick={handleCopyMessage}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                  copied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Reminder ({selectedSheetNames.length})
              </button>
            )}
          </div>

          {/* Search bar inside checkboard */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search apartment by name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100/80 rounded-xl text-[16px] md:text-xs text-slate-700 focus:bg-white focus:border-indigo-500 outline-hidden transition"
            />
          </div>

          {reports.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No inventory data found. Please sync with Google Sheets first.
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No apartments matches &quot;{searchText}&quot;
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar py-1">
              {filteredReports.map((room) => {
                const isSelected = selectedSheetNames.includes(room.sheetName);
                return (
                  <div 
                    key={room.sheetName}
                    onClick={() => toggleRoomSelection(room.sheetName)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-medium shadow-xs' 
                        : 'bg-slate-50/40 border-slate-100 text-slate-600 hover:bg-slate-100/55'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRoomSelection(room.sheetName)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-800 block truncate">
                          Apartment {room.sheetName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {room.hasLowStock && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold">
                          {room.lowItems.length} items low
                        </span>
                      )}
                      {!room.hasLowStock && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-semibold">
                          Fully Stocked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview box */}
        {selectedSheetNames.length > 0 && (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-slate-800 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Reminder Template Output
                </h4>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  See the exact output format before copying or dispatching over active integrations.
                </p>
              </div>
              
              <button
                onClick={handleCopyMessage}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  copied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
            </div>

            <pre className="bg-white p-4 border border-slate-100 rounded-xl text-xs font-mono text-slate-700 whitespace-pre-wrap select-all leading-6 max-h-[160px] overflow-y-auto shadow-inner">
              {currentPreviewMessage}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
