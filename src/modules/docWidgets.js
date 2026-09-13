// FlatSpec Module: docWidgets
// 提供個人小工具 Block (Personal Widgets)、有狀態內容 (Stateful Blocks) 以及即時資料 Block (Live Data Dashboard)

export const docWidgets = {
    // 儲存正在運行的計時器與輪詢間隔 (Live Data / Stopwatch / Countdown)
    _widgetIntervals: {},

    // ================= 1. Personal Widgets (小工具 Block 預處理引擎) =================
    preprocessDocWidgets(text, widgetStore = null) {
        if (!text || typeof text !== 'string') return text || '';

        const storeWidget = (html) => {
            if (Array.isArray(widgetStore)) {
                const token = `DOCWIDGETBLOCKX${widgetStore.length}Z`;
                widgetStore.push(html.trim());
                return `\n\n${token}\n\n`;
            }
            return `\n\n${html.trim()}\n\n`;
        };

        // 1.10 YouTube / KPI Stat Card (:::kpi 或 :::yt-stat 或 /yt-stat)
        // 語法: :::yt-stat [標題] | [數值] | [趨勢變更] | [進度%] | [目標值/備註]
        const kpiRegex = /(?:^\/yt-stat\s*([^\n]*)|:::yt-stat\s*([^\n:]+?)(?::::|\n([\s\S]*?):::)|:::yt-stat\s*([^\n]*)([\s\S]*?):::|:::kpi\s*([^\n:]+?)(?::::|\n([\s\S]*?):::)|:::kpi\s*([^\n]*)([\s\S]*?):::)/gm;
        const kpiCards = [];
        text = text.replace(kpiRegex, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9) => {
            const raw = (p1 || p2 || p4 || p6 || p8 || (p3 ? p3.trim() : '') || (p5 ? p5.trim() : '') || (p7 ? p7.trim() : '') || (p9 ? p9.trim() : '') || '').trim();
            const parts = raw.split(/\||\n/).map(s => s.trim()).filter(Boolean);
            const title = parts[0] || 'YouTube 指標';
            const value = parts[1] || '0';
            const trend = parts[2] || '';
            const progress = parts[3] ? parseInt(parts[3].replace(/[^0-9]/g, ''), 10) : null;
            const note = parts[4] || '';

            const isPositive = trend.includes('+') || trend.includes('▲') || trend.includes('↑');
            const isNegative = trend.includes('-') || trend.includes('▼') || trend.includes('↓');
            const trendColor = isPositive ? 'text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-700' : (isNegative ? 'text-rose-700 bg-rose-100 border-rose-300 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-700' : 'text-zinc-600 bg-zinc-100 border-zinc-300 dark:text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700');

            let icon = '📊';
            if (/訂閱|sub/i.test(title)) icon = '🔴';
            else if (/觀看|view/i.test(title)) icon = '👁️';
            else if (/時長|時數|watch/i.test(title)) icon = '⏱️';
            else if (/營收|收益|revenue|rpm|cpm/i.test(title)) icon = '💰';
            else if (/點閱|ctr|點擊/i.test(title)) icon = '🎯';
            else if (/續看|留存|retention/i.test(title)) icon = '📈';

            const cardHtml = `<div class="doc-kpi-card p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000] dark:bg-zinc-900 dark:border-zinc-700 dark:text-white flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="text-base shrink-0">${icon}</span>
                            <span class="font-bold text-xs text-zinc-600 dark:text-zinc-400 truncate">${this.escapeHtml(title)}</span>
                        </div>
                        ${trend ? `<span class="text-[10px] font-black font-mono px-1.5 py-0.5 rounded border ${trendColor}">${this.escapeHtml(trend)}</span>` : ''}
                    </div>
                    <div class="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white my-1">${this.escapeHtml(value)}</div>
                </div>
                ${progress !== null && !isNaN(progress) ? `
                    <div class="mt-2">
                        <div class="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full border border-black/30 overflow-hidden my-1.5">
                            <div class="bg-red-600 h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, Math.max(0, progress))}%;"></div>
                        </div>
                        <div class="flex justify-between items-center text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                            <span>進度 ${progress}%</span>
                            ${note ? `<span>${this.escapeHtml(note)}</span>` : ''}
                        </div>
                    </div>
                ` : (note ? `<div class="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 mt-2 truncate">${this.escapeHtml(note)}</div>` : '')}
            </div>`;
            const token = `YTKPICARDX${kpiCards.length}Z`;
            kpiCards.push(cardHtml);
            return `\n${token}\n`;
        });

        // 將連續相鄰的 doc-kpi-card 標記安全整合在響應式 Grid 容器中，並納入 widgetStore
        text = text.replace(/(?:\s*YTKPICARDX\d+Z\s*)+/g, (groupMatch) => {
            const cards = [...groupMatch.matchAll(/YTKPICARDX(\d+)Z/g)]
                .map(m => kpiCards[Number(m[1])])
                .join('');
            const gridHtml = `<div class="doc-kpi-grid not-prose my-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">${cards}</div>`;
            return storeWidget(gridHtml);
        });

        // 1.1 /calculator 或 :::calc [公式]
        text = text.replace(/(?:^\/calculator\s*([^\n]*)|:::calc\s*([^\n]*)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const initialExpr = (p1 || p2 || (p3 ? p3.trim() : '') || '').trim();
            const widgetId = 'calc_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="calc" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">🧮</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">實用計算機 Calculator</span>
                    </div>
                    <span class="text-[10px] font-mono bg-zinc-100 text-zinc-800 border border-black font-bold px-1.5 py-0.5 rounded">WIDGET</span>
                </div>
                <div class="space-y-2">
                    <div class="flex gap-2">
                        <input type="text" id="${widgetId}_input" value="${this.escapeHtml(initialExpr)}" placeholder="輸入算式，例如：(120 * 4.5) + 300 / 2" class="flex-1 p-2 font-mono font-bold text-xs bg-zinc-50 border-2 border-black rounded focus:bg-white focus:outline-none" onkeydown="if(event.key==='Enter') app.calculateDocWidget('${widgetId}')" />
                        <button type="button" onclick="app.calculateDocWidget('${widgetId}')" class="px-4 py-2 bg-black text-white hover:bg-zinc-800 font-black text-xs rounded border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all">＝ 計算</button>
                    </div>
                    <div id="${widgetId}_result" class="p-2.5 bg-yellow-50 border border-black rounded font-mono font-bold text-sm text-slate-900 min-h-[38px] flex items-center justify-between">
                        <span class="text-zinc-400 text-xs font-normal">計算結果：</span>
                        <span class="result-val text-base font-black text-blue-700">${initialExpr ? this.safeEvalMath(initialExpr) : '0'}</span>
                    </div>
                </div>
            </div>`;
            return storeWidget(html);
        });

        // 1.2 /countdown <時間/日期> [標題] 或 :::countdown <時間/日期> [標題]
        text = text.replace(/(?:^\/countdown\s+([^\n]+)|:::countdown\s+([^\n]+)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const rawArgs = (p1 || p2 || '').trim();
            // 解析日期時間與標題 (例: 2026-12-31 23:59:59 項目目標倒數 或 2026-12-31)
            const dateMatch = rawArgs.match(/^(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)(?:\s+(.+))?$/);
            const targetDateStr = dateMatch ? dateMatch[1] : rawArgs;
            const inlineTitle = dateMatch ? (dateMatch[2] || '') : '';
            const customTitle = (p3 ? p3.trim() : '') || inlineTitle || '目標倒數計時';
            const widgetId = 'cd_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="countdown" data-target="${this.escapeHtml(targetDateStr)}" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">⏳</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">${this.escapeHtml(customTitle)}</span>
                    </div>
                    <span class="text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-800 font-bold px-1.5 py-0.5 rounded">COUNTDOWN</span>
                </div>
                <div class="flex items-center justify-around gap-2 text-center py-2" id="${widgetId}_display">
                    <div class="p-2 bg-zinc-50 border border-black rounded-lg min-w-[55px]"><span class="block text-xl font-black font-mono text-black days">00</span><span class="text-[10px] text-zinc-500 font-bold">天 DAYS</span></div>
                    <span class="text-lg font-black">:</span>
                    <div class="p-2 bg-zinc-50 border border-black rounded-lg min-w-[55px]"><span class="block text-xl font-black font-mono text-black hours">00</span><span class="text-[10px] text-zinc-500 font-bold">時 HRS</span></div>
                    <span class="text-lg font-black">:</span>
                    <div class="p-2 bg-zinc-50 border border-black rounded-lg min-w-[55px]"><span class="block text-xl font-black font-mono text-black mins">00</span><span class="text-[10px] text-zinc-500 font-bold">分 MINS</span></div>
                    <span class="text-lg font-black">:</span>
                    <div class="p-2 bg-zinc-50 border border-black rounded-lg min-w-[55px]"><span class="block text-xl font-black font-mono text-rose-600 secs">00</span><span class="text-[10px] text-zinc-500 font-bold">秒 SECS</span></div>
                </div>
                <div class="text-[10px] font-mono text-zinc-400 text-center mt-1">目標時間: ${this.escapeHtml(targetDateStr)}</div>
            </div>`;
            return storeWidget(html);
        });

        // 1.3 /stopwatch 或 :::stopwatch
        text = text.replace(/(?:^\/stopwatch|:::stopwatch([\s\S]*?):::)/gm, (match, p1) => {
            const title = (p1 ? p1.trim() : '') || '碼錶計時器 Stopwatch';
            const widgetId = 'sw_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="stopwatch" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">⏱️</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">${this.escapeHtml(title)}</span>
                    </div>
                    <span class="text-[10px] font-mono bg-blue-100 text-blue-900 border border-blue-800 font-bold px-1.5 py-0.5 rounded">STOPWATCH</span>
                </div>
                <div class="flex flex-col items-center justify-center py-2 space-y-3">
                    <div id="${widgetId}_time" class="text-3xl font-black font-mono tracking-widest text-slate-900 bg-zinc-50 px-6 py-2 border-2 border-black rounded-lg">00:00:00.0</div>
                    <div class="flex gap-2">
                        <button type="button" onclick="app.toggleDocStopwatch('${widgetId}')" id="${widgetId}_btnToggle" class="px-4 py-1.5 bg-black text-white hover:bg-zinc-800 font-black text-xs rounded border border-black shadow-[2px_2px_0px_0px_#000]">▶ 開始</button>
                        <button type="button" onclick="app.lapDocStopwatch('${widgetId}')" class="px-3 py-1.5 bg-white hover:bg-zinc-100 text-black font-bold text-xs rounded border border-black">🚩 計圈</button>
                        <button type="button" onclick="app.resetDocStopwatch('${widgetId}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded border border-rose-400">🔄 重設</button>
                    </div>
                    <div id="${widgetId}_laps" class="w-full max-h-24 overflow-y-auto text-[11px] font-mono text-zinc-600 space-y-1"></div>
                </div>
            </div>`;
            return storeWidget(html);
        });

        // 1.4 /random <選項1, 選項2... 或 1-100> 或 :::random
        text = text.replace(/(?:^\/random\s*([^\n]*)|:::random\s*([^\n]*)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const raw = (p1 || p2 || (p3 ? p3.trim() : '') || '1-100').trim();
            const widgetId = 'rnd_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="random" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">🎲</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">隨機決策抽籤 Random Picker</span>
                    </div>
                    <span class="text-[10px] font-mono bg-purple-100 text-purple-900 border border-purple-800 font-bold px-1.5 py-0.5 rounded">RANDOM</span>
                </div>
                <div class="space-y-2">
                    <div class="flex gap-2">
                        <input type="text" id="${widgetId}_input" value="${this.escapeHtml(raw)}" placeholder="輸入逗號分隔項目或數字範圍 (例: 披薩, 火鍋, 牛排 或 1-100)" class="flex-1 p-2 text-xs font-bold bg-zinc-50 border-2 border-black rounded focus:bg-white focus:outline-none" />
                        <button type="button" onclick="app.rollDocRandom('${widgetId}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all">🎲 抽籤！</button>
                    </div>
                    <div id="${widgetId}_result" class="p-3 bg-purple-50 border border-black rounded text-center min-h-[44px] flex items-center justify-center">
                        <span class="text-base font-black text-purple-950">點擊「抽籤！」按鈕開始隨機選取</span>
                    </div>
                </div>
            </div>`;
            return storeWidget(html);
        });

        // 1.5 /counter <初始值> <名稱> 或 :::counter
        text = text.replace(/(?:^\/counter\s*([^\n]*)|:::counter\s*([^\n]*)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const raw = (p1 || p2 || (p3 ? p3.trim() : '') || '0 計數器').trim();
            const parts = raw.split(/\s+/);
            const initVal = parseInt(parts[0], 10) || 0;
            const label = parts.slice(1).join(' ') || '計數統計';
            const widgetId = 'cnt_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="counter" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">🔢</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">${this.escapeHtml(label)}</span>
                    </div>
                    <span class="text-[10px] font-mono bg-emerald-100 text-emerald-900 border border-emerald-800 font-bold px-1.5 py-0.5 rounded">COUNTER</span>
                </div>
                <div class="flex items-center justify-around gap-4 py-2">
                    <button type="button" onclick="app.updateDocCounter('${widgetId}', -1)" class="w-10 h-10 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-black text-lg rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all">－</button>
                    <div id="${widgetId}_val" class="min-w-[80px] text-center font-mono font-black text-3xl text-slate-900 px-4 py-1 bg-zinc-50 border-2 border-black rounded-lg">${initVal}</div>
                    <button type="button" onclick="app.updateDocCounter('${widgetId}', 1)" class="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black font-black text-lg rounded-lg shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all">＋</button>
                    <button type="button" onclick="app.updateDocCounter('${widgetId}', 0, true)" class="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 border border-black font-bold text-xs rounded text-zinc-600">重設</button>
                </div>
            </div>`;
            return storeWidget(html);
        });

        // 1.6 /qr <文字或網址> 或 :::qr <文字或網址>
        text = text.replace(/(?:^\/qr\s+([^\n]+)|:::qr\s+([^\n]+)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const target = (p1 || p2 || (p3 ? p3.trim() : '') || '').trim();
            const widgetId = 'qr_' + Math.abs(this.hashCode(match));
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(target)}`;
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000] max-w-sm" data-widget="qr" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">📱</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">QR Code 條碼</span>
                    </div>
                    <span class="text-[10px] font-mono bg-zinc-100 text-zinc-800 border border-black font-bold px-1.5 py-0.5 rounded">QR</span>
                </div>
                <div class="flex flex-col items-center justify-center space-y-2 py-2">
                    <div class="p-2 bg-white border-2 border-black rounded-lg shadow-sm">
                        <img src="${qrApiUrl}" alt="QR Code" class="w-36 h-36 object-contain" />
                    </div>
                    <div class="text-[11px] font-mono text-zinc-600 truncate max-w-full px-2" title="${this.escapeHtml(target)}">${this.escapeHtml(target)}</div>
                </div>
            </div>`;
            return storeWidget(html);
        });

        // 1.7 /clipboard <內容> 或 :::clipboard <內容>
        text = text.replace(/(?:^\/clipboard\s+([^\n]+)|:::clipboard\s*([^\n]*)\n([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const label = (p2 || '快速複製常用片段').trim();
            const snippet = (p3 || p1 || '').trim();
            const widgetId = 'clip_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-3 p-3 border-2 border-black bg-amber-50/50 rounded-xl shadow-[3px_3px_0px_0px_#000] flex items-center justify-between gap-3" data-widget="clipboard" id="${widgetId}">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="text-base">📋</span>
                    <div class="min-w-0">
                        <div class="font-bold text-xs text-slate-900 truncate">${this.escapeHtml(label)}</div>
                        <div class="font-mono text-[11px] text-zinc-500 truncate">${this.escapeHtml(snippet)}</div>
                    </div>
                </div>
                <button type="button" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(snippet)}')); app.showToast('📋 已複製至剪貼簿！');" class="px-3 py-1.5 bg-black text-white hover:bg-zinc-800 font-bold text-xs rounded border border-black shrink-0 shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all">一鍵複製</button>
            </div>`;
            return storeWidget(html);
        });

        // 1.8 /converter 或 :::converter
        text = text.replace(/(?:^\/converter|:::converter([\s\S]*?):::)/gm, (match) => {
            const widgetId = 'conv_' + Math.abs(this.hashCode(match));
            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="converter" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">🔄</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">單位與匯率換算 Converter</span>
                    </div>
                    <span class="text-[10px] font-mono bg-cyan-100 text-cyan-900 border border-cyan-800 font-bold px-1.5 py-0.5 rounded">CONVERT</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="number" id="${widgetId}_val" value="100" class="p-2 font-mono font-bold text-xs bg-zinc-50 border-2 border-black rounded" oninput="app.runDocConverter('${widgetId}')" />
                    <select id="${widgetId}_type" class="p-2 font-bold text-xs bg-white border-2 border-black rounded" onchange="app.runDocConverter('${widgetId}')">
                        <option value="usd_twd">USD ➔ TWD (約 32.5)</option>
                        <option value="twd_usd">TWD ➔ USD</option>
                        <option value="jpy_twd">JPY ➔ TWD (約 0.22)</option>
                        <option value="km_mile">公里 (km) ➔ 英哩 (mi)</option>
                        <option value="kg_lb">公斤 (kg) ➔ 磅 (lb)</option>
                        <option value="c_f">攝氏 (°C) ➔ 華氏 (°F)</option>
                    </select>
                    <div id="${widgetId}_result" class="p-2 bg-cyan-50 border border-black rounded font-mono font-black text-xs flex items-center justify-center text-cyan-950">3,250 TWD</div>
                </div>
            </div>`;
            return storeWidget(html);
        });

        // 1.9 /poll-self 或 :::poll <題目> | <選項1> | <選項2> ...
        text = text.replace(/(?:^\/poll-self\s*([^\n]*)|:::poll\s*([^\n]*)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const raw = (p1 || p2 || (p3 ? p3.trim() : '') || '當前狀態評估 | 超有動力 🔥 | 還行持平 😐 | 需要休息 ☕').trim();
            const parts = raw.split(/\||\n/).map(s => s.trim()).filter(Boolean);
            const question = parts[0] || '自我狀態投票';
            const options = parts.slice(1);
            const widgetId = 'poll_' + Math.abs(this.hashCode(match));
            
            let optsHtml = '';
            options.forEach((opt, idx) => {
                optsHtml += `
                    <button type="button" onclick="app.voteDocPoll('${widgetId}', ${idx})" class="poll-opt-btn w-full p-2 text-left bg-zinc-50 hover:bg-purple-50 border border-black rounded-lg font-bold text-xs text-slate-800 flex items-center justify-between transition-colors">
                        <span>${this.escapeHtml(opt)}</span>
                        <span class="poll-badge text-[10px] font-mono bg-white border border-black px-1.5 py-0.5 rounded">0%</span>
                    </button>
                `;
            });

            const html = `<div class="doc-widget-card not-prose my-4 p-4 border-2 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="poll" id="${widgetId}">
                <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-base">📊</span>
                        <span class="font-black text-xs text-slate-900 uppercase tracking-wider">${this.escapeHtml(question)}</span>
                    </div>
                    <span class="text-[10px] font-mono bg-purple-100 text-purple-900 border border-purple-800 font-bold px-1.5 py-0.5 rounded">POLL</span>
                </div>
                <div class="space-y-1.5" id="${widgetId}_options">${optsHtml}</div>
            </div>`;
            return storeWidget(html);
        });

        // ================= 2. Stateful Blocks (有狀態內容渲染) =================
        text = text.replace(/\[(read|idea|state):([^\]\n]+)\]/g, (match, type, content) => {
            if (type === 'read') {
                const currentStatus = content.trim();
                const states = [
                    { id: 'Unread', label: 'Unread ⚪', bg: 'bg-zinc-100', text: 'text-zinc-800', border: 'border-zinc-400' },
                    { id: 'Reading', label: 'Reading 🟡', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-600' },
                    { id: 'Finished', label: 'Finished 🟢', bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-600' },
                    { id: 'Revisit', label: 'Revisit 🟣', bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-600' }
                ];
                const active = states.find(s => s.id.toLowerCase() === currentStatus.toLowerCase()) || states[0];
                return `<span class="doc-stateful-badge inline-flex items-center gap-1 cursor-pointer select-none font-mono font-black text-[11px] px-2 py-0.5 rounded border ${active.border} ${active.bg} ${active.text} shadow-2xs hover:opacity-80 transition-all align-middle mx-1" onclick="app.cycleStatefulBlock(this, 'read', '${active.id}')" title="點擊切換閱讀狀態">${active.label}</span>`;
            } else if (type === 'idea') {
                const currentStatus = content.trim();
                const states = [
                    { id: 'Raw', label: 'Raw 💡', bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-400' },
                    { id: 'Interesting', label: 'Interesting 🔥', bg: 'bg-orange-100', text: 'text-orange-950', border: 'border-orange-600' },
                    { id: 'Tried', label: 'Tried 🧪', bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-600' },
                    { id: 'Abandoned', label: 'Abandoned 📦', bg: 'bg-zinc-200', text: 'text-zinc-600', border: 'border-zinc-400' }
                ];
                const active = states.find(s => s.id.toLowerCase() === currentStatus.toLowerCase()) || states[0];
                return `<span class="doc-stateful-badge inline-flex items-center gap-1 cursor-pointer select-none font-mono font-black text-[11px] px-2 py-0.5 rounded border ${active.border} ${active.bg} ${active.text} shadow-2xs hover:opacity-80 transition-all align-middle mx-1" onclick="app.cycleStatefulBlock(this, 'idea', '${active.id}')" title="點擊切換想法狀態">${active.label}</span>`;
            } else if (type === 'state') {
                const parts = content.split(':');
                const label = parts[0] || 'State';
                const current = parts[1] || 'Default';
                const allOpts = parts[2] ? parts[2].split('|') : ['Todo', 'Doing', 'Done'];
                return `<span class="doc-stateful-badge inline-flex items-center gap-1 cursor-pointer select-none font-mono font-black text-[11px] px-2 py-0.5 rounded border border-black bg-zinc-100 text-black shadow-2xs hover:bg-black hover:text-white transition-all align-middle mx-1" onclick="app.cycleStatefulCustomBlock(this, '${this.escapeHtml(label)}', '${this.escapeHtml(current)}', '${this.escapeHtml(allOpts.join('|'))}')" title="點擊切換狀態">🏷️ ${this.escapeHtml(label)}: <strong>${this.escapeHtml(current)}</strong></span>`;
            }
            return match;
        });

        // ================= 3. Live Data Block (外部即時資料 Dashboard) =================
        text = text.replace(/(?:^\/data\s+([^\n]+)|:::data\s+([^\n]+)([\s\S]*?):::)/gm, (match, p1, p2, p3) => {
            const rawArgs = (p1 || p2 || '').trim();
            const [url, ...options] = rawArgs.split(/\s+/);
            const refreshMatch = rawArgs.match(/refresh:(\d+)(s|m)?/i);
            const refreshSec = refreshMatch ? parseInt(refreshMatch[1], 10) * (refreshMatch[2] === 'm' ? 60 : 1) : 0;
            const widgetId = 'data_' + Math.abs(this.hashCode(url));

            const html = `<div class="doc-live-data-card not-prose my-4 p-4 border-2 border-black bg-slate-900 text-white rounded-xl shadow-[4px_4px_0px_0px_#000]" data-widget="livedata" data-url="${this.escapeHtml(url)}" data-refresh="${refreshSec}" id="${widgetId}">
                <div class="flex items-center justify-between border-b border-slate-700 pb-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" id="${widgetId}_dot"></span>
                        <span class="font-mono font-bold text-xs text-emerald-400 uppercase tracking-wider">LIVE DATA DASHBOARD</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${refreshSec > 0 ? `<span class="text-[10px] font-mono text-slate-400">🔄 ${refreshSec}s 自動刷新</span>` : ''}
                        <button type="button" onclick="app.fetchDocLiveData('${widgetId}')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded border border-slate-600 transition-colors">刷新 ⚡</button>
                    </div>
                </div>
                <div class="text-[11px] font-mono text-slate-400 truncate mb-2">Endpoint: ${this.escapeHtml(url)}</div>
                <div id="${widgetId}_content" class="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 min-h-[60px] flex items-center justify-center">
                    <span class="text-slate-500 animate-pulse">正在自遠端拉取即時數據...</span>
                </div>
            </div>`;
            return storeWidget(html);
        });

        return text;
    },

    // ================= 4. Widgets 互動邏輯 =================
    safeEvalMath(expr) {
        try {
            const sanitized = expr.replace(/[^0-9+\-*\/().\s]/g, '');
            if (!sanitized) return '0';
            const fn = new Function(`return (${sanitized})`);
            const res = fn();
            return typeof res === 'number' ? (Number.isInteger(res) ? res.toString() : res.toFixed(4).replace(/\.?0+$/, '')) : '無效運算';
        } catch(e) {
            return '運算錯誤';
        }
    },

    calculateDocWidget(widgetId) {
        const input = document.getElementById(`${widgetId}_input`);
        const resultContainer = document.getElementById(`${widgetId}_result`);
        if (!input || !resultContainer) return;
        const val = this.safeEvalMath(input.value);
        resultContainer.innerHTML = `
            <span class="text-zinc-400 text-xs font-normal">計算結果：</span>
            <span class="result-val text-base font-black text-blue-700">${val}</span>
        `;
        this.playSound('click');
    },

    toggleDocStopwatch(widgetId) {
        if (!this._stopwatchData) this._stopwatchData = {};
        if (!this._stopwatchData[widgetId]) {
            this._stopwatchData[widgetId] = { running: false, elapsed: 0, lastTime: 0, timerId: null, laps: [] };
        }
        const data = this._stopwatchData[widgetId];
        const btn = document.getElementById(`${widgetId}_btnToggle`);
        const timeEl = document.getElementById(`${widgetId}_time`);

        if (data.running) {
            data.running = false;
            clearInterval(data.timerId);
            if (btn) btn.innerText = '▶ 開始';
        } else {
            data.running = true;
            data.lastTime = Date.now();
            if (btn) btn.innerText = '⏸ 暫停';
            data.timerId = setInterval(() => {
                const now = Date.now();
                data.elapsed += (now - data.lastTime);
                data.lastTime = now;
                if (timeEl) {
                    const ms = Math.floor((data.elapsed % 1000) / 100);
                    const s = Math.floor((data.elapsed / 1000) % 60);
                    const m = Math.floor((data.elapsed / (1000 * 60)) % 60);
                    const h = Math.floor(data.elapsed / (1000 * 60 * 60));
                    timeEl.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
                }
            }, 100);
        }
        this.playSound('click');
    },

    lapDocStopwatch(widgetId) {
        const data = this._stopwatchData?.[widgetId];
        const lapsEl = document.getElementById(`${widgetId}_laps`);
        const timeEl = document.getElementById(`${widgetId}_time`);
        if (!data || !lapsEl || !timeEl) return;
        data.laps.push(timeEl.innerText);
        lapsEl.innerHTML = data.laps.map((lap, i) => `<div class="flex justify-between border-b border-zinc-100 py-0.5"><span>第 ${i + 1} 圈</span><span class="font-bold">${lap}</span></div>`).join('');
        this.playSound('click');
    },

    resetDocStopwatch(widgetId) {
        const data = this._stopwatchData?.[widgetId];
        if (data) {
            clearInterval(data.timerId);
            data.running = false;
            data.elapsed = 0;
            data.laps = [];
        }
        const btn = document.getElementById(`${widgetId}_btnToggle`);
        const timeEl = document.getElementById(`${widgetId}_time`);
        const lapsEl = document.getElementById(`${widgetId}_laps`);
        if (btn) btn.innerText = '▶ 開始';
        if (timeEl) timeEl.innerText = '00:00:00.0';
        if (lapsEl) lapsEl.innerHTML = '';
        this.playSound('click');
    },

    rollDocRandom(widgetId) {
        const input = document.getElementById(`${widgetId}_input`);
        const resEl = document.getElementById(`${widgetId}_result`);
        if (!input || !resEl) return;
        const raw = input.value.trim();
        let result = '';

        if (/^\d+\s*-\s*\d+$/.test(raw)) {
            const [min, max] = raw.split('-').map(n => parseInt(n.trim(), 10));
            result = Math.floor(Math.random() * (max - min + 1)) + min;
        } else {
            const items = raw.split(/[,，、|\n]/).map(s => s.trim()).filter(Boolean);
            if (items.length > 0) {
                result = items[Math.floor(Math.random() * items.length)];
            } else {
                result = '請輸入抽籤項目';
            }
        }

        resEl.innerHTML = `<span class="text-xl font-black text-purple-900 animate-bounce">🎉 ${this.escapeHtml(result.toString())}</span>`;
        this.playSound('click');
    },

    updateDocCounter(widgetId, delta, isReset = false) {
        const valEl = document.getElementById(`${widgetId}_val`);
        if (!valEl) return;
        let val = parseInt(valEl.innerText, 10) || 0;
        val = isReset ? 0 : val + delta;
        valEl.innerText = val;
        this.playSound('click');
    },

    runDocConverter(widgetId) {
        const valInput = document.getElementById(`${widgetId}_val`);
        const typeSelect = document.getElementById(`${widgetId}_type`);
        const resEl = document.getElementById(`${widgetId}_result`);
        if (!valInput || !typeSelect || !resEl) return;
        const val = parseFloat(valInput.value) || 0;
        const type = typeSelect.value;
        let out = '';
        if (type === 'usd_twd') out = `${(val * 32.5).toLocaleString()} TWD`;
        else if (type === 'twd_usd') out = `${(val / 32.5).toFixed(2)} USD`;
        else if (type === 'jpy_twd') out = `${(val * 0.22).toLocaleString()} TWD`;
        else if (type === 'km_mile') out = `${(val * 0.621371).toFixed(2)} 英哩 (mi)`;
        else if (type === 'kg_lb') out = `${(val * 2.20462).toFixed(2)} 磅 (lb)`;
        else if (type === 'c_f') out = `${((val * 9/5) + 32).toFixed(1)} °F`;
        resEl.innerText = out;
    },

    voteDocPoll(widgetId, selectedIdx) {
        const card = document.getElementById(widgetId);
        if (!card) return;
        const btns = card.querySelectorAll('.poll-opt-btn');
        btns.forEach((b, idx) => {
            const badge = b.querySelector('.poll-badge');
            if (idx === selectedIdx) {
                b.className = 'poll-opt-btn w-full p-2 text-left bg-purple-600 text-white border-2 border-black rounded-lg font-black text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000]';
                if (badge) {
                    badge.innerText = '100% (已選)';
                    badge.className = 'poll-badge text-[10px] font-mono bg-white text-purple-900 font-black px-1.5 py-0.5 rounded';
                }
            } else {
                b.className = 'poll-opt-btn w-full p-2 text-left bg-zinc-50 border border-zinc-200 rounded-lg font-bold text-xs text-zinc-400 flex items-center justify-between opacity-50';
                if (badge) {
                    badge.innerText = '0%';
                    badge.className = 'poll-badge text-[10px] font-mono bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded';
                }
            }
        });
        this.playSound('click');
        this.showToast('🗳️ 投票完成！');
    },

    // ================= 5. Stateful Block 循環切換與編輯器同步 =================
    cycleStatefulBlock(badgeEl, type, currentStatus) {
        const p = this.getCurrentProject();
        const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
        if (!doc) return;

        let nextStatus = '';
        if (type === 'read') {
            const seq = ['Unread', 'Reading', 'Finished', 'Revisit'];
            const curIdx = seq.findIndex(s => s.toLowerCase() === currentStatus.toLowerCase());
            nextStatus = seq[(curIdx + 1) % seq.length];
        } else if (type === 'idea') {
            const seq = ['Raw', 'Interesting', 'Tried', 'Abandoned'];
            const curIdx = seq.findIndex(s => s.toLowerCase() === currentStatus.toLowerCase());
            nextStatus = seq[(curIdx + 1) % seq.length];
        }

        const targetRegex = new RegExp(`\\[${type}:${currentStatus}\\]`, 'i');
        if (targetRegex.test(doc.content)) {
            doc.content = doc.content.replace(targetRegex, `[${type}:${nextStatus}]`);
            p.updatedAt = new Date().toISOString();
            const editorEl = document.getElementById('docEditor');
            if (editorEl) editorEl.value = doc.content;
            this.debouncedSaveAndSync();
            
            const previewEl = document.getElementById('docPreview');
            if (previewEl) this.updateDocPreview(doc, previewEl, true);
            this.playSound('click');
            this.showToast(`🔄 狀態已切換為：${nextStatus}`);
        }
    },

    cycleStatefulCustomBlock(badgeEl, label, current, allOptsStr) {
        const p = this.getCurrentProject();
        const doc = p?.docs?.find(d => d.id === this.state.activeDocId);
        if (!doc) return;

        const opts = allOptsStr.split('|');
        const curIdx = opts.indexOf(current);
        const next = opts[(curIdx + 1) % opts.length];

        const oldTag = `[state:${label}:${current}:${allOptsStr}]`;
        const newTag = `[state:${label}:${next}:${allOptsStr}]`;

        if (doc.content.includes(oldTag)) {
            doc.content = doc.content.replace(oldTag, newTag);
            p.updatedAt = new Date().toISOString();
            const editorEl = document.getElementById('docEditor');
            if (editorEl) editorEl.value = doc.content;
            this.debouncedSaveAndSync();
            const previewEl = document.getElementById('docPreview');
            if (previewEl) this.updateDocPreview(doc, previewEl, true);
            this.playSound('click');
            this.showToast(`🏷️ [${label}] 切換為：${next}`);
        }
    },

    // ================= 6. Live Data 外部資料擷取與自動刷新 =================
    async fetchDocLiveData(widgetId) {
        const card = document.getElementById(widgetId);
        if (!card) return;
        const url = card.getAttribute('data-url');
        const contentEl = document.getElementById(`${widgetId}_content`);
        const dotEl = document.getElementById(`${widgetId}_dot`);
        if (!url || !contentEl) return;

        try {
            contentEl.innerHTML = `<span class="text-slate-400 animate-pulse font-mono text-xs">正在連線 API (${url.substring(0, 45)}...)...</span>`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();

            let html = '';
            // 🔴 專屬優化：YouTube 創作者 API 回應渲染 (Real YouTube Studio Data)
            if (json && json.status === 'success' && json.data && json.data.channelTitle) {
                const yt = json.data;
                html = `
                    <div class="w-full space-y-4">
                        <!-- 頻道名稱與狀態標籤 -->
                        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div class="flex items-center gap-2">
                                <span class="text-2xl">🔴</span>
                                <div>
                                    <div class="text-sm font-black text-white flex items-center gap-1.5">
                                        <span>${this.escapeHtml(yt.channelTitle)}</span>
                                        <span class="text-[10px] px-1.5 py-0.5 bg-red-600 text-white font-bold rounded">LIVE</span>
                                    </div>
                                    <div class="text-[11px] text-slate-400 font-mono">共 ${yt.videoCount || 0} 部影片 | 總觀看 ${(yt.totalViews || 0).toLocaleString()} 次</div>
                                </div>
                            </div>
                            <div class="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded">
                                ● 官方數據同步中 (${new Date(yt.updatedAt || Date.now()).toLocaleTimeString()})
                            </div>
                        </div>

                        <!-- 4 格核心指標卡 -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                <div class="text-[10px] text-slate-400 font-bold mb-1">🔴 總訂閱人數</div>
                                <div class="text-xl font-black font-mono text-white">${(yt.subscribers || 0).toLocaleString()}</div>
                                <div class="text-[10px] font-mono ${yt.netSubscribers28d >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-1">
                                    ${yt.netSubscribers28d >= 0 ? '▲ +' : '▼ '}${yt.netSubscribers28d || 0} (近28天)
                                </div>
                            </div>

                            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                <div class="text-[10px] text-slate-400 font-bold mb-1">👁️ 28天觀看次數</div>
                                <div class="text-xl font-black font-mono text-white">${(yt.views28d || yt.totalViews || 0).toLocaleString()}</div>
                                <div class="text-[10px] font-mono text-slate-400 mt-1">平均時長 ${Math.floor((yt.avgViewDurationSec || 0) / 60)}分${(yt.avgViewDurationSec || 0) % 60}秒</div>
                            </div>

                            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                <div class="text-[10px] text-slate-400 font-bold mb-1">⏱️ 獲利時長進度</div>
                                <div class="text-xl font-black font-mono text-amber-400">${yt.watchHours28d || 0} <span class="text-xs font-normal text-slate-400">/ 4,000h</span></div>
                                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                                    <div class="bg-amber-400 h-full rounded-full" style="width: ${Math.min(100, Math.round(((yt.watchHours28d || 0) / 4000) * 100))}%;"></div>
                                </div>
                            </div>

                            <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                <div class="text-[10px] text-slate-400 font-bold mb-1">💰 預估收益 (TWD)</div>
                                <div class="text-xl font-black font-mono text-emerald-400">NT$ ${(yt.estimatedRevenueTWD || 0).toLocaleString()}</div>
                                <div class="text-[10px] font-mono text-slate-400 mt-1">約 ${yt.estimatedRevenueUSD || 0} USD</div>
                            </div>
                        </div>

                        ${yt.recentVideos && yt.recentVideos.length > 0 ? `
                            <!-- 最新影片列表 -->
                            <div class="pt-2 border-t border-slate-800">
                                <div class="text-[11px] font-bold text-slate-400 mb-2">🎬 最新發布影片表現：</div>
                                <div class="space-y-1.5">
                                    ${yt.recentVideos.map(v => `
                                        <div class="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs">
                                            <div class="truncate text-slate-200 font-bold">${this.escapeHtml(v.title)}</div>
                                            <div class="shrink-0 flex items-center gap-3 font-mono text-[11px]">
                                                <span class="text-slate-400">👁️ ${(v.views || 0).toLocaleString()}</span>
                                                <span class="text-emerald-400">👍 ${(v.likes || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else if (typeof json === 'object' && json !== null) {
                if (Array.isArray(json)) {
                    html = `<div class="text-[11px] text-emerald-400 mb-1">陣列資料 (共 ${json.length} 筆項目)：</div><pre class="overflow-x-auto text-[11px] leading-tight text-slate-300">${this.escapeHtml(JSON.stringify(json.slice(0, 5), null, 2))}</pre>`;
                } else {
                    html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">`;
                    for (const [k, v] of Object.entries(json.data || json)) {
                        const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
                        html += `
                            <div class="p-2 bg-slate-900 border border-slate-800 rounded">
                                <div class="text-[10px] text-slate-400 uppercase font-mono truncate">${this.escapeHtml(k)}</div>
                                <div class="text-xs font-bold text-emerald-400 font-mono truncate">${this.escapeHtml(strVal)}</div>
                            </div>
                        `;
                    }
                    html += `</div>`;
                }
            } else {
                html = `<div class="text-xs font-mono font-bold text-emerald-400">${this.escapeHtml(String(json))}</div>`;
            }

            contentEl.innerHTML = html;
            if (dotEl) {
                dotEl.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
            }
        } catch(err) {
            contentEl.innerHTML = `<div class="text-rose-400 text-xs font-mono">⚠️ 資料獲取失敗 (${err.message})<br><span class="text-[10px] text-slate-500">請確認 API 是否支援 CORS 跨域存取</span></div>`;
            if (dotEl) {
                dotEl.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
            }
        }
    },

    _widgetTimerScopes: new WeakMap(),

    disposeActiveWidgets(containerEl) {
        if (!containerEl) return;
        const timers = this._widgetTimerScopes.get(containerEl);
        if (Array.isArray(timers)) {
            timers.forEach(id => clearInterval(id));
        }
        this._widgetTimerScopes.delete(containerEl);
    },

    initActiveWidgets(containerEl) {
        if (!containerEl) return;

        // 清理當前容器先前運行的計時器與輪詢間隔，避免記憶體洩漏與 CPU 佔用，且不影響其他容器 (如 Reader / Preview 分離)
        this.disposeActiveWidgets(containerEl);
        const currentTimers = [];

        containerEl.querySelectorAll('[data-widget="countdown"]').forEach(card => {
            const widgetId = card.id;
            const targetStr = card.getAttribute('data-target');
            if (!targetStr) return;
            const targetTime = new Date(targetStr).getTime();
            if (isNaN(targetTime)) return;

            const updateCd = () => {
                const now = Date.now();
                const diff = targetTime - now;
                const dEl = card.querySelector('.days');
                const hEl = card.querySelector('.hours');
                const mEl = card.querySelector('.mins');
                const sEl = card.querySelector('.secs');

                if (diff <= 0) {
                    if (dEl) dEl.innerText = '00';
                    if (hEl) hEl.innerText = '00';
                    if (mEl) mEl.innerText = '00';
                    if (sEl) sEl.innerText = '00';
                    return;
                }

                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const mins = Math.floor((diff / (1000 * 60)) % 60);
                const secs = Math.floor((diff / 1000) % 60);

                if (dEl) dEl.innerText = days.toString().padStart(2, '0');
                if (hEl) hEl.innerText = hours.toString().padStart(2, '0');
                if (mEl) mEl.innerText = mins.toString().padStart(2, '0');
                if (sEl) sEl.innerText = secs.toString().padStart(2, '0');
            };

            updateCd();
            const timerId = setInterval(updateCd, 1000);
            currentTimers.push(timerId);
        });

        containerEl.querySelectorAll('[data-widget="livedata"]').forEach(card => {
            const widgetId = card.id;
            const refreshSec = parseInt(card.getAttribute('data-refresh'), 10) || 0;
            this.fetchDocLiveData(widgetId);
            if (refreshSec > 0) {
                const timerId = setInterval(() => {
                    this.fetchDocLiveData(widgetId);
                }, Math.max(5, refreshSec) * 1000);
                currentTimers.push(timerId);
            }
        });

        this._widgetTimerScopes.set(containerEl, currentTimers);
    },

    // ================= 7. 斜線指令選單 (Slash Command Autocomplete `/`) =================
    _slashCommands: [
        { id: 'yt_kpi', icon: '🔴', title: 'YouTube 數據指標卡 (KPI Card)', desc: '插入 YouTube 訂閱/觀看/時長/營收指標卡', cmd: ':::yt-stat 訂閱者總數 | 128,450 | ▲ +12.4% | 85% | 目標 150,000:::\n' },
        { id: 'yt_views', icon: '👁️', title: '觀看次數指標 (Views KPI)', desc: '近 28 天觀看次數與成長率', cmd: ':::yt-stat 48小時即時觀看 | 32,800 | ▲ +24.8% | 65% | 預期達標 50,000:::\n' },
        { id: 'yt_watchtime', icon: '⏱️', title: '獲利時長進度 (4000h Watch Time)', desc: '獲利資格 4,000 小時觀看進度條', cmd: ':::yt-stat 公開影片觀看時長 | 3,420 小時 | ▲ +310h | 85% | 獲利門檻 4,000h:::\n' },
        { id: 'calc', icon: '🧮', title: '計算機 (Calculator)', desc: '插入可互動運算的個人計算機', cmd: '/calculator (120 * 4.5) + 300\n' },
        { id: 'countdown', icon: '⏳', title: '倒數計時器 (Countdown)', desc: '目標時間與截止倒數 (日/時/分/秒)', cmd: '/countdown 2026-12-31 23:59:59 項目目標倒數\n' },
        { id: 'stopwatch', icon: '⏱️', title: '碼錶計時 (Stopwatch)', desc: '精確到毫秒的碼錶與計圈功能', cmd: '/stopwatch 任務計時碼錶\n' },
        { id: 'random', icon: '🎲', title: '隨機抽籤 (Random Picker)', desc: '自訂項目或範圍隨機抽籤決策', cmd: '/random 項目A, 項目B, 項目C, 項目D\n' },
        { id: 'counter', icon: '🔢', title: '計數器 (Counter)', desc: '快速點擊增減計數統計', cmd: '/counter 0 統計計數\n' },
        { id: 'qr', icon: '📱', title: 'QR Code 條碼', desc: '即時產生任何網址或文字的 QR Code', cmd: '/qr https://unkoalatw.github.io/project-manger/\n' },
        { id: 'converter', icon: '🔄', title: '單位與匯率換算', desc: 'USD/TWD/JPY/公里/公斤等快速換算', cmd: '/converter\n' },
        { id: 'poll', icon: '📊', title: '自我狀態投票 (Poll)', desc: '自評專注度、狀態或決策投票', cmd: '/poll-self 當前專注度 | 滿分極佳 🔥 | 還行持平 😐 | 需要休息 ☕\n' },
        { id: 'clip', icon: '📋', title: '快速複製按鈕 (Clipboard)', desc: '建立一鍵複製常用文本片段按鈕', cmd: '/clipboard 一鍵複製常用文本\n' },
        { id: 'read', icon: '📖', title: '閱讀清單 (Stateful Badge)', desc: 'Unread ➔ Reading ➔ Finished ➔ Revisit', cmd: '- [read:Unread] 文檔閱讀項目\n' },
        { id: 'idea', icon: '💡', title: '靈感狀態 (Idea Flow)', desc: 'Raw ➔ Interesting ➔ Tried ➔ Abandoned', cmd: '- [idea:Raw] 靈感點子記錄\n' },
        { id: 'data', icon: '📡', title: '即時數據儀表板 (Live Data)', desc: '透過 API 連線即時顯示並自動刷新數據', cmd: '/data https://api.github.com/repos/unkoalatw/project-manger refresh:30s\n' },
        { id: 'table', icon: '📑', title: '動態資料庫表格 (Database)', desc: '插入可篩選、排序的嵌入式資料表', cmd: '/table 專案清單\n' }
    ],

    _slashActiveIndex: 0,
    _slashTriggerPos: -1,

    setupSlashCommandAutocomplete() {
        const editor = document.getElementById('docEditor');
        if (!editor || editor._slashBound) return;
        editor._slashBound = true;

        editor.addEventListener('input', (e) => {
            const val = editor.value;
            const cursorPos = editor.selectionStart;
            const textBefore = val.slice(0, cursorPos);
            
            // 檢查當前行是否以 / 開頭，或當前輸入是否為 / 開頭的指令觸發
            const lastLine = textBefore.split('\n').pop();
            const slashMatch = lastLine.match(/\/([a-zA-Z0-9_-]*)$/);

            if (slashMatch) {
                const query = slashMatch[1].toLowerCase();
                this._slashTriggerPos = cursorPos - slashMatch[0].length;
                this.showSlashMenu(editor, query);
            } else {
                this.hideSlashMenu();
            }
        });

        editor.addEventListener('keydown', (e) => {
            const menu = document.getElementById('editorSlashMenu');
            if (!menu || menu.classList.contains('hidden')) return;

            const items = menu.querySelectorAll('.slash-menu-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._slashActiveIndex = (this._slashActiveIndex + 1) % items.length;
                this.updateSlashMenuSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._slashActiveIndex = (this._slashActiveIndex - 1 + items.length) % items.length;
                this.updateSlashMenuSelection(items);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const activeItem = items[this._slashActiveIndex];
                if (activeItem) {
                    const cmdId = activeItem.getAttribute('data-cmd-id');
                    this.executeSlashCommand(cmdId);
                }
            } else if (e.key === 'Escape') {
                this.hideSlashMenu();
            }
        });

        document.addEventListener('click', (e) => {
            const menu = document.getElementById('editorSlashMenu');
            if (menu && !menu.contains(e.target) && e.target !== editor) {
                this.hideSlashMenu();
            }
        });
    },

    showSlashMenu(editor, query) {
        let menu = document.getElementById('editorSlashMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'editorSlashMenu';
            menu.className = 'fixed z-50 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] p-1.5 w-72 max-h-64 overflow-y-auto hidden';
            document.body.appendChild(menu);
        }

        const filtered = this._slashCommands.filter(c => 
            !query || c.id.toLowerCase().includes(query) || c.title.toLowerCase().includes(query)
        );

        if (!filtered.length) {
            this.hideSlashMenu();
            return;
        }

        this._slashActiveIndex = 0;
        menu.innerHTML = `
            <div class="px-2 py-1 text-[10px] font-mono font-bold text-zinc-500 uppercase border-b border-zinc-200 mb-1 flex items-center justify-between">
                <span>⚡ 插入小工具與區塊</span>
                <span class="text-[9px] bg-zinc-100 px-1 py-0.5 rounded border border-zinc-300">↑↓ 選擇 / Enter 插入</span>
            </div>
            ${filtered.map((c, idx) => `
                <div class="slash-menu-item flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${idx === 0 ? 'bg-zinc-100 border border-black font-bold' : 'hover:bg-zinc-50 text-zinc-800'}" data-cmd-id="${c.id}" onclick="app.executeSlashCommand('${c.id}')">
                    <span class="text-lg shrink-0">${c.icon}</span>
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-xs text-slate-900 truncate">${c.title}</div>
                        <div class="text-[10px] text-zinc-500 truncate">${c.desc}</div>
                    </div>
                </div>
            `).join('')}
        `;

        // 計算編輯器相對視窗座標
        const rect = editor.getBoundingClientRect();
        menu.style.left = `${Math.min(window.innerWidth - 300, Math.max(16, rect.left + 24))}px`;
        menu.style.top = `${Math.min(window.innerHeight - 280, Math.max(60, rect.top + 50))}px`;
        menu.classList.remove('hidden');
    },

    updateSlashMenuSelection(items) {
        items.forEach((item, idx) => {
            if (idx === this._slashActiveIndex) {
                item.className = 'slash-menu-item flex items-center gap-2.5 p-2 rounded-lg cursor-pointer bg-zinc-100 border border-black font-bold shadow-2xs';
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.className = 'slash-menu-item flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-zinc-50 text-zinc-800';
            }
        });
    },

    hideSlashMenu() {
        const menu = document.getElementById('editorSlashMenu');
        if (menu) menu.classList.add('hidden');
    },

    executeSlashCommand(cmdId) {
        const item = this._slashCommands.find(c => c.id === cmdId);
        if (!item) return;

        const editor = document.getElementById('docEditor');
        if (!editor) return;

        const val = editor.value;
        const cursorPos = editor.selectionStart;
        const triggerPos = this._slashTriggerPos >= 0 ? this._slashTriggerPos : cursorPos;

        const before = val.slice(0, triggerPos);
        const after = val.slice(cursorPos);
        
        editor.value = before + item.cmd + after;
        editor.selectionStart = editor.selectionEnd = triggerPos + item.cmd.length;
        editor.focus();

        this.hideSlashMenu();
        this.updateDocContent(editor.value);
        this.playSound('click');
        this.showToast(`🧩 已插入 ${item.title}`);
    }
};
