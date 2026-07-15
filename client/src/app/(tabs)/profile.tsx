import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';

export default function ProfileScreen() {
  const { user, logout, changePassword } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function closeModal() {
    setModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSubmitting(false);
  }

  async function submitPasswordChange() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('提示', '请完整填写密码信息');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('提示', '新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }

    try {
      setSubmitting(true);
      await changePassword(currentPassword, newPassword);
      closeModal();
      await logout();
      Alert.alert('修改成功', '请使用新密码重新登录');
    } catch {
      Alert.alert('修改失败', '请检查当前密码是否正确');
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.center}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.slice(0, 1) || '我'}</Text>
        </View>

        <Text style={styles.name}>{user?.username || '未命名用户'}</Text>
        <Text style={styles.account}>{user?.account}</Text>

        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => setModalVisible(true)}>
            <Text style={styles.primaryButtonText}>修改密码</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={logout}>
            <Text style={styles.secondaryButtonText}>退出登录</Text>
          </Pressable>
        </View>
      </View>

      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>修改密码</Text>
            <TextInput
              secureTextEntry
              placeholder="当前密码"
              placeholderTextColor="#9AA3AF"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
            />
            <TextInput
              secureTextEntry
              placeholder="新密码"
              placeholderTextColor="#9AA3AF"
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
            />
            <TextInput
              secureTextEntry
              placeholder="确认新密码"
              placeholderTextColor="#9AA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={submitting}
                style={({ pressed }) => [styles.confirmButton, (pressed || submitting) && styles.pressed]}
                onPress={submitPasswordChange}>
                <Text style={styles.confirmButtonText}>{submitting ? '提交中' : '确认'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#F7F9FD',
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#0349B8',
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    marginBottom: 18,
    width: 76,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  name: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '900',
  },
  account: {
    color: '#64748B',
    fontSize: 16,
    marginTop: 8,
  },
  actions: {
    gap: 14,
    marginTop: 34,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0349B8',
    borderRadius: 8,
    height: 54,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE8',
    borderRadius: 8,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#D12F2F',
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  modalPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 18,
  },
  input: {
    borderColor: '#D8DEE8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 17,
    height: 52,
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 17,
    fontWeight: '800',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#0349B8',
    borderRadius: 8,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
