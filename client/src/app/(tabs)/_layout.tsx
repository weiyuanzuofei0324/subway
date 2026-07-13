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
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#edf0f5',
          height: 68,
          paddingBottom: 10,
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
          title: '线路站点',
          tabBarIcon: ({ color }) => <TabIcon name="lines" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          title: '换乘信息',
          tabBarIcon: ({ color }) => <TabIcon name="transfer" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '个人信息',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
