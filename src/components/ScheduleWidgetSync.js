import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppData } from '../context/AppDataContext';
import { buildScheduleWidgetSnapshot } from '../services/scheduleWidgetSnapshot';

function publish(activities, showDetails) {
  try {
    const { scheduleWidget } = require('../widgets/ScheduleWidget');
    scheduleWidget.updateSnapshot(buildScheduleWidgetSnapshot({ activities, showDetails }));
  } catch {
    // Expo Go and native builds without the widget module remain usable; a development build is required.
  }
}

export default function ScheduleWidgetSync() {
  const { activities, settings, hydrated } = useAppData();

  useEffect(() => {
    if (Platform.OS !== 'android' || !hydrated) return undefined;
    const showDetails = settings?.scheduleWidgetShowDetails === true;
    let dayTimer;
    let disposed = false;
    const update = () => publish(activities, showDetails);
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
  }, [activities, hydrated, settings?.scheduleWidgetShowDetails]);

  return null;
}
