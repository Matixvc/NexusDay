import { createWidget } from 'expo-widgets';
import { Column, Row, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

function ScheduleWidget(props, environment) {
  'widget';

  const current = new Date();
  const localDateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  const stale = props?.dateKey !== localDateKey;
  const dark = environment?.colorScheme !== 'light';
  const surface = dark ? '#151A1E' : '#F4F7F8';
  const primary = dark ? '#F2F7F8' : '#172126';
  const muted = dark ? '#A8B7BC' : '#5C6A70';
  const accent = '#00C7D9';
  const allClasses = stale ? [] : (props?.classes || []);
  const classes = allClasses
    .filter((item) => !props?.nextClass || item.start !== props.nextClass.start || item.end !== props.nextClass.end)
    .slice(0, 2);
  const updated = props?.updatedAt ? new Date(props.updatedAt) : null;
  const updatedLabel = updated && !Number.isNaN(updated.getTime())
    ? `${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')}`
    : '--:--';

  return (
    <Column
      verticalArrangement="spaceBetween"
      modifiers={[fillMaxSize(), paddingAll(14), background(surface)]}
    >
      <Row horizontalArrangement="spaceBetween">
        <Text color={accent} fontSize={12} fontWeight="700">NEXUSDAY</Text>
        <Text color={muted} fontSize={12}>MI HORARIO</Text>
      </Row>

      {stale ? (
        <Column verticalArrangement="center">
          <Text color={primary} fontSize={17} fontWeight="700">Horario pendiente</Text>
          <Text color={muted} fontSize={13}>Abre NexusDay para actualizar el día.</Text>
        </Column>
      ) : props?.status === 'free' ? (
        <Column verticalArrangement="center">
          <Text color={primary} fontSize={19} fontWeight="700">Día libre</Text>
          <Text color={muted} fontSize={13}>No hay clases programadas.</Text>
        </Column>
      ) : props?.status === 'suspended' ? (
        <Column verticalArrangement="center">
          <Text color={primary} fontSize={18} fontWeight="700">Clases suspendidas</Text>
          <Text color={muted} fontSize={13}>No tienes clases activas hoy.</Text>
        </Column>
      ) : (
        <Column verticalArrangement="spaceBetween">
          {props?.nextClass ? (
            <Column>
              <Text color={muted} fontSize={12}>PRÓXIMA CLASE</Text>
              <Text color={primary} fontSize={18} fontWeight="700">
                {props.nextClass.title || `${props.nextClass.start} – ${props.nextClass.end}`}
              </Text>
              {props.nextClass.title ? <Text color={muted} fontSize={13}>{props.nextClass.start} – {props.nextClass.end}</Text> : null}
            </Column>
          ) : (
            <Text color={primary} fontSize={17} fontWeight="700">Terminaste tus clases</Text>
          )}
          {classes.map((item, index) => (
            <Row key={`${item.start}-${index}`} horizontalArrangement="spaceBetween">
              <Text color={muted} fontSize={12}>{item.start}–{item.end}</Text>
              <Text color={primary} fontSize={13} maxLines={1} overflow="ellipsis">
                {item.title || `Clase ${index + 1}`}
              </Text>
            </Row>
          ))}
        </Column>
      )}

      <Row horizontalArrangement="spaceBetween">
        <Text color={muted} fontSize={11}>Actualizado {updatedLabel}</Text>
        <Text color={accent} fontSize={11} fontWeight="600">NEX</Text>
      </Row>
    </Column>
  );
}

export const scheduleWidget = createWidget('ScheduleWidget', ScheduleWidget, {
  dateKey: '',
  updatedAt: 0,
  status: 'stale',
  classes: [],
  nextClass: null,
});
