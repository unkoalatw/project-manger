// FlatSpec Module: diffMerge
export const diffMerge = {
// ================= 3-Way 文本智慧無損合併演算法 (3-Way Diff Merge Engine) =================
            threeWayMergeText(baseText, localText, remoteText) {
                if (localText === remoteText) return localText;
                if (!baseText || baseText === localText) return remoteText;
                if (baseText === remoteText) return localText;

                const baseLines = (baseText || '').split('\n');
                const localLines = (localText || '').split('\n');
                const remoteLines = (remoteText || '').split('\n');

                function getLCS(a, b) {
                    const m = a.length, n = b.length;
                    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
                    for (let i = 1; i <= m; i++) {
                        for (let j = 1; j <= n; j++) {
                            if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
                            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                        }
                    }
                    let i = m, j = n;
                    const common = [];
                    while (i > 0 && j > 0) {
                        if (a[i - 1] === b[j - 1]) {
                            common.unshift({ aIndex: i - 1, bIndex: j - 1, line: a[i - 1] });
                            i--; j--;
                        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
                            i--;
                        } else {
                            j--;
                        }
                    }
                    return common;
                }

                const localLCS = getLCS(baseLines, localLines);
                const remoteLCS = getLCS(baseLines, remoteLines);

                const commonAnchors = [];
                baseLines.forEach((bLine, bi) => {
                    const lMatch = localLCS.find(x => x.aIndex === bi);
                    const rMatch = remoteLCS.find(x => x.aIndex === bi);
                    if (lMatch && rMatch) {
                        commonAnchors.push({ baseIdx: bi, localIdx: lMatch.bIndex, remoteIdx: rMatch.bIndex, line: bLine });
                    }
                });

                const result = [];
                let curL = 0, curR = 0, curB = 0;
                commonAnchors.forEach(anchor => {
                    const localSlice = localLines.slice(curL, anchor.localIdx);
                    const remoteSlice = remoteLines.slice(curR, anchor.remoteIdx);
                    const baseSlice = baseLines.slice(curB, anchor.baseIdx);

                    if (localSlice.join('\n') === remoteSlice.join('\n')) {
                        result.push(...localSlice);
                    } else if (localSlice.join('\n') === baseSlice.join('\n')) {
                        result.push(...remoteSlice);
                    } else if (remoteSlice.join('\n') === baseSlice.join('\n')) {
                        result.push(...localSlice);
                    } else {
                        // 雙方在同一區間皆有修改，保留本地修改，並將隊友並存內容用藍色協作標註！
                        result.push(...localSlice);
                        const uniqueRemote = remoteSlice.filter(rl => !localSlice.includes(rl) && rl.trim() !== '');
                        if (uniqueRemote.length > 0) {
                            result.push(`> 🔹 **[隊友協作並存內容]**\n` + uniqueRemote.map(rl => `> ${rl}`).join('\n'));
                        }
                    }

                    result.push(anchor.line);
                    curL = anchor.localIdx + 1;
                    curR = anchor.remoteIdx + 1;
                    curB = anchor.baseIdx + 1;
                });

                const localTail = localLines.slice(curL);
                const remoteTail = remoteLines.slice(curR);
                const baseTail = baseLines.slice(curB);

                if (localTail.join('\n') === remoteTail.join('\n')) {
                    result.push(...localTail);
                } else if (localTail.join('\n') === baseTail.join('\n')) {
                    result.push(...remoteTail);
                } else if (remoteTail.join('\n') === baseTail.join('\n')) {
                    result.push(...localTail);
                } else {
                    result.push(...localTail);
                    const uniqueRemote = remoteTail.filter(rl => !localTail.includes(rl) && rl.trim() !== '');
                    if (uniqueRemote.length > 0) {
                        result.push(`> 🔹 **[隊友協作並存內容]**\n` + uniqueRemote.map(rl => `> ${rl}`).join('\n'));
                    }
                }

                return result.join('\n');
            },

            // ================= 細粒度實體與 3-Way 衝突自動化解 (Fine-Grained Conflict Resolution) =================
            mergeProjects(cloudList, localList) {
                if (!Array.isArray(cloudList) || cloudList.length === 0) return localList;
                if (!Array.isArray(localList) || localList.length === 0) return cloudList;

                const baseList = this.state.lastSyncedProjects || [];
                const mergedMap = new Map();

                // 1. 建立專案總集 ID
                const allProjIds = new Set([
                    ...cloudList.map(p => p.id),
                    ...localList.map(p => p.id)
                ]);

                allProjIds.forEach(projId => {
                    const cloudProj = cloudList.find(p => p.id === projId);
                    const localProj = localList.find(p => p.id === projId);
                    const baseProj = baseList.find(p => p.id === projId);

                    if (cloudProj && !localProj) {
                        mergedMap.set(projId, this.normalizeProject(cloudProj));
                        return;
                    }
                    if (!cloudProj && localProj) {
                        mergedMap.set(projId, this.normalizeProject(localProj));
                        return;
                    }

                    const cNorm = this.normalizeProject(cloudProj);
                    const lNorm = this.normalizeProject(localProj);
                    const bNorm = baseProj ? this.normalizeProject(baseProj) : null;

                    const cTime = new Date(cNorm.updatedAt || 0).getTime();
                    const lTime = new Date(lNorm.updatedAt || 0).getTime();
                    const isTypingNow = this.state.isUserTyping || (this.state.hasUnsavedChanges && (Date.now() - (this.state.lastLocalSaveTime?.getTime() || 0) < 5000));

                    // ✅ 核心防線 1：如果當前裝置沒有在主動打字，且雲端時間戳 >= 本地（例如電腦剛同步，手機剛打開 App）
                    // 100% 以最新雲端為準（SSOT），絕對防止手機舊快取倒灌覆蓋雲端！
                    if (!isTypingNow && cTime >= lTime) {
                        mergedMap.set(projId, cNorm);
                        return;
                    }

                    const mergedProj = { ...(cTime >= lTime ? cNorm : lNorm) };
                    mergedProj.id = projId;

                    // 專案名稱與分類：若本地有編輯則以本地為準
                    if (bNorm) {
                        mergedProj.title = (lNorm.title !== bNorm.title) ? lNorm.title : cNorm.title;
                        mergedProj.category = (lNorm.category !== bNorm.category) ? lNorm.category : cNorm.category;
                        mergedProj.password = (lNorm.password !== bNorm.password) ? lNorm.password : cNorm.password;
                        mergedProj.hidden = (lNorm.hidden !== bNorm.hidden) ? lNorm.hidden : cNorm.hidden;
                    } else {
                        mergedProj.title = (cTime >= lTime) ? cNorm.title : (lNorm.title || cNorm.title);
                        mergedProj.category = (cTime >= lTime) ? cNorm.category : (lNorm.category || cNorm.category);
                        mergedProj.password = (cTime >= lTime) ? (cNorm.password || '') : (lNorm.password || cNorm.password || '');
                        mergedProj.hidden = (cTime >= lTime) ? (!!cNorm.hidden) : (!!lNorm.hidden);
                    }

                    // 精靈欄位細粒度合併
                    const bWiz = bNorm?.wizard || {};
                    const lWiz = lNorm.wizard || {};
                    const cWiz = cNorm.wizard || {};
                    mergedProj.wizard = {
                        vision: (lWiz.vision !== bWiz.vision) ? lWiz.vision : (cWiz.vision || lWiz.vision || ''),
                        features: (lWiz.features !== bWiz.features) ? lWiz.features : (cWiz.features || lWiz.features || ''),
                        tech: (lWiz.tech !== bWiz.tech) ? lWiz.tech : (cWiz.tech || lWiz.tech || '')
                    };

                    // 文檔細粒度 3-Way 合併
                    const allDocIds = new Set([
                        ...(cNorm.docs || []).map(d => d.id),
                        ...(lNorm.docs || []).map(d => d.id)
                    ]);
                    const mergedDocs = [];

                    allDocIds.forEach(docId => {
                        const cDoc = cNorm.docs?.find(d => d.id === docId);
                        const lDoc = lNorm.docs?.find(d => d.id === docId);
                        const bDoc = bNorm?.docs?.find(d => d.id === docId);

                        if (cDoc && !lDoc) {
                            mergedDocs.push({ ...cDoc });
                        } else if (!cDoc && lDoc) {
                            mergedDocs.push({ ...lDoc });
                        } else {
                            // 兩端皆有
                            let mTitle = lDoc.title;
                            let mContent = lDoc.content;

                            // 1. 若本地與雲端完全相同，直接使用
                            if (lDoc.content === cDoc.content && lDoc.title === cDoc.title) {
                                mTitle = lDoc.title;
                                mContent = lDoc.content;
                            }
                            // 2. 若當前文檔是本地使用者正在編輯/有未存修改的文檔，本地 100% 絕對優先，絕不被舊雲端覆蓋或插入偽衝突
                            else if (docId === this.state.activeDocId && (this.state.hasUnsavedChanges || this.state.isUserTyping)) {
                                mTitle = lDoc.title || cDoc.title;
                                mContent = lDoc.content;
                            }
                            // 3. 若有歷史 Base 版本進行比對
                            else if (bDoc) {
                                const localChanged = lDoc.content !== bDoc.content || lDoc.title !== bDoc.title;
                                const cloudChanged = cDoc.content !== bDoc.content || cDoc.title !== bDoc.title;

                                if (localChanged && !cloudChanged) {
                                    // 本地有改，雲端沒改 -> 以本地為準
                                    mTitle = lDoc.title;
                                    mContent = lDoc.content;
                                } else if (!localChanged && cloudChanged) {
                                    // 雲端有改，本地沒改 -> 以雲端為準
                                    mTitle = cDoc.title;
                                    mContent = cDoc.content;
                                } else if (localChanged && cloudChanged) {
                                    // 兩端皆有真正修改，執行 3-Way 文本智慧合併
                                    mTitle = (lDoc.title !== bDoc.title) ? lDoc.title : cDoc.title;
                                    mContent = this.threeWayMergeText(bDoc.content || '', lDoc.content || '', cDoc.content || '');
                                } else {
                                    mTitle = lDoc.title;
                                    mContent = lDoc.content;
                                }
                            }
                            // 4. 若無 Base 歷史紀錄，以本地最新內容為準
                            else {
                                mTitle = lDoc.title || cDoc.title;
                                mContent = lDoc.content || cDoc.content || '';
                            }

                            const mFolderId = (lDoc && lDoc.folderId !== undefined) ? lDoc.folderId : (cDoc ? cDoc.folderId : null);
                            const mAttachments = {
                                ...((cDoc && typeof cDoc.attachments === 'object') ? cDoc.attachments : {}),
                                ...((lDoc && typeof lDoc.attachments === 'object') ? lDoc.attachments : {})
                            };
                            mergedDocs.push({
                                id: docId,
                                title: mTitle || '未命名文檔',
                                content: mContent || '',
                                folderId: mFolderId || null,
                                attachments: mAttachments
                            });
                        }
                    });
                    mergedProj.docs = mergedDocs;

                    // 資料夾細粒度合併
                    const folderMap = new Map();
                    (cNorm.docFolders || []).forEach(f => { if (f && f.id) folderMap.set(f.id, f); });
                    (lNorm.docFolders || []).forEach(f => { if (f && f.id) folderMap.set(f.id, f); });
                    mergedProj.docFolders = Array.from(folderMap.values());

                    // 任務細粒度合併
                    const allTaskIds = new Set([
                        ...(cNorm.tasks || []).map(t => t.id),
                        ...(lNorm.tasks || []).map(t => t.id)
                    ]);
                    const mergedTasks = [];

                    allTaskIds.forEach(taskId => {
                        const cTask = cNorm.tasks?.find(t => t.id === taskId);
                        const lTask = lNorm.tasks?.find(t => t.id === taskId);
                        const bTask = bNorm?.tasks?.find(t => t.id === taskId);

                        if (cTask && !lTask) {
                            mergedTasks.push({ ...cTask });
                        } else if (!cTask && lTask) {
                            mergedTasks.push({ ...lTask });
                        } else {
                            // 兩端皆有同一個任務
                            const mTitle = (bTask && lTask.title !== bTask.title) ? lTask.title : cTask.title;
                            const mDesc = (bTask && lTask.desc !== bTask.desc) ? lTask.desc : (cTask.desc || lTask.desc);
                            const mStatus = (bTask && lTask.status !== bTask.status) ? lTask.status : cTask.status;
                            const mPriority = (bTask && lTask.priority !== bTask.priority) ? lTask.priority : cTask.priority;
                            const mAssignee = (bTask && lTask.assignee !== bTask.assignee) ? lTask.assignee : cTask.assignee;

                            // 留言聯集去重合併 (CRDT append-only)
                            const commentMap = new Map();
                            (cTask.comments || []).forEach(c => { if (c) commentMap.set(c.id || c.time + c.text, c); });
                            (lTask.comments || []).forEach(c => { if (c) commentMap.set(c.id || c.time + c.text, c); });

                            mergedTasks.push({
                                id: taskId,
                                title: mTitle,
                                desc: mDesc || '',
                                status: mStatus,
                                priority: mPriority,
                                assignee: mAssignee || '',
                                comments: Array.from(commentMap.values())
                            });
                        }
                    });
                    mergedProj.tasks = mergedTasks;

                    // 成員聯集
                    const memberMap = new Map();
                    (cNorm.members || []).forEach(m => { if (m) memberMap.set(m.id, m); });
                    (lNorm.members || []).forEach(m => { if (m) memberMap.set(m.id, m); });
                    mergedProj.members = Array.from(memberMap.values());

                    // 活動日誌聯集
                    const actMap = new Map();
                    (cNorm.activities || []).forEach(a => { if (a) actMap.set(a.id || a.time + a.text, a); });
                    (lNorm.activities || []).forEach(a => { if (a) actMap.set(a.id || a.time + a.text, a); });
                    mergedProj.activities = Array.from(actMap.values()).slice(-50);

                    // 在線狀態聯集
                    mergedProj.presence = { ...(cNorm.presence || {}), ...(lNorm.presence || {}) };
                    mergedProj.updatedAt = new Date().toISOString();

                    mergedMap.set(projId, mergedProj);
                });

                return Array.from(mergedMap.values());
            }
};
