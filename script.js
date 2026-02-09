import "./app-context.js";
import "./timeline/timesheet.js";
import "./time-duration.js";
import "./hash-router.js";
import "./hash-nav.js";
import "./current-task.js";
import "./tasks/task-list.js";
import "./pie-progress.js";
import "./tasks/task-status.js";
import "./file-sync-menu.js";
import timeLoop from "./utils/timeLoop.js";
import calcDuration, { formatDurationToStandard, hoursToMilliseconds } from "./utils/calcDuration.js";
import { offsetHue, hexToHsla } from "./utils/colorUtils.js";
import store from "./timesheetStore.js";
import { effect } from "./utils/Signal.js";

const APP_VERSION = "1.5.0";

(async () => {
    // Register service worker
    if ('serviceWorker' in navigator) {
        try {
            console.log('CLIENT: registering service worker.');
            await navigator.serviceWorker.register(`./serviceWorker.js?version=${APP_VERSION}`);
            console.log('CLIENT: service worker registration complete.');
        } catch (e) {
            console.error(e);
        }
    }

    // Initialize default settings
    const defaultSettings = {
        timeSnapThreshold: 6,
        color: "#112233"
    };

    // Load initial state from storage
    const initialState = await store.read();
    initialState.settings = { ...defaultSettings, ...initialState.settings };

    console.log("Initial state loaded:", initialState);

    // Get app-context element and initialize with state
    const appContext = document.querySelector('app-context');
    await appContext.initialize(initialState);

    // Subscribe to settings changes for theme rendering
    effect(function renderTheme() {
        const settings = appContext.settings.value;
        if (settings.color) {
            const themeColor = settings.color.startsWith('#')
                ? hexToHsla(settings.color, 1)
                : settings.color;
            document.documentElement.style.setProperty("--color-theme", themeColor);
            const backgroundColor = offsetHue(themeColor, 30);
            document.documentElement.style.setProperty("--color-background-gradient", backgroundColor);
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
        }
    }, appContext.settings);

    // Tab title update loop
    timeLoop(1000, () => {
        renderTabTitle({
            newEntry: appContext.newEntry.value,
            currentTask: appContext.currentTask.value
        });
    });
})();

function renderTabTitle({ newEntry = {}, currentTask = {} }) {
    const title = "Timesheet";
    let info = [];

    if (newEntry.start) {
        info.push(formatDurationToStandard({
            duration: calcDuration({ start: newEntry.start, end: new Date() }, 'milliseconds')
                + hoursToMilliseconds(currentTask?.total || 0)
        }));
    }

    if (currentTask?.exid === newEntry.task && newEntry.task) {
        info.push(`${currentTask.description || currentTask.exid} (${currentTask.exid})`);
    } else if (newEntry.task) {
        info.push(newEntry.task);
    }

    document.title = info.length ? `${info.join(' ')} | ${title}` : title;
}
