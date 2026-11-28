import { createWidget } from 'expo-widgets';
import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { getDayWidgetSnapshotView } from '../services/dayWidgetSnapshot';

function DayWidget(props, environment) {
  'widget';
  const view = getDayWidgetSnapshotView(props || {}, new Date());
  const dark = environment?.colorScheme !== 'light';
  const primary = dark ? '#F2F7F8' : '#172126'; const muted = dark ? '#A8B7BC' : '#5C6A70';
  return <Column verticalArrangement="spaceBetween" modifiers={[fillMaxSize(), paddingAll(14), background(dark ? '#151A1E' : '#F4F7F8')]}>
    <Text color="#00C7D9" fontSize={12} fontWeight="700" maxLines={1} overflow="ellipsis">NEXUSDAY · MI DÍA</Text><Text color={muted} fontSize={12} maxLines={1}>{view?.dateLabel || 'Hoy'}</Text>
    {view?.status === 'stale' ? <Column><Text color={primary} fontSize={17} fontWeight="700" maxLines={1} overflow="ellipsis">Datos pendientes de actualizar</Text><Text color={muted} fontSize={13} maxLines={1}>Abre NexusDay para actualizar.</Text></Column> : view?.status === 'empty' ? <Text color={primary} fontSize={18} fontWeight="700" maxLines={1}>Tu día está vacío</Text> : <Column><Text color={primary} fontSize={16} fontWeight="700" maxLines={1} overflow="ellipsis">{view?.nextClass ? `Próxima clase · ${view.nextClass.start}` : 'Sin clases próximas'}</Text><Text color={muted} fontSize={13} maxLines={1}>{view?.pendingRoutineCount ? `${view.pendingRoutineCount} rutinas pendientes` : 'Sin rutinas pendientes'}</Text><Text color={muted} fontSize={13} maxLines={1}>{view?.nextEvent ? `Próximo evento · ${view.nextEvent.time}` : 'Sin eventos próximos'}</Text></Column>}
    <Text color={muted} fontSize={11}>{view?.status === 'stale' ? 'Abre NexusDay para actualizar.' : 'Actualizado recientemente'}</Text>
  </Column>;
}
export const dayWidget = createWidget('DayWidget', DayWidget, { dateKey: '', dateLabel: '', updatedAt: 0, status: 'stale', nextClass: null, pendingRoutineCount: 0, nextEvent: null });
