import { createWidget } from 'expo-widgets';
import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { getCalendarWidgetSnapshotView } from '../services/calendarWidgetSnapshot';

function CalendarWidget(props, environment) {
  'widget';
  const view = getCalendarWidgetSnapshotView(props || {}, new Date());
  const dark = environment?.colorScheme !== 'light';
  const primary = dark ? '#F2F7F8' : '#172126'; const muted = dark ? '#A8B7BC' : '#5C6A70';
  return <Column verticalArrangement="spaceBetween" modifiers={[fillMaxSize(), paddingAll(14), background(dark ? '#151A1E' : '#F4F7F8')]}>
    <Text color="#B78CFF" fontSize={12} fontWeight="700" maxLines={1} overflow="ellipsis">NEXUSDAY · CALENDARIO</Text><Text color={muted} fontSize={12} maxLines={1}>{view?.dateLabel || 'Hoy'}</Text>
    {view?.status === 'stale' ? <Column><Text color={primary} fontSize={17} fontWeight="700" maxLines={1} overflow="ellipsis">Calendario pendiente</Text><Text color={muted} fontSize={13} maxLines={1}>Abre NexusDay para actualizar.</Text></Column> : view?.status === 'empty' ? <Text color={primary} fontSize={18} fontWeight="700" maxLines={1}>Sin actividades</Text> : <Column><Text color={primary} fontSize={16} fontWeight="700" maxLines={1} overflow="ellipsis">{view?.nextEvent ? `Próximo · ${view.nextEvent.time}` : 'Sin eventos próximos'}</Text><Text color={muted} fontSize={13} maxLines={1}>{view?.activityCount || 0} actividades hoy</Text><Text color="#B78CFF" fontSize={13} maxLines={1}>{view?.birthdayPresent ? 'Hay cumpleaños hoy' : 'Sin cumpleaños hoy'}</Text></Column>}
    <Text color={muted} fontSize={11}>{view?.status === 'stale' ? 'Abre NexusDay para actualizar.' : 'Actualizado recientemente'}</Text>
  </Column>;
}
export const calendarWidget = createWidget('CalendarWidget', CalendarWidget, { dateKey: '', dateLabel: '', updatedAt: 0, status: 'stale', nextEvent: null, activityCount: 0, birthdayPresent: false });
