import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ColorValue } from 'react-native';

const blue = '#0349b8';
const inactive = '#8d929d';

type IconName = 'home' | 'lines' | 'transfer' | 'profile';

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  const icons = {
    home: { ios: 'house', android: 'home', web: 'home' },
    lines: { ios: 'map', android: 'map', web: 'map' },
    transfer: { ios: 'arrow.triangle.swap', android: 'sync_alt', web: 'sync_alt' },
    profile: { ios: 'person', android: 'person', web: 'person' },
  } as const;

  return <SymbolView name={icons[name]} size={24} tintColor={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: blue,
        tabBarActiveBackgroundColor: '#E8F4FF',
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '800',
        },
        // Keeps the main navigation close to the rounded mobile tab surface.
        tabBarItemStyle: {
          borderRadius: 28,
          marginHorizontal: 5,
          marginVertical: 8,
          paddingVertical: 6,
        },
        tabBarStyle: {
          backgroundColor: '#F7F8FC',
          borderTopColor: '#edf0f5',
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 14,
          paddingHorizontal: 20,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lines"
        options={{
          title: '线路',
          tabBarIcon: ({ color }) => <TabIcon name="lines" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          title: '换乘',
          tabBarIcon: ({ color }) => <TabIcon name="transfer" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
