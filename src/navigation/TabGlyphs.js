import { View } from 'react-native';
import { themedStyles, radius } from '../theme/theme';

/**
 * Tab icons drawn with plain Views instead of an icon font:
 * `@expo/vector-icons` is not a dependency of this project, and these shapes
 * tint cleanly for the active state without adding one.
 */
export function Glyph({ name, color }) {
  if (name === 'home') {
    return (
      <View style={styles.home}>
        <View style={[styles.roof, { borderBottomColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]} />
      </View>
    );
  }

  if (name === 'schedule') {
    return (
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.gridCell, { backgroundColor: color }]} />
        ))}
      </View>
    );
  }

  if (name === 'calendar') {
    return (
      <View style={[styles.agenda, { borderColor: color }]}>
        <View style={[styles.agendaBar, { backgroundColor: color }]} />
        <View style={styles.agendaDots}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'birthdays') {
    return (
      <View style={styles.cake}>
        <View style={styles.flames}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.flame, { backgroundColor: color }]} />
          ))}
        </View>
        <View style={[styles.cakeTop, { backgroundColor: color }]} />
        <View style={[styles.cakeBase, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'settings') {
    return (
      <View style={styles.sliders}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.sliderRow}>
            <View style={[styles.sliderTrack, { backgroundColor: color }]} />
            <View
              style={[
                styles.sliderKnob,
                { backgroundColor: color, marginLeft: index === 1 ? 2 : 0 },
                index === 2 ? { marginLeft: 8 } : null,
              ]}
            />
            <View style={[styles.sliderTrack, { backgroundColor: color, flex: index === 2 ? 0.4 : 1 }]} />
          </View>
        ))}
      </View>
    );
  }

  if (name === 'habit') {
    return (
      <View style={[styles.check, { borderColor: color }]}>
        <View style={[styles.checkShort, { backgroundColor: color }]} />
        <View style={[styles.checkLong, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'money') {
    return (
      <View style={[styles.coin, { borderColor: color }]}>
        <View style={[styles.coinBar, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'ai') {
    return (
      <View style={styles.bot}>
        <View style={[styles.botAntenna, { backgroundColor: color }]} />
        <View style={[styles.botHead, { borderColor: color }]}>
          <View style={[styles.botEye, { backgroundColor: color }]} />
          <View style={[styles.botEye, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === 'search') {
    return (
      <View style={styles.magnifier}>
        <View style={[styles.magnifierLens, { borderColor: color }]} />
        <View style={[styles.magnifierHandle, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'close') {
    return (
      <View style={styles.cross}>
        <View style={[styles.crossBar, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.crossBar, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
      </View>
    );
  }

  if (name === 'trash') {
    return (
      <View style={styles.bin}>
        <View style={[styles.binLid, { backgroundColor: color }]} />
        <View style={[styles.binBody, { borderColor: color }]}>
          <View style={[styles.binBar, { backgroundColor: color }]} />
          <View style={[styles.binBar, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.note, { borderColor: color }]}>
      <View style={[styles.noteLine, { backgroundColor: color }]} />
      <View style={[styles.noteLineShort, { backgroundColor: color }]} />
    </View>
  );
}

const styles = themedStyles({
  home: { width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  homeBody: { width: 15, height: 10, borderWidth: 1.6, borderBottomWidth: 0, borderTopWidth: 0 },
  grid: { width: 22, height: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  gridCell: { width: 9, height: 9, borderRadius: 3 },
  agenda: {
    width: 21,
    height: 21,
    borderRadius: 5,
    borderWidth: 1.6,
    paddingTop: 3,
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  agendaBar: { width: 13, height: 3, borderRadius: 2 },
  agendaDots: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 3.5, height: 3.5, borderRadius: 2 },
  cake: { width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  flames: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  flame: { width: 3, height: 5, borderRadius: radius.sm },
  cakeTop: { width: 16, height: 6, borderRadius: 3 },
  cakeBase: { width: 21, height: 7, borderRadius: 3 },
  sliders: { width: 22, height: 22, justifyContent: 'space-evenly' },
  sliderRow: { flexDirection: 'row', alignItems: 'center' },
  sliderTrack: { flex: 1, height: 2, borderRadius: 1 },
  sliderKnob: { width: 4, height: 8, borderRadius: 2, marginHorizontal: 2 },
  note: {
    width: 19,
    height: 21,
    borderRadius: 5,
    borderWidth: 1.6,
    paddingTop: 5,
    paddingHorizontal: 4,
    gap: 3,
  },
  noteLine: { width: 11, height: 2, borderRadius: 1 },
  noteLineShort: { width: 7, height: 2, borderRadius: 1 },

  // Habits: a check mark inside a ring.
  check: { width: 21, height: 21, borderRadius: radius.pill, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  checkShort: {
    position: 'absolute',
    width: 6,
    height: 2,
    borderRadius: 1,
    left: 5,
    top: 11,
    transform: [{ rotate: '45deg' }],
  },
  checkLong: {
    position: 'absolute',
    width: 12,
    height: 2,
    borderRadius: 1,
    left: 8,
    top: 10,
    transform: [{ rotate: '-50deg' }],
  },

  // Expenses: a coin with the vertical bar of a currency symbol.
  coin: { width: 21, height: 21, borderRadius: radius.pill, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  coinBar: { width: 2, height: 9, borderRadius: 1 },

  // Nexus AI: a little bot head with an antenna.
  bot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  botAntenna: { width: 2, height: 4, borderRadius: 1, marginBottom: 1 },
  botHead: {
    width: 21,
    height: 16,
    borderRadius: 6,
    borderWidth: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  botEye: { width: 3, height: 3, borderRadius: 2 },

  // Search field and its clear button.
  magnifier: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  magnifierLens: { width: 15, height: 15, borderRadius: radius.pill, borderWidth: 1.8, marginTop: -2, marginLeft: -2 },
  magnifierHandle: { position: 'absolute', width: 7, height: 2, borderRadius: 1, right: 1, bottom: 3, transform: [{ rotate: '45deg' }] },
  cross: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  crossBar: { position: 'absolute', width: 14, height: 2, borderRadius: 1 },

  // "Clear the conversation" in the assistant header.
  bin: { width: 20, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  binLid: { width: 20, height: 2, borderRadius: 1, marginBottom: 2 },
  binBody: {
    width: 15,
    height: 15,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  binBar: { width: 1.8, height: 7, borderRadius: 1 },
});
