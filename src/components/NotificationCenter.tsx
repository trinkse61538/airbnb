import { useState, useEffect } from 'react';
import { SheetReport, NotificationConfigs } from '../types';
import { 
  Bell, 
  Send, 
  Copy, 
  Check, 
  Settings, 
  Smartphone, 
  SendHorizontal, 
  Clock,
  HelpCircle,
  Building2,
  AlertTriangle,
  Inbox,
  Search
} from 'lucide-react';

interface NotificationCenterProps {
  reports: SheetReport[];
}

const DEFAULT_CONFIGS: NotificationConfigs = {
  telegram: { botToken: '', chatId: '', enabled: false },
  discord: { webhookUrl: '', enabled: false },
  webhook: { url: '', enabled: false },
  pushover: { userKey: '', apiToken: '', enabled: false },
};

export default function NotificationCenter({ reports }: NotificationCenterProps) {
  // Load config from localStorage
  const [configs, setConfigs] = useState<NotificationConfigs>(() => {
    try {
      const saved = localStorage.getItem('inventory_notif_configs');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge with defaults to avoid missing properties
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

  const [activeTab, setActiveTab] = useState<'telegram' | 'discord' | 'pushover' | 'webhook'>('telegram');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });
  const [showGuide, setShowGuide] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Active alert rooms with actual shortages (excluding fully-stocked apartments as requested)
  const alertRooms = reports.filter(r => r.hasLowStock && r.lowItems.length > 0);

  const filteredAlertRooms = alertRooms.filter(r => 
    r.sheetName.toLowerCase().includes(searchText.toLowerCase()) ||
    r.lowItems.some(i => i.name.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Track selected sheet names for the combined notification
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);

  // Automatically select all alert rooms when lists load or update
  useEffect(() => {
    if (alertRooms.length > 0) {
      setSelectedSheetNames(alertRooms.map(r => r.sheetName));
    }
  }, [reports]);

  // Save config of integrations
  useEffect(() => {
    localStorage.setItem('inventory_notif_configs', JSON.stringify(configs));
  }, [configs]);

  // Construct message helper for a single apartment line in combined template
  const getMessageForRoom = (room: SheetReport) => {
    const listItems = room.lowItems.map(item => item.name).join(', ');
    return `⚠️ Apartment ${room.sheetName} is low on: ${listItems}.`;
  };

  const getCombinedMessage = (selectedRooms: SheetReport[]) => {
    if (selectedRooms.length === 0) {
      return `⚠️ (Please select at least 1 apartment from the list below to automatically bundle the stock shortage report)`;
    }
    
    const lines = selectedRooms.map(room => getMessageForRoom(room)).join('\n');

    return `${lines}\n\nCould you please help me buy the items and remember to keep the receipt so Nathan can transfer the money back to you?\n\nAlso, for the apartments you worked on today, please fill in the inventory status in the stocktracker file here: https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit?usp=sharing`;
  };

  const getNoShortageMessage = () => {
    return `✅ Fully Stocked! All apartments are currently at full capacity. No shortage notifications are needed.`;
  };

  // List of reports corresponding to selected sheet names
  const selectedReports = alertRooms.filter(r => selectedSheetNames.includes(r.sheetName));

  // Currently styled message displaying on phone preview (Consolidated on checkout!)
  const currentPreviewMessage = alertRooms.length > 0 
    ? getCombinedMessage(selectedReports) 
    : getNoShortageMessage();

  const handleCopySingle = async (room: SheetReport, index: number) => {
    const msg = `${getMessageForRoom(room)}\n\nCould you please help me buy the items and remember to keep the receipt so Nathan can transfer the money back to you?\n\nAlso, for the apartments you worked on today, please fill in the inventory status in the stocktracker file here: https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit?usp=sharing`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopySelected = async () => {
    if (selectedReports.length === 0) return;
    const msg = getCombinedMessage(selectedReports);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const toggleRoomSelection = (sheetName: string) => {
    setSelectedSheetNames(prev => 
      prev.includes(sheetName)
        ? prev.filter(name => name !== sheetName)
        : [...prev, sheetName]
    );
  };

  const handleSelectAll = () => {
    const allFilteredNames = filteredAlertRooms.map(r => r.sheetName);
    setSelectedSheetNames(prev => Array.from(new Set([...prev, ...allFilteredNames])));
  };

  const handleDeselectAll = () => {
    const allFilteredNames = filteredAlertRooms.map(r => r.sheetName);
    setSelectedSheetNames(prev => prev.filter(name => !allFilteredNames.includes(name)));
  };

  const handleSendNotification = async (testMode = false, sendAllUnused = false) => {
    setSending(true);
    setStatusMsg({ type: '', text: '' });
    
    const targets: string[] = [];
    const errors: string[] = [];
    
    let deliverText = '';
    let deliverLabel = '';

    if (testMode) {
      deliverLabel = 'Demo Test Suite';
      deliverText = `⚠️ Apartment Demo Suit is low on: Toilet paper, Hand soap.\n\nCould you please help me buy the items and remember to keep the receipt so Nathan can transfer the money back to you?\n\nAlso, for the apartments you worked on today, please fill in the inventory status in the stocktracker file here: https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit?usp=sharing\n\n*(Test Notification)*`;
    } else {
      if (selectedReports.length === 0) {
        setSending(false);
        setStatusMsg({
          type: 'error',
          text: 'Please select at least one apartment from the list to bundle the notification message.'
        });
        return;
      }
      deliverLabel = `Selected Apartments (${selectedReports.length})`;
      deliverText = getCombinedMessage(selectedReports);
    }

    let deliversCompletedCount = 0;

    // 1. Telegram Dispatch
    if (configs.telegram.enabled && configs.telegram.botToken && configs.telegram.chatId) {
      try {
        const url = `https://api.telegram.org/bot${configs.telegram.botToken.trim()}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: configs.telegram.chatId.trim(),
            text: deliverText
          })
        });
        if (res.ok) {
          if (!targets.includes('Telegram')) targets.push('Telegram');
          deliversCompletedCount++;
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
            content: deliverText
          })
        });
        if (res.ok) {
          if (!targets.includes('Discord')) targets.push('Discord');
          deliversCompletedCount++;
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
            text: deliverText
          })
        });
        if (res.ok) {
          if (!targets.includes('Custom Webhook')) targets.push('Custom Webhook');
          deliversCompletedCount++;
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
            message: deliverText,
            title: `Stock Shortage Alert`,
            priority: 1
          })
        });
        if (res.ok) {
          if (!targets.includes('Pushover')) targets.push('Pushover');
          deliversCompletedCount++;
        } else {
          errors.push(`Pushover: HTTP ${res.status}`);
        }
      } catch (e: any) {
        errors.push(`Pushover: ${e.message}`);
      }
    }

    setSending(false);

    if (deliversCompletedCount > 0) {
      setStatusMsg({
        type: 'success',
        text: `Combined alert message (${deliverLabel}) sent successfully to: ${targets.join(', ')}!`
      });
    } else {
      if (errors.length > 0) {
        setStatusMsg({
          type: 'error',
          text: `Failed to deliver notifications:\n${errors.join('\n')}`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: 'Please configure and enable at least one notification channel below.'
        });
      }
    }
  };

  const handleToggleChannel = (channel: 'telegram' | 'discord' | 'pushover' | 'webhook') => {
    setConfigs({
      ...configs,
      [channel]: {
        ...configs[channel],
        enabled: !configs[channel].enabled
      }
    });
  };

  const handleUpdateField = (channel: string, field: string, val: string | boolean) => {
    setConfigs({
      ...configs,
      [channel]: {
        ...configs[channel],
        [field]: val
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Smartphone Mockup Preview */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
          <Smartphone className="w-4 h-4 text-indigo-500" /> Live Message Preview
        </span>
        
        {/* Phone Case */}
        <div className="w-full max-w-[280px] h-[520px] bg-slate-900 rounded-[40px] p-3.5 shadow-2xl border-4 border-slate-800 relative select-none">
          {/* Dynamic Speaker & Camera Notch */}
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-10 flex items-center justify-center">
            <span className="w-10 h-1 bg-slate-800 rounded-full" />
            <span className="w-2.5 h-2.5 bg-slate-800 rounded-full ml-3" />
          </div>
 
          {/* Screen Content */}
          <div className="w-full h-full bg-slate-950 rounded-[30px] overflow-hidden relative flex flex-col justify-between p-3 pt-8 font-sans text-white">
            {/* Lock Screen Status Bar */}
            <div className="flex justify-between items-center px-4 py-1 text-[10px] text-slate-400 font-medium">
              <span className="font-semibold text-white">18:42</span>
              <div className="flex gap-1.5 items-center">
                <span>📶</span>
                <span>🔋 98%</span>
              </div>
            </div>
 
            {/* Notification Card */}
            <div className="flex-1 mt-6 overflow-y-auto no-scrollbar space-y-3.5 px-1 py-1">
              <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-slate-800 text-left shadow-lg">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800 w-full">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center">
                      <Bell className="w-3 h-3 text-white fill-white" />
                    </div>
                    <span className="text-[8px] uppercase font-bold tracking-wider text-amber-400 truncate max-w-[110px]">
                      {alertRooms.length > 0 ? `Selected ${selectedReports.length}/${alertRooms.length}` : 'Fully Stocked'}
                    </span>
                  </div>
                  <span className="text-[8px] text-slate-400 shrink-0">Notification</span>
                </div>
                
                <p className="text-[10px] leading-relaxed text-slate-200 font-mono whitespace-pre-line bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 max-h-[300px] overflow-y-auto no-scrollbar">
                  {currentPreviewMessage}
                </p>
              </div>
            </div>
 
            {/* Action buttons on Phone Screen */}
            <div className="pb-3 px-2">
              <button 
                onClick={() => handleSendNotification(false)}
                disabled={sending || selectedReports.length === 0}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-[11px] font-bold rounded-xl text-white transition flex items-center justify-center gap-1 border border-indigo-500/30 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending...' : 'Send Combined Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
 
      {/* Settings / Clipboard copies */}
      <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
        
        {/* Apartment alerts selectors list */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2.5 border-b border-slate-100">
            <div>
              <h4 className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-500" /> Pending Apartment Alerts ({alertRooms.length})
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                Check apartments to include them in your combined message. fully-stocked rooms are ignored.
              </p>
              
              {alertRooms.length > 0 && (
                <div className="flex gap-2 text-[11px] mt-1.5">
                  <button onClick={handleSelectAll} className="text-indigo-600 hover:underline font-semibold bg-transparent border-0 cursor-pointer p-0">Select all</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={handleDeselectAll} className="text-slate-500 hover:underline font-semibold bg-transparent border-0 cursor-pointer p-0">Deselect all</button>
                </div>
              )}
            </div>
 
            {alertRooms.length > 0 && (
              <button
                onClick={handleCopySelected}
                disabled={selectedReports.length === 0}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                  copiedAll 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy combined ({selectedReports.length})
              </button>
            )}
          </div>
 
          {alertRooms.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs space-y-2">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                ✓
              </div>
              <p className="font-medium text-slate-600 text-sm">Perfect! No apartments low on stock.</p>
              <p className="max-w-sm mx-auto text-slate-400 text-[11px]">All apartments are currently reported full. No notifications need to be prepared or sent.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search apartment by name or low stock items..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100/80 rounded-xl text-[16px] md:text-xs text-slate-700 focus:bg-white focus:border-indigo-500 outline-hidden transition"
                />
              </div>

              {filteredAlertRooms.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No alert apartments match &quot;{searchText}&quot;
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar py-1">
                  {filteredAlertRooms.map((room, idx) => {
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
                        <div className="flex items-center gap-3 min-w-0">
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
                            <span className="text-[10px] text-slate-400 block truncate font-mono">
                              Low: {room.lowItems.map(i => i.name).join(', ')}
                            </span>
                          </div>
                        </div>
     
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold">
                            {room.lowItems.length} low
                          </span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySingle(room, idx);
                            }}
                            className={`p-1.5 rounded-lg border transition shrink-0 ${
                              copiedIndex === idx 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            title="Copy text of this apartment individually"
                          >
                            {copiedIndex === idx ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
 
        {/* Selected Message Payload Preview */}
        {alertRooms.length > 0 && (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-slate-800 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Combined Alert Message ({selectedReports.length} rooms checked)
                </h4>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  This combined text will copy or send on demand with all checked units listed.
                </p>
              </div>
              
              <button
                onClick={handleCopySelected}
                disabled={selectedReports.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                  copiedAll 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAll ? 'Copied' : 'Copy Combined'}
              </button>
            </div>
 
            <pre className="bg-white p-4 border border-slate-100 rounded-xl text-xs font-mono text-slate-700 whitespace-pre-wrap select-all leading-6 max-h-[160px] overflow-y-auto shadow-inner">
              {currentPreviewMessage}
            </pre>
          </div>
        )}
 
        {/* Configurations Channels Tab */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-indigo-500" /> Push Alert Configurations
            </h4>
            
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {showGuide ? 'Hide guide' : 'Need help with setup?'}
            </button>
          </div>
 
          {/* Quick Setup Guide */}
          {showGuide && (
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-800 space-y-2.5 leading-relaxed">
              <p className="font-semibold">🤖 Quick Guide: Receive notifications on Telegram for free:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Search <strong>@BotFather</strong> inside your Telegram application, send <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">/newbot</code>. Record the <strong>HTTP API Token</strong> provided.</li>
                <li>Find <strong>@userinfobot</strong> on Telegram, and press Start to instantly retrieve your numeric <strong>Chat ID</strong>.</li>
                <li>Paste both parameters in the fields below, enable the <strong>Telegram Switch</strong>, and trigger a <strong>Test Message</strong>!</li>
              </ol>
            </div>
          )}
 
          {/* Tab Selection */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl font-sans">
            {(['telegram', 'discord', 'pushover', 'webhook'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-slate-800 shadow-xs animate-in'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'telegram' ? 'Telegram' : tab === 'discord' ? 'Discord' : tab === 'pushover' ? 'Pushover' : 'Webhook'}
              </button>
            ))}
          </div>
 
          {/* Channel Settings Box */}
          <div className="space-y-4">
            {activeTab === 'telegram' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-slate-700 text-xs font-semibold block">Telegram Bot Channel</label>
                    <span className="text-[10px] text-slate-400">Deliver notifications directly to Telegram chats or groups</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-9 h-5 bg-slate-200 checked:bg-indigo-600 rounded-full cursor-pointer appearance-none relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition checked:before:translate-x-4 border border-transparent focus:outline-hidden"
                    checked={configs.telegram.enabled}
                    onChange={() => handleToggleChannel('telegram')}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-1">Telegram Bot Token:</span>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-slate-700 border border-slate-200 focus:border-indigo-500 rounded-lg text-[16px] md:text-xs outline-none"
                      placeholder="E.g. 1234567890:ABCdefGhI..."
                      value={configs.telegram.botToken}
                      onChange={(e) => handleUpdateField('telegram', 'botToken', e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-1">Telegram Chat ID (User or Group):</span>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-slate-700 border border-slate-200 focus:border-indigo-500 rounded-lg text-[16px] md:text-xs outline-none"
                      placeholder="E.g. 9876543210 font-mono"
                      value={configs.telegram.chatId}
                      onChange={(e) => handleUpdateField('telegram', 'chatId', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
 
            {activeTab === 'discord' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-slate-700 text-xs font-semibold block">Discord Webhook</label>
                    <span className="text-[10px] text-slate-400">Post statistics to your Discord chat servers</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-9 h-5 bg-slate-200 checked:bg-indigo-600 rounded-full cursor-pointer appearance-none relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition checked:before:translate-x-4 border border-transparent focus:outline-hidden"
                    checked={configs.discord.enabled}
                    onChange={() => handleToggleChannel('discord')}
                  />
                </div>
                
                <div>
                  <span className="text-slate-500 text-[11px] block mb-1">Discord Webhook URL:</span>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-slate-700 border border-slate-200 focus:border-indigo-500 rounded-lg text-[16px] md:text-xs outline-none"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={configs.discord.webhookUrl}
                    onChange={(e) => handleUpdateField('discord', 'webhookUrl', e.target.value)}
                  />
                </div>
              </div>
            )}
 
            {activeTab === 'pushover' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-slate-700 text-xs font-semibold block">Pushover Service</label>
                    <span className="text-[10px] text-slate-400">Deliver system-level push credentials to your iOS or Android app</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-9 h-5 bg-slate-200 checked:bg-indigo-600 rounded-full cursor-pointer appearance-none relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition checked:before:translate-x-4 border border-transparent focus:outline-hidden"
                    checked={configs.pushover.enabled}
                    onChange={() => handleToggleChannel('pushover')}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-1">User Key:</span>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-slate-700 border border-slate-200 focus:border-indigo-500 rounded-lg text-[16px] md:text-xs outline-none"
                      placeholder="Your Pushover User Key..."
                      value={configs.pushover.userKey}
                      onChange={(e) => handleUpdateField('pushover', 'userKey', e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block mb-1">App API Token:</span>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-slate-700 border border-slate-200 focus:border-indigo-500 rounded-lg text-[16px] md:text-xs outline-none"
                      placeholder="Your App API token..."
                      value={configs.pushover.apiToken}
                      onChange={(e) => handleUpdateField('pushover', 'apiToken', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
 
            {activeTab === 'webhook' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-slate-700 text-xs font-semibold block">Generic Custom Webhook (Make.com, Zapier, etc.)</label>
                    <span className="text-[10px] text-slate-400">Trigger custom API backend triggers or integration flows</span>
                  </div>
                  <input
                    type="checkbox"
                    className="w-9 h-5 bg-slate-200 checked:bg-indigo-600 rounded-full cursor-pointer appearance-none relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition checked:before:translate-x-4 border border-transparent focus:outline-hidden"
                    checked={configs.webhook.enabled}
                    onChange={() => handleToggleChannel('webhook')}
                  />
                </div>
                
                <div>
                  <span className="text-slate-500 text-[11px] block mb-1">Webhook URL (POST Request):</span>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-slate-700 border border-slate-200 focus:border-indigo-500 rounded-lg text-[16px] md:text-xs outline-none"
                    placeholder="https://hook.us1.make.com/..."
                    value={configs.webhook.url}
                    onChange={(e) => handleUpdateField('webhook', 'url', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
 
          {/* Test & Trigger controls */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => handleSendNotification(true)}
              disabled={sending}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <SendHorizontal className="w-4 h-4 text-slate-500" />
              Send Test Message
            </button>
            <button
              onClick={() => handleSendNotification(false)}
              disabled={sending || selectedReports.length === 0}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-indigo-100 disabled:opacity-50"
              title="Sends the combined message of all selected rooms automatically to the active integration channels"
            >
              <Bell className="w-4 h-4" />
              Send Combined Alert ({selectedReports.length} rooms)
            </button>
          </div>

          {/* Status Message block */}
          {statusMsg.text && (
            <div className={`p-3.5 rounded-xl text-xs border whitespace-pre-wrap ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {statusMsg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
