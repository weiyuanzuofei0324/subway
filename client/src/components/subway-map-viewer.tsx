import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const subwayMap = require('@/assets/svg/subway.svg');

const MAP_WIDTH = 3530;
const MAP_HEIGHT = 3730;
const MAP_RATIO = MAP_WIDTH / MAP_HEIGHT;
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.35;

type SubwayMapViewerProps = {
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
  onRequestFullscreen?: () => void;
  style?: StyleProp<ViewStyle>;
};

type IconName = 'plus' | 'minus' | 'home' | 'fullscreen' | 'close';

function clampScale(value: number) {
  'worklet';
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
}

function MapButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const icons = {
    plus: { ios: 'plus', android: 'add', web: 'add' },
    minus: { ios: 'minus', android: 'remove', web: 'remove' },
    home: { ios: 'house', android: 'home', web: 'home' },
    fullscreen: { ios: 'arrow.up.left.and.arrow.down.right', android: 'fullscreen', web: 'fullscreen' },
    close: { ios: 'xmark', android: 'close', web: 'close' },
  } as const;

  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
      onPress={onPress}>
      <SymbolView name={icons[icon]} size={24} tintColor="#203047" />
    </Pressable>
  );
}

export function SubwayMapViewer({
  fullscreen = false,
  onExitFullscreen,
  onRequestFullscreen,
  style,
}: SubwayMapViewerProps) {
  const [layout, setLayout] = useState({ height: 0, width: 0 });
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  const mapSize = useMemo(() => {
    if (!layout.width || !layout.height) {
      return { height: 0, width: 0 };
    }

    const layoutRatio = layout.width / layout.height;
    if (layoutRatio > MAP_RATIO) {
      const height = layout.height;
      return { height, width: height * MAP_RATIO };
    }

    const width = layout.width;
    return { height: width / MAP_RATIO, width };
  }, [layout.height, layout.width]);

  const mapPosition = useMemo(
    () => ({
      left: (layout.width - mapSize.width) / 2,
      top: (layout.height - mapSize.height) / 2,
    }),
    [layout.height, layout.width, mapSize.height, mapSize.width],
  );

  const animatedMapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin(() => {
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        translateX.value = startTranslateX.value + event.translationX;
        translateY.value = startTranslateY.value + event.translationY;
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        startScale.value = scale.value;
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        const nextScale = clampScale(startScale.value * event.scale);
        const ratio = nextScale / startScale.value;
        const originX = event.focalX - layout.width / 2;
        const originY = event.focalY - layout.height / 2;

        scale.value = nextScale;
        translateX.value = originX - (originX - startTranslateX.value) * ratio;
        translateY.value = originY - (originY - startTranslateY.value) * ratio;
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [
    layout.height,
    layout.width,
    scale,
    startScale,
    startTranslateX,
    startTranslateY,
    translateX,
    translateY,
  ]);

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    setLayout({ height, width });
  }

  function zoomBy(factor: number) {
    scale.value = withTiming(clampScale(scale.value * factor), { duration: 180 });
  }

  function resetMap() {
    scale.value = withTiming(1, { duration: 180 });
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
  }

  return (
    <View style={[styles.container, fullscreen && styles.fullscreenContainer, style]} onLayout={handleLayout}>
      <GestureDetector gesture={gestures}>
        <View style={styles.gestureSurface}>
          {!!mapSize.width && (
            <Animated.View
              style={[
                styles.mapLayer,
                {
                  height: mapSize.height,
                  left: mapPosition.left,
                  top: mapPosition.top,
                  width: mapSize.width,
                },
                animatedMapStyle,
              ]}>
              <Image source={subwayMap} style={styles.mapImage} contentFit="contain" />
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <View style={styles.controls}>
        <MapButton icon="plus" label="放大" onPress={() => zoomBy(ZOOM_STEP)} />
        <MapButton icon="minus" label="缩小" onPress={() => zoomBy(1 / ZOOM_STEP)} />
        <MapButton icon="home" label="复原" onPress={resetMap} />
        {fullscreen && onExitFullscreen ? (
          <MapButton icon="close" label="退出全屏" onPress={onExitFullscreen} />
        ) : null}
        {!fullscreen && onRequestFullscreen ? (
          <MapButton icon="fullscreen" label="全屏" onPress={onRequestFullscreen} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4f5f7',
    flex: 1,
    overflow: 'hidden',
  },
  controls: {
    gap: 10,
    position: 'absolute',
    right: 12,
    top: 14,
  },
  fullscreenContainer: {
    backgroundColor: '#eef0f3',
  },
  gestureSurface: {
    flex: 1,
  },
  mapButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderColor: '#dfe4eb',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#22324a',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    width: 44,
  },
  mapImage: {
    height: '100%',
    width: '100%',
  },
  mapLayer: {
    position: 'absolute',
  },
  pressed: {
    opacity: 0.72,
  },
});
