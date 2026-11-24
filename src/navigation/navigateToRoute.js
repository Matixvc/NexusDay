import { PRIMARY_TAB_NAMES } from './primaryTabs';

/** Navigate to a primary page from a secondary stack screen, or to any other route normally. */
export function navigateToRoute(navigation, name, params) {
  if (PRIMARY_TAB_NAMES.includes(name) && navigation.getState?.().type === 'stack') {
    const nestedRoute = params ? { screen: name, params } : { screen: name };
    if (typeof navigation.popTo === 'function') navigation.popTo('Principal', nestedRoute);
    else navigation.navigate('Principal', nestedRoute);
    return;
  }

  navigation.navigate(name, params);
}
