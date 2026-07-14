import { useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubwayMapViewer } from '@/components/subway-map-viewer';

export default function HomeScreen() {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
      <SubwayMapViewer onRequestFullscreen={() => setFullscreen(true)} />

      <Modal animationType="fade" visible={fullscreen} onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={styles.fullscreenPage}>
          <SubwayMapViewer fullscreen onExitFullscreen={() => setFullscreen(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullscreenPage: {
    backgroundColor: '#eef0f3',
    flex: 1,
  },
  page: {
    backgroundColor: '#eef0f3',
    flex: 1,
  },
});
