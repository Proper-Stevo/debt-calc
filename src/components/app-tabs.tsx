import { Image } from 'react-native';
import { Platform, useColorScheme } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Web doesn't have a real "native" tab bar to defer to, so NativeTabs
  // falls back to a top nav bar there. Use the regular Tabs component on
  // web instead, pinned to the bottom so it matches the native app feel.
  if (Platform.OS === 'web') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarPosition: 'bottom',
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.backgroundElement,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Image
                source={require('@/assets/images/tabIcons/home.png')}
                style={{ width: size, height: size, tintColor: color }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="cards"
          options={{
            title: 'Cards',
            tabBarIcon: ({ color, size }) => (
              <Image
                source={require('@/assets/images/tabIcons/explore.png')}
                style={{ width: size, height: size, tintColor: color }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, size }) => (
              <Image
                source={require('@/assets/images/tabIcons/explore.png')}
                style={{ width: size, height: size, tintColor: color }}
              />
            ),
          }}
        />
      </Tabs>
    );
  }

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cards">
        <NativeTabs.Trigger.Label>Cards</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}