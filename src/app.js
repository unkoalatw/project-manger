// FlatSpec - 專案設計與執行系統 (Modularized Architecture)
import { state } from './modules/state.js';
import { audio } from './modules/audio.js';
import { dataModels } from './modules/dataModels.js';
import { diffMerge } from './modules/diffMerge.js';
import { lifecycle } from './modules/lifecycle.js';
import { storage } from './modules/storage.js';
import { sync } from './modules/sync.js';
import { projects } from './modules/projects.js';
import { views } from './modules/views.js';
import { folders } from './modules/folders.js';
import { dashboard } from './modules/dashboard.js';
import { docs } from './modules/docs.js';
import { audioMemo } from './modules/audioMemo.js';
import { reader } from './modules/reader.js';
import { docToc } from './modules/docToc.js';
import { docFindReplace } from './modules/docFindReplace.js';
import { wizard } from './modules/wizard.js';
import { tasks } from './modules/tasks.js';
import { utils } from './modules/utils.js';
import { settings } from './modules/settings.js';
import { image } from './modules/image.js';
import { math } from './modules/math.js';
import { sandbox } from './modules/sandbox.js';
import { snapshots } from './modules/snapshots.js';
import { markdown } from './modules/markdown.js';
import { fonts } from './modules/fonts.js';
import { pagination } from './modules/pagination.js';
import { timeMachine } from './modules/timeMachine.js';
import { aiDecompose } from './modules/aiDecompose.js';
import { aiDocAssistant } from './modules/aiDocAssistant.js';
import { docCollapsible } from './modules/docCollapsible.js';
import { docDatabase } from './modules/docDatabase.js';
import { docWidgets } from './modules/docWidgets.js';
import { memorySearch } from './modules/memorySearch.js';
import { codeEditor } from './modules/codeEditor.js';

// FlatSpec Core Architecture Modules
import { platform } from './core/platform/platformAdapter.js';
import { idbStorage, STORES } from './core/storage/idb.js';
import { SchemaManager, CURRENT_SCHEMA_VERSION } from './core/schema/schemaManager.js';
import { ChangeJournal, OPERATIONS } from './core/journal/changeJournal.js';
import { commandBus, Command } from './core/commands/commandBus.js';
import { HealthChecker } from './core/health/healthChecker.js';

export const app = {
    core: {
        platform,
        idbStorage,
        STORES,
        SchemaManager,
        CURRENT_SCHEMA_VERSION,
        ChangeJournal,
        OPERATIONS,
        commandBus,
        Command,
        HealthChecker
    },
    state,
    ...audio,
    ...dataModels,
    ...diffMerge,
    ...lifecycle,
    ...storage,
    ...sync,
    ...projects,
    ...views,
    ...folders,
    ...dashboard,
    ...docs,
    ...audioMemo,
    ...reader,
    ...docToc,
    ...docFindReplace,
    ...wizard,
    ...tasks,
    ...utils,
    ...settings,
    ...image,
    ...math,
    ...sandbox,
    ...snapshots,
    ...markdown,
    ...fonts,
    ...pagination,
    ...timeMachine,
    ...aiDecompose,
    ...aiDocAssistant,
    ...docCollapsible,
    ...docDatabase,
    ...docWidgets,
    ...memorySearch,
    ...codeEditor
};

// 啟動應用程式
if (typeof window !== 'undefined') {
    window.app = app;
    window.onload = () => {
        app.init();
    };
}

export default app;
