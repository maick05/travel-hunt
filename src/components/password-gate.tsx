import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ScreenBackground } from '@/components/screen-background';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { restoreEditing, unlock, unlockFromUrl, unlockStored, USE_REMOTE } from '@/services/remote';

/** Tela de senha: os dados do build publicado só abrem com a senha que criptografou o arquivo. */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(!USE_REMOTE);
  const [checking, setChecking] = useState(USE_REMOTE);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!USE_REMOTE) return;
    unlockFromUrl()
      .then((ok) => ok || unlockStored())
      .then(async (ok) => {
        if (ok) await restoreEditing();
        setUnlocked(ok);
        setChecking(false);
      });
  }, []);

  if (unlocked) return <>{children}</>;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await unlock(password, role);
      setUnlocked(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBackground>
      <View style={styles.center}>
        {checking ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.box}>
            <Card>
              <ThemedText type="subtitle">Travel Hunt</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Informe o MD5 da senha para abrir os dados da viagem.
              </ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                secureTextEntry
                autoFocus
                autoCapitalize="none"
                placeholder="MD5 da senha"
                style={styles.input}
              />
              <TextInput
                value={role}
                onChangeText={setRole}
                onSubmitEditing={submit}
                secureTextEntry
                autoCapitalize="none"
                placeholder="MD5 de edição (opcional)"
                style={styles.input}
              />
              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
              <Pressable onPress={submit} disabled={busy || !password} style={[styles.button, (busy || !password) && styles.disabled]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {busy ? 'Abrindo…' : 'Entrar'}
                </ThemedText>
              </Pressable>
            </Card>
          </View>
        )}
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  box: { width: '100%', maxWidth: 400 },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: Colors.light.text,
  },
  error: { color: '#B3261E' },
  button: { backgroundColor: Colors.light.accent, borderRadius: Spacing.two, padding: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF' },
});
