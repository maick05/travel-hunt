import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { canEdit, editingSheets, saveItem } from '@/services/remote';
import { dateInput, dateSerial, findEditItem } from './edit-values';
import { clearTravelCache } from './repository';
import type { TableKey } from './schema';

type Target = { table: TableKey; item: Record<string, unknown>; title: string };
type Found = ReturnType<typeof findEditItem>;
type Drafts = Record<string, string | boolean>;
const EditContext = createContext<((target: Target) => void) | null>(null);

export function EditProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open(next: Target) {
    setTarget(next);
    setFound(null);
    setDrafts({});
    setError('');
    setBusy(true);
    try { setFound(findEditItem(await editingSheets(), next.table, next.item)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!found) return;
    try {
      const alteracoes = found.fields.flatMap((field) => {
        const draft = drafts[field.key];
        if (draft === undefined) return [];
        let valor: string | number | boolean = draft;
        if (field.type === 'date' && String(draft).trim()) {
          const serial = dateSerial(String(draft));
          if (serial === null) throw new Error(`${field.label}: informe uma data válida (AAAA-MM-DD HH:mm).`);
          valor = serial;
        } else if (field.type === 'number' && String(draft).trim()) {
          valor = Number(String(draft).trim().replace(',', '.'));
          if (!Number.isFinite(valor)) throw new Error(`${field.label}: informe um número válido.`);
        }
        if (typeof valor === 'string' && valor.startsWith('=')) throw new Error(`${field.label}: fórmulas não podem ser inseridas.`);
        return [{ coluna: field.column + 1, valor }];
      });
      if (!alteracoes.length) { setTarget(null); return; }
      setBusy(true);
      setError('');
      await saveItem({ aba: found.sheet.id, linha: found.row.numero, versao: found.row.versao, alteracoes });
      await clearTravelCache();
      await queryClient.invalidateQueries();
      setTarget(null);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function refresh() {
    setBusy(true);
    try { await queryClient.invalidateQueries({ queryKey: ['travel-data'] }); setTarget(null); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <EditContext.Provider value={canEdit() ? (next) => void open(next) : null}>
      {children}
      <Modal visible={target !== null} transparent animationType="slide" onRequestClose={() => { if (!busy) setTarget(null); }}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>Editar {target?.title}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar edição" disabled={busy} onPress={() => setTarget(null)} style={styles.iconButton}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.light.text} />
              </Pressable>
            </View>
            {busy && !found ? <ActivityIndicator style={styles.loading} /> : null}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.fields}>
              {found?.fields.map((field) => {
                const initial = field.type === 'date' && typeof field.value === 'number' ? dateInput(field.value) : field.value;
                return (
                  <View key={field.key} style={styles.field}>
                    <ThemedText type="smallBold">{field.label}</ThemedText>
                    {field.type === 'boolean' ? (
                      <Switch accessibilityLabel={field.label} value={drafts[field.key] === undefined ? String(initial).toLowerCase() === 'true' : Boolean(drafts[field.key])} onValueChange={(value) => setDrafts((previous) => ({ ...previous, [field.key]: value }))} disabled={busy} />
                    ) : (
                      <TextInput accessibilityLabel={field.label} value={String(drafts[field.key] ?? initial ?? '')} onChangeText={(value) => setDrafts((previous) => ({ ...previous, [field.key]: value }))} editable={!busy} keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'} placeholder={field.type === 'date' ? 'AAAA-MM-DD HH:mm' : undefined} style={styles.input} />
                    )}
                  </View>
                );
              })}
              {found && !found.fields.length ? <ThemedText>Nenhum campo disponível para edição.</ThemedText> : null}
              {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            </ScrollView>
            {!found && error ? <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.cancel} disabled={busy}><ThemedText type="link">Atualizar dados</ThemedText></Pressable>
            </View> : null}
            {found ? <View style={styles.actions}>
              {error ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void refresh()} style={styles.cancel}><ThemedText type="link">Atualizar dados</ThemedText></Pressable> : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setTarget(null)} style={styles.cancel}><ThemedText>Cancelar</ThemedText></Pressable>
              <Pressable accessibilityRole="button" disabled={busy || !found.fields.length} onPress={() => void save()} style={[styles.save, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="content-save-outline" size={20} color="#FFFFFF" /><ThemedText style={styles.saveText}>Salvar</ThemedText></>}
              </Pressable>
            </View> : null}
          </View>
        </View>
      </Modal>
    </EditContext.Provider>
  );
}

export function EditButton({ table, item, title, inverse = false }: Target & { inverse?: boolean }) {
  const open = useContext(EditContext);
  if (!open) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${title}`} onPress={(event) => { event.stopPropagation(); open({ table, item, title }); }} style={styles.editButton}>
      <MaterialCommunityIcons name="pencil-outline" size={20} color={inverse ? '#FFFFFF' : Colors.light.accent} />
      <ThemedText type="smallBold" style={{ color: inverse ? '#FFFFFF' : Colors.light.accent }}>Editar</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.three, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', backgroundColor: Colors.light.backgroundElement, borderRadius: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderBottomWidth: 1, borderColor: Colors.light.border },
  title: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: Spacing.four },
  fields: { padding: Spacing.three, gap: Spacing.three },
  field: { gap: Spacing.one },
  input: { minHeight: 44, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 4, padding: Spacing.two, backgroundColor: '#FFFFFF', color: Colors.light.text },
  error: { color: '#B3261E' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderTopWidth: 1, borderColor: Colors.light.border },
  cancel: { padding: Spacing.two },
  save: { minHeight: 44, minWidth: 100, flexDirection: 'row', gap: Spacing.one, alignItems: 'center', justifyContent: 'center', borderRadius: 4, paddingHorizontal: Spacing.three, backgroundColor: Colors.light.accent },
  saveText: { color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
  editButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one, alignSelf: 'flex-start', paddingHorizontal: Spacing.one },
});