import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppData } from '../context/AppDataContext';
import { buildScheduleWidgetSnapshot } from '../services/scheduleWidgetSnapshot';
import { buildDayWidgetSnapshot } from '../services/dayWidgetSnapshot';
import { buildCalendarWidgetSnapshot } from '../services/calendarWidgetSnapshot';

let publishing = false;
const publishedSignatures = new Map();

function safePublish(name, callback) {
  try { callback(); return true; } catch { console.warn(`[widget:${name}] publication failed`); return false; }
}

export function getWidgetContentSignature(snapshot) {
  const { updatedAt, ...content } = snapshot || {};
  return JSON.stringify(content);
}

function publishIfChanged(name, widget, snapshot) {
  const signature = getWidgetContentSignature(snapshot);
  if (publishedSignatures.get(name) === signature) return false;
  const published = safePublish(name, () => widget.updateSnapshot(snapshot));
  if (published) publishedSignatures.set(name, signature);
  return published;
}

export function publish(activities, routines, events, birthdays, showDetails, widgetModules) {
  if (publishing) return false;
  publishing = true;
  try {
    const scheduleWidget = widgetModules?.scheduleWidget || require('../widgets/ScheduleWidget').scheduleWidget;
    const dayWidget = widgetModules?.dayWidget || require('../widgets/DayWidget').dayWidget;
    const calendarWidget = widgetModules?.calendarWidget || require('../widgets/CalendarWidget').calendarWidget;
    publishIfChanged('schedule', scheduleWidget, buildScheduleWidgetSnapshot({ activities, showDetails }));
    publishIfChanged('day', dayWidget, buildDayWidgetSnapshot({ activities, routines, events }));
    publishIfChanged('calendar', calendarWidget, buildCalendarWidgetSnapshot({ activities, events, birthdays }));
  } finally { publishing = false; }
  return true;
}

export default function ScheduleWidgetSync() {
  const { activities, routines, events, birthdays, settings, hydrated } = useAppData();

  useEffect(() => {
    if (Platform.OS !== 'android' || !hydrated) return undefined;
    const showDetails = settings?.scheduleWidgetShowDetails === true;
    let dayTimer;
    let disposed = false;
    const update = () => publish(activities, routines, events, birthdays, showDetails);
    const scheduleMidnightRefresh = () => {
      clearTimeout(dayTimer);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 1500);
      dayTimer = setTimeout(() => {
        if (disposed) return;
        update();
        scheduleMidnightRefresh();
      }, Math.max(1000, midnight.getTime() - now.getTime()));
    };

    update();
    scheduleMidnightRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        update();
        scheduleMidnightRefresh();
      }
    });

    return () => {
      disposed = true;
      clearTimeout(dayTimer);
      subscription.remove();
    };
  }, [activities, routines, events, birthdays, hydrated, settings?.scheduleWidgetShowDetails]);

  return null;
}
